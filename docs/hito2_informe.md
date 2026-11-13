<!-- PAGE: Portada -->
# HITO 2
## ReviewPulse-Agent

Datos preparados, línea base ejecutada y primeras evidencias verificadas

Inteligencia Artificial · Universidad Tecnológica de Bolívar

Ellen Nicole Ordoñez Chavez (T00079685) · Sara Bastidas Triana (T00081674)

13 de noviembre de 2026

Alcance: migración documentada a FastAPI con frontend independiente, comprobación local y preservación de resultados históricos. La aplicación se valida con datos simulados; no se afirma integración con plataformas reales ni despliegue público verificado.

<!-- PAGE: Página de avance -->
# Página de avance

## Estado
La aplicación local ejecuta FastAPI y sirve la interfaz independiente desde `web/static/`. La interfaz consumió endpoints reales para panel, clasificación, escenarios y evaluaciones. El modelo original cargó sin reentrenamiento.

## Evidencia nueva
- 14 de 14 pruebas unitarias pasaron en Python 3.12.0.
- `compileall` de los módulos del proyecto pasó con la caché dirigida a `/tmp`, sin dejar archivos Python generados en el repositorio.
- La prueba rápida completó 12 escenarios con una repetición (semilla 11). Es demostrativa, no reemplaza la evaluación oficial.
- El smoke test API verificó HTTP 200 para salud, frontend, recursos JavaScript, escenarios, panel, evaluaciones, clasificación y escenario E02.
- En navegador, la clasificación devolvió “Positiva · Servicio”; la demostración técnica mostró 486 reseñas, 14/14 reportes y un resultado E02.

## Línea base que se conserva
- M1: 81,0 % de polaridad en C03 (meta 85 %), no cumple.
- M2: 26/50 incidentes detectados en 24 h (52 %, meta 90 %), no cumple.
- M3: 840/840 reportes a tiempo (100 %), cumple.
- M4: 1/32 falsos positivos (3,1 %, máximo 10 %), cumple.

## Pendientes prioritarios
Evaluar con reseñas reales etiquetadas; mejorar y volver a medir M1 y M2 sin cambiar los umbrales después de observar resultados; decidir la persistencia requerida para Hugging Face Spaces; confirmar un Space público y su URL antes de declarar despliegue.

Los resultados rápidos no son comparables con la línea base de cinco repeticiones: obtuvieron M1 C03 = 85 % y M2 = 5/10 (50 %). La evaluación oficial permanece intacta. Esta página ocupa una sola página del PDF.

<!-- PAGE: Datos y conocimientos listos -->
# Datos y conocimientos listos

## Datos disponibles
- El entorno genera reseñas sintéticas en español para los temas limpieza, servicio, ubicación y precio, con polaridad positiva, negativa y neutra. TripAdvisor y Google son fuentes simuladas; no se consultan sus API.
- Hay dos conjuntos manuales de evaluación, de 40 reseñas cada uno: desarrollo y control holdout. También se genera un corpus sintético de entrenamiento y evaluación.
- `datos/modelo.joblib` conserva el clasificador evaluado; se carga estrictamente con scikit-learn 1.9.1 y no se reentrena al iniciar la API.

## Modelo y conocimiento explícito
El modelo combina TF-IDF de palabras y caracteres, rasgos de un léxico en español y regresión logística para estimar polaridad y tema. Versión: `tfidf+lexico-logreg-2.0`. El agente no usa un LLM en tiempo de ejecución.

Las reglas de entrada, confianza y alerta están configuradas; el agente usa una prueba binomial por tema, un aumento mínimo, un mínimo de negativas y comparación con hasta seis semanas previas. Los valores predeterminados están en `config/config.json`.

## Componentes funcionales
Percepción y validación (`reviewpulse/preprocesamiento.py`), planificación STRIPS con búsqueda en anchura (`reviewpulse/planificador.py`), ciclo percepción–decisión–acción y razonamiento (`reviewpulse/agente.py`), memoria de trabajo y repositorio SQLite (`reviewpulse/memoria.py`), simulador y 12 escenarios (`reviewpulse/entorno.py`, `reviewpulse/escenarios.py`), notificaciones y reportes (`reviewpulse/actuadores.py`), evaluación (`reviewpulse/evaluacion.py`) y API FastAPI con frontend independiente.

La memoria y los reportes de una solicitud API se guardan en un directorio temporal; desaparecen al terminar la solicitud. El sistema de archivos de Hugging Face Spaces puede ser efímero.

<!-- PAGE: Línea base y resultados -->
# Línea base y resultados

## Evaluación oficial conservada
El resumen versionado fue generado el 15 de octubre de 2026 con cinco semillas y 60 corridas. No se volvió a ejecutar ni a reemplazar en este trabajo.

- M1, conjunto de control C03: polaridad 81,0 % ± 2,9 % y tema 90,0 % ± 0,0 %. La polaridad no alcanza 85 %.
- M2: 26 de 50 incidentes detectados dentro de 24 horas, 52 % frente a la meta de 90 %.
- M3: 840 de 840 reportes dentro de 24 horas, 100 %; cumple.
- M4: 1 de 32 alertas falsas, 3,1 % frente al límite estricto de 10 %; cumple.

Fuente: `salidas/pruebas/resumen.json` y `salidas/pruebas/tabla_resultados.md`.

## Ejecución rápida nueva
El 13 de noviembre se ejecutó `python3 pruebas/ejecutar_pruebas.py --rapido`. La salida aislada quedó en `salidas/pruebas_rapido/rapido_gy5pfuq3/`; se preservó además un resumen y sus CSV en `salidas/hito2/evaluacion_rapida/`.

Una repetición, semilla 11: C03 polaridad 85 % y tema 90 %; M2 = 5/10 (50 %); M3 = 168/168 (100 %); M4 = 0/6 (0 %). Este resultado de demostración no sustituye el oficial de cinco repeticiones y no autoriza a declarar M1 o M2 corregidas.

<!-- PAGE: Verificación funcional -->
# Verificación funcional local

El 13 de noviembre se inició Uvicorn localmente en `127.0.0.1:18765`; se detuvo después de la prueba. El backend cargó el modelo original. No se montaron ni modificaron datos históricos.

## Respuestas observadas
- `GET /health`: 200; estado `ok`; modelo `tfidf+lexico-logreg-2.0`.
- `GET /` y `GET /static/app.js`: 200; HTML y JavaScript servido por FastAPI.
- `GET /api/scenarios`: 200; 12 escenarios.
- `GET /api/dashboard`: 200; 486 reseñas, 21 descartadas, 14 reportes y una alerta.
- `GET /api/evaluations`: 200; devolvió los veredictos oficiales M1/M2 no cumplen y M3/M4 cumplen.
- `POST /api/reviews/analyze`: 200; reseña de humo clasificada positiva, tema servicio, confianza 94,5 %.
- `POST /api/scenarios/run` con E02/semilla 11: 200; 486 clasificadas, 21 descartadas, una alerta y 14/14 reportes.

La prueba en navegador esperó a que cargara el panel; luego usó “Probar una reseña” y “Demostración técnica”. La página mostró la clasificación y las métricas de E02, y cargó la tabla de evaluaciones. Las solicitudes anteriores demuestran conectividad del frontend con la API, no solo disponibilidad de archivos estáticos.

La metadata del Space y el Dockerfile coinciden en SDK Docker y puerto 7860; la imagen usa Python 3.12 y arranca `api.run`. Se revisó esa configuración estáticamente, pero no se construyó una imagen Docker. No se comprobó un Space público ni se verificó una URL.

<!-- DIAGRAMA: docs/arquitectura_fastapi_hito2.svg | Arquitectura actual FastAPI -->
<!-- DIAGRAMA: docs/secuencia_tipico_fastapi_hito2.svg | Flujo típico de la aplicación -->
<!-- DIAGRAMA: docs/secuencia_excepcion_fastapi_hito2.svg | Manejo de una plataforma caída -->
<!-- BITACORA -->
<!-- PAGE: Conclusiones y pendientes -->
# Conclusiones y pendientes

La migración funcional está presente: FastAPI es el backend, sirve el frontend independiente y la UI consume sus endpoints. La suite unitaria pasó y las pruebas directas de API y navegador ejercitaron clasificación, panel, escenarios, memoria temporal y evaluaciones.

La línea base sigue siendo parcialmente satisfactoria: M3 y M4 cumplen; M1 y M2 no. La corrida rápida nueva ofrece evidencia adicional, pero una semilla no reemplaza la medición oficial ni demuestra una mejora general.

No se encontraron fuentes activas de ejecución de Streamlit. Se conservaron el DOCX, PDF, bitácora y PNG históricos; sus referencias a la interfaz anterior se identifican ahora como evidencia histórica. Los diagramas FastAPI nuevos se entregan en SVG y se incluyen en este informe.

## Trabajo pendiente
- Obtener y etiquetar reseñas reales con consentimiento y criterios de privacidad adecuados.
- Abordar la generalización del clasificador y la potencia de detección de M2; volver a evaluar con los umbrales predefinidos y en una salida aislada.
- Confirmar qué almacenamiento persistente requiere el Space y documentar sus límites.
- Crear o identificar el Space, desplegarlo y registrar su URL únicamente después de verificar `/health` y la interfaz.
- Revisar la advertencia de deprecación de `httpx` emitida por Starlette TestClient al ejecutar las pruebas; no impidió que pasaran.

No se modificaron el modelo, los CSV de evaluación, resultados históricos, registros, bases de datos ni la lógica de negocio.
