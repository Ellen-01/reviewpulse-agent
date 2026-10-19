# ReviewPulse-Agent

Agente inteligente **basado en modelos y orientado a metas** (Russell y Norvig) que clasifica las reseñas de un hotel piloto por polaridad (positiva, negativa, neutra) y tema (limpieza, servicio, ubicación, precio), compara cada semana contra su historial y alerta al gerente cuando el tono negativo de un tema se sale de lo normal.

Proyecto del curso Inteligencia Artificial, Universidad Tecnológica de Bolívar (Tarea 3: implementación y pruebas).

## Requisitos

- Python 3.11 o superior (probado con 3.12 y 3.13)
- Las dependencias de `requirements.txt` (scikit-learn, numpy, pandas, joblib, streamlit)

No necesita GPU, claves de API ni conexión a internet una vez instaladas las dependencias.

## Instalación

```bash
git clone <URL-del-repositorio>
cd reviewpulse-agent
python -m venv .venv
source .venv/bin/activate        # en Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

## Uso

**1. Ejecutar el agente desde cero en un escenario** (deja log, memoria SQLite, reportes y alertas en `salidas/demo/`):

```bash
python ejecutar_agente.py --escenario E02 --semilla 11
```

Escenarios: `E01` a `E12` (ver `reviewpulse/escenarios.py`). E02 es el caso típico; E10 y E11 son fallas esperadas de plataforma.

**2. Ejecutar todas las pruebas de desempeño** (11 casos de clasificación y 12 escenarios, 5 repeticiones cada uno):

```bash
python pruebas/ejecutar_pruebas.py           # completo, unos 10 minutos
python pruebas/ejecutar_pruebas.py --rapido  # 1 repetición, para la demo en vivo; escribe en salidas/pruebas_rapido/
```

Resultados oficiales en `salidas/pruebas/` (el modo `--rapido` no los toca): `tabla_resultados.md`, `resumen.json`, `m1_clasificacion.csv`, `escenarios.csv` y la carpeta `corridas/` con el log de cada ejecución.

**Resultados de la versión entregada:** M1 no se cumple (polaridad 81 % en el conjunto de control), M2 no se cumple (52 % de incidentes detectados en 24 h), M3 y M4 sí (100 % de reportes a tiempo, 3,1 % de falsos positivos). El análisis está en la sección 9.7 del documento.

**3. Interfaz web**

```bash
streamlit run app/streamlit_app.py
```

El menú lateral tiene dos partes. Para el gerente del hotel: *Resumen* (cifras y alertas), *Reseñas del hotel* (historial clasificado, con filtros), *Resumen por semana* y *Probar una reseña* (escribir una reseña en español y ver cómo la clasifica el agente). Para la evaluación: *Demostración técnica* (ejecutar un escenario del simulador, ver el registro percepción → decisión → acción, los resultados de las pruebas y los casos sugeridos). Los datos del panel son el escenario E02 con semilla 11, procesado por el agente al abrir la página.

**4. Reentrenar el modelo** (el agente lo carga ya entrenado desde `datos/modelo.joblib`; si no existe, lo entrena al arrancar):

```bash
python -c "from reviewpulse.modelo import entrenar_modelo_base; entrenar_modelo_base()"
```

## Despliegue en Streamlit Community Cloud

1. Suba el repositorio a GitHub (público).
2. En https://share.streamlit.io elija *Create app*, seleccione el repositorio, la rama `main` y el archivo `app/streamlit_app.py`.
3. Python 3.11 o superior. No requiere secretos.

## Estructura

```
reviewpulse/
  agente.py            ciclo percibir() → decidir() → actuar(); estado interno y metas
  planificador.py      planificación STRIPS con búsqueda en anchura (orientación a metas)
  entorno.py           simulador del hotel y conectores de plataformas (estocástico, dinámico)
  escenarios.py        12 escenarios de prueba (normales, límite, falla esperada)
  preprocesamiento.py  limpieza y validación: idioma, HTML, vacíos, fecha
  modelo.py            clasificador TF-IDF + léxico + regresión logística (herramienta externa)
  lexico.py            léxico de sentimiento y temas con manejo de negación
  memoria.py           memoria de trabajo y repositorio histórico SQLite
  actuadores.py        notificador de alertas y generador del resumen semanal
  evaluacion.py        cálculo de las medidas de desempeño contra la verdad del simulador
  corpus.py            generador de reseñas sintéticas en español
pruebas/
  umbrales.json        umbrales de aceptación, fijados antes de ejecutar las pruebas
  ejecutar_pruebas.py  pruebas M1–M4
  recolectar_estadisticas.py, calibrar_umbrales.py   calibración con semillas 101–105
  techo_deteccion.py   análisis de causa de M2 (regla aplicada a etiquetas reales)
datos/                 conjuntos de evaluación manual y modelo entrenado
config/config.json     umbrales de decisión que fija el gerente
app/streamlit_app.py   interfaz
docs/                  diagramas UML, matriz de decisión, guion del video, bitácora de IA
```

## Dónde está el ciclo percepción → decisión → acción

En `reviewpulse/agente.py`, método `paso()`:

```python
per  = self.percibir(ahora)   # sensores: plataformas, historial, configuración
plan = self.decidir(per)      # estado interno → meta → plan (BFS) → reglas de alerta
self.actuar(plan, per)        # actuadores: etiquetas, alerta, reporte, registro histórico
```

## Qué hace el código y qué hace cada herramienta

| Parte | Quién la hace |
|---|---|
| Percepción, validación, planificación, comparación estadística, decisión de alertar, redacción de la alerta, reporte, memoria | Código propio (Python) |
| Probabilidad de polaridad y de tema de cada reseña | Modelo scikit-learn entrenado antes del despliegue |
| Persistencia | SQLite (biblioteca estándar) |
| Interfaz | Streamlit |

No se usa ningún modelo de lenguaje grande (LLM) ni API paga.

## Modelo BERT

El diseño proponía un modelo tipo BERT para español. El punto de reemplazo está en `reviewpulse/modelo.py` (`ClasificadorBERT`): basta con devolver objetos `Prediccion` con la misma forma. El resto del agente no cambia.

## Reproducibilidad

Todas las fuentes de aleatoriedad usan semillas explícitas. Las semillas de prueba (11, 22, 33, 44, 55) están en `pruebas/umbrales.json`; la calibración usa semillas distintas (101 a 105).
