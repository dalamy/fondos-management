const fs = require("fs");
const path = require("path");

const API_BASE_URL = "https://api.invertironline.com";
const TOKEN_URL = `${API_BASE_URL}/token`;
const COUNTRY = "argentina";
const MARKET = "bCBA";
const TICKERS_FILE = path.join(__dirname, "tickers.json");
const OUTPUT_FILE = path.join(__dirname, "iol-supported-tickers.json");
const ENV_FILE = path.join(__dirname, ".env");
const INSTRUMENT_NAMES_TO_SCAN = new Set(["Acciones", "Bonos"]);

loadDotEnvFile(ENV_FILE);

async function main() {
  const requestedTickers = normalizeRequestedTickers(readJsonFile(TICKERS_FILE));
  const client = new IolClient({
    username: process.env.IOL_USERNAME,
    password: process.env.IOL_PASSWORD,
  });

  await client.authenticate();

  const availableInstruments = await client.fetchAvailableInstruments();
  const scannedInstruments = availableInstruments.filter((item) => INSTRUMENT_NAMES_TO_SCAN.has(item.instrumento));
  const panelCatalog = [];
  const symbolIndex = new Map();

  for (const instrument of scannedInstruments) {
    const panels = await client.fetchPanels(instrument.instrumento);
    for (const panel of panels) {
      const titles = await client.fetchTitlesByPanel(instrument.instrumento, panel.panel);
      panelCatalog.push({
        instrument: instrument.instrumento,
        panel: panel.panel,
        titleCount: titles.length,
      });
      titles.forEach((title) => registerCatalogSymbol(symbolIndex, instrument.instrumento, panel.panel, title));
    }
  }

  const requestedSymbols = flattenRequestedSymbols(requestedTickers);
  const requestedValidation = {};

  for (const requested of requestedSymbols) {
    const catalogEntry = symbolIndex.get(requested.symbol);
    const directLookup = await client.lookupSymbol(requested.symbol);
    const historicalProbe = await client.probeHistoricalSeries(requested.symbol);

    requestedValidation[requested.symbol] = {
      symbol: requested.symbol,
      categories: requested.categories,
      foundInCatalog: Boolean(catalogEntry),
      catalogMatches: catalogEntry?.matches ?? [],
      directLookup,
      historicalProbe,
    };

    if (directLookup.found) {
      registerCatalogSymbol(symbolIndex, directLookup.instrumentName || "DirectLookup", directLookup.panel || "lookup", {
        simbolo: requested.symbol,
        descripcion: directLookup.description,
      }, "lookup");
    }
  }

  const output = {
    provider: "invertironline",
    country: COUNTRY,
    marketLookup: MARKET,
    builtAt: new Date().toISOString(),
    sourceTickersFile: path.basename(TICKERS_FILE),
    scannedInstruments: scannedInstruments.map((item) => item.instrumento),
    availableInstruments,
    panelCatalog,
    symbolCount: symbolIndex.size,
    requestedTickers,
    requestedValidation,
    requestedSummary: buildRequestedSummary(requestedValidation),
    symbols: Object.fromEntries(
      [...symbolIndex.entries()]
        .sort((left, right) => left[0].localeCompare(right[0]))
        .map(([symbol, entry]) => [symbol, normalizeSymbolCatalogEntry(entry)])
    ),
  };

  writeJsonFile(OUTPUT_FILE, output);
  console.log(`Catalogo generado: ${OUTPUT_FILE}`);
}

class IolClient {
  constructor({ username, password }) {
    this.username = username;
    this.password = password;
    this.accessToken = "";
    this.refreshToken = "";
    this.expiresAt = 0;
  }

