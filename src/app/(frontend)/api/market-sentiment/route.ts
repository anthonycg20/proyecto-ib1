import { createHash } from "node:crypto"
import { XMLParser } from "fast-xml-parser"
import {
  analyseHeadline,
  isMarketHeadline,
  summarizeHeadlines,
  type MarketArticle,
  type MarketNewsResponse,
} from "@/lib/sentiment-nlp"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const feeds = [
  {
    name: "Google News · Mercados",
    url: `https://news.google.com/rss/search?${new URLSearchParams({ q: 'bolsa OR "Wall Street" when:2d', hl: "es", gl: "US", ceid: "US:es" })}`,
  },
  {
    name: "El País · Economía",
    url: "https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/section/economia/portada",
  },
  {
    name: "BBC Business",
    url: "https://feeds.bbci.co.uk/news/business/rss.xml",
  },
]
const parser = new XMLParser({
  ignoreAttributes: false,
  processEntities: false,
})
const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
const text = (value: unknown): string => {
  const raw =
    typeof value === "string"
      ? value
      : typeof record(value)["#text"] === "string"
        ? String(record(value)["#text"])
        : ""
  return raw
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim()
}

const safeImageUrl = (value: unknown) => {
  if (typeof value !== "string" || value.length > 700) return null
  try {
    const url = new URL(value)
    if (url.protocol !== "https:" || url.username || url.password) return null
    return url.href
  } catch {
    return null
  }
}

// BBC publica media:thumbnail y El País media:content; Google News no incluye
// imágenes, por eso el cliente usa el logo del medio como respaldo.
const feedImage = (item: Record<string, unknown>) => {
  const candidates = [
    item["media:thumbnail"],
    item["media:content"],
    item.enclosure,
  ]
  for (const candidate of candidates) {
    for (const entry of Array.isArray(candidate) ? candidate : [candidate]) {
      const attributes = record(entry)
      const type = attributes["@_type"]
      const medium = attributes["@_medium"]
      if (typeof type === "string" && !type.startsWith("image/")) continue
      if (typeof medium === "string" && medium !== "image") continue
      const image = safeImageUrl(attributes["@_url"])
      if (image) return image
    }
  }
  return null
}

const feedSourceUrl = (item: Record<string, unknown>) => {
  const value = record(item.source)["@_url"]
  return safeImageUrl(value)
}

async function readFeed(feed: typeof feeds[number]): Promise<MarketArticle[]> {
  const response = await fetch(feed.url, {
    signal: AbortSignal.timeout(6000),
    next: { revalidate: 60 },
    headers: { Accept: "application/rss+xml, application/xml, text/xml" },
  })
  if (!response.ok) throw new Error("Source unavailable")
  const body = await response.text()
  if (body.length > 2_000_000 || /<!DOCTYPE|<!ENTITY/i.test(body))
    throw new Error("Invalid feed")
  const document = record(parser.parse(body))
  const channel = record(record(document.rss).channel)
  const entries = Array.isArray(channel.item)
    ? channel.item
    : channel.item
      ? [channel.item]
      : []
  const articles: MarketArticle[] = []
  for (const entry of entries.slice(0, 24)) {
    const item = record(entry)
    const title = text(item.title).slice(0, 350)
    const link = text(item.link)
    let url: URL
    try {
      url = new URL(link)
    } catch {
      continue
    }
    if (!title || url.protocol !== "https:" || url.username || url.password)
      continue
    const date = Date.parse(text(item.pubDate))
    articles.push({
      id: createHash("sha256").update(url.href).digest("hex").slice(0, 16),
      title,
      url: url.href,
      source: text(item.source).slice(0, 100) || feed.name,
      publishedAt: Number.isFinite(date) ? new Date(date).toISOString() : null,
      sentiment: analyseHeadline(title),
      image: feedImage(item),
      sourceUrl: feedSourceUrl(item),
    })
  }
  return articles
}

export async function GET() {
  const results = await Promise.allSettled(feeds.map(readFeed))
  const articles = results
    .flatMap((result) => (result.status === "fulfilled" ? result.value : []))
    .filter((article) => isMarketHeadline(article.title))
  const unique = [
    ...new Map(articles.map((article) => [article.url, article])).values(),
  ]
    .sort(
      (a, b) =>
        (Date.parse(b.publishedAt ?? "") || 0) -
        (Date.parse(a.publishedAt ?? "") || 0),
    )
    .slice(0, 16)
  const result: MarketNewsResponse = {
    status: unique.length ? "available" : "unavailable",
    checkedAt: new Date().toISOString(),
    articles: unique,
    reading: summarizeHeadlines(unique),
    sources: [...new Set(unique.map((article) => article.source))],
  }
  return Response.json(result, {
    headers: {
      "Cache-Control": unique.length
        ? "public, max-age=15, s-maxage=60"
        : "no-store",
    },
  })
}
