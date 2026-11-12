from __future__ import annotations

import json
import math
import threading
import tempfile
import time
from collections import deque
from contextlib import asynccontextmanager
from pathlib import Path

import sklearn
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, ConfigDict, Field

from reviewpulse.agente import CONFIG_DEFECTO, ReviewPulseAgent
from reviewpulse.entorno import EntornoHotel
from reviewpulse.escenarios import ESCENARIOS
from reviewpulse.evaluacion import evaluar_corrida
from reviewpulse.modelo import ClasificadorSentimiento, RUTA_MODELO
from reviewpulse.preprocesamiento import validar

ROOT = Path(__file__).resolve().parent.parent
FRONTEND = ROOT / "web" / "static"
CONFIG_PATH = ROOT / "config" / "config.json"
EXPECTED_SKLEARN_VERSION = "1.9.1"


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class ReviewRequest(StrictModel):
    text: str = Field(min_length=1, max_length=5000)


class AlertSettings(StrictModel):
    alfa: float | None = Field(default=None, ge=0.001, le=0.2)
    delta_minimo: float | None = Field(default=None, ge=0.0, le=0.5)
    z_minimo: float | None = Field(default=None, ge=0.0, le=5.0)
    min_negativas: int | None = Field(default=None, ge=1, le=10)
    umbral_confianza: float | None = Field(default=None, ge=0.3, le=0.9)


class ScenarioRequest(StrictModel):
    scenario: str = Field(pattern=r"^E(?:0[1-9]|1[0-2])$")
    seed: int = Field(default=11, ge=1, le=9999)
    settings: AlertSettings = Field(default_factory=AlertSettings)


class ScenarioExecutionLimiter:
    def __init__(
        self,
        max_requests: int = 5,
        window_seconds: float = 60.0,
        max_concurrent: int = 1,
    ):
        if max_requests < 1 or window_seconds <= 0 or max_concurrent < 1:
            raise ValueError("Los límites de ejecución deben ser positivos.")
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self._requests = deque()
        self._lock = threading.Lock()
        self._active = threading.BoundedSemaphore(max_concurrent)

    def try_acquire(self, now: float | None = None) -> tuple[str | None, int]:
        now = time.monotonic() if now is None else now
        cutoff = now - self.window_seconds
        with self._lock:
            while self._requests and self._requests[0] <= cutoff:
                self._requests.popleft()
            if len(self._requests) >= self.max_requests:
                retry_after = max(1, math.ceil(self.window_seconds - (now - self._requests[0])))
                return "rate_limit", retry_after
            if not self._active.acquire(blocking=False):
                return "concurrency_limit", 1
            self._requests.append(now)
        return None, 0

    def release(self) -> None:
        self._active.release()


def _load_original_model() -> ClasificadorSentimiento:
    if not RUTA_MODELO.is_file():
        raise FileNotFoundError(f"No se encontró el modelo entrenado requerido: {RUTA_MODELO}")
    if sklearn.__version__ != EXPECTED_SKLEARN_VERSION:
        raise RuntimeError(
            f"El modelo requiere scikit-learn {EXPECTED_SKLEARN_VERSION}; "
            f"se encontró {sklearn.__version__}."
        )
    model = ClasificadorSentimiento.cargar(permitir_reentrenamiento=False)
    if not isinstance(model, ClasificadorSentimiento):
        raise TypeError(f"El artefacto {RUTA_MODELO} no contiene un ClasificadorSentimiento.")
    return model


@asynccontextmanager
async def lifespan(application: FastAPI):
    application.state.model = _load_original_model()
    application.state.config = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
    application.state.dashboard = None
    application.state.dashboard_lock = threading.Lock()
    application.state.scenario_limiter = ScenarioExecutionLimiter()
    yield


app = FastAPI(
    title="ReviewPulse-Agent API",
    description="API para clasificar reseñas y ejecutar el agente original de ReviewPulse.",
    version="1.0.0",
    lifespan=lifespan,
)


@app.get("/", include_in_schema=False)
def index():
    return FileResponse(FRONTEND / "index.html")


app.mount("/static", StaticFiles(directory=FRONTEND), name="static")


@app.get("/health", tags=["estado"])
def health(request: Request):
    model = request.app.state.model
    return {"status": "ok", "model_loaded": True, "model_version": model.version}


@app.get("/api/config", tags=["agente"])
def get_config(request: Request):
    return request.app.state.config


@app.get("/api/scenarios", tags=["agente"])
def get_scenarios():
    return [
        {"id": key, "name": value.nombre, "description": value.descripcion, "type": value.tipo}
        for key, value in ESCENARIOS.items()
    ]


