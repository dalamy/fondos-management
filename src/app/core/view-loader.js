const templateCache = new Map();

export async function loadSectionTemplate(hostElement, templateUrl) {
  if (!hostElement) return;
  if (!templateCache.has(templateUrl)) {
    const response = await fetch(templateUrl, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`No se pudo cargar la vista ${templateUrl} (${response.status}).`);
    }
    templateCache.set(templateUrl, await response.text());
  }
  hostElement.innerHTML = templateCache.get(templateUrl);
}
