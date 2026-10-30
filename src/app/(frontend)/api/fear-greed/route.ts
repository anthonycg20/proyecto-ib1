import { parseFearGreed, type FearGreedResponse } from "@/lib/fear-greed"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const source = "https://production.dataviz.cnn.io/index/fearandgreed/graphdata"

export async function GET() {
  try {
    const response = await fetch(source, {
      signal: AbortSignal.timeout(8000),
      next: { revalidate: 300 },
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        Accept: "application/json, text/plain, */*",
        "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
        Referer: "https://www.cnn.com/markets/fear-and-greed",
        Origin: "https://www.cnn.com",
      },
    })
    if (!response.ok) throw new Error("CNN unavailable")
    const body = await response.text()
    if (body.length > 1_500_000) throw new Error("Unexpected response")
    const data = parseFearGreed(JSON.parse(body))
    if (!data) throw new Error("Invalid response")
    return Response.json(data satisfies FearGreedResponse, {
      headers: { "Cache-Control": "public, max-age=60, s-maxage=300" },
    })
  } catch {
    return Response.json(
      {
        status: "unavailable",
        checkedAt: new Date().toISOString(),
      } satisfies FearGreedResponse,
      { status: 503, headers: { "Cache-Control": "no-store" } },
    )
  }
}
