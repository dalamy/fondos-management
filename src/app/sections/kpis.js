export const kpisSection = {
  id: "kpis",
  path: "/kpis",
  templateUrl: "/src/views/sections/kpis.html",
  async mount(context) {
    await context.loadSectionTemplate(this.templateUrl);
    context.bindKpis();
  },
  render(context) {
    context.renderKpiSection();
  },
  showDashboardSummary: false,
};
