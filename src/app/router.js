import { getSectionById, getSectionByPath, normalizePath } from "./sections/index.js";
import { getHashRoutePath, prefersHashRouting, stripAppRoot, toAppHistoryPath } from "./core/runtime-paths.js";

export function createRouter({ onSectionChange }) {
  const useHashRouting = prefersHashRouting();

  function syncDom(section) {
    document.querySelectorAll(".nav-item").forEach((item) => {
      item.classList.toggle("active", item.dataset.section === section.id);
    });
  }

  function getCurrentPath() {
    return useHashRouting
      ? getHashRoutePath()
      : normalizePath(stripAppRoot(window.location.pathname));
  }

  async function applySection(section, { replace = false, updateHistory = true } = {}) {
    syncDom(section);
    if (updateHistory) {
      const targetPath = normalizePath(section.path);
      const currentPath = getCurrentPath();
      const needsInitialHash = useHashRouting && !window.location.hash;
      if (targetPath !== currentPath || needsInitialHash) {
        const method = replace ? "replaceState" : "pushState";
        const runtimePath = useHashRouting
          ? `${toAppHistoryPath("/")}#${targetPath}`
          : toAppHistoryPath(targetPath);
        window.history[method]({ sectionId: section.id }, "", runtimePath);
      }
    }
    await onSectionChange(section);
  }

  async function navigateToSection(sectionId, options = {}) {
    await applySection(getSectionById(sectionId), options);
  }

  async function handleLocationChange({ replace = false } = {}) {
    await applySection(getSectionByPath(getCurrentPath()), { replace, updateHistory: useHashRouting });
  }

  function start() {
    document.querySelectorAll(".nav-item").forEach((button) => {
      button.addEventListener("click", async (event) => {
        event.preventDefault();
        await navigateToSection(button.dataset.section);
      });
    });

    window.addEventListener("popstate", async () => {
      await handleLocationChange();
    });

    return handleLocationChange({ replace: true });
  }

  return {
    start,
    navigateToSection,
    getCurrentSection() {
      return getSectionByPath(getCurrentPath());
    },
  };
}
