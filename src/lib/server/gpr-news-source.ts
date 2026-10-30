import { createHash } from "node:crypto"
import { XMLParser } from "fast-xml-parser"
import type { GprNewsArticle, GprNewsCategory } from "@/lib/gpr-news"

// World-news feeds from newspapers used by the GPR methodology (plus El País
// for Spanish coverage). All four publish the article image in their RSS.
const feeds = [
  {
    name: "The New York Times",
    url: "https://rss.nytimes.com/services/xml/rss/nyt/World.xml",
  },
  { name: "The Guardian", url: "https://www.theguardian.com/world/rss" },
  { name: "BBC News", url: "https://feeds.bbci.co.uk/news/world/rss.xml" },
  {
    name: "El País",
    url: "https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/section/internacional/portada",
  },
]

const parser = new XMLParser({
  ignoreAttributes: false,
  processEntities: false,
})
const MAX_FEED_CHARS = 3_000_000

async function fetchFeed(url: string) {
  const response = await fetch(url, {
    cache: "no-store",
    signal: AbortSignal.timeout(8_000),
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; IBMarketsDashboard/1.0)",
      Accept: "application/rss+xml, application/xml, text/xml",
    },
  })
  if (!response.ok) throw new Error(`Feed returned ${response.status}`)
  const body = await response.text()
  if (body.length > MAX_FEED_CHARS) throw new Error("Feed too large")
  return body
}

type JsonRecord = Record<string, unknown>
const record = (value: unknown): JsonRecord =>
  value && typeof value === "object" && !Array.isArray(value)
    ? value as JsonRecord
    : {}
const list = (value: unknown): unknown[] =>
  Array.isArray(value) ? value : value === undefined ? [] : [value]
const decode = (value: string) =>
  value
    .replace(/<[^>]*>/g, "")
    .replace(/&#(\d+);/g, (_, code: string) =>
      String.fromCodePoint(Number(code)),
    )
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) =>
      String.fromCodePoint(parseInt(code, 16)),
    )
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim()
const text = (value: unknown): string => {
  if (typeof value === "string") return decode(value)
  const nested = record(value)["#text"]
  return typeof nested === "string" ? decode(nested) : ""
}
const httpsUrl = (value: string) => {
  try {
    const url = new URL(value)
    return url.protocol === "https:" && !url.username && !url.password
      ? url.href
      : null
  } catch {
    return null
  }
}

// Word categories follow Caldara & Iacoviello: acts (war onset, escalation,
// terror acts) and threats (war, peace, military buildup, nuclear, terror).
// "Weak" terms only count when the headline also has geopolitical context.
type Term = {
  pattern: string
  strong: boolean
}

const actTerms: Term[] = [
  { pattern: "invasion|invaded|invades|invadió|invasión", strong: true },
  { pattern: "air ?strikes?|missile strikes?|drone strikes?", strong: true },
  { pattern: "missile attacks?|drone attacks?|rocket attacks?", strong: true },
  { pattern: "bombings?|bombed|shelling|shelled", strong: true },
  { pattern: "bombardeos?|bombardeó|bombardea|bombardean", strong: true },
  { pattern: "terror(?:ist)? attacks?|suicide bomb(?:er|ing)s?", strong: true },
  { pattern: "atentados?|ataques? terroristas?|suicida", strong: true },
  { pattern: "declared? war|war (?:broke out|erupted)", strong: true },
  { pattern: "massacres?|masacres?", strong: true },
  { pattern: "ground (?:offensive|assault)|military operation", strong: true },
  { pattern: "operación militar|ofensiva terrestre|incursión", strong: true },
  {
    pattern: "gunmen|opened fire|open fire|pistoleros|abrieron fuego",
    strong: true,
  },
  { pattern: "attacks?|attacked|offensive|clashes|fighting", strong: false },
  { pattern: "raids?|struck|strikes?|escalat(?:es|ed|ion|ing)", strong: false },
  { pattern: "hostages?|rehenes|retaliat(?:ed|ion|ory)", strong: false },
  { pattern: "ataques?|ofensiva|combates|enfrentamientos", strong: false },
  { pattern: "escalada|represalias?", strong: false },
]

