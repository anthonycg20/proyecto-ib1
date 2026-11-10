import type {
  EconomicCalendarAvailable,
  EconomicEvent,
  EconomicImpact,
} from "@/lib/economic-calendar"

// Server-only loader for the Forex Factory weekly calendar.
//
// Two upstreams are combined:
//   1. The public weekly feed (JSON) gives exact instants, impact and order.
//   2. The calendar page, read through a rendering proxy, adds the released
//      value ("Actual") that the feed never includes.
// If the second one fails the calendar still renders, just without "Actual".

const FEED_URL = "https://nfs.faireconomy.media/ff_calendar_thisweek.json"
const READER_URL = "https://r.jina.ai/https://www.forexfactory.com/calendar"
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
const FEED_TIMEOUT_MS = 12_000
const READER_TIMEOUT_MS = 30_000
const MAX_FEED_CHARS = 400_000
const MAX_READER_CHARS = 2_000_000
const TIME_ZONE = "America/Lima"

type FeedEvent = {
  title: string
  currency: string
  date: string
  impact: EconomicImpact
  forecast: string | null
  previous: string | null
}

type PageRow = {
  title: string
  currency: string
  actual: string | null
}

const impactByLabel: Record<string, EconomicImpact> = {
  high: "high",
  medium: "medium",
  low: "low",
  holiday: "holiday",
  "non-economic": "holiday",
  "non economic": "holiday",
}

async function fetchText(
  url: string,
  timeoutMs: number,
  headers: Record<string, string>,
  maxChars: number,
  attempts = 1,
) {
  let lastError: unknown = new Error("Upstream failed")
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      const response = await fetch(url, {
        cache: "no-store",
        signal: AbortSignal.timeout(timeoutMs),
        headers: { "User-Agent": USER_AGENT, ...headers },
      })
      if (!response.ok) throw new Error(`Upstream returned ${response.status}`)
      const body = await response.text()
      if (body.length > maxChars) throw new Error("Upstream body too large")
      return body
    } catch (error) {
      lastError = error
      if (attempt + 1 < attempts)
        await new Promise((resolve) => setTimeout(resolve, 400))
    }
  }
  throw lastError
}

const clean = (value: unknown, max = 240) => {
  if (typeof value !== "string") return null
  const trimmed = value.replace(/\s+/g, " ").trim()
  return trimmed ? trimmed.slice(0, max) : null
}

const toImpact = (value: unknown): EconomicImpact => {
  const label = typeof value === "string" ? value.trim().toLowerCase() : ""
  return impactByLabel[label] ?? "low"
}

function parseFeed(raw: string): FeedEvent[] {
  const parsed: unknown = JSON.parse(raw)
  if (!Array.isArray(parsed)) throw new Error("Unexpected feed shape")
  const events: FeedEvent[] = []
  for (const item of parsed) {
    if (!item || typeof item !== "object") continue
    const record = item as Record<string, unknown>
    const title = clean(record.title)
    const currency = clean(record.country, 8)
    const rawDate = clean(record.date, 40)
    if (!title || !currency || !rawDate) continue
    const instant = new Date(rawDate)
    if (Number.isNaN(instant.getTime())) continue
    events.push({
      title,
      currency: currency.toUpperCase(),
      // The feed ships New York offsets; normalise to UTC so the UI can render
      // the same instant in any time zone.
      date: instant.toISOString(),
      impact: toImpact(record.impact),
      forecast: clean(record.forecast),
      previous: clean(record.previous),
    })
  }
  if (!events.length) throw new Error("Feed returned no events")
  return events.sort((a, b) => a.date.localeCompare(b.date))
}

const decodeEntities = (value: string) =>
  value
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => {
      const code = Number.parseInt(hex, 16)
      return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : ""
    })
    .replace(/&#(\d+);/g, (_, decimal: string) => {
      const code = Number.parseInt(decimal, 10)
      return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : ""
    })
    .replace(/\s+/g, " ")
    .trim()

function readCell(row: string, name: string) {
  const match = row.match(
    new RegExp(`<td[^>]*calendar__${name}[^>]*>([\\s\\S]*?)</td>`, "i"),
  )
  return match ? decodeEntities(match[1]) : ""
}

function parseReader(html: string): PageRow[] {
  const rows: PageRow[] = []
  const pattern = /<tr[^>]*data-event-id="(\d+)"[\s\S]*?<\/tr>/g
  for (const match of html.matchAll(pattern)) {
    const block = match[0]
    const title = decodeEntities(
      (block.match(/calendar__event-title"[^>]*>([\s\S]*?)<\/span>/i) ?? [
        "",
        "",
      ])[1],
    )
    if (!title) continue
    rows.push({
      title,
      currency: readCell(block, "currency").toUpperCase(),
      actual: readCell(block, "actual") || null,
    })
  }
  return rows
}

async function loadActuals(): Promise<PageRow[] | null> {
  try {
    const html = await fetchText(
      READER_URL,
      READER_TIMEOUT_MS,
      {
        Accept: "text/html",
        "X-Return-Format": "html",
        // Ask only for the calendar table: 560 KB become roughly 190 KB.
        "X-Target-Selector": "table.calendar__table",
      },
      MAX_READER_CHARS,
    )
    const rows = parseReader(html)
    return rows.length ? rows : null
  } catch {
    // The released values are optional: never break the calendar for them.
    return null
  }
}

const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "")

function merge(
  feed: FeedEvent[],
  rows: PageRow[],
): { events: EconomicEvent[]; matched: number } {
  const queue = new Map<string, number[]>()
  rows.forEach((row, index) => {
    const key = `${normalize(row.title)}|${row.currency}`
    const list = queue.get(key)
    if (list) list.push(index)
    else queue.set(key, [index])
  })

  let matched = 0
  const events = feed.map((event, index) => {
    const key = `${normalize(event.title)}|${event.currency}`
    const pending = queue.get(key)
    const rowIndex = pending?.shift()
    if (rowIndex !== undefined) matched++
    return {
      id: `${event.date}-${event.currency}-${normalize(event.title).slice(0, 24)}-${index}`,
      date: event.date,
      currency: event.currency,
      title: event.title,
      impact: event.impact,
      // Forecast and previous come from the feed: the page rewrites them when a
      // release is published, so the feed is the stable reference.
      actual: rowIndex === undefined ? null : rows[rowIndex].actual,
      forecast: event.forecast,
      previous: event.previous,
    } satisfies EconomicEvent
  })
  return { events, matched }
}

const dayIn = (iso: string) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso))

export async function loadEconomicCalendar(): Promise<EconomicCalendarAvailable> {
  const feedBody = await fetchText(
    FEED_URL,
    FEED_TIMEOUT_MS,
    { Accept: "application/json" },
    MAX_FEED_CHARS,
    3,
  )
  const feed = parseFeed(feedBody)
  const rows = await loadActuals()
  const { events, matched } = merge(feed, rows ?? [])
  return {
    status: "available",
    source: "Forex Factory",
    timeZone: TIME_ZONE,
    weekStart: dayIn(events[0].date),
    weekEnd: dayIn(events[events.length - 1].date),
    fetchedAt: new Date().toISOString(),
    actualsAvailable: matched > 0 && events.some((event) => event.actual),
    events,
  }
}
