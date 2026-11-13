<!-- PAGE: Bitácora IA · sesiones 9 y 10 -->
# Bitácora IA · Hito 2

## Herramienta y atribución
Herramienta declarada: asistente de IA usando Copilot SDK en VS Code. El identificador de modelo subyacente no se expuso en esta sesión; por tanto, se registra como no disponible y no se atribuye a otro proveedor. La bitácora anterior de Tarea 3 permanece sin cambios en `docs/bitacora_uso_ia.docx`.

## Sesión 9 · inspección
Fecha: 13 de noviembre de 2026.

Instrucción recibida: “Inspecciona todo el proyecto para preparar el Hito 2; no modifiques nada. Informa qué datos y conocimientos están listos, qué pruebas y resultados sirven como evidencia, qué falta para la bitácora y el PDF, y propone el plan.”

Resultado: revisión del código FastAPI, frontend, modelo, datos, evaluaciones guardadas y documentación. Se distinguieron los resultados oficiales históricos de las verificaciones nuevas; se detectó que las imágenes generadas y documentos anteriores aún muestran la interfaz antigua. No se editaron archivos en esta etapa.

Intervención humana: después de revisar el diagnóstico, la persona solicitante autorizó ejecutar las fases de limpieza, verificación, preparación del Hito 2 y PDF, con restricciones de preservar datos, no tocar `main` y no hacer commit ni push.

## Sesión 10 · ejecución y evidencia
Fecha: 13 de noviembre de 2026.

Instrucción recibida: ejecutar las cinco fases aprobadas; eliminar solo la implementación antigua si existe; validar FastAPI y frontend, pruebas unitarias y rápidas; preparar evidencia, página de avance, bitácora real y `ReviewPulse-Agent_hito2.pdf`; preservar documentos y resultados históricos.

Resultado: no se encontró implementación de Streamlit que eliminar. Se mantuvieron como históricos los documentos/PNG existentes, se identificaron en el README, se eliminaron una regla duplicada de exclusión y se añadieron avisos contra instrucciones de publicación antiguas. Se crearon tres diagramas SVG actuales, la fuente del informe y esta bitácora; no se cambió la lógica del agente.

Verificación registrada: 14/14 pruebas unitarias; `compileall`; evaluación rápida de 12 escenarios con una semilla (los modelos de M1 se entrenaron solo en memoria con `guardar=False`); consultas reales a los endpoints locales; prueba de clasificación y ejecución E02 desde el navegador; comprobación de hashes de modelo, datos y resultados históricos antes y después; validación del PDF y su contenido.

Resultado de la evaluación rápida: M1 C03 = 85 % en una repetición; M2 = 5/10 (50 %); M3 = 168/168 (100 %); M4 = 0/6 (0 %). Se informó como demostración, no como sustituto de la línea base oficial.

## Registro de cambios y decisiones humanas
El equipo conserva la responsabilidad sobre las decisiones de diseño, la selección de los umbrales, el análisis académico, las etiquetas y la aceptación del resultado. En esta sesión no se ajustaron umbrales ni se reentrenó o reemplazó el modelo guardado; los modelos temporales de M1 no se guardaron. No se desplegó a Hugging Face ni se modificaron resultados históricos.

La bitácora registra hechos observados en esta interacción. No afirma que la IA haya ejecutado acciones que no aparecen en los comandos ni adjudica un modelo no identificado.
