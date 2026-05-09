const fs = require("fs");
const path = require("path");

const API_BASE_URL = "https://api.invertironline.com";
const TOKEN_URL = `${API_BASE_URL}/token`;
const MARKET = "bCBA";
const DEFAULT_START_DATE = "2024-01-01";
const TICKERS_FILE = path.join(__dirname, "tickers.json");
const COTIZATIONS_FILE = path.join(__dirname, "cotizations.json");
const ENV_FILE = path.join(__dirname, ".env");

loadDotEnvFile(ENV_FILE);

async function main() {
  const options = parseCliOptions(process.argv.slice(2));
  const symbolsByCategory = readJsonFile(TICKERS_FILE);
  const symbolEntries = normalizeTickerList(symbolsByCategory, options.categories);
  const existingStore = normalizeCotizationsStore(readJsonFileIfExists(COTIZATIONS_FILE));
  const client = new IolClient({
    username: process.env.IOL_USERNAME,
    password: process.env.IOL_PASSWORD,
  });

  await client.authenticate();

  const nextStore = {
    ...existingStore,
    provider: "invertironline",
    market: MARKET,
    adjusted: true,
    startDate: DEFAULT_START_DATE,
    tickersFile: path.basename(TICKERS_FILE),
    requestedCategories: options.categories,
    updatedAt: new Date().toISOString(),
    instruments: { ...existingStore.instruments },
  };

  if (!symbolEntries.length) {
    throw new Error(`No se encontraron tickers para las categorias solicitadas: ${options.categories.join(", ")}`);
  }

  for (const entry of symbolEntries) {
    const existingInstrument = normalizeInstrumentEntry(nextStore.instruments[entry.symbol], entry);
    const lastSavedDate = getLastSavedDate(existingInstrument.history);
    const fromDate = lastSavedDate || DEFAULT_START_DATE;
    const toDate = todayIsoDate();

    console.log(`Sincronizando ${entry.symbol} (${fromDate} -> ${toDate})`);

    let mergedHistory = existingInstrument.history;
    let lastError = "";
    try {
      const fetchedHistory = fromDate > toDate ? [] : await client.fetchHistoricalSeries(entry.symbol, fromDate, toDate);
      mergedHistory = mergeHistoricalRows(existingInstrument.history, fetchedHistory);
    } catch (error) {
      lastError = error.message || "No se pudo actualizar la serie historica.";
      console.warn(`[${entry.symbol}] ${lastError}`);
    }

    nextStore.instruments[entry.symbol] = {
      symbol: entry.symbol,
      market: MARKET,
      categories: entry.categories,
      history: mergedHistory,
      endpointVariant: client.lastEndpointVariant,
      lastRequestedFromDate: fromDate,
      lastAvailableDate: getLastSavedDate(mergedHistory),
      lastSyncAt: new Date().toISOString(),
      lastError,
    };
  }

  nextStore.summary = buildSummary(nextStore.instruments);
  writeJsonFile(COTIZATIONS_FILE, nextStore);
  console.log(`Archivo actualizado: ${COTIZATIONS_FILE}`);
}

class IolClient {
  constructor({ username, password }) {
    this.username = username;
    this.password = password;
    this.accessToken = "";
    this.refreshToken = "";
    this.expiresAt = 0;
    this.lastEndpointVariant = "ajustada";
  }

  async authenticate() {
    if (!this.username || !this.password) {
      throw new Error("Faltan credenciales. Define IOL_USERNAME e IOL_PASSWORD en el entorno antes de ejecutar el script.");
    }
    await this.requestToken(new URLSearchParams({
      username: this.username,
      password: this.password,
      grant_type: "password",
    }));
  }

  async refreshAccessToken() {
    if (!this.refreshToken) {
      await this.authenticate();
      return;
    }
    await this.requestToken(new URLSearchParams({
      refresh_token: this.refreshToken,
      grant_type: "refresh_token",
    }));
  }