@app.get("/api/dashboard", tags=["panel"])
def dashboard(request: Request):
    if request.app.state.dashboard is None:
        with request.app.state.dashboard_lock:
            if request.app.state.dashboard is None:
                request.app.state.dashboard = _run_scenario(
                    request.app.state.model, "E02", 11, dict(request.app.state.config)
                )
    return {
        **request.app.state.dashboard,
        "confidence_threshold": request.app.state.config.get(
            "umbral_confianza", CONFIG_DEFECTO["umbral_confianza"]
        ),
    }


@app.post("/api/reviews/analyze", tags=["reseñas"])
def analyze_review(body: ReviewRequest, request: Request):
    valid, clean_text, reason = validar({"texto": body.text, "fecha": "2026-01-01"})
    if not valid:
        messages = {
            "texto_vacio_o_ruido": "Escribe una reseña con al menos tres palabras para poder analizarla.",
            "sin_fecha": "La reseña necesita una fecha.",
        }
        message = messages.get(reason)
        if message is None and reason.startswith("idioma_"):
            message = "El agente solo procesa reseñas en español."
        raise HTTPException(
            status_code=422,
            detail={"code": reason, "message": message or "El agente no pudo validar esta reseña."},
        )

    prediction = request.app.state.model.predecir([clean_text])[0]
    confidence_threshold = request.app.state.config.get(
        "umbral_confianza", CONFIG_DEFECTO["umbral_confianza"]
    )
    return {
        "text": clean_text,
        "polaridad": str(prediction.polaridad),
        "tema": str(prediction.tema),
        "confianza": float(prediction.confianza),
        "conf_polaridad": float(prediction.conf_polaridad),
        "conf_tema": float(prediction.conf_tema),
        "revision_manual": prediction.confianza < confidence_threshold,
        "umbral_confianza": confidence_threshold,
        "prob_polaridad": {str(k): float(v) for k, v in prediction.prob_polaridad.items()},
        "prob_tema": {str(k): float(v) for k, v in prediction.prob_tema.items()},
    }


@app.post("/api/scenarios/run", tags=["agente"])
def run_scenario(body: ScenarioRequest, request: Request):
    if body.scenario not in ESCENARIOS:
        raise HTTPException(status_code=404, detail="Escenario no encontrado.")
    limiter: ScenarioExecutionLimiter = request.app.state.scenario_limiter
    limit_reason, retry_after = limiter.try_acquire()
    if limit_reason is not None:
        if limit_reason == "rate_limit":
            detail = {
                "code": "scenario_rate_limit",
                "message": "Se alcanzó el límite de ejecuciones de escenarios por minuto.",
            }
        else:
            detail = {
                "code": "scenario_concurrency_limit",
                "message": "Ya hay una ejecución de escenario en curso.",
            }
        raise HTTPException(
            status_code=429,
            detail=detail,
            headers={"Retry-After": str(retry_after)},
        )
    try:
        settings = body.settings.model_dump(exclude_none=True)
        config = {**request.app.state.config, **settings}
        return _run_scenario(request.app.state.model, body.scenario, body.seed, config)
    finally:
        limiter.release()


@app.get("/api/evaluations", tags=["evaluación"])
def evaluations():
    summary_path = ROOT / "salidas" / "pruebas" / "resumen.json"
    table_path = ROOT / "salidas" / "pruebas" / "tabla_resultados.md"
    if not summary_path.is_file() or not table_path.is_file():
        raise HTTPException(status_code=404, detail="No se encontraron los resultados de evaluación guardados.")
    return {
        "summary": json.loads(summary_path.read_text(encoding="utf-8")),
        "table_markdown": table_path.read_text(encoding="utf-8"),
    }


def _run_scenario(model: ClasificadorSentimiento, scenario: str, seed: int, config: dict) -> dict:
    with tempfile.TemporaryDirectory(prefix="reviewpulse-") as temp_dir:
        output = Path(temp_dir)
        environment = EntornoHotel(ESCENARIOS[scenario], seed)
        agent = ReviewPulseAgent(environment, output, config, model)
        result = agent.ejecutar()
        metrics = evaluar_corrida(environment, result)
        events = agent.log.eventos
        log_text = (output / "log_ejecucion.jsonl").read_text(encoding="utf-8")
        reports_markdown = {
            int(path.stem.split("_")[1]): path.read_text(encoding="utf-8")
            for path in sorted((output / "reportes").glob("*.md"))
        }
        reports_json = {
            int(path.stem.split("_")[1]): json.loads(path.read_text(encoding="utf-8"))
            for path in sorted((output / "reportes").glob("*.json"))
        }
    return {
        "scenario": scenario,
        "seed": seed,
        "config": config,
        "results": result,
        "metrics": metrics,
        "events": events,
        "log": log_text,
        "reports_markdown": reports_markdown,
        "reports_json": reports_json,
        "truth": environment.verdad,
        "model_version": model.version,
    }
