import type {
  HeatmapSection,
  IndicatorsSection,
  MarketOverviewResponse,
} from "@/lib/market-data"
import {
  cached,
  loadCryptoHeatmap,
  loadIndicators,
  loadSp500Heatmap,
} from "@/lib/server/market-sources"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const REFRESH_MS = 60_000
const unavailable = { status: "unavailable" } as const

export async function GET() {
  const [indicators, equities, crypto] = await Promise.allSettled([
    cached("yahoo-indicators", REFRESH_MS, loadIndicators),
    cached("finviz-sp500", REFRESH_MS, loadSp500Heatmap),
    cached("finviz-crypto", REFRESH_MS, loadCryptoHeatmap),
  ])
  const body: MarketOverviewResponse = {
    checkedAt: new Date().toISOString(),
    indicators:
      indicators.status === "fulfilled"
        ? indicators.value satisfies IndicatorsSection
        : unavailable,
    equities:
      equities.status === "fulfilled"
        ? equities.value satisfies HeatmapSection
        : unavailable,
    crypto:
      crypto.status === "fulfilled"
        ? crypto.value satisfies HeatmapSection
        : unavailable,
  }
  const sections = [body.indicators, body.equities, body.crypto]
  const complete = sections.every((section) => section.status === "available")
  const empty = sections.every((section) => section.status === "unavailable")
  return Response.json(body, {
    status: empty ? 503 : 200,
    headers: {
      "Cache-Control": complete
        ? "public, max-age=30, s-maxage=60"
        : "no-store",
    },
  })
}
