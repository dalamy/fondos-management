export function bindOnce(element, eventName, handler, bindingKey = eventName) {
  if (!element) return;
  const key = `bound${bindingKey}`;
  if (element.dataset[key] === "true") return;
  element.dataset[key] = "true";
  element.addEventListener(eventName, handler);
}