  async requestToken(body) {
    const response = await fetch(TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: body.toString(),
    });
    const payload = await parseJsonResponse(response, "No se pudo autenticar contra IOL.");
    this.accessToken = payload.access_token || "";
    this.refreshToken = payload.refresh_token || "";
    this.expiresAt = Date.now() + Math.max(Number(payload.expires_in || 0) - 30, 30) * 1000;
    if (!this.accessToken) {
      throw new Error("IOL no devolvio access_token.");
    }
  }

  async ensureAccessToken() {
    if (!this.accessToken || Date.now() >= this.expiresAt) {
      await this.refreshAccessToken();
    }
  }

  async fetchHistoricalSeries(symbol, fromDate, toDate) {
    await this.ensureAccessToken();
    const variants = ["ajustada", "base"];
    let lastError = null;

    for (const variant of variants) {
      const response = await fetch(buildHistoricalSeriesUrl(symbol, fromDate, toDate, variant), {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          Accept: "application/json",
        },
      });

      if (response.status === 401) {
        await this.refreshAccessToken();
        return this.fetchHistoricalSeries(symbol, fromDate, toDate);
      }

      const payload = await parseJsonResponse(response, `IOL respondio ${response.status} para ${symbol}.`);
      if (!response.ok) {
        const message = payload.message || payload.error_description || payload.error || `IOL respondio ${response.status}.`;
        lastError = new Error(message);
        continue;
      }

      const rows = extractHistoricalRows(payload, symbol, fromDate, toDate);
      this.lastEndpointVariant = variant;
      return rows;
    }

    throw lastError || new Error(`IOL no devolvio cotizaciones historicas para ${symbol} en el rango solicitado.`);
  }
}

function normalizeTickerList(symbolsByCategory, selectedCategories = []) {
  const normalizedSelection = new Set(normalizeCategories(selectedCategories));
  const entriesBySymbol = new Map();
  Object.entries(symbolsByCategory || {}).forEach(([category, symbols]) => {
    if (normalizedSelection.size > 0 && !normalizedSelection.has(String(category || "").trim().toUpperCase())) return;
    if (!Array.isArray(symbols)) return;
    symbols.forEach((rawSymbol) => {
      const symbol = String(rawSymbol || "").trim().toUpperCase();
      if (!symbol) return;
      if (!entriesBySymbol.has(symbol)) {
        entriesBySymbol.set(symbol, { symbol, categories: [] });
      }
      const entry = entriesBySymbol.get(symbol);
      if (!entry.categories.includes(category)) {
        entry.categories.push(category);
      }
    });
  });
  return [...entriesBySymbol.values()].sort((left, right) => left.symbol.localeCompare(right.symbol));
}

function normalizeCotizationsStore(store) {
  return {
    provider: store?.provider || "invertironline",
    market: store?.market || MARKET,
    adjusted: store?.adjusted ?? true,
    startDate: store?.startDate || DEFAULT_START_DATE,
    tickersFile: store?.tickersFile || path.basename(TICKERS_FILE),
    requestedCategories: normalizeCategories(store?.requestedCategories || []),
    updatedAt: store?.updatedAt || "",
    summary: store?.summary || {
      totalInstruments: 0,
      instrumentsWithData: 0,
      totalRows: 0,
      latestDate: "",
    },
    instruments: Object.fromEntries(
      Object.entries(store?.instruments || {}).map(([symbol, entry]) => [symbol, normalizeInstrumentEntry(entry, { symbol })])
    ),
  };
}

function normalizeInstrumentEntry(entry, fallback = {}) {
  return {
    symbol: String(entry?.symbol || fallback.symbol || "").trim().toUpperCase(),
    market: entry?.market || MARKET,
    categories: normalizeCategories(entry?.categories || fallback.categories || []),
    history: normalizeHistoricalRows(entry?.history || []),
    endpointVariant: entry?.endpointVariant || "",
    lastRequestedFromDate: sanitizeIsoDate(entry?.lastRequestedFromDate),
    lastAvailableDate: sanitizeIsoDate(entry?.lastAvailableDate),
    lastSyncAt: entry?.lastSyncAt || "",
    lastError: entry?.lastError || "",
  };
}

function normalizeCategories(categories) {
  return [...new Set((Array.isArray(categories) ? categories : []).map((value) => String(value || "").trim()).filter(Boolean))].sort();
}

