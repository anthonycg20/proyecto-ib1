// Country-scoped geopolitical news.
//
// Order of preference: GDELT DOC 2.0 (primary), Google News RSS (fallback for
// GDELT 429/timeouts), and the already cached world feeds filtered by country.
// Results are classified with the same lexicon as the global feed, deduplicated
// and reduced to the drivers/tags shown in the country card.

import { createHash } from "node:crypto"
import { XMLParser } from "fast-xml-parser"
import {
  articleTags,
  countryForIso3,
  dedupeArticles,
  driversFromArticles,
  matchCountries,
  tagsFromArticles,
} from "@/lib/gpr-country"
import type {
  GprCountryNewsArticle,
  GprCountryNewsProvider,
  GprCountryNewsResponse,
  GprNewsArticle,
} from "@/lib/gpr-news"
import { searchGdelt } from "./gdelt-source"
import { classifyHeadline, loadGprNews } from "./gpr-news-source"
import { cached } from "./market-sources"

const parser = new XMLParser({
  ignoreAttributes: false,
  processEntities: false,
})
const MAX_FEED_CHARS = 2_000_000
const MAX_ARTICLES = 12

type JsonRecord = Record<string, unknown>

const record = (value: unknown): JsonRecord =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : {}
const list = (value: unknown): unknown[] =>
  Array.isArray(value) ? value : value == null ? [] : [value]
const text = (value: unknown) =>
  typeof value === "string"
    ? value
    : typeof value === "number"
      ? String(value)
      : ""

const httpsOnly = (value: string) => {
  try {
    const url = new URL(value)
    return url.protocol === "https:" ? url.href : null
  } catch {
    return null
  }
}

const articleId = (url: string) =>
  createHash("sha256").update(url).digest("hex").slice(0, 16)

type RawArticle = {
  title: string
  url: string
  source: string
  publishedAt: string | null
  image: string | null
}

const SOURCE_SUFFIX = /\s[-–—|]\s([^-–—|]{2,40})$/

function stripSourceSuffix(title: string, source: string) {
  const match = SOURCE_SUFFIX.exec(title)
  if (!match) return title
  if (!source || match[1].trim().toLowerCase() === source.trim().toLowerCase())
    return title.slice(0, match.index).trim()
  return title
}

// ---------------------------------------------------------------- GDELT query

function searchQuery(name: string, aliases: string[]) {
  const terms = [name, ...aliases.filter((alias) => alias !== name)]
    .slice(0, 4)
    .map((term) => `"${term}"`)
    .join(" OR ")
  return `(${terms}) AND (war OR attack OR strike OR threat OR sanctions OR conflict OR "peace talks" OR troops OR missile)`
}

// ----------------------------------------------------------- Google News RSS

const LOCALES = [
  { hl: "en-US", gl: "US", ceid: "US:en" },
  { hl: "es", gl: "ES", ceid: "ES:es" },
]

async function readGoogleNews(query: string) {
  const results = await Promise.allSettled(
    LOCALES.map(async (locale) => {
      const url = new URL("https://news.google.com/rss/search")
      url.searchParams.set("q", query)
      url.searchParams.set("hl", locale.hl)
      url.searchParams.set("gl", locale.gl)
      url.searchParams.set("ceid", locale.ceid)

      const response = await fetch(url, {
        cache: "no-store",
        signal: AbortSignal.timeout(8_000),
        headers: {
          Accept: "application/rss+xml, application/xml, text/xml",
          "User-Agent":
            "Mozilla/5.0 (compatible; IB1GeopoliticalDashboard/1.0)",
        },
      })
      if (!response.ok) throw new Error(`Google News ${response.status}`)
      const body = await response.text()
      if (body.length > MAX_FEED_CHARS) throw new Error("Feed too large")
      if (/<!DOCTYPE|<!ENTITY/i.test(body)) throw new Error("Unsupported feed")

      const channel = record(record(record(parser.parse(body)).rss).channel)
      return list(channel.item).flatMap((entry): RawArticle[] => {
        const item = record(entry)
        const rawTitle = text(item.title).trim()
        const url = httpsOnly(text(item.link))
        if (!rawTitle || !url) return []
        const source = text(record(item.source)["#text"] ?? item.source)
        const title = stripSourceSuffix(rawTitle, source)
        const date = Date.parse(text(item.pubDate))
        const image = httpsOnly(
          text(record(item["media:content"])["@_url"]) ||
            text(record(item.enclosure)["@_url"]),
        )
        return [
          {
            title,
            url,
            source: source || "Google News",
            publishedAt: Number.isFinite(date)
              ? new Date(date).toISOString()
              : null,
            image,
          },
        ]
      })
    }),
  )

  const failed = results.some((result) => result.status === "rejected")
  const articles = results.flatMap((result) =>
    result.status === "fulfilled" ? result.value : [],
  )
  return { articles, failed }
}

