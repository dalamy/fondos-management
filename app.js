import { createRouter } from "./src/app/router.js";
import { buildDashboardChartSpecs, getDashboardPerformanceTooltipLines, renderDashboardSummary } from "./src/app/sections/dashboard-view.js";
import { getSectionById } from "./src/app/sections/index.js";
import { bindOnce } from "./src/app/core/dom.js";
import { loadStoredState, saveStoredState } from "./src/app/core/store.js";
import { loadSectionTemplate as loadSectionTemplateIntoHost } from "./src/app/core/view-loader.js";

const STORAGE_KEY = "fondos-management-state-v2";
const BLUE_RATES_START_DATE = "2024-01-01";
const BLUELYTICS_EVOLUTION_URL = "https://api.bluelytics.com.ar/v2/evolution.json";
const MANUAL_COTIZATIONS_API_URL = "/api/cotizations";
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
    returnFundOrder: [],
    returnPortfolioExcludedFundIds: [],
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
  marketData: {
    provider: "manual-file",
    prices: {},
    lastSyncAt: "",
    lastError: "",
  },
  kpis: {
    retirementSalary: {
      fundIds: ["fund-general"],
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
let returnFundControlsVisible = false;
let currentSectionId = "dashboard";
let mountedSectionId = "";
let appRouter = null;
const dashboardBarDatasetVisibility = { current: true, pending: true };
const transactionFilters = {
  tradeDateFrom: "",
  tradeDateTo: "",
  settlementDateFrom: "",
  settlementDateTo: "",
  platformId: "",
  fundId: "",
  status: "",
  kind: "",
  instrument: "",
  quantity: "",
  price: "",
  amount: "",
  account: "",
};
const dashboardChartExclusions = {
  fundIds: new Set(),
  instrumentIds: new Set(),
  platformIds: new Set(),
  typeIds: new Set(),
};
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

const transactionStatusLabels = {
  REALIZADA: "Realizada",
  PENDIENTE: "Pendiente",
};

const standardTransactionHeaders = [
  "fecha_operada",
  "fecha_liquidacion",
  "plataforma",
  "estado",
  "tipo_movimiento",
  "ticker",
  "tipo_instrumento",
  "fondo",
  "cantidad",
  "precio",
  "monto",
  "moneda",
  "descripcion",
  "referencia",
];

const standardTransactionTemplateRows = [
  standardTransactionHeaders,
  ["2026-01-15", "2026-01-17", "Bull Market Brokers", "REALIZADA", "COMPRA", "SPY", "ETF", "", "2", "500.25", "-1000.50", "DOLARES", "Compra ejemplo", "BMB-0001"],
  ["2026-02-10", "2026-02-10", "Bull Market Brokers", "REALIZADA", "DIVIDENDO", "SPY", "ETF", "", "", "", "12.35", "DOLARES", "Dividendo ejemplo", "BMB-0002"],
  ["2026-03-05", "2026-03-07", "IOL", "REALIZADA", "VENTA", "AL30", "BONO", "", "100", "72000", "72000", "PESOS", "Venta ejemplo", "IOL-0001"],
  ["2026-04-01", "2026-04-01", "Cuenta propia", "PENDIENTE", "COMPRA", "CASH DOLARES", "LIQUID", "Retiro", "1000", "1", "-1000", "DOLARES", "Liquidez dirigida a fondo", "CASH-0001"],
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
  void initializeApp();
});

async function initializeApp() {
  await bindNavigation();
  bindSettings();
  bindDataPortability();
  bindReset();
  renderShell();
  await loadManualCotizationsFromServer();
  syncBlueRatesFromBluelytics();
}

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
  return loadStoredState(STORAGE_KEY, seedState, normalizeState);
}

function normalizeState(nextState) {
  nextState.settings = { ...seedState.settings, ...(nextState.settings ?? {}) };
  nextState.settings.returnFundOrder = Array.isArray(nextState.settings.returnFundOrder) ? nextState.settings.returnFundOrder : [];
  nextState.settings.returnPortfolioExcludedFundIds = Array.isArray(nextState.settings.returnPortfolioExcludedFundIds) ? nextState.settings.returnPortfolioExcludedFundIds : [];
  nextState.fxRates = normalizeFxRates(nextState.fxRates);
  nextState.marketData = normalizeMarketData(nextState.marketData);
  nextState.inflation = {
    rates: normalizeInflationRates(nextState.inflation?.rates?.length ? nextState.inflation.rates : seedInflationRates),
  };
  nextState.kpis = {
    retirementSalary: {
      ...seedState.kpis.retirementSalary,
      ...(nextState.kpis?.retirementSalary ?? {}),
      fundIds: normalizeRetirementFundIds(nextState.kpis?.retirementSalary),
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

function normalizeMarketData(marketData = {}) {
  const prices = {};
  Object.entries(marketData.prices ?? {}).forEach(([instrumentId, entry]) => {
    prices[instrumentId] = {
      provider: entry.provider ?? "manual-file",
      symbol: entry.symbol ?? "",
      currency: normalizeCurrency(entry.currency),
      sourceFile: entry.sourceFile ?? "",
      rates: normalizeHistoricalPriceRows(entry.rates ?? entry.prices ?? []),
      lastSyncAt: entry.lastSyncAt ?? "",
      lastError: entry.lastError ?? "",
    };
  });
  return {
    ...seedState.marketData,
    ...marketData,
    prices,
    lastSyncAt: marketData.lastSyncAt ?? "",
    lastError: marketData.lastError ?? "",
  };
}

function normalizeHistoricalPriceRows(rows) {
  const byDate = new Map();
  rows.forEach((row) => {
    const date = String(row.date ?? "").slice(0, 10);
    const close = toNumber(row.close ?? row.price, 0);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || close <= 0) return;
    byDate.set(date, { date, close });
  });
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

function normalizeCurrency(value) {
  const normalized = normalizeHeader(value).replaceAll(" ", "");
  if (normalized.includes("peso") || normalized === "ars") return "PESOS";
  if (normalized.includes("dolar") || normalized.includes("usd") || normalized.includes("us")) return "DOLARES";
  return "DOLARES";
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
    const month = getMonthStartIso(rate.month ?? rate.MonthYear ?? rate.monthYear ?? rate.Fecha ?? rate.fecha ?? rate.date);
    if (!month) return;
    byMonth.set(month, {
      month,
      usd: toNumber(rate.usd ?? rate.InflationDollar ?? rate.inflationDollar ?? rate["Inflation Dolar"] ?? rate.inflationDolar, 0),
      ars: toNumber(rate.ars ?? rate.InflationPesos ?? rate.inflationPesos ?? rate["Inflation Pesos"] ?? rate.inflationPesos, 0),
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
    fundId: transaction.fundId ?? "",
    status: normalizeTransactionStatus(transaction.status ?? transaction.estado),
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

function normalizeTransactionStatus(value) {
  const normalized = normalizeHeader(value);
  if (normalized.includes("pend")) return "PENDIENTE";
  return "REALIZADA";
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
  saveStoredState(STORAGE_KEY, nextState);
}

function bindNavigation() {
  appRouter = createRouter({
    async onSectionChange(section) {
      currentSectionId = section.id;
      await mountSection(section);
      render();
    },
  });
  return appRouter.start();
}

function bindSettings() {
  // El dólar blue se actualiza automáticamente desde Bluelytics.
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
    button.addEventListener("click", () => openEntityDialog(button.dataset.entity));
  });
  document.querySelectorAll(".master-section-actions button").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
    });
  });

  renderPresetColorButtons();
  bindOnce(document.getElementById("entityUsesPlatformQuotesInput"), "change", () => renderPlatformQuotesEditor(), "entityUsesPlatformQuotesChange");
  bindOnce(document.getElementById("clearEntityColorButton"), "click", () => {
    document.getElementById("entityColorInput").value = "#000000";
    document.getElementById("entityColorInput").dataset.empty = "true";
    updatePresetColorSelection();
  }, "clearEntityColorButtonClick");
  bindOnce(document.getElementById("entityColorInput"), "input", (event) => {
    event.currentTarget.dataset.empty = "false";
    updatePresetColorSelection();
  }, "entityColorInputInput");

  bindOnce(document.getElementById("entityForm"), "submit", (event) => {
    if (event.submitter?.value === "cancel") return;
    event.preventDefault();
    saveEntity();
  }, "entityFormSubmit");
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
  document.getElementById("newHoldingButton")?.addEventListener("click", () => openHoldingDialog());
  bindOnce(document.getElementById("holdingInstrumentInput"), "change", renderQuotePreview, "holdingInstrumentChange");
  bindOnce(document.getElementById("holdingPlatformInput"), "change", renderQuotePreview, "holdingPlatformChange");
  bindOnce(document.getElementById("holdingTypeInput"), "change", renderQuotePreview, "holdingTypeChange");
  bindOnce(document.getElementById("holdingQuantityInput"), "input", renderQuotePreview, "holdingQuantityInput");
  bindOnce(document.getElementById("holdingPendingInput"), "input", renderQuotePreview, "holdingPendingInput");
  bindOnce(document.getElementById("addAllocationButton"), "click", () => addAllocationRow(), "addAllocationClick");
  bindOnce(document.getElementById("holdingForm"), "submit", (event) => {
    if (event.submitter?.value === "cancel") return;
    event.preventDefault();
    saveHolding();
  }, "holdingFormSubmit");
}

function bindKpis() {
  document.getElementById("retirementFundInput")?.addEventListener("change", saveRetirementSettings);
  document.getElementById("retirementPercentInput")?.addEventListener("change", saveRetirementSettings);
  bindOnce(document.getElementById("indicatorForm"), "submit", (event) => {
    if (event.submitter?.value === "cancel") return;
    event.preventDefault();
    saveIndicator();
  }, "indicatorFormSubmit");
}

function bindTransactions() {
  document.getElementById("newTransactionButton")?.addEventListener("click", () => openTransactionDialog());
  document.getElementById("importTransactionsButton")?.addEventListener("click", importTransactions);
  document.getElementById("downloadTransactionTemplateButton")?.addEventListener("click", downloadStandardTransactionTemplate);
  document.getElementById("clearTransactionsButton")?.addEventListener("click", clearTransactions);
  bindOnce(document.getElementById("transactionsFilters"), "input", syncTransactionFiltersFromDom, "transactionsFiltersInput");
  bindOnce(document.getElementById("transactionsFilters"), "change", syncTransactionFiltersFromDom, "transactionsFiltersChange");
  bindOnce(document.getElementById("clearTransactionFiltersButton"), "click", clearTransactionFilters, "clearTransactionFiltersClick");
  document.getElementById("transactionFileInput")?.addEventListener("change", (event) => {
    const file = event.target.files?.[0];
    document.getElementById("transactionImportStatus").textContent = file
      ? `${file.name} listo para importar.`
      : "Elegí una plataforma y cargá un archivo de movimientos.";
  });
  bindOnce(document.getElementById("transactionForm"), "submit", (event) => {
    if (event.submitter?.value === "cancel") return;
    event.preventDefault();
    saveTransaction();
  }, "transactionFormSubmit");
}

