const STORAGE_KEY = "fondos-management-state-v2";

const seedState = {
  settings: {
    arsUsd: 1000,
  },
  kpis: {
    retirementSalary: {
      fundId: "fund-general",
      annualPercent: 3.5,
    },
    indicators: [
      {
        id: "indicator-general",
        name: "Meta ejemplo",
        fundId: "fund-general",
        maxAmount: 2500,
      },
    ],
  },
  platforms: [
    { id: "plat-demo", name: "Cuenta ejemplo", description: "Plataforma inicial de muestra", color: "#0f766e" },
  ],
  instrumentTypes: [
    { id: "type-liquid", name: "LIQUID", description: "Efectivo y liquidez", currency: "DOLARES", quote: 1, color: "#2563eb" },
  ],
  instruments: [
    { id: "inst-usd-demo", name: "USD ejemplo", description: "Saldo inicial de muestra", currency: "DOLARES", quote: 1, color: "#7c3aed" },
  ],
  funds: [
    { id: "fund-general", name: "General", description: "Fondo inicial de ejemplo", color: "#0f766e" },
  ],
  holdings: [
    makeHolding("inst-usd-demo", "plat-demo", "type-liquid", 1000, [["fund-general", 100]], 250),
  ],
};

let state = loadState();
let charts = [];

const formatUsd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

const formatNumber = new Intl.NumberFormat("es-AR", {
  maximumFractionDigits: 6,
});

const colors = ["#0f766e", "#c58b1a", "#2f5fb3", "#b83b5e", "#6f42c1", "#0d9488", "#d97706", "#475569", "#16a34a", "#be123c", "#2563eb", "#7c3aed"];
const presetEntityColors = ["#0f766e", "#2563eb", "#7c3aed", "#db2777", "#dc2626", "#ea580c", "#d6a51f", "#16a34a", "#0891b2", "#475569"];

document.addEventListener("DOMContentLoaded", () => {
  bindNavigation();
  bindSettings();
  bindEntityCrud();
  bindHoldingCrud();
  bindKpis();
  bindDataPortability();
  bindReset();
  render();
});

function makeHolding(instrumentId, platformId, typeId, quantity, allocations, pendingReceivableUsd = 0) {
  return {
    id: crypto.randomUUID(),
    instrumentId,
    platformId,
    typeId,
    quantity,
    pendingReceivableUsd,
    description: "",
    allocations: allocations.map(([fundId, percent]) => ({ fundId, percent })),
  };
}

function loadState() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) {
    const initialState = normalizeState(structuredClone(seedState));
    persistState(initialState);
    return initialState;
  }

  try {
    const parsed = JSON.parse(stored);
    const normalized = normalizeState({
      ...structuredClone(seedState),
      ...parsed,
      settings: { ...seedState.settings, ...(parsed.settings ?? {}) },
    });
    persistState(normalized);
    return normalized;
  } catch {
    const initialState = normalizeState(structuredClone(seedState));
    persistState(initialState);
    return initialState;
  }
}

function normalizeState(nextState) {
  nextState.settings = { ...seedState.settings, ...(nextState.settings ?? {}) };
  nextState.kpis = {
    retirementSalary: {
      ...seedState.kpis.retirementSalary,
      ...(nextState.kpis?.retirementSalary ?? {}),
    },
    indicators: (nextState.kpis?.indicators ?? []).map((indicator) => ({
      id: indicator.id ?? crypto.randomUUID(),
      name: indicator.name ?? "",
      fundId: indicator.fundId ?? nextState.funds?.[0]?.id ?? "",
      maxAmount: toNumber(indicator.maxAmount, 0),
    })),
  };
  nextState.platforms = nextState.platforms ?? [];
  nextState.platforms = nextState.platforms.map(normalizeColoredEntity);
  nextState.instrumentTypes = (nextState.instrumentTypes ?? []).map(normalizeColoredEntity);
  nextState.instruments = (nextState.instruments ?? []).map((instrument) => ({
    ...normalizeInstrument(instrument),
  }));
  nextState.funds = (nextState.funds ?? []).map(normalizeColoredEntity);
  nextState.holdings = (nextState.holdings ?? []).map((holding) => ({
    ...holding,
    pendingReceivableUsd: toNumber(holding.pendingReceivableUsd, 0),
    description: holding.description ?? "",
    allocations: holding.allocations ?? [],
  }));
  return nextState;
}

function normalizeInstrument(instrument) {
  const seedInstrument = seedState.instruments.find((item) => item.id === instrument.id);
  const platformQuotes = instrument.platformQuotes ?? seedInstrument?.platformQuotes ?? {};
  return {
    ...instrument,
    currency: instrument.currency ?? seedInstrument?.currency ?? "DOLARES",
    quote: toNumber(instrument.quote ?? seedInstrument?.quote, 1),
    usesPlatformQuotes: Boolean(instrument.usesPlatformQuotes ?? seedInstrument?.usesPlatformQuotes),
    platformQuotes,
    color: normalizeColor(instrument.color),
  };
}

function normalizeColoredEntity(entity) {
  return {
    ...entity,
    color: normalizeColor(entity.color),
  };
}

function normalizeColor(color) {
  return /^#[0-9a-fA-F]{6}$/.test(color ?? "") ? color : "";
}

function saveState() {
  state = normalizeState(state);
  persistState(state);
}

function persistState(nextState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState));
}

function bindNavigation() {
  document.querySelectorAll(".nav-item").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll(".nav-item").forEach((item) => item.classList.remove("active"));
      document.querySelectorAll(".section").forEach((section) => section.classList.remove("active"));
      button.classList.add("active");
      document.getElementById(`${button.dataset.section}Section`).classList.add("active");
    });
  });
}

function bindSettings() {
  const input = document.getElementById("arsUsdInput");
  input.addEventListener("change", () => {
    state.settings.arsUsd = toNumber(input.value, seedState.settings.arsUsd);
    saveState();
    render();
  });
}

function bindDataPortability() {
  const importInput = document.getElementById("importDataInput");
  document.getElementById("exportDataButton").addEventListener("click", exportData);
  document.getElementById("importDataButton").addEventListener("click", () => importInput.click());
  importInput.addEventListener("change", importData);
}

