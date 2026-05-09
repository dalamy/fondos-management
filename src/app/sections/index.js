import { dashboardSection } from "./dashboard.js";
import { kpisSection } from "./kpis.js";
import { holdingsSection } from "./holdings.js";
import { transactionsSection } from "./transactions.js";
import { returnsSection } from "./returns.js";
import { mastersSection } from "./masters.js";

export const appSections = [
  dashboardSection,
  kpisSection,
  holdingsSection,
  transactionsSection,
  returnsSection,
  mastersSection,
];

export function getSectionById(sectionId) {
  return appSections.find((section) => section.id === sectionId) ?? dashboardSection;
}

export function getSectionByPath(pathname) {
  const normalizedPath = normalizePath(pathname);
  return appSections.find((section) => section.path === normalizedPath) ?? dashboardSection;
}

export function normalizePath(pathname) {
  const rawPath = String(pathname || "/").trim();
  if (!rawPath || rawPath === "/") return "/dashboard";
  return rawPath.endsWith("/") && rawPath.length > 1 ? rawPath.slice(0, -1) : rawPath;
}