function bindCotizations() {
  document.getElementById("openCotizationsDialogButton")?.addEventListener("click", () => openCotizationsDialog());
  document.getElementById("clearCotizationsButton")?.addEventListener("click", () => {
    void clearAllManualCotizations();
  });
  bindOnce(document.getElementById("cotizationsInstrumentInput"), "change", syncCotizationsCurrencyFromInstrument, "cotizationsInstrumentChange");
  bindOnce(document.getElementById("cotizationsFileInput"), "change", (event) => {
    const file = event.target.files?.[0];
    document.getElementById("cotizationsImportStatus").textContent = file
      ? `${file.name} listo para importar.`
      : "Seleccioná un instrumento, una moneda y un archivo Excel con las columnas Fecha Cotización y Cierre.";
  }, "cotizationsFileChange");
  bindOnce(document.getElementById("cotizationsForm"), "submit", async (event) => {
    if (event.submitter?.value === "cancel") return;
    event.preventDefault();
    await importManualCotizations();
  }, "cotizationsFormSubmit");
}

function bindInflation() {
  document.getElementById("newInflationButton")?.addEventListener("click", () => openInflationDialog());
  document.getElementById("openInflationImportDialogButton")?.addEventListener("click", () => openInflationImportDialog());
  bindOnce(document.getElementById("inflationFileInput"), "change", (event) => {
    const file = event.target.files?.[0];
    document.getElementById("inflationImportStatus").textContent = file
      ? `${file.name} listo para importar.`
      : "Cargá un archivo Excel con MonthYear, InflationDollar e InflationPesos.";
  }, "inflationFileChange");
  bindOnce(document.getElementById("inflationForm"), "submit", (event) => {
    if (event.submitter?.value === "cancel") return;
    event.preventDefault();
    saveInflationEntry();
  }, "inflationFormSubmit");
  bindOnce(document.getElementById("inflationImportForm"), "submit", async (event) => {
    if (event.submitter?.value === "cancel") return;
    event.preventDefault();
    await importInflationFile();
  }, "inflationImportFormSubmit");
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
  document.getElementById("toggleReturnFundControlsButton")?.addEventListener("click", () => {
    returnFundControlsVisible = !returnFundControlsVisible;
    renderReturns();
    refreshIcons();
  });
}

function render() {
  const activeSection = getSectionById(currentSectionId);
  const summaryBand = document.getElementById("dashboardSummaryBand");
  renderDashboardSummaryBand();
  if (summaryBand) {
    summaryBand.hidden = !activeSection.showDashboardSummary;
  }
  activeSection.render(getSectionRenderContext());
  refreshIcons();
}

function renderShell() {
  renderDashboardSummaryBand();
  const summaryBand = document.getElementById("dashboardSummaryBand");
  if (summaryBand) {
    summaryBand.hidden = currentSectionId !== "dashboard";
  }
}

async function mountSection(section) {
  if (mountedSectionId === section.id) return;
  if (typeof section.mount === "function") {
    await section.mount(getSectionRenderContext());
  }
  mountedSectionId = section.id;
}

function getSectionRenderContext() {
  return {
    bindCotizations,
    bindEntityCrud,
    bindHoldingCrud,
    bindInflation,
    bindKpis,
    bindReturns,
    bindTransactions,
    loadSectionTemplate(templateUrl) {
      return loadSectionTemplateIntoHost(document.getElementById("sectionViewHost"), templateUrl);
    },
    renderCharts,
    renderDashboard,
    renderHoldings,
    renderKpiSection,
    renderMasterLists,
    renderReturns,
    renderTransactions,
  };
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
    state.settings.arsUsd = getLatestBlueRate().sell;
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

async function loadManualCotizationsFromServer() {
  try {
    const response = await fetch(MANUAL_COTIZATIONS_API_URL, { cache: "no-store" });
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || `No se pudieron cargar las cotizaciones (${response.status}).`);
    }
    applyManualCotizationsPayload(payload);
    saveState();
    render();
  } catch (error) {
    state.marketData.lastSyncAt = new Date().toISOString();
    state.marketData.lastError = error.message ?? "No se pudieron cargar las cotizaciones manuales.";
    saveState();
    render();
    console.warn("No se pudieron cargar las cotizaciones manuales.", error);
  }
}

function applyManualCotizationsPayload(payload) {
  const normalizedPrices = normalizeManualCotizationsPayload(payload);
  state.marketData = {
    ...state.marketData,
    provider: payload?.provider ?? "manual-file",
    prices: normalizedPrices,
    lastSyncAt: payload?.updatedAt ?? new Date().toISOString(),
    lastError: "",
  };

  Object.entries(normalizedPrices).forEach(([instrumentId, entry]) => {
    const instrument = findById("instruments", instrumentId);
    const latestRate = entry.rates?.[entry.rates.length - 1];
    if (!instrument || !latestRate) return;
    instrument.currency = normalizeCurrency(entry.currency || instrument.currency);
    instrument.quote = latestRate.close;
    instrument.usesPlatformQuotes = false;
    instrument.platformQuotes = {};
  });
}

function normalizeManualCotizationsPayload(payload) {
  const prices = {};
  if (payload?.prices && typeof payload.prices === "object") {
    Object.entries(payload.prices).forEach(([instrumentId, entry]) => {
      prices[instrumentId] = {
        provider: entry.provider ?? "manual-file",
        symbol: entry.symbol ?? findById("instruments", instrumentId)?.name ?? "",
        currency: normalizeCurrency(entry.currency),
        sourceFile: entry.sourceFile ?? "",
        rates: normalizeHistoricalPriceRows(entry.rates ?? []),
        lastSyncAt: entry.lastSyncAt ?? payload.updatedAt ?? "",
        lastError: entry.lastError ?? "",
      };
    });
    return prices;
  }

  if (payload?.instruments && typeof payload.instruments === "object") {
    Object.entries(payload.instruments).forEach(([symbol, entry]) => {
      const instrumentId = findInstrumentIdBySymbol(symbol);
      if (!instrumentId) return;
      const instrument = findById("instruments", instrumentId);
      prices[instrumentId] = {
        provider: "manual-file",
        symbol,
        currency: normalizeCurrency(instrument?.currency),
        sourceFile: payload.tickersFile ?? "",
        rates: normalizeHistoricalPriceRows(entry.history ?? entry.rates ?? []),
        lastSyncAt: entry.lastSyncAt ?? payload.updatedAt ?? "",
        lastError: entry.lastError ?? "",
      };
    });
  }
  return prices;
}

function findInstrumentIdBySymbol(symbol) {
  const normalizedSymbol = normalizeHeader(symbol).replaceAll(" ", "");
  return state.instruments.find((instrument) => normalizeHeader(instrument.name).replaceAll(" ", "") === normalizedSymbol)?.id ?? "";
}

function buildManualCotizationsStore() {
  const prices = {};
  Object.entries(state.marketData.prices ?? {}).forEach(([instrumentId, entry]) => {
    if (!entry?.rates?.length) return;
    prices[instrumentId] = {
      provider: "manual-file",
      symbol: entry.symbol || findById("instruments", instrumentId)?.name || "",
      currency: normalizeCurrency(entry.currency || findById("instruments", instrumentId)?.currency),
      sourceFile: entry.sourceFile ?? "",
      rates: normalizeHistoricalPriceRows(entry.rates),
      lastSyncAt: entry.lastSyncAt ?? "",
      lastError: entry.lastError ?? "",
    };
  });
  return {
    provider: "manual-file",
    updatedAt: new Date().toISOString(),
    prices,
  };
}

async function persistManualCotizationsToServer() {
  const response = await fetch(MANUAL_COTIZATIONS_API_URL, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(buildManualCotizationsStore()),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || `No se pudo guardar cotizations.json (${response.status}).`);
  }
}

function renderDashboard() {
  const performanceLookups = renderDashboardSummaryBand();
  renderCharts(performanceLookups);
}

function renderDashboardSummaryBand() {
  const slices = getFilteredHoldingSlices();
  const currentTotal = slices.reduce((sum, slice) => sum + slice.current, 0);
  const pendingTotal = slices.reduce((sum, slice) => sum + slice.pending, 0);
  const total = currentTotal + pendingTotal;
  const latestBlueRate = getLatestBlueRate();
  const performanceLookups = getDashboardPerformanceLookups();
  renderDashboardSummary({
    total,
    currentTotal,
    pendingTotal,
    hasFilters: hasDashboardFilters(),
    portfolioReturn: performanceLookups.portfolio,
    retirementSnapshot: getDashboardRetirementSnapshot(),
    latestBlueRate,
    formatUsd,
    formatNumber,
    formatPercentOneDecimal,
    formatDisplayDate,
  });
  return performanceLookups;
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
  renderTransactionFilters();
  renderTransactionsTable();
}

function renderTransactionFilters() {
  fillFilterSelect("transactionPlatformFilter", state.platforms, transactionFilters.platformId, "Todas");
  fillFilterSelect("transactionFundFilter", state.funds, transactionFilters.fundId, "Todos");
  fillStaticFilterSelect("transactionStatusFilter", Object.entries(transactionStatusLabels).map(([value, label]) => ({ value, label })), transactionFilters.status, "Todos");
  fillStaticFilterSelect("transactionKindFilter", Object.entries(transactionKindLabels).map(([value, label]) => ({ value, label })), transactionFilters.kind, "Todos");
  document.getElementById("transactionTradeDateFromFilter").value = transactionFilters.tradeDateFrom;
  document.getElementById("transactionTradeDateToFilter").value = transactionFilters.tradeDateTo;
  document.getElementById("transactionSettlementDateFromFilter").value = transactionFilters.settlementDateFrom;
  document.getElementById("transactionSettlementDateToFilter").value = transactionFilters.settlementDateTo;
  document.getElementById("transactionInstrumentFilter").value = transactionFilters.instrument;
  document.getElementById("transactionQuantityFilter").value = transactionFilters.quantity;
  document.getElementById("transactionPriceFilter").value = transactionFilters.price;
  document.getElementById("transactionAmountFilter").value = transactionFilters.amount;
  document.getElementById("transactionAccountFilter").value = transactionFilters.account;
}

