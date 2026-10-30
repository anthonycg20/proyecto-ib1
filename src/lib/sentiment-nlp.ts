export type HeadlineSentiment = "positive" | "negative" | "neutral"

export type MarketArticle = {
  id: string
  title: string
  url: string
  source: string
  publishedAt: string | null
  sentiment: HeadlineSentiment
}

export type MarketNewsResponse = {
  status: "available" | "unavailable"
  checkedAt: string
  articles: MarketArticle[]
  reading: {
    text: string
    themes: string[]
    counts: Record<HeadlineSentiment, number>
    method: "lexicon-nlp"
  }
  sources: string[]
}

const normalize = (text: string) =>
  text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()

export function isMarketHeadline(title: string) {
  return /\b(markets?|stocks?|shares?|bonds?|bonos?|bolsas?|mercados?|acciones|wall street|nasdaq|dow|s&p|vix|fed|bce|tipos|rates?|interest|inflacion|inflation|aranceles?|tariffs?|deuda|divisas|bursatil|bursatiles|rentabilidad|volatilidad|petroleo|oil|barclays|bank|banco|banca|credit|credito)\b/.test(
    normalize(title),
  )
}

const positiveWords = new Set([
  "rally",
  "gains",
  "gain",
  "surge",
  "surges",
  "rises",
  "rise",
  "rebounds",
  "rebound",
  "optimism",
  "recovery",
  "recover",
  "growth",
  "boost",
  "boosts",
  "sube",
  "suben",
  "subida",
  "alza",
  "alzas",
  "ganan",
  "ganancias",
  "avanza",
  "avanzan",
  "repunte",
  "recuperacion",
  "optimismo",
  "mejora",
  "crece",
  "crecen",
])
const negativeWords = new Set([
  "falls",
  "fall",
  "loss",
  "losses",
  "slump",
  "slumps",
  "plunge",
  "plunges",
  "fears",
  "fear",
  "uncertainty",
  "recession",
  "crisis",
  "war",
  "selloff",
  "declines",
  "decline",
  "cuts",
  "cae",
  "caen",
  "baja",
  "bajan",
  "hunde",
  "hunden",
  "caida",
  "caidas",
  "pierde",
  "pierden",
  "perdidas",
  "retrocede",
  "retroceden",
  "miedo",
  "incertidumbre",
  "recesion",
  "guerra",
  "desplome",
  "tensiones",
  "riesgos",
  "hundimiento",
])
const negations = new Set(["no", "not", "sin", "never", "nunca"])

export function analyseHeadline(title: string): HeadlineSentiment {
  const words = normalize(title).match(/[a-z]+/g) ?? []
  let score = 0
  words.forEach((word, index) => {
    const sign = words
      .slice(Math.max(0, index - 2), index)
      .some((item) => negations.has(item))
      ? -1
      : 1
    if (positiveWords.has(word)) score += sign
    if (negativeWords.has(word)) score -= sign
  })
  return score > 0 ? "positive" : score < 0 ? "negative" : "neutral"
}

const topics = [
  {
    label: "tipos de interés y bancos centrales",
    pattern:
      /\b(rates?|interest|fed|bce|tipos|interes|banco central|bancos centrales)\b/,
  },
  {
    label: "inflación y actividad económica",
    pattern:
      /\b(inflation|inflacion|economy|economia|economic|economico|pib|gdp|recesion|recession|empleo|jobs)\b/,
  },
  {
    label: "resultados empresariales y tecnología",
    pattern:
      /\b(earnings|profits|beneficios|resultados|tecnologia|technology|tech|nvidia|apple|microsoft|amazon|ia|ai)\b/,
  },
  {
    label: "comercio y tensiones geopolíticas",
    pattern:
      /\b(tariffs?|aranceles|arancel|war|guerra|china|oil|petroleo|iran|conflict|conflicto|trade|comercio)\b/,
  },
  {
    label: "volatilidad y apetito por riesgo",
    pattern:
      /\b(volatility|volatilidad|vix|risk|riesgo|miedo|fear|selloff|desplome)\b/,
  },
]

export function summarizeHeadlines(
  articles: MarketArticle[],
): MarketNewsResponse["reading"] {
  const counts: Record<HeadlineSentiment, number> = {
    positive: 0,
    negative: 0,
    neutral: 0,
  }
  for (const article of articles) counts[article.sentiment]++
  const themes = topics
    .map((topic) => ({
      label: topic.label,
      count: articles.filter((article) =>
        topic.pattern.test(normalize(article.title)),
      ).length,
    }))
    .filter((topic) => topic.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 3)
    .map((topic) => topic.label)
  if (!articles.length) {
    return {
      text: "No hay titulares disponibles para generar la lectura diaria. Volvé a intentar cuando las fuentes respondan.",
      counts,
      themes,
      method: "lexicon-nlp",
    }
  }
  const balance =
    counts.negative > counts.positive
      ? "un tono de cautela"
      : counts.positive > counts.negative
        ? "un tono favorable al riesgo"
        : "un tono mixto, sin una dirección dominante"
  const text = `En ${articles.length} titulares recientes predomina ${balance}. ${
    themes.length
      ? `El foco informativo está en ${themes.slice(0, 2).join(" y ")}. `
      : "No se detectó un tema financiero dominante. "
  }La lectura describe el lenguaje de las noticias, no una relación causal.`
  return { text, themes, counts, method: "lexicon-nlp" }
}
