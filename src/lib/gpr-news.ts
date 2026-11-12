// Contracts and copy shared by the GPR news route and the GPR dashboard.

export type GprNewsCategory = "act" | "threat"

// Public label used by the card and the feed badges.
export type GprNewsType = "GPRA" | "GPRT"

export type GprNewsArticle = {
  id: string
  title: string
  url: string
  source: string
  publishedAt: string | null
  image: string | null
  category: GprNewsCategory
  type: GprNewsType
  signal: string
  countries: string[]
  tags: string[]
}

export type GprCountryNewsArticle = GprNewsArticle & {
  // Alias kept for consumers that expect the card-friendly name.
  imageUrl: string | null
  relevance: number
}

export type GprCountryNewsProvider = "GDELT" | "Google News" | "RSS"

export type GprCountryNewsResponse = {
  status: "available"
  checkedAt: string
  iso3: string
  provider: GprCountryNewsProvider
  partial: boolean
  articles: GprCountryNewsArticle[]
  drivers: string[]
  tags: string[]
}

export type GprNewsResponse = {
  status: "available"
  checkedAt: string
  sources: string[]
  articles: GprNewsArticle[]
} | GprNewsUnavailable

export type GprNewsUnavailable = {
  status: "unavailable"
  checkedAt: string
}

export const gprDefinitions = {
  all: {
    label: "GPR",
    name: "Geopolitical Risk Index",
    text: "Mide el riesgo geopolítico a partir de la proporción de artículos en periódicos internacionales de primer nivel (NYT, WSJ, FT, Guardian, entre otros) que mencionan eventos como guerras, terrorismo y tensiones entre Estados. Está normalizado a un promedio de 100 en el periodo 2000-2009, y hay versiones diaria y mensual.",
  },
  threat: {
    label: "GPRT",
    name: "GPR Threats",
    text: "Subíndice de amenazas. Captura artículos sobre riesgos que aún no se materializan, como amenazas de guerra, acumulación militar, amenazas nucleares y amenazas terroristas.",
  },
  act: {
    label: "GPRA",
    name: "GPR Acts",
    text: "Subíndice de actos. Captura eventos que ya ocurrieron, como el inicio o la escalada de una guerra y los actos terroristas.",
  },
} as const