function renderTransactionsTable() {
  const tbody = document.getElementById("transactionsTable");
  if (!state.transactions.length) {
    tbody.innerHTML = `<tr><td colspan="11"><div class="empty-state">Todavía no hay transacciones importadas.</div></td></tr>`;
    return;
  }

  const filteredTransactions = getFilteredTransactions();
  if (!filteredTransactions.length) {
    tbody.innerHTML = `<tr><td colspan="11"><div class="empty-state">No hay transacciones que coincidan con los filtros actuales.</div></td></tr>`;
    return;
  }

  tbody.innerHTML = [...filteredTransactions]
    .sort((a, b) => (b.tradeDate || "").localeCompare(a.tradeDate || "") || (b.sourceRow - a.sourceRow))
    .map((transaction) => {
      const platform = findById("platforms", transaction.platformId);
      const instrument = findById("instruments", transaction.instrumentId);
      const fund = findById("funds", transaction.fundId);
      return `
        <tr>
          <td>${formatDisplayDate(transaction.tradeDate)}<div class="muted">${formatDisplayDate(transaction.settlementDate)}</div></td>
          <td>${escapeHtml(platform?.name ?? "Sin plataforma")}</td>
          <td>${fund ? `<span class="chip">${escapeHtml(fund.name)}</span>` : `<span class="muted">-</span>`}</td>
          <td><span class="chip ${transaction.status === "PENDIENTE" ? "pending-chip" : ""}">${escapeHtml(transactionStatusLabels[transaction.status] ?? transaction.status)}</span></td>
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

function getFilteredTransactions() {
  return state.transactions.filter((transaction) => transactionMatchesFilters(transaction));
}

function transactionMatchesFilters(transaction) {
  const platform = findById("platforms", transaction.platformId);
  const fund = findById("funds", transaction.fundId);
  const instrument = findById("instruments", transaction.instrumentId);
  const tradeDate = transaction.tradeDate || "";
  const settlementDate = transaction.settlementDate || "";
  const instrumentLabel = `${instrument?.name ?? ""} ${transaction.symbol ?? ""}`.trim();
  const accountLabel = `${transaction.currency || ""} ${transaction.sourceAccount || ""}`.trim();

  return (
    matchesDateFrom(tradeDate, transactionFilters.tradeDateFrom) &&
    matchesDateTo(tradeDate, transactionFilters.tradeDateTo) &&
    matchesDateFrom(settlementDate, transactionFilters.settlementDateFrom) &&
    matchesDateTo(settlementDate, transactionFilters.settlementDateTo) &&
    matchesExactFilter(transaction.platformId, transactionFilters.platformId) &&
    matchesExactFilter(transaction.fundId, transactionFilters.fundId) &&
    matchesExactFilter(transaction.status, transactionFilters.status) &&
    matchesExactFilter(transaction.kind, transactionFilters.kind) &&
    matchesTextFilter(instrumentLabel, transactionFilters.instrument) &&
    matchesTextFilter(String(transaction.quantity ?? ""), transactionFilters.quantity) &&
    matchesTextFilter(String(transaction.price ?? ""), transactionFilters.price) &&
    matchesTextFilter(String(transaction.amount ?? ""), transactionFilters.amount) &&
    matchesTextFilter(accountLabel, transactionFilters.account) &&
    matchesTextFilter(platform?.name, "") &&
    matchesTextFilter(fund?.name, "")
  );
}

function syncTransactionFiltersFromDom() {
  transactionFilters.tradeDateFrom = document.getElementById("transactionTradeDateFromFilter")?.value ?? "";
  transactionFilters.tradeDateTo = document.getElementById("transactionTradeDateToFilter")?.value ?? "";
  transactionFilters.settlementDateFrom = document.getElementById("transactionSettlementDateFromFilter")?.value ?? "";
  transactionFilters.settlementDateTo = document.getElementById("transactionSettlementDateToFilter")?.value ?? "";
  transactionFilters.platformId = document.getElementById("transactionPlatformFilter")?.value ?? "";
  transactionFilters.fundId = document.getElementById("transactionFundFilter")?.value ?? "";
  transactionFilters.status = document.getElementById("transactionStatusFilter")?.value ?? "";
  transactionFilters.kind = document.getElementById("transactionKindFilter")?.value ?? "";
  transactionFilters.instrument = document.getElementById("transactionInstrumentFilter")?.value.trim() ?? "";
  transactionFilters.quantity = document.getElementById("transactionQuantityFilter")?.value.trim() ?? "";
  transactionFilters.price = document.getElementById("transactionPriceFilter")?.value.trim() ?? "";
  transactionFilters.amount = document.getElementById("transactionAmountFilter")?.value.trim() ?? "";
  transactionFilters.account = document.getElementById("transactionAccountFilter")?.value.trim() ?? "";
  renderTransactionsTable();
}

function clearTransactionFilters() {
  Object.keys(transactionFilters).forEach((key) => {
    transactionFilters[key] = "";
  });
  renderTransactions();
  refreshIcons();
}

function fillFilterSelect(elementId, items, selectedValue, emptyLabel) {
  const select = document.getElementById(elementId);
  if (!select) return;
  select.innerHTML = `<option value="">${emptyLabel}</option>${items.map((item) => `<option value="${item.id}">${escapeHtml(item.name)}</option>`).join("")}`;
  select.value = selectedValue ?? "";
}

function fillStaticFilterSelect(elementId, items, selectedValue, emptyLabel) {
  const select = document.getElementById(elementId);
  if (!select) return;
  select.innerHTML = `<option value="">${emptyLabel}</option>${items.map((item) => `<option value="${item.value}">${escapeHtml(item.label)}</option>`).join("")}`;
  select.value = selectedValue ?? "";
}

function matchesExactFilter(value, filterValue) {
  return !filterValue || String(value ?? "") === filterValue;
}

function matchesTextFilter(value, filterValue) {
  return !filterValue || String(value ?? "").toLowerCase().includes(filterValue.toLowerCase());
}

function matchesDateFrom(value, from) {
  return !from || (value && value >= from);
}

function matchesDateTo(value, to) {
  return !to || (value && value <= to);
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
          <div><span>Compras${renderPendingSuffix(group.pendingPurchases)}</span><strong>${formatUsd.format(group.totalPurchases)}</strong></div>
          <div><span>Ventas${renderPendingSuffix(group.pendingSales)}</span><strong>${formatUsd.format(group.totalSales)}</strong></div>
          <div><span>Compras - ventas</span><strong>${formatUsd.format(group.netPurchases)}</strong></div>
          <div><span>Valor actual${renderPendingSuffix(group.pendingCurrentValue)}</span><strong>${formatUsd.format(group.currentValue)}</strong></div>
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
    if (chart.canvas?.id?.startsWith("returnChart") || chart.canvas?.id?.startsWith("fundEvolutionChart")) {
      chart.destroy();
      return false;
    }
    return true;
  });
}

function renderFundReturns(instrumentGroups) {
  const grid = document.getElementById("fundReturnsGrid");
  if (!grid) return;
  const rows = sortFundReturnRows(calculateFundReturns(instrumentGroups));
  const portfolio = calculatePortfolioReturnFromFundRows(rows);
  if (!rows.length && !portfolio) {
    grid.innerHTML = "";
    renderFundEvolutionCharts(rows);
    return;
  }

  const includedFundCount = rows.filter((row) => isFundIncludedInPortfolio(row.fundId)).length;
  const portfolioCard = portfolio ? renderReturnAggregateCard({
    title: "Cartera total",
    eyebrow: "Valuación general",
    subtitle: `${portfolio.instrumentCount} ${portfolio.instrumentCount === 1 ? "instrumento" : "instrumentos"} · ${includedFundCount} ${includedFundCount === 1 ? "fondo incluido" : "fondos incluidos"}`,
    row: portfolio,
    className: "portfolio-return-card",
  }) : "";

  grid.innerHTML = portfolioCard + rows
    .map((row, index) => `
      <article class="fund-return-card ${returnFundControlsVisible && !isFundIncludedInPortfolio(row.fundId) ? "excluded-return-card" : ""}">
        <div>
          <span>Fondo</span>
          <h3>${escapeHtml(row.fundName)}</h3>
          <small>${row.instrumentCount} ${row.instrumentCount === 1 ? "instrumento ponderado" : "instrumentos ponderados"}</small>
        </div>
        ${returnFundControlsVisible ? `
          <div class="fund-return-actions">
            <label class="checkbox-label" title="Incluir en cartera total">
              <input type="checkbox" ${isFundIncludedInPortfolio(row.fundId) ? "checked" : ""} onchange="toggleReturnPortfolioFund('${row.fundId}', this.checked)" />
              Cartera
            </label>
            <div class="fund-order-actions">
              <button class="icon-button" type="button" title="Subir fondo" ${index === 0 ? "disabled" : ""} onclick="moveReturnFund('${row.fundId}', -1)"><i data-lucide="arrow-up"></i></button>
              <button class="icon-button" type="button" title="Bajar fondo" ${index === rows.length - 1 ? "disabled" : ""} onclick="moveReturnFund('${row.fundId}', 1)"><i data-lucide="arrow-down"></i></button>
            </div>
          </div>
        ` : ""}
        <div class="fund-return-main">
          <strong class="${row.totalReturnPercent >= 0 ? "positive" : "negative"}">${formatPercentOneDecimal(row.totalReturnPercent * 100)}</strong>
          <small>TIR ${row.xirr === null ? "s/d" : formatPercentOneDecimal(row.xirr * 100)}</small>
        </div>
        <div class="fund-return-current">
          <span>Valor actual</span>
          <strong>${formatUsd.format(row.currentValue)}</strong>
          ${renderPendingLine(row.pendingCurrentValue, "Pendiente por cobrar")}
        </div>
        <div class="fund-return-metrics">
          <span>Compras ${formatUsd.format(row.purchases)}${renderPendingSuffix(row.pendingPurchases)}</span>
          <span>Ventas ${formatUsd.format(row.sales)}${renderPendingSuffix(row.pendingSales)}</span>
          <span>Ingresos ${formatUsd.format(row.income)}${renderPendingSuffix(row.pendingIncome)}</span>
          <span class="${row.netGain >= 0 ? "positive" : "negative"}">Neto ${formatUsd.format(row.netGain)}</span>
        </div>
      </article>
    `)
    .join("");
  renderFundEvolutionCharts(rows);
  refreshIcons();
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
        ${renderPendingLine(row.pendingCurrentValue, "Pendiente por cobrar")}
      </div>
      <div class="fund-return-metrics">
        <span>Compras ${formatUsd.format(row.purchases)}${renderPendingSuffix(row.pendingPurchases)}</span>
        <span>Ventas ${formatUsd.format(row.sales)}${renderPendingSuffix(row.pendingSales)}</span>
        <span>Ingresos ${formatUsd.format(row.income)}${renderPendingSuffix(row.pendingIncome)}</span>
        <span class="${row.netGain >= 0 ? "positive" : "negative"}">Neto ${formatUsd.format(row.netGain)}</span>
      </div>
    </article>
  `;
}

function renderPendingLine(value, label) {
  return value > 0 ? `<small>${escapeHtml(label)} ${formatUsd.format(value)}</small>` : "";
}

function renderPendingSuffix(value) {
  return value > 0 ? ` · Pendiente ${formatUsd.format(value)}` : "";
}

function sortFundReturnRows(rows) {
  const orderedIds = normalizeReturnFundOrder(rows.map((row) => row.fundId));
  const orderMap = new Map(orderedIds.map((fundId, index) => [fundId, index]));
  return [...rows].sort((a, b) => (orderMap.get(a.fundId) ?? 9999) - (orderMap.get(b.fundId) ?? 9999));
}

function normalizeReturnFundOrder(activeFundIds = state.funds.map((fund) => fund.id)) {
  const activeSet = new Set(activeFundIds);
  const storedOrder = (state.settings.returnFundOrder ?? []).filter((fundId) => activeSet.has(fundId));
  const missingIds = activeFundIds.filter((fundId) => !storedOrder.includes(fundId));
  const nextOrder = [...storedOrder, ...missingIds];
  state.settings.returnFundOrder = nextOrder;
  return nextOrder;
}

function isFundIncludedInPortfolio(fundId) {
  return !state.settings.returnPortfolioExcludedFundIds.includes(fundId);
}

function toggleReturnPortfolioFund(fundId, included) {
  const excludedIds = new Set(state.settings.returnPortfolioExcludedFundIds ?? []);
  if (included) {
    excludedIds.delete(fundId);
  } else {
    excludedIds.add(fundId);
  }
  state.settings.returnPortfolioExcludedFundIds = [...excludedIds];
  saveState();
  renderReturns();
  refreshIcons();
}

function moveReturnFund(fundId, direction) {
  const rows = calculateFundReturns(calculateReturnLotCharts());
  const activeIds = rows.map((row) => row.fundId);
  const order = normalizeReturnFundOrder(activeIds);
  const index = order.indexOf(fundId);
  const nextIndex = index + direction;
  if (index < 0 || nextIndex < 0 || nextIndex >= order.length) return;
  const [movedFundId] = order.splice(index, 1);
  order.splice(nextIndex, 0, movedFundId);
  state.settings.returnFundOrder = order;
  saveState();
  renderReturns();
  refreshIcons();
}

function calculatePortfolioReturnFromFundRows(rows) {
  const includedRows = rows.filter((row) => isFundIncludedInPortfolio(row.fundId));
  if (!includedRows.length) return null;
  const row = {
    purchases: 0,
    sales: 0,
    currentValue: 0,
    pendingPurchases: 0,
    pendingSales: 0,
    pendingCurrentValue: 0,
    pendingIncome: 0,
    income: 0,
    netGain: 0,
    totalReturnPercent: 0,
    xirr: null,
    cashflows: [],
    instrumentIds: new Set(),
  };

  includedRows.forEach((fundRow) => {
    row.purchases += fundRow.purchases;
    row.sales += fundRow.sales;
    row.currentValue += fundRow.currentValue;
    row.pendingPurchases += fundRow.pendingPurchases;
    row.pendingSales += fundRow.pendingSales;
    row.pendingCurrentValue += fundRow.pendingCurrentValue;
    row.pendingIncome += fundRow.pendingIncome;
    row.income += fundRow.income;
    row.cashflows.push(...fundRow.cashflows);
    fundRow.instrumentIds.forEach((instrumentId) => row.instrumentIds.add(instrumentId));
  });

  row.netGain = row.sales + row.currentValue + row.income - row.purchases;
  row.totalReturnPercent = row.purchases > 0 ? row.netGain / row.purchases : 0;
  row.xirr = calculateXirr(row.cashflows);
  row.instrumentCount = row.instrumentIds.size;
  return row.instrumentCount > 0 && row.purchases > 0 ? row : null;
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
  const editFundsButton = document.getElementById("toggleReturnFundControlsButton");
  if (editFundsButton) {
    editFundsButton.classList.toggle("is-active", returnFundControlsVisible);
    editFundsButton.setAttribute("aria-pressed", String(returnFundControlsVisible));
    editFundsButton.innerHTML = `<i data-lucide="${returnFundControlsVisible ? "eye-off" : "sliders-horizontal"}"></i>${returnFundControlsVisible ? "Ocultar controles" : "Editar fondos"}`;
  }
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
        pendingPurchases: 0,
        pendingSales: 0,
        pendingCurrentValue: 0,
        pendingIncome: 0,
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
      const fundShares = getFundSharesForReturnEvent(group, event);
      fundShares.forEach((share, fundId) => {
        const row = fundRows.get(fundId);
        if (!row || share <= 0) return;
        const purchaseValue = getReturnEventCost(event) * share;
        const saleValue = toNumber(event.proceeds, 0) * share;
        const currentValue = toNumber(event.currentValue, 0) * share;
        const incomeValue = toNumber(event.dividends, 0) * share;
        const pendingPurchaseValue = toNumber(event.pendingPurchase, 0) * share;
        const pendingSaleValue = toNumber(event.pendingSales, 0) * share;
        const pendingCurrentValue = toNumber(event.pendingCurrentValue, 0) * share;
        const pendingIncomeValue = toNumber(event.pendingDividends, 0) * share;

        row.purchases += purchaseValue;
        row.sales += saleValue;
        row.currentValue += currentValue;
        row.pendingPurchases += pendingPurchaseValue;
        row.pendingSales += pendingSaleValue;
        row.pendingCurrentValue += pendingCurrentValue;
        row.pendingIncome += pendingIncomeValue;
        row.income += incomeValue;
        row.instrumentIds.add(group.instrumentId);
        row.cashflows.push(...getReturnEventCashflows(event).map((flow) => ({ ...flow, amount: flow.amount * share })));
      });
    });
  });

  applyHoldingPendingReceivablesToFundRows(fundRows);

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

