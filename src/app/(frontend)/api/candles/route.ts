import type {
  CandleInterval,
  CandlesResponse,
} from "@/lib/market-data"
import { cached, loadCandles } from "@/lib/server/market-sources"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// The Squeeze pane polls every 60 s; Yahoo is hit at most once per interval.
const REFRESH_MS = 60_000

const intervals: CandleInterval[] = ["1m", "5m", "15m", "30m", "1h", "1d"]

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams
  const symbol = (params.get("symbol") ?? "XAUUSD").toUpperCase()
  const interval = (params.get("interval") ?? "1m") as CandleInterval

  if (!intervals.includes(interval)) {
    return Response.json(
      { status: "unavailable", checkedAt: new Date().toISOString() } satisfies CandlesResponse,
      { status: 400, headers: { "Cache-Control": "no-store" } },
    )
  }

  try {
    const data = await cached(
      `yahoo-candles:${symbol}:${interval}`,
      REFRESH_MS,
      () => loadCandles(symbol, interval),
    )
    return Response.json(
      { status: "available", ...data } satisfies CandlesResponse,
      {
        headers: {
          "Cache-Control": "public, max-age=30, s-maxage=60, stale-while-revalidate=120",
        },
      },
    )
  } catch {
    return Response.json(
      { status: "unavailable", checkedAt: new Date().toISOString() } satisfies CandlesResponse,
      { status: 503, headers: { "Cache-Control": "no-store" } },
    )
  }
}
