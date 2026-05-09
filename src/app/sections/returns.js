export const returnsSection = {
  id: "returns",
  path: "/rendimientos",
  templateUrl: "/src/views/sections/returns.html",
  async mount(context) {
    await context.loadSectionTemplate(this.templateUrl);
    context.bindReturns();
  },
  render(context) {
    context.renderReturns();
  },
  showDashboardSummary: false,
};
