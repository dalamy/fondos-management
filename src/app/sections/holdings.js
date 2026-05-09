export const holdingsSection = {
  id: "holdings",
  path: "/tenencias",
  templateUrl: "/src/views/sections/holdings.html",
  async mount(context) {
    await context.loadSectionTemplate(this.templateUrl);
    context.bindHoldingCrud();
  },
  render(context) {
    context.renderHoldings();
  },
  showDashboardSummary: false,
};
