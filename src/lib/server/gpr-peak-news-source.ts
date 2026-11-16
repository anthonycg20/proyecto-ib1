import { XMLParser } from "fast-xml-parser"
import type { GprPeakDay, GprPeakHeadline } from "@/lib/gpr"
import { getDailyGpr } from "@/lib/server/gpr-source"

const QUERY = "war OR military OR attack OR threat OR conflict"
const PUBLISHERS = [
  { domain: "nytimes.com", names: ["new york times"] },
  { domain: "wsj.com", names: ["wall street journal"] },
  { domain: "washingtonpost.com", names: ["washington post"] },
  { domain: "chicagotribune.com", names: ["chicago tribune"] },
  { domain: "latimes.com", names: ["los angeles times", "la times"] },
  { domain: "usatoday.com", names: ["usa today"] },
  { domain: "ft.com", names: ["financial times"] },
  { domain: "telegraph.co.uk", names: ["daily telegraph", "the telegraph"] },
  { domain: "theguardian.com", names: ["the guardian", "guardian"] },
  { domain: "theglobeandmail.com", names: ["globe and mail"] },
] as const
const SOURCE_QUERY = PUBLISHERS.map(({ domain }) => `site:${domain}`).join(
  " OR ",
)
const MAX_FEED_CHARS = 2_000_000
const DAY_MS = 24 * 60 * 60_000
const MAX_DATE_DISTANCE = 4 * DAY_MS
const GPR_STRONG_TITLE =
  /(?<![\p{L}\p{N}])(?:war|wars|military|missile|missiles|drone|drones|troops|invasion|nuclear|terror|terrorist|bombing|shelling|hostage|hostages|rebel|rebels|houthi|houthis|hamas|hezbollah|nato|ceasefire|clashes)(?![\p{L}\p{N}])/iu
const GPR_AMBIGUOUS_TITLE =
  /(?<![\p{L}\p{N}])(?:attack|attacks|attacked|threat|threats|conflict|conflicts|strike|strikes|struck|bomb|offensive|retaliation)(?![\p{L}\p{N}])/iu
const GPR_CONTEXT_TITLE =
  /(?<![\p{L}\p{N}])(?:iran|israel|saudi|russia|ukraine|yemen|gaza|syria|lebanon|china|taiwan|korea|pentagon|kremlin|army|navy|air force|soldiers|militants|weapons)(?![\p{L}\p{N}])/iu
const gprRelevantTitle = (title: string) =>
  GPR_STRONG_TITLE.test(title) ||
  (GPR_AMBIGUOUS_TITLE.test(title) && GPR_CONTEXT_TITLE.test(title))
const parser = new XMLParser({
  ignoreAttributes: false,
  processEntities: false,
})

type JsonRecord = Record<string, unknown>
type SearchHeadline = GprPeakHeadline & {
  publishedAt: string
}
type PublisherCandidate = {
  source: string | null
  url: string
}
const record = (value: unknown): JsonRecord =>
  value && typeof value === "object" && !Array.isArray(value)
    ? value as JsonRecord
    : {}
const list = (value: unknown): unknown[] =>
  Array.isArray(value) ? value : value === undefined ? [] : [value]
const text = (value: unknown): string => {
  if (typeof value === "string") return value.trim()
  const nested = record(value)["#text"]
  return typeof nested === "string" ? nested.trim() : ""
}
const safeUrl = (value: string) => {
  try {
    const url = new URL(value)
    return url.protocol === "https:" ? url.href : null
  } catch {
    return null
  }
}

function nextDay(date: string) {
  const value = new Date(`${date}T00:00:00Z`)
  value.setUTCDate(value.getUTCDate() + 1)
  return value.toISOString().slice(0, 10)
}

function parseHeadlines(
  body: string,
  link: (item: JsonRecord) => string | null,
  sourceKey: string,
) {
  if (body.length > MAX_FEED_CHARS) throw new Error("News feed too large")
  if (/<!DOCTYPE|<!ENTITY/i.test(body)) throw new Error("Unsupported feed")
  const channel = record(record(record(parser.parse(body)).rss).channel)
  return list(channel.item).flatMap((entry) => {
    const item = record(entry)
    const title = text(item.title)
    const url = link(item)
    if (!title || !url || !gprRelevantTitle(title)) return []
    const source = text(item[sourceKey])
    return [
      {
        title,
        url,
        source: source || null,
        publishedAt: text(item.pubDate),
      },
    ]
  })
}

function selectedPublisher(article: PublisherCandidate) {
  const source = article.source?.toLocaleLowerCase("en") ?? ""
  let hostname = ""
  try {
    hostname = new URL(article.url).hostname.replace(/^www\./, "")
  } catch {
    return false
  }
  return PUBLISHERS.some(
    ({ domain, names }) =>
      hostname === domain ||
      hostname.endsWith(`.${domain}`) ||
      names.some((name) => source.includes(name)),
  )
}

async function fetchNewsFeed(url: URL) {
  const response = await fetch(url, {
    cache: "no-store",
    signal: AbortSignal.timeout(8_000),
    headers: {
      Accept: "application/rss+xml, application/xml, text/xml",
      "User-Agent": "Mozilla/5.0 (compatible; IBMarketsDashboard/1.0)",
    },
  })
  if (!response.ok) throw new Error(`News search returned ${response.status}`)
  return response.text()
}

