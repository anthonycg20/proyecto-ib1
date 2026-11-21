// Source hierarchy for the GPR country feed.
//
// Weight is a ranking signal, never a filter: a local outlet can still be the
// most important story of the day. Bloomberg.com is the only excluded source
// (the free Spanish edition, Bloomberg Línea, is the one we keep). Free-access
// outlets win ties against paywalled ones.

export type SourceTier = "high" | "medium" | "low"

export type SourceProfile = {
  label: string
  tier: SourceTier
  weight: number
  free: boolean
}

type HighRule = {
  label: string
  domains: string[]
  names: string[]
  free: boolean
  // TradingView only counts when the link points to its newsroom.
  pathPrefix?: string
}

const HIGH: HighRule[] = [
  {
    label: "Bloomberg Línea",
    domains: ["bloomberglinea.com", "bloomberglinea.com.br"],
    names: ["bloomberg linea", "bloomberg lineea"],
    free: true,
  },
  {
    label: "Reuters",
    domains: ["reuters.com"],
    names: ["reuters"],
    free: true,
  },
  {
    label: "AP",
    domains: ["apnews.com"],
    names: ["ap", "ap news", "associated press"],
    free: true,
  },
  {
    label: "Financial Times",
    domains: ["ft.com"],
    names: ["financial times", "ft"],
    free: false,
  },
  {
    label: "The Wall Street Journal",
    domains: ["wsj.com"],
    names: ["wall street journal", "wsj"],
    free: false,
  },
  {
    label: "The New York Times",
    domains: ["nytimes.com"],
    names: ["new york times", "nytimes", "nyt"],
    free: false,
  },
  {
    label: "BBC News",
    domains: ["bbc.com", "bbc.co.uk"],
    names: ["bbc", "bbc news"],
    free: true,
  },
  {
    label: "The Guardian",
    domains: ["theguardian.com"],
    names: ["the guardian", "guardian"],
    free: true,
  },
  {
    label: "El País",
    domains: ["elpais.com"],
    names: ["el pais", "elpais"],
    free: true,
  },
  {
    label: "EFE",
    domains: ["efe.com"],
    names: ["efe", "agencia efe"],
    free: true,
  },
  {
    label: "Xinhua News Agency",
    domains: ["news.cn", "xinhuanet.com"],
    names: ["xinhua", "xinhua news", "xinhua news agency"],
    free: true,
  },
  {
    label: "Fox News",
    domains: ["foxnews.com"],
    names: ["fox news", "foxnews"],
    free: true,
  },
  {
    label: "CBS News",
    domains: ["cbsnews.com"],
    names: ["cbs news", "cbs"],
    free: true,
  },
  {
    label: "CNN",
    domains: ["cnn.com"],
    names: ["cnn"],
    free: true,
  },
  {
    label: "The Washington Post",
    domains: ["washingtonpost.com"],
    names: ["washington post", "wapo"],
    free: false,
  },
  {
    label: "Le Monde",
    domains: ["lemonde.fr"],
    names: ["le monde"],
    free: false,
  },
  {
    label: "Al Jazeera",
    domains: ["aljazeera.com"],
    names: ["al jazeera", "al jazeera english"],
    free: true,
  },
  {
    label: "France 24",
    domains: ["france24.com"],
    names: ["france 24", "france24"],
    free: true,
  },
  {
    label: "Investing.com",
    domains: ["investing.com"],
    names: ["investing", "investing com"],
    free: true,
  },
  {
    label: "TradingView",
    domains: ["tradingview.com"],
    names: ["tradingview", "tradingview news"],
    free: true,
    pathPrefix: "/news/",
  },
  {
    label: "Cointelegraph",
    domains: ["cointelegraph.com"],
    names: ["cointelegraph", "cointelegraph en espanol"],
    free: true,
  },
  {
    label: "CoinDesk",
    domains: ["coindesk.com"],
    names: ["coindesk", "coindesk espanol"],
    free: true,
  },
  {
    label: "DW",
    domains: ["dw.com"],
    names: ["dw", "dw espanol", "deutsche welle"],
    free: true,
  },
  {
    label: "Infobae",
    domains: ["infobae.com"],
    names: ["infobae", "infobae america", "infobae mexico"],
    free: true,
  },
]

type MediumRule = {
  label: string
  domains: string[]
  names: string[]
}

