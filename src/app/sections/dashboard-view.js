export function renderDashboardSummary({
  total,
  currentTotal,
  pendingTotal,
  hasFilters,
  portfolioReturn,
  retirementSnapshot,
  latestBlueRate,
  formatUsd,
  formatNumber,
  formatPercentOneDecimal,
  formatDisplayDate,
}) {
  document.getElementById("globalTotal").textContent = formatUsd.format(total);
  document.getElementById("globalTotalMeta").textContent = pendingTotal > 0
    ? `${formatUsd.format(currentTotal)} + ${formatUsd.format(pendingTotal)} por cobrar`
    : hasFilters
      ? "Resultado filtrado en USD"
      : "Calculada en USD";

  document.getElementById("portfolioReturnValue").textContent = portfolioReturn
    ? formatPercentOneDecimal(portfolioReturn.totalReturnPercent * 100)
    : "s/d";
  document.getElementById("portfolioReturnMeta").textContent = portfolioReturn
    ? `TIR ${portfolioReturn.xirr === null ? "s/d" : formatPercentOneDecimal(portfolioReturn.xirr * 100)}`
    : "Sin transacciones suficientes";

  document.getElementById("dashboardRetirementValue").textContent = formatUsd.format(retirementSnapshot.monthlySalary);
  document.getElementById("dashboardRetirementMeta").textContent = retirementSnapshot.pending > 0
    ? `${retirementSnapshot.fundName} · ${formatUsd.format(retirementSnapshot.estimatedMonthlySalary)} al cobrar`
    : `${retirementSnapshot.fundName} · ${formatNumber.format(retirementSnapshot.annualPercent)}% anual`;

  document.getElementById("arsUsdDisplay").textContent = `$${formatNumber.format(latestBlueRate.sell)}`;
  document.getElementById("arsUsdMeta").textContent = latestBlueRate.date
    ? formatDisplayDate(latestBlueRate.date)
    : "Sin fecha";
}

export function buildDashboardChartSpecs({ aggregateByFund, aggregateBy, dashboardFilters, performanceByFundId, performanceByInstrumentId }) {
  return [
    { id: "fund", title: "Por Fondo", filterKey: "fundIds", series: enrichSeries(aggregateByFund("fundIds"), performanceByFundId) },
    { id: "instrument", title: "Por Instrumento", filterKey: "instrumentIds", series: enrichSeries(aggregateBy("instruments", "instrumentId", "instrumentIds"), performanceByInstrumentId) },
    { id: "platform", title: "Por Plataforma", filterKey: "platformIds", series: aggregateBy("platforms", "platformId", "platformIds") },
    { id: "type", title: "Por Tipo de Instrumento", filterKey: "typeIds", series: aggregateBy("instrumentTypes", "typeId", "typeIds") },
  ].map((spec) => ({
    ...spec,
    activeCount: dashboardFilters[spec.filterKey].size,
  }));
}

function enrichSeries(series, metricsById = new Map()) {
  return series.map((item) => ({
    ...item,
    performance: metricsById.get(item.id) ?? null,
  }));
}

export function getDashboardPerformanceTooltipLines(item, formatPercentOneDecimal) {
  if (!item?.performance) return [];
  return [
    `Rendimiento: ${formatPercentOneDecimal(item.performance.totalReturnPercent * 100)}`,
    `TIR: ${Number.isFinite(item.performance.xirr) ? formatPercentOneDecimal(item.performance.xirr * 100) : "s/d"}`,
  ];
}
