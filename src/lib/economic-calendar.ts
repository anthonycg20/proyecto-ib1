// Response contracts for the Forex Factory economic calendar.

export type EconomicImpact = "high" | "medium" | "low" | "holiday"

export type EconomicEvent = {
  id: string
  /** Exact release instant in ISO UTC. Formatted in America/Lima by the UI. */
  date: string
  currency: string
  title: string
  impact: EconomicImpact
  actual: string | null
  forecast: string | null
  previous: string | null
}

export type EconomicCalendarAvailable = {
  status: "available"
  source: "Forex Factory"
  timeZone: "America/Lima"
  /** First and last day of the week in America/Lima, as YYYY-MM-DD. */
  weekStart: string
  weekEnd: string
  fetchedAt: string
  /** False when the released values could not be read; the table still works. */
  actualsAvailable: boolean
  events: EconomicEvent[]
}

export type EconomicCalendarResponse =
  | EconomicCalendarAvailable
  | { status: "unavailable"; checkedAt: string }
