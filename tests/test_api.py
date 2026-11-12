import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from fastapi.testclient import TestClient

from api.main import ScenarioExecutionLimiter, app
from reviewpulse.modelo import ClasificadorSentimiento


class ReviewPulseApiTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client_context = TestClient(app)
        cls.client = cls.client_context.__enter__()

    @classmethod
    def tearDownClass(cls):
        cls.client_context.__exit__(None, None, None)

    def test_health_reports_loaded_original_model(self):
        response = self.client.get("/health")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {
            "status": "ok",
            "model_loaded": True,
            "model_version": "tfidf+lexico-logreg-2.0",
        })

    def test_review_predictions_match_original_classifier(self):
        text = "La habitación estaba impecable y olía a limpio."
        original = self.client.app.state.model.predecir([text])[0]

        response = self.client.post("/api/reviews/analyze", json={"text": text})

        self.assertEqual(response.status_code, 200)
        result = response.json()
        self.assertEqual(result["polaridad"], str(original.polaridad))
        self.assertEqual(result["tema"], str(original.tema))
        self.assertEqual(result["prob_polaridad"], {
            str(k): float(v) for k, v in original.prob_polaridad.items()
        })
        self.assertEqual(result["prob_tema"], {str(k): float(v) for k, v in original.prob_tema.items()})

    def test_review_validation_uses_original_preprocessor(self):
        response = self.client.post("/api/reviews/analyze", json={"text": "The room is very clean"})
        self.assertEqual(response.status_code, 422)
        self.assertEqual(response.json()["detail"]["code"], "idioma_en")

        response = self.client.post("/api/reviews/analyze", json={"text": "bien"})
        self.assertEqual(response.status_code, 422)
        self.assertEqual(response.json()["detail"]["code"], "texto_vacio_o_ruido")

    def test_scenario_matches_original_e02_baseline(self):
        response = self.client.post("/api/scenarios/run", json={"scenario": "E02", "seed": 11})

        self.assertEqual(response.status_code, 200)
        result = response.json()
        self.assertEqual(result["metrics"]["resenas_clasificadas"], 486)
        self.assertEqual(result["metrics"]["resenas_descartadas"], 21)
        self.assertEqual(result["metrics"]["alertas_total"], 1)
        self.assertEqual(result["metrics"]["reportes_a_tiempo"], 14)
        self.assertEqual(result["metrics"]["exactitud_polaridad_flujo"], 0.9279835390946503)
        self.assertEqual(result["metrics"]["exactitud_tema_flujo"], 0.9567901234567902)
        self.assertEqual(len(result["results"]["resenas"]), 486)
        self.assertEqual(len(result["reports_markdown"]), 14)
        self.assertTrue(result["log"])

    def test_scenario_request_rejects_invalid_values(self):
        response = self.client.post("/api/scenarios/run", json={"scenario": "E99", "seed": 11})
        self.assertEqual(response.status_code, 422)

        response = self.client.post("/api/scenarios/run", json={"scenario": "E02", "seed": 0})
        self.assertEqual(response.status_code, 422)

    def test_scenario_run_returns_429_after_rate_limit(self):
        state = self.client.app.state
        original_limiter = state.scenario_limiter
        state.scenario_limiter = ScenarioExecutionLimiter(max_requests=1)
        self.addCleanup(setattr, state, "scenario_limiter", original_limiter)

        with patch("api.main._run_scenario", return_value={"scenario": "E02"}) as run:
            first = self.client.post("/api/scenarios/run", json={"scenario": "E02", "seed": 11})
            limited = self.client.post("/api/scenarios/run", json={"scenario": "E02", "seed": 11})

        self.assertEqual(first.status_code, 200)
        self.assertEqual(limited.status_code, 429)
        self.assertEqual(limited.json()["detail"]["code"], "scenario_rate_limit")
        self.assertGreaterEqual(int(limited.headers["Retry-After"]), 1)
        self.assertLessEqual(int(limited.headers["Retry-After"]), 60)
        run.assert_called_once()

    def test_scenario_run_returns_429_while_an_execution_is_active(self):
        state = self.client.app.state
        original_limiter = state.scenario_limiter
        limiter = ScenarioExecutionLimiter()
        state.scenario_limiter = limiter
        self.addCleanup(setattr, state, "scenario_limiter", original_limiter)
        self.assertEqual(limiter.try_acquire(), (None, 0))
        self.addCleanup(limiter.release)

        with patch("api.main._run_scenario") as run:
            response = self.client.post("/api/scenarios/run", json={"scenario": "E02", "seed": 11})

        self.assertEqual(response.status_code, 429)
        self.assertEqual(response.json()["detail"]["code"], "scenario_concurrency_limit")
        run.assert_not_called()

    def test_evaluation_and_scenario_resources_are_available(self):
        self.assertEqual(self.client.get("/api/evaluations").status_code, 200)
        self.assertEqual(self.client.get("/api/scenarios").status_code, 200)
        self.assertIn("ReviewPulse", self.client.get("/").text)
        self.assertEqual(self.client.get("/static/app.js").status_code, 200)
        self.assertEqual(self.client.get("/docs").status_code, 200)


class StrictModelLoadingTests(unittest.TestCase):
    def test_missing_model_fails_without_retraining(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            missing = Path(temp_dir) / "missing.joblib"
            with patch("reviewpulse.modelo.entrenar_modelo_base") as train:
                with self.assertRaises(FileNotFoundError):
                    ClasificadorSentimiento.cargar(missing, permitir_reentrenamiento=False)
            train.assert_not_called()

    def test_corrupt_model_fails_without_retraining(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            artifact = Path(temp_dir) / "broken.joblib"
            artifact.write_bytes(b"not a model")
            with patch("reviewpulse.modelo.joblib.load", side_effect=ValueError("broken")), \
                    patch("reviewpulse.modelo.entrenar_modelo_base") as train:
                with self.assertRaisesRegex(RuntimeError, "no se reentrenó"):
                    ClasificadorSentimiento.cargar(artifact, permitir_reentrenamiento=False)
            train.assert_not_called()

    def test_original_loader_remains_default_for_existing_callers(self):
        self.assertIsInstance(ClasificadorSentimiento.cargar(), ClasificadorSentimiento)


class ScenarioExecutionLimiterTests(unittest.TestCase):
    def test_limiter_rejects_concurrency_and_expires_old_requests(self):
        limiter = ScenarioExecutionLimiter(max_requests=2, window_seconds=60, max_concurrent=1)

        self.assertEqual(limiter.try_acquire(now=0), (None, 0))
        self.assertEqual(limiter.try_acquire(now=1), ("concurrency_limit", 1))
        limiter.release()

        self.assertEqual(limiter.try_acquire(now=2), (None, 0))
        limiter.release()
        self.assertEqual(limiter.try_acquire(now=60), (None, 0))
        limiter.release()


if __name__ == "__main__":
    unittest.main()