// -------------------------------------------------------------- enrichment

function enrich(article: RawArticle, iso3: string): GprCountryNewsArticle | null {
  const classification = classifyHeadline(article.title)
  if (!classification) return null
  const matches = matchCountries(article.title)
  const countries = matches.countries.includes(iso3)
    ? matches.countries
    : [...matches.countries, iso3]
  return {
    id: articleId(article.url),
    title: article.title,
    url: article.url,
    source: article.source,
    publishedAt: article.publishedAt,
    image: article.image,
    imageUrl: article.image,
    category: classification.category,
    type: classification.category === "act" ? "GPRA" : "GPRT",
    signal: classification.signal,
    countries,
    tags: articleTags(article.title),
    relevance: matches.inTitle.has(iso3) ? 1 : 0.4,
  }
}

function fromGlobalFeed(article: GprNewsArticle, iso3: string) {
  const matches = matchCountries(article.title)
  return {
    ...article,
    imageUrl: article.image,
    relevance: matches.inTitle.has(iso3) ? 1 : 0.4,
  } satisfies GprCountryNewsArticle
}

// A previous good response avoids emptying the card when every provider is
// temporarily down (but not when the sources simply have no news).
const lastGood = new Map<string, GprCountryNewsResponse>()

export async function loadCountryNews(
  iso3: string,
  type: "all" | "GPRA" | "GPRT" = "all",
): Promise<GprCountryNewsResponse> {
  const entity = countryForIso3(iso3)
  const name = entity?.name ?? iso3
  const aliases = entity?.aliases ?? []
  const query = searchQuery(name, aliases)

  let failures = false

  const gdelt = await searchGdelt(query)
  if (gdelt.status !== "ok") failures = true

  let google: RawArticle[] = []
  if (!gdelt.articles.length) {
    const result = await readGoogleNews(query)
    google = result.articles
    if (result.failed) failures = true
  }

  const gdeltArticles = gdelt.articles.flatMap(
    (article) =>
      enrich(
        {
          title: article.title,
          url: article.url,
          source: article.source,
          publishedAt: article.publishedAt,
          image: article.imageUrl,
        },
        iso3,
      ) ?? [],
  )
  const googleArticles = google.flatMap(
    (article) => enrich(article, iso3) ?? [],
  )

  let globalArticles: GprCountryNewsArticle[] = []
  try {
    const feed = await cached("gpr-news", 5 * 60_000, loadGprNews)
    globalArticles = feed.articles
      .filter((article) => article.countries.includes(iso3))
      .map((article) => fromGlobalFeed(article, iso3))
  } catch {
    failures = true
  }

  const provider: GprCountryNewsProvider = gdeltArticles.length
    ? "GDELT"
    : googleArticles.length
      ? "Google News"
      : "RSS"

  const merged = dedupeArticles([
    ...gdeltArticles,
    ...googleArticles,
    ...globalArticles,
  ])
    .filter((article) => type === "all" || article.type === type)
    .sort(
      (a, b) =>
        b.relevance - a.relevance ||
        (Date.parse(b.publishedAt ?? "") || 0) -
          (Date.parse(a.publishedAt ?? "") || 0),
    )
    .slice(0, MAX_ARTICLES)

  if (!merged.length && failures) {
    const previous = lastGood.get(iso3)
    if (previous) return { ...previous, partial: true }
  }

  const response: GprCountryNewsResponse = {
    status: "available",
    checkedAt: new Date().toISOString(),
    iso3,
    provider,
    partial: failures,
    articles: merged,
    drivers: driversFromArticles(merged),
    tags: tagsFromArticles(merged),
  }

  if (merged.length) lastGood.set(iso3, response)
  return response
}
