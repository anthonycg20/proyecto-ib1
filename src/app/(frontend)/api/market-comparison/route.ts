import type {
  MarketComparisonPoint,
  MarketComparisonResponse,
} from "@/lib/market-data"
import { getDailyGpr } from "@/lib/server/gpr-source"
import { cached, loadSp500History } from "@/lib/server/market-sources"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
// Combines the GPR spreadsheet download with three years of S&P 500 history.
export const maxDuration = 60

const HISTORY_MS = 60 * 60 * 1000
const DAY_MS = 24 * 60 * 60 * 1000

export async function GET() {
  try {
    const [gpr, market] = await Promise.all([
      getDailyGpr(),
      cached("yahoo-sp500-history", HISTORY_MS, loadSp500History),
    ])
    const gprByDate = new Map(
      gpr.points.map((point) => [point.date, point.gpr]),
    )

    // Pair each S&P 500 close with the trailing 7-day mean of daily GPR.
    const points: MarketComparisonPoint[] = []
    for (const bar of market) {
      if (bar.date > gpr.updatedAt) continue
      const end = Date.parse(`${bar.date}T00:00:00Z`)
      const window: number[] = []
      for (let day = 0; day < 7; day++) {
        const key = new Date(end - day * DAY_MS).toISOString().slice(0, 10)
        const value = gprByDate.get(key)
        if (value !== undefined) window.push(value)
      }
      if (!window.length) continue
      points.push({
        date: bar.date,
        gpr:
          Math.round((window.reduce((a, b) => a + b, 0) / window.length) * 10) /
          10,
        market: bar.close,
      })
    }
    if (points.length < 2) throw new Error("Not enough overlapping data")

    return Response.json(
      {
        status: "available",
        gprSource: gpr.source,
        gprUpdatedAt: gpr.updatedAt,
        marketUpdatedAt: market.at(-1)!.date,
        points,
      } satisfies MarketComparisonResponse,
      { headers: { "Cache-Control": "public, max-age=900, s-maxage=3600" } },
    )
  } catch {
    return Response.json(
      {
        status: "unavailable",
        checkedAt: new Date().toISOString(),
      } satisfies MarketComparisonResponse,
      { status: 503, headers: { "Cache-Control": "no-store" } },
    )
  }
}
