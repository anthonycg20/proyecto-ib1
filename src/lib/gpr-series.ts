// Shared summary for the three metric cards at the top of the dashboard.
//
// The cards used to hard-code 142.5 / 15 / 22 while the chart plotted the daily
// official series. Both now read the same points: the last observation is the
// headline value and the change compares the last 30 days with the 30 before.

import type { GprPoint } from "./gpr"

export type GprSummary = {
  gpr: number
  gpra: number
  gprt: number
  gprDeltaPct: number | null
  gpraDelta: number | null
  gprtDelta: number | null
  asOf: string
  window: number
}

const mean = (points: GprPoint[], key: keyof GprPoint) =>
  points.length
    ? points.reduce((sum, point) => sum + Number(point[key]), 0) / points.length
    : null

export function summarizeGpr(points: GprPoint[], window = 30): GprSummary | null {
  const last = points.at(-1)
  if (!last) return null

  const recent = points.slice(-window)
  const previous = points.slice(-2 * window, -window)
  const recentGpr = mean(recent, "gpr")
  const previousGpr = mean(previous, "gpr")
  const recentGpra = mean(recent, "gpra")
  const previousGpra = mean(previous, "gpra")
  const recentGprt = mean(recent, "gprt")
  const previousGprt = mean(previous, "gprt")

  return {
    gpr: Math.round(last.gpr),
    gpra: Math.round(last.gpra),
    gprt: Math.round(last.gprt),
    gprDeltaPct:
      previousGpr && recentGpr !== null
        ? ((recentGpr - previousGpr) / previousGpr) * 100
        : null,
    gpraDelta:
      previousGpra !== null && recentGpra !== null
        ? Math.round(recentGpra - previousGpra)
        : null,
    gprtDelta:
      previousGprt !== null && recentGprt !== null
        ? Math.round(recentGprt - previousGprt)
        : null,
    asOf: last.date,
    window,
  }
}
