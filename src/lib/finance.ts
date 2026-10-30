export type FinancialData = {
  currentAssets: number;
  nonCurrentAssets: number;
  currentLiabilities: number;
  nonCurrentLiabilities: number;
  revenue: number;
  costs: number;
  operatingExpenses: number;
  interest: number;
  taxes: number;
  openingEquity: number;
  contributions: number;
  distributions: number;
  openingCash: number;
  operatingCashFlow: number;
  investingCashFlow: number;
  financingCashFlow: number;
};

export type LoanInput = {
  name: string;
  amount: number;
  annualRate: number;
  months: number;
  fees: number;
};

export type ProjectInput = {
  name: string;
  initialInvestment: number;
  discountRate: number;
  flows: number[];
  residualValue: number;
};

export const currency = (value: number) =>
  new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(value) ? value : 0);

export const percent = (value: number) =>
  new Intl.NumberFormat("es-AR", {
    style: "percent",
    maximumFractionDigits: 1,
  }).format(Number.isFinite(value) ? value : 0);

export function calculateFinancials(data: FinancialData) {
  const totalAssets = data.currentAssets + data.nonCurrentAssets;
  const totalLiabilities = data.currentLiabilities + data.nonCurrentLiabilities;
  const equity = totalAssets - totalLiabilities;
  const operatingResult = data.revenue - data.costs - data.operatingExpenses;
  const netResult = operatingResult - data.interest - data.taxes;
  const equityFromEvolution =
    data.openingEquity + data.contributions + netResult - data.distributions;
  const cashChange =
    data.operatingCashFlow + data.investingCashFlow + data.financingCashFlow;

  return {
    totalAssets,
    totalLiabilities,
    equity,
    operatingResult,
    netResult,
    equityFromEvolution,
    equityEvolutionDifference: equity - equityFromEvolution,
    cashChange,
    closingCash: data.openingCash + cashChange,
    workingCapital: data.currentAssets - data.currentLiabilities,
    currentRatio:
      data.currentLiabilities > 0
        ? data.currentAssets / data.currentLiabilities
        : null,
    debtRatio: totalAssets > 0 ? totalLiabilities / totalAssets : null,
    netMargin: data.revenue > 0 ? netResult / data.revenue : null,
    operatingMargin: data.revenue > 0 ? operatingResult / data.revenue : null,
    roa: totalAssets > 0 ? netResult / totalAssets : null,
    roe: equity > 0 ? netResult / equity : null,
  };
}

export function calculateLoan(input: LoanInput) {
  const rate = input.annualRate / 100 / 12;
  const payment =
    rate === 0
      ? input.amount / input.months
      : (input.amount * rate * (1 + rate) ** input.months) /
        ((1 + rate) ** input.months - 1);
  const totalPayments = payment * input.months;
  const total = totalPayments + input.fees;
  const schedule = Array.from({ length: input.months }, (_, index) => {
    const period = index + 1;
    const balance =
      rate === 0
        ? Math.max(input.amount - payment * period, 0)
        : Math.max(
            input.amount * (1 + rate) ** period -
              payment * (((1 + rate) ** period - 1) / rate),
            0,
          );
    return { period, balance };
  });

  return {
    payment,
    total,
    interest: totalPayments - input.amount,
    schedule,
  };
}

export function npv(input: ProjectInput) {
  const rate = input.discountRate / 100;
  return (
    -input.initialInvestment +
    input.flows.reduce(
      (total, flow, index) => total + flow / (1 + rate) ** (index + 1),
      0,
    ) +
    input.residualValue / (1 + rate) ** input.flows.length
  );
}

export function irr(input: ProjectInput) {
  const cashflows = [
    -input.initialInvestment,
    ...input.flows.slice(0, -1),
    (input.flows.at(-1) ?? 0) + input.residualValue,
  ];
  let low = -0.999;
  let high = 10;
  for (let i = 0; i < 150; i += 1) {
    const rate = (low + high) / 2;
    const value = cashflows.reduce(
      (sum, flow, index) => sum + flow / (1 + rate) ** index,
      0,
    );
    if (value > 0) low = rate;
    else high = rate;
  }
  const result = (low + high) / 2;
  return Number.isFinite(result) ? result : null;
}

export function payback(input: ProjectInput) {
  let accumulated = -input.initialInvestment;
  for (let i = 0; i < input.flows.length; i += 1) {
    const previous = accumulated;
    accumulated += input.flows[i];
    if (accumulated >= 0) {
      return i + Math.abs(previous) / input.flows[i];
    }
  }
  return null;
}
