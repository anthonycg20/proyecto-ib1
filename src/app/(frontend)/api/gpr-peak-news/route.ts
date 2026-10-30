import type { GprPeakNewsResponse } from "@/lib/gpr"
import { loadGprPeakNews } from "@/lib/server/gpr-peak-news-source"
import { cached } from "@/lib/server/market-sources"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
// Reads the GPR file and then queries news providers for each peak day.
export const maxDuration = 60

export async function GET() {
  try {
    const data = await cached(
      "gpr-peak-news-v9",
      6 * 60 * 60_000,
      loadGprPeakNews,
    )
    return Response.json(data satisfies GprPeakNewsResponse, {
      headers: { "Cache-Control": "public, max-age=900, s-maxage=21600" },
    })
  } catch {
    return Response.json(
      {
        status: "unavailable",
        checkedAt: new Date().toISOString(),
      } satisfies GprPeakNewsResponse,
      { status: 503, headers: { "Cache-Control": "no-store" } },
    )
  }
}