// Curated national/local outlets. They get a small boost over unknown domains
// but never outrank the international desks above.
const MEDIUM: MediumRule[] = [
  {
    label: "Folha de S.Paulo",
    domains: ["folha.uol.com.br"],
    names: ["folha de sao paulo", "folha"],
  },
  {
    label: "O Globo",
    domains: ["oglobo.globo.com", "globo.com"],
    names: ["o globo", "globo"],
  },
  {
    label: "Estadão",
    domains: ["estadao.com.br"],
    names: ["estadao"],
  },
  {
    label: "Valor Econômico",
    domains: ["valor.com.br"],
    names: ["valor economico", "valor"],
  },
  {
    label: "InfoMoney",
    domains: ["infomoney.com.br"],
    names: ["infomoney"],
  },
  {
    label: "Exame",
    domains: ["exame.com"],
    names: ["exame"],
  },
  {
    label: "Clarín",
    domains: ["clarin.com"],
    names: ["clarin"],
  },
  {
    label: "La Nación",
    domains: ["lanacion.com.ar"],
    names: ["la nacion"],
  },
  {
    label: "Ámbito",
    domains: ["ambito.com"],
    names: ["ambito"],
  },
  {
    label: "El Tiempo",
    domains: ["eltiempo.com"],
    names: ["el tiempo"],
  },
  {
    label: "El Espectador",
    domains: ["elespectador.com"],
    names: ["el espectador"],
  },
  {
    label: "Portafolio",
    domains: ["portafolio.co"],
    names: ["portafolio"],
  },
  {
    label: "El Universal",
    domains: ["eluniversal.com.mx"],
    names: ["el universal"],
  },
  {
    label: "Reforma",
    domains: ["reforma.com"],
    names: ["reforma"],
  },
  {
    label: "Milenio",
    domains: ["milenio.com"],
    names: ["milenio"],
  },
  {
    label: "El Financiero",
    domains: ["elfinanciero.com.mx"],
    names: ["el financiero"],
  },
  {
    label: "Expansión",
    domains: ["expansion.mx"],
    names: ["expansion"],
  },
  {
    label: "La Tercera",
    domains: ["latercera.com"],
    names: ["la tercera"],
  },
  {
    label: "Emol",
    domains: ["emol.com"],
    names: ["emol"],
  },
  {
    label: "El Comercio",
    domains: ["elcomercio.pe"],
    names: ["el comercio"],
  },
  {
    label: "Gestión",
    domains: ["gestion.pe"],
    names: ["gestion"],
  },
  {
    label: "El Nacional",
    domains: ["elnacional.com"],
    names: ["el nacional"],
  },
  {
    label: "El Observador",
    domains: ["elobservador.com.uy"],
    names: ["el observador"],
  },
  {
    label: "ABC Color",
    domains: ["abc.com.py"],
    names: ["abc color"],
  },
  {
    label: "La Prensa",
    domains: ["laprensa.com.ni"],
    names: ["la prensa"],
  },
  {
    label: "El Heraldo",
    domains: ["elheraldo.hn"],
    names: ["el heraldo"],
  },
  {
    label: "El Diario de Hoy",
    domains: ["elsalvador.com"],
    names: ["el diario de hoy"],
  },
  {
    label: "Listín Diario",
    domains: ["listindiario.com"],
    names: ["listin diario"],
  },
  {
    label: "Diario Libre",
    domains: ["diariolibre.com"],
    names: ["diario libre"],
  },
  {
    label: "La Nación (Costa Rica)",
    domains: ["nacion.com"],
    names: ["la nacion costa rica"],
  },
  {
    label: "Crónica",
    domains: ["cronica.com.mx"],
    names: ["cronica"],
  },
  {
    label: "La Jornada",
    domains: ["jornada.com.mx"],
    names: ["la jornada"],
  },
  {
    label: "Proceso",
    domains: ["proceso.com.mx"],
    names: ["proceso"],
  },
  {
    label: "El Colombiano",
    domains: ["elcolombiano.com"],
    names: ["el colombiano"],
  },
  {
    label: "Semana",
    domains: ["semana.com"],
    names: ["semana"],
  },
  {
    label: "Dinero",
    domains: ["dinero.com"],
    names: ["dinero"],
  },
]

function normalizeHost(value: string) {
  try {
    return new URL(value).hostname.replace(/^www\./, "").toLowerCase()
  } catch {
    return ""
  }
}

function normalizeSourceName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\.(com|net|org|co|br|ar|mx|pe|cl|uy|py|ni|hn|sv|do)(\.[a-z]{2})?\b/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\b(the|news|english|edition)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function domainMatches(host: string, domain: string) {
  return host === domain || host.endsWith(`.${domain}`)
}

function nameMatches(name: string, alias: string) {
  if (!name || !alias) return false
  if (name === alias) return true
  // "Bloomberg Línea Colombia" should still match "bloomberg linea".
  return alias.length >= 5 && name.startsWith(`${alias} `)
}

