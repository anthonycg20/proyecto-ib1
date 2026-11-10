// Response contracts shared by the market API routes and the home dashboard.

export type IndicatorFormat = "index" | "yield" | "usd" | "usd0" | "fx"

export type MarketIndicator = {
  id: string
  label: string
  symbol: string
  price: number
  previousClose: number
  change: number
  changeUnit: "%" | "pb"
  format: IndicatorFormat
  risingIsRisk: boolean
  marketTime: string
}

export type HeatmapAsset = {
  symbol: string
  name: string
  weight: number
  change: number
  price: number | null
  detail: string | null
}

export type Unavailable = { status: "unavailable" }

export type IndicatorsSection = {
  status: "available"
  source: string
  asOf: string
  items: MarketIndicator[]
} | Unavailable

export type HeatmapSection = {
  status: "available"
  source: string
  sizing: "marketCap" | "equal"
  asOf: string
  assets: HeatmapAsset[]
} | Unavailable

export type MarketOverviewResponse = {
  checkedAt: string
  indicators: IndicatorsSection
  equities: HeatmapSection
  crypto: HeatmapSection
}

export type MarketComparisonPoint = {
  date: string
  gpr: number
  market: number
}

export type MarketComparisonResponse = {
  status: "available"
  gprSource: string
  gprUpdatedAt: string
  marketUpdatedAt: string
  points: MarketComparisonPoint[]
} | ComparisonUnavailable

export type ComparisonUnavailable = {
  status: "unavailable"
  checkedAt: string
}

export type WatchlistQuote = {
  id: string
  price: number
  previousClose: number
  change: number
  changePercent: number
  marketTime: string
}

export type WatchlistQuotesResponse =
  | {
      status: "available"
      source: string
      checkedAt: string
      items: WatchlistQuote[]
    }
  | {
      status: "unavailable"
      checkedAt: string
    }
