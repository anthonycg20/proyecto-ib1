// Country-level view of the GPR dashboard: score breakdown, news linking,
// deduplication and the drivers/tags shown in the floating card.

import { countryRiskScores, getRiskLevel } from "../data/geopolitical"
import {
  countryEntities,
  entityForIso3,
  iso3Of,
  normalizeText,
  TAG_RULES,
  type CountryEntity,
} from "../data/gpr-countries"

export type GprCountryLevel = {
  label: string
  className: string
}

export type GprCountry = {
  iso2: string
  iso3: string
  name: string
  score: number | null
  level: GprCountryLevel
  gpra: number | null
  gprt: number | null
  trend: number
  drivers: string[]
  tags: string[]
}

type AliasIndex = {
  lookup: Map<string, string>
  pattern: RegExp
}

function buildAliasIndex(): AliasIndex {
  const lookup = new Map<string, string>()
  for (const entity of countryEntities) {
    for (const alias of entity.aliases) {
      const key = normalizeText(alias)
      // Two-letter keys ("us", "uk") are too ambiguous in headlines.
      if (key.length < 3 || lookup.has(key)) continue
      lookup.set(key, entity.iso3)
    }
  }
  const keys = [...lookup.keys()].sort((a, b) => b.length - a.length)
  return {
    lookup,
    pattern: new RegExp(
      `(?<![\\p{L}\\p{N}])(${keys.join("|")})(?![\\p{L}\\p{N}])`,
      "g",
    ),
  }
}

const aliasIndex = buildAliasIndex()

function matchIso3(text: string) {
  const hits = new Set<string>()
  if (!text) return hits
  for (const match of normalizeText(text).matchAll(aliasIndex.pattern)) {
    const iso3 = aliasIndex.lookup.get(match[1])
    if (iso3) hits.add(iso3)
  }
  return hits
}

// A country seen in the headline weighs 1.0; one only mentioned in the
// summary weighs 0.4 when ranking articles.
export function matchCountries(title: string, summary = "") {
  const inTitle = matchIso3(title)
  const inSummary = matchIso3(summary)
  return {
    countries: [...new Set([...inTitle, ...inSummary])],
    inTitle,
  }
}

const compiledTags = TAG_RULES.map((rule) => ({
  tag: rule.tag,
  regex: new RegExp(
    `(?<![a-z0-9])(?:${rule.patterns.map(normalizeText).join("|")})(?![a-z0-9])`,
  ),
}))

export function articleTags(title: string, summary = "") {
  const text = normalizeText(`${title} ${summary}`)
  const tags: string[] = []
  for (const rule of compiledTags) {
    if (tags.length >= 3) break
    if (rule.regex.test(text)) tags.push(rule.tag)
  }
  return tags
}

const STOPWORDS = new Set(
  "the and for with from that this after before over under into than about says say said amid new its his her their they were was are has have had will would could should".split(
    " ",
  ),
)

export function titleTokens(title: string) {
  return new Set(
    normalizeText(title)
      .split(" ")
      .filter((token) => token.length > 2 && !STOPWORDS.has(token)),
  )
}

export function titleSimilarity(left: string, right: string) {
  const a = titleTokens(left)
  const b = titleTokens(right)
  if (!a.size || !b.size) return 0
  let shared = 0
  for (const token of a) if (b.has(token)) shared += 1
  return shared / (a.size + b.size - shared)
}

function canonicalUrl(value: string) {
  try {
    const url = new URL(value)
    url.hash = ""
    url.search = ""
    url.hostname = url.hostname.replace(/^www\./, "").toLowerCase()
    return url.href.replace(/\/$/, "").toLowerCase()
  } catch {
    return value.trim().toLowerCase()
  }
}

export function dedupeArticles<T extends { title: string; url: string }>(
  articles: T[],
) {
  const kept: T[] = []
  const urls = new Set<string>()
  for (const article of articles) {
    const url = canonicalUrl(article.url)
    if (urls.has(url)) continue
    if (kept.some((item) => titleSimilarity(item.title, article.title) > 0.75))
      continue
    urls.add(url)
    kept.push(article)
  }
  return kept
}

const SOURCE_SUFFIX = /\s[-–—|]\s[^-–—|]{2,40}$/

export function cleanHeadline(title: string) {
  const value = title.replace(SOURCE_SUFFIX, "").replace(/\s+/g, " ").trim()
  if (value.length <= 96) return value
  const cut = value.slice(0, 96)
  const space = cut.lastIndexOf(" ")
  return `${(space > 60 ? cut.slice(0, space) : cut).trimEnd()}…`
}

export function driversFromArticles(articles: Array<{ title: string }>) {
  return articles.slice(0, 3).map((article) => cleanHeadline(article.title))
}

export function tagsFromArticles(articles: Array<{ tags: string[] }>) {
  const counts = new Map<string, number>()
  for (const article of articles)
    for (const tag of article.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1)
  const order = new Map(TAG_RULES.map((rule, index) => [rule.tag, index]))
  return [...counts]
    .sort((a, b) => b[1] - a[1] || (order.get(a[0]) ?? 99) - (order.get(b[0]) ?? 99))
    .slice(0, 3)
    .map(([tag]) => tag)
}

const clamp = (value: number) => Math.max(0, Math.min(100, value))

// There is no official GPRA/GPRT breakdown per country (the Caldara &
// Iacoviello export only ships GPRC_* for 44 countries), so the card derives
// them from the illustrative score. The UI labels them as estimates.
export function deriveBreakdown(score: number | undefined, iso2: string) {
  if (score === undefined) return { gpra: null, gprt: null, trend: 0 }
  let hash = 7
  for (const char of iso2) hash = (hash * 31 + char.charCodeAt(0)) >>> 0
  return {
    gpra: clamp(Math.round(score * 0.85 - 2)),
    gprt: clamp(Math.round(score * 1.05 + 3)),
    trend: (hash % 13) - 4,
  }
}

export function countryEntity(iso2: string): CountryEntity {
  return (
    countryEntities.find((entity) => entity.iso2 === iso2) ?? {
      iso2,
      iso3: iso3Of(iso2),
      name: iso2,
      aliases: [],
    }
  )
}

export function buildCountryView(
  iso2: string,
  news?: { drivers: string[]; tags: string[] } | null,
): GprCountry {
  const entity = countryEntity(iso2)
  const score = countryRiskScores[iso2]
  const breakdown = deriveBreakdown(score, iso2)
  return {
    iso2,
    iso3: entity.iso3,
    name: entity.name,
    score: score ?? null,
    level: getRiskLevel(score),
    ...breakdown,
    drivers: news?.drivers ?? [],
    tags: news?.tags ?? [],
  }
}

export function countryForIso3(iso3: string) {
  return entityForIso3(iso3)
}

export { iso3Of }
