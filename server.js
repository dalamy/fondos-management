const http = require("http");
const fs = require("fs");
const path = require("path");

const preferredPort = Number(process.env.PORT || 8000);
const host = process.env.HOST || "127.0.0.1";
const root = __dirname;
const cotizationsFile = path.join(root, "cotizations.json");
const appRoutes = new Set(["/", "/dashboard", "/kpis", "/tenencias", "/transacciones", "/rendimientos", "/maestros"]);
const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
};

function send(response, status, body, contentType = "text/plain; charset=utf-8") {
  response.writeHead(status, {
    "Content-Type": contentType,
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,PUT,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });
  response.end(body);
}

function getEmptyCotizationsStore() {
  return {
    provider: "manual-file",
    updatedAt: "",
    prices: {},
  };
}

function readCotizationsStore() {
  try {
    if (!fs.existsSync(cotizationsFile)) return getEmptyCotizationsStore();
    const raw = fs.readFileSync(cotizationsFile, "utf8").trim();
    if (!raw) return getEmptyCotizationsStore();
    return JSON.parse(raw);
  } catch {
    return getEmptyCotizationsStore();
  }
}

function handleCotizationsApi(request, response) {
  if (request.method === "GET") {
    send(response, 200, JSON.stringify(readCotizationsStore(), null, 2), "application/json; charset=utf-8");
    return;
  }

  if (request.method !== "PUT") {
    send(response, 405, JSON.stringify({ error: "Método no permitido" }), "application/json; charset=utf-8");
    return;
  }

  let body = "";
  request.on("data", (chunk) => {
    body += chunk;
  });
  request.on("end", () => {
    try {
      const payload = JSON.parse(body || "{}");
      fs.writeFileSync(cotizationsFile, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
      send(response, 200, JSON.stringify({ ok: true }), "application/json; charset=utf-8");
    } catch (error) {
      send(response, 400, JSON.stringify({ error: error.message || "No se pudo guardar cotizations.json" }), "application/json; charset=utf-8");
    }
  });
}

function serveStatic(requestUrl, response) {
  const pathname = decodeURIComponent(requestUrl.pathname);
  const requestedPath = appRoutes.has(pathname) ? "/index.html" : pathname;
  const filePath = path.resolve(root, `.${requestedPath}`);
  if (!filePath.startsWith(root)) {
    send(response, 403, "Forbidden");
    return;
  }

  fs.readFile(filePath, (error, data) => {
    if (error) {
      send(response, 404, "Not found");
      return;
    }
    send(response, 200, data, contentTypes[path.extname(filePath)] || "application/octet-stream");
  });
}

function createAppServer() {
  return http.createServer((request, response) => {
    const requestUrl = new URL(request.url, `http://${request.headers.host}`);
    if (request.method === "OPTIONS") {
      send(response, 204, "");
      return;
    }
    if (requestUrl.pathname === "/api/cotizations") {
      handleCotizationsApi(request, response);
      return;
    }
    serveStatic(requestUrl, response);
  });
}

function listenOnAvailablePort(port, attemptsLeft = 20) {
  const appServer = createAppServer();
  appServer.once("error", (error) => {
    if (error.code === "EADDRINUSE" && attemptsLeft > 0 && !process.env.PORT) {
      listenOnAvailablePort(port + 1, attemptsLeft - 1);
      return;
    }
    throw error;
  });

  appServer.listen(port, host, () => {
    console.log(`Fondos Management disponible en http://${host}:${port}/`);
  });
}

listenOnAvailablePort(preferredPort);