function applyHoldingPendingReceivablesToFundRows(fundRows) {
  const pendingByFund = getPendingReceivablesByFund();
  pendingByFund.forEach((pendingValue, fundId) => {
    const row = fundRows.get(fundId);
    if (!row || pendingValue <= 0) return;
    const extraPendingValue = Math.max(0, pendingValue - row.pendingCurrentValue);
    if (extraPendingValue <= 0) return;
    row.currentValue += extraPendingValue;
    row.pendingCurrentValue += extraPendingValue;
    row.cashflows.push({ date: todayIsoDate(), amount: extraPendingValue });
  });
}

function getPendingReceivablesByFund() {
  const pendingByFund = new Map();
  getHoldingSlices().forEach((slice) => {
    if (slice.fundId === noFundFilterId || slice.pending <= 0) return;
    pendingByFund.set(slice.fundId, (pendingByFund.get(slice.fundId) ?? 0) + slice.pending);
  });
  return pendingByFund;
}

function getFundSharesForReturnEvent(group, event) {
  if (event.fundId && isCashLikeInstrumentId(group.instrumentId)) {
    return new Map([[event.fundId, 1]]);
  }
  return getFundSharesForInstrumentPlatform(group.instrumentId, event.platformId);
}

function calculatePortfolioReturn(instrumentGroups) {
  const row = {
    purchases: 0,
    sales: 0,
    currentValue: 0,
    pendingPurchases: 0,
    pendingSales: 0,
    pendingCurrentValue: 0,
    pendingIncome: 0,
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
      row.pendingPurchases += toNumber(event.pendingPurchase, 0);
      row.pendingSales += toNumber(event.pendingSales, 0);
      row.pendingCurrentValue += toNumber(event.pendingCurrentValue, 0);
      row.pendingIncome += toNumber(event.pendingDividends, 0);
      row.income += toNumber(event.dividends, 0);
      row.instrumentIds.add(group.instrumentId);
      row.cashflows.push(...getReturnEventCashflows(event));
    });
  });

  const holdingPending = [...getPendingReceivablesByFund().values()].reduce((sum, value) => sum + value, 0);
  const extraPendingValue = Math.max(0, holdingPending - row.pendingCurrentValue);
  row.currentValue += extraPendingValue;
  row.pendingCurrentValue += extraPendingValue;
  if (extraPendingValue > 0) {
    row.cashflows.push({ date: todayIsoDate(), amount: extraPendingValue });
  }

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

function renderFundEvolutionCharts(fundRows) {
  const grid = document.getElementById("fundEvolutionGrid");
  if (!grid) return;
  const seriesRows = buildFundEvolutionSeries(fundRows);
  if (!seriesRows.length) {
    grid.innerHTML = "";
    return;
  }

  grid.innerHTML = seriesRows
    .map((row, index) => `
      <article class="fund-evolution-card">
        <div class="fund-evolution-header">
          <div>
            <span>Evolución de tenencia</span>
            <h3>${escapeHtml(row.fundName)}</h3>
          </div>
          <strong>${formatUsd.format(row.currentValue)}</strong>
        </div>
        <div class="fund-evolution-chart-wrap">
          <canvas id="fundEvolutionChart${index}"></canvas>
        </div>
      </article>
    `)
    .join("");

  seriesRows.forEach((row, index) => createFundEvolutionChart(`fundEvolutionChart${index}`, row));
}

function buildFundEvolutionSeries(fundRows) {
  const rowsByFund = new Map(fundRows.map((row) => [row.fundId, row]));
  const dailyMovementsByDate = new Map();
  const positionsByFund = new Map();
  const cashByFund = new Map();
  const relevantTransactions = [...state.transactions]
    .filter((transaction) => transaction.instrumentId)
    .sort(compareTransactionsByDate);

  if (!relevantTransactions.length) return [];

  relevantTransactions.forEach((transaction) => {
    const date = transaction.tradeDate || transaction.settlementDate || todayIsoDate();
    const quantityDelta = getFundEvolutionQuantityDelta(transaction);
    const cashDelta = getFundEvolutionCashDelta(transaction);
    const shares = getFundSharesForTransaction(transaction);
    const instrumentName = findById("instruments", transaction.instrumentId)?.name ?? transaction.symbol ?? "Instrumento";
    if (!dailyMovementsByDate.has(date)) {
      dailyMovementsByDate.set(date, new Map());
    }
    const dailyMovementsByFund = dailyMovementsByDate.get(date);
    shares.forEach((share, fundId) => {
      if (!rowsByFund.has(fundId) || share <= 0) return;
      if (!dailyMovementsByFund.has(fundId)) {
        dailyMovementsByFund.set(fundId, []);
      }
      dailyMovementsByFund.get(fundId).push({
        fundId,
        instrumentId: transaction.instrumentId,
        instrumentName,
        label: transactionKindLabels[transaction.kind] ?? transaction.kind,
        status: transaction.status ?? "REALIZADA",
        quantityDelta: quantityDelta * share,
        cashDelta: cashDelta * share,
      });
    });
  });

  const firstDate = relevantTransactions[0]?.tradeDate || relevantTransactions[0]?.settlementDate || todayIsoDate();
  const lastDate = todayIsoDate();
  const pointsByFund = new Map(fundRows.map((row) => [row.fundId, []]));

  for (let date = firstDate; date <= lastDate; date = addDaysIso(date, 1)) {
    const dailyMovementsByFund = dailyMovementsByDate.get(date) ?? new Map();

    dailyMovementsByFund.forEach((movements, fundId) => {
      movements.forEach((movement) => {
        const positionKey = `${fundId}|${movement.instrumentId}`;
        positionsByFund.set(positionKey, Math.max(0, (positionsByFund.get(positionKey) ?? 0) + movement.quantityDelta));
        cashByFund.set(fundId, (cashByFund.get(fundId) ?? 0) + movement.cashDelta);
      });
    });

    fundRows.forEach((row) => {
      const movements = dailyMovementsByFund.get(row.fundId) ?? [];
      const accumulated = getFundMarketValueOnDate(row.fundId, date, positionsByFund, cashByFund);
      const points = pointsByFund.get(row.fundId);
      const previousValue = points[points.length - 1]?.accumulated ?? 0;
      if (!points.length && accumulated <= 0 && !movements.length) return;
      points.push({
        date,
        value: accumulated,
        accumulated,
        variation: accumulated - previousValue,
        label: getFundEvolutionDailyLabel(movements),
        instrumentName: getFundEvolutionDailyInstrumentName(movements),
        status: getFundEvolutionDailyStatus(movements),
        hasMovement: movements.length > 0,
        movements,
      });
    });
  }

  return fundRows
    .map((row) => {
      const points = pointsByFund.get(row.fundId) ?? [];
      const today = todayIsoDate();
      if (row.currentValue > 0 && (!points.length || points[points.length - 1].date !== today || Math.abs(points[points.length - 1].accumulated - row.currentValue) > 0.01)) {
        if (points.length && points[points.length - 1].date === today) {
          const previousValue = points[points.length - 2]?.accumulated ?? 0;
          points[points.length - 1] = {
            ...points[points.length - 1],
            value: row.currentValue,
            accumulated: row.currentValue,
            variation: row.currentValue - previousValue,
            label: points[points.length - 1].hasMovement ? points[points.length - 1].label : "Valor actual",
          };
        } else {
          points.push({
            date: today,
            value: row.currentValue,
            variation: row.currentValue - (points[points.length - 1]?.accumulated ?? 0),
            accumulated: row.currentValue,
            label: "Valor actual",
            instrumentName: "Cartera del fondo",
            status: "REALIZADA",
            hasMovement: false,
            movements: [],
          });
        }
      }
      return {
        ...row,
        points,
      };
    })
    .filter((row) => row.points.length);
}

