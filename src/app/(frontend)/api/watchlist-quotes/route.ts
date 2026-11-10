import type { WatchlistQuotesResponse } from "@/lib/market-data"
import { cached, loadWatchlistQuotes } from "@/lib/server/market-sources"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// The terminal polls every 60 s; Yahoo is hit at most once per interval.
const REFRESH_MS = 60_000

export async function GET() {
  try {
    const data = await cached(
      "yahoo-watchlist-quotes",
      REFRESH_MS,
      loadWatchlistQuotes,
    )
    return Response.json(
      {
        status: "available",
        source: data.source,
        checkedAt: data.asOf,
        items: data.items,
      } satisfies WatchlistQuotesResponse,
      {
        headers: {
          "Cache-Control": "public, max-age=30, s-maxage=60, stale-while-revalidate=120",
        },
      },
    )
  } catch {
    return Response.json(
      {
        status: "unavailable",
        checkedAt: new Date().toISOString(),
      } satisfies WatchlistQuotesResponse,
      { status: 503, headers: { "Cache-Control": "no-store" } },
    )
  }
}