async function googleHeadlines(date: string): Promise<SearchHeadline[]> {
  const url = new URL("https://news.google.com/rss/search")
  url.searchParams.set(
    "q",
    `${QUERY} (${SOURCE_QUERY}) after:${date} before:${nextDay(date)}`,
  )
  url.searchParams.set("hl", "en-US")
  url.searchParams.set("gl", "US")
  url.searchParams.set("ceid", "US:en")

  return parseHeadlines(
    await fetchNewsFeed(url),
    (item) => safeUrl(text(item.link)),
    "source",
  )
    .filter(selectedPublisher)
    .slice(0, 5)
}

const englishDay = new Intl.DateTimeFormat("en-US", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
})

async function bingSearch(date: string, domainQuery: string) {
  const target = new Date(`${date}T00:00:00Z`)
  const url = new URL("https://www.bing.com/news/search")
  url.searchParams.set(
    "q",
    `${QUERY.replaceAll(" OR ", " ")} ${domainQuery} ${englishDay.format(target)}`,
  )
  url.searchParams.set("format", "rss")
  url.searchParams.set("setlang", "en-US")

  const extractOriginal = (item: JsonRecord) => {
    try {
      const redirect = new URL(text(item.link).replaceAll("&amp;", "&"))
      return safeUrl(redirect.searchParams.get("url") ?? "")
    } catch {
      return null
    }
  }
  return parseHeadlines(
    await fetchNewsFeed(url),
    extractOriginal,
    "News:Source",
  )
    .filter(selectedPublisher)
    .filter(({ publishedAt }) => {
      const published = Date.parse(publishedAt)
      return (
        Number.isFinite(published) &&
        Math.abs(published - target.getTime()) <= MAX_DATE_DISTANCE
      )
    })
}

async function bingHeadlines(date: string): Promise<SearchHeadline[]> {
  const target = Date.parse(`${date}T00:00:00Z`)
  const broad = await bingSearch(date, `(${SOURCE_QUERY})`)
  let candidates = broad

  // Bing often ignores a long OR list. Query each newspaper only when the
  // combined search is sparse, then merge and rank by publication date.
  if (broad.length < 5) {
    const targeted = await Promise.allSettled(
      PUBLISHERS.map(({ domain }) => bingSearch(date, `site:${domain}`)),
    )
    candidates = [
      ...broad,
      ...targeted.flatMap((result) =>
        result.status === "fulfilled" ? result.value : [],
      ),
    ]
  }

  return [
    ...new Map(candidates.map((headline) => [headline.url, headline])).values(),
  ]
    .sort(
      (a, b) =>
        Math.abs(Date.parse(a.publishedAt) - target) -
        Math.abs(Date.parse(b.publishedAt) - target),
    )
    .slice(0, 8)
}

async function headlinesForDay(date: string) {
  try {
    const headlines = await googleHeadlines(date)
    if (headlines.length) return { headlines, provider: "Google News" as const }
  } catch {
    // Continue with the per-publisher fallback below.
  }
  try {
    return {
      headlines: await bingHeadlines(date),
      provider: "Bing News" as const,
    }
  } catch {
    return { headlines: [], provider: null }
  }
}

export async function loadGprPeakNews() {
  const data = await getDailyGpr()
  const last = data.points.at(-1)
  if (!last) throw new Error("No GPR observations")

  const start = new Date(`${last.date}T00:00:00Z`)
  start.setUTCMonth(start.getUTCMonth() - 1)
  const startKey = start.toISOString().slice(0, 10)
  const peaks = data.points
    .filter((point) => point.date >= startKey && point.date <= last.date)
    .sort((a, b) => b.gpr - a.gpr)
    .slice(0, 5)

  const results = await Promise.allSettled(
    peaks.map((point) => headlinesForDay(point.date)),
  )
  const loaded = results.map((result) =>
    result.status === "fulfilled"
      ? result.value
      : { headlines: [], provider: null },
  )

  // A search can return the same article for adjacent peaks. Keep it once and
  // map it to the peak closest to its actual publication date.
  const assignments = new Map<string, {
    dayIndex: number
    distance: number
    headline: SearchHeadline
  }>()
  for (const result of loaded) {
    for (const headline of result.headlines) {
      const published = Date.parse(headline.publishedAt)
      const dayIndex = peaks.reduce((best, peak, index) => {
        const distance = Math.abs(
          published - Date.parse(`${peak.date}T00:00:00Z`),
        )
        const bestDistance = Math.abs(
          published - Date.parse(`${peaks[best].date}T00:00:00Z`),
        )
        return distance < bestDistance ? index : best
      }, 0)
      const distance = Math.abs(
        published - Date.parse(`${peaks[dayIndex].date}T00:00:00Z`),
      )
      const previous = assignments.get(headline.url)
      if (!previous || distance < previous.distance)
        assignments.set(headline.url, { dayIndex, distance, headline })
    }
  }

  const days: GprPeakDay[] = peaks.map((point, index) => ({
    ...point,
    provider: loaded[index].provider,
    headlines: [...assignments.values()]
      .filter((assignment) => assignment.dayIndex === index)
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 5)
      .map(({ headline }) => ({
        title: headline.title,
        url: headline.url,
        source: headline.source,
      })),
  }))

  return {
    status: "available" as const,
    checkedAt: new Date().toISOString(),
    query: QUERY,
    days,
  }
}
