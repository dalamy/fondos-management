export const dashboardSection = {
  id: "dashboard",
  path: "/dashboard",
  templateUrl: "/src/views/sections/dashboard.html",
  async mount(context) {
    await context.loadSectionTemplate(this.templateUrl);
  },
  render(context) {
    context.renderDashboard();
  },
  showDashboardSummary: true,
};
