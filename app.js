const STORAGE_KEY = "fondos-management-state-v2";
const BLUE_RATES_START_DATE = "2024-01-01";
const BLUELYTICS_EVOLUTION_URL = "https://api.bluelytics.com.ar/v2/evolution.json";
const seedInflationRates = [
  { month: "2024-01-01", usd: 0, ars: 20.6 },
  { month: "2024-02-01", usd: -0.1, ars: 13.2 },
  { month: "2024-03-01", usd: 0.2, ars: 11 },
  { month: "2024-04-01", usd: 0.2, ars: 8.8 },
  { month: "2024-05-01", usd: 0.2, ars: 4.2 },
  { month: "2024-06-01", usd: 0.2, ars: 4.6 },
  { month: "2024-07-01", usd: 0.3, ars: 4 },
  { month: "2024-08-01", usd: 0.1, ars: 4.2 },
  { month: "2024-09-01", usd: 0.1, ars: 3.5 },
  { month: "2024-10-01", usd: 0.1, ars: 2.7 },
  { month: "2024-11-01", usd: 0.1, ars: 2.4 },
  { month: "2024-12-01", usd: 0.1, ars: 2.7 },
  { month: "2025-01-01", usd: 0.1, ars: 2.2 },
  { month: "2025-02-01", usd: 0.1, ars: 2.4 },
  { month: "2025-03-01", usd: 0.1, ars: 3.7 },
  { month: "2025-04-01", usd: 0, ars: 2.8 },
  { month: "2025-05-01", usd: 0.3, ars: 1.5 },
  { month: "2025-06-01", usd: 0.2, ars: 1.6 },
  { month: "2025-07-01", usd: 0.8, ars: 1.9 },
  { month: "2025-08-01", usd: 0.2, ars: 1.9 },
  { month: "2025-09-01", usd: 0.4, ars: 2.1 },
  { month: "2025-10-01", usd: 0.3, ars: 2.3 },
  { month: "2025-11-01", usd: 0.3, ars: 2.5 },
  { month: "2025-12-01", usd: 0.3, ars: 2.8 },
  { month: "2026-01-01", usd: 0.2, ars: 2.9 },
  { month: "2026-02-01", usd: 0.3, ars: 2.9 },
  { month: "2026-03-01", usd: 0.9, ars: 3.4 },
];

const seedState = {
  settings: {
    arsUsd: 1000,
    applyInflationAdjustment: false,
  },
  fxRates: {
    blue: {
      provider: "bluelytics",
      source: "Blue",
      fromDate: BLUE_RATES_START_DATE,
      rates: [],
      lastSyncAt: "",
      lastError: "",
    },
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
  transactions: [],
  inflation: {
    rates: seedInflationRates,
  },
};

let state = loadState();
let charts = [];
let returnsTypeFilterId = "all";
const returnChartUnitModes = {};
const dashboardFilters = {
  fundIds: new Set(),
  instrumentIds: new Set(),
  platformIds: new Set(),
  typeIds: new Set(),
};

const noFundFilterId = "__no-fund__";
const dashboardFilterConfig = {
  fundIds: { label: "Fondo", collection: "funds" },
  instrumentIds: { label: "Instrumento", collection: "instruments" },
  platformIds: { label: "Plataforma", collection: "platforms" },
  typeIds: { label: "Tipo", collection: "instrumentTypes" },
};

const transactionKindLabels = {
  BUY: "Compra",
  SELL: "Venta",
  DIVIDEND: "Dividendo",
  INCOME: "Renta / amortización",
  DEPOSIT: "Ingreso de fondos",
  WITHDRAWAL: "Retiro de fondos",
  TAX: "Impuesto / retención",
  FEE: "Gasto / arancel",
  CAUCION_OPEN: "Caución apertura",
  CAUCION_CLOSE: "Caución cierre",
  TRANSFER: "Transferencia / conversión",
  ADJUSTMENT: "Ajuste",
};

const standardTransactionHeaders = [
  "fecha_operada",
  "fecha_liquidacion",
  "plataforma",
  "tipo_movimiento",
  "ticker",
  "tipo_instrumento",
  "cantidad",
  "precio",
  "monto",
  "moneda",
  "descripcion",
  "referencia",
];

const standardTransactionTemplateRows = [
  standardTransactionHeaders,
  ["2026-01-15", "2026-01-17", "Bull Market Brokers", "COMPRA", "SPY", "ETF", "2", "500.25", "-1000.50", "DOLARES", "Compra ejemplo", "BMB-0001"],
  ["2026-02-10", "2026-02-10", "Bull Market Brokers", "DIVIDENDO", "SPY", "ETF", "", "", "12.35", "DOLARES", "Dividendo ejemplo", "BMB-0002"],
  ["2026-03-05", "2026-03-07", "IOL", "VENTA", "AL30", "BONO", "100", "72000", "72000", "PESOS", "Venta ejemplo", "IOL-0001"],
];

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
  bindTransactions();
  bindReturns();
  bindDataPortability();
  bindReset();
  render();
  syncBlueRatesFromBluelytics();
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
  nextState.fxRates = normalizeFxRates(nextState.fxRates);
  nextState.inflation = {
    rates: normalizeInflationRates(nextState.inflation?.rates?.length ? nextState.inflation.rates : seedInflationRates),
  };
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
  nextState.transactions = (nextState.transactions ?? []).map(normalizeTransaction);
  return nextState;
}

function normalizeFxRates(fxRates = {}) {
  return {
    ...seedState.fxRates,
    ...fxRates,
    blue: {
      ...seedState.fxRates.blue,
      ...(fxRates.blue ?? {}),
      fromDate: fxRates.blue?.fromDate ?? BLUE_RATES_START_DATE,
      rates: normalizeBlueRates(fxRates.blue?.rates ?? []),
      lastSyncAt: fxRates.blue?.lastSyncAt ?? "",
      lastError: fxRates.blue?.lastError ?? "",
    },
  };
}

function normalizeBlueRates(rates) {
  const byDate = new Map();
  rates.forEach((rate) => {
    const date = String(rate.date ?? "").slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date < BLUE_RATES_START_DATE) return;
    const sell = toNumber(rate.sell ?? rate.valueSell ?? rate.value_sell, 0);
    const buy = toNumber(rate.buy ?? rate.valueBuy ?? rate.value_buy, 0);
    const avg = toNumber(rate.avg ?? rate.valueAvg ?? rate.value_avg, sell || buy);
    if (sell <= 0 && buy <= 0 && avg <= 0) return;
    byDate.set(date, {
      date,
      sell: sell || avg || buy,
      buy: buy || avg || sell,
      avg: avg || sell || buy,
    });
  });
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

function normalizeInflationRates(rates) {
  const byMonth = new Map();
  rates.forEach((rate) => {
    const month = getMonthStartIso(rate.month ?? rate.Fecha ?? rate.fecha ?? rate.date);
    if (!month) return;
    byMonth.set(month, {
      month,
      usd: toNumber(rate.usd ?? rate["Inflation Dolar"] ?? rate.inflationDolar, 0),
      ars: toNumber(rate.ars ?? rate["Inflation Pesos"] ?? rate.inflationPesos, 0),
    });
  });
  return [...byMonth.values()].sort((a, b) => a.month.localeCompare(b.month));
}

function normalizeTransaction(transaction) {
  return {
    id: transaction.id ?? crypto.randomUUID(),
    sourceKey: transaction.sourceKey ?? "",
    sourceAdapter: transaction.sourceAdapter ?? "",
    sourceFile: transaction.sourceFile ?? "",
    sourceRow: toNumber(transaction.sourceRow, 0),
    sourceAccount: transaction.sourceAccount ?? "",
    platformId: transaction.platformId ?? "",
    tradeDate: transaction.tradeDate ?? "",
    settlementDate: transaction.settlementDate ?? "",
    kind: transaction.kind ?? "ADJUSTMENT",
    instrumentId: transaction.instrumentId ?? "",
    typeId: transaction.typeId ?? "",
    symbol: transaction.symbol ?? "",
    quantity: toNumber(transaction.quantity, 0),
    price: toNumber(transaction.price, 0),
    amount: toNumber(transaction.amount, 0),
    currency: transaction.currency ?? "",
    description: transaction.description ?? "",
    rawType: transaction.rawType ?? "",
    rawReference: transaction.rawReference ?? "",
    usesNotionalQuantity: Boolean(transaction.usesNotionalQuantity),
  };
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
    resetDashboardFilters();
    saveState();
    render();
  });
}

