export const transactionsSection = {
  id: "transactions",
  path: "/transacciones",
  templateUrl: "/src/views/sections/transactions.html",
  async mount(context) {
    await context.loadSectionTemplate(this.templateUrl);
    context.bindTransactions();
  },
  render(context) {
    context.renderTransactions();
  },
  showDashboardSummary: false,
};
