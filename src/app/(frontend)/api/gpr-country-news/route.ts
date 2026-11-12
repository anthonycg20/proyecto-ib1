import type {
  GprCountryNewsResponse,
  GprNewsUnavailable,
} from "@/lib/gpr-news"
import { loadCountryNews } from "@/lib/server/gpr-country-news"
import { cached } from "@/lib/server/market-sources"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
// GDELT timeout + Google News fallback + the cached world feeds.
export const maxDuration = 30

const TYPES = new Set(["all", "GPRA", "GPRT"])

export async function GET(request: Request) {
  const url = new URL(request.url)
  const iso3 = (url.searchParams.get("iso3") ?? "").trim().toUpperCase()
  const requested = url.searchParams.get("type") ?? "all"
  const type = (TYPES.has(requested) ? requested : "all") as
    | "all"
    | "GPRA"
    | "GPRT"

  if (!/^[A-Z]{3}$/.test(iso3)) {
    return Response.json(
      {
        status: "unavailable",
        checkedAt: new Date().toISOString(),
      } satisfies GprNewsUnavailable,
      { status: 400, headers: { "Cache-Control": "no-store" } },
    )
  }

  try {
    const data = await cached(
      `gpr-country-news:${iso3}:${type}`,
      15 * 60_000,
      () => loadCountryNews(iso3, type),
    )
    return Response.json(data satisfies GprCountryNewsResponse, {
      headers: {
        "Cache-Control": "public, max-age=120, s-maxage=900, stale-while-revalidate=1800",
      },
    })
  } catch {
    return Response.json(
      {
        status: "unavailable",
        checkedAt: new Date().toISOString(),
      } satisfies GprNewsUnavailable,
      { status: 503, headers: { "Cache-Control": "no-store" } },
    )
  }
}
