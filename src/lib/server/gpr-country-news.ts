// Country-scoped news.
//
// Order of preference: GDELT DOC 2.0 (primary), Google News RSS (fallback for
// GDELT 429/timeouts), and the already cached world feeds filtered by country.
//
// The country feed now covers five areas (GPR, politics, economy, finance and
// law), keeps a 30-day window, orders the feed by recency and ranks the three
// or four key facts shown on the card by concrete impact.

import { createHash } from "node:crypto"
import { XMLParser } from "fast-xml-parser"
import {
  articleTags,
  cleanHeadline,
  countryForIso3,
  dedupeArticles,
  matchCountries,
  tagsFromArticles,
  titleSimilarity,
  titleTokens,
} from "@/lib/gpr-country"
import {
  classifyTopic,
  gprTopicMeta,
  hasTopicSignal,
  type GprTopic,
} from "@/lib/gpr-topics"
import {
  isEntertainmentSource,
  isExcludedSource,
  isSportsSource,
  sourceProfile,
} from "@/lib/gpr-sources"
import type {
  GprCountryNewsArticle,
  GprCountryNewsProvider,
  GprCountryNewsResponse,
  GprHighlight,
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
const MAX_ARTICLES = 30
const MAX_HIGHLIGHTS = 4
const WINDOW_MS = 30 * 24 * 60 * 60_000
const USE_FULL_QUERY = 40

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

// Google News sometimes returns the whole feed title as the source
// ("Investing.com México - Finanzas, Bolsa y Forex"). Keep just the outlet.
function cleanSourceName(value: string) {
  return value.split(/\s[-–—|]\s/)[0].trim()
}

function stripSourceSuffix(title: string, source: string) {
  if (!source) return title
  const name = source.trim().toLowerCase()
  // Google's own copy of the title ends with the exact source name, which can
  // itself contain a dash. Strip that before trying the generic suffix rule.
  const tail = ` ${name}`
  if (title.toLowerCase().endsWith(tail))
    return title
      .slice(0, -tail.length)
      .replace(/\s[-–—|]\s*$/, "")
      .trim()
  const match = SOURCE_SUFFIX.exec(title)
  if (!match) return title
  const suffix = match[1].trim().toLowerCase()
  if (suffix === name || suffix.startsWith(`${name} `))
    return title.slice(0, match.index).trim()
  return title
}

// ---------------------------------------------------------------- GDELT query

// One request per country, but wide enough to surface the five areas. GDELT is
// the bottleneck, so the topic blocks are OR-ed instead of issuing one query
// per area (which would immediately hit its rate limit).
const TOPIC_TERMS = [
  // GPR
  "war",
  "attack",
  "strike",
  "threat",
  "sanctions",
  "conflict",
  "ceasefire",
  "peace talks",
  "troops",
  "missile",
  "border",
  "nuclear",
  // Politics
  "election",
  "president",
  "congress",
  "parliament",
  "government",
  "protest",
  "opposition",
  // Economy
  "inflation",
  "GDP",
  "recession",
  "trade",
  "exports",
  "tariffs",
  "budget",
  "employment",
  // Finance
  "central bank",
  "interest rate",
  "currency",
  "debt",
  "bonds",
  "banking",
  "credit",
  "IMF",
  "reserves",
  // Law
  "supreme court",
  "court",
  "ruling",
  "judge",
  "constitution",
  "law",
  "regulation",
  "antitrust",
  "corruption",
  "prosecutor",
  "extradition",
]

function searchQuery(name: string, aliases: string[]) {
  const countries = [name, ...aliases.filter((alias) => alias !== name)]
    .slice(0, 4)
    .map((term) => `"${term}"`)
    .join(" OR ")
  const topics = TOPIC_TERMS.map((term) => `"${term}"`).join(" OR ")
  return `(${countries}) AND (${topics})`
}

// Google News ranks by relevance, not recency, so the topic-heavy query often
// returns month-old features. This short country-only query returns the latest
// batch (100 items); topic classification happens locally afterwards.
function countriesQuery(name: string, aliases: string[]) {
  return [name, ...aliases.filter((alias) => alias !== name)]
    .slice(0, 4)
    .map((term) => `"${term}"`)
    .join(" OR ")
}

// ----------------------------------------------------------- Google News RSS

const LOCALES = [
  { hl: "en-US", gl: "US", ceid: "US:en" },
  { hl: "es-419", gl: "MX", ceid: "MX:es-419" },
  { hl: "pt-BR", gl: "BR", ceid: "BR:pt-419" },
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
        const rawSource = text(record(item.source)["#text"] ?? item.source)
        const source = cleanSourceName(rawSource) || "Google News"
        const title = stripSourceSuffix(stripSourceSuffix(rawTitle, rawSource), source)
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

function enrich(
  article: RawArticle,
  iso3: string,
  requireTopic = false,
): GprCountryNewsArticle | null {
  const matches = matchCountries(article.title)
  // Precision first: a headline that never names the country is not part of
  // its feed. Mentions from article summaries are added from the world feed.
  if (!matches.inTitle.has(iso3)) return null
  // Google's country-only query also returns sports, celebrities and general
  // interest, so those items must mention one of the five areas.
  if (requireTopic && !hasTopicSignal(article.title)) return null

  const topic = classifyTopic(article.title)
  const classification = classifyHeadline(article.title)
  const gpr =
    topic === "gpr"
      ? (classification ?? { category: "act" as const, signal: "conflicto" })
      : null

  return {
    id: articleId(article.url),
    title: article.title,
    url: article.url,
    source: article.source,
    publishedAt: article.publishedAt,
    image: article.image,
    imageUrl: article.image,
    category: gpr?.category,
    type: gpr ? (gpr.category === "act" ? "GPRA" : "GPRT") : undefined,
    signal: gpr?.signal ?? gprTopicMeta[topic].label,
    countries: matches.countries.includes(iso3)
      ? matches.countries
      : [...matches.countries, iso3],
    tags: articleTags(article.title),
    topic,
    inTitle: true,
    relevance: 1,
  }
}

function fromGlobalFeed(
  article: GprNewsArticle,
  iso3: string,
): GprCountryNewsArticle {
  const matches = matchCountries(article.title)
  const inTitle = matches.inTitle.has(iso3)
  return {
    ...article,
    imageUrl: article.image,
    topic: article.topic ?? classifyTopic(article.title),
    inTitle,
    relevance: inTitle ? 1 : 0.4,
  }
}

// ------------------------------------------------------------- highlight scoring

const NOISE =
  /\b(football|soccer|basketball|baseball|nba|nfl|mlb|nhl|tennis|cricket|rugby|golf|volleyball|volley|olympics?|world cup|champions league|match|matches|tournament|fixture|league|sports?|midfield|goalkeeper|striker|winger|lineup|qualifier|friendly|amistoso|amistosos|torcedor|torcedores|torcida|futebol|futbol|futbolista|jogador|jogadores|campeonato|volei|vôlei|gol|gols|goleada|golear|medalha|atleta|atletas|deporte|deportes|deportivo|formacion|alineacion|convocatoria|convocados|arquero|delantero|mediocampista|entrenador|dibu|ancelotti|vinicius|romario|neymar|mbappe|hamburguesa|hamburger|restaurante|restaurant|chef|receta|gastronomia|celebrity|entertainment|movie|film|album|concert|festival|fashion|royals?|telenovela|reality show|anime|manga|symphonic|sinfonica|cinema|trailer|cantante|pelicula|gaming|videogame|video game|gamepad|gamer|game controller|game console|controller|liga|ligas|fpf|alianza lima|universitario de deportes|sporting cristal|melgar|fichajes?|goleador(?:es)?|eliminatorias|clasificaci[oó]n al mundial|selecci[oó]n peruana|selecci[oó]n argentina|selecci[oó]n brasile[ñn]a|selecci[oó]n mexicana|copa am[eé]rica|copa libertadores|copa sudamericana|finales de (?:la )?liga|real madrid|boca juniors|river plate|flamengo|palmeiras|corinthians|peregrinaci[oó]n|pilgrimage|street djs?|gastronom\w*|street food|turismo|tourism|travel guide|far[aá]ndula|espect[aá]culos|conciertos?|pasarela|novela|videojuegos?|corte de (?:luz|agua|gas|internet)|sin (?:luz|agua|gas)|panamericanos|juegos panamericanos|escalada|coyote sightings)\b/i

// Trading-terminal flashes ("ST LOUIS FED'S MUSALEM/ARGENTINA: ...") are all
// caps before the colon. They are useful in the feed but not card highlights.
const WIRE = /^[^a-z]{12,}:/

const OPINION =
  /\b(opinion|op-ed|editorial|commentary|column|analysis|explainer|podcast|newsletter|review|preview|recap|live blog|what to know|takeaways|sponsored|advertisement|press release|paid content)\b/i

// Features and explanatory pieces can name a real event but read as analysis,
// not as a fact. They stay in the feed and are only kept out of the card.
const ANALYSIS =
  /\b(why|por qu[eé]|what to know|explainer|explained|analysis|in depth|long read|feature|a look at|the story of|will remake|won't return|left to fight|draws praise|draws criticism|feel the impact|gives new relevance|rare images)\b/i

// Social posts and commodity-campaign notes are not key country facts, even
// when they name the country.
const SOCIAL =
  /\b(instagram|facebook|twitter|tiktok|threads|youtube|linkedin)\b/i
const SECTOR =
  /\b(arándanos?|arandanos?|blueberr(?:y|ies)|cosecha|harvest|horticultura|fishmeal|harina de pescado)\b/i

// Daily market wraps ("oil futures fell", "stocks close higher", "bonos
// débiles") are coverage of prices, not of the country's risk. They remain in
// the feed but do not become key facts.
const MARKET_RECAP =
  /\b(futures? (?:fell|rose|drop|gain|ca[ií]ram|subiram)|os futuros|pre[cç]o do petr[oó]leo|oil prices? (?:rise|fall|drop|gain|surge|slip)|stocks? (?:rise|fall|close|end|gain|drop|higher|lower)|shares? (?:rise|fall|jump|slip)|wall street (?:closes?|ends?)|market (?:close|wrap|recap)|bolsa (?:sube|baja|cierra|recupera)|acciones (?:suben|caen|cierran)|bonos (?:d[eé]biles|caen|suben)|riesgo pa[ií]s)\b/i

const STRONG_ACT =
  /\b(approves?|approved|passes?|passed|signs?|signed|rules?|ruled|upholds?|overturns?|sentences?|convicts?|raises?|cuts?|hikes?|holds?|wins?|won|launches?|seizes?|bans?|banned|sanctions?|sanctioned|resigns?|arrests?|orders?|announces?|rejects?|blocks?|defaults?|invades?|strikes?|kills?|detains?|aprueba|aprobado|sanciona|condena|falla|sube|baja|recorta|gana|anuncia|ordena|arresta|detiene|bloquea|rechaza)\b/i

const HEDGE =
  /\b(could|may|might|would|warns?|warned|threatens?|threatened|considers?|weighs?|plans?|signals?|expected|set to|podria|adviert\w*|amenaza|analiza|evalua|planea|preve\w*)\b/i

// Local crime ("man hospitalized after shooting") and blotter-style notes are
// not a country trend. They stay in the feed, but never in the card highlights,
// unless the same headline is also a high-impact story (war, sanctions, cartels,
// corruption...).
const LOCAL_CRIME =
  /\b(shooting|shootings|gunman|gunmen|murder(?:ed|s)?|homicide|assassinat\w*|stabbing|stabbings|assault|robbery|burglary|carjack\w*|hospitalized|hate crime|domestic violence|missing person|kidnap\w*|gunned down|shot dead|killed|kills|tiroteo|asesinat\w*|asesinan|asesinaron|homicidio|apuñalad\w*|herido|hospitalizado|robo|asalto|secuestro|balacera|matan|mataron|morto|morta|muerto|muerta|muertos|muertas|recluso|reclusos|penitenciar\w*|carcelario|golpiza)\b/i

const LOCAL_CRIME_OVERRIDE =
  /\b(war|guerra|sanctions?|sanciones?|tariffs?|aranceles?|corruption|corrupci[oó]n|elections?|elecciones?|imf|fmi|missiles?|misiles?|airstrikes?|air strikes?|strikes?|bombardeos?|bombing|bombs?|attacks?|invasi[oó]n|offensive|ofensiva|troops|tropas|armed conflict|conflicto armado|atentado|terroris\w*)\b/i

function isLocalCrime(title: string) {
  return LOCAL_CRIME.test(title) && !LOCAL_CRIME_OVERRIDE.test(title)
}

// ------------------------------------------------------------- highlights
//
// The card shows three or four concrete facts, not a thematic overview. Each
// highlight keeps the original headline and its source; ranking favours actions
// (rate decisions, summits, sanctions, rulings, elections) over analysis and
// hedged speculation, and the selection avoids repeating the same topic until
// the list has enough distinct facts.

type EventRule = {
  key: string
  weight: number
  match: RegExp
}

const EVENT_RULES: EventRule[] = [
  {
    key: "conflict",
    weight: 2.6,
    match:
      /\b(missiles?|misiles?|airstrikes?|air strikes?|drone attacks?|attacks?|ataques?|offensive|ofensiva|troops|tropas|invasion|invasi[oó]n|ceasefire|alto el fuego|bombardeos?|bombing|artillery|artiller[ií]a|frontline|frente de batalla)\b/i,
  },
  {
    key: "sanctions",
    weight: 2.4,
    match:
      /\b(sanctions?|sanciones?|sanctioned|sancionad[oa]s?|embargo(?:s)?|blacklist\w*|lista negra)\b/i,
  },
  {
    key: "rates",
    weight: 2.4,
    // A central-bank name alone is not an event: the headline must also report
    // a decision or a movement in the policy rate.
    match:
      /(?=[\s\S]*\b(bcrp|banco central|central bank|federal reserve|the fed|ecb|bce)\b)(?=[\s\S]*\b(raises?|raised|cuts?|cut|holds?|held|hikes?|sube|subi[oó]|baja|baj[oó]|recorta|recort[oó]|mantiene|mantuvo|decide|decidi[oó]|intervenes?|interviene|intervenci[oó]n|steps? in|autoriza|autoriz[oó]|authori[sz]es?|authori[sz]ed|approves?|approved|aprueba|aprob[oó]|policy rate|tasas? de inter[eé]s)\b)/i,
  },
  {
    key: "trade",
    weight: 2.2,
    match:
      /\b(tariffs?|aranceles?|trade (?:war|deal|agreement|talks|pact)|guerra comercial|acuerdo comercial|negociaciones comerciales|export controls?|controles? de exportaci[oó]n|wto|omc)\b/i,
  },
  {
    key: "elections",
    weight: 2.1,
    match:
      /\b(elections?|elecciones?|runoff|balotaje|referendum|referendo|ballot|votaci[oó]n|primaries|primarias)\b/i,
  },
  {
    key: "courts",
    weight: 2.0,
    // Demand a court context so nouns like "new rules" are not read as rulings.
    match:
      /(?=[\s\S]*\b(court|corte|tribunal|judge|juez|supreme|constitucional|constitutional)\b)(?=[\s\S]*\b(rules?|ruled|upheld|overturned|fallo|sentencia|convicted|condena|impeachment|juicio pol[ií]tico)\b)/i,
  },
  {
    key: "diplomacy",
    weight: 1.9,
    match:
      /\b(summit|cumbre|bilateral|bilaterales|state visit|visita oficial|visita de estado|meets?|met|meeting|talks?|se re[uú]ne|reuni[oó]n|recibe|received|visit(?:s|ed)?|visita|arriv(?:es|ed)|llega|lleg[oó]|delegation|delegaci[oó]n|di[aá]logo|treaty|tratado)\b/i,
  },
  {
    key: "imf",
    weight: 1.9,
    match:
      /\b(imf|fmi|fondo monetario internacional|international monetary fund)\b/i,
  },
  {
    key: "budget",
    weight: 1.5,
    match:
      /\b(budget|presupuesto|austerity|austeridad|ajuste fiscal|tax reform|reforma (?:tributaria|fiscal)|spending cuts?|recortes? (?:de gasto|presupuestarios?))\b/i,
  },
  {
    key: "appointment",
    weight: 1.4,
    match:
      /\b(resigns?|resigned|resignaci[oó]n|renuncia|appoints?|appointed|nombra(?:do|da)?|designa(?:do|da)?|sworn in|juramenta)\b/i,
  },
]

function eventFor(title: string) {
  let best: EventRule | null = null
  for (const rule of EVENT_RULES) {
    if (!rule.match.test(title)) continue
    if (!best || rule.weight > best.weight) best = rule
  }
  return best
}

// Headlines that may feed the card: country in the title, dated inside the
// 30-day window, no noise/opinion/wire flashes and no local crime.
function cardPool(articles: GprCountryNewsArticle[], now: number) {
  const windowStart = now - WINDOW_MS
  return articles.filter(
    (article) =>
      article.inTitle &&
      !!article.publishedAt &&
      (Date.parse(article.publishedAt) || 0) >= windowStart &&
      !NOISE.test(article.title) &&
      !OPINION.test(article.title) &&
      !ANALYSIS.test(article.title) &&
      !SECTOR.test(article.title) &&
      !SOCIAL.test(article.source) &&
      !MARKET_RECAP.test(article.title) &&
      !WIRE.test(article.title) &&
      !isLocalCrime(article.title) &&
      !isExcludedSource(article.source, article.url) &&
      !isSportsSource(article.source, article.url) &&
      !isEntertainmentSource(article.source, article.url),
  )
}

function recencyScore(publishedAt: string | null, now: number) {
  if (!publishedAt) return 0
  const ageHours = Math.max(0, (now - Date.parse(publishedAt)) / 3_600_000)
  if (!Number.isFinite(ageHours)) return 0
  if (ageHours <= 24) return 3
  if (ageHours <= 72) return 2
  if (ageHours <= 7 * 24) return 1.2
  if (ageHours <= 30 * 24) return 0.4
  return 0
}

function highlightScore(
  article: GprCountryNewsArticle,
  index: number,
  pool: GprCountryNewsArticle[],
  now: number,
) {
  const profile = sourceProfile(article.source, article.url)
  const repetition = pool.filter(
    (other) =>
      other.id !== article.id &&
      other.inTitle &&
      titleSimilarity(other.title, article.title) > 0.45,
  ).length

  let score = profile.weight * 1.4 + recencyScore(article.publishedAt, now)
  score += Math.min(repetition, 3) * 0.8
  score += eventFor(article.title)?.weight ?? 0
  if (STRONG_ACT.test(article.title)) score += 0.6
  else if (HEDGE.test(article.title)) score -= 1.1
  if (article.topic === "gpr") score += 0.3
  if (!profile.free) score -= 0.5
  // Earlier GDELT/Google positions are the most pertinent results.
  score += Math.max(0, 1 - index / 30) * 0.8
  return score
}

function pickHighlights(
  articles: GprCountryNewsArticle[],
  now: number,
): GprHighlight[] {
  const pool = cardPool(articles, now)
  const ranked = pool
    .map((article, index) => ({
      article,
      score: highlightScore(article, index, pool, now),
    }))
    .sort((a, b) => b.score - a.score)

  const picked: GprCountryNewsArticle[] = []
  const perTopic = new Map<GprTopic, number>()
  const perEvent = new Map<string, number>()

  // One fact per event type is enough on a compact card; diplomacy is the
  // exception because two different meetings can be separate key facts. A
  // second fact per topic keeps the list varied without dropping a second
  // strong story from the same area.
  const addCandidates = (maxPerTopic: number, limitEvents: boolean) => {
    for (const { article } of ranked) {
      if (picked.length >= MAX_HIGHLIGHTS) return
      if (picked.includes(article)) continue
      if (
        picked.some((other) =>
          isNearDuplicate(other.title, article.title, 0.55),
        )
      )
        continue
      const count = perTopic.get(article.topic) ?? 0
      if (count >= maxPerTopic) continue
      const event = eventFor(article.title)?.key
      if (limitEvents && event) {
        const seen = perEvent.get(event) ?? 0
        if (seen >= (event === "diplomacy" ? 2 : 1)) continue
      }
      picked.push(article)
      perTopic.set(article.topic, count + 1)
      if (event) perEvent.set(event, (perEvent.get(event) ?? 0) + 1)
    }
  }

  addCandidates(2, true)
  // Small countries often have only one or two areas or event types: fill the
  // remaining slots rather than leaving the card with fewer than three facts.
  if (picked.length < 3) addCandidates(MAX_HIGHLIGHTS, false)

  return picked.map((article) => ({
    topic: article.topic,
    title: cleanHeadline(article.title),
    url: article.url,
    source: sourceProfile(article.source, article.url).label,
    publishedAt: article.publishedAt,
  }))
}

function byDateDesc(a: GprCountryNewsArticle, b: GprCountryNewsArticle) {
  return (
    (Date.parse(b.publishedAt ?? "") || 0) -
    (Date.parse(a.publishedAt ?? "") || 0)
  )
}

// The same fact is often covered by several outlets with slightly different
// wording ("chicken ban" vs "poultry ban", "clients of some big banks" vs
// "clients of several main banks"). Jaccard alone misses those pairs, so an
// overlap coefficient (shared / smaller set) over lightly stemmed tokens
// catches the near-duplicates.
function stemToken(token: string) {
  if (token.length <= 4) return token
  return token.replace(/(ing|ed|es|s)$/, "")
}

function titleOverlap(left: string, right: string) {
  const a = new Set([...titleTokens(left)].map(stemToken))
  const b = new Set([...titleTokens(right)].map(stemToken))
  if (!a.size || !b.size) return 0
  let shared = 0
  for (const token of a) if (b.has(token)) shared += 1
  return shared / Math.min(a.size, b.size)
}

function normalizedTitle(title: string, length = 36) {
  return title
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .slice(0, length)
}

// Common stem of an all-caps wire flash, ignoring the desk suffix that changes
// between takes ("...MUSALEM (NON VOTER)/ARGENTINA" vs "...MUSALEM/ARGENTINA").
function wireStem(title: string) {
  const colon = title.indexOf(":")
  if (colon < 12) return ""
  const head = title.slice(0, colon)
  if (/[a-z]/.test(head)) return ""
  return normalizedTitle(head, 22)
}

// Wire-service headlines often repeat a desk prefix. That prefix means one
// event, not four.
function sharesPrefix(left: string, right: string) {
  const a = normalizedTitle(left)
  const b = normalizedTitle(right)
  if (a.length >= 24 && a === b) return true
  const wa = wireStem(left)
  return wa.length >= 16 && wa === wireStem(right)
}

function isNearDuplicate(left: string, right: string, threshold: number) {
  return (
    sharesPrefix(left, right) ||
    titleSimilarity(left, right) > threshold ||
    titleOverlap(left, right) >= 0.6
  )
}

// The generic dedupe keeps a 0.75 threshold; the country feed tightens it so
// the reader does not see the same story twice in a row.
function dedupeByTitle<T extends { title: string }>(
  articles: T[],
  threshold: number,
) {
  const kept: T[] = []
  for (const article of articles) {
    if (
      kept.some((item) =>
        isNearDuplicate(item.title, article.title, threshold),
      )
    )
      continue
    kept.push(article)
  }
  return kept
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
  const recentQuery = countriesQuery(name, aliases)

  let failures = false

  const gdelt = await searchGdelt(query, USE_FULL_QUERY)
  if (gdelt.status !== "ok") failures = true

  let google: RawArticle[] = []
  if (!gdelt.articles.length) {
    const result = await readGoogleNews(recentQuery)
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
    (article) => enrich(article, iso3, true) ?? [],
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

  const now = Date.now()
  const windowStart = now - WINDOW_MS

  const merged = dedupeArticles([
    ...gdeltArticles,
    ...googleArticles,
    ...globalArticles,
  ])
    .filter(
      (article) =>
        !NOISE.test(article.title) &&
        !OPINION.test(article.title) &&
        !isSportsSource(article.source, article.url) &&
        !isEntertainmentSource(article.source, article.url),
    )
    .filter((article) => {
      if (type !== "all" && article.type !== type) return false
      if (!article.publishedAt) return true
      const time = Date.parse(article.publishedAt)
      return Number.isFinite(time) && time >= windowStart
    })

  // Feed: country-in-headline stories first (newest first), then mentions
  // outside the headline, then undated items.
  const dated = merged.filter((article) => !!article.publishedAt)
  const undated = merged.filter((article) => !article.publishedAt)
  const ordered = dedupeByTitle(
    [
      ...dated.filter((article) => article.inTitle).sort(byDateDesc),
      ...dated.filter((article) => !article.inTitle).sort(byDateDesc),
      ...undated,
    ],
    0.6,
  ).slice(0, MAX_ARTICLES)

  // Never cache an empty result caused by provider failures: an empty 200 would
  // hide the country for 15 minutes. Serve the previous good response when it
  // exists; otherwise let the route answer 503 so the client can retry.
  if (!ordered.length && failures) {
    const previous = lastGood.get(iso3)
    if (previous) return { ...previous, partial: true }
    throw new Error("Country news unavailable")
  }

  const response: GprCountryNewsResponse = {
    status: "available",
    checkedAt: new Date().toISOString(),
    iso3,
    provider,
    partial: failures,
    articles: ordered,
    highlights: pickHighlights(merged, now),
    tags: tagsFromArticles(ordered),
  }

  if (ordered.length) lastGood.set(iso3, response)
  return response
}
