---
title: ReviewPulse-Agent
emoji: "📝"
colorFrom: pink
colorTo: yellow
sdk: docker
app_port: 7860
pinned: false
---

# ReviewPulse-Agent

Agente inteligente basado en modelos y orientado a metas que clasifica reseñas de un hotel piloto por polaridad (positiva, negativa o neutra) y tema (limpieza, servicio, ubicación o precio). Compara cada semana con su historial y alerta al gerente cuando aumenta el tono negativo de un tema.

El proyecto usa FastAPI para la API y servir la interfaz HTML/CSS/JavaScript, Docker para empaquetar la aplicación y Hugging Face Spaces con Docker SDK para el despliegue. No necesita GPU, claves de API ni conexión a internet una vez instaladas las dependencias.

> La aplicación usa reseñas generadas por el simulador, no las API de TripAdvisor ni Google. El envío externo de correos no está habilitado en esta interfaz.

## Requisitos

- Python 3.11 o superior (probado con 3.12 y 3.13).
- Dependencias de `requirements.txt`.
- Docker para ejecutar la imagen localmente.

Se exige **scikit-learn 1.9.1** porque `datos/modelo.joblib` fue guardado con esa versión. El backend carga el modelo original de forma estricta y falla explícitamente si falta, está dañado o la versión no coincide; no lo reentrena ni lo sobrescribe al iniciar.

## Instalación y ejecución local

```bash
git clone https://github.com/Ellen-01/reviewpulse-agent.git
cd reviewpulse-agent
python -m venv .venv
source .venv/bin/activate        # en Windows: .venv\Scripts\activate
python -m pip install -r requirements.txt
python -m api.run
```

La aplicación queda en `http://localhost:7860`. La documentación interactiva de la API está en `/docs` y el estado del servicio en `/health`.

Para cambiar el puerto, define la variable de entorno `PORT` antes de iniciar la aplicación. El valor predeterminado es `7860`.

## Interfaz y API

La página en `/` usa el backend real para mostrar el panel, analizar reseñas y ejecutar escenarios. Los archivos del frontend están en `web/static/`.

Endpoints principales:

- `GET /health`: estado del servicio y versión del modelo cargado.
- `POST /api/reviews/analyze`: valida y clasifica una reseña en español, con probabilidades y marca de revisión manual.
- `POST /api/scenarios/run`: ejecuta el agente original para un escenario (`E01`–`E12`) y semilla; devuelve resultados, métricas, eventos y reportes.
- `GET /api/dashboard`: historial de demostración E02/semilla 11.
- `GET /api/scenarios`: escenarios disponibles.
- `GET /api/evaluations`: resultados M1–M4 guardados.
- `GET /docs`: documentación Swagger.

## Ejecución del agente y evaluaciones

Para ejecutar un escenario desde la línea de comandos:

```bash
python ejecutar_agente.py --escenario E02 --semilla 11
```

Escenarios disponibles: `E01` a `E12`; E10 y E11 representan fallas esperadas de plataforma.
Cada ejecución crea un directorio exclusivo bajo `salidas/demo/` y conserva los registros anteriores; la ruta del log se imprime al finalizar.

Para ejecutar las pruebas de desempeño:

```bash
python pruebas/ejecutar_pruebas.py
python pruebas/ejecutar_pruebas.py --rapido
```

La ejecución completa realiza cinco repeticiones por escenario y tarda unos 10 minutos. La opción rápida ejecuta una repetición. Las salidas rápidas y los registros detallados se escriben en directorios separados; revisa la ruta de salida antes de regenerar resultados oficiales.

Cada ejecución crea un directorio nuevo y exclusivo bajo `salidas/pruebas/` o `salidas/pruebas_rapido/`; no sobrescribe los resultados guardados en la raíz de esas carpetas. La ruta exacta se imprime al terminar.

`pruebas/calibrar_umbrales.py` guarda cada calibración bajo `salidas/calibracion/` en un directorio exclusivo. `pruebas/techo_deteccion.py` hace lo mismo bajo `salidas/pruebas/`; ambos imprimen la ruta nueva y conservan sus resultados anteriores.

Los resultados resumidos conservados en el repositorio están en `salidas/pruebas/`: `tabla_resultados.md`, `resumen.json`, `m1_clasificacion.csv` y `escenarios.csv`. La versión evaluada reporta M1 81%, M2 52%, M3 100% y M4 3,1%; el análisis académico correspondiente está en los documentos históricos.

Para ejecutar las pruebas unitarias:

```bash
python -m unittest discover -s tests -v
```

## Docker

Desde la raíz del proyecto:

```bash
docker build -t reviewpulse-agent .
docker run --rm -p 7860:7860 reviewpulse-agent
```

Abre `http://localhost:7860`. La imagen usa la variable `PORT` (por defecto `7860`) y ejecuta `api.run`.

Se soportan Python 3.12 y 3.13: Docker usa Python 3.12 y GitHub Actions ejecuta las pruebas en ambas versiones. `scikit-learn` permanece fijado en 1.9.1 para ser compatible con el modelo serializado.

## Hugging Face Spaces

El encabezado de este README configura el Space con `sdk: docker` y `app_port: 7860`.

1. Crea un Space nuevo y selecciona **Docker** como SDK.
2. Sube el proyecto conservando `datos/modelo.joblib`, los CSV de evaluación, `reviewpulse/`, `api/`, `web/`, `config/` y `salidas/pruebas/`.
3. Espera a que Hugging Face construya el `Dockerfile`.
4. Verifica `/health` y `/docs` en la URL del Space.

No se necesita GPU ni una clave de API. El sistema de archivos local de un Space puede ser efímero: las corridas de escenario de la API usan directorios temporales, por lo que su SQLite, logs y reportes desaparecen al terminar la solicitud, igual que en la demostración técnica original. Para persistencia entre reinicios hace falta configurar almacenamiento persistente.

Como el Space es público, `POST /api/scenarios/run` admite hasta cinco ejecuciones por minuto y una ejecución simultánea por proceso. Las solicitudes que excedan esos límites reciben HTTP 429 y `Retry-After`. El límite es compartido por los visitantes de ese proceso y se restablece al reiniciarlo; no es un sistema de autenticación.

## Arquitectura y archivos conservados

```text
api/                   API FastAPI y punto de entrada
web/static/            interfaz HTML, CSS y JavaScript
reviewpulse/           modelo, preprocesamiento y lógica del agente
datos/                 modelo entrenado y conjuntos de evaluación manual
config/                configuración de umbrales
pruebas/               escenarios de evaluación y herramientas de análisis
salidas/pruebas/        resultados resumidos originales
tests/                 pruebas unitarias y de API
Dockerfile             imagen para ejecución local y Spaces
```

El agente conserva el ciclo percepción → decisión → acción, la memoria de trabajo e histórica SQLite, el planificador STRIPS con búsqueda en anchura, los escenarios, los actuadores y la evaluación. La configuración de alertas se encuentra en `config/config.json`.

El modelo guardado es `datos/modelo.joblib`; no se sustituye por otro. Las evaluaciones originales `datos/evaluacion_manual.csv` y `datos/evaluacion_manual_holdout.csv`, así como los resultados guardados, se conservan.

La carpeta `docs/` contiene documentación y entregables académicos; los antecedentes históricos se identifican en la sección siguiente. No forma parte de la ruta de ejecución de FastAPI.

## Migración y documentación vigente

FastAPI es el backend actual y sirve el frontend independiente de `web/static/`. No hay implementación, dependencia ni configuración de ejecución de Streamlit. Las exclusiones `.streamlit/secrets.toml` que permanecen en `.gitignore` y `.dockerignore` son defensivas: evitan incluir secretos locales antiguos en Git o en la imagen Docker.

Los diagramas vigentes de la arquitectura FastAPI y sus flujos son [arquitectura_fastapi_hito2.svg](docs/arquitectura_fastapi_hito2.svg), [secuencia_tipico_fastapi_hito2.svg](docs/secuencia_tipico_fastapi_hito2.svg) y [secuencia_excepcion_fastapi_hito2.svg](docs/secuencia_excepcion_fastapi_hito2.svg). Los PNG, el PDF/DOCX del documento anterior y la bitácora previa se conservan como evidencia histórica; pueden describir la interfaz anterior y no son instrucciones para ejecutar la aplicación actual.

El PDF del Hito 2 se genera con `swift docs/generar_hito2.swift`; el generador no sobrescribe un destino existente. `docs/armar_documento.js` genera el DOCX histórico y no debe usarse para crear el Hito 2 porque apuntaba a ese archivo anterior. El manifiesto `CAMBIOS_CODIGO_Y_PUBLICACION.md` también es histórico. Sus antiguas instrucciones de publicación no aplican a la rama actual y no deben usarse para publicar a `main`.

La fuente del informe y la bitácora están en `docs/hito2_informe.md` y `docs/hito2_bitacora_ia.md`. El PDF final es `ReviewPulse-Agent_hito2.pdf`; los resultados y la verificación reproducible se conservan en `salidas/hito2/`.
