export const mastersSection = {
  id: "masters",
  path: "/maestros",
  templateUrl: "/src/views/sections/masters.html",
  async mount(context) {
    await context.loadSectionTemplate(this.templateUrl);
    context.bindEntityCrud();
    context.bindCotizations();
    context.bindInflation();
  },
  render(context) {
    context.renderMasterLists();
  },
  showDashboardSummary: false,
};
