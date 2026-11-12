// Server-only GDELT DOC 2.0 client.
//
// GDELT is the primary source for country news, but it rate-limits hard
// (HTTP 429) and is unreliable from some networks. Requests are serialized,
// spaced out, and the client opens a circuit breaker after a 429 so the rest of
// the dashboard keeps working with the fallbacks.

const ENDPOINT = "https://api.gdeltproject.org/api/v2/doc/doc"
const MIN_GAP_MS = 1_300
const BLOCK_MS = 10 * 60_000
const TIMEOUT_MS = 9_000

export type GdeltArticle = {
  title: string
  url: string
  source: string
  publishedAt: string | null
  imageUrl: string | null
}

export type GdeltResult = {
  status: "ok" | "blocked" | "error"
  articles: GdeltArticle[]
}

let queue: Promise<unknown> = Promise.resolve()
let lastRequestAt = 0
let blockedUntil = 0

export function gdeltAvailable() {
  return Date.now() >= blockedUntil
}

function schedule<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(async () => {
    const wait = Math.max(0, lastRequestAt + MIN_GAP_MS - Date.now())
    if (wait) await new Promise((resolve) => setTimeout(resolve, wait))
    lastRequestAt = Date.now()
    return task()
  })
  queue = run.then(
    () => undefined,
    () => undefined,
  )
  return run
}

const SOURCE_LABELS: Record<string, string> = {
  "bbc.co.uk": "BBC News",
  "bbc.com": "BBC News",
  "nytimes.com": "The New York Times",
  "theguardian.com": "The Guardian",
  "elpais.com": "El País",
  "reuters.com": "Reuters",
  "apnews.com": "AP",
  "aljazeera.com": "Al Jazeera",
  "france24.com": "France 24",
  "dw.com": "DW",
  "cnn.com": "CNN",
  "washingtonpost.com": "The Washington Post",
  "ft.com": "Financial Times",
  "wsj.com": "The Wall Street Journal",
  "lemonde.fr": "Le Monde",
  "efe.com": "EFE",
}

const domainLabel = (domain: string) => {
  const clean = domain.replace(/^www\./, "").toLowerCase()
  if (SOURCE_LABELS[clean]) return SOURCE_LABELS[clean]
  const parent = clean.split(".").slice(-2).join(".")
  return SOURCE_LABELS[parent] ?? clean
}

const httpsOnly = (value: unknown) => {
  if (typeof value !== "string" || !value) return null
  try {
    const url = new URL(value)
    return url.protocol === "https:" ? url.href : null
  } catch {
    return null
  }
}

// GDELT uses "20261102T120000Z".
const parseSeenDate = (value: unknown) => {
  if (typeof value !== "string") return null
  const match = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/.exec(value)
  if (!match) return null
  return `${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:${match[6]}Z`
}

type GdeltPayload = {
  articles?: Array<{
    title?: unknown
    url?: unknown
    domain?: unknown
    seendate?: unknown
    socialimage?: unknown
  }>
}

export async function searchGdelt(
  query: string,
  maxRecords = 25,
): Promise<GdeltResult> {
  if (!gdeltAvailable()) return { status: "blocked", articles: [] }

  return schedule(async () => {
    const url = new URL(ENDPOINT)
    url.searchParams.set("query", query)
    url.searchParams.set("mode", "ArtList")
    url.searchParams.set("maxrecords", String(maxRecords))
    url.searchParams.set("timespan", "1month")
    url.searchParams.set("sort", "hybridrel")
    url.searchParams.set("format", "json")

    try {
      const response = await fetch(url, {
        cache: "no-store",
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: {
          Accept: "application/json",
          "User-Agent":
            "Mozilla/5.0 (compatible; IB1GeopoliticalDashboard/1.0)",
        },
      })

      if (response.status === 429) {
        blockedUntil = Date.now() + BLOCK_MS
        return { status: "blocked", articles: [] }
      }
      if (!response.ok) return { status: "error", articles: [] }

      const body = await response.text()
      let payload: GdeltPayload
      try {
        payload = JSON.parse(body) as GdeltPayload
      } catch {
        return { status: "error", articles: [] }
      }

      const articles = (payload.articles ?? []).flatMap((item) => {
        const title = typeof item.title === "string" ? item.title.trim() : ""
        const articleUrl = httpsOnly(item.url)
        if (!title || !articleUrl) return []
        return [
          {
            title,
            url: articleUrl,
            source:
              typeof item.domain === "string"
                ? domainLabel(item.domain)
                : "GDELT",
            publishedAt: parseSeenDate(item.seendate),
            imageUrl: httpsOnly(item.socialimage),
          },
        ]
      })

      return { status: "ok", articles } as GdeltResult
    } catch {
      return { status: "error", articles: [] }
    }
  })
}
