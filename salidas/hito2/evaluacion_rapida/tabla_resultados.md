> **MODO RÁPIDO (1 repetición, semilla 11).** Resultado de demostración: no es el resultado oficial. El oficial (5 repeticiones) está en salidas/pruebas/.

| Medida de desempeño | Fórmula | Umbral | Casos ejecutados | Resultado obtenido | ¿Cumple? | Evidencia |
|---|---|---|---|---|---|---|
| M1 Exactitud de clasificación | aciertos / reseñas evaluadas (polaridad y tema por separado) | ≥ 85% en ambas | 11 casos × 1 reentrenamiento | Control C03: polaridad 85.0% ± 0.0%, tema 90.0% ± 0.0% | Sí | m1_clasificacion.csv |
| M2 Detección de cambios en 24 h | incidentes relevantes alertados ≤ 24 h tras el cierre / incidentes relevantes | ≥ 90% | 12 escenarios × 1 semilla (12 corridas, 10 incidentes) | 50.0% (5/10) | No | escenarios.csv, corridas/*/log_ejecucion.jsonl |
| M3 Reporte semanal a tiempo | reportes entregados ≤ 24 h tras el cierre / semanas cerradas | = 100% | 12 escenarios × 1 semilla (168 semanas) | 100.0% (168/168); máx. 24 h | Sí | corridas/*/reportes/ |
| M4 Falsos positivos de alerta | alertas sin incidente relevante / alertas enviadas | < 10% | 12 escenarios × 1 semilla (6 alertas) | 0.0% (0/6) | Sí | corridas/*/bandeja_salida.jsonl |

## M1 por caso (media ± desviación estándar en 1 reentrenamiento)

| Caso | Descripción | Tipo | n | Polaridad | Tema | Rechazo | ¿Cumple? |
|---|---|---|---|---|---|---|---|
| C01 | Sintético con frases no vistas | normal | 500 | 88.4% ± 0.0% | 90.0% ± 0.0% | — | Sí |
| C02 | Manual de desarrollo (40) | normal | 40 | 90.0% ± 0.0% | 97.5% ± 0.0% | — | Sí |
| C03 | Manual de control, nunca usado al ajustar (40) | normal | 40 | 85.0% ± 0.0% | 90.0% ± 0.0% | — | Sí |
| C04 | Control en minúsculas y sin tildes | limite | 40 | 85.0% ± 0.0% | 90.0% ± 0.0% | — | Sí |
| C05 | Control con errores de tipeo | limite | 40 | 72.5% ± 0.0% | 82.5% ± 0.0% | — | No |
| C06 | Solo ironía y sarcasmo (12) | limite | 12 | 100.0% ± 0.0% | 100.0% ± 0.0% | — | Sí |
| C07 | Reseñas largas (>60 palabras) | limite | 300 | 81.7% ± 0.0% | 100.0% ± 0.0% | — | No |
| C08 | Reseñas de una sola frase | limite | 300 | 64.3% ± 0.0% | 88.7% ± 0.0% | — | No |
| C09 | Sintético con 30 % de ironía | limite | 500 | 86.4% ± 0.0% | 90.4% ± 0.0% | — | Sí |
| C10 | Otro idioma: debe descartarse | falla | 7 | — | — | 100.0% ± 0.0% | Sí |
| C11 | Entradas inválidas: vacías, emojis, HTML, sin fecha | falla | 8 | — | — | 100.0% ± 0.0% | Sí |

## Escenarios del agente (1 semilla cada uno)

| Escenario | Tipo | Detección ≤ 24 h | Detectadas tarde | Reportes a tiempo | Alertas | Falsos positivos | Latencia media alerta |
|---|---|---|---|---|---|---|---|
| E01 Operación estable | normal | — | 0 | 100.0% ± 0.0% | 0 | 0 (0.0 ± 0.0 por corrida) | — |
| E02 Incidente de limpieza | normal | 100.0% ± 0.0% | 0 | 100.0% ± 0.0% | 1 | 0 (0.0 ± 0.0 por corrida) | 12 h |
| E03 Dos incidentes | normal | 50.0% ± 0.0% | 0 | 100.0% ± 0.0% | 1 | 0 (0.0 ± 0.0 por corrida) | 12 h |
| E04 Temporada alta | limite | — | 0 | 100.0% ± 0.0% | 0 | 0 (0.0 ± 0.0 por corrida) | — |
| E05 Incidente moderado | limite | 100.0% ± 0.0% | 0 | 100.0% ± 0.0% | 1 | 0 (0.0 ± 0.0 por corrida) | 12 h |
| E06 Variación leve | limite | — | 0 | 100.0% ± 0.0% | 0 | 0 (0.0 ± 0.0 por corrida) | — |
| E07 Volumen bajo | limite | 0.0% ± 0.0% | 0 | 100.0% ± 0.0% | 0 | 0 (0.0 ± 0.0 por corrida) | — |
| E08 Ironía alta | limite | 100.0% ± 0.0% | 0 | 100.0% ± 0.0% | 1 | 0 (0.0 ± 0.0 por corrida) | 12 h |
| E09 Entradas inválidas | falla | 0.0% ± 0.0% | 0 | 100.0% ± 0.0% | 0 | 0 (0.0 ± 0.0 por corrida) | — |
| E10 TripAdvisor caído | falla | 100.0% ± 0.0% | 0 | 100.0% ± 0.0% | 1 | 0 (0.0 ± 0.0 por corrida) | 24 h |
| E11 Todas las plataformas caídas | falla | 0.0% ± 0.0% | 1 | 100.0% ± 0.0% | 1 | 0 (0.0 ± 0.0 por corrida) | — |
| E12 Arranque en frío | falla | 0.0% ± 0.0% | 0 | 100.0% ± 0.0% | 0 | 0 (0.0 ± 0.0 por corrida) | — |

Sin los escenarios de falla esperada: detección 66.7% (4/6), falsos positivos 0.0% (0/4).