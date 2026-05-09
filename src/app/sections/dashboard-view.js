export function renderDashboardSummary({
  total,
  currentTotal,
  pendingTotal,
  hasFilters,
  portfolioReturn,
  includedPortfolioFunds,
  inflationAdjusted,
  retirementSnapshot,
  latestBlueRate,
  formatUsd,
  formatNumber,
  formatPercentOneDecimal,
  formatDisplayDate,
}) {
  document.querySelectorAll(".kpi-info-panel").forEach((panel) => {
    panel.hidden = true;
  });
  document.querySelectorAll(".kpi-info-trigger").forEach((button) => {
    button.setAttribute("aria-expanded", "false");
  });

  const portfolioReturnLabel = document.getElementById("portfolioReturnLabel");
  if (portfolioReturnLabel) {
    portfolioReturnLabel.textContent = inflationAdjusted ? "Rendimiento general *" : "Rendimiento general";
  }

  document.getElementById("globalTotal").textContent = formatUsd.format(total);
  document.getElementById("globalTotalMeta").textContent = pendingTotal > 0
    ? `${formatUsd.format(currentTotal)} + ${formatUsd.format(pendingTotal)} por cobrar`
    : hasFilters
      ? "Resultado filtrado en U$D"
      : "Calculada en U$D";

  const portfolioReturnCard = document.getElementById("portfolioReturnCard");
  const portfolioReturnInfo = document.getElementById("portfolioReturnInfoContent");
  if (portfolioReturnInfo) {
    portfolioReturnInfo.innerHTML = renderInfoLines([
      inflationAdjusted ? "* Ajustado por inflacion segun la configuracion de rendimientos." : "",
      includedPortfolioFunds?.length ? `Fondos incluidos: ${includedPortfolioFunds.join(", ")}` : "Sin fondos incluidos en la cartera general.",
      portfolioReturn ? `Rendimiento acumulado: ${formatPercentOneDecimal(portfolioReturn.totalReturnPercent * 100)}` : "Rendimiento acumulado: s/d",
      portfolioReturn ? `TIR: ${portfolioReturn.xirr === null ? "s/d" : formatPercentOneDecimal(portfolioReturn.xirr * 100)}` : "TIR: s/d",
    ]);
  }

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

  const retirementInfo = document.getElementById("dashboardRetirementInfoContent");
  if (retirementInfo) {
    retirementInfo.innerHTML = renderInfoLines([
      `Es una estimacion de retiro mensual basada en retirar ${formatNumber.format(retirementSnapshot.annualPercent)}% al año del capital seleccionado y dividirlo por 12.`,
      `Fondos considerados: ${retirementSnapshot.fundName}`,
      `Estimado mensual actual: ${formatUsd.format(retirementSnapshot.monthlySalary)}`,
      retirementSnapshot.pending > 0 ? `Estimado mensual al cobrar pendientes: ${formatUsd.format(retirementSnapshot.estimatedMonthlySalary)}` : "No hay pendientes por cobrar para este calculo.",
    ]);
  }

  document.getElementById("arsUsdDisplay").textContent = `$${formatNumber.format(latestBlueRate.sell)}`;
  document.getElementById("arsUsdMeta").textContent = latestBlueRate.date
    ? formatDisplayDate(latestBlueRate.date)
    : "Sin fecha";
}

function renderInfoLines(lines) {
  return lines.filter(Boolean).map((line) => `<p>${escapeHtml(line)}</p>`).join("");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function buildDashboardChartSpecs({ aggregateByFund, aggregateBy, dashboardFilters, dashboardChartExclusions, performanceByFundId, performanceByInstrumentId, formatUsd }) {
  return [
    { id: "fund", title: "Por Fondo", filterKey: "fundIds", series: enrichSeries(aggregateByFund("fundIds"), performanceByFundId) },
    { id: "instrument", title: "Por Instrumento", filterKey: "instrumentIds", series: enrichSeries(aggregateBy("instruments", "instrumentId", "instrumentIds"), performanceByInstrumentId) },
    { id: "platform", title: "Por Plataforma", filterKey: "platformIds", series: aggregateBy("platforms", "platformId", "platformIds") },
    { id: "type", title: "Por Tipo de Instrumento", filterKey: "typeIds", series: aggregateBy("instrumentTypes", "typeId", "typeIds") },
    { id: "currency", title: "Por Tipo de Moneda", filterKey: "currencyIds", series: aggregateBy("currencies", "currencyId", "currencyIds") },
  ].map((spec) => ({
    ...spec,
    activeCount: dashboardFilters[spec.filterKey].size,
    visibleTotalLabel: buildVisibleTotalLabel(spec.series, dashboardFilters[spec.filterKey], dashboardChartExclusions[spec.filterKey], formatUsd),
  }));
}

function buildVisibleTotalLabel(series, selectedValues = new Set(), excludedValues = new Set(), formatUsd) {
  const visibleSeries = series.filter((item) => !excludedValues.has(item.id));
  const selectedSeries = selectedValues.size ? visibleSeries.filter((item) => selectedValues.has(item.id)) : visibleSeries;
  const source = selectedSeries.length ? selectedSeries : visibleSeries;
  const prefix = selectedValues.size && selectedSeries.length ? "Seleccionado" : "Visible";
  return `${prefix}: ${formatUsd.format(source.reduce((sum, item) => sum + item.value, 0))}`;
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