  async authenticate() {
    if (!this.username || !this.password) {
      throw new Error("Faltan credenciales. Define IOL_USERNAME e IOL_PASSWORD en el entorno o en .env.");
    }
    await this.requestToken(new URLSearchParams({
      username: this.username,
      password: this.password,
      grant_type: "password",
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

  async ensureAccessToken() {
    if (!this.accessToken || Date.now() >= this.expiresAt) {
      await this.refreshAccessToken();
    }
  }

  async fetchJson(url, defaultMessage) {
    await this.ensureAccessToken();
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        Accept: "application/json",
      },
    });

    if (response.status === 401) {
      await this.refreshAccessToken();
      return this.fetchJson(url, defaultMessage);
    }

    const payload = await parseJsonResponse(response, defaultMessage);
    if (!response.ok) {
      const message = payload.message || payload.error_description || payload.error || defaultMessage;
      throw new Error(message);
    }
    return payload;
  }

  async fetchAvailableInstruments() {
    const payload = await this.fetchJson(
      `${API_BASE_URL}/api/v2/${COUNTRY}/Titulos/Cotizacion/Instrumentos`,
      "No se pudo obtener la lista de instrumentos IOL."
    );
    return Array.isArray(payload) ? payload : [];
  }

  async fetchPanels(instrumentName) {
    const payload = await this.fetchJson(
      `${API_BASE_URL}/api/v2/${COUNTRY}/Titulos/Cotizacion/Paneles/${encodeURIComponent(instrumentName)}`,
      `No se pudieron obtener los paneles para ${instrumentName}.`
    );
    return Array.isArray(payload) ? payload : [];
  }

  async fetchTitlesByPanel(instrumentName, panelName) {
    const payload = await this.fetchJson(
      `${API_BASE_URL}/api/v2/Cotizaciones/${encodeURIComponent(instrumentName)}/${encodeURIComponent(panelName)}/${COUNTRY}`,
      `No se pudieron obtener cotizaciones para ${instrumentName} / ${panelName}.`
    );
    return Array.isArray(payload?.titulos) ? payload.titulos : [];
  }

  async lookupSymbol(symbol) {
    try {
      const payload = await this.fetchJson(
        `${API_BASE_URL}/api/v2/${MARKET}/Titulos/${encodeURIComponent(symbol)}`,
        `No se pudo consultar el simbolo ${symbol}.`
      );
      return {
        found: true,
        description: payload.descripcion || payload.titulo || "",
        currency: payload.moneda || payload.simboloMoneda || "",
        type: payload.tipo || payload.tipoInstrumento || "",
        raw: payload,
      };
    } catch (error) {
      return {
        found: false,
        error: error.message || `No se pudo consultar ${symbol}.`,
      };
    }
  }

  async probeHistoricalSeries(symbol) {
    const fromDate = addDaysIso(todayIsoDate(), -7);
    const toDate = todayIsoDate();
    const variants = ["ajustada", "base"];

    for (const variant of variants) {
      try {
        const payload = await this.fetchJson(
          buildHistoricalSeriesUrl(symbol, fromDate, toDate, variant),
          `No se pudo consultar la serie historica para ${symbol}.`
        );
        const rows = extractHistoricalRows(payload);
        if (rows.length) {
          return {
            success: true,
            variant,
            fromDate,
            toDate,
            rowCount: rows.length,
            sample: rows.slice(-3),
          };
        }
      } catch (error) {
        if (variant === variants[variants.length - 1]) {
          return {
            success: false,
            variant,
            fromDate,
            toDate,
            error: error.message || `No se pudo consultar la serie historica para ${symbol}.`,
          };
        }
      }
    }

    return {
      success: false,
      variant: "base",
      fromDate,
      toDate,
      error: `IOL no devolvio historia para ${symbol}.`,
    };
  }
}

function normalizeRequestedTickers(symbolsByCategory) {
  const normalized = {};
  Object.entries(symbolsByCategory || {}).forEach(([category, symbols]) => {
    normalized[String(category || "").trim().toUpperCase()] = [...new Set((Array.isArray(symbols) ? symbols : []).map((value) => String(value || "").trim().toUpperCase()).filter(Boolean))].sort();
  });
  return normalized;
}

function flattenRequestedSymbols(requestedTickers) {
  const bySymbol = new Map();
  Object.entries(requestedTickers).forEach(([category, symbols]) => {
    symbols.forEach((symbol) => {
      if (!bySymbol.has(symbol)) {
        bySymbol.set(symbol, { symbol, categories: [] });
      }
      const entry = bySymbol.get(symbol);
      if (!entry.categories.includes(category)) {
        entry.categories.push(category);
      }
    });
  });
  return [...bySymbol.values()].sort((left, right) => left.symbol.localeCompare(right.symbol));
}

function registerCatalogSymbol(index, instrumentName, panelName, title, source = "panel") {
  const symbol = String(title?.simbolo || title?.symbol || "").trim().toUpperCase();
  if (!symbol) return;
  if (!index.has(symbol)) {
    index.set(symbol, {
      symbol,
      descriptions: new Set(),
      matches: [],
    });
  }
  const entry = index.get(symbol);
  const description = String(title?.descripcion || title?.description || "").trim();
  if (description) {
    entry.descriptions.add(description);
  }
  const exists = entry.matches.some((item) => item.instrument === instrumentName && item.panel === panelName && item.source === source);
  if (!exists) {
    entry.matches.push({
      instrument: instrumentName,
      panel: panelName,
      source,
    });
  }
}

function normalizeSymbolCatalogEntry(entry) {
  return {
    symbol: entry.symbol,
    descriptions: [...entry.descriptions].sort(),
    matches: entry.matches.sort((left, right) => {
      const leftKey = `${left.instrument}|${left.panel}|${left.source}`;
      const rightKey = `${right.instrument}|${right.panel}|${right.source}`;
      return leftKey.localeCompare(rightKey);
    }),
  };
}

function buildRequestedSummary(requestedValidation) {
  const values = Object.values(requestedValidation || {});
  return {
    requestedCount: values.length,
    foundInCatalogCount: values.filter((item) => item.foundInCatalog).length,
    directLookupCount: values.filter((item) => item.directLookup?.found).length,
    historicalProbeCount: values.filter((item) => item.historicalProbe?.success).length,
    historicalProbeFailures: values.filter((item) => !item.historicalProbe?.success).map((item) => ({
      symbol: item.symbol,
      error: item.historicalProbe?.error || "Sin respuesta historica.",
    })),
  };
}

function extractHistoricalRows(payload) {
  const sourceRows = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.data)
      ? payload.data
      : Array.isArray(payload?.serieHistorica)
        ? payload.serieHistorica
        : Array.isArray(payload?.cotizaciones)
          ? payload.cotizaciones
          : [];
  return sourceRows
    .map((row) => ({
      date: sanitizeIsoDate(row?.fechaHora || row?.fecha || row?.date),
      close: toPositiveNumber(row?.ultimoPrecio ?? row?.cierre ?? row?.close ?? row?.price),
    }))
    .filter((row) => row.date && row.close !== null);
}

function buildHistoricalSeriesUrl(symbol, fromDate, toDate, variant) {
  const basePath = `${API_BASE_URL}/api/v2/${MARKET}/Titulos/${encodeURIComponent(symbol)}/Cotizacion/seriehistorica/${fromDate}/${toDate}`;
  return variant === "ajustada" ? `${basePath}/ajustada` : basePath;
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

function readJsonFile(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
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

function todayIsoDate() {
  const now = new Date();
  const localDate = new Date(now.getTime() - now.getTimezoneOffset() * 60 * 1000);
  return localDate.toISOString().slice(0, 10);
}

function addDaysIso(date, days) {
  const parsedDate = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(parsedDate.getTime())) return date;
  parsedDate.setUTCDate(parsedDate.getUTCDate() + days);
  return parsedDate.toISOString().slice(0, 10);
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