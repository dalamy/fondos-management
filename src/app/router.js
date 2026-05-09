import { getSectionById, getSectionByPath, normalizePath } from "./sections/index.js";

export function createRouter({ onSectionChange }) {
  function syncDom(section) {
    document.querySelectorAll(".nav-item").forEach((item) => {
      item.classList.toggle("active", item.dataset.section === section.id);
    });
  }

  async function applySection(section, { replace = false, updateHistory = true } = {}) {
    syncDom(section);
    if (updateHistory) {
      const targetPath = normalizePath(section.path);
      const currentPath = normalizePath(window.location.pathname);
      if (targetPath !== currentPath) {
        const method = replace ? "replaceState" : "pushState";
        window.history[method]({ sectionId: section.id }, "", targetPath);
      }
    }
    await onSectionChange(section);
  }

  async function navigateToSection(sectionId, options = {}) {
    await applySection(getSectionById(sectionId), options);
  }

  async function handleLocationChange({ replace = false } = {}) {
    await applySection(getSectionByPath(window.location.pathname), { replace, updateHistory: false });
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
      return getSectionByPath(window.location.pathname);
    },
  };
}
