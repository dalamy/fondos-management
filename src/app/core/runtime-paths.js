const appRootUrl = new URL("../../../", import.meta.url);
const rawAppRootPath = appRootUrl.pathname.replace(/\/$/, "");

export const appRootPath = rawAppRootPath === "/" ? "" : rawAppRootPath;

export function prefersHashRouting() {
  return window.location.protocol === "file:" || window.location.hostname.endsWith(".github.io");
}

export function resolveAppUrl(path) {
  const normalizedPath = String(path || "").replace(/^\/+/, "");
  return new URL(normalizedPath, appRootUrl).toString();
}

export function stripAppRoot(pathname) {
  const rawPath = String(pathname || "").trim() || "/";
  if (!appRootPath) return rawPath;
  if (rawPath === appRootPath || rawPath === `${appRootPath}/`) return "/";
  return rawPath.startsWith(`${appRootPath}/`) ? rawPath.slice(appRootPath.length) : rawPath;
}

export function toAppHistoryPath(pathname) {
  const normalizedPath = normalizeRuntimePath(pathname);
  return `${appRootPath}${normalizedPath}`;
}

export function getHashRoutePath() {
  const rawHash = String(window.location.hash || "").replace(/^#/, "");
  return normalizeRuntimePath(rawHash || "/");
}

function normalizeRuntimePath(pathname) {
  const rawPath = String(pathname || "/").trim();
  if (!rawPath || rawPath === "/") return "/";
  const withLeadingSlash = rawPath.startsWith("/") ? rawPath : `/${rawPath}`;
  return withLeadingSlash.endsWith("/") && withLeadingSlash.length > 1
    ? withLeadingSlash.slice(0, -1)
    : withLeadingSlash;
}