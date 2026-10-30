import type { GprResponse } from "@/lib/gpr"
import { getDailyGpr } from "@/lib/server/gpr-source"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const data = await getDailyGpr()
    return Response.json(data satisfies GprResponse, {
      headers: {
        "Cache-Control": "public, max-age=900, s-maxage=21600",
      },
    })
  } catch {
    return Response.json(
      {
        status: "unavailable",
        checkedAt: new Date().toISOString(),
      } satisfies GprResponse,
      { status: 503, headers: { "Cache-Control": "no-store" } },
    )
  }
}
