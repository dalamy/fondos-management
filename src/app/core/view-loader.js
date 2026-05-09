import { resolveAppUrl } from "./runtime-paths.js";

const templateCache = new Map();

export async function loadSectionTemplate(hostElement, templateUrl) {
  if (!hostElement) return;
  const requestUrl = resolveAppUrl(templateUrl);
  if (!templateCache.has(requestUrl)) {
    const response = await fetch(requestUrl, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`No se pudo cargar la vista ${templateUrl} (${response.status}).`);
    }
    templateCache.set(requestUrl, await response.text());
  }
  hostElement.innerHTML = templateCache.get(requestUrl);
}