function getFundMarketValueOnDate(fundId, date, positionsByFund, cashByFund) {
  let total = cashByFund.get(fundId) ?? 0;
  positionsByFund.forEach((quantity, key) => {
    const [positionFundId, instrumentId] = key.split("|");
    if (positionFundId !== fundId || quantity <= 0) return;
    const instrument = findById("instruments", instrumentId);
    total += quantity * getHistoricalInstrumentPriceUsd(instrument, date);
  });
  return Math.max(0, total);
}

function getFundEvolutionDailyLabel(movements) {
  if (!movements.length) return "Valuación diaria";
  if (movements.length === 1) return movements[0].label;
  return `${movements.length} movimientos`;
}

function getFundEvolutionDailyInstrumentName(movements) {
  if (!movements.length) return "Cartera del fondo";
  const instrumentNames = [...new Set(movements.map((movement) => movement.instrumentName).filter(Boolean))];
  if (instrumentNames.length === 1) return instrumentNames[0];
  if (instrumentNames.length <= 3) return instrumentNames.join(", ");
  return `${instrumentNames.length} instrumentos`;
}

function getFundEvolutionDailyStatus(movements) {
  return movements.some((movement) => movement.status === "PENDIENTE") ? "PENDIENTE" : "REALIZADA";
}

function getFundSharesForTransaction(transaction) {
  if (transaction.fundId && isCashLikeInstrumentId(transaction.instrumentId)) {
    return new Map([[transaction.fundId, 1]]);
  }
  return getFundSharesForInstrumentPlatform(transaction.instrumentId, transaction.platformId);
}

function getFundEvolutionQuantityDelta(transaction) {
  const amountUsd = convertTransactionAmountToUsd(transaction);
  const quantity = getPerformanceQuantity(transaction, amountUsd);
  if (transaction.kind === "BUY" || transaction.kind === "CAUCION_OPEN") return quantity;
  if (transaction.kind === "SELL" || transaction.kind === "CAUCION_CLOSE") return -quantity;
  return 0;
}

function getFundEvolutionCashDelta(transaction) {
  const amountUsd = convertTransactionAmountToUsd(transaction);
  if (amountUsd === 0) return 0;
  if (transaction.kind === "SELL" || transaction.kind === "CAUCION_CLOSE") return Math.abs(amountUsd);
  if (transaction.kind === "WITHDRAWAL" || transaction.kind === "FEE" || transaction.kind === "TAX") return -Math.abs(amountUsd);
  if (transaction.kind === "DIVIDEND" || transaction.kind === "INCOME" || transaction.kind === "DEPOSIT") return Math.abs(amountUsd);
  return 0;
}

function getHistoricalInstrumentPriceUsd(instrument, date) {
  if (!instrument) return 0;
  if (isCashLikeName(instrument.name)) return 1;
  const price = getClosestHistoricalInstrumentPrice(instrument.id, date) ?? toNumber(instrument.quote, 0);
  if (price <= 0) return 0;
  const currency = String(instrument.currency ?? "").toUpperCase();
  if (currency.includes("PESO")) {
    return price / getClosestBlueRateForDate(date).sell;
  }
  return price;
}

function getClosestHistoricalInstrumentPrice(instrumentId, date) {
  const rates = state.marketData?.prices?.[instrumentId]?.rates ?? [];
  if (!rates.length) return null;
  const targetDate = String(date || todayIsoDate()).slice(0, 10);
  const exactOrPrevious = [...rates].reverse().find((rate) => rate.date <= targetDate);
  return exactOrPrevious?.close ?? rates[0].close ?? null;
}

function createFundEvolutionChart(canvasId, row) {
  const ctx = document.getElementById(canvasId);
  if (!ctx) return;
  charts.push(
    new Chart(ctx, {
      type: "line",
      data: {
        labels: row.points.map((point) => formatDisplayDate(point.date)),
        datasets: [
          {
            label: row.fundName,
            data: row.points.map((point) => point.accumulated),
            borderColor: findById("funds", row.fundId)?.color || "#0f766e",
            backgroundColor: "rgba(15, 118, 110, 0.12)",
            pointBackgroundColor: row.points.map((point) => (point.status === "PENDIENTE" ? "#d6a51f" : findById("funds", row.fundId)?.color || "#0f766e")),
            pointRadius(context) {
              return row.points[context.dataIndex]?.hasMovement ? 4 : 0;
            },
            pointHoverRadius(context) {
              return row.points[context.dataIndex]?.hasMovement ? 6 : 3;
            },
            tension: 0.2,
            fill: true,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label(context) {
                return `Tenencia: ${formatUsd.format(context.parsed.y)}`;
              },
              afterBody(items) {
                const point = row.points[items[0]?.dataIndex];
                if (!point) return "";
                const details = [
                  `Movimiento: ${point.label}`,
                  `Instrumento: ${point.instrumentName}`,
                  `Variación del día: ${formatUsd.format(point.variation ?? point.value)}`,
                  `Estado: ${transactionStatusLabels[point.status] ?? point.status}`,
                ];
                if (point.movements?.length) {
                  point.movements.slice(0, 3).forEach((movement) => {
                    details.push(`• ${movement.label} · ${movement.instrumentName}`);
                  });
                  if (point.movements.length > 3) {
                    details.push(`• ${point.movements.length - 3} movimientos más`);
                  }
                } else {
                  details.push("Valuado con la cotización histórica más cercana disponible.");
                }
                return details;
              },
            },
          },
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { maxRotation: 45, minRotation: 0 },
          },
          y: {
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
  renderEntityTable("platforms", "platformsTable");
  renderEntityTable("instrumentTypes", "instrumentTypesTable");
  renderEntityTable("instruments", "instrumentsTable");
  renderEntityTable("funds", "fundsTable");
  renderManualCotizationsTable();
  renderInflationTable();
}

function renderEntityTable(kind, elementId) {
  const element = document.getElementById(elementId);
  const rows = state[kind] ?? [];
  if (!rows.length) {
    element.innerHTML = `<tr><td colspan="${getEntityTableColumnCount(kind)}"><div class="empty-state">Sin registros.</div></td></tr>`;
    return;
  }

  element.innerHTML = rows
    .map((item) => {
      const description = escapeHtml(item.description || "Sin descripción");
      if (kind === "instruments") {
        return `
          <tr>
            <td><div class="table-title-cell"><span class="color-swatch" style="background:${escapeHtml(item.color || "#dfe5df")}"></span><strong>${escapeHtml(item.name)}</strong></div></td>
            <td>${description}</td>
            <td>${escapeHtml(item.currency ?? "DOLARES")}</td>
            <td>${formatNumber.format(item.quote ?? 0)}</td>
            <td>${renderColorCell(item.color)}</td>
            <td>
              <div class="actions">
                <button class="icon-button" type="button" title="Editar" onclick="openEntityDialog('${kind}', '${item.id}')"><i data-lucide="pencil"></i></button>
                <button class="icon-button danger-button" type="button" title="Eliminar" onclick="deleteEntity('${kind}', '${item.id}')"><i data-lucide="trash-2"></i></button>
              </div>
            </td>
          </tr>
        `;
      }

      return `
        <tr>
          <td><div class="table-title-cell"><span class="color-swatch" style="background:${escapeHtml(item.color || "#dfe5df")}"></span><strong>${escapeHtml(item.name)}</strong></div></td>
          <td>${description}</td>
          <td>${renderColorCell(item.color)}</td>
          <td>
            <div class="actions">
              <button class="icon-button" type="button" title="Editar" onclick="openEntityDialog('${kind}', '${item.id}')"><i data-lucide="pencil"></i></button>
              <button class="icon-button danger-button" type="button" title="Eliminar" onclick="deleteEntity('${kind}', '${item.id}')"><i data-lucide="trash-2"></i></button>
            </div>
          </td>
        </tr>
      `;
    })
    .join("");
}

function getEntityTableColumnCount(kind) {
  return kind === "instruments" ? 6 : 4;
}

function renderColorCell(color) {
  if (!color) return '<span class="muted">Sin color</span>';
  return `<div class="table-color-cell"><span class="color-swatch" style="background:${escapeHtml(color)}"></span><span>${escapeHtml(color)}</span></div>`;
}

function renderManualCotizationsTable() {
  const element = document.getElementById("cotizationsTable");
  const entries = Object.entries(state.marketData?.prices ?? {})
    .filter(([, entry]) => entry?.rates?.length)
    .sort(([, left], [, right]) => (right.lastSyncAt || "").localeCompare(left.lastSyncAt || ""));

  if (!entries.length) {
    element.innerHTML = `<tr><td colspan="7"><div class="empty-state">Todavía no hay cotizaciones manuales cargadas.</div></td></tr>`;
    return;
  }

  element.innerHTML = entries
    .map(([instrumentId, entry]) => {
      const instrument = findById("instruments", instrumentId);
      const latestRate = entry.rates[entry.rates.length - 1];
      return `
        <tr>
          <td><div class="table-title-cell"><span class="color-swatch" style="background:${escapeHtml(instrument?.color || "#dfe5df")}"></span><strong>${escapeHtml(instrument?.name ?? entry.symbol ?? "Instrumento")}</strong></div></td>
          <td>${escapeHtml(entry.currency || instrument?.currency || "DOLARES")}</td>
          <td>${formatNumber.format(entry.rates.length)}</td>
          <td>${escapeHtml(formatDisplayDate(latestRate?.date || ""))}</td>
          <td>${escapeHtml(formatNumber.format(latestRate?.close || 0))}</td>
          <td>${entry.sourceFile ? escapeHtml(entry.sourceFile) : '<span class="muted">Manual</span>'}</td>
          <td>
            <div class="actions">
              <button class="icon-button" type="button" title="Reemplazar cotizaciones" onclick="openCotizationsDialog('${instrumentId}')"><i data-lucide="refresh-cw"></i></button>
            </div>
          </td>
        </tr>
      `;
    })
    .join("");
}

function renderInflationTable() {
  const element = document.getElementById("inflationTable");
  const rows = [...(state.inflation?.rates ?? [])].sort((a, b) => b.month.localeCompare(a.month));
  if (!rows.length) {
    element.innerHTML = `<tr><td colspan="4"><div class="empty-state">Todavía no hay inflación cargada.</div></td></tr>`;
    return;
  }

  element.innerHTML = rows
    .map((row) => `
      <tr>
        <td><strong>${escapeHtml(row.month)}</strong></td>
        <td>${formatNumber.format(row.usd)}</td>
        <td>${formatNumber.format(row.ars)}</td>
        <td>
          <div class="actions">
            <button class="icon-button" type="button" title="Editar" onclick="openInflationDialog('${row.month}')"><i data-lucide="pencil"></i></button>
            <button class="icon-button danger-button" type="button" title="Eliminar" onclick="deleteInflationEntry('${row.month}')"><i data-lucide="trash-2"></i></button>
          </div>
        </td>
      </tr>
    `)
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

function excludeDashboardChartItem(filterKey, id) {
  if (!dashboardChartExclusions[filterKey] || !id) return;
  dashboardChartExclusions[filterKey].add(id);
  renderCharts();
  refreshIcons();
}

function resetDashboardChartExclusions(filterKey) {
  if (!dashboardChartExclusions[filterKey]) return;
  dashboardChartExclusions[filterKey].clear();
  renderCharts();
  refreshIcons();
}

function getDashboardVisibleSeries(filterKey, series) {
  const hiddenIds = dashboardChartExclusions[filterKey];
  if (!hiddenIds?.size) return series;
  const visibleSeries = series.filter((item) => !hiddenIds.has(item.id));
  return visibleSeries.length ? visibleSeries : series;
}

function bindDashboardChartContextMenu(chart, filterKey) {
  chart.canvas.addEventListener("contextmenu", (event) => {
    const elements = chart.getElementsAtEventForMode(event, "nearest", { intersect: true }, true);
    const element = elements[0];
    if (!element) return;
    event.preventDefault();
    const id = chart.data.datasets[element.datasetIndex].filterIds[element.index];
    excludeDashboardChartItem(filterKey, id);
  });
}

function rerenderDashboardViews() {
  renderDashboard();
  refreshIcons();
}

function renderCharts(performanceLookups = getDashboardPerformanceLookups()) {
  charts.forEach((chart) => chart.destroy());
  charts = [];
  renderDashboardFilterBar();

  const chartGrid = document.getElementById("chartGrid");
  const specs = buildDashboardChartSpecs({
    aggregateByFund,
    aggregateBy,
    dashboardFilters,
    performanceByFundId: performanceLookups.fundById,
    performanceByInstrumentId: performanceLookups.instrumentById,
  });

  chartGrid.innerHTML = specs
    .map(
      (spec) => `
        <section class="chart-section">
          <div class="chart-section-header">
            <h3>${spec.title}</h3>
            <div class="chart-section-actions">
              ${spec.activeCount ? `<span class="filter-count">${spec.activeCount}</span>` : ""}
              ${dashboardChartExclusions[spec.filterKey].size ? `<button class="ghost-button chart-reset-button" type="button" data-chart-reset="${spec.filterKey}"><i data-lucide="rotate-ccw"></i>Reiniciar gráfico</button>` : ""}
            </div>
          </div>
          <div class="chart-pair">
            <div class="chart-panel"><canvas id="${spec.id}Pie"></canvas></div>
            <div class="chart-panel"><canvas id="${spec.id}Bar"></canvas></div>
          </div>
        </section>
      `,
    )
    .join("");

  chartGrid.querySelectorAll("[data-chart-reset]").forEach((button) => {
    button.addEventListener("click", () => {
      resetDashboardChartExclusions(button.dataset.chartReset);
    });
  });

  specs.forEach((spec) => {
    const visibleSeries = getDashboardVisibleSeries(spec.filterKey, spec.series);
    createPieChart(`${spec.id}Pie`, visibleSeries, spec.filterKey);
    createBarChart(`${spec.id}Bar`, visibleSeries, spec.filterKey);
  });
}

function renderKpiSection() {
  renderKpiFundSelects();
  renderRetirementSalary();
  renderIndicatorGrid();
}

function renderKpiFundSelects() {
  fillMultiSelect("retirementFundInput", state.funds, state.kpis.retirementSalary.fundIds);
  fillSelect("indicatorFundInput", state.funds, document.getElementById("indicatorFundInput").value || state.funds[0]?.id);
  fillSelect("newIndicatorFundInput", state.funds, document.getElementById("newIndicatorFundInput")?.value || state.funds[0]?.id);
  document.getElementById("retirementPercentInput").value = state.kpis.retirementSalary.annualPercent;
}

function renderRetirementSalary() {
  const settings = state.kpis.retirementSalary;
  const selectedFunds = getRetirementFunds(settings.fundIds);
  const fundTotals = getFundsTotals(settings.fundIds);
  const fundValue = fundTotals.current;
  const estimatedFundValue = fundTotals.value;
  const monthlySalary = (fundValue * (toNumber(settings.annualPercent, 0) / 100)) / 12;
  const estimatedMonthlySalary = (estimatedFundValue * (toNumber(settings.annualPercent, 0) / 100)) / 12;
  document.getElementById("retirementSalaryValue").textContent = formatUsd.format(monthlySalary);
  document.getElementById("retirementSalaryMeta").textContent = fundTotals.pending > 0
    ? `${getRetirementFundsLabel(selectedFunds)} · ${formatUsd.format(fundValue)} actual · ${formatUsd.format(estimatedMonthlySalary)} al cobrar · ${formatNumber.format(settings.annualPercent)}% anual`
    : `${getRetirementFundsLabel(selectedFunds)} · ${formatUsd.format(fundValue)} · ${formatNumber.format(settings.annualPercent)}% anual`;
}

function getDashboardRetirementSnapshot() {
  const settings = state.kpis.retirementSalary;
  const selectedFunds = getRetirementFunds(settings.fundIds);
  const fundTotals = getFundsTotals(settings.fundIds);
  const annualPercent = toNumber(settings.annualPercent, 0);
  return {
    fundName: getRetirementFundsLabel(selectedFunds),
    annualPercent,
    pending: fundTotals.pending,
    monthlySalary: (fundTotals.current * (annualPercent / 100)) / 12,
    estimatedMonthlySalary: (fundTotals.value * (annualPercent / 100)) / 12,
  };
}

function getDashboardPerformanceLookups() {
  const instrumentGroups = calculateReturnLotCharts();
  const fundRows = calculateFundReturns(instrumentGroups);
  return {
    portfolio: sanitizePerformanceMetrics(calculatePortfolioReturnFromFundRows(fundRows)),
    fundById: new Map(fundRows.map((row) => [row.fundId, sanitizePerformanceMetrics(row)])),
    instrumentById: new Map(instrumentGroups.map((group) => [group.instrumentId, sanitizePerformanceMetrics(group)])),
  };
}

function sanitizePerformanceMetrics(metrics) {
  if (!metrics) return null;
  return {
    ...metrics,
    xirr: Number.isFinite(metrics.xirr) ? metrics.xirr : null,
    totalReturnPercent: Number.isFinite(metrics.totalReturnPercent) ? metrics.totalReturnPercent : 0,
  };
}

function renderIndicatorGrid() {
  const grid = document.getElementById("indicatorGrid");
  const indicatorCards = state.kpis.indicators
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

  grid.innerHTML = `
    <article class="gauge-card gauge-card-create">
      <div class="gauge-card-header">
        <div>
          <h3>Nuevo indicator</h3>
          <div class="gauge-meta">
            <span>Crealo directamente desde esta grilla.</span>
            <span>Después podés reordenarlo o editarlo desde su tarjeta.</span>
          </div>
        </div>
      </div>
      <form id="newInlineIndicatorForm" class="form-grid compact-form inline-indicator-form">
        <label>
          Nombre
          <input id="newIndicatorNameInput" type="text" required />
        </label>
        <label>
          Fondo origen
          <select id="newIndicatorFundInput" required></select>
        </label>
        <label class="span-2">
          Monto máximo esperado
          <input id="newIndicatorMaxInput" type="number" min="0" step="0.01" required />
        </label>
        <div class="inline-indicator-actions span-2">
          <button class="primary-button" type="submit">
            <i data-lucide="plus"></i>
            Crear indicator
          </button>
        </div>
      </form>
    </article>
    ${indicatorCards || `<div class="empty-state">Todavía no hay indicadores configurados.</div>`}
  `;

  bindOnce(document.getElementById("newInlineIndicatorForm"), "submit", (event) => {
    event.preventDefault();
    saveIndicator(event.currentTarget);
  }, "newInlineIndicatorFormSubmit");
  fillSelect("newIndicatorFundInput", state.funds, document.getElementById("newIndicatorFundInput")?.value || state.funds[0]?.id);

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
    fundIds: getMultiSelectValues(document.getElementById("retirementFundInput")),
    annualPercent: toNumber(document.getElementById("retirementPercentInput").value, 0),
  };
  saveState();
  renderDashboardSummaryBand();
  renderKpiSection();
}

function saveIndicator(form = document.getElementById("indicatorForm")) {
  const isInlineForm = form?.id === "newInlineIndicatorForm";
  const id = isInlineForm ? "" : document.getElementById("indicatorIdInput").value;
  const payload = {
    id: id || crypto.randomUUID(),
    name: document.getElementById(isInlineForm ? "newIndicatorNameInput" : "indicatorNameInput").value.trim(),
    fundId: document.getElementById(isInlineForm ? "newIndicatorFundInput" : "indicatorFundInput").value,
    maxAmount: toNumber(document.getElementById(isInlineForm ? "newIndicatorMaxInput" : "indicatorMaxInput").value, 0),
  };

  if (!payload.name || !payload.fundId || payload.maxAmount <= 0) return;

  if (id) {
    state.kpis.indicators = state.kpis.indicators.map((indicator) => (indicator.id === id ? payload : indicator));
  } else {
    state.kpis.indicators.push(payload);
  }

  resetIndicatorForm();
  saveState();
  if (isInlineForm) {
    form.reset();
  } else {
    document.getElementById("indicatorDialog").close();
  }
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
  const fundId = getStandardFundId(row.fondo);
  const status = normalizeTransactionStatus(row.estado);
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
    status,
    symbol,
    fundId,
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
    fundId,
    status,
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
      Object.assign(existing, {
        ...transaction,
        id: existing.id,
        fundId: transaction.fundId || existing.fundId || "",
      });
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

function isCashLikeName(value) {
  const normalized = normalizeHeader(value).replace(/[^a-z0-9]/g, "");
  return ["cashdolares", "cashpesos", "dolares", "pesos", "usd", "ars"].includes(normalized);
}

function isCashLikeInstrumentId(instrumentId) {
  const instrument = findById("instruments", instrumentId);
  return isCashLikeName(instrument?.name);
}

function isBmbInstrumentMovement(kind, symbol) {
  return Boolean(symbol) && !["VARIAS", "MEP"].includes(symbol) && ["BUY", "SELL", "DIVIDEND", "INCOME"].includes(kind);
}

function inferInstrumentTypeId(symbol, kind, currency) {
  const upperSymbol = symbol.toUpperCase();
  if (isCashLikeName(upperSymbol)) return ensureInstrumentType("LIQUID", "Efectivo y liquidez", currency);
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

function getStandardFundId(name) {
  const normalizedName = String(name ?? "").trim();
  if (!normalizedName) return "";
  const existing = state.funds.find((fund) => normalizeHeader(fund.name) === normalizeHeader(normalizedName));
  if (existing) return existing.id;
  const fund = normalizeColoredEntity({
    id: makeStableId("fund", normalizedName),
    name: normalizedName,
    description: "Creado desde importación de transacciones",
  });
  state.funds.push(fund);
  return fund.id;
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
  fillOptionalFundSelect("transactionFundInput", transaction?.fundId ?? "");
  document.getElementById("transactionStatusInput").value = transaction?.status ?? "REALIZADA";
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
    fundId: document.getElementById("transactionFundInput").value,
    status: document.getElementById("transactionStatusInput").value,
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
  if (!Number.isFinite(percent)) return "s/d";
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
  form.classList.toggle("show-quote-fields", kind === "instruments");
  form.classList.toggle("show-instrument-fields", false);
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
  document.getElementById("entityUsesPlatformQuotesInput").checked = false;
  renderPlatformQuotesEditor({});
  document.getElementById("entityDialog").showModal();
}

function saveEntity() {
  const kind = document.getElementById("entityKindInput").value;
  const id = document.getElementById("entityIdInput").value;
  const name = document.getElementById("entityNameInput").value.trim();
  if (!name) return;
  const existingItem = id ? findById(kind, id) : null;

  const payload = {
    id: id || crypto.randomUUID(),
    name,
    description: document.getElementById("entityDescriptionInput").value.trim(),
    color:
      document.getElementById("entityColorInput").dataset.empty === "true"
        ? ""
        : normalizeColor(document.getElementById("entityColorInput").value),
  };

  if (kind === "instrumentTypes") {
    payload.currency = existingItem?.currency ?? "DOLARES";
    payload.quote = toNumber(existingItem?.quote, 1) || 1;
  }

  if (kind === "instruments") {
    payload.currency = document.getElementById("entityCurrencyInput").value;
    payload.quote = toNumber(document.getElementById("entityQuoteInput").value, 0);
    payload.usesPlatformQuotes = false;
    payload.platformQuotes = {};
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
  const editor = document.getElementById("platformQuotesEditor");
  editor.classList.add("is-hidden");
  editor.innerHTML = "";
}

function readPlatformQuotes() {
  return {};
}

function openCotizationsDialog(instrumentId = "") {
  fillSelect("cotizationsInstrumentInput", state.instruments, instrumentId || state.instruments[0]?.id);
  syncCotizationsCurrencyFromInstrument();
  document.getElementById("cotizationsFileInput").value = "";
  document.getElementById("cotizationsImportStatus").textContent = "Seleccioná un instrumento, una moneda y un archivo Excel con las columnas Fecha Cotización y Cierre.";
  document.getElementById("cotizationsDialog").showModal();
}

function openInflationDialog(month = "") {
  const entry = month ? (state.inflation?.rates ?? []).find((item) => item.month === month) : null;
  document.getElementById("inflationDialogTitle").textContent = entry ? "Editar registro" : "Nuevo registro";
  document.getElementById("inflationMonthOriginalInput").value = entry?.month ?? "";
  document.getElementById("inflationMonthInput").value = entry?.month ?? "";
  document.getElementById("inflationUsdInput").value = entry?.usd ?? "";
  document.getElementById("inflationArsInput").value = entry?.ars ?? "";
  document.getElementById("inflationDialog").showModal();
}

function saveInflationEntry() {
  const originalMonth = document.getElementById("inflationMonthOriginalInput").value;
  const month = getMonthStartIso(document.getElementById("inflationMonthInput").value);
  const usd = toNumber(document.getElementById("inflationUsdInput").value, 0);
  const ars = toNumber(document.getElementById("inflationArsInput").value, 0);

  if (!month) {
    alert("Indicá un mes válido.");
    return;
  }

  let rates = [...(state.inflation?.rates ?? [])];
  if (originalMonth) {
    rates = rates.filter((entry) => entry.month !== originalMonth);
  }
  rates.push({ month, usd, ars });
  state.inflation.rates = normalizeInflationRates(rates);
  saveState();
  document.getElementById("inflationDialog").close();
  render();
}

function deleteInflationEntry(month) {
  const confirmed = confirm("¿Eliminar este registro de inflación?");
  if (!confirmed) return;
  state.inflation.rates = (state.inflation?.rates ?? []).filter((entry) => entry.month !== month);
  saveState();
  render();
}

function openInflationImportDialog() {
  document.getElementById("inflationFileInput").value = "";
  document.getElementById("inflationImportStatus").textContent = "Cargá un archivo Excel con MonthYear, InflationDollar e InflationPesos.";
  document.getElementById("inflationImportDialog").showModal();
}

async function importInflationFile() {
  const file = document.getElementById("inflationFileInput").files?.[0];
  if (!file) {
    alert("Primero cargá un archivo Excel.");
    return;
  }

  const status = document.getElementById("inflationImportStatus");
  status.textContent = `Procesando ${file.name}...`;

  try {
    const rows = await parseInflationExcel(file);
    if (!rows.length) throw new Error("No se encontraron filas válidas con MonthYear, InflationDollar e InflationPesos.");
    state.inflation.rates = normalizeInflationRates([...(state.inflation?.rates ?? []), ...rows]);
    saveState();
    document.getElementById("inflationImportDialog").close();
    render();
  } catch (error) {
    status.textContent = error.message ?? "No se pudo importar la inflación.";
    alert(status.textContent);
  }
}

async function parseInflationExcel(file) {
  const workbook = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true });
  const [firstSheetName] = workbook.SheetNames;
  const sheet = workbook.Sheets[firstSheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: "", raw: false });
  return normalizeInflationRates(
    rows.map((row) => ({
      month: parseSpreadsheetDate(getRowValueByHeaders(row, ["monthyear", "month year", "month", "fecha"])),
      usd: parseLocaleNumber(getRowValueByHeaders(row, ["inflationdollar", "inflation dollar", "inflation dolar"])),
      ars: parseLocaleNumber(getRowValueByHeaders(row, ["inflationpesos", "inflation pesos", "inflation peso"])),
    })),
  );
}

function syncCotizationsCurrencyFromInstrument() {
  const instrument = findById("instruments", document.getElementById("cotizationsInstrumentInput").value);
  document.getElementById("cotizationsCurrencyInput").value = normalizeCurrency(instrument?.currency);
}

async function importManualCotizations() {
  const instrumentId = document.getElementById("cotizationsInstrumentInput").value;
  const currency = normalizeCurrency(document.getElementById("cotizationsCurrencyInput").value);
  const file = document.getElementById("cotizationsFileInput").files?.[0];
  if (!instrumentId) {
    alert("Primero elegí un instrumento.");
    return;
  }
  if (!file) {
    alert("Primero cargá un archivo Excel.");
    return;
  }

  const instrument = findById("instruments", instrumentId);
  const status = document.getElementById("cotizationsImportStatus");
  status.textContent = `Procesando ${file.name}...`;

  try {
    const rows = await parseCotizationsExcel(file);
    if (!rows.length) throw new Error("No se encontraron filas válidas con Fecha Cotización y Cierre.");
    const latestRate = rows[rows.length - 1];
    state.marketData.prices[instrumentId] = {
      provider: "manual-file",
      symbol: instrument?.name ?? "",
      currency,
      sourceFile: file.name,
      rates: rows,
      lastSyncAt: new Date().toISOString(),
      lastError: "",
    };
    if (instrument) {
      instrument.currency = currency;
      instrument.quote = latestRate.close;
      instrument.usesPlatformQuotes = false;
      instrument.platformQuotes = {};
    }
    state.marketData.provider = "manual-file";
    state.marketData.lastSyncAt = new Date().toISOString();
    state.marketData.lastError = "";
    saveState();
    await persistManualCotizationsToServer();
    render();
    document.getElementById("cotizationsDialog").close();
  } catch (error) {
    status.textContent = error.message ?? "No se pudieron importar las cotizaciones.";
    alert(status.textContent);
  }
}

async function parseCotizationsExcel(file) {
  const workbook = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true });
  const [firstSheetName] = workbook.SheetNames;
  const sheet = workbook.Sheets[firstSheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: "", raw: false, range: 1 });
  return normalizeHistoricalPriceRows(
    rows
      .map((row) => ({
        date: parseSpreadsheetDate(getRowValueByHeaders(row, ["fecha cotizacion", "fecha de cotizacion", "fecha"])),
        close: parseLocaleNumber(getRowValueByHeaders(row, ["cierre", "precio cierre", "close"])),
      }))
      .filter((row) => row.date && row.close > 0),
  );
}

function getRowValueByHeaders(row, expectedHeaders) {
  const entries = Object.entries(row).map(([key, value]) => [normalizeHeader(key), value]);
  const headerMap = new Map(entries);
  const matchedHeader = expectedHeaders.find((header) => headerMap.has(normalizeHeader(header)));
  return matchedHeader ? headerMap.get(normalizeHeader(matchedHeader)) : "";
}

function parseSpreadsheetDate(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  const text = String(value ?? "").trim();
  if (!text) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const parsed = parseStandardDate(text) || parseIolDate(text) || parseBmbDate(text) || parseBmbSimpleDate(text);
  if (parsed) return parsed;
  const excelDate = Number(text);
  if (Number.isFinite(excelDate) && excelDate > 0 && XLSX.SSF) {
    const parts = XLSX.SSF.parse_date_code(excelDate);
    if (parts?.y && parts?.m && parts?.d) {
      return `${String(parts.y).padStart(4, "0")}-${String(parts.m).padStart(2, "0")}-${String(parts.d).padStart(2, "0")}`;
    }
  }
  return "";
}

async function clearAllManualCotizations() {
  const confirmed = confirm("¿Limpiar todas las cotizaciones cargadas y reiniciar la cotización global de los instrumentos en 1?");
  if (!confirmed) return;

  state.marketData.provider = "manual-file";
  state.marketData.prices = {};
  state.marketData.lastSyncAt = new Date().toISOString();
  state.marketData.lastError = "";
  state.instruments = state.instruments.map((instrument) => ({
    ...instrument,
    quote: 1,
    usesPlatformQuotes: false,
    platformQuotes: {},
  }));

  saveState();
  await persistManualCotizationsToServer();
  render();
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
  if (!select) return;
  select.innerHTML = items.map((item) => `<option value="${item.id}">${escapeHtml(item.name)}</option>`).join("");
  select.value = selectedValue ?? items[0]?.id ?? "";
}

function fillMultiSelect(elementId, items, selectedValues = []) {
  const select = document.getElementById(elementId);
  if (!select) return;
  const selectedSet = new Set(selectedValues?.length ? selectedValues : [items[0]?.id].filter(Boolean));
  select.innerHTML = items.map((item) => `<option value="${item.id}">${escapeHtml(item.name)}</option>`).join("");
  [...select.options].forEach((option) => {
    option.selected = selectedSet.has(option.value);
  });
}

function getMultiSelectValues(select) {
  const values = [...(select?.selectedOptions ?? [])].map((option) => option.value).filter(Boolean);
  return values.length ? values : [state.funds[0]?.id].filter(Boolean);
}

function fillOptionalFundSelect(elementId, selectedValue = "") {
  const select = document.getElementById(elementId);
  if (!select) return;
  select.innerHTML = `<option value="">Sin fondo directo</option>${state.funds.map((fund) => `<option value="${fund.id}">${escapeHtml(fund.name)}</option>`).join("")}`;
  select.value = selectedValue ?? "";
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
  const usdAmount = pricing.currency === "PESOS" ? rawAmount / getLatestBlueRate().sell : rawAmount;
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
  return pricing.currency === "PESOS" ? amount / getLatestBlueRate().sell : amount;
}

function getHoldingPendingUsdValue(holding) {
  return Math.max(0, toNumber(holding.pendingReceivableUsd, 0));
}

function getPricing(instrument, type, platformId) {
  const hasInstrumentQuote = instrument && toNumber(instrument.quote, 0) > 0;
  return {
    currency: hasInstrumentQuote ? instrument.currency : type?.currency ?? "DOLARES",
    quote: hasInstrumentQuote ? toNumber(instrument.quote, 0) : toNumber(type?.quote, 0),
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

function getFundsTotals(fundIds = []) {
  return fundIds.reduce((totals, fundId) => {
    const fundTotals = getFundTotals(fundId);
    return {
      current: totals.current + fundTotals.current,
      pending: totals.pending + fundTotals.pending,
      value: totals.value + fundTotals.value,
    };
  }, { current: 0, pending: 0, value: 0 });
}

function getRetirementFunds(fundIds = []) {
  return fundIds.map((fundId) => findById("funds", fundId)).filter(Boolean);
}

function getRetirementFundsLabel(funds) {
  if (!funds.length) return "Sin fondo";
  if (funds.length <= 2) return funds.map((fund) => fund.name).join(", ");
  return `${funds.length} fondos`;
}

function normalizeRetirementFundIds(retirementSalary = {}) {
  if (Array.isArray(retirementSalary.fundIds) && retirementSalary.fundIds.length) {
    return retirementSalary.fundIds.filter((fundId) => typeof fundId === "string" && fundId);
  }
  if (typeof retirementSalary.fundId === "string" && retirementSalary.fundId) {
    return [retirementSalary.fundId];
  }
  return [seedState.kpis.retirementSalary.fundIds[0]].filter(Boolean);
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
  const chart = new Chart(ctx, {
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
                    text: `${item.label}: ${percent}`,
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
              afterBody(items) {
                const pieItem = pieItems[items[0]?.dataIndex];
                if (!pieItem) return "";
                return getDashboardPerformanceTooltipLines(series[pieItem.legendIndex], formatPercentOneDecimal);
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
    });
  bindDashboardChartContextMenu(chart, filterKey);
  charts.push(chart);
}

function createBarChart(canvasId, series, filterKey) {
  const ctx = document.getElementById(canvasId);
  const total = series.reduce((sum, item) => sum + item.value, 0);
  const seriesColors = getSeriesColors(series);
  const pendingColors = seriesColors.map((color) => lightenColor(color, 0.58));
  const chart = new Chart(ctx, {
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
            hidden: !dashboardBarDatasetVisibility.current,
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
            hidden: !dashboardBarDatasetVisibility.pending,
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
            onClick(_event, legendItem) {
              const key = legendItem.datasetIndex === 0 ? "current" : "pending";
              dashboardBarDatasetVisibility[key] = !dashboardBarDatasetVisibility[key];
              renderCharts();
              refreshIcons();
            },
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
                const lines = [`Total estimado: ${formatUsd.format(series[index].value)}`];
                lines.push(...getDashboardPerformanceTooltipLines(series[index], formatPercentOneDecimal));
                return lines;
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
    });
  bindDashboardChartContextMenu(chart, filterKey);
  charts.push(chart);
}

function isEntityInUse(kind, id) {
  const keyByKind = {
    platforms: "platformId",
    instrumentTypes: "typeId",
    instruments: "instrumentId",
  };

  if (kind === "funds") {
    const retirementFundIds = new Set(state.kpis.retirementSalary.fundIds ?? []);
    return (
      state.holdings.some((holding) => holding.allocations?.some((allocation) => allocation.fundId === id)) ||
      retirementFundIds.has(id) ||
      state.kpis.indicators.some((indicator) => indicator.fundId === id) ||
      state.transactions.some((transaction) => transaction.fundId === id)
    );
  }

  return state.holdings.some((holding) => holding[keyByKind[kind]] === id) || state.transactions.some((transaction) => transaction[keyByKind[kind]] === id);
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
    const currentValue = getCurrentHoldingMarketValueForReturnRow(row);

    openLots.forEach((lot) => {
      const valueShare = totalOpenQuantity > 0 ? lot.remainingQuantity / totalOpenQuantity : 0;
      let lotCurrentValue = currentValue * valueShare;
      let pendingCurrentValue = lot.status === "PENDIENTE" ? lotCurrentValue : 0;
      if (lot.status === "PENDIENTE" && isCashLikeInstrumentId(row.instrumentId) && lotCurrentValue <= 0) {
        lotCurrentValue = lot.remainingCost;
        pendingCurrentValue = lotCurrentValue;
      }
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
        pendingCurrentValue,
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
      group.pendingPurchases = group.lots.reduce((sum, lot) => sum + toNumber(lot.pendingPurchase, 0), 0);
      group.pendingSales = group.lots.reduce((sum, lot) => sum + toNumber(lot.pendingSales, 0), 0);
      group.pendingCurrentValue = group.lots.reduce((sum, lot) => sum + toNumber(lot.pendingCurrentValue, 0), 0);
      group.pendingIncome = group.lots.reduce((sum, lot) => sum + toNumber(lot.pendingDividends, 0), 0);
      group.netPurchases = group.totalPurchases - group.totalSales;
      group.netGain = group.totalSales + group.currentValue + group.totalDividends - group.totalPurchases;
      return group;
    })
    .filter((group) => group.lots.length)
    .sort(compareReturnGroups);
}

function getReturnPositionRow(byPosition, transaction) {
  const key = getReturnPositionKey(transaction);
  if (!byPosition.has(key)) {
    const instrument = findById("instruments", transaction.instrumentId);
    const platform = findById("platforms", transaction.platformId);
    const fundId = getDirectedCashFundId(transaction);
    const fund = findById("funds", fundId);
    byPosition.set(key, {
      instrumentId: transaction.instrumentId,
      platformId: transaction.platformId,
      fundId,
      typeId: transaction.typeId,
      instrumentName: instrument?.name ?? transaction.symbol ?? "Instrumento",
      platformName: fund ? `${platform?.name ?? "Sin plataforma"} · ${fund.name}` : platform?.name ?? "Sin plataforma",
      lots: [],
      sales: [],
    });
  }
  return byPosition.get(key);
}

function getReturnPositionKey(transaction) {
  const fundId = getDirectedCashFundId(transaction);
  return [transaction.platformId, transaction.instrumentId, fundId].join("|");
}

function getDirectedCashFundId(transaction) {
  return transaction.fundId && isCashLikeInstrumentId(transaction.instrumentId) ? transaction.fundId : "";
}

function getCurrentHoldingMarketValueForReturnRow(row) {
  if (!row.fundId || !isCashLikeInstrumentId(row.instrumentId)) {
    return getCurrentHoldingMarketValueForInstrument(row.instrumentId, row.platformId);
  }
  return getHoldingSlices()
    .filter((slice) => slice.fundId === row.fundId && slice.holding.instrumentId === row.instrumentId && slice.holding.platformId === row.platformId)
    .reduce((sum, slice) => sum + slice.current, 0);
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
  const isPending = transaction.status === "PENDIENTE";
  row.lots.push({
    id: transaction.id,
    date: transaction.tradeDate || transaction.settlementDate || todayIsoDate(),
    status: transaction.status ?? "REALIZADA",
    quantity,
    originalQuantity: quantity,
    remainingQuantity: quantity,
    cost,
    originalCost: cost,
    remainingCost: cost,
    realizedProceeds: 0,
    realizedCost: 0,
    usesNotionalQuantity: Boolean(transaction.usesNotionalQuantity),
    fundId: row.fundId,
    pendingPurchase: isPending ? cost : 0,
    dividends: 0,
    pendingDividends: 0,
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
    const pendingPurchasePortion = toNumber(lot.pendingPurchase, 0) * quantityShare;
    const dividendPortion = lot.dividends * quantityShare;
    const pendingDividendPortion = toNumber(lot.pendingDividends, 0) * quantityShare;
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
    lot.pendingPurchase *= remainingShare;
    lot.dividends *= remainingShare;
    lot.pendingDividends *= remainingShare;
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
      pendingPurchase: pendingPurchasePortion,
      pendingSales: transaction.status === "PENDIENTE" ? proceedsPortion : 0,
      pendingDividends: pendingDividendPortion,
      dividendCashflows,
      usesNotionalQuantity: Boolean(transaction.usesNotionalQuantity || lot.usesNotionalQuantity),
      fundId: row.fundId,
      status: transaction.status ?? "REALIZADA",
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
    if (transaction.status === "PENDIENTE") {
      lot.pendingDividends += dividendShare;
    }
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
    existing.pendingPurchase += toNumber(sale.pendingPurchase, 0);
    existing.pendingSales += toNumber(sale.pendingSales, 0);
    existing.pendingDividends += toNumber(sale.pendingDividends, 0);
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

function addDaysIso(date, days) {
  const parsedDate = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(parsedDate.getTime())) return date;
  parsedDate.setUTCDate(parsedDate.getUTCDate() + days);
  return parsedDate.toISOString().slice(0, 10);
}

function dateToUnixSeconds(date) {
  return Math.floor(new Date(`${date}T00:00:00Z`).getTime() / 1000);
}

function unixSecondsToIsoDate(timestamp) {
  return new Date(timestamp * 1000).toISOString().slice(0, 10);
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
window.toggleReturnPortfolioFund = toggleReturnPortfolioFund;
window.moveReturnFund = moveReturnFund;
window.deleteTransaction = deleteTransaction;
window.openIndicatorDialog = openIndicatorDialog;
window.moveIndicator = moveIndicator;
window.deleteIndicator = deleteIndicator;
window.openCotizationsDialog = openCotizationsDialog;
window.openInflationDialog = openInflationDialog;
window.deleteInflationEntry = deleteInflationEntry;