function exportData() {
  saveState();
  const payload = {
    app: "Fondos Management",
    version: 5,
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
    resetDashboardFilters();
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

  if (importedState.transactions !== undefined && !Array.isArray(importedState.transactions)) {
    throw new Error("La sección transactions debe ser una lista.");
  }

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

function bindTransactions() {
  document.getElementById("newTransactionButton").addEventListener("click", () => openTransactionDialog());
  document.getElementById("importTransactionsButton").addEventListener("click", importTransactions);
  document.getElementById("downloadTransactionTemplateButton").addEventListener("click", downloadStandardTransactionTemplate);
  document.getElementById("clearTransactionsButton").addEventListener("click", clearTransactions);
  document.getElementById("transactionFileInput").addEventListener("change", (event) => {
    const file = event.target.files?.[0];
    document.getElementById("transactionImportStatus").textContent = file
      ? `${file.name} listo para importar.`
      : "Elegí una plataforma y cargá un archivo de movimientos.";
  });
  document.getElementById("transactionForm").addEventListener("submit", (event) => {
    if (event.submitter?.value === "cancel") return;
    event.preventDefault();
    saveTransaction();
  });
}

function bindReturns() {
  document.getElementById("returnsTypeFilterInput")?.addEventListener("change", (event) => {
    returnsTypeFilterId = event.target.value;
    renderReturns();
    refreshIcons();
  });
  document.getElementById("inflationAdjustmentInput")?.addEventListener("change", (event) => {
    state.settings.applyInflationAdjustment = event.target.checked;
    saveState();
    render();
  });
}

function render() {
  document.getElementById("arsUsdInput").value = state.settings.arsUsd;
  renderKpis();
  renderHoldings();
  renderMasterLists();
  renderCharts();
  renderKpiSection();
  renderTransactions();
  renderReturns();
  refreshIcons();
}

async function syncBlueRatesFromBluelytics() {
  const cachedLastDate = getLastCachedBlueRateDate();
  if (cachedLastDate && cachedLastDate >= todayIsoDate()) return;

  try {
    const response = await fetch(BLUELYTICS_EVOLUTION_URL, { cache: "no-store" });
    if (!response.ok) throw new Error(`Bluelytics respondió ${response.status}`);
    const rows = await response.json();
    const fetchedRates = normalizeBlueRates(
      rows
        .filter((row) => String(row.source ?? "").toLowerCase() === "blue")
        .map((row) => ({
          date: row.date,
          sell: row.value_sell,
          buy: row.value_buy,
          avg: row.value_avg,
        })),
    );
    const newRates = cachedLastDate ? fetchedRates.filter((rate) => rate.date > cachedLastDate) : fetchedRates;
    state.fxRates.blue = {
      ...state.fxRates.blue,
      rates: normalizeBlueRates([...state.fxRates.blue.rates, ...newRates]),
      lastSyncAt: new Date().toISOString(),
      lastError: "",
    };
    saveState();
    render();
  } catch (error) {
    state.fxRates.blue = {
      ...state.fxRates.blue,
      lastSyncAt: new Date().toISOString(),
      lastError: error.message ?? "No se pudieron actualizar las cotizaciones.",
    };
    saveState();
    console.warn("No se pudieron actualizar las cotizaciones blue de Bluelytics.", error);
  }
}

function renderKpis() {
  const slices = getFilteredHoldingSlices();
  const currentTotal = slices.reduce((sum, slice) => sum + slice.current, 0);
  const pendingTotal = slices.reduce((sum, slice) => sum + slice.pending, 0);
  const total = currentTotal + pendingTotal;
  document.getElementById("globalTotal").textContent = formatUsd.format(total);
  document.getElementById("globalTotalMeta").textContent = pendingTotal > 0
    ? `${formatUsd.format(currentTotal)} efectivo + ${formatUsd.format(pendingTotal)} por cobrar`
    : hasDashboardFilters()
      ? "Resultado filtrado en USD"
      : "Calculada en USD";
  document.getElementById("instrumentCount").textContent = hasDashboardFilters()
    ? new Set(slices.map((slice) => slice.holding.instrumentId)).size
    : state.instruments.length;
  document.getElementById("holdingCount").textContent = hasDashboardFilters()
    ? new Set(slices.map((slice) => slice.holding.id)).size
    : state.holdings.length;
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

function renderTransactions() {
  fillSelect("transactionPlatformInput", state.platforms, document.getElementById("transactionPlatformInput")?.value || state.platforms[0]?.id);
  renderInstrumentPerformance();
  renderTransactionsTable();
}

function renderTransactionsTable() {
  const tbody = document.getElementById("transactionsTable");
  if (!state.transactions.length) {
    tbody.innerHTML = `<tr><td colspan="9"><div class="empty-state">Todavía no hay transacciones importadas.</div></td></tr>`;
    return;
  }

  tbody.innerHTML = [...state.transactions]
    .sort((a, b) => (b.tradeDate || "").localeCompare(a.tradeDate || "") || (b.sourceRow - a.sourceRow))
    .map((transaction) => {
      const platform = findById("platforms", transaction.platformId);
      const instrument = findById("instruments", transaction.instrumentId);
      return `
        <tr>
          <td>${formatDisplayDate(transaction.tradeDate)}<div class="muted">${formatDisplayDate(transaction.settlementDate)}</div></td>
          <td>${escapeHtml(platform?.name ?? "Sin plataforma")}</td>
          <td><span class="chip">${escapeHtml(transactionKindLabels[transaction.kind] ?? transaction.kind)}</span><div class="muted">${escapeHtml(transaction.rawType)}</div></td>
          <td><strong>${escapeHtml(instrument?.name ?? transaction.symbol ?? "Caja")}</strong><div class="muted">${escapeHtml(transaction.description)}</div></td>
          <td>${formatNumber.format(transaction.quantity)}</td>
          <td>${formatNumber.format(transaction.price)}</td>
          <td class="amount">${formatMoneyByCurrency(transaction.amount, transaction.currency)}</td>
          <td>${escapeHtml(transaction.currency || transaction.sourceAccount || "-")}</td>
          <td>
            <div class="actions">
              <button class="icon-button" type="button" title="Editar" onclick="openTransactionDialog('${transaction.id}')"><i data-lucide="pencil"></i></button>
              <button class="icon-button danger-button" type="button" title="Eliminar" onclick="deleteTransaction('${transaction.id}')"><i data-lucide="trash-2"></i></button>
            </div>
          </td>
        </tr>
      `;
    })
    .join("");
}

function renderInstrumentPerformance() {
  const list = document.getElementById("instrumentPerformanceList");
  const rows = calculateInstrumentPerformance();
  if (!rows.length) {
    list.innerHTML = `<div class="empty-state">Importá transacciones para ver rendimiento por instrumento.</div>`;
    return;
  }

  list.innerHTML = rows
    .map((row) => `
      <div class="performance-item">
        <div>
          <strong>${escapeHtml(row.instrumentName)}</strong>
          <div class="entity-meta">${escapeHtml(row.platformName)} · ${formatNumber.format(row.netQuantity)} unidades · ${formatMoneyByCurrency(row.currentValue, "DOLARES")} valuación actual</div>
        </div>
        <div class="performance-metrics">
          <span>Costo abierto ${formatMoneyByCurrency(row.openCost, "DOLARES")}</span>
          <span>Ingresos ${formatMoneyByCurrency(row.income, "DOLARES")}</span>
          <span>Resultado ${formatMoneyByCurrency(row.totalResult, "DOLARES")}</span>
          <strong class="${row.annualizedReturn >= 0 ? "positive" : "negative"}">${formatPercentOneDecimal(row.annualizedReturn * 100)} anual</strong>
        </div>
      </div>
    `)
    .join("");
}

function renderReturns() {
  const grid = document.getElementById("returnsGrid");
  if (!grid) return;
  destroyReturnCharts();
  renderReturnsControls();
  const allGroups = calculateReturnLotCharts();
  renderFundReturns(allGroups);
  const groups = allGroups.filter((group) => returnGroupMatchesTypeFilter(group));
  if (!groups.length) {
    grid.innerHTML = `<div class="empty-state">Importá transacciones para ver rendimientos por lote.</div>`;
    return;
  }

  grid.innerHTML = groups
    .map((group, index) => `
      <article class="return-panel">
        <div class="return-panel-header">
          <div>
            <h3>${escapeHtml(group.instrumentName)}</h3>
            <p>${escapeHtml(group.platformTransactionSummary)}</p>
          </div>
          <div class="return-summary">
            <span>Rendimiento</span>
            <strong class="${group.totalReturnPercent >= 0 ? "positive" : "negative"}">${formatPercentOneDecimal(group.totalReturnPercent * 100)}</strong>
            <small>TIR ${group.globalXirr === null ? "s/d" : formatPercentOneDecimal(group.globalXirr * 100)}</small>
          </div>
        </div>
        <div class="return-totals">
          <div><span>Compras</span><strong>${formatUsd.format(group.totalPurchases)}</strong></div>
          <div><span>Ventas</span><strong>${formatUsd.format(group.totalSales)}</strong></div>
          <div><span>Compras - ventas</span><strong>${formatUsd.format(group.netPurchases)}</strong></div>
          <div><span>Valor actual</span><strong>${formatUsd.format(group.currentValue)}</strong></div>
          <div><span>Ganancia / pérdida neta</span><strong class="${group.netGain >= 0 ? "positive" : "negative"}">${formatUsd.format(group.netGain)}</strong></div>
        </div>
        <div class="return-chart-options">
          <label class="checkbox-label">
            <input type="checkbox" ${returnChartUnitModes[`returnChart${index}`] ? "checked" : ""} onchange="toggleReturnChartUnitMode('returnChart${index}', this.checked)" />
            Ver por ${group.unitBase === 100 ? "100 unidades" : "unidad"}
          </label>
        </div>
        <div class="return-chart-wrap">
          <canvas id="returnChart${index}"></canvas>
        </div>
        ${renderReturnEventsTable(group)}
      </article>
    `)
    .join("");

  groups.forEach((group, index) => createReturnLotChart(`returnChart${index}`, group));
}

function destroyReturnCharts() {
  charts = charts.filter((chart) => {
    if (chart.canvas?.id?.startsWith("returnChart")) {
      chart.destroy();
      return false;
    }
    return true;
  });
}

function renderFundReturns(instrumentGroups) {
  const grid = document.getElementById("fundReturnsGrid");
  if (!grid) return;
  const rows = calculateFundReturns(instrumentGroups);
  const portfolio = calculatePortfolioReturn(instrumentGroups);
  if (!rows.length && !portfolio) {
    grid.innerHTML = "";
    return;
  }

  const portfolioCard = portfolio ? renderReturnAggregateCard({
    title: "Cartera total",
    eyebrow: "Valuación general",
    subtitle: `${portfolio.instrumentCount} ${portfolio.instrumentCount === 1 ? "instrumento" : "instrumentos"} combinados`,
    row: portfolio,
    className: "portfolio-return-card",
  }) : "";

  grid.innerHTML = portfolioCard + rows
    .map((row) => `
      <article class="fund-return-card">
        <div>
          <span>Fondo</span>
          <h3>${escapeHtml(row.fundName)}</h3>
          <small>${row.instrumentCount} ${row.instrumentCount === 1 ? "instrumento" : "instrumentos"} ponderados</small>
        </div>
        <div class="fund-return-main">
          <strong class="${row.totalReturnPercent >= 0 ? "positive" : "negative"}">${formatPercentOneDecimal(row.totalReturnPercent * 100)}</strong>
          <small>TIR ${row.xirr === null ? "s/d" : formatPercentOneDecimal(row.xirr * 100)}</small>
        </div>
        <div class="fund-return-current">
          <span>Valor actual</span>
          <strong>${formatUsd.format(row.currentValue)}</strong>
        </div>
        <div class="fund-return-metrics">
          <span>Compras ${formatUsd.format(row.purchases)}</span>
          <span>Ventas ${formatUsd.format(row.sales)}</span>
          <span>Ingresos ${formatUsd.format(row.income)}</span>
          <span class="${row.netGain >= 0 ? "positive" : "negative"}">Neto ${formatUsd.format(row.netGain)}</span>
        </div>
      </article>
    `)
    .join("");
}

function renderReturnAggregateCard({ title, eyebrow, subtitle, row, className = "" }) {
  return `
    <article class="fund-return-card ${className}">
      <div>
        <span>${escapeHtml(eyebrow)}</span>
        <h3>${escapeHtml(title)}</h3>
        <small>${escapeHtml(subtitle)}</small>
      </div>
      <div class="fund-return-main">
        <strong class="${row.totalReturnPercent >= 0 ? "positive" : "negative"}">${formatPercentOneDecimal(row.totalReturnPercent * 100)}</strong>
        <small>TIR ${row.xirr === null ? "s/d" : formatPercentOneDecimal(row.xirr * 100)}</small>
      </div>
      <div class="fund-return-current">
        <span>Valor actual</span>
        <strong>${formatUsd.format(row.currentValue)}</strong>
      </div>
      <div class="fund-return-metrics">
        <span>Compras ${formatUsd.format(row.purchases)}</span>
        <span>Ventas ${formatUsd.format(row.sales)}</span>
        <span>Ingresos ${formatUsd.format(row.income)}</span>
        <span class="${row.netGain >= 0 ? "positive" : "negative"}">Neto ${formatUsd.format(row.netGain)}</span>
      </div>
    </article>
  `;
}

function renderReturnsControls() {
  const typeSelect = document.getElementById("returnsTypeFilterInput");
  if (typeSelect) {
    const options = [`<option value="all">Todos</option>`]
      .concat(state.instrumentTypes.map((type) => `<option value="${type.id}">${escapeHtml(type.name)}</option>`));
    typeSelect.innerHTML = options.join("");
    typeSelect.value = returnsTypeFilterId;
  }
  const inflationInput = document.getElementById("inflationAdjustmentInput");
  if (inflationInput) inflationInput.checked = Boolean(state.settings.applyInflationAdjustment);
}

function returnGroupMatchesTypeFilter(group) {
  return returnsTypeFilterId === "all" || group.typeIds.includes(returnsTypeFilterId);
}

function renderReturnEventsTable(group) {
  return `
    <details class="return-events-details">
      <summary>
        <span>Detalle de movimientos</span>
        <strong>${group.lots.length}</strong>
      </summary>
      <div class="return-events-table-wrap">
        <table class="return-events-table">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Movimiento</th>
              <th>Cantidad</th>
              <th>Precio</th>
              <th>Valor actual individual</th>
              <th>Diferencia por unidad</th>
              <th>Valor total movimiento</th>
              <th>Valor actual</th>
              <th>Diferencia total</th>
              <th>${escapeHtml(group.incomeLabel)}</th>
              <th>Rendimiento</th>
              <th>TIR</th>
            </tr>
          </thead>
          <tbody>
            ${group.lots.map((event) => renderReturnEventRow(event, group.incomeLabel)).join("")}
          </tbody>
        </table>
      </div>
    </details>
  `;
}

function renderReturnEventRow(event, incomeLabel) {
  const isSale = event.kind === "sale";
  const movementValue = isSale ? event.proceeds : event.remainingCost;
  const movementLabel = isSale ? "Venta" : "Compra";
  const price = isSale ? event.salePrice : event.purchasePrice;
  const currentValue = isSale ? event.proceeds : event.currentValue;
  const difference = isSale ? event.proceeds - event.cost : event.currentValue - event.remainingCost;
  const currentUnitValue = getReturnEventCurrentUnitValue(event);
  const unitDifference = currentUnitValue - price;
  return `
    <tr>
      <td>${escapeHtml(formatDisplayDate(event.date))}</td>
      <td>${movementLabel}</td>
      <td>${formatNumber.format(event.quantity)}</td>
      <td>${formatUsd.format(price)}</td>
      <td>${formatUsd.format(currentUnitValue)}</td>
      <td class="${unitDifference >= 0 ? "positive" : "negative"}">${formatUsd.format(unitDifference)}</td>
      <td>${formatUsd.format(movementValue)}</td>
      <td>${formatUsd.format(currentValue)}</td>
      <td class="${difference >= 0 ? "positive" : "negative"}">${formatUsd.format(difference)}</td>
      <td>${formatUsd.format(event.dividends)}</td>
      <td>${formatPercentOneDecimal(event.returnPercent * 100)}</td>
      <td>${event.xirr === null ? "s/d" : formatPercentOneDecimal(event.xirr * 100)}</td>
    </tr>
  `;
}

function calculateFundReturns(instrumentGroups) {
  const fundRows = new Map(
    state.funds.map((fund) => [
      fund.id,
      {
        fundId: fund.id,
        fundName: fund.name,
        purchases: 0,
        sales: 0,
        currentValue: 0,
        income: 0,
        netGain: 0,
        totalReturnPercent: 0,
        xirr: null,
        cashflows: [],
        instrumentIds: new Set(),
      },
    ]),
  );

  instrumentGroups.forEach((group) => {
    group.lots.forEach((event) => {
      const fundShares = getFundSharesForInstrumentPlatform(group.instrumentId, event.platformId);
      fundShares.forEach((share, fundId) => {
        const row = fundRows.get(fundId);
        if (!row || share <= 0) return;
        const purchaseValue = getReturnEventCost(event) * share;
        const saleValue = toNumber(event.proceeds, 0) * share;
        const currentValue = toNumber(event.currentValue, 0) * share;
        const incomeValue = toNumber(event.dividends, 0) * share;

        row.purchases += purchaseValue;
        row.sales += saleValue;
        row.currentValue += currentValue;
        row.income += incomeValue;
        row.instrumentIds.add(group.instrumentId);
        row.cashflows.push(...getReturnEventCashflows(event).map((flow) => ({ ...flow, amount: flow.amount * share })));
      });
    });
  });

  return [...fundRows.values()]
    .map((row) => {
      row.netGain = row.sales + row.currentValue + row.income - row.purchases;
      row.totalReturnPercent = row.purchases > 0 ? row.netGain / row.purchases : 0;
      row.xirr = calculateXirr(row.cashflows);
      row.instrumentCount = row.instrumentIds.size;
      return row;
    })
    .filter((row) => row.instrumentCount > 0 && row.purchases > 0)
    .sort((a, b) => Math.abs(b.netGain) - Math.abs(a.netGain));
}

function calculatePortfolioReturn(instrumentGroups) {
  const row = {
    purchases: 0,
    sales: 0,
    currentValue: 0,
    income: 0,
    netGain: 0,
    totalReturnPercent: 0,
    xirr: null,
    cashflows: [],
    instrumentIds: new Set(),
  };

  instrumentGroups.forEach((group) => {
    group.lots.forEach((event) => {
      row.purchases += getReturnEventCost(event);
      row.sales += toNumber(event.proceeds, 0);
      row.currentValue += toNumber(event.currentValue, 0);
      row.income += toNumber(event.dividends, 0);
      row.instrumentIds.add(group.instrumentId);
      row.cashflows.push(...getReturnEventCashflows(event));
    });
  });

  row.netGain = row.sales + row.currentValue + row.income - row.purchases;
  row.totalReturnPercent = row.purchases > 0 ? row.netGain / row.purchases : 0;
  row.xirr = calculateXirr(row.cashflows);
  row.instrumentCount = row.instrumentIds.size;
  return row.instrumentCount > 0 && row.purchases > 0 ? row : null;
}

function getFundSharesForInstrumentPlatform(instrumentId, platformId) {
  const holdings = state.holdings.filter((holding) => holding.instrumentId === instrumentId && holding.platformId === platformId);
  const totalQuantity = holdings.reduce((sum, holding) => sum + Math.max(0, toNumber(holding.quantity, 0)), 0);
  const shares = new Map();

  holdings.forEach((holding) => {
    const quantityShare = totalQuantity > 0 ? Math.max(0, toNumber(holding.quantity, 0)) / totalQuantity : 1 / holdings.length;
    (holding.allocations ?? []).forEach((allocation) => {
      if (!allocation.fundId || toNumber(allocation.percent, 0) <= 0) return;
      shares.set(allocation.fundId, (shares.get(allocation.fundId) ?? 0) + quantityShare * (toNumber(allocation.percent, 0) / 100));
    });
  });

  return shares;
}

function getReturnEventCashflows(event) {
  if (event.kind === "sale") {
    return [
      { date: event.buyDate, amount: -event.cost },
      ...event.dividendCashflows,
      { date: event.date, amount: event.proceeds },
    ];
  }
  return [
    { date: event.date, amount: -event.remainingCost },
    ...event.dividendCashflows,
    { date: todayIsoDate(), amount: event.currentValue },
  ];
}

function getReturnEventCurrentUnitValue(event) {
  if (event.kind === "sale") return event.salePrice;
  return event.currentPrice;
}

function getReturnEventUnitDifference(event) {
  return getReturnEventCurrentUnitValue(event) - (event.kind === "sale" ? event.salePrice : event.purchasePrice);
}

function getReturnGroupPlatformTransactionSummary(group) {
  const counts = new Map();
  group.lots.forEach((event) => {
    counts.set(event.platformName, (counts.get(event.platformName) ?? 0) + 1);
  });
  return [...counts.entries()]
    .map(([platformName, count]) => `${platformName} · ${count} ${count === 1 ? "transacción" : "transacciones"}`)
    .join(" · ");
}

function getReturnChartDatasetValue(event, kind, isUnitMode, unitBase) {
  if (isUnitMode) return getReturnChartUnitDatasetValue(event, kind, unitBase);
  if (kind === "sale") return event.kind === "sale" ? event.proceeds : 0;
  if (kind === "currentLoss") return event.kind === "sale" ? 0 : event.currentValue < event.remainingCost ? event.currentValue : 0;
  if (kind === "purchase") return event.kind === "sale" ? 0 : event.currentValue >= event.remainingCost ? event.remainingCost : 0;
  if (kind === "appreciation") return event.kind === "sale" ? 0 : Math.max(0, event.currentValue - event.remainingCost);
  if (kind === "negativeDifference") return event.kind === "sale" ? 0 : Math.max(0, event.remainingCost - event.currentValue);
  if (kind === "income") return event.dividends;
  return 0;
}

function getReturnChartUnitDatasetValue(event, kind, unitBase) {
  const quantity = Math.max(0, event.kind === "sale" ? event.quantity : event.remainingQuantity);
  const incomePerUnit = quantity > 0 ? (event.dividends / quantity) * unitBase : 0;
  if (kind === "sale") return event.kind === "sale" ? event.salePrice * unitBase : 0;
  if (kind === "income") return incomePerUnit;
  if (event.kind === "sale") return 0;

  const purchase = event.purchasePrice * unitBase;
  const current = event.currentPrice * unitBase;
  if (kind === "currentLoss") return current < purchase ? current : 0;
  if (kind === "purchase") return current >= purchase ? purchase : 0;
  if (kind === "appreciation") return Math.max(0, current - purchase);
  if (kind === "negativeDifference") return Math.max(0, purchase - current);
  return 0;
}

function toggleReturnChartUnitMode(canvasId, checked) {
  returnChartUnitModes[canvasId] = checked;
  renderReturns();
  refreshIcons();
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

function renderDashboardFilterBar() {
  const bar = document.getElementById("dashboardFilterBar");
  const activeFilters = getActiveDashboardFilters();
  bar.hidden = !activeFilters.length;
  if (!activeFilters.length) {
    bar.innerHTML = "";
    return;
  }

  bar.innerHTML = `
    <div class="filter-chip-row">
      ${activeFilters
        .map(
          (filter) => `
            <button class="filter-chip active-filter-chip" type="button" data-filter-key="${filter.key}" data-filter-id="${escapeHtml(filter.id)}" title="Quitar filtro">
              <span>${escapeHtml(filter.label)}: ${escapeHtml(filter.valueLabel)}</span>
              <i data-lucide="x"></i>
            </button>
          `,
        )
        .join("")}
    </div>
    <button class="ghost-button clear-dashboard-filters" type="button">
      <i data-lucide="x-circle"></i>
      Limpiar
    </button>
  `;

  bar.querySelectorAll(".active-filter-chip").forEach((button) => {
    button.addEventListener("click", () => {
      dashboardFilters[button.dataset.filterKey].delete(button.dataset.filterId);
      rerenderDashboardViews();
    });
  });
  bar.querySelector(".clear-dashboard-filters").addEventListener("click", () => {
    clearDashboardFilters();
  });
}

function getActiveDashboardFilters() {
  return Object.entries(dashboardFilters).flatMap(([key, selectedValues]) =>
    [...selectedValues].map((id) => ({
      key,
      id,
      label: dashboardFilterConfig[key].label,
      valueLabel: getDashboardFilterValueLabel(key, id),
    })),
  );
}

function getDashboardFilterValueLabel(filterKey, id) {
  if (filterKey === "fundIds" && id === noFundFilterId) return "Sin Fondo";
  const collectionName = dashboardFilterConfig[filterKey].collection;
  return findById(collectionName, id)?.name ?? "Sin registro";
}

function hasDashboardFilters() {
  return Object.values(dashboardFilters).some((selectedValues) => selectedValues.size > 0);
}

function toggleDashboardFilter(filterKey, id) {
  if (!dashboardFilters[filterKey] || !id) return;
  if (dashboardFilters[filterKey].has(id)) {
    dashboardFilters[filterKey].delete(id);
  } else {
    dashboardFilters[filterKey].add(id);
  }
  window.setTimeout(rerenderDashboardViews, 0);
}

function clearDashboardFilters() {
  resetDashboardFilters();
  rerenderDashboardViews();
}

function resetDashboardFilters() {
  Object.values(dashboardFilters).forEach((selectedValues) => selectedValues.clear());
}

function rerenderDashboardViews() {
  renderKpis();
  renderCharts();
  renderKpiSection();
  refreshIcons();
}

function renderCharts() {
  charts.forEach((chart) => chart.destroy());
  charts = [];
  renderDashboardFilterBar();

  const chartGrid = document.getElementById("chartGrid");
  const specs = [
    { id: "fund", title: "Por Fondo", filterKey: "fundIds", series: aggregateByFund("fundIds") },
    { id: "instrument", title: "Por Instrumento", filterKey: "instrumentIds", series: aggregateBy("instruments", "instrumentId", "instrumentIds") },
    { id: "platform", title: "Por Plataforma", filterKey: "platformIds", series: aggregateBy("platforms", "platformId", "platformIds") },
    { id: "type", title: "Por Tipo de Instrumento", filterKey: "typeIds", series: aggregateBy("instrumentTypes", "typeId", "typeIds") },
  ];

  chartGrid.innerHTML = specs
    .map(
      (spec) => `
        <section class="chart-section">
          <div class="chart-section-header">
            <h3>${spec.title}</h3>
            ${dashboardFilters[spec.filterKey].size ? `<span class="filter-count">${dashboardFilters[spec.filterKey].size}</span>` : ""}
          </div>
          <div class="chart-pair">
            <div class="chart-panel"><canvas id="${spec.id}Pie"></canvas></div>
            <div class="chart-panel"><canvas id="${spec.id}Bar"></canvas></div>
          </div>
        </section>
      `,
    )
    .join("");

  specs.forEach((spec) => {
    createPieChart(`${spec.id}Pie`, spec.series, spec.filterKey);
    createBarChart(`${spec.id}Bar`, spec.series, spec.filterKey);
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

async function importTransactions() {
  const platformId = document.getElementById("transactionPlatformInput").value;
  const adapter = document.getElementById("transactionAdapterInput").value;
  const file = document.getElementById("transactionFileInput").files?.[0];
  const status = document.getElementById("transactionImportStatus");

  if (!platformId) {
    alert("Primero elegí una plataforma.");
    return;
  }

  if (!file) {
    alert("Primero cargá un archivo CSV o XLSX.");
    return;
  }

  try {
    status.textContent = "Leyendo movimientos...";
    const rows = await readTransactionFileRows(file);
    const transactions =
      adapter === "standard"
        ? parseStandardTransactions(rows, platformId, file.name)
        : adapter === "bmb"
        ? parseBmbTransactions(rows, platformId, file.name)
        : adapter === "bmb-simple"
          ? parseBmbSimpleTransactions(rows, platformId, file.name)
          : adapter === "iol"
            ? parseIolTransactions(rows, platformId, file.name)
            : adapter === "iol-dividends"
              ? parseIolDividendTransactions(rows, platformId, file.name)
              : [];
    const { created, updated } = mergeTransactions(transactions);
    saveState();
    render();
    document.getElementById("transactionFileInput").value = "";
    status.textContent = `${created} transacciones creadas y ${updated} actualizadas desde ${file.name}.`;
  } catch (error) {
    status.textContent = `No se pudo importar: ${error.message}`;
  }
}

function downloadStandardTransactionTemplate() {
  const csv = standardTransactionTemplateRows.map((row) => row.map(escapeCsvCell).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "template-transacciones-estandar.csv";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(link.href);
}

async function readTransactionFileRows(file) {
  const extension = file.name.split(".").pop()?.toLowerCase();
  if (extension === "csv") {
    return parseDelimitedRows(await file.text());
  }

  if (extension === "xls") {
    const text = await file.text();
    if (/<table[\s>]/i.test(text)) {
      return parseHtmlTableRows(text);
    }
    return readXlsxRows(file);
  }

  return readXlsxRows(file);
}

async function readXlsxRows(file) {
  if (!window.XLSX) {
    throw new Error("No se cargó el lector XLSX. Revisá la conexión y volvé a intentar.");
  }

  const arrayBuffer = await file.arrayBuffer();
  let workbook;
  try {
    workbook = window.XLSX.read(new Uint8Array(arrayBuffer), { type: "array", cellDates: false, dense: true, nodim: true, sheetRows: 10000 });
  } catch (firstError) {
    try {
      workbook = window.XLSX.read(arrayBufferToBinaryString(arrayBuffer), { type: "binary", cellDates: false, dense: true, nodim: true, sheetRows: 10000 });
    } catch {
      throw new Error(`No se pudo leer el XLSX. Probá con CSV para esta plataforma. Detalle: ${firstError.message}`);
    }
  }
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  return window.XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: false });
}

function parseHtmlTableRows(text) {
  const document = new DOMParser().parseFromString(text, "text/html");
  return [...document.querySelectorAll("table tr")]
    .map((row) => [...row.querySelectorAll("th,td")].map((cell) => cell.textContent.trim()))
    .filter((row) => row.some(Boolean));
}

function arrayBufferToBinaryString(arrayBuffer) {
  const bytes = new Uint8Array(arrayBuffer);
  const chunks = [];
  for (let index = 0; index < bytes.length; index += 8192) {
    chunks.push(String.fromCharCode(...bytes.subarray(index, index + 8192)));
  }
  return chunks.join("");
}

function parseDelimitedRows(text) {
  const cleanText = text.replace(/^\uFEFF/, "").replaceAll("\r\n", "\n").replaceAll("\r", "\n").trim();
  if (!cleanText) return [];
  const delimiter = cleanText.split("\n")[0].includes(";") ? ";" : ",";
  return cleanText.split("\n").map((line) => parseDelimitedLine(line, delimiter));
}

function parseDelimitedLine(line, delimiter) {
  const values = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];
    if (char === '"' && inQuotes && next === '"') {
      current += '"';
      index += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === delimiter && !inQuotes) {
      values.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  values.push(current);
  return values.map((value) => value.trim());
}

function parseStandardTransactions(rows, fallbackPlatformId, fileName) {
  if (!rows.length) return [];
  const headers = rows[0].map(normalizeHeader);
  const requiredHeaders = ["fecha_operada", "tipo_movimiento", "monto", "moneda"];
  const missingHeader = requiredHeaders.find((header) => !headers.includes(header));
  if (missingHeader) {
    throw new Error(`El formato estándar no tiene la columna esperada: ${missingHeader}.`);
  }

  return rows
    .slice(1)
    .map((row, index) => mapRowToObject(headers, row, index + 2))
    .filter((row) => Object.values(row).some((value) => String(value ?? "").trim()))
    .map((row) => normalizeStandardTransaction(row, fallbackPlatformId, fileName));
}

function normalizeStandardTransaction(row, fallbackPlatformId, fileName) {
  const rawType = String(row.tipo_movimiento ?? "").trim();
  const kind = mapStandardTransactionKind(rawType);
  const currency = normalizeStandardCurrency(row.moneda);
  const symbol = String(row.ticker ?? "").trim().toUpperCase();
  const quantity = parseLocaleNumber(row.cantidad);
  const price = parseLocaleNumber(row.precio);
  const amount = getSignedStandardAmount(kind, parseLocaleNumber(row.monto));
  const platformId = row.plataforma ? ensurePlatformForName(row.plataforma) : fallbackPlatformId;
  const tradeDate = parseStandardDate(row.fecha_operada);
  const settlementDate = parseStandardDate(row.fecha_liquidacion) || tradeDate;
  const typeId = symbol ? getStandardInstrumentTypeId(row.tipo_instrumento, symbol, kind, currency) : "";
  const instrumentId = symbol ? ensureInstrumentForSymbol(symbol, typeId, currency) : "";
  const reference = String(row.referencia ?? "").trim();
  const sourceKey = [
    "standard",
    platformId,
    reference || row.__rowNumber,
    tradeDate,
    settlementDate,
    kind,
    symbol,
    row.cantidad,
    row.monto,
  ].map((part) => String(part ?? "").trim()).join("|");

  return normalizeTransaction({
    sourceKey,
    sourceAdapter: "standard",
    sourceFile: fileName,
    sourceRow: row.__rowNumber,
    sourceAccount: currency,
    platformId,
    tradeDate,
    settlementDate,
    kind,
    instrumentId,
    typeId,
    symbol,
    quantity,
    price,
    amount,
    currency,
    description: String(row.descripcion ?? "").trim() || `Formato estándar · ${rawType}`,
    rawType,
    rawReference: reference,
    usesNotionalQuantity: (kind === "BUY" || kind === "SELL") && quantity <= 0,
  });
}

function parseBmbTransactions(rows, platformId, fileName) {
  if (!rows.length) return [];
  const headers = rows[0].map(normalizeHeader);
  const requiredHeaders = ["liquida", "operado", "comprobante", "numero", "cantidad", "especie", "precio", "importe", "saldo", "referencia"];
  const missingHeader = requiredHeaders.find((header) => !headers.includes(header));
  if (missingHeader) {
    throw new Error(`El archivo BMB no tiene la columna esperada: ${missingHeader}.`);
  }

  const account = inferBmbAccount(fileName);
  return rows
    .slice(1)
    .map((row, index) => mapRowToObject(headers, row, index + 2))
    .filter((row) => Object.values(row).some((value) => String(value ?? "").trim()))
    .map((row) => normalizeBmbTransaction(row, platformId, fileName, account));
}

function normalizeBmbTransaction(row, platformId, fileName, account) {
  const symbol = String(row.especie ?? "").trim().toUpperCase();
  const rawType = String(row.comprobante ?? "").trim().toUpperCase();
  const kind = mapBmbTransactionKind(rawType);
  const quantity = parseLocaleNumber(row.cantidad);
  const price = parseLocaleNumber(row.precio);
  const amount = parseLocaleNumber(row.importe);
  const hasInstrument = isBmbInstrumentMovement(kind, symbol);
  const inferredTypeId = hasInstrument ? inferInstrumentTypeId(symbol, kind, account.currency) : "";
  const instrumentId = hasInstrument ? ensureInstrumentForSymbol(symbol, inferredTypeId, account.currency) : "";
  const description = [rawType, row.referencia].filter(Boolean).join(" · ");
  const sourceKey = [
    "bmb",
    platformId,
    account.code,
    row.numero,
    rawType,
    row.operado,
    row.liquida,
    symbol,
    row.cantidad,
    row.importe,
  ].map((part) => String(part ?? "").trim()).join("|");

  return normalizeTransaction({
    sourceKey,
    sourceAdapter: "bmb",
    sourceFile: fileName,
    sourceRow: row.__rowNumber,
    sourceAccount: account.code,
    platformId,
    tradeDate: parseBmbDate(row.operado),
    settlementDate: parseBmbDate(row.liquida),
    kind,
    instrumentId,
    typeId: inferredTypeId,
    symbol,
    quantity,
    price,
    amount,
    currency: account.currency,
    description,
    rawType,
    rawReference: row.referencia ?? "",
  });
}

function parseBmbSimpleTransactions(rows, platformId, fileName) {
  if (!rows.length) return [];
  const headers = rows[0].map(normalizeHeader);
  const requiredHeaders = ["ticker", "operacion", "fecha", "monto", "moneda"];
  const missingHeader = requiredHeaders.find((header) => !headers.includes(header));
  if (missingHeader) {
    throw new Error(`El archivo BMB simplificado no tiene la columna esperada: ${missingHeader}.`);
  }

  return rows
    .slice(1)
    .map((row, index) => mapRowToObject(headers, row, index + 2))
    .filter((row) => Object.values(row).some((value) => String(value ?? "").trim()))
    .map((row) => normalizeBmbSimpleTransaction(row, platformId, fileName));
}

function normalizeBmbSimpleTransaction(row, platformId, fileName) {
  const symbol = String(row.ticker ?? "").trim().toUpperCase();
  const rawType = String(row.operacion ?? "").trim().toUpperCase();
  const kind = mapBmbSimpleTransactionKind(rawType);
  const currency = normalizeBmbSimpleCurrency(row.moneda);
  const amount = getSignedBmbSimpleAmount(kind, parseLocaleNumber(row.monto));
  const quantity = parseLocaleNumber(row.cantidad);
  const price = quantity > 0 ? Math.abs(parseLocaleNumber(row.monto)) / quantity : 0;
  const hasInstrument = isBmbInstrumentMovement(kind, symbol);
  const typeId = hasInstrument ? inferInstrumentTypeId(symbol, kind, currency) : "";
  const instrumentId = hasInstrument ? ensureInstrumentForSymbol(symbol, typeId, currency) : "";
  const tradeDate = parseBmbSimpleDate(row.fecha);
  const sourceKey = [
    "bmb-simple",
    platformId,
    tradeDate,
    symbol,
    rawType,
    row.monto,
    row.moneda,
    row.__rowNumber,
  ].map((part) => String(part ?? "").trim()).join("|");

  return normalizeTransaction({
    sourceKey,
    sourceAdapter: "bmb-simple",
    sourceFile: fileName,
    sourceRow: row.__rowNumber,
    sourceAccount: currency === "PESOS" ? "ARS" : "USD",
    platformId,
    tradeDate,
    settlementDate: tradeDate,
    kind,
    instrumentId,
    typeId,
    symbol,
    quantity,
    price,
    amount,
    currency,
    description: `BMB simplificado · ${rawType}`,
    rawType,
    rawReference: `${symbol}-${tradeDate}-${row.__rowNumber}`,
    usesNotionalQuantity: (kind === "BUY" || kind === "SELL") && quantity <= 0,
  });
}

function parseIolTransactions(rows, platformId, fileName) {
  const headerIndex = rows.findIndex((row) => row.map(normalizeHeader).includes("fecha transaccion") && row.map(normalizeHeader).includes("tipo transaccion"));
  if (headerIndex < 0) {
    throw new Error("El archivo IOL no tiene la tabla de operaciones finalizadas esperada.");
  }

  const headers = rows[headerIndex].map(normalizeHeader);
  const requiredHeaders = ["fecha transaccion", "fecha liquidacion", "boleto", "tipo transaccion", "simbolo", "cantidad", "moneda", "precio ponderado", "monto", "total"];
  const missingHeader = requiredHeaders.find((header) => !headers.includes(header));
  if (missingHeader) {
    throw new Error(`El archivo IOL no tiene la columna esperada: ${missingHeader}.`);
  }

  return rows
    .slice(headerIndex + 1)
    .map((row, index) => mapRowToObject(headers, row, headerIndex + index + 2))
    .filter((row) => Object.values(row).some((value) => String(value ?? "").trim()))
    .map((row) => normalizeIolTransaction(row, platformId, fileName));
}

function normalizeIolTransaction(row, platformId, fileName) {
  const symbol = String(row.simbolo ?? "").trim().toUpperCase();
  const rawType = String(row["tipo transaccion"] ?? "").trim();
  const kind = mapIolTransactionKind(rawType);
  const currency = normalizeIolCurrency(row.moneda);
  const quantity = parseLocaleNumber(row.cantidad);
  const price = parseLocaleNumber(row["precio ponderado"]);
  const grossAmount = parseLocaleNumber(row.monto);
  const total = parseLocaleNumber(row.total);
  const signedAmount = getSignedIolAmount(kind, total || grossAmount);
  const typeId = symbol ? inferIolInstrumentTypeId(symbol, rawType, currency) : "";
  const instrumentId = symbol ? ensureInstrumentForSymbol(symbol, typeId, currency) : "";
  const sourceKey = [
    "iol",
    platformId,
    row.boleto,
    rawType,
    row["fecha transaccion"],
    row["fecha liquidacion"],
    symbol,
    row.cantidad,
    row.total,
  ].map((part) => String(part ?? "").trim()).join("|");

  return normalizeTransaction({
    sourceKey,
    sourceAdapter: "iol",
    sourceFile: fileName,
    sourceRow: row.__rowNumber,
    sourceAccount: String(row["numero de cuenta"] ?? ""),
    platformId,
    tradeDate: parseIolDate(row["fecha transaccion"]),
    settlementDate: parseIolDate(row["fecha liquidacion"]),
    kind,
    instrumentId,
    typeId,
    symbol,
    quantity,
    price,
    amount: signedAmount,
    currency,
    description: [rawType, row.descripcion].filter(Boolean).join(" · "),
    rawType,
    rawReference: String(row.boleto ?? ""),
  });
}

function mapIolTransactionKind(rawType) {
  const normalized = normalizeHeader(rawType);
  if (normalized.includes("compra") || normalized.includes("suscripcion")) return "BUY";
  if (normalized.includes("venta") || normalized.includes("rescate")) return "SELL";
  if (normalized.includes("divid")) return "DIVIDEND";
  if (normalized.includes("renta") || normalized.includes("amort")) return "INCOME";
  return "ADJUSTMENT";
}

function normalizeIolCurrency(value) {
  const currency = String(value ?? "").toUpperCase().replaceAll(" ", "");
  if (currency.includes("AR")) return "PESOS";
  if (currency.includes("US")) return "DOLARES";
  return value || "";
}

function getSignedIolAmount(kind, amount) {
  if (kind === "BUY") return -Math.abs(amount);
  if (kind === "SELL" || kind === "DIVIDEND" || kind === "INCOME") return Math.abs(amount);
  return amount;
}

function inferIolInstrumentTypeId(symbol, rawType, currency) {
  if (normalizeHeader(rawType).includes("fci")) return ensureInstrumentType("FCI", "Fondos comunes de inversión", currency);
  return inferInstrumentTypeId(symbol, mapIolTransactionKind(rawType), currency);
}

function parseIolDividendTransactions(rows, platformId, fileName) {
  if (!rows.length) return [];
  const headers = rows[0].map(normalizeHeader);
  const requiredHeaders = ["fecha orden", "tipo", "simbolo", "fecha operada", "monto operado"];
  const missingHeader = requiredHeaders.find((header) => !headers.includes(header));
  if (missingHeader) {
    throw new Error(`El archivo de dividendos IOL no tiene la columna esperada: ${missingHeader}.`);
  }

  return rows
    .slice(1)
    .map((row, index) => mapRowToObject(headers, row, index + 2))
    .filter((row) => Object.values(row).some((value) => String(value ?? "").trim()))
    .map((row) => normalizeIolDividendTransaction(row, platformId, fileName));
}

function normalizeIolDividendTransaction(row, platformId, fileName) {
  const symbol = String(row.simbolo ?? "").trim().toUpperCase();
  const typeId = symbol ? inferInstrumentTypeId(symbol, "DIVIDEND", "DOLARES") : "";
  const instrumentId = symbol ? ensureInstrumentForSymbol(symbol, typeId, "DOLARES") : "";
  const transactionNumber = row["nº de trans."] ?? row["nro de trans."] ?? row["no de trans."] ?? "";
  const amount = parseLocaleNumber(row["monto operado"]);
  const tradeDate = parseIolDate(row["fecha operada"] || row["fecha orden"]);
  const sourceKey = [
    "iol-dividends",
    platformId,
    transactionNumber,
    tradeDate,
    symbol,
    row["monto operado"],
  ].map((part) => String(part ?? "").trim()).join("|");

  return normalizeTransaction({
    sourceKey,
    sourceAdapter: "iol-dividends",
    sourceFile: fileName,
    sourceRow: row.__rowNumber,
    platformId,
    tradeDate,
    settlementDate: tradeDate,
    kind: "DIVIDEND",
    instrumentId,
    typeId,
    symbol,
    quantity: 0,
    price: 0,
    amount,
    currency: "DOLARES",
    description: "Dividendo IOL",
    rawType: row.tipo === "D" ? "Dividendo" : String(row.tipo ?? ""),
    rawReference: String(transactionNumber ?? ""),
  });
}

function mergeTransactions(transactions) {
  let created = 0;
  let updated = 0;
  const bySourceKey = new Map(state.transactions.map((transaction) => [transaction.sourceKey, transaction]));

  transactions.forEach((transaction) => {
    const existing = bySourceKey.get(transaction.sourceKey);
    if (existing) {
      Object.assign(existing, { ...transaction, id: existing.id });
      updated += 1;
    } else {
      state.transactions.push(transaction);
      bySourceKey.set(transaction.sourceKey, transaction);
      created += 1;
    }
  });

  return { created, updated };
}

function mapRowToObject(headers, row, rowNumber) {
  return headers.reduce(
    (object, header, index) => ({
      ...object,
      [header]: row[index] ?? "",
    }),
    { __rowNumber: rowNumber },
  );
}

function normalizeHeader(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function inferBmbAccount(fileName) {
  const upperName = fileName.toUpperCase();
  if (upperName.includes("DOLARES CABLE")) return { code: "USD_CABLE", currency: "DOLARES CABLE" };
  if (upperName.includes("DOLARES")) return { code: "USD_MEP", currency: "DOLARES" };
  if (upperName.includes("PESOS")) return { code: "ARS", currency: "PESOS" };
  return { code: "UNKNOWN", currency: "" };
}

function mapBmbTransactionKind(rawType) {
  if (rawType.includes("COMPRA CAUCION") || rawType.includes("CPRA CAUC")) return "CAUCION_OPEN";
  if (rawType.includes("VENTA CAUCION") || rawType.includes("VTA CAUC")) return "CAUCION_CLOSE";
  if (rawType.includes("COMPRA") || rawType.includes("LICITACION")) return "BUY";
  if (rawType.includes("VENTA")) return "SELL";
  if (rawType.includes("DIVID")) return "DIVIDEND";
  if (rawType.includes("RENTA") || rawType.includes("AMORTIZ")) return "INCOME";
  if (rawType.includes("RETENCION")) return "TAX";
  if (rawType.includes("ARANCEL") || rawType.includes("GASTOS")) return "FEE";
  if (rawType.includes("RECIBO") || rawType.includes("NOTA DE CREDITO")) return "DEPOSIT";
  if (rawType.includes("ORDEN DE PAGO") || rawType.includes("ORD PAGO") || rawType.includes("NOTA DE DEBIT")) return "WITHDRAWAL";
  return "ADJUSTMENT";
}

function mapStandardTransactionKind(rawType) {
  const normalized = normalizeHeader(rawType);
  if (normalized === "buy" || normalized.includes("compra") || normalized.includes("suscripcion")) return "BUY";
  if (normalized === "sell" || normalized.includes("venta") || normalized.includes("rescate")) return "SELL";
  if (normalized.includes("divid")) return "DIVIDEND";
  if (normalized.includes("renta") || normalized.includes("amort")) return "INCOME";
  if (normalized.includes("deposit") || normalized.includes("ingreso")) return "DEPOSIT";
  if (normalized.includes("withdraw") || normalized.includes("retiro")) return "WITHDRAWAL";
  if (normalized.includes("impuesto") || normalized.includes("retencion") || normalized.includes("tax")) return "TAX";
  if (normalized.includes("gasto") || normalized.includes("fee") || normalized.includes("arancel")) return "FEE";
  if (normalized.includes("transfer")) return "TRANSFER";
  if (normalized.includes("caucion") && normalized.includes("apertura")) return "CAUCION_OPEN";
  if (normalized.includes("caucion") && normalized.includes("cierre")) return "CAUCION_CLOSE";
  return "ADJUSTMENT";
}

function mapBmbSimpleTransactionKind(rawType) {
  const normalized = normalizeHeader(rawType);
  if (normalized.includes("compra")) return "BUY";
  if (normalized.includes("venta")) return "SELL";
  if (normalized.includes("dividend")) return "DIVIDEND";
  if (normalized.includes("renta") || normalized.includes("amortizacion")) return "INCOME";
  return mapBmbTransactionKind(rawType);
}

function normalizeStandardCurrency(value) {
  const currency = normalizeHeader(value).replaceAll(" ", "");
  if (currency.includes("peso") || currency === "ars") return "PESOS";
  if (currency.includes("dolar") || currency.includes("usd")) return "DOLARES";
  return String(value ?? "").trim().toUpperCase();
}

function normalizeBmbSimpleCurrency(value) {
  const currency = normalizeHeader(value);
  if (currency.includes("peso")) return "PESOS";
  if (currency.includes("dolar") || currency.includes("usd")) return "DOLARES";
  return String(value ?? "").trim();
}

function getSignedStandardAmount(kind, amount) {
  if (kind === "BUY" || kind === "WITHDRAWAL" || kind === "FEE" || kind === "TAX") return -Math.abs(amount);
  if (kind === "SELL" || kind === "DIVIDEND" || kind === "INCOME" || kind === "DEPOSIT") return Math.abs(amount);
  return amount;
}

function getSignedBmbSimpleAmount(kind, amount) {
  if (kind === "BUY") return -Math.abs(amount);
  if (kind === "SELL" || kind === "DIVIDEND" || kind === "INCOME") return Math.abs(amount);
  return amount;
}

function getStandardInstrumentTypeId(typeName, symbol, kind, currency) {
  const normalizedType = String(typeName ?? "").trim();
  if (normalizedType) return ensureInstrumentType(normalizedType.toUpperCase(), `Creado desde formato estándar: ${normalizedType}`, currency);
  return inferInstrumentTypeId(symbol, kind, currency);
}

function isForcedEtfSymbol(symbol) {
  return ["QQQ", "SPY", "EFA", "BRKB"].includes(String(symbol ?? "").trim().toUpperCase());
}

function isBmbInstrumentMovement(kind, symbol) {
  return Boolean(symbol) && !["VARIAS", "MEP"].includes(symbol) && ["BUY", "SELL", "DIVIDEND", "INCOME"].includes(kind);
}

function inferInstrumentTypeId(symbol, kind, currency) {
  const upperSymbol = symbol.toUpperCase();
  if (/^(AL\d+|GD\d+|SBC|S\d|T\d)/.test(upperSymbol)) return ensureInstrumentType("BONO", "Bonos y obligaciones negociables", currency);
  if (isForcedEtfSymbol(upperSymbol)) return ensureInstrumentType("ETF", "Fondos cotizados", currency);
  if (kind === "CAUCION_OPEN" || kind === "CAUCION_CLOSE") return ensureInstrumentType("CAUCION", "Cauciones bursátiles", currency);
  return ensureInstrumentType("ACCION", "Acciones y CEDEARs", currency);
}

function ensureInstrumentType(name, description, currency) {
  const existing = state.instrumentTypes.find((type) => type.name.toUpperCase() === name.toUpperCase());
  if (existing) return existing.id;
  const type = normalizeColoredEntity({
    id: makeStableId("type", name),
    name,
    description,
    currency: currency || "DOLARES",
    quote: 1,
  });
  state.instrumentTypes.push(type);
  return type.id;
}

function ensurePlatformForName(name) {
  const normalizedName = String(name ?? "").trim();
  if (!normalizedName) return state.platforms[0]?.id ?? "";
  const existing = state.platforms.find((platform) => normalizeHeader(platform.name) === normalizeHeader(normalizedName));
  if (existing) return existing.id;
  const platform = normalizeColoredEntity({
    id: makeStableId("plat", normalizedName),
    name: normalizedName,
    description: "Creada desde importación de transacciones",
  });
  state.platforms.push(platform);
  return platform.id;
}

function ensureInstrumentForSymbol(symbol, typeId, currency) {
  const existing = state.instruments.find((instrument) => instrument.name.toUpperCase() === symbol.toUpperCase());
  if (existing) return existing.id;
  const instrument = normalizeInstrument({
    id: makeStableId("inst", symbol),
    name: symbol,
    description: "Creado desde importación de transacciones",
    currency: currency || "DOLARES",
    quote: 1,
    defaultTypeId: typeId,
  });
  state.instruments.push(instrument);
  return instrument.id;
}

function makeStableId(prefix, value) {
  const base = String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "") || crypto.randomUUID();
  let id = `${prefix}-${base}`;
  let suffix = 2;
  const collections = [...state.platforms, ...state.instrumentTypes, ...state.instruments, ...state.funds];
  while (collections.some((item) => item.id === id)) {
    id = `${prefix}-${base}-${suffix}`;
    suffix += 1;
  }
  return id;
}

function openTransactionDialog(id = "") {
  const transaction = id ? state.transactions.find((item) => item.id === id) : null;
  if (id && !transaction) return;
  document.getElementById("transactionDialogTitle").textContent = transaction ? "Editar transacción" : "Nueva transacción";
  document.getElementById("transactionIdInput").value = transaction?.id ?? "";
  document.getElementById("transactionTradeDateInput").value = transaction?.tradeDate ?? todayIsoDate();
  document.getElementById("transactionSettlementDateInput").value = transaction?.settlementDate ?? "";
  fillSelect("transactionEditPlatformInput", state.platforms, transaction?.platformId ?? state.platforms[0]?.id);
  fillTransactionInstrumentSelect(transaction?.instrumentId ?? "");
  fillSelect("transactionInstrumentTypeInput", state.instrumentTypes, transaction?.typeId ?? state.instrumentTypes[0]?.id);
  document.getElementById("transactionKindInput").value = transaction?.kind ?? "BUY";
  document.getElementById("transactionQuantityInput").value = transaction?.quantity ?? "";
  document.getElementById("transactionPriceInput").value = transaction?.price ?? "";
  document.getElementById("transactionAmountInput").value = transaction?.amount ?? "";
  document.getElementById("transactionCurrencyInput").value = transaction?.currency ?? "DOLARES";
  document.getElementById("transactionDescriptionInput").value = transaction?.description ?? "";
  document.getElementById("transactionDialog").showModal();
}

function fillTransactionInstrumentSelect(selectedValue) {
  const select = document.getElementById("transactionInstrumentInput");
  select.innerHTML = `<option value="">Caja / sin instrumento</option>${state.instruments.map((instrument) => `<option value="${instrument.id}">${escapeHtml(instrument.name)}</option>`).join("")}`;
  select.value = selectedValue ?? "";
}

function saveTransaction() {
  const id = document.getElementById("transactionIdInput").value;
  const existingTransaction = id ? state.transactions.find((transaction) => transaction.id === id) : null;
  const payload = normalizeTransaction({
    ...(existingTransaction ?? {}),
    id: id || crypto.randomUUID(),
    sourceKey: existingTransaction?.sourceKey || `manual|${crypto.randomUUID()}`,
    sourceAdapter: existingTransaction?.sourceAdapter || "manual",
    sourceFile: existingTransaction?.sourceFile || "",
    platformId: document.getElementById("transactionEditPlatformInput").value,
    tradeDate: document.getElementById("transactionTradeDateInput").value,
    settlementDate: document.getElementById("transactionSettlementDateInput").value,
    kind: document.getElementById("transactionKindInput").value,
    instrumentId: document.getElementById("transactionInstrumentInput").value,
    typeId: document.getElementById("transactionInstrumentTypeInput").value,
    quantity: toNumber(document.getElementById("transactionQuantityInput").value, 0),
    price: toNumber(document.getElementById("transactionPriceInput").value, 0),
    amount: toNumber(document.getElementById("transactionAmountInput").value, 0),
    currency: document.getElementById("transactionCurrencyInput").value.trim(),
    description: document.getElementById("transactionDescriptionInput").value.trim(),
  });

  if (id) {
    state.transactions = state.transactions.map((transaction) => (transaction.id === id ? payload : transaction));
  } else {
    state.transactions.push(payload);
  }
  saveState();
  document.getElementById("transactionDialog").close();
  render();
}

function deleteTransaction(id) {
  const confirmed = confirm("¿Eliminar esta transacción?");
  if (!confirmed) return;
  state.transactions = state.transactions.filter((transaction) => transaction.id !== id);
  saveState();
  render();
}

function clearTransactions() {
  const confirmed = confirm("¿Eliminar todas las transacciones importadas?");
  if (!confirmed) return;
  state.transactions = [];
  saveState();
  render();
  document.getElementById("transactionImportStatus").textContent = "Transacciones eliminadas. Podés volver a importar desde cero.";
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

function getFilteredHoldingSlices(ignoredFilterKey = "") {
  return getHoldingSlices().filter((slice) => sliceMatchesDashboardFilters(slice, ignoredFilterKey));
}

function getHoldingSlices() {
  return state.holdings.flatMap((holding) => {
    const currentValue = getHoldingUsdValue(holding);
    const pendingValue = getHoldingPendingUsdValue(holding);
    const allocations = holding.allocations ?? [];
    const slices = allocations
      .filter((allocation) => allocation.fundId && allocation.percent > 0)
      .map((allocation) => makeHoldingSlice(holding, allocation.fundId, currentValue, pendingValue, allocation.percent / 100));
    const allocatedPercent = allocations.reduce((sum, allocation) => sum + toNumber(allocation.percent, 0), 0);

    if (!slices.length || allocatedPercent < 100) {
      const share = slices.length ? (100 - allocatedPercent) / 100 : 1;
      if (share > 0) {
        slices.push(makeHoldingSlice(holding, noFundFilterId, currentValue, pendingValue, share));
      }
    }

    return slices;
  });
}

function makeHoldingSlice(holding, fundId, currentValue, pendingValue, share) {
  const current = currentValue * share;
  const pending = pendingValue * share;
  return {
    holding,
    fundId,
    current,
    pending,
    value: current + pending,
  };
}

function sliceMatchesDashboardFilters(slice, ignoredFilterKey = "") {
  return (
    filterSetMatches("fundIds", slice.fundId, ignoredFilterKey) &&
    filterSetMatches("instrumentIds", slice.holding.instrumentId, ignoredFilterKey) &&
    filterSetMatches("platformIds", slice.holding.platformId, ignoredFilterKey) &&
    filterSetMatches("typeIds", slice.holding.typeId, ignoredFilterKey)
  );
}

function filterSetMatches(filterKey, value, ignoredFilterKey) {
  if (filterKey === ignoredFilterKey) return true;
  const selectedValues = dashboardFilters[filterKey];
  return !selectedValues.size || selectedValues.has(value);
}

function aggregateBy(collectionName, holdingKey, ignoredFilterKey = "") {
  const activeIds = dashboardFilters[ignoredFilterKey] ?? new Set();
  const totals = new Map(
    state[collectionName].map((item) => [
      item.id,
      { id: item.id, label: item.name, current: 0, pending: 0, value: 0, color: item.color || "", isActive: activeIds.has(item.id), isDimmed: activeIds.size > 0 && !activeIds.has(item.id) },
    ]),
  );
  getFilteredHoldingSlices(ignoredFilterKey).forEach((slice) => {
    const bucket = totals.get(slice.holding[holdingKey]);
    if (!bucket) return;
    bucket.current += slice.current;
    bucket.pending += slice.pending;
    bucket.value = bucket.current + bucket.pending;
  });
  return normalizeSeries([...totals.values()]);
}

function aggregateByFund(ignoredFilterKey = "") {
  const activeIds = dashboardFilters[ignoredFilterKey] ?? new Set();
  const { fundTotals, noFund } = calculateFundTotals(ignoredFilterKey);
  const series = state.funds.map((fund) => ({
    id: fund.id,
    label: fund.name,
    current: fundTotals.get(fund.id)?.current ?? 0,
    pending: fundTotals.get(fund.id)?.pending ?? 0,
    value: fundTotals.get(fund.id)?.value ?? 0,
    color: fund.color || "",
    isActive: activeIds.has(fund.id),
    isDimmed: activeIds.size > 0 && !activeIds.has(fund.id),
  }));
  if (noFund.value > 0) {
    series.push({
      id: noFundFilterId,
      label: "Sin Fondo",
      ...noFund,
      color: "",
      isActive: activeIds.has(noFundFilterId),
      isDimmed: activeIds.size > 0 && !activeIds.has(noFundFilterId),
    });
  }
  return normalizeSeries(series);
}

function calculateFundTotals(ignoredFilterKey = "") {
  const fundTotals = new Map(state.funds.map((fund) => [fund.id, { current: 0, pending: 0, value: 0 }]));
  const noFund = { current: 0, pending: 0, value: 0 };

  getFilteredHoldingSlices(ignoredFilterKey).forEach((slice) => {
    const target = slice.fundId === noFundFilterId ? noFund : fundTotals.get(slice.fundId);
    if (!target) return;
    addSplitValue(target, slice.current, slice.pending, 1);
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
      id: item.id ?? "",
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

function getInteractiveColor(color, item) {
  return item.isDimmed ? lightenColor(color, 0.68) : color;
}

function createPieChart(canvasId, series, filterKey) {
  const ctx = document.getElementById(canvasId);
  const total = series.reduce((sum, item) => sum + item.value, 0);
  const seriesColors = getSeriesColors(series);
  const pieItems = series.flatMap((item, index) => {
    const baseColor = seriesColors[index];
    const items = [];
    if (item.current > 0) {
      items.push({ id: item.id, label: item.label, kind: "Tenencia", value: item.current, color: getInteractiveColor(baseColor, item), legendIndex: index });
    }
    if (item.pending > 0) {
      items.push({ id: item.id, label: item.label, kind: "Pendiente por cobrar", value: item.pending, color: getInteractiveColor(lightenColor(baseColor, 0.58), item), legendIndex: index });
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
            filterIds: pieItems.map((item) => item.id),
            borderColor: "#ffffff",
            borderWidth: pieItems.map((item) => (dashboardFilters[filterKey].has(item.id) ? 5 : 3)),
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
                    fillStyle: getInteractiveColor(seriesColors[index], item),
                    strokeStyle: dashboardFilters[filterKey].has(item.id) ? "#17201d" : getInteractiveColor(seriesColors[index], item),
                    lineWidth: dashboardFilters[filterKey].has(item.id) ? 2 : 0,
                    index,
                  };
                });
              },
            },
            onClick(_event, legendItem) {
              toggleDashboardFilter(filterKey, series[legendItem.index]?.id);
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
        onClick(_event, elements, chart) {
          const element = elements[0];
          if (!element) return;
          const id = chart.data.datasets[element.datasetIndex].filterIds[element.index];
          toggleDashboardFilter(filterKey, id);
        },
        onHover(event, elements) {
          event.native.target.style.cursor = elements.length ? "pointer" : "default";
        },
      },
    }),
  );
}

function createBarChart(canvasId, series, filterKey) {
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
            backgroundColor: series.map((item, index) => getInteractiveColor(seriesColors[index], item)),
            borderColor: series.map((item) => (dashboardFilters[filterKey].has(item.id) ? "#17201d" : "transparent")),
            borderWidth: series.map((item) => (dashboardFilters[filterKey].has(item.id) ? 2 : 0)),
            filterIds: series.map((item) => item.id),
            borderRadius: 6,
            maxBarThickness: 54,
          },
          {
            label: "Pendiente por cobrar",
            data: series.map((item) => item.pending),
            backgroundColor: series.map((item, index) => getInteractiveColor(pendingColors[index], item)),
            borderColor: series.map((item) => (dashboardFilters[filterKey].has(item.id) ? "#17201d" : "transparent")),
            borderWidth: series.map((item) => (dashboardFilters[filterKey].has(item.id) ? 2 : 0)),
            filterIds: series.map((item) => item.id),
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
            onClick() {},
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
        onClick(_event, elements, chart) {
          const element = elements[0];
          if (!element) return;
          const id = chart.data.datasets[element.datasetIndex].filterIds[element.index];
          toggleDashboardFilter(filterKey, id);
        },
        onHover(event, elements) {
          event.native.target.style.cursor = elements.length ? "pointer" : "default";
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

function calculateInstrumentPerformance() {
  const byInstrument = new Map();

  [...state.transactions]
    .filter((transaction) => transaction.instrumentId)
    .sort(compareTransactionsByDate)
    .forEach((transaction) => {
    if (!transaction.instrumentId) return;
    const rowKey = `${transaction.platformId}|${transaction.instrumentId}`;
    if (!byInstrument.has(rowKey)) {
      const instrument = findById("instruments", transaction.instrumentId);
      const platform = findById("platforms", transaction.platformId);
      byInstrument.set(rowKey, {
        instrumentId: transaction.instrumentId,
        platformId: transaction.platformId,
        instrumentName: instrument?.name ?? transaction.symbol ?? "Instrumento",
        platformName: platform?.name ?? "Sin plataforma",
        proceeds: 0,
        income: 0,
        expenses: 0,
        realizedResult: 0,
        netQuantity: 0,
        lots: [],
        capitalDays: 0,
      });
    }

    const row = byInstrument.get(rowKey);
    const amountUsd = convertTransactionAmountToComparableUsd(transaction);
    if (transaction.kind === "BUY") {
      addPerformanceLot(row, transaction, amountUsd);
    } else if (transaction.kind === "SELL") {
      consumePerformanceLots(row, transaction, amountUsd);
    } else if (transaction.kind === "DIVIDEND" || transaction.kind === "INCOME") {
      row.income += amountUsd;
    } else if (transaction.kind === "FEE" || transaction.kind === "TAX") {
      row.expenses += amountUsd;
    }
  });

  return [...byInstrument.values()]
    .map((row) => {
      const currentValue = getCurrentHoldingValueForInstrument(row.instrumentId, row.platformId);
      const openLotMetrics = calculateOpenLotMetrics(row.lots, currentValue);
      const totalResult = row.realizedResult + openLotMetrics.unrealizedResult + row.income + row.expenses;
      const totalCapitalDays = row.capitalDays + openLotMetrics.capitalDays;
      const annualizedReturn = totalCapitalDays > 0 ? totalResult / (totalCapitalDays / 365) : 0;
      return {
        ...row,
        ...openLotMetrics,
        currentValue,
        totalResult,
        totalCapitalDays,
        annualizedReturn,
      };
    })
    .sort((a, b) => Math.abs(b.totalResult) - Math.abs(a.totalResult));
}

function calculateReturnLotCharts() {
  const byPosition = new Map();

  [...state.transactions]
    .filter((transaction) => transaction.instrumentId)
    .sort(compareTransactionsByDate)
    .forEach((transaction) => {
      const row = getReturnPositionRow(byPosition, transaction);
      const amountUsd = convertTransactionAmountToComparableUsd(transaction);
      if (transaction.kind === "BUY") {
        addReturnLot(row, transaction, amountUsd);
      } else if (transaction.kind === "SELL") {
        consumeReturnLots(row, transaction);
      } else if (transaction.kind === "DIVIDEND" || transaction.kind === "INCOME") {
        allocateReturnDividend(row, transaction, amountUsd);
      }
    });

  const today = todayIsoDate();
  const byInstrument = new Map();

  [...byPosition.values()].forEach((row) => {
    const openLots = row.lots.filter((lot) => lot.remainingQuantity > 0.00000001 && lot.remainingCost > 0);
    const totalOpenQuantity = openLots.reduce((sum, lot) => sum + lot.remainingQuantity, 0);
    const currentValue = getCurrentHoldingMarketValueForInstrument(row.instrumentId, row.platformId);

    openLots.forEach((lot) => {
      const valueShare = lot.remainingQuantity / totalOpenQuantity;
      const lotCurrentValue = currentValue * valueShare;
      const returnAmount = lotCurrentValue + lot.dividends - lot.remainingCost;
      const returnPercent = lot.remainingCost > 0 ? returnAmount / lot.remainingCost : 0;
      const xirr = calculateXirr([
        { date: lot.date, amount: -lot.remainingCost },
        ...lot.dividendCashflows,
        { date: today, amount: lotCurrentValue },
      ]);
      const group = getReturnInstrumentGroup(byInstrument, row);
      group.lots.push({
        ...lot,
        platformId: row.platformId,
        platformName: row.platformName,
        typeId: row.typeId,
        currentValue: lotCurrentValue,
        purchasePrice: lot.originalQuantity > 0 ? lot.originalCost / lot.originalQuantity : 0,
        currentPrice: lot.remainingQuantity > 0 ? lotCurrentValue / lot.remainingQuantity : 0,
        returnAmount,
        returnPercent,
        xirr,
      });
    });

    aggregateReturnSales(row.sales).forEach((sale) => {
      const returnAmount = sale.proceeds + sale.dividends - sale.cost;
      const returnPercent = sale.cost > 0 ? returnAmount / sale.cost : 0;
      const xirr = calculateXirr([
        { date: sale.buyDate, amount: -sale.cost },
        ...sale.dividendCashflows,
        { date: sale.date, amount: sale.proceeds },
      ]);
      const group = getReturnInstrumentGroup(byInstrument, row);
      group.lots.push({
        ...sale,
        id: sale.id,
        kind: "sale",
        platformId: row.platformId,
        platformName: row.platformName,
        typeId: row.typeId,
        remainingCost: 0,
        remainingQuantity: 0,
        currentValue: 0,
        returnAmount,
        returnPercent,
        xirr,
      });
    });
  });

  return [...byInstrument.values()]
    .map((group) => {
      group.lots.sort((a, b) => compareReturnEventsByDate(a, b));
      group.platformSummary = [...new Set(group.lots.map((lot) => lot.platformName))].join(", ");
      const totalCost = group.lots.reduce((sum, lot) => sum + getReturnEventCost(lot), 0);
      const totalCurrent = group.lots.reduce((sum, lot) => sum + lot.currentValue + toNumber(lot.proceeds, 0), 0);
      const totalDividends = group.lots.reduce((sum, lot) => sum + lot.dividends, 0);
      group.totalReturnPercent = totalCost > 0 ? (totalCurrent + totalDividends - totalCost) / totalCost : 0;
      group.globalXirr = calculateXirr(getReturnGroupCashflows(group.lots));
      group.openEventCount = group.lots.filter((lot) => lot.kind !== "sale").length;
      group.saleEventCount = group.lots.filter((lot) => lot.kind === "sale").length;
      group.typeIds = getReturnGroupTypeIds(group);
      group.typePriority = getReturnGroupTypePriority(group);
      group.incomeLabel = group.typePriority === 2 ? "Renta / amortización" : "Dividendos";
      group.unitBase = group.typePriority === 2 ? 100 : 1;
      group.platformTransactionSummary = getReturnGroupPlatformTransactionSummary(group);
      group.totalPurchases = totalCost;
      group.totalSales = group.lots.reduce((sum, lot) => sum + toNumber(lot.proceeds, 0), 0);
      group.currentValue = group.lots.reduce((sum, lot) => sum + toNumber(lot.currentValue, 0), 0);
      group.totalDividends = totalDividends;
      group.netPurchases = group.totalPurchases - group.totalSales;
      group.netGain = group.totalSales + group.currentValue + group.totalDividends - group.totalPurchases;
      return group;
    })
    .filter((group) => group.lots.length)
    .sort(compareReturnGroups);
}

function getReturnPositionRow(byPosition, transaction) {
  const key = `${transaction.platformId}|${transaction.instrumentId}`;
  if (!byPosition.has(key)) {
    const instrument = findById("instruments", transaction.instrumentId);
    const platform = findById("platforms", transaction.platformId);
    byPosition.set(key, {
      instrumentId: transaction.instrumentId,
      platformId: transaction.platformId,
      typeId: transaction.typeId,
      instrumentName: instrument?.name ?? transaction.symbol ?? "Instrumento",
      platformName: platform?.name ?? "Sin plataforma",
      lots: [],
      sales: [],
    });
  }
  return byPosition.get(key);
}

function getReturnInstrumentGroup(byInstrument, row) {
  if (!byInstrument.has(row.instrumentId)) {
    byInstrument.set(row.instrumentId, {
      instrumentId: row.instrumentId,
      instrumentName: row.instrumentName,
      platformSummary: "",
      totalReturnPercent: 0,
      typeIds: [],
      incomeLabel: "Dividendos",
      lots: [],
    });
  }
  return byInstrument.get(row.instrumentId);
}

function addReturnLot(row, transaction, amountUsd) {
  const quantity = getPerformanceQuantity(transaction, amountUsd);
  const cost = Math.abs(amountUsd);
  if (quantity <= 0 || cost <= 0) return;
  row.lots.push({
    id: transaction.id,
    date: transaction.tradeDate || transaction.settlementDate || todayIsoDate(),
    quantity,
    originalQuantity: quantity,
    remainingQuantity: quantity,
    cost,
    originalCost: cost,
    remainingCost: cost,
    realizedProceeds: 0,
    realizedCost: 0,
    usesNotionalQuantity: Boolean(transaction.usesNotionalQuantity),
    dividends: 0,
    dividendCashflows: [],
  });
}

function consumeReturnLots(row, transaction) {
  const amountUsd = convertTransactionAmountToComparableUsd(transaction);
  let quantityToSell = getPerformanceQuantity(transaction, amountUsd);
  if (quantityToSell <= 0) return;

  const availableQuantity = row.lots.reduce((sum, lot) => sum + Math.max(0, lot.remainingQuantity), 0);
  const originalQuantity = Math.min(quantityToSell, availableQuantity) || quantityToSell;
  const sellDate = transaction.tradeDate || transaction.settlementDate || todayIsoDate();
  row.lots.sort(compareLotsByDate);
  row.lots.forEach((lot) => {
    if (quantityToSell <= 0 || lot.remainingQuantity <= 0) return;
    const soldQuantity = Math.min(quantityToSell, lot.remainingQuantity);
    const quantityShare = soldQuantity / lot.remainingQuantity;
    const costPortion = lot.remainingCost * quantityShare;
    const dividendPortion = lot.dividends * quantityShare;
    const dividendCashflows = lot.dividendCashflows.map((flow) => ({
      ...flow,
      amount: flow.amount * quantityShare,
    }));
    const proceedsPortion = Math.abs(amountUsd) * (soldQuantity / originalQuantity);
    const remainingShare = 1 - quantityShare;
    lot.realizedProceeds += proceedsPortion;
    lot.realizedCost += costPortion;
    lot.remainingQuantity -= soldQuantity;
    lot.remainingCost -= costPortion;
    lot.dividends *= remainingShare;
    lot.dividendCashflows = lot.dividendCashflows.map((flow) => ({
      ...flow,
      amount: flow.amount * remainingShare,
    }));
    row.sales.push({
      id: `${transaction.id}-${lot.id}`,
      transactionId: transaction.id,
      date: sellDate,
      buyDate: lot.date,
      quantity: soldQuantity,
      cost: costPortion,
      proceeds: proceedsPortion,
      purchasePrice: lot.originalQuantity > 0 ? lot.originalCost / lot.originalQuantity : costPortion / soldQuantity,
      salePrice: soldQuantity > 0 ? proceedsPortion / soldQuantity : 0,
      dividends: dividendPortion,
      dividendCashflows,
      usesNotionalQuantity: Boolean(transaction.usesNotionalQuantity || lot.usesNotionalQuantity),
      rawType: transaction.rawType,
    });
    quantityToSell -= soldQuantity;
  });

  row.lots = row.lots.filter((lot) => lot.remainingQuantity > 0.00000001);
}

function allocateReturnDividend(row, transaction, amountUsd) {
  const dividend = Math.max(0, amountUsd);
  if (dividend <= 0) return;
  const dividendDate = transaction.tradeDate || transaction.settlementDate || todayIsoDate();
  const eligibleLots = row.lots.filter((lot) => lot.remainingQuantity > 0.00000001 && compareLotsByDate(lot, { date: dividendDate }) <= 0);
  const eligibleQuantity = eligibleLots.reduce((sum, lot) => sum + lot.remainingQuantity, 0);
  if (eligibleQuantity <= 0) return;

  eligibleLots.forEach((lot) => {
    const dividendShare = dividend * (lot.remainingQuantity / eligibleQuantity);
    lot.dividends += dividendShare;
    lot.dividendCashflows.push({ date: dividendDate, amount: dividendShare });
  });
}

function aggregateReturnSales(sales) {
  const byId = new Map();
  sales.forEach((sale) => {
    const existing = byId.get(sale.transactionId);
    if (!existing) {
      byId.set(sale.transactionId, {
        ...sale,
        id: sale.transactionId,
        buyDate: sale.buyDate,
        lotCount: 1,
        dividendCashflows: [...sale.dividendCashflows],
      });
      return;
    }

    existing.quantity += sale.quantity;
    existing.cost += sale.cost;
    existing.proceeds += sale.proceeds;
    existing.dividends += sale.dividends;
    existing.lotCount += 1;
    existing.buyDate = existing.buyDate < sale.buyDate ? existing.buyDate : sale.buyDate;
    existing.purchasePrice = existing.quantity > 0 ? existing.cost / existing.quantity : 0;
    existing.salePrice = existing.quantity > 0 ? existing.proceeds / existing.quantity : 0;
    existing.dividendCashflows.push(...sale.dividendCashflows);
  });
  return [...byId.values()];
}

function getReturnGroupCashflows(events) {
  const today = todayIsoDate();
  return events.flatMap((event) => {
    if (event.kind === "sale") {
      return [
        { date: event.buyDate, amount: -event.cost },
        ...event.dividendCashflows,
        { date: event.date, amount: event.proceeds },
      ];
    }
    return [
      { date: event.date, amount: -event.remainingCost },
      ...event.dividendCashflows,
      { date: today, amount: event.currentValue },
    ];
  });
}

function getReturnGroupTypePriority(group) {
  if (isForcedEtfSymbol(group.instrumentName)) return 1;
  if (group.typeIds?.length) {
    const typeNames = group.typeIds.map((typeId) => findById("instrumentTypes", typeId)?.name).filter(Boolean).map(normalizeHeader);
    if (typeNames.some((name) => name.includes("etf"))) return 1;
    if (typeNames.some((name) => name.includes("bono"))) return 2;
    if (typeNames.some((name) => name.includes("accion"))) return 3;
  }
  const instrument = findById("instruments", group.instrumentId);
  const typeNames = new Set(
    group.lots
      .map((event) => findById("instrumentTypes", event.typeId)?.name)
      .filter(Boolean),
  );
  state.transactions
    .filter((transaction) => transaction.instrumentId === group.instrumentId && transaction.typeId)
    .forEach((transaction) => {
      const type = findById("instrumentTypes", transaction.typeId);
      if (type?.name) typeNames.add(type.name);
    });
  if (instrument?.defaultTypeId) {
    const defaultType = findById("instrumentTypes", instrument.defaultTypeId);
    if (defaultType?.name) typeNames.add(defaultType.name);
  }

  const normalizedNames = [...typeNames].map(normalizeHeader);
  if (normalizedNames.some((name) => name.includes("etf"))) return 1;
  if (normalizedNames.some((name) => name.includes("bono"))) return 2;
  if (normalizedNames.some((name) => name.includes("accion"))) return 3;
  return 4;
}

function getReturnGroupTypeIds(group) {
  const typeIds = new Set(group.lots.map((event) => event.typeId).filter(Boolean));
  state.transactions
    .filter((transaction) => transaction.instrumentId === group.instrumentId && transaction.typeId)
    .forEach((transaction) => typeIds.add(transaction.typeId));

  if (isForcedEtfSymbol(group.instrumentName)) {
    typeIds.add(ensureInstrumentType("ETF", "Fondos cotizados", "DOLARES"));
  }

  const instrument = findById("instruments", group.instrumentId);
  if (instrument?.defaultTypeId) typeIds.add(instrument.defaultTypeId);
  return [...typeIds];
}

function compareReturnGroups(a, b) {
  if (a.typePriority !== b.typePriority) return a.typePriority - b.typePriority;
  return a.instrumentName.localeCompare(b.instrumentName);
}

function formatReturnEventPrimaryMetric(event) {
  if (event.usesNotionalQuantity && event.kind !== "sale") {
    return event.xirr === null ? "TIR s/d" : `${formatPercentOneDecimal(event.xirr * 100)} TIR`;
  }
  return formatPercentOneDecimal(event.returnPercent * 100);
}

function formatReturnEventSecondaryMetric(event) {
  const returnLabel = `Rend ${formatPercentOneDecimal(event.returnPercent * 100)}`;
  const xirrLabel = `TIR ${event.xirr === null ? "s/d" : formatPercentOneDecimal(event.xirr * 100)}`;
  if (event.kind === "sale") return `${returnLabel} · ${xirrLabel} · Venta ${formatUsd.format(event.proceeds)}`;
  if (event.usesNotionalQuantity) return `${returnLabel} · Div ${formatUsd.format(event.dividends)}`;
  return `${xirrLabel} · Div ${formatUsd.format(event.dividends)}`;
}

function createReturnLotChart(canvasId, group) {
  const ctx = document.getElementById(canvasId);
  if (!ctx) return;
  const lots = group.lots;
  const isUnitMode = Boolean(returnChartUnitModes[canvasId]);
  const unitBase = group.unitBase ?? 1;
  const purchaseBlue = "#2563eb";
  const appreciationViolet = "#7c3aed";
  const saleRed = "#dc2626";
  const dividendGreen = "#16a34a";
  const currentLossSlate = "#64748b";
  charts.push(
    new Chart(ctx, {
      type: "bar",
      data: {
        labels: lots.map((lot) => `${formatDisplayDate(lot.date)} · ${lot.platformName}${lot.kind === "sale" ? " · Venta" : ""}`),
        datasets: [
          {
            label: "Venta",
            data: lots.map((lot) => getReturnChartDatasetValue(lot, "sale", isUnitMode, unitBase)),
            backgroundColor: saleRed,
            borderRadius: 6,
            maxBarThickness: 54,
          },
          {
            label: "Valor actual",
            data: lots.map((lot) => getReturnChartDatasetValue(lot, "currentLoss", isUnitMode, unitBase)),
            backgroundColor: currentLossSlate,
            borderRadius: 6,
            maxBarThickness: 54,
          },
          {
            label: "Compra",
            data: lots.map((lot) => getReturnChartDatasetValue(lot, "purchase", isUnitMode, unitBase)),
            backgroundColor: purchaseBlue,
            borderRadius: 6,
            maxBarThickness: 54,
          },
          {
            label: "Apreciación",
            data: lots.map((lot) => getReturnChartDatasetValue(lot, "appreciation", isUnitMode, unitBase)),
            backgroundColor: appreciationViolet,
            borderRadius: 6,
            maxBarThickness: 54,
          },
          {
            label: "Diferencia contra compra",
            data: lots.map((lot) => getReturnChartDatasetValue(lot, "negativeDifference", isUnitMode, unitBase)),
            backgroundColor: purchaseBlue,
            borderRadius: 6,
            maxBarThickness: 54,
          },
          {
            label: group.incomeLabel,
            data: lots.map((lot) => getReturnChartDatasetValue(lot, "income", isUnitMode, unitBase)),
            backgroundColor: dividendGreen,
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
            position: "bottom",
            labels: { boxWidth: 10, usePointStyle: true },
            onClick() {},
          },
          tooltip: {
            callbacks: {
              label(context) {
                const value = context.parsed.y;
                if (value <= 0) return "";
                return `${context.dataset.label}: ${formatUsd.format(value)}`;
              },
              afterBody(items) {
                const lot = lots[items[0]?.dataIndex];
                if (!lot) return "";
                if (lot.kind === "sale") {
                  const saleDifference = lot.proceeds - lot.cost;
                  return [
                    "Movimiento: Venta",
                    `Cantidad: ${formatNumber.format(lot.quantity)}`,
                    `Precio: ${formatUsd.format(lot.salePrice)}`,
                    `Valor actual individual: ${formatUsd.format(lot.salePrice)}`,
                    `Diferencia por unidad: ${formatUsd.format(0)}`,
                    `Valor total movimiento: ${formatUsd.format(lot.proceeds)}`,
                    `Valor actual: ${formatUsd.format(lot.proceeds)}`,
                    `Diferencia total: ${formatUsd.format(saleDifference)}`,
                    `${group.incomeLabel}: ${formatUsd.format(lot.dividends)}`,
                    `Rendimiento: ${formatPercentOneDecimal(lot.returnPercent * 100)}`,
                    `TIR: ${lot.xirr === null ? "s/d" : formatPercentOneDecimal(lot.xirr * 100)}`,
                  ];
                }
                const openDifference = lot.currentValue - lot.remainingCost;
                return [
                  "Movimiento: Compra",
                  `Cantidad: ${formatNumber.format(lot.originalQuantity ?? lot.quantity)}`,
                  `Precio: ${formatUsd.format(lot.purchasePrice)}`,
                  `Valor actual individual: ${formatUsd.format(lot.currentPrice)}`,
                  `Diferencia por unidad: ${formatUsd.format(getReturnEventUnitDifference(lot))}`,
                  `Valor total movimiento: ${formatUsd.format(lot.remainingCost)}`,
                  `Valor actual: ${formatUsd.format(lot.currentValue)}`,
                  `Diferencia total: ${formatUsd.format(openDifference)}`,
                  `${group.incomeLabel}: ${formatUsd.format(lot.dividends)}`,
                  `Rendimiento: ${formatPercentOneDecimal(lot.returnPercent * 100)}`,
                  `TIR: ${lot.xirr === null ? "s/d" : formatPercentOneDecimal(lot.xirr * 100)}`,
                ];
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

function addPerformanceLot(row, transaction, amountUsd) {
  const quantity = getPerformanceQuantity(transaction, amountUsd);
  const cost = Math.abs(amountUsd);
  if (quantity <= 0 || cost <= 0) return;
  row.netQuantity += quantity;
  row.lots.push({
    quantity,
    remainingQuantity: quantity,
    cost,
    remainingCost: cost,
    date: transaction.tradeDate || transaction.settlementDate || todayIsoDate(),
  });
}

function consumePerformanceLots(row, transaction, amountUsd) {
  let quantityToSell = getPerformanceQuantity(transaction, amountUsd);
  const proceeds = Math.abs(amountUsd);
  if (quantityToSell <= 0) return;

  row.proceeds += proceeds;
  row.netQuantity -= quantityToSell;
  const availableQuantity = row.lots.reduce((sum, lot) => sum + Math.max(0, lot.remainingQuantity), 0);
  const originalQuantity = Math.min(quantityToSell, availableQuantity) || quantityToSell;
  const sellDate = transaction.tradeDate || transaction.settlementDate || todayIsoDate();

  row.lots.sort(compareLotsByDate);
  row.lots.forEach((lot) => {
    if (quantityToSell <= 0 || lot.remainingQuantity <= 0) return;
    const soldQuantity = Math.min(quantityToSell, lot.remainingQuantity);
    const quantityShare = soldQuantity / lot.remainingQuantity;
    const costPortion = lot.remainingCost * quantityShare;
    const proceedsPortion = proceeds * (soldQuantity / originalQuantity);

    row.realizedResult += proceedsPortion - costPortion;
    row.capitalDays += costPortion * getHoldingDays(lot.date, sellDate);
    lot.remainingQuantity -= soldQuantity;
    lot.remainingCost -= costPortion;
    quantityToSell -= soldQuantity;
  });

  row.lots = row.lots.filter((lot) => lot.remainingQuantity > 0.00000001);
}

function calculateOpenLotMetrics(lots, currentValue) {
  const openLots = lots.filter((lot) => lot.remainingQuantity > 0);
  const openCost = openLots.reduce((sum, lot) => sum + lot.remainingCost, 0);
  const openQuantity = openLots.reduce((sum, lot) => sum + lot.remainingQuantity, 0);
  let capitalDays = 0;

  openLots.forEach((lot) => {
    capitalDays += lot.remainingCost * getHoldingDays(lot.date, todayIsoDate());
  });

  return {
    openCost,
    openQuantity,
    unrealizedResult: currentValue - openCost,
    capitalDays,
  };
}

function getPerformanceQuantity(transaction, amountUsd) {
  const quantity = Math.abs(toNumber(transaction.quantity, 0));
  if (quantity > 0) return quantity;
  if (transaction.usesNotionalQuantity) return Math.abs(amountUsd);
  return 0;
}

function compareTransactionsByDate(a, b) {
  const dateComparison = (a.tradeDate || a.settlementDate || "").localeCompare(b.tradeDate || b.settlementDate || "");
  if (dateComparison !== 0) return dateComparison;
  return toNumber(a.sourceRow, 0) - toNumber(b.sourceRow, 0);
}

function compareLotsByDate(a, b) {
  return a.date.localeCompare(b.date);
}

function compareReturnEventsByDate(a, b) {
  const dateComparison = a.date.localeCompare(b.date);
  if (dateComparison !== 0) return dateComparison;
  if (a.kind === b.kind) return a.platformName.localeCompare(b.platformName);
  return a.kind === "sale" ? 1 : -1;
}

function getReturnEventCost(event) {
  return event.kind === "sale" ? toNumber(event.cost, 0) : toNumber(event.remainingCost, 0);
}

function getHoldingDays(startDate, endDate) {
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 1;
  return Math.max(1, Math.round((end - start) / 86400000));
}

function todayIsoDate() {
  const now = new Date();
  const localDate = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return localDate.toISOString().slice(0, 10);
}

function getCurrentHoldingValueForInstrument(instrumentId, platformId) {
  return state.holdings
    .filter((holding) => holding.instrumentId === instrumentId && holding.platformId === platformId)
    .reduce((sum, holding) => sum + getHoldingUsdValue(holding) + getHoldingPendingUsdValue(holding), 0);
}

function getCurrentHoldingMarketValueForInstrument(instrumentId, platformId) {
  return state.holdings
    .filter((holding) => holding.instrumentId === instrumentId && holding.platformId === platformId)
    .reduce((sum, holding) => sum + getHoldingUsdValue(holding), 0);
}

function convertTransactionAmountToUsd(transaction) {
  const amount = toNumber(transaction.amount, 0);
  const currency = String(transaction.currency ?? "").toUpperCase();
  if (currency.includes("PESO")) {
    const rate = getClosestBlueRateForDate(transaction.tradeDate || transaction.settlementDate);
    return amount / rate.sell;
  }
  return amount;
}

function convertTransactionAmountToComparableUsd(transaction) {
  const amount = toNumber(transaction.amount, 0);
  if (!state.settings.applyInflationAdjustment) return convertTransactionAmountToUsd(transaction);

  const currency = String(transaction.currency ?? "").toUpperCase();
  const date = transaction.tradeDate || transaction.settlementDate;
  if (currency.includes("PESO")) {
    return convertTransactionAmountToUsd(transaction) * getInflationFactorForDate(date, "usd");
  }
  return amount * getInflationFactorForDate(date, "usd");
}

function getInflationFactorForDate(date, currencyKey) {
  const month = getMonthStartIso(date);
  if (!month) return 1;
  return (state.inflation?.rates ?? [])
    .filter((rate) => rate.month >= month)
    .reduce((factor, rate) => factor * (1 + toNumber(rate[currencyKey], 0) / 100), 1);
}

function getClosestBlueRateForDate(date) {
  const rates = state.fxRates?.blue?.rates ?? [];
  const targetDate = String(date || todayIsoDate()).slice(0, 10);
  if (!rates.length) {
    const fallbackRate = toNumber(state.settings.arsUsd, 1);
    return { date: targetDate, sell: fallbackRate, buy: fallbackRate, avg: fallbackRate, isFallback: true };
  }

  const targetTime = dateToTime(targetDate);
  let bestRate = rates[0];
  let bestDistance = Math.abs(dateToTime(bestRate.date) - targetTime);
  for (let index = 1; index < rates.length; index += 1) {
    const rate = rates[index];
    const distance = Math.abs(dateToTime(rate.date) - targetTime);
    const isCloser = distance < bestDistance;
    const isSameDistanceButOlder = distance === bestDistance && rate.date <= targetDate && bestRate.date > targetDate;
    if (isCloser || isSameDistanceButOlder) {
      bestRate = rate;
      bestDistance = distance;
    }
  }
  return bestRate;
}

function getLatestBlueRate() {
  const rates = state.fxRates?.blue?.rates ?? [];
  if (!rates.length) {
    const fallbackRate = toNumber(state.settings.arsUsd, 1);
    return { sell: fallbackRate, buy: fallbackRate, avg: fallbackRate };
  }
  return rates[rates.length - 1];
}

function getLastCachedBlueRateDate() {
  const rates = state.fxRates?.blue?.rates ?? [];
  return rates.length ? rates[rates.length - 1].date : "";
}

function getMonthStartIso(date) {
  const text = String(date ?? "").trim();
  if (!text) return "";
  const isoMatch = text.match(/^(\d{4})-(\d{2})/);
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-01`;
  const slashMatch = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (!slashMatch) return "";
  const [, first, second, rawYear] = slashMatch;
  const year = rawYear.length === 2 ? `20${rawYear}` : rawYear;
  const firstNumber = toNumber(first, 0);
  const month = firstNumber > 12 ? second : first;
  return `${year}-${month.padStart(2, "0")}-01`;
}

function dateToTime(date) {
  const time = new Date(`${date}T00:00:00`).getTime();
  return Number.isNaN(time) ? new Date(`${todayIsoDate()}T00:00:00`).getTime() : time;
}

function calculateXirr(cashflows) {
  const validCashflows = cashflows.filter((flow) => flow.date && toNumber(flow.amount, 0) !== 0);
  if (!validCashflows.some((flow) => flow.amount < 0) || !validCashflows.some((flow) => flow.amount > 0)) return null;

  const startDate = new Date(`${validCashflows[0].date}T00:00:00`);
  if (Number.isNaN(startDate.getTime())) return null;
  const datedFlows = validCashflows.map((flow) => ({
    amount: flow.amount,
    years: Math.max(0, (new Date(`${flow.date}T00:00:00`) - startDate) / 31536000000),
  }));

  const npv = (rate) => datedFlows.reduce((sum, flow) => sum + flow.amount / (1 + rate) ** flow.years, 0);
  const derivative = (rate) =>
    datedFlows.reduce((sum, flow) => sum - (flow.years * flow.amount) / (1 + rate) ** (flow.years + 1), 0);

  let rate = 0.1;
  for (let index = 0; index < 40; index += 1) {
    const value = npv(rate);
    const slope = derivative(rate);
    if (Math.abs(value) < 0.0001) return rate;
    if (!Number.isFinite(value) || !Number.isFinite(slope) || Math.abs(slope) < 0.0000001) break;
    const nextRate = rate - value / slope;
    if (!Number.isFinite(nextRate) || nextRate <= -0.9999) break;
    rate = nextRate;
  }

  let low = -0.9999;
  let high = 10;
  let lowValue = npv(low);
  let highValue = npv(high);
  while (lowValue * highValue > 0 && high < 1000) {
    high *= 2;
    highValue = npv(high);
  }
  if (lowValue * highValue > 0) return null;

  for (let index = 0; index < 100; index += 1) {
    const mid = (low + high) / 2;
    const midValue = npv(mid);
    if (Math.abs(midValue) < 0.0001) return mid;
    if (lowValue * midValue <= 0) {
      high = mid;
      highValue = midValue;
    } else {
      low = mid;
      lowValue = midValue;
    }
  }

  return (low + high) / 2;
}

function findById(kind, id) {
  return state[kind].find((item) => item.id === id);
}

function toNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function parseLocaleNumber(value) {
  if (value === undefined || value === null || value === "") return 0;
  const numericText = String(value).trim().replace(/[^\d,.-]/g, "");
  if (!numericText || numericText === "-") return 0;
  const normalized = normalizeNumericText(numericText);
  return toNumber(normalized, 0);
}

function normalizeNumericText(value) {
  const text = String(value);
  const sign = text.startsWith("-") ? "-" : "";
  const unsigned = text.replace(/^-/, "");
  const commaIndex = unsigned.lastIndexOf(",");
  const dotIndex = unsigned.lastIndexOf(".");

  if (commaIndex >= 0 && dotIndex >= 0) {
    const decimalSeparator = commaIndex > dotIndex ? "," : ".";
    const thousandSeparator = decimalSeparator === "," ? "." : ",";
    return `${sign}${unsigned.replaceAll(thousandSeparator, "").replace(decimalSeparator, ".")}`;
  }

  if (commaIndex >= 0) {
    return `${sign}${unsigned.replaceAll(".", "").replace(",", ".")}`;
  }

  if (dotIndex >= 0) {
    const dotCount = (unsigned.match(/\./g) ?? []).length;
    if (dotCount > 1) return `${sign}${unsigned.replaceAll(".", "")}`;
    const [, decimals = ""] = unsigned.split(".");
    const shouldTreatAsThousands = decimals.length === 3 && unsigned.split(".")[0].length <= 3;
    return `${sign}${shouldTreatAsThousands ? unsigned.replace(".", "") : unsigned}`;
  }

  return `${sign}${unsigned}`;
}

function parseBmbDate(value) {
  const match = String(value ?? "").trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (!match) return "";
  const [, day, month, rawYear] = match;
  const year = rawYear.length === 2 ? `20${rawYear}` : rawYear;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

function parseBmbSimpleDate(value) {
  const match = String(value ?? "").trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (!match) return "";
  const [, rawMonth, rawDay, rawYear] = match;
  const year = rawYear.length === 2 ? `20${rawYear}` : rawYear;
  return `${year}-${rawMonth.padStart(2, "0")}-${rawDay.padStart(2, "0")}`;
}

function parseStandardDate(value) {
  const text = String(value ?? "").trim();
  if (!text) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const slashMatch = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (!slashMatch) return "";
  const [, first, second, rawYear] = slashMatch;
  const year = rawYear.length === 2 ? `20${rawYear}` : rawYear;
  const firstNumber = toNumber(first, 0);
  const secondNumber = toNumber(second, 0);
  const day = firstNumber > 12 ? first : second;
  const month = firstNumber > 12 ? second : first;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

function parseIolDate(value) {
  const match = String(value ?? "").trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})(?:\s+\d{1,2}:\d{2}(?::\d{2})?)?/);
  if (!match) return "";
  const [, day, month, rawYear] = match;
  const year = rawYear.length === 2 ? `20${rawYear}` : rawYear;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

function formatDisplayDate(value) {
  if (!value) return "-";
  const [year, month, day] = value.split("-");
  return year && month && day ? `${day}/${month}/${year}` : value;
}

function formatMoneyByCurrency(value, currency) {
  if (String(currency ?? "").toUpperCase().includes("PESO")) {
    return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 2 }).format(value);
  }
  return formatUsd.format(value);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeCsvCell(value) {
  const text = String(value ?? "");
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
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
window.openTransactionDialog = openTransactionDialog;
window.toggleReturnChartUnitMode = toggleReturnChartUnitMode;
window.deleteTransaction = deleteTransaction;
window.openIndicatorDialog = openIndicatorDialog;
window.moveIndicator = moveIndicator;
window.deleteIndicator = deleteIndicator;