const threatTerms: Term[] = [
  { pattern: "nuclear(?:es)?|warheads?|uranium|uranio", strong: true },
  { pattern: "ballistic|balísticos?|missile tests?", strong: true },
  { pattern: "pruebas? de misiles|armas? nucleares", strong: true },
  { pattern: "military build-?up|troops? massing|war games", strong: true },
  {
    pattern: "military drills?|maniobras militares|ejercicios militares",
    strong: true,
  },
  {
    pattern: "brink of war|risk of war|threat of war|war fears?",
    strong: true,
  },
  {
    pattern: "riesgo de guerra|amenaza de guerra|carrera armamentista",
    strong: true,
  },
  { pattern: "arms race|terror (?:threat|plot|alert)s?", strong: true },
  { pattern: "ultimatum|ultimátum", strong: true },
  { pattern: "threat(?:s|ens|ened|ening)?|warn(?:s|ed|ing)?", strong: false },
  { pattern: "amenaza(?:s|n)?|amenazó|advierte|advirtió", strong: false },
  { pattern: "tensions?|tensión|tensiones|standoff", strong: false },
  { pattern: "deploy(?:s|ed|ment)?|despliegue|despliega", strong: false },
  { pattern: "mobili[sz](?:es|ed|ation)|movilización", strong: false },
  { pattern: "sanctions?|sanciones", strong: false },
  {
    pattern: "ceasefire|truce|peace talks|alto el fuego|tregua",
    strong: false,
  },
  { pattern: "negociaciones de paz", strong: false },
]

// Wording that frames an event as not (yet) realized: "threatens strikes",
// "planning attacks", "threat of attack looms" are threats, not acts.
const threatModal: Term[] = [
  {
    pattern:
      "threat(?:s|en|ens|ened|ening)?|warn(?:s|ed|ing)?|looms?|looming|plan(?:s|ned|ning)|plots?|fears?|vows?|brace[sd]?|bracing",
    strong: false,
  },
  {
    pattern:
      "amenaza(?:s|n)?|amenazó|advierte|advirtió|planea(?:n|ba)?|planes|teme(?:n)?|temor(?:es)?|riesgo",
    strong: false,
  },
]

const context = new RegExp(
  "(?<![\\p{L}\\p{N}])(?:war|wars|military|army|troops?|soldiers?|missiles?|drones?|navy|border|militants?|terror\\w*|guerra|militar(?:es)?|ejército|tropas|soldados|misiles?|drones?|frontera|milicias?|terroris\\w*|russia|rusia|ukraine|ucrania|israel\\w*|iran\\w*|irán|gaza|hamas|hezbollah|houthis?|hutíes|china|taiwan|taiwán|nato|otan|north korea|corea del norte|syria|siria|lebanon|líbano|yemen|sudan|sudán|kremlin|pentagon|pentágono|putin|zelensky\\w*|netanyahu)(?![\\p{L}\\p{N}])",
  "iu",
)

const compile = (terms: Term[]) =>
  terms.map((term) => ({
    strong: term.strong,
    regex: new RegExp(
      `(?<![\\p{L}\\p{N}])(?:${term.pattern})(?![\\p{L}\\p{N}])`,
      "iu",
    ),
  }))
type Rule = {
  category: GprNewsCategory
  strong: boolean
  needsEvent?: boolean
  terms: ReturnType<typeof compile>
}
const split = (terms: Term[], strong: boolean) =>
  compile(terms.filter((term) => term.strong === strong))

// Precedence: unambiguous acts, unambiguous threats, threat framing, then
// generic act/threat vocabulary. Non-strong rules need geopolitical context.
const rules: Rule[] = [
  { category: "act", strong: true, terms: split(actTerms, true) },
  { category: "threat", strong: true, terms: split(threatTerms, true) },
  {
    category: "threat",
    strong: false,
    needsEvent: true,
    terms: compile(threatModal),
  },
  { category: "act", strong: false, terms: split(actTerms, false) },
  { category: "threat", strong: false, terms: split(threatTerms, false) },
]
const eventTerms = compile([...actTerms, ...threatTerms])
const hasEvent = (value: string) =>
  /(?<![\p{L}\p{N}])(?:war|wars|guerra|guerras)(?![\p{L}\p{N}])/iu.test(
    value,
  ) || eventTerms.some((term) => term.regex.test(value))

function classifyText(value: string) {
  const hasContext = context.test(value)
  for (const rule of rules) {
    if (!rule.strong && !hasContext) continue
    for (const term of rule.terms) {
      const match = term.regex.exec(value)
      if (!match) continue
      // Threat framing only counts next to the war/attack it refers to.
      if (
        rule.needsEvent &&
        !hasEvent(
          value.slice(
            Math.max(0, match.index - 60),
            match.index + match[0].length + 60,
          ),
        )
      )
        continue
      return { category: rule.category, signal: match[0].toLowerCase() }
    }
  }
  return null
}

// The headline decides when it carries a signal; otherwise the summary and
// feed categories are used, as the GPR counts any mention in the article.
export function classifyHeadline(title: string, summary = "") {
  return classifyText(title) ?? classifyText(`${title}. ${summary}`)
}

type ImageCandidate = {
  url: string
  width: number | null
}

function collectImages(node: unknown, out: ImageCandidate[]) {
  for (const entry of list(node)) {
    const media = record(entry)
    const url = httpsUrl(String(media["@_url"] ?? ""))
    const type = String(media["@_type"] ?? "")
    const medium = String(media["@_medium"] ?? "")
    const isImage =
      medium === "image" ||
      type.startsWith("image/") ||
      (!medium && !type && url !== null && !/\.(mp4|m3u8|mp3)(\?|$)/i.test(url))
    const width = Number(media["@_width"])
    if (url && isImage)
      out.push({
        url,
        width: Number.isFinite(width) && width > 0 ? width : null,
      })
    // Video entries (El País) carry their poster in a nested thumbnail.
    collectImages(media["media:thumbnail"], out)
  }
}

// Picks the article's own image, preferring one close to thumbnail size.
function articleImage(item: JsonRecord) {
  const candidates: ImageCandidate[] = []
  collectImages(item["media:content"], candidates)
  collectImages(item["media:thumbnail"], candidates)
  collectImages(
    list(item.enclosure).filter((entry) =>
      String(record(entry)["@_type"] ?? "").startsWith("image/"),
    ),
    candidates,
  )
  if (!candidates.length) return null
  const score = (candidate: ImageCandidate) =>
    candidate.width === null
      ? 500
      : candidate.width < 120
        ? 1000 + (120 - candidate.width)
        : Math.abs(candidate.width - 320)
  return candidates.sort((a, b) => score(a) - score(b))[0].url
}

async function readFeed(feed: typeof feeds[number]) {
  const body = await fetchFeed(feed.url)
  if (/<!DOCTYPE|<!ENTITY/i.test(body)) throw new Error("Unsupported feed")
  const channel = record(record(record(parser.parse(body)).rss).channel)
  const articles: GprNewsArticle[] = []
  for (const entry of list(channel.item).slice(0, 60)) {
    const item = record(entry)
    const title = text(item.title).slice(0, 300)
    const url = httpsUrl(text(item.link) || text(item.guid))
    if (!title || !url) continue
    const summary = [
      text(item.description),
      ...list(item.category).map(text),
    ].join(". ")
    const classification = classifyHeadline(title, summary.slice(0, 1500))
    if (!classification) continue
    const date = Date.parse(text(item.pubDate))
    articles.push({
      id: createHash("sha256").update(url).digest("hex").slice(0, 16),
      title,
      url,
      source: feed.name,
      publishedAt: Number.isFinite(date) ? new Date(date).toISOString() : null,
      image: articleImage(item),
      ...classification,
    })
  }
  return articles
}

export async function loadGprNews() {
  const results = await Promise.allSettled(feeds.map(readFeed))
  const articles = results.flatMap((result) =>
    result.status === "fulfilled" ? result.value : [],
  )
  if (!articles.length) throw new Error("No geopolitical headlines")
  const unique = [
    ...new Map(articles.map((article) => [article.url, article])).values(),
  ]
    .sort(
      (a, b) =>
        (Date.parse(b.publishedAt ?? "") || 0) -
        (Date.parse(a.publishedAt ?? "") || 0),
    )
    .slice(0, 40)
  return {
    status: "available" as const,
    checkedAt: new Date().toISOString(),
    sources: [...new Set(unique.map((article) => article.source))],
    articles: unique,
  }
}
