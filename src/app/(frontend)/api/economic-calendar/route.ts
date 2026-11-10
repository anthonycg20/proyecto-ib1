import type { EconomicCalendarResponse } from "@/lib/economic-calendar"
import { cached } from "@/lib/server/market-sources"
import { loadEconomicCalendar } from "@/lib/server/economic-calendar-source"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
// The released values come from a rendering proxy on a cold cache.
export const maxDuration = 60

const REFRESH_MS = 10 * 60_000

export async function GET() {
  try {
    const data = await cached(
      "economic-calendar",
      REFRESH_MS,
      loadEconomicCalendar,
    )
    return Response.json(data satisfies EconomicCalendarResponse, {
      headers: {
        "Cache-Control":
          "public, max-age=300, s-maxage=600, stale-while-revalidate=1800",
      },
    })
  } catch {
    return Response.json(
      {
        status: "unavailable",
        checkedAt: new Date().toISOString(),
      } satisfies EconomicCalendarResponse,
      { status: 503, headers: { "Cache-Control": "no-store" } },
    )
  }
}