function normalizeHistoricalRows(rows) {
  const byDate = new Map();
  (Array.isArray(rows) ? rows : []).forEach((row) => {
    const date = sanitizeIsoDate(row?.date || row?.fecha || row?.fechaHora);
    const close = toPositiveNumber(row?.close ?? row?.cierre ?? row?.price ?? row?.ultimoPrecio ?? row?.ultimo);
    if (!date || close === null) return;
    byDate.set(date, { date, close });
  });
  return [...byDate.values()].sort((left, right) => left.date.localeCompare(right.date));
}

function mergeHistoricalRows(existingRows, fetchedRows) {
  return normalizeHistoricalRows([...(existingRows || []), ...(fetchedRows || [])]);
}

function extractHistoricalRows(payload, symbol, fromDate, toDate) {
  const sourceRows = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.data)
      ? payload.data
      : Array.isArray(payload?.serieHistorica)
        ? payload.serieHistorica
        : Array.isArray(payload?.cotizaciones)
          ? payload.cotizaciones
          : [];

  const rows = normalizeHistoricalRows(sourceRows).filter((row) => row.date >= fromDate && row.date <= toDate);
  if (!rows.length) {
    throw new Error(`IOL no devolvio cotizaciones historicas para ${symbol} en el rango solicitado.`);
  }
  return rows;
}

function buildSummary(instruments) {
  const values = Object.values(instruments || {});
  const latestDate = values.reduce((latest, instrument) => {
    const candidate = instrument.lastAvailableDate || "";
    return candidate > latest ? candidate : latest;
  }, "");
  return {
    totalInstruments: values.length,
    instrumentsWithData: values.filter((instrument) => instrument.history.length > 0).length,
    totalRows: values.reduce((sum, instrument) => sum + instrument.history.length, 0),
    latestDate,
  };
}

async function parseJsonResponse(response, defaultMessage) {
  const rawBody = await response.text();
  try {
    return rawBody ? JSON.parse(rawBody) : {};
  } catch {
    if (response.ok) {
      throw new Error(defaultMessage);
    }
    throw new Error(rawBody || defaultMessage);
  }
}

function parseCliOptions(argv) {
  const rawCategories = [];
  for (let index = 0; index < argv.length; index += 1) {
    const value = String(argv[index] || "").trim();
    if (!value) continue;
    if (value === "--category" || value === "-c") {
      const nextValue = String(argv[index + 1] || "").trim();
      if (!nextValue) {
        throw new Error("Debes indicar una categoria despues de --category.");
      }
      rawCategories.push(...nextValue.split(","));
      index += 1;
      continue;
    }
    if (value.startsWith("--category=")) {
      rawCategories.push(...value.slice("--category=".length).split(","));
      continue;
    }
    rawCategories.push(...value.split(","));
  }

  return {
    categories: normalizeCategories(rawCategories),
  };
}

function buildHistoricalSeriesUrl(symbol, fromDate, toDate, variant) {
  const basePath = `${API_BASE_URL}/api/v2/${MARKET}/Titulos/${encodeURIComponent(symbol)}/Cotizacion/seriehistorica/${fromDate}/${toDate}`;
  return variant === "ajustada" ? `${basePath}/ajustada` : basePath;
}

function readJsonFile(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function readJsonFileIfExists(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return readJsonFile(filePath);
}

function writeJsonFile(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function loadDotEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/u);
  lines.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;
    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex <= 0) return;
    const key = trimmed.slice(0, separatorIndex).trim();
    if (!key || process.env[key]) return;
    let value = trimmed.slice(separatorIndex + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  });
}

function getLastSavedDate(history) {
  return Array.isArray(history) && history.length ? history[history.length - 1].date : "";
}

function todayIsoDate() {
  const now = new Date();
  const localDate = new Date(now.getTime() - now.getTimezoneOffset() * 60 * 1000);
  return localDate.toISOString().slice(0, 10);
}

function sanitizeIsoDate(value) {
  const normalized = String(value || "").trim().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized : "";
}

function toPositiveNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

main().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});