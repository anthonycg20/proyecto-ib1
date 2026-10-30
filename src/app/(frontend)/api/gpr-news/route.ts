import type { GprNewsResponse } from "@/lib/gpr-news"
import { loadGprNews } from "@/lib/server/gpr-news-source"
import { cached } from "@/lib/server/market-sources"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const data = await cached("gpr-news", 5 * 60_000, loadGprNews)
    return Response.json(data satisfies GprNewsResponse, {
      headers: { "Cache-Control": "public, max-age=60, s-maxage=300" },
    })
  } catch {
    return Response.json(
      {
        status: "unavailable",
        checkedAt: new Date().toISOString(),
      } satisfies GprNewsResponse,
      { status: 503, headers: { "Cache-Control": "no-store" } },
    )
  }
}
