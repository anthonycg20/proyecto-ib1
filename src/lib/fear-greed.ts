export type FearGreedFactorId = "momentum" | "strength" | "breadth" | "options" | "volatility" | "safehaven" | "junk"

export type FearGreedFactor = {
  id: FearGreedFactorId
  value: number
  reference: number | null
  score: number
  /** Últimos valores del indicador, en orden cronológico, para el gráfico lineal. */
  series?: number[]
}

export type FearGreedData = {
  status: "available"
  score: number
  previousClose: number
  previousWeek: number
  previousMonth: number
  previousYear: number
  updatedAt: string
  factors: FearGreedFactor[]
}

export type FearGreedResponse = FearGreedData | {
  status: "unavailable"
  checkedAt: string
}

const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
const number = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) ? value : null
const indexScore = (value: unknown) => {
  const score = number(value)
  return score !== null && score >= 0 && score <= 100 ? score : null
}
const latest = (series: unknown) => {
  const data = record(series).data
  return Array.isArray(data) ? number(record(data.at(-1)).y) : null
}

const SERIES_POINTS = 30

// Normalizes CNN's public graph payload into the values rendered by the UI.
export function parseFearGreed(input: unknown): FearGreedData | null {
  const root = record(input)
  const decimals = (value: number) => Math.round(value * 1e4) / 1e4
  const seriesOf = (key: string) => {
    const data = record(root[key]).data
    if (!Array.isArray(data)) return []
    const values: number[] = []
    for (const entry of data) {
      const value = number(record(entry).y)
      if (value !== null) values.push(value)
    }
    return values.slice(-SERIES_POINTS).map(decimals)
  }
  // El factor de impulso se expresa como S&P 500 contra su media de 125 días,
  // así que la serie se calcula emparejando ambos históricos por fecha.
  const momentumSeries = () => {
    const prices = record(root.market_momentum_sp500).data
    const averages = record(root.market_momentum_sp125).data
    if (!Array.isArray(prices) || !Array.isArray(averages)) return []
    const averagesByDate = new Map<number, number>()
    for (const entry of averages) {
      const point = record(entry)
      const date = number(point.x)
      const value = number(point.y)
      if (date !== null && value) averagesByDate.set(date, value)
    }
    const values: number[] = []
    for (const entry of prices) {
      const point = record(entry)
      const date = number(point.x)
      const value = number(point.y)
      const reference = date === null ? undefined : averagesByDate.get(date)
      if (value !== null && reference) values.push((value / reference - 1) * 100)
    }
    return values.slice(-SERIES_POINTS).map(decimals)
  }
  const index = record(root.fear_and_greed)
  const score = indexScore(index.score)
  const previousClose = indexScore(index.previous_close)
  const previousWeek = indexScore(index.previous_1_week)
  const previousMonth = indexScore(index.previous_1_month)
  const previousYear = indexScore(index.previous_1_year)
  const updatedAt = Date.parse(String(index.timestamp ?? ""))
  if (
    score === null ||
    previousClose === null ||
    previousWeek === null ||
    previousMonth === null ||
    previousYear === null ||
    !Number.isFinite(updatedAt)
  )
    return null

  const sp500 = latest(root.market_momentum_sp500)
  const sp125 = latest(root.market_momentum_sp125)
  const definitions: [
    FearGreedFactorId,
    string,
    number | null,
    number | null,
    number[],
  ][] = [
    [
      "momentum",
      "market_momentum_sp500",
      sp500 !== null && sp125 ? (sp500 / sp125 - 1) * 100 : null,
      sp125,
      momentumSeries(),
    ],
    [
      "strength",
      "stock_price_strength",
      latest(root.stock_price_strength),
      null,
      seriesOf("stock_price_strength"),
    ],
    [
      "breadth",
      "stock_price_breadth",
      latest(root.stock_price_breadth),
      null,
      seriesOf("stock_price_breadth"),
    ],
    [
      "options",
      "put_call_options",
      latest(root.put_call_options),
      null,
      seriesOf("put_call_options"),
    ],
    [
      "volatility",
      "market_volatility_vix",
      latest(root.market_volatility_vix),
      latest(root.market_volatility_vix_50),
      seriesOf("market_volatility_vix"),
    ],
    [
      "safehaven",
      "safe_haven_demand",
      latest(root.safe_haven_demand),
      null,
      seriesOf("safe_haven_demand"),
    ],
    [
      "junk",
      "junk_bond_demand",
      latest(root.junk_bond_demand),
      null,
      seriesOf("junk_bond_demand"),
    ],
  ]
  const factors: FearGreedFactor[] = []
  for (const [id, key, value, reference, series] of definitions) {
    const factorScore = indexScore(record(root[key]).score)
    if (value === null || factorScore === null) return null
    factors.push({ id, value, reference, score: factorScore, series })
  }

  return {
    status: "available",
    score,
    previousClose,
    previousWeek,
    previousMonth,
    previousYear,
    updatedAt: new Date(updatedAt).toISOString(),
    factors,
  }
}
