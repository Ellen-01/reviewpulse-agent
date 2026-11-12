const state = { dashboard: null, scenarios: [], config: null, currentRun: null };
const topicNames = { limpieza: "Limpieza", servicio: "Servicio", ubicacion: "Ubicación", precio: "Precio" };
const sentimentNames = { positiva: "Positiva", negativa: "Negativa", neutra: "Neutra" };
const dateFormatter = new Intl.DateTimeFormat("es", { day: "2-digit", month: "short", year: "numeric" });
const percentFormatter = new Intl.NumberFormat("es", { style: "percent", maximumFractionDigits: 1 });
const numberFormatter = new Intl.NumberFormat("es");

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[char]);
}

function formatPercent(value) {
  return percentFormatter.format(Number(value) || 0);
}

function displayDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value ?? "") : dateFormatter.format(date);
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = payload.detail;
    throw new Error(typeof detail === "string" ? detail : detail?.message || `Error HTTP ${response.status}`);
  }
  return payload;
}

function showError(element, error) {
  element.textContent = error.message || String(error);
  element.classList.remove("hidden");
}

function reviewRows(reviews) {
  if (!reviews.length) return '<p class="empty">No hay reseñas que coincidan con los filtros.</p>';
  const rows = reviews.map((review) => {
    const sentiment = review.polaridad;
    const confidence = Number(review.confianza) || 0;
    const manual = review.revision_manual || confidence < state.dashboard.confidence_threshold;
    const sentimentClass = sentiment === "positiva" ? "positive" : sentiment === "negativa" ? "negative" : "";
    return `<tr>
      <td>${escapeHtml(displayDate(review.fecha))}</td>
      <td>${escapeHtml(review.plataforma)}</td>
      <td class="review-text">${escapeHtml(review.texto)}</td>
      <td><span class="chip ${sentimentClass}">${escapeHtml(sentimentNames[sentiment] || sentiment)}</span></td>
      <td>${escapeHtml(topicNames[review.tema] || review.tema)}</td>
      <td>${formatPercent(confidence)}${manual ? ' <span class="chip manual">Revisión manual</span>' : ""}</td>
    </tr>`;
  });
  return `<div class="table-wrap"><table><thead><tr><th>Fecha</th><th>Plataforma</th><th>Reseña</th>
    <th>Sentimiento</th><th>Tema</th><th>Seguridad</th></tr></thead><tbody>${rows.join("")}</tbody></table></div>`;
}

function renderAlerts(alerts, emptyText) {
  if (!alerts.length) return `<p class="empty">${escapeHtml(emptyText)}</p>`;
  return alerts.map((alert) => `<article class="alert-card">
    <strong>Alerta · ${escapeHtml(topicNames[alert.tema] || alert.tema)} · semana ${escapeHtml(alert.semana_texto || alert.semana)}</strong>
    <p>${escapeHtml(alert.mensaje)}</p>
    ${alert.ejemplos?.length ? `<p class="muted">Ejemplos: ${alert.ejemplos.map(escapeHtml).join(" · ")}</p>` : ""}
  </article>`).join("");
}

function renderChart(reviews) {
  const groups = new Map();
  for (const review of reviews) {
    const key = `${review.semana}:${review.tema}`;
    const group = groups.get(key) || { week: review.semana, topic: review.tema, total: 0, negative: 0 };
    group.total += 1;
    group.negative += review.polaridad === "negativa" ? 1 : 0;
    groups.set(key, group);
  }
  const byWeek = [...groups.values()].sort((a, b) => a.week - b.week || a.topic.localeCompare(b.topic));
  return byWeek.map((group) => {
    const rate = group.total ? group.negative / group.total : 0;
    return `<div class="chart-row"><span>Sem. ${group.week} · ${escapeHtml(topicNames[group.topic])}</span>
      <div class="bar-track"><div class="bar-fill" style="width:${Math.min(rate * 100, 100)}%"></div></div>
      <span>${formatPercent(rate)}</span></div>`;
  }).join("");
}

function renderDashboard(data) {
  state.dashboard = data;
  const result = data.results;
  const reviews = result.resenas;
  const metrics = data.metrics;
  document.getElementById("summary-kpis").innerHTML = [
    [numberFormatter.format(reviews.length), "Reseñas analizadas"],
    [numberFormatter.format(result.alertas.length), "Alertas enviadas"],
    [numberFormatter.format(metrics.revision_manual), "Para revisión manual"],
    [numberFormatter.format(result.descartadas.length), "Reseñas descartadas"],
  ].map(([value, label]) => `<div class="kpi"><strong>${escapeHtml(value)}</strong><span>${escapeHtml(label)}</span></div>`).join("");
  const sentimentCounts = Object.fromEntries(Object.keys(sentimentNames).map((sentiment) => [
    sentiment, reviews.filter((review) => review.polaridad === sentiment).length,
  ]));
  const platformCounts = Object.fromEntries(
    [...new Set(reviews.map((review) => review.plataforma))].map((platform) => [
      platform, reviews.filter((review) => review.plataforma === platform).length,
    ]),
  );
  document.getElementById("summary-breakdown").innerHTML = [
    ...Object.entries(sentimentCounts).map(([sentiment, count]) =>
      `<span class="breakdown-item"><strong>${formatPercent(count / reviews.length)}</strong> ${escapeHtml(sentimentNames[sentiment])}</span>`),
    ...Object.entries(platformCounts).map(([platform, count]) =>
      `<span class="breakdown-item"><strong>${formatPercent(count / reviews.length)}</strong> ${escapeHtml(platform)}</span>`),
  ].join("");
  document.getElementById("summary-alerts").innerHTML =
    renderAlerts(result.alertas, "No se han enviado alertas para este escenario.");
  document.getElementById("summary-chart").innerHTML = renderChart(reviews);
  document.getElementById("summary-reviews").innerHTML = reviewRows(
    [...reviews].sort((a, b) => b.fecha.localeCompare(a.fecha)).slice(0, 6),
  );
  document.getElementById("summary-loading").classList.add("hidden");
  document.getElementById("summary-content").classList.remove("hidden");
  renderReviews();
  renderWeekOptions();
}

function filteredReviews() {
  if (!state.dashboard) return [];
  const sentiment = document.getElementById("filter-sentiment").value;
  const theme = document.getElementById("filter-theme").value;
  const platform = document.getElementById("filter-platform").value;
  return state.dashboard.results.resenas
    .filter((review) => !sentiment || review.polaridad === sentiment)
    .filter((review) => !theme || review.tema === theme)
    .filter((review) => !platform || review.plataforma === platform)
    .sort((a, b) => b.fecha.localeCompare(a.fecha));
}

function renderReviews() {
  if (!state.dashboard) return;
  const reviews = filteredReviews();
  document.getElementById("review-count").textContent =
    `${numberFormatter.format(reviews.length)} de ${numberFormatter.format(state.dashboard.results.resenas.length)} reseñas`;
  document.getElementById("reviews-table").innerHTML = reviewRows(reviews);
  const discarded = state.dashboard.results.descartadas;
  document.getElementById("discarded-summary").textContent =
    `Reseñas que el agente no pudo analizar (${discarded.length})`;
  document.getElementById("discarded-list").innerHTML = discarded.length
    ? discarded.map((item) => `<span class="chip">${escapeHtml(item.motivo)}</span>`).join("")
    : '<p class="muted">No se descartaron reseñas.</p>';
  document.getElementById("reviews-loading").classList.add("hidden");
  document.getElementById("reviews-content").classList.remove("hidden");
}

function renderWeekOptions() {
  const reports = state.dashboard.reports_json;
  const select = document.getElementById("week-select");
  const weeks = Object.keys(reports).map(Number).sort((a, b) => a - b);
  select.innerHTML = weeks.map((week) => `<option value="${week}">Semana ${week}</option>`).join("");
  if (weeks.length) {
    const alerted = state.dashboard.results.alertas[0]?.semana;
    select.value = String(weeks.includes(alerted) ? alerted : weeks[weeks.length - 1]);
    renderWeek();
  }
}

function renderWeek() {
  if (!state.dashboard) return;
  const week = document.getElementById("week-select").value;
  const report = state.dashboard.reports_json[week];
  if (!report) return;
  const counts = report.conteos;
  const comparison = report.comparacion;
  const manualCount = state.dashboard.results.resenas.filter(
    (review) => review.semana === Number(week) && review.revision_manual,
  ).length;
  const rows = Object.entries(topicNames).map(([topic, title]) => {
    const count = counts[topic];
    const compare = comparison[topic] || {};
    return `<tr><td>${escapeHtml(title)}</td><td>${Object.values(count).reduce((a, b) => a + b, 0)}</td>
      <td>${count.positiva}</td><td>${count.neutra}</td><td>${count.negativa}</td>
      <td>${formatPercent(compare.proporcion)}</td><td>${formatPercent(compare.promedio)}</td>
      <td>${compare.alerta ? '<span class="chip negative">Alerta</span>' : "Normal"}</td></tr>`;
  });
  const incomplete = report.datos_incompletos ? '<p class="notice">Datos incompletos: una o más plataformas no respondieron.</p>' : "";
  document.getElementById("week-report").innerHTML = `${incomplete}
    <p>Reseñas clasificadas: ${escapeHtml(Object.values(counts).flatMap(Object.values).reduce((a, b) => a + b, 0))}
    · Para revisión manual: ${manualCount} · Generado: ${escapeHtml(report.generado_en)}</p>
    <div class="table-wrap"><table><thead><tr><th>Tema</th><th>Reseñas*</th><th>Positivas</th><th>Neutras</th>
    <th>Negativas</th><th>% negativas</th><th>Promedio histórico</th><th>Estado</th></tr></thead>
    <tbody>${rows.join("")}</tbody></table></div><p class="muted">* Conteos ponderados: una reseña con confianza baja cuenta 0,5.</p>`;
  const alerts = state.dashboard.results.alertas.filter((item) => item.semana === Number(week));
  document.getElementById("week-alerts").innerHTML = `<h2>Alertas de la semana</h2>${renderAlerts(alerts, "Sin alertas: la variación estuvo dentro de lo normal.")}`;
}

function renderProbabilityRows(probabilities, names) {
  return Object.entries(probabilities).map(([key, value]) => `<div class="probability">
    <span>${escapeHtml(names[key] || key)}</span><div class="bar-track"><div class="bar-fill" style="width:${Math.max(0, Math.min(Number(value) * 100, 100))}%"></div></div>
    <span>${formatPercent(value)}</span></div>`).join("");
}

async function analyzeReview(event) {
  event.preventDefault();
  const error = document.getElementById("analysis-error");
  const button = document.getElementById("analyze-button");
  const result = document.getElementById("analysis-result");
  error.classList.add("hidden");
  button.disabled = true;
  button.textContent = "Analizando…";
  result.textContent = "El modelo está procesando la reseña…";
  try {
    const prediction = await requestJson("/api/reviews/analyze", {
      method: "POST",
      body: JSON.stringify({ text: document.getElementById("review-text").value }),
    });
    const sentiment = prediction.polaridad;
    const manual = prediction.revision_manual
      ? "Se marcaría para revisión manual y contaría la mitad en el resumen semanal."
      : "Se sumaría al conteo de la semana.";
    result.innerHTML = `<div class="prediction ${sentiment === "negativa" ? "negative" : sentiment === "neutra" ? "neutral" : ""}">
      <p class="eyebrow">Clasificación</p><h3>${escapeHtml(sentimentNames[sentiment] || sentiment)}</h3>
      <p>Sobre <strong>${escapeHtml(topicNames[prediction.tema] || prediction.tema)}</strong></p>
      <p>Seguridad ${prediction.confianza >= .8 ? "alta" : prediction.confianza >= prediction.umbral_confianza ? "media" : "baja"}
      · ${formatPercent(prediction.confianza)}</p></div>
      <h3>Probabilidad de sentimiento</h3>${renderProbabilityRows(prediction.prob_polaridad, sentimentNames)}
      <h3>Probabilidad de tema</h3>${renderProbabilityRows(prediction.prob_tema, topicNames)}
      <p class="muted">${escapeHtml(manual)}</p>`;
  } catch (requestError) {
    showError(error, requestError);
    result.textContent = "No se pudo completar el análisis.";
  } finally {
    button.disabled = false;
    button.textContent = "Analizar reseña";
  }
}

function scenarioSettings() {
  return {
    alfa: Number(document.getElementById("setting-alfa").value),
    delta_minimo: Number(document.getElementById("setting-delta").value),
    z_minimo: Number(document.getElementById("setting-z").value),
    min_negativas: Number(document.getElementById("setting-negative").value),
    umbral_confianza: Number(document.getElementById("setting-confidence").value),
  };
}

function metricCards(metrics) {
  const values = [
    [metrics.resenas_clasificadas, "Reseñas clasificadas"],
    [metrics.resenas_descartadas, "Descartadas"],
    [`${metrics.reportes_a_tiempo}/${metrics.semanas_cerradas}`, "Reportes a tiempo"],
    [`${metrics.detectados_24h}/${metrics.incidentes_relevantes}`, "Incidentes detectados ≤ 24 h"],
    [metrics.alertas_fp, "Falsos positivos"],
  ];
  return `<div class="metric-grid">${values.map(([value, label]) =>
    `<div class="metric"><strong>${escapeHtml(value)}</strong><span>${escapeHtml(label)}</span></div>`).join("")}</div>`;
}

function renderScenarioRun(run) {
  state.currentRun = run;
  const result = document.getElementById("scenario-result");
  const phaseOptions = ["PERCEPCION", "DECISION", "ACCION", "SISTEMA"];
  const reportWeeks = Object.keys(run.reports_markdown).map(Number).sort((a, b) => a - b);
  result.innerHTML = `${metricCards(run.metrics)}
    <section><h2>Reseñas negativas por tema y semana</h2><div class="chart-grid">
      ${renderChart(run.results.resenas)}</div></section>
    <section><h2>Alertas enviadas al gerente</h2>${renderScenarioAlerts(run)}</section>
    <section><h2>Registro de ejecución · percepción → decisión → acción</h2>
      <div class="toolbar"><label>Fase<select id="event-phase"><option value="">Todas</option>
      ${phaseOptions.map((phase) => `<option value="${phase}">${phase}</option>`).join("")}</select></label>
      <button id="download-log" class="button secondary">Descargar log JSONL</button></div>
      <div id="events-table" class="event-table"></div></section>
    <section><h2>Reporte semanal</h2><label>Semana<select id="report-week">
      ${reportWeeks.map((week) => `<option value="${week}">Semana ${week}</option>`).join("")}</select></label>
      <pre id="scenario-report" class="report"></pre></section>`;
  renderEvents();
  renderScenarioReport();
  document.getElementById("event-phase").addEventListener("change", renderEvents);
  document.getElementById("report-week").addEventListener("change", renderScenarioReport);
  document.getElementById("download-log").addEventListener("click", () => downloadText(
    `log_${run.scenario}_s${run.seed}.jsonl`, run.log, "application/x-ndjson",
  ));
}

function renderScenarioAlerts(run) {
  if (!run.results.alertas.length) return '<p class="empty">Sin alertas en esta corrida.</p>';
  return run.results.alertas.map((alert) => {
    const incidents = run.truth[String(alert.semana)]?.incidentes || {};
    const label = incidents[alert.tema] === "relevante" ? "Incidente real" : "Falso positivo";
    return `<article class="alert-card"><span class="alert-label">${label}</span>
      <strong>${escapeHtml(topicNames[alert.tema] || alert.tema)} · semana ${escapeHtml(alert.semana_texto || alert.semana)}</strong>
      <p>${escapeHtml(alert.mensaje)}</p></article>`;
  }).join("");
}

function renderEvents() {
  if (!state.currentRun) return;
  const phase = document.getElementById("event-phase").value;
  const events = state.currentRun.events.filter((item) => !phase || item.fase === phase);
  document.getElementById("events-table").innerHTML = events.length
    ? `<div class="table-wrap"><table><thead><tr><th>Tiempo simulado</th><th>Fase</th><th>Evento</th>
      <th>Detalle</th></tr></thead><tbody>${events.map((item) => {
        const detail = ["semana", "motivo", "acciones", "nuevas", "disponibilidad"]
          .filter((key) => item[key] !== undefined)
          .map((key) => `${key}: ${JSON.stringify(item[key])}`).join(" · ");
        return `<tr><td>${escapeHtml(item.ts_simulado)}</td><td>${escapeHtml(item.fase)}</td>
          <td>${escapeHtml(item.evento)}</td><td>${escapeHtml(detail)}</td></tr>`;
      }).join("")}</tbody></table></div>`
    : '<p class="empty">No hay eventos para esta fase.</p>';
}

function renderScenarioReport() {
  if (!state.currentRun) return;
  const week = document.getElementById("report-week").value;
  document.getElementById("scenario-report").textContent = state.currentRun.reports_markdown[week] || "";
}

function downloadText(filename, content, type) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function downloadCsv() {
  const columns = ["id", "fecha", "plataforma", "texto", "polaridad", "tema", "confianza", "revision_manual"];
  const rows = [columns, ...filteredReviews().map((review) => columns.map((column) => review[column] ?? ""))];
  const csv = rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\r\n");
  downloadText("resenas_hotel_piloto.csv", `\ufeff${csv}`, "text/csv;charset=utf-8");
}

async function runScenario(event) {
  event.preventDefault();
  const error = document.getElementById("scenario-error");
  const loading = document.getElementById("scenario-loading");
  const button = document.getElementById("run-scenario");
  error.classList.add("hidden");
  document.getElementById("scenario-result").innerHTML = "";
  loading.classList.remove("hidden");
  button.disabled = true;
  try {
    const run = await requestJson("/api/scenarios/run", {
      method: "POST",
      body: JSON.stringify({
        scenario: document.getElementById("scenario-select").value,
        seed: Number(document.getElementById("scenario-seed").value),
        settings: scenarioSettings(),
      }),
    });
    renderScenarioRun(run);
  } catch (requestError) {
    showError(error, requestError);
  } finally {
    loading.classList.add("hidden");
    button.disabled = false;
  }
}

async function loadEvaluations() {
  const target = document.getElementById("evaluation-result");
  try {
    const evaluation = await requestJson("/api/evaluations");
    target.textContent = evaluation.table_markdown;
  } catch (error) {
    target.textContent = `No fue posible consultar las evaluaciones: ${error.message}`;
  }
}

async function initialize() {
  document.getElementById("filter-sentiment").value = "";
  document.getElementById("filter-theme").value = "";
  document.getElementById("filter-platform").value = "";
  for (const button of document.querySelectorAll(".nav-button")) {
    button.addEventListener("click", () => {
      document.querySelectorAll(".nav-button").forEach((item) => item.classList.remove("active"));
      document.querySelectorAll(".view").forEach((item) => item.classList.remove("active"));
      button.classList.add("active");
      document.getElementById(`view-${button.dataset.view}`).classList.add("active");
    });
  }
  ["filter-sentiment", "filter-theme", "filter-platform"].forEach((id) =>
    document.getElementById(id).addEventListener("change", renderReviews));
  document.getElementById("download-reviews").addEventListener("click", downloadCsv);
  document.getElementById("week-select").addEventListener("change", renderWeek);
  document.getElementById("review-form").addEventListener("submit", analyzeReview);
  document.getElementById("scenario-form").addEventListener("submit", runScenario);
  await loadEvaluations();
  try {
    const [health, config, scenarios, dashboard] = await Promise.all([
      requestJson("/health"), requestJson("/api/config"), requestJson("/api/scenarios"), requestJson("/api/dashboard"),
    ]);
    document.getElementById("health-dot").classList.add("ok");
    document.getElementById("health-text").textContent = `Agente disponible · ${health.model_version}`;
    state.config = config;
    state.scenarios = scenarios;
    document.getElementById("scenario-select").innerHTML = scenarios.map((scenario) =>
      `<option value="${escapeHtml(scenario.id)}">${escapeHtml(scenario.id)} · ${escapeHtml(scenario.name)}</option>`
    ).join("");
    document.getElementById("scenario-select").addEventListener("change", () => {
      const selected = scenarios.find((item) => item.id === document.getElementById("scenario-select").value);
      document.getElementById("scenario-description").textContent =
        `${selected.type.charAt(0).toUpperCase()}${selected.type.slice(1)} · ${selected.description}`;
    });
    document.getElementById("scenario-select").dispatchEvent(new Event("change"));
    document.getElementById("setting-alfa").value = config.alfa;
    document.getElementById("setting-delta").value = config.delta_minimo;
    document.getElementById("setting-z").value = config.z_minimo;
    document.getElementById("setting-negative").value = config.min_negativas;
    document.getElementById("setting-confidence").value = config.umbral_confianza;
    renderDashboard(dashboard);
  } catch (error) {
    document.getElementById("health-dot").classList.add("bad");
    document.getElementById("health-text").textContent = "Agente no disponible";
    showError(document.getElementById("summary-error"), error);
    document.getElementById("summary-loading").classList.add("hidden");
    document.getElementById("reviews-loading").textContent = "No se pudo cargar el historial.";
  }
}

initialize();