function bindReset() {
  document.getElementById("resetDataButton").addEventListener("click", () => {
    const confirmed = confirm("¿Restaurar los datos de ejemplo? Esto reemplaza los cambios guardados localmente.");
    if (!confirmed) return;
    state = normalizeState(structuredClone(seedState));
    saveState();
    render();
  });
}

function exportData() {
  saveState();
  const payload = {
    app: "Fondos Management",
    version: 4,
    exportedAt: new Date().toISOString(),
    data: state,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `fondos-management-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

async function importData(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  try {
    const payload = JSON.parse(await file.text());
    const importedState = extractImportedState(payload);
    validateImportedState(importedState);
    const confirmed = confirm("¿Importar este archivo? Esto reemplaza todos los datos guardados en este navegador.");
    if (!confirmed) return;

    state = normalizeState(importedState);
    saveState();
    render();
    alert("Información importada correctamente.");
  } catch (error) {
    alert(`No se pudo importar el archivo. ${error.message}`);
  } finally {
    event.target.value = "";
  }
}

function extractImportedState(payload) {
  return payload?.data ?? payload?.state ?? payload;
}

function validateImportedState(importedState) {
  if (!importedState || typeof importedState !== "object" || Array.isArray(importedState)) {
    throw new Error("El archivo no tiene un estado válido.");
  }

  ["platforms", "instrumentTypes", "instruments", "funds", "holdings"].forEach((key) => {
    if (importedState[key] !== undefined && !Array.isArray(importedState[key])) {
      throw new Error(`La sección ${key} debe ser una lista.`);
    }
  });

  if (importedState.kpis?.indicators !== undefined && !Array.isArray(importedState.kpis.indicators)) {
    throw new Error("La sección kpis.indicators debe ser una lista.");
  }
}

function bindEntityCrud() {
  document.querySelectorAll(".add-entity").forEach((button) => {
    button.addEventListener("click", () => openEntityDialog(button.closest(".master-panel").dataset.entity));
  });

  renderPresetColorButtons();
  document.getElementById("entityUsesPlatformQuotesInput").addEventListener("change", () => renderPlatformQuotesEditor());
  document.getElementById("clearEntityColorButton").addEventListener("click", () => {
    document.getElementById("entityColorInput").value = "#000000";
    document.getElementById("entityColorInput").dataset.empty = "true";
    updatePresetColorSelection();
  });
  document.getElementById("entityColorInput").addEventListener("input", (event) => {
    event.currentTarget.dataset.empty = "false";
    updatePresetColorSelection();
  });

  document.getElementById("entityForm").addEventListener("submit", (event) => {
    if (event.submitter?.value === "cancel") return;
    event.preventDefault();
    saveEntity();
  });
}

function renderPresetColorButtons() {
  const container = document.getElementById("entityPresetColors");
  container.innerHTML = presetEntityColors
    .map((color) => `<button class="preset-color-button" type="button" data-color="${color}" style="background:${color}" title="${color}"></button>`)
    .join("");

  container.querySelectorAll(".preset-color-button").forEach((button) => {
    button.addEventListener("click", () => {
      document.getElementById("entityColorInput").value = button.dataset.color;
      document.getElementById("entityColorInput").dataset.empty = "false";
      updatePresetColorSelection();
    });
  });
}

function updatePresetColorSelection() {
  const input = document.getElementById("entityColorInput");
  const selectedColor = input.dataset.empty === "true" ? "" : input.value.toLowerCase();
  document.querySelectorAll(".preset-color-button").forEach((button) => {
    button.classList.toggle("active", button.dataset.color.toLowerCase() === selectedColor);
  });
}

function bindHoldingCrud() {
  document.getElementById("newHoldingButton").addEventListener("click", () => openHoldingDialog());
  document.getElementById("holdingInstrumentInput").addEventListener("change", renderQuotePreview);
  document.getElementById("holdingPlatformInput").addEventListener("change", renderQuotePreview);
  document.getElementById("holdingTypeInput").addEventListener("change", renderQuotePreview);
  document.getElementById("holdingQuantityInput").addEventListener("input", renderQuotePreview);
  document.getElementById("holdingPendingInput").addEventListener("input", renderQuotePreview);
  document.getElementById("addAllocationButton").addEventListener("click", () => addAllocationRow());
  document.getElementById("holdingForm").addEventListener("submit", (event) => {
    if (event.submitter?.value === "cancel") return;
    event.preventDefault();
    saveHolding();
  });
}

function bindKpis() {
  document.getElementById("retirementFundInput").addEventListener("change", saveRetirementSettings);
  document.getElementById("retirementPercentInput").addEventListener("change", saveRetirementSettings);
  document.getElementById("newIndicatorButton").addEventListener("click", () => openIndicatorDialog());
  document.getElementById("indicatorForm").addEventListener("submit", (event) => {
    if (event.submitter?.value === "cancel") return;
    event.preventDefault();
    saveIndicator();
  });
}

function render() {
  document.getElementById("arsUsdInput").value = state.settings.arsUsd;
  renderKpis();
  renderHoldings();
  renderMasterLists();
  renderCharts();
  renderKpiSection();
  refreshIcons();
}

function renderKpis() {
  const currentTotal = state.holdings.reduce((sum, holding) => sum + getHoldingUsdValue(holding), 0);
  const pendingTotal = state.holdings.reduce((sum, holding) => sum + getHoldingPendingUsdValue(holding), 0);
  const total = currentTotal + pendingTotal;
  document.getElementById("globalTotal").textContent = formatUsd.format(total);
  document.getElementById("globalTotalMeta").textContent = pendingTotal > 0
    ? `${formatUsd.format(currentTotal)} efectivo + ${formatUsd.format(pendingTotal)} por cobrar`
    : "Calculada en USD";
  document.getElementById("instrumentCount").textContent = state.instruments.length;
  document.getElementById("holdingCount").textContent = state.holdings.length;
}

function renderHoldings() {
  const tbody = document.getElementById("holdingsTable");
  if (!state.holdings.length) {
    tbody.innerHTML = `<tr><td colspan="9"><div class="empty-state">Todavía no hay tenencias cargadas.</div></td></tr>`;
    return;
  }

  tbody.innerHTML = state.holdings
    .map((holding) => {
      const instrument = findById("instruments", holding.instrumentId);
      const platform = findById("platforms", holding.platformId);
      const type = findById("instrumentTypes", holding.typeId);
      const pricing = getPricing(instrument, type, holding.platformId);
      const chips = getAllocationChips(holding);
      const currentValue = getHoldingUsdValue(holding);
      const pendingValue = getHoldingPendingUsdValue(holding);
      const totalValue = currentValue + pendingValue;
      return `
        <tr>
          <td><strong>${escapeHtml(instrument?.name ?? "Sin instrumento")}</strong>${holding.description ? `<div class="muted">${escapeHtml(holding.description)}</div>` : ""}</td>
          <td>${escapeHtml(platform?.name ?? "Sin plataforma")}</td>
          <td>${escapeHtml(type?.name ?? "Sin tipo")}<div class="muted">${escapeHtml(pricing.currency)}</div></td>
          <td>${formatNumber.format(holding.quantity)}</td>
          <td><div class="chip-row">${chips}</div></td>
          <td class="amount">${formatUsd.format(currentValue)}</td>
          <td class="pending-amount">${pendingValue > 0 ? formatUsd.format(pendingValue) : "-"}</td>
          <td class="amount">${formatUsd.format(totalValue)}</td>
          <td>
            <div class="actions">
              <button class="icon-button" type="button" title="Editar" onclick="openHoldingDialog('${holding.id}')"><i data-lucide="pencil"></i></button>
              <button class="icon-button danger-button" type="button" title="Eliminar" onclick="deleteHolding('${holding.id}')"><i data-lucide="trash-2"></i></button>
            </div>
          </td>
        </tr>
      `;
    })
    .join("");
}

function renderMasterLists() {
  renderEntityList("platforms", "platformsList");
  renderEntityList("instrumentTypes", "instrumentTypesList");
  renderEntityList("instruments", "instrumentsList");
  renderEntityList("funds", "fundsList");
}

function renderEntityList(kind, elementId) {
  const element = document.getElementById(elementId);
  if (!state[kind].length) {
    element.innerHTML = `<div class="empty-state">Sin registros.</div>`;
    return;
  }

  element.innerHTML = state[kind]
    .map((item) => {
      const quoteMeta =
        kind === "instrumentTypes"
          ? `<div class="entity-meta">${item.currency ?? "DOLARES"} · Cotización ${formatNumber.format(item.quote ?? 0)}</div>`
          : kind === "instruments" && item.quote !== undefined
            ? `<div class="entity-meta">${item.currency ?? "DOLARES"} · ${item.usesPlatformQuotes ? "Cotización por plataforma" : `Cotización ${formatNumber.format(item.quote ?? 0)}`}</div>`
          : "";
      return `
        <div class="entity-item">
          <div>
            <div class="entity-title-row">
              <span class="color-swatch" style="background:${escapeHtml(item.color || "#dfe5df")}"></span>
              <strong>${escapeHtml(item.name)}</strong>
            </div>
            <div class="entity-meta">${escapeHtml(item.description || "Sin descripción")}</div>
            ${quoteMeta}
          </div>
          <div class="actions">
            <button class="icon-button" type="button" title="Editar" onclick="openEntityDialog('${kind}', '${item.id}')"><i data-lucide="pencil"></i></button>
            <button class="icon-button danger-button" type="button" title="Eliminar" onclick="deleteEntity('${kind}', '${item.id}')"><i data-lucide="trash-2"></i></button>
          </div>
        </div>
      `;
    })
    .join("");
}

function renderCharts() {
  charts.forEach((chart) => chart.destroy());
  charts = [];

  const chartGrid = document.getElementById("chartGrid");
  const specs = [
    { id: "fund", title: "Por Fondo", series: aggregateByFund() },
    { id: "instrument", title: "Por Instrumento", series: aggregateBy("instruments", "instrumentId") },
    { id: "platform", title: "Por Plataforma", series: aggregateBy("platforms", "platformId") },
    { id: "type", title: "Por Tipo de Instrumento", series: aggregateBy("instrumentTypes", "typeId") },
  ];

  chartGrid.innerHTML = specs
    .map(
      (spec) => `
        <section class="chart-section">
          <h3>${spec.title}</h3>
          <div class="chart-pair">
            <div class="chart-panel"><canvas id="${spec.id}Pie"></canvas></div>
            <div class="chart-panel"><canvas id="${spec.id}Bar"></canvas></div>
          </div>
        </section>
      `,
    )
    .join("");

  specs.forEach((spec) => {
    createPieChart(`${spec.id}Pie`, spec.series, spec.title);
    createBarChart(`${spec.id}Bar`, spec.series, spec.title);
  });
}

function renderKpiSection() {
  renderKpiFundSelects();
  renderRetirementSalary();
  renderIndicatorGrid();
}

function renderKpiFundSelects() {
  fillSelect("retirementFundInput", state.funds, state.kpis.retirementSalary.fundId);
  fillSelect("indicatorFundInput", state.funds, document.getElementById("indicatorFundInput").value || state.funds[0]?.id);
  document.getElementById("retirementPercentInput").value = state.kpis.retirementSalary.annualPercent;
}

function renderRetirementSalary() {
  const settings = state.kpis.retirementSalary;
  const fund = findById("funds", settings.fundId);
  const fundTotals = getFundTotals(settings.fundId);
  const fundValue = fundTotals.current;
  const estimatedFundValue = fundTotals.value;
  const monthlySalary = (fundValue * (toNumber(settings.annualPercent, 0) / 100)) / 12;
  const estimatedMonthlySalary = (estimatedFundValue * (toNumber(settings.annualPercent, 0) / 100)) / 12;
  document.getElementById("retirementSalaryValue").textContent = formatUsd.format(monthlySalary);
  document.getElementById("retirementSalaryMeta").textContent = fundTotals.pending > 0
    ? `${escapeHtml(fund?.name ?? "Fondo")} · ${formatUsd.format(fundValue)} efectivo · ${formatUsd.format(estimatedMonthlySalary)} al cobrar · ${formatNumber.format(settings.annualPercent)}% anual`
    : `${escapeHtml(fund?.name ?? "Fondo")} · ${formatUsd.format(fundValue)} · ${formatNumber.format(settings.annualPercent)}% anual`;
}

function renderIndicatorGrid() {
  const grid = document.getElementById("indicatorGrid");
  if (!state.kpis.indicators.length) {
    grid.innerHTML = `<div class="empty-state">Todavía no hay indicadores configurados.</div>`;
    return;
  }

  grid.innerHTML = state.kpis.indicators
    .map((indicator, index) => {
      const fund = findById("funds", indicator.fundId);
      const fundTotals = getFundTotals(indicator.fundId);
      const value = fundTotals.current;
      const estimatedValue = fundTotals.value;
      const percent = indicator.maxAmount > 0 ? Math.min((value / indicator.maxAmount) * 100, 999) : 0;
      const estimatedPercent = indicator.maxAmount > 0 ? Math.min((estimatedValue / indicator.maxAmount) * 100, 999) : 0;
      const formattedPercent = formatPercentOneDecimal(percent);
      const statusColor = getGaugeColor(Math.min(percent / 100, 1));
      const previousDisabled = index === 0 ? "disabled" : "";
      const nextDisabled = index === state.kpis.indicators.length - 1 ? "disabled" : "";
      return `
        <article class="gauge-card">
          <div class="gauge-card-header">
            <div>
              <h3>${escapeHtml(indicator.name)}</h3>
              <div class="gauge-meta">
                <span>${escapeHtml(fund?.name ?? "Sin fondo")}</span>
                <span>${formatUsd.format(value)} / ${formatUsd.format(indicator.maxAmount)}</span>
                ${fundTotals.pending > 0 ? `<span>${formatUsd.format(estimatedValue)} al cobrar · ${formatPercentOneDecimal(estimatedPercent)}</span>` : ""}
              </div>
              <span class="gauge-status" style="background:${statusColor}">${formattedPercent}</span>
            </div>
            <div class="actions">
              <button class="icon-button" type="button" title="Mover a la izquierda" ${previousDisabled} onclick="moveIndicator('${indicator.id}', -1)"><i data-lucide="arrow-left"></i></button>
              <button class="icon-button" type="button" title="Mover a la derecha" ${nextDisabled} onclick="moveIndicator('${indicator.id}', 1)"><i data-lucide="arrow-right"></i></button>
              <button class="icon-button" type="button" title="Editar" onclick="openIndicatorDialog('${indicator.id}')"><i data-lucide="pencil"></i></button>
              <button class="icon-button danger-button" type="button" title="Eliminar" onclick="deleteIndicator('${indicator.id}')"><i data-lucide="trash-2"></i></button>
            </div>
          </div>
          <canvas id="indicatorGauge-${indicator.id}" width="520" height="320" aria-label="${escapeHtml(indicator.name)} ${percent.toFixed(1)}%"></canvas>
        </article>
      `;
    })
    .join("");

  state.kpis.indicators.forEach((indicator) => {
    const fundTotals = getFundTotals(indicator.fundId);
    drawGauge(`indicatorGauge-${indicator.id}`, fundTotals.current, indicator.maxAmount, fundTotals.value);
  });
}

function openIndicatorDialog(id = "") {
  const indicator = id ? state.kpis.indicators.find((item) => item.id === id) : null;
  document.getElementById("indicatorDialogTitle").textContent = indicator ? "Editar indicador" : "Nuevo indicador";
  document.getElementById("indicatorIdInput").value = indicator?.id ?? "";
  document.getElementById("indicatorNameInput").value = indicator?.name ?? "";
  fillSelect("indicatorFundInput", state.funds, indicator?.fundId ?? state.funds[0]?.id);
  document.getElementById("indicatorMaxInput").value = indicator?.maxAmount ?? "";
  document.getElementById("indicatorDialog").showModal();
}

function saveRetirementSettings() {
  state.kpis.retirementSalary = {
    fundId: document.getElementById("retirementFundInput").value,
    annualPercent: toNumber(document.getElementById("retirementPercentInput").value, 0),
  };
  saveState();
  renderKpiSection();
}

function saveIndicator() {
  const id = document.getElementById("indicatorIdInput").value;
  const payload = {
    id: id || crypto.randomUUID(),
    name: document.getElementById("indicatorNameInput").value.trim(),
    fundId: document.getElementById("indicatorFundInput").value,
    maxAmount: toNumber(document.getElementById("indicatorMaxInput").value, 0),
  };

  if (!payload.name || !payload.fundId || payload.maxAmount <= 0) return;

  if (id) {
    state.kpis.indicators = state.kpis.indicators.map((indicator) => (indicator.id === id ? payload : indicator));
  } else {
    state.kpis.indicators.push(payload);
  }

  resetIndicatorForm();
  saveState();
  document.getElementById("indicatorDialog").close();
  renderKpiSection();
  refreshIcons();
}

function moveIndicator(id, direction) {
  const currentIndex = state.kpis.indicators.findIndex((indicator) => indicator.id === id);
  const nextIndex = currentIndex + direction;
  if (currentIndex < 0 || nextIndex < 0 || nextIndex >= state.kpis.indicators.length) return;
  const indicators = [...state.kpis.indicators];
  const [indicator] = indicators.splice(currentIndex, 1);
  indicators.splice(nextIndex, 0, indicator);
  state.kpis.indicators = indicators;
  saveState();
  renderKpiSection();
  refreshIcons();
}

function deleteIndicator(id) {
  const confirmed = confirm("¿Eliminar este indicador?");
  if (!confirmed) return;
  state.kpis.indicators = state.kpis.indicators.filter((indicator) => indicator.id !== id);
  saveState();
  renderKpiSection();
  refreshIcons();
}

function resetIndicatorForm() {
  document.getElementById("indicatorIdInput").value = "";
  document.getElementById("indicatorNameInput").value = "";
  document.getElementById("indicatorFundInput").value = state.funds[0]?.id ?? "";
  document.getElementById("indicatorMaxInput").value = "";
}

function drawGauge(canvasId, value, maxAmount, estimatedValue = value) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const width = canvas.width;
  const height = canvas.height;
  const centerX = width / 2;
  const centerY = height * 0.77;
  const radius = Math.min(width * 0.36, height * 0.58);
  const start = Math.PI;
  const end = Math.PI * 2;
  const percent = maxAmount > 0 ? value / maxAmount : 0;
  const clamped = Math.max(0, Math.min(percent, 1));
  const estimatedPercent = maxAmount > 0 ? estimatedValue / maxAmount : percent;
  const estimatedClamped = Math.max(0, Math.min(estimatedPercent, 1));
  const progressEnd = start + (end - start) * clamped;
  const estimatedEnd = start + (end - start) * estimatedClamped;
  const gaugeColor = getGaugeColor(clamped);

  ctx.clearRect(0, 0, width, height);
  ctx.lineWidth = 28;
  ctx.lineCap = "round";

  ctx.beginPath();
  ctx.strokeStyle = "#e8eee9";
  ctx.arc(centerX, centerY, radius, start, end);
  ctx.stroke();

  if (clamped > 0) {
    const segments = Math.max(4, Math.ceil(96 * clamped));
    for (let index = 0; index < segments; index += 1) {
      const t1 = (index / segments) * clamped;
      const t2 = ((index + 1) / segments) * clamped;
      ctx.beginPath();
      ctx.strokeStyle = getGaugeColor(t1);
      ctx.arc(centerX, centerY, radius, start + (end - start) * t1, start + (end - start) * t2);
      ctx.stroke();
    }
  }

  ctx.beginPath();
  ctx.lineWidth = 8;
  ctx.strokeStyle = "#f2f6f3";
  ctx.arc(centerX, centerY, radius - 40, start, end);
  ctx.stroke();

  const needleLength = radius - 30;
  const needleBase = 11;
  const leftAngle = progressEnd + Math.PI / 2;
  const rightAngle = progressEnd - Math.PI / 2;
  ctx.beginPath();
  ctx.fillStyle = "#17201d";
  ctx.moveTo(centerX, centerY);
  ctx.lineTo(centerX + Math.cos(leftAngle) * needleBase, centerY + Math.sin(leftAngle) * needleBase);
  ctx.lineTo(centerX + Math.cos(progressEnd) * needleLength, centerY + Math.sin(progressEnd) * needleLength);
  ctx.lineTo(centerX + Math.cos(rightAngle) * needleBase, centerY + Math.sin(rightAngle) * needleBase);
  ctx.closePath();
  ctx.fill();

  if (estimatedValue > value && Math.abs(estimatedClamped - clamped) > 0.001) {
    const estimatedNeedleLength = radius - 24;
    ctx.save();
    ctx.beginPath();
    ctx.lineWidth = 6;
    ctx.lineCap = "round";
    ctx.setLineDash([10, 8]);
    ctx.strokeStyle = "rgba(23, 32, 29, 0.62)";
    ctx.moveTo(centerX, centerY);
    ctx.lineTo(centerX + Math.cos(estimatedEnd) * estimatedNeedleLength, centerY + Math.sin(estimatedEnd) * estimatedNeedleLength);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.fillStyle = "rgba(23, 32, 29, 0.62)";
    ctx.arc(centerX + Math.cos(estimatedEnd) * estimatedNeedleLength, centerY + Math.sin(estimatedEnd) * estimatedNeedleLength, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  ctx.beginPath();
  ctx.fillStyle = "#17201d";
  ctx.arc(centerX, centerY, 12, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.fillStyle = gaugeColor;
  ctx.arc(centerX, centerY, 6, 0, Math.PI * 2);
  ctx.fill();

  const percentLabel = formatPercentOneDecimal(percent * 100);
  const labelX = centerX;
  const labelY = centerY - radius * 0.55;
  ctx.font = "800 44px Inter, Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const labelMetrics = ctx.measureText(percentLabel);
  const labelWidth = labelMetrics.width + 28;
  const labelHeight = 54;
  drawRoundRect(ctx, labelX - labelWidth / 2, labelY - labelHeight / 2, labelWidth, labelHeight, 14);
  ctx.fillStyle = "rgba(255, 255, 255, 0.92)";
  ctx.fill();
  ctx.fillStyle = "#161a1d";
  ctx.fillText(percentLabel, labelX, labelY + 1);

  ctx.fillStyle = "#65706b";
  ctx.font = "700 16px Inter, Arial, sans-serif";
  ctx.textBaseline = "alphabetic";
  ctx.fillText("0", centerX - radius + 6, centerY + 30);
  ctx.fillText("100", centerX + radius - 8, centerY + 30);
}

function getGaugeColor(amount) {
  const clamped = Math.max(0, Math.min(amount, 1));
  if (clamped < 0.5) {
    return interpolateColor("#c43b3b", "#d6a51f", clamped / 0.5);
  }
  return interpolateColor("#d6a51f", "#16a34a", (clamped - 0.5) / 0.5);
}

function formatPercentOneDecimal(percent) {
  return `${percent.toFixed(1)}%`;
}

function drawRoundRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function interpolateColor(startColor, endColor, amount) {
  const startRgb = hexToRgb(startColor);
  const endRgb = hexToRgb(endColor);
  const clamped = Math.max(0, Math.min(amount, 1));
  const mixed = startRgb.map((channel, index) => Math.round(channel + (endRgb[index] - channel) * clamped));
  return `rgb(${mixed[0]}, ${mixed[1]}, ${mixed[2]})`;
}

function hexToRgb(hex) {
  const value = hex.replace("#", "");
  return [0, 2, 4].map((index) => parseInt(value.slice(index, index + 2), 16));
}

function openEntityDialog(kind, id = "") {
  const item = id ? findById(kind, id) : null;
  const labels = {
    platforms: "Plataforma",
    instrumentTypes: "Tipo de instrumento",
    instruments: "Instrumento",
    funds: "Fondo",
  };

  const form = document.getElementById("entityForm");
  form.classList.toggle("show-quote-fields", kind === "instrumentTypes" || kind === "instruments");
  form.classList.toggle("show-instrument-fields", kind === "instruments");
  document.getElementById("entityDialogEyebrow").textContent = labels[kind];
  document.getElementById("entityDialogTitle").textContent = item ? `Editar ${labels[kind].toLowerCase()}` : `Nuevo ${labels[kind].toLowerCase()}`;
  document.getElementById("entityKindInput").value = kind;
  document.getElementById("entityIdInput").value = id;
  document.getElementById("entityNameInput").value = item?.name ?? "";
  document.getElementById("entityDescriptionInput").value = item?.description ?? "";
  document.getElementById("entityColorInput").value = item?.color || "#000000";
  document.getElementById("entityColorInput").dataset.empty = item?.color ? "false" : "true";
  updatePresetColorSelection();
  document.getElementById("entityCurrencyInput").value = item?.currency ?? "DOLARES";
  document.getElementById("entityQuoteInput").value = item?.quote ?? 1;
  document.getElementById("entityUsesPlatformQuotesInput").checked = Boolean(item?.usesPlatformQuotes);
  renderPlatformQuotesEditor(item?.platformQuotes ?? {});
  document.getElementById("entityDialog").showModal();
}

function saveEntity() {
  const kind = document.getElementById("entityKindInput").value;
  const id = document.getElementById("entityIdInput").value;
  const name = document.getElementById("entityNameInput").value.trim();
  if (!name) return;

  const payload = {
    id: id || crypto.randomUUID(),
    name,
    description: document.getElementById("entityDescriptionInput").value.trim(),
    color:
      document.getElementById("entityColorInput").dataset.empty === "true"
        ? ""
        : normalizeColor(document.getElementById("entityColorInput").value),
  };

  if (kind === "instrumentTypes" || kind === "instruments") {
    payload.currency = document.getElementById("entityCurrencyInput").value;
    payload.quote = toNumber(document.getElementById("entityQuoteInput").value, 0);
  }

  if (kind === "instruments") {
    payload.usesPlatformQuotes = document.getElementById("entityUsesPlatformQuotesInput").checked;
    payload.platformQuotes = readPlatformQuotes();
  }

  if (id) {
    state[kind] = state[kind].map((item) => (item.id === id ? payload : item));
  } else {
    state[kind].push(payload);
  }

  saveState();
  document.getElementById("entityDialog").close();
  render();
}

function renderPlatformQuotesEditor(platformQuotes = readPlatformQuotes()) {
  const enabled = document.getElementById("entityUsesPlatformQuotesInput").checked;
  const editor = document.getElementById("platformQuotesEditor");
  editor.classList.toggle("is-hidden", !enabled);
  editor.innerHTML = `
    <h4>Cotización por plataforma</h4>
    <div class="platform-quote-grid">
      ${state.platforms
        .map(
          (platform) => `
            <label>
              ${escapeHtml(platform.name)}
              <input class="platform-quote-input" data-platform-id="${platform.id}" type="number" min="0" step="0.00000001" value="${platformQuotes[platform.id] ?? ""}" />
            </label>
          `,
        )
        .join("")}
    </div>
  `;
}

function readPlatformQuotes() {
  return [...document.querySelectorAll(".platform-quote-input")].reduce((quotes, input) => {
    const value = toNumber(input.value, NaN);
    if (Number.isFinite(value) && value > 0) {
      quotes[input.dataset.platformId] = value;
    }
    return quotes;
  }, {});
}

function deleteEntity(kind, id) {
  if (isEntityInUse(kind, id)) {
    alert("No se puede eliminar porque está usado en una tenencia.");
    return;
  }

  const confirmed = confirm("¿Eliminar este registro?");
  if (!confirmed) return;
  state[kind] = state[kind].filter((item) => item.id !== id);
  saveState();
  render();
}

function openHoldingDialog(id = "") {
  if (!state.instruments.length || !state.platforms.length || !state.instrumentTypes.length || !state.funds.length) {
    alert("Primero cargá al menos un instrumento, plataforma, tipo y fondo.");
    return;
  }

  const holding = id ? state.holdings.find((item) => item.id === id) : null;
  document.getElementById("holdingDialogTitle").textContent = holding ? "Editar tenencia" : "Nueva tenencia";
  document.getElementById("holdingIdInput").value = id;
  fillSelect("holdingInstrumentInput", state.instruments, holding?.instrumentId);
  fillSelect("holdingPlatformInput", state.platforms, holding?.platformId);
  fillSelect("holdingTypeInput", state.instrumentTypes, holding?.typeId);
  document.getElementById("holdingQuantityInput").value = holding?.quantity ?? "";
  document.getElementById("holdingPendingInput").value = holding?.pendingReceivableUsd ?? "";
  document.getElementById("holdingDescriptionInput").value = holding?.description ?? "";
  renderAllocationRows(holding?.allocations ?? [{ fundId: state.funds[0].id, percent: 100 }]);
  renderQuotePreview();
  document.getElementById("holdingDialog").showModal();
}

function saveHolding() {
  const id = document.getElementById("holdingIdInput").value;
  const allocations = readAllocationRows();
  const allocationTotal = allocations.reduce((sum, allocation) => sum + allocation.percent, 0);

  if (allocations.length && Math.abs(allocationTotal - 100) > 0.000001) {
    alert("La suma de asignaciones debe ser exactamente 100%.");
    return;
  }

  const payload = {
    id: id || crypto.randomUUID(),
    instrumentId: document.getElementById("holdingInstrumentInput").value,
    platformId: document.getElementById("holdingPlatformInput").value,
    typeId: document.getElementById("holdingTypeInput").value,
    quantity: toNumber(document.getElementById("holdingQuantityInput").value, 0),
    pendingReceivableUsd: toNumber(document.getElementById("holdingPendingInput").value, 0),
    description: document.getElementById("holdingDescriptionInput").value.trim(),
    allocations,
  };

  if (id) {
    state.holdings = state.holdings.map((holding) => (holding.id === id ? payload : holding));
  } else {
    state.holdings.push(payload);
  }

  saveState();
  document.getElementById("holdingDialog").close();
  render();
}

function deleteHolding(id) {
  const confirmed = confirm("¿Eliminar esta tenencia?");
  if (!confirmed) return;
  state.holdings = state.holdings.filter((holding) => holding.id !== id);
  saveState();
  render();
}

function fillSelect(elementId, items, selectedValue) {
  const select = document.getElementById(elementId);
  select.innerHTML = items.map((item) => `<option value="${item.id}">${escapeHtml(item.name)}</option>`).join("");
  select.value = selectedValue ?? items[0]?.id ?? "";
}

function renderAllocationRows(allocations) {
  const list = document.getElementById("allocationsList");
  list.innerHTML = "";
  allocations.forEach((allocation) => addAllocationRow(allocation));
}

function addAllocationRow(allocation = { fundId: state.funds[0]?.id, percent: 100 }) {
  const list = document.getElementById("allocationsList");
  const row = document.createElement("div");
  row.className = "allocation-row";
  row.innerHTML = `
    <select class="allocation-fund" required>
      ${state.funds.map((fund) => `<option value="${fund.id}">${escapeHtml(fund.name)}</option>`).join("")}
    </select>
    <input class="allocation-percent" type="number" min="0" max="100" step="0.01" value="${allocation.percent ?? 100}" required />
    <button class="icon-button danger-button remove-allocation" type="button" title="Quitar asignación"><i data-lucide="trash-2"></i></button>
  `;
  row.querySelector(".allocation-fund").value = allocation.fundId ?? state.funds[0]?.id;
  row.querySelector(".remove-allocation").addEventListener("click", () => row.remove());
  list.appendChild(row);
  refreshIcons();
}

function readAllocationRows() {
  return [...document.querySelectorAll(".allocation-row")]
    .map((row) => ({
      fundId: row.querySelector(".allocation-fund").value,
      percent: toNumber(row.querySelector(".allocation-percent").value, 0),
    }))
    .filter((allocation) => allocation.fundId && allocation.percent > 0);
}

function renderQuotePreview() {
  const instrument = findById("instruments", document.getElementById("holdingInstrumentInput").value);
  const platformId = document.getElementById("holdingPlatformInput").value;
  const type = findById("instrumentTypes", document.getElementById("holdingTypeInput").value);
  const pricing = getPricing(instrument, type, platformId);
  const quantity = toNumber(document.getElementById("holdingQuantityInput").value, 0);
  const pendingValue = toNumber(document.getElementById("holdingPendingInput").value, 0);
  const rawAmount = quantity * pricing.quote;
  const usdAmount = pricing.currency === "PESOS" ? rawAmount / state.settings.arsUsd : rawAmount;
  document.getElementById("quotePreview").textContent = instrument && type
    ? `Cotización aplicada: ${formatNumber.format(pricing.quote)} ${pricing.currency}. Tenencia: ${formatUsd.format(usdAmount)}. Pendiente por cobrar: ${formatUsd.format(pendingValue)}. Total estimado: ${formatUsd.format(usdAmount + pendingValue)}.`
    : "Seleccioná instrumento y tipo para calcular el monto estimado.";
}

function getHoldingUsdValue(holding) {
  const type = findById("instrumentTypes", holding.typeId);
  const instrument = findById("instruments", holding.instrumentId);
  if (!type || !instrument) return 0;
  const pricing = getPricing(instrument, type, holding.platformId);
  const amount = toNumber(holding.quantity, 0) * pricing.quote;
  return pricing.currency === "PESOS" ? amount / toNumber(state.settings.arsUsd, 1) : amount;
}

function getHoldingPendingUsdValue(holding) {
  return Math.max(0, toNumber(holding.pendingReceivableUsd, 0));
}

function getPricing(instrument, type, platformId) {
  const platformQuote = instrument?.usesPlatformQuotes ? toNumber(instrument.platformQuotes?.[platformId], 0) : 0;
  const hasPlatformQuote = platformQuote > 0;
  const hasInstrumentQuote = instrument && toNumber(instrument.quote, 0) > 0;
  return {
    currency: hasInstrumentQuote ? instrument.currency : type?.currency ?? "DOLARES",
    quote: hasPlatformQuote ? platformQuote : hasInstrumentQuote ? toNumber(instrument.quote, 0) : toNumber(type?.quote, 0),
  };
}

function getAllocationChips(holding) {
  if (!holding.allocations?.length) return `<span class="chip">Sin Fondo</span>`;
  return holding.allocations
    .map((allocation) => {
      const fund = findById("funds", allocation.fundId);
      return `<span class="chip">${escapeHtml(fund?.name ?? "Fondo")} · ${formatNumber.format(allocation.percent)}%</span>`;
    })
    .join("");
}

function aggregateBy(collectionName, holdingKey) {
  const totals = new Map(state[collectionName].map((item) => [item.id, { label: item.name, current: 0, pending: 0, value: 0, color: item.color || "" }]));
  state.holdings.forEach((holding) => {
    const bucket = totals.get(holding[holdingKey]);
    if (!bucket) return;
    bucket.current += getHoldingUsdValue(holding);
    bucket.pending += getHoldingPendingUsdValue(holding);
    bucket.value = bucket.current + bucket.pending;
  });
  return normalizeSeries([...totals.values()]);
}

function aggregateByFund() {
  const { fundTotals, noFund } = calculateFundTotals();
  const series = state.funds.map((fund) => ({
    label: fund.name,
    current: fundTotals.get(fund.id)?.current ?? 0,
    pending: fundTotals.get(fund.id)?.pending ?? 0,
    value: fundTotals.get(fund.id)?.value ?? 0,
    color: fund.color || "",
  }));
  if (noFund.value > 0) {
    series.push({ label: "Sin Fondo", ...noFund, color: "" });
  }
  return normalizeSeries(series);
}

function calculateFundTotals() {
  const fundTotals = new Map(state.funds.map((fund) => [fund.id, { current: 0, pending: 0, value: 0 }]));
  const noFund = { current: 0, pending: 0, value: 0 };

  state.holdings.forEach((holding) => {
    const currentValue = getHoldingUsdValue(holding);
    const pendingValue = getHoldingPendingUsdValue(holding);
    const allocations = holding.allocations ?? [];
    const allocatedPercent = allocations.reduce((sum, allocation) => sum + allocation.percent, 0);

    allocations.forEach((allocation) => {
      if (!fundTotals.has(allocation.fundId)) return;
      addSplitValue(fundTotals.get(allocation.fundId), currentValue, pendingValue, allocation.percent / 100);
    });

    if (allocatedPercent < 100) {
      addSplitValue(noFund, currentValue, pendingValue, (100 - allocatedPercent) / 100);
    }
  });

  return { fundTotals, noFund };
}

function getFundTotals(fundId) {
  return calculateFundTotals().fundTotals.get(fundId) ?? { current: 0, pending: 0, value: 0 };
}

function addSplitValue(target, currentValue, pendingValue, share) {
  target.current += currentValue * share;
  target.pending += pendingValue * share;
  target.value = target.current + target.pending;
}

function normalizeSeries(series) {
  return series
    .map((item) => ({
      ...item,
      current: toNumber(item.current, 0),
      pending: toNumber(item.pending, 0),
      value: toNumber(item.value, 0),
    }))
    .filter((item) => item.value > 0)
    .sort((a, b) => b.value - a.value);
}

function getSeriesColors(series) {
  return series.map((item, index) => item.color || colors[index % colors.length]);
}

function lightenColor(color, amount) {
  return interpolateColor(color, "#ffffff", amount);
}

function createPieChart(canvasId, series, title) {
  const ctx = document.getElementById(canvasId);
  const total = series.reduce((sum, item) => sum + item.value, 0);
  const seriesColors = getSeriesColors(series);
  const pieItems = series.flatMap((item, index) => {
    const baseColor = seriesColors[index];
    const items = [];
    if (item.current > 0) {
      items.push({ label: item.label, kind: "Tenencia", value: item.current, color: baseColor, legendIndex: index });
    }
    if (item.pending > 0) {
      items.push({ label: item.label, kind: "Pendiente por cobrar", value: item.pending, color: lightenColor(baseColor, 0.58), legendIndex: index });
    }
    return items;
  });
  charts.push(
    new Chart(ctx, {
      type: "doughnut",
      data: {
        labels: pieItems.map((item) => item.label),
        datasets: [
          {
            data: pieItems.map((item) => item.value),
            backgroundColor: pieItems.map((item) => item.color),
            pendingKinds: pieItems.map((item) => item.kind),
            borderColor: "#ffffff",
            borderWidth: 3,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: "58%",
        plugins: {
          legend: {
            position: "bottom",
            labels: {
              boxWidth: 10,
              usePointStyle: true,
              generateLabels() {
                return series.map((item, index) => {
                  const value = item.value;
                  const percent = total ? `${((value / total) * 100).toFixed(1)}%` : "0%";
                  return {
                    text: `${item.label}: ${percent}${item.pending > 0 ? ` · ${formatUsd.format(item.pending)} por cobrar` : ""}`,
                    fillStyle: seriesColors[index],
                    strokeStyle: seriesColors[index],
                    index,
                  };
                });
              },
            },
          },
          title: { display: false },
          tooltip: {
            callbacks: {
              label(context) {
                const value = context.parsed;
                const kind = context.dataset.pendingKinds[context.dataIndex];
                const percent = total ? ` (${((value / total) * 100).toFixed(1)}%)` : "";
                return `${context.label} · ${kind}: ${formatUsd.format(value)}${percent}`;
              },
            },
          },
        },
      },
    }),
  );
}

function createBarChart(canvasId, series, title) {
  const ctx = document.getElementById(canvasId);
  const total = series.reduce((sum, item) => sum + item.value, 0);
  const seriesColors = getSeriesColors(series);
  const pendingColors = seriesColors.map((color) => lightenColor(color, 0.58));
  charts.push(
    new Chart(ctx, {
      type: "bar",
      data: {
        labels: series.map((item) => item.label),
        datasets: [
          {
            label: "Tenencia USD",
            data: series.map((item) => item.current),
            backgroundColor: seriesColors,
            borderRadius: 6,
            maxBarThickness: 54,
          },
          {
            label: "Pendiente por cobrar",
            data: series.map((item) => item.pending),
            backgroundColor: pendingColors,
            borderRadius: 6,
            maxBarThickness: 54,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: true,
            position: "bottom",
            labels: { boxWidth: 10, usePointStyle: true },
          },
          title: { display: false },
          tooltip: {
            callbacks: {
              label(context) {
                const value = context.parsed.y;
                const percent = total ? ` · ${((value / total) * 100).toFixed(1)}%` : "";
                return `${context.dataset.label}: ${formatUsd.format(value)}${percent}`;
              },
              afterBody(items) {
                const index = items[0]?.dataIndex;
                if (index === undefined) return "";
                return `Total estimado: ${formatUsd.format(series[index].value)}`;
              },
            },
          },
        },
        scales: {
          x: {
            stacked: true,
            ticks: { maxRotation: 45, minRotation: 0 },
            grid: { display: false },
          },
          y: {
            stacked: true,
            beginAtZero: true,
            ticks: {
              callback(value) {
                return formatUsd.format(value);
              },
            },
          },
        },
      },
    }),
  );
}

function isEntityInUse(kind, id) {
  const keyByKind = {
    platforms: "platformId",
    instrumentTypes: "typeId",
    instruments: "instrumentId",
  };

  if (kind === "funds") {
    return (
      state.holdings.some((holding) => holding.allocations?.some((allocation) => allocation.fundId === id)) ||
      state.kpis.retirementSalary.fundId === id ||
      state.kpis.indicators.some((indicator) => indicator.fundId === id)
    );
  }

  return state.holdings.some((holding) => holding[keyByKind[kind]] === id);
}

function findById(kind, id) {
  return state[kind].find((item) => item.id === id);
}

function toNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function refreshIcons() {
  if (window.lucide) {
    window.lucide.createIcons();
  }
}

window.openEntityDialog = openEntityDialog;
window.deleteEntity = deleteEntity;
window.openHoldingDialog = openHoldingDialog;
window.deleteHolding = deleteHolding;
window.openIndicatorDialog = openIndicatorDialog;
window.moveIndicator = moveIndicator;
window.deleteIndicator = deleteIndicator;
