# Correcciones de código y publicación de ReviewPulse-Agent

> **Aviso de vigencia:** este manifiesto conserva el historial de una entrega anterior. Sus instrucciones de publicación no aplican al estado actual. El proyecto vigente se trabaja en `migration/fastapi-hf-space`; no se debe publicar a `main`. Consulta `README.md` para la arquitectura y ejecución actuales.

Base: ZIP `reviewpulse-agent-main.zip` aportado por el equipo. El proyecto se mantiene **independiente** del prototipo alternativo trabajado anteriormente.

## Archivos cambiados

| Archivo | Cambio | Razón |
|---|---|---|
| `reviewpulse/agente.py` | Cierre seguro de log + conexión SQLite en `finally` | Corregir `WinError 32` en carpetas temporales Windows y evitar fugas ante excepciones |
| `reviewpulse/memoria.py` | Método `cerrar()` que libera la conexión | Centralizar el cierre explícito |
| `requirements.txt` | Fijar `scikit-learn==1.9.1` | Evitar la carga cruzada del modelo serializado en 1.9.1 con scikit-learn 1.8.0 |
| `README.md` | URLs correctas, instrucciones y límites de los logs | Que el repositorio represente fielmente el ZIP y su despliegue |
| `tests/test_cierre_recursos.py` | Dos pruebas de regresión | Verificar liberación en éxito y error |
| `.github/workflows/comprobacion.yml` | Integración continua (GitHub Actions) | Detectar fallas de instalación, pruebas y escenarios E02/E11 en Python 3.13 |
| `.gitignore` | Excluir cachés de pruebas | Evitar archivos temporales en el repositorio |
| `CAMBIOS_CODIGO_Y_PUBLICACION.md` | Este manifiesto | Trazabilidad para el equipo y el evaluador |

## Sin cambios

- `datos/modelo.joblib` **no fue modificado** ni reentrenado.
- Reglas de detección, semillas y umbrales de `config/config.json` y `pruebas/umbrales.json` sin cambios.
- Los archivos históricos en `salidas/pruebas/` se conservan sin modificación.
- Los PDF, el Word y la bitácora existentes permanecen **sin editar**: su versión académica definitiva debe reemplazarse en una siguiente etapa.

## Publicación (instrucciones históricas)

Este bloque describía la publicación de un ZIP anterior. No contiene pasos vigentes para subir cambios. En particular, no se debe copiar ni ejecutar comandos de publicación a `main`; para la rama y el flujo actuales, consultar `README.md` y verificar el estado Git antes de cualquier operación.

## Verificación sugerida

```powershell
py -3.13 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m unittest discover -s tests -v
.\.venv\Scripts\python.exe ejecutar_agente.py --escenario E02 --semilla 11
.\.venv\Scripts\python.exe -m api.run
```

**Nota:** esta actualización corrige el código y las instrucciones. No prueba recepción real de alertas por correo, no sustituye la batería de 60 escenarios ni corrige por sí sola las definiciones SMART del documento.

## Alcance de las verificaciones efectuadas antes del paquete

- Dos pruebas unitarias nuevas `tests/test_cierre_recursos.py`: **2/2 pasaron**.
- Compilación de Python: **OK**.
- Caso E02, semilla 11, ejecutado desde cero: **486 reseñas clasificadas, 21 descartadas, 14/14 reportes y una alerta a las 12 h simuladas**.
- Caso E11, semilla 11, ejecutado desde cero: **487 reseñas clasificadas, 20 descartadas, 14/14 reportes, dos reportes incompletos y una alerta tardía**.
- Estas pruebas se ejecutaron aquí con **scikit-learn 1.8.0**, que advierte incompatibilidad con el modelo guardado en 1.9.1. **No se pudo instalar 1.9.1 en este entorno desconectado**; la instalación exacta y el primer GitHub Actions deben validarse en la computadora del equipo o CI. Python del entorno de pruebas: 3.13.
- **No se repitió la batería completa de 60 corridas** y no se probó visualmente la interfaz alojada. No interpretar estas pruebas como nueva medición SMART.
