export type FearGreedFactorId = "momentum" | "strength" | "breadth" | "options" | "volatility" | "safehaven" | "junk"

export type FearGreedFactor = {
  id: FearGreedFactorId
  value: number
  reference: number | null
  score: number
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

// Normalizes CNN's public graph payload into the values rendered by the UI.
export function parseFearGreed(input: unknown): FearGreedData | null {
  const root = record(input)
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
  const definitions: [FearGreedFactorId, string, number | null, number | null][] =
    [
      [
        "momentum",
        "market_momentum_sp500",
        sp500 !== null && sp125 ? (sp500 / sp125 - 1) * 100 : null,
        sp125,
      ],
      [
        "strength",
        "stock_price_strength",
        latest(root.stock_price_strength),
        null,
      ],
      [
        "breadth",
        "stock_price_breadth",
        latest(root.stock_price_breadth),
        null,
      ],
      ["options", "put_call_options", latest(root.put_call_options), null],
      [
        "volatility",
        "market_volatility_vix",
        latest(root.market_volatility_vix),
        latest(root.market_volatility_vix_50),
      ],
      ["safehaven", "safe_haven_demand", latest(root.safe_haven_demand), null],
      ["junk", "junk_bond_demand", latest(root.junk_bond_demand), null],
    ]
  const factors: FearGreedFactor[] = []
  for (const [id, key, value, reference] of definitions) {
    const factorScore = indexScore(record(root[key]).score)
    if (value === null || factorScore === null) return null
    factors.push({ id, value, reference, score: factorScore })
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