function pathAllows(rule: HighRule, url: string) {
  if (!rule.pathPrefix) return true
  try {
    return new URL(url).pathname.startsWith(rule.pathPrefix)
  } catch {
    return false
  }
}

export function sourceProfile(
  source: string,
  url?: string | null,
): SourceProfile {
  const host = url ? normalizeHost(url) : ""
  const name = normalizeSourceName(source)

  for (const rule of HIGH) {
    const domainHit =
      !!host && rule.domains.some((domain) => domainMatches(host, domain))
    const nameHit = rule.names.some((alias) =>
      nameMatches(name, normalizeSourceName(alias)),
    )
    if (!domainHit && !nameHit) continue
    // A TradingView profile/chart link is not newsroom content.
    if (domainHit && url && !pathAllows(rule, url)) continue
    return { label: rule.label, tier: "high", weight: 3, free: rule.free }
  }

  for (const rule of MEDIUM) {
    const domainHit =
      !!host && rule.domains.some((domain) => domainMatches(host, domain))
    const nameHit = rule.names.some((alias) =>
      nameMatches(name, normalizeSourceName(alias)),
    )
    if (!domainHit && !nameHit) continue
    return { label: rule.label, tier: "medium", weight: 1, free: true }
  }

  return {
    label: source || host || "Fuente",
    tier: "low",
    weight: 0,
    free: true,
  }
}

// Bloomberg.com is intentionally excluded from the highlights. Bloomberg Línea
// (free, Spanish) is a different source and stays in the high tier.
export function isExcludedSource(source: string, url?: string | null) {
  const host = url ? normalizeHost(url) : ""
  if (host === "bloomberg.com" || host.endsWith(".bloomberg.com"))
    return true
  const name = normalizeSourceName(source)
  return name === "bloomberg" || name === "bloomberg com"
}

// Label used by the GDELT client, which only knows the article domain.
export function sourceLabelFromDomain(domain: string) {
  const host = domain.replace(/^www\./, "").toLowerCase()
  for (const rule of HIGH) {
    if (rule.domains.some((item) => domainMatches(host, item))) return rule.label
  }
  for (const rule of MEDIUM) {
    if (rule.domains.some((item) => domainMatches(host, item))) return rule.label
  }
  const parent = host.split(".").slice(-2).join(".")
  return parent || host
}

// Sports and entertainment outlets are relevant to the dashboard only when
// they cover a real GPR/policy story, so the country feed drops them outright.
const SPORTS_DOMAINS = [
  "espn.com",
  "espn.com.br",
  "espn.com.mx",
  "sports.yahoo.com",
  "marca.com",
  "as.com",
  "goal.com",
  "skysports.com",
  "foxsports.com",
  "cbssports.com",
  "bleacherreport.com",
  "ge.globo.com",
  "globoesporte.globo.com",
  "ole.com.ar",
  "record.pt",
  "abola.pt",
  "sport.es",
  "mundodeportivo.com",
  "givemesport.com",
  "theathletic.com",
]

const SPORTS_NAMES = [
  "espn",
  "espn brasil",
  "espn mexico",
  "yahoo sports",
  "marca",
  "as",
  "goal",
  "sky sports",
  "fox sports",
  "cbs sports",
  "bleacher report",
  "globo esporte",
  "ole",
  "a bola",
  "mundo deportivo",
  "the athletic",
]

const ENTERTAINMENT_DOMAINS = [
  "crunchyroll.com",
  "imdb.com",
  "filmaffinity.com",
  "sensacine.com",
  "tmz.com",
  "eonline.com",
  "people.com",
  "variety.com",
  "hollywoodreporter.com",
  "filo.news",
  "billboard.com",
  "rollingstone.com",
]

const ENTERTAINMENT_NAMES = [
  "crunchyroll",
  "imdb",
  "filmaffinity",
  "sensacine",
  "tmz",
  "e online",
  "people",
  "variety",
  "hollywood reporter",
  "filo news",
  "billboard",
  "rolling stone",
]

function matchesSourceList(
  source: string,
  url: string | null | undefined,
  domains: string[],
  names: string[],
) {
  const host = url ? normalizeHost(url) : ""
  if (host && domains.some((domain) => domainMatches(host, domain)))
    return true
  const name = normalizeSourceName(source)
  return names.some((alias) => name === normalizeSourceName(alias))
}

export function isSportsSource(source: string, url?: string | null) {
  return matchesSourceList(source, url, SPORTS_DOMAINS, SPORTS_NAMES)
}

export function isEntertainmentSource(source: string, url?: string | null) {
  return matchesSourceList(
    source,
    url,
    ENTERTAINMENT_DOMAINS,
    ENTERTAINMENT_NAMES,
  )
}
