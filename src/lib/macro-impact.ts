// Traduce los eventos de Forex Factory a una lectura en español con los
// activos más sensibles y el escenario de impacto. Es sensibilidad típica, no
// una recomendación: el texto siempre se plantea como escenario condicional.

import type { EconomicImpact } from "@/lib/economic-calendar"

export type MacroCategory =
  | "Precios"
  | "Empleo"
  | "Consumo"
  | "Actividad"
  | "Fed"
  | "Energía"
  | "Vivienda"
  | "Exterior"
  | "Macro"

export type MacroAsset = {
  symbol: string
  /** Símbolo de TradingView, usado para abrir la Terminal de mercado. */
  tv: string
  /** Ticker de Yahoo Finance para las velas del Squeeze. */
  yahoo: string
  name: string
}

export const macroAssets: Record<string, MacroAsset> = {
  VOO: { symbol: "VOO", tv: "AMEX:VOO", yahoo: "VOO", name: "S&P 500 ETF" },
  NVDA: { symbol: "NVDA", tv: "NASDAQ:NVDA", yahoo: "NVDA", name: "Nvidia" },
  TSM: { symbol: "TSM", tv: "NYSE:TSM", yahoo: "TSM", name: "TSMC" },
  MSFT: { symbol: "MSFT", tv: "NASDAQ:MSFT", yahoo: "MSFT", name: "Microsoft" },
  AMZN: { symbol: "AMZN", tv: "NASDAQ:AMZN", yahoo: "AMZN", name: "Amazon" },
  AAPL: { symbol: "AAPL", tv: "NASDAQ:AAPL", yahoo: "AAPL", name: "Apple" },
  MA: { symbol: "MA", tv: "NYSE:MA", yahoo: "MA", name: "Mastercard" },
  HD: { symbol: "HD", tv: "NYSE:HD", yahoo: "HD", name: "Home Depot" },
  META: { symbol: "META", tv: "NASDAQ:META", yahoo: "META", name: "Meta" },
  GOOGL: { symbol: "GOOGL", tv: "NASDAQ:GOOGL", yahoo: "GOOGL", name: "Alphabet" },
  XLE: { symbol: "XLE", tv: "AMEX:XLE", yahoo: "XLE", name: "Energía (XLE)" },
  CVX: { symbol: "CVX", tv: "NYSE:CVX", yahoo: "CVX", name: "Chevron" },
  XOM: { symbol: "XOM", tv: "NYSE:XOM", yahoo: "XOM", name: "Exxon Mobil" },
  BTC: { symbol: "BTC", tv: "BITSTAMP:BTCUSD", yahoo: "BTC-USD", name: "Bitcoin" },
  ETH: { symbol: "ETH", tv: "BITSTAMP:ETHUSD", yahoo: "ETH-USD", name: "Ethereum" },
  EWG: { symbol: "EWG", tv: "AMEX:EWG", yahoo: "EWG", name: "Alemania (EWG)" },
  EWU: { symbol: "EWU", tv: "AMEX:EWU", yahoo: "EWU", name: "Reino Unido (EWU)" },
  EWJ: { symbol: "EWJ", tv: "AMEX:EWJ", yahoo: "EWJ", name: "Japón (EWJ)" },
  FXI: { symbol: "FXI", tv: "AMEX:FXI", yahoo: "FXI", name: "China (FXI)" },
  EWC: { symbol: "EWC", tv: "AMEX:EWC", yahoo: "EWC", name: "Canadá (EWC)" },
  EWA: { symbol: "EWA", tv: "AMEX:EWA", yahoo: "EWA", name: "Australia (EWA)" },
  EWW: { symbol: "EWW", tv: "AMEX:EWW", yahoo: "EWW", name: "México (EWW)" },
  EWZ: { symbol: "EWZ", tv: "AMEX:EWZ", yahoo: "EWZ", name: "Brasil (EWZ)" },
}

/** Puente para la Terminal de mercado: símbolo TradingView → Yahoo. */
export const macroAssetTargets: Record<string, { ticker: string; label: string }> =
  Object.fromEntries(
    Object.values(macroAssets).map((asset) => [
      asset.tv,
      { ticker: asset.yahoo, label: asset.symbol },
    ]),
  )

/** Acciones y ETF del país del evento, además de los activos de la familia. */
const countryAssets: Record<string, string[]> = {
  USD: ["VOO", "NVDA", "TSM"],
  EUR: ["EWG"],
  GBP: ["EWU"],
  JPY: ["EWJ"],
  CNY: ["FXI"],
  CAD: ["EWC"],
  AUD: ["EWA"],
  MXN: ["EWW"],
  BRL: ["EWZ"],
}

export const countryNames: Record<string, string> = {
  USD: "EE.UU.",
  EUR: "Eurozona",
  GBP: "Reino Unido",
  JPY: "Japón",
  CNY: "China",
  CAD: "Canadá",
  AUD: "Australia",
  CHF: "Suiza",
  MXN: "México",
  BRL: "Brasil",
  NZD: "Nueva Zelanda",
}

export type MacroProfile = {
  id: string
  match: RegExp
  title: string
  category: MacroCategory
  description: string
  assets: string[]
  /** Escenario si el dato sale por encima de la previsión. */
  up: string
  /** Escenario si el dato sale por debajo de la previsión. */
  down: string
}

// El orden importa: "Core CPI" antes que "CPI", "NFP" antes que desempleo.
const profiles: MacroProfile[] = [
  {
    id: "core-cpi",
    match: /core (?:cpi|consumer price)/i,
    title: "IPC núcleo (Core CPI) — inflación subyacente",
    category: "Precios",
    description:
      "Inflación sin alimentos ni energía; es la lectura que mira la Fed para decidir tasas.",
    assets: ["VOO", "NVDA", "TSM", "BTC"],
    up: "tasas altas por más tiempo: presión en growth (NVDA, TSM) y cripto; VOO cae menos",
    down: "desinflación subyacente: alivio de tasas y rebote de growth y cripto",
  },
  {
    id: "cpi",
    match: /cpi|consumer price index/i,
    title: "IPC (CPI) — inflación al consumidor",
    category: "Precios",
    description:
      "Precio de la canasta básica; anticipa la inflación que sigue la Fed y mueve tasas.",
    assets: ["VOO", "NVDA", "TSM", "MSFT", "BTC"],
    up: "suben los rendimientos: golpea growth (NVDA, TSM, MSFT) y cripto; VOO aguanta mejor",
    down: "alivio de tasas: favorable a growth, cripto y bonos; VOO suele rebotar",
  },
  {
    id: "core-ppi",
    match: /core (?:ppi|producer price)/i,
    title: "IPP núcleo (Core PPI) — costos sin energía",
    category: "Precios",
    description:
      "Costos mayoristas sin alimentos ni energía; anticipa la presión de precios al consumidor.",
    assets: ["VOO", "NVDA", "MSFT", "AMZN", "BTC"],
    up: "costos más altos: márgenes bajo presión y tasas firmes; growth y cripto ceden",
    down: "menos presión de costos: favorable a márgenes y bonos",
  },
  {
    id: "ppi",
    match: /ppi|producer price/i,
    title: "IPP (PPI) — inflación al productor",
    category: "Precios",
    description:
      "Precios al por mayor; anticipa presiones futuras sobre el IPC.",
    assets: ["VOO", "NVDA", "MSFT", "AMZN", "BTC"],
    up: "anticipa IPC más alto: presión en tasas y en growth; cripto débil",
    down: "se enfría la cadena de precios: alivio para márgenes y tasas",
  },
  {
    id: "core-pce",
    match: /core pce/i,
    title: "PCE núcleo — la inflación preferida de la Fed",
    category: "Precios",
    description:
      "Medida de inflación del gasto de los hogares; guía la decisión de tasas de la Fed.",
    assets: ["VOO", "NVDA", "MSFT", "TSM", "BTC"],
    up: "inflación pegajosa: la Fed espera para recortar, presión en growth y cripto",
    down: "se acerca la meta del 2%: alivio de tasas y mejor valuación para growth",
  },
  {
    id: "pce",
    match: /pce|personal consumption expenditure/i,
    title: "PCE — inflación del gasto",
    category: "Precios",
    description:
      "Precios del gasto personal; el dato que la Fed usa como referencia principal.",
    assets: ["VOO", "NVDA", "MSFT", "AMZN", "BTC"],
    up: "precios altos: tasas firmes y presión en consumo y growth",
    down: "precios moderados: alivio de tasas y apoyo al consumo",
  },
  {
    id: "nfp",
    match: /non-?farm|nfp|nonfarm payroll/i,
    title: "Nóminas no agrícolas (NFP)",
    category: "Empleo",
    description:
      "Creación de empleo del mes; el dato laboral de mayor impacto sobre tasas y dólar.",
    assets: ["VOO", "AMZN", "MA", "AAPL", "BTC"],
    up: "empleo fuerte: tasas altas y dólar firme; growth y cripto ceden",
    down: "empleo flojo: recortes de tasa más cerca; alivio para growth y cripto",
  },
  {
    id: "adp",
    match: /adp/i,
    title: "Empleo ADP (private payrolls)",
    category: "Empleo",
    description:
      "Estimación privada del empleo; adelanta el tono del informe oficial de nóminas.",
    assets: ["VOO", "AMZN", "MA", "AAPL", "BTC"],
    up: "más contrataciones: mercado laboral firme y tasas altas",
    down: "menos contrataciones: enfriamiento laboral, alivio de tasas",
  },
  {
    id: "claims",
    match: /unemployment claims|jobless|initial claims/i,
    title: "Solicitudes de desempleo (jobless claims)",
    category: "Empleo",
    description:
      "Lectura semanal del mercado laboral; un alza inesperada anticipa enfriamiento.",
    assets: ["VOO", "AMZN", "MA", "AAPL", "BTC"],
    up: "más despidos: enfría consumo (AMZN, MA) y alivia tasas; cripto toma aire",
    down: "mercado laboral firme: presión en tasas, growth y cripto",
  },
  {
    id: "unemployment-rate",
    match: /unemployment rate/i,
    title: "Tasa de desempleo",
    category: "Empleo",
    description:
      "Porcentaje de la fuerza laboral sin empleo; complementa el dato de nóminas.",
    assets: ["VOO", "AMZN", "MA", "AAPL", "BTC"],
    up: "desempleo alto: negativo para consumo y cíclicas, favorable a bonos",
    down: "desempleo bajo: consumo firme y tasas más altas",
  },
  {
    id: "wages",
    match: /average hourly earnings|earnings m\/m/i,
    title: "Salarios por hora (average hourly earnings)",
    category: "Empleo",
    description:
      "Crecimiento de salarios; si acelera, sostiene la inflación de servicios.",
    assets: ["VOO", "AMZN", "MA", "AAPL", "BTC"],
    up: "salarios altos: inflación más pegajosa, tasas firmes y presión en growth",
    down: "salarios moderados: alivio de inflación y de tasas",
  },
  {
    id: "jolts",
    match: /jolts|job openings/i,
    title: "Vacantes JOLTS (job openings)",
    category: "Empleo",
    description:
      "Puestos de trabajo sin cubrir; mide la tensión real del mercado laboral.",
    assets: ["VOO", "AMZN", "MA", "BTC"],
    up: "más vacantes: mercado laboral tenso, tasas altas",
    down: "menos vacantes: se enfría el empleo, alivia tasas",
  },
  {
    id: "fed-rate",
    match: /federal funds rate|rate decision|fomc statement/i,
    title: "Decisión de tasas de la Fed (FOMC)",
    category: "Fed",
    description:
      "Tasa de referencia de EE.UU.; define el costo del dinero para acciones y cripto.",
    assets: ["VOO", "NVDA", "TSM", "BTC", "ETH"],
    up: "tasa más alta de lo previsto: golpea growth, cripto y bonos",
    down: "tasa más baja: alivio para growth (NVDA, TSM), cripto y bonos",
  },
  {
    id: "fed-speak",
    match: /fomc|fed chair|fed speak|powell|fomc member|fed governor/i,
    title: "Fed: declaraciones y actas",
    category: "Fed",
    description:
      "Señales sobre el ritmo de recortes; el mercado ajusta tasas esperadas.",
    assets: ["VOO", "NVDA", "BTC", "ETH"],
    up: "tono más duro del esperado: presión en growth y cripto",
    down: "tono más blando: alivio de tasas para growth y cripto",
  },
  {
    id: "core-retail",
    match: /core retail sales/i,
    title: "Ventas minoristas núcleo (core retail sales)",
    category: "Consumo",
    description:
      "Gasto del consumidor sin autos ni combustibles; mide la tendencia de fondo.",
    assets: ["AMZN", "MA", "AAPL", "VOO"],
    up: "consumo subyacente firme: favorable a AMZN, MA y AAPL; tasas más altas",
    down: "consumo subyacente débil: golpea minoristas, tarjetas y cíclicas",
  },
  {
    id: "retail",
    match: /retail sales/i,
    title: "Ventas minoristas (retail sales)",
    category: "Consumo",
    description:
      "Gasto del consumidor; dos tercios del PIB de EE.UU. dependen de él.",
    assets: ["AMZN", "MA", "AAPL", "VOO"],
    up: "consumo fuerte: favorable a AMZN, MA y AAPL; tasas más altas",
    down: "consumo débil: golpea minoristas y cíclicas",
  },
  {
    id: "inflation-expectations",
    match: /inflation expectations/i,
    title: "Expectativas de inflación",
    category: "Precios",
    description:
      "Inflación esperada por los consumidores; si se desancla, complica a la Fed.",
    assets: ["VOO", "NVDA", "BTC"],
    up: "expectativas altas: la Fed mantiene tasas, golpea growth y cripto",
    down: "expectativas ancladas: alivio para tasas y valuaciones",
  },
  {
    id: "michigan",
    match: /michigan|uom|consumer sentiment/i,
    title: "Confianza del consumidor (U. de Michigan)",
    category: "Consumo",
    description:
      "Sentimiento y expectativas de inflación del consumidor; anticipa el gasto.",
    assets: ["AMZN", "MA", "AAPL", "VOO"],
    up: "mejor sentimiento: apoyo al consumo; si suben las expectativas de inflación, presión en tasas",
    down: "sentimiento débil: negativo para consumo y cíclicas",
  },
  {
    id: "cb-confidence",
    match: /cb consumer confidence|consumer confidence/i,
    title: "Confianza del consumidor (Conference Board)",
    category: "Consumo",
    description:
      "Encuesta mensual de hogares; mide disposición a gastar en los próximos meses.",
    assets: ["AMZN", "MA", "AAPL", "VOO"],
    up: "consumo con impulso: favorable a minoristas y tarjetas",
    down: "hogares cautos: negativo para consumo discrecional",
  },
  {
    id: "ism-services",
    match: /ism services|services pmi|non-manufacturing/i,
    title: "Actividad de servicios (ISM)",
    category: "Actividad",
    description:
      "Termómetro del sector servicios; marca el ritmo de la economía.",
    assets: ["VOO", "AMZN", "MA", "AAPL"],
    up: "más actividad: favorable a cíclicas y consumo",
    down: "menos actividad: negativo para cíclicas",
  },
  {
    id: "ism-manufacturing",
    match: /ism manufacturing|manufacturing pmi|philly|empire state/i,
    title: "Actividad manufacturera (ISM / PMI)",
    category: "Actividad",
    description:
      "Pedidos y producción de fábricas; adelanta el ciclo industrial.",
    assets: ["VOO", "NVDA", "XOM", "AAPL"],
    up: "producción firme: favorable a industriales y cíclicas",
    down: "contracción industrial: negativo para cíclicas",
  },
  {
    id: "gdp",
    match: /gdp/i,
    title: "PIB (GDP) — crecimiento",
    category: "Actividad",
    description:
      "Crecimiento trimestral de la economía; mide el pulso general de la actividad.",
    assets: ["VOO", "NVDA", "AMZN", "AAPL"],
    up: "crecimiento fuerte: apoyo a acciones, pero tasas más altas",
    down: "crecimiento débil: negativo para cíclicas, alivia bonos",
  },
  {
    id: "durables",
    match: /durable goods/i,
    title: "Bienes durables (durable goods orders)",
    category: "Actividad",
    description:
      "Pedidos de bienes de larga duración; señal de inversión de las empresas.",
    assets: ["VOO", "NVDA", "HD", "XOM"],
    up: "inversión firme: positivo para industriales y tecnología",
    down: "pedidos flojos: señal de freno en la inversión",
  },
  {
    id: "energy",
    match: /crude oil inventories|eia|natural gas storage|opec/i,
    title: "Inventarios de petróleo",
    category: "Energía",
    description:
      "Stock semanal de crudo en EE.UU.; mueve el precio del petróleo y sus márgenes.",
    assets: ["XLE", "CVX", "XOM"],
    up: "más inventario: baja el crudo, presión en XLE, CVX y XOM",
    down: "menos inventario: sube el crudo, favorable a energéticas",
  },
  {
    id: "housing",
    match: /housing starts|building permits|home sales|nahb|mortgage/i,
    title: "Mercado inmobiliario",
    category: "Vivienda",
    description:
      "Inicios de obra y ventas de viviendas; el sector más sensible a las tasas.",
    assets: ["HD", "VOO", "MA"],
    up: "vivienda firme: positivo para consumo ligado a hogar y bancos",
    down: "vivienda débil: golpea a los sensibles a tasas",
  },
  {
    id: "trade",
    match: /trade balance|current account|exports|imports/i,
    title: "Balanza comercial",
    category: "Exterior",
    description:
      "Diferencia entre exportaciones e importaciones; afecta al PIB y al dólar.",
    assets: ["VOO", "AAPL", "AMZN"],
    up: "déficit mayor: resta al PBI y presiona al dólar",
    down: "déficit menor: aporta al PBI y sostiene al dólar",
  },
  {
    id: "personal",
    match: /personal income|personal spending/i,
    title: "Ingreso y gasto personal",
    category: "Consumo",
    description:
      "Ingresos y gasto de los hogares; sostén del consumo y de las tasas.",
    assets: ["AMZN", "MA", "AAPL", "VOO"],
    up: "gasto firme: sostiene consumo y tasas altas",
    down: "gasto débil: negativo para consumo discrecional",
  },
  {
    id: "inventories",
    match: /inventories|wholesale/i,
    title: "Inventarios mayoristas",
    category: "Actividad",
    description:
      "Stock en la cadena de distribución; señal secundaria del ciclo.",
    assets: ["VOO", "AMZN", "HD"],
    up: "inventario alto: puede indicar ventas flojas",
    down: "inventario bajo: reposición futura, favorable a la producción",
  },
]

const genericProfile: MacroProfile = {
  id: "generic",
  match: /./,
  title: "Evento macro",
  category: "Macro",
  description:
    "Dato macro de referencia; su impacto depende de la sorpresa frente a la previsión.",
  assets: ["VOO", "NVDA", "BTC"],
  up: "sorpresa al alza: tasas y dólar firmes; presión en growth y cripto",
  down: "sorpresa a la baja: alivio de tasas; apoyo a growth y cripto",
}

export function matchMacroProfile(title: string): MacroProfile {
  return profiles.find((profile) => profile.match.test(title)) ?? genericProfile
}

/** Primer número de un dato tipo "0.3%", "220K", "-1.2" o "4.00%". */
function firstNumber(value: string | null) {
  if (!value) return null
  const match = value.replace(",", ".").match(/-?\d+(?:\.\d+)?/)
  return match ? Number(match[0]) : null
}

export type MacroScenario = {
  state: "released" | "pending"
  tone: "up" | "down" | "flat" | "neutral"
  label: string
  text: string
}

function scenarioFor(
  profile: MacroProfile,
  actual: string | null,
  forecast: string | null,
): MacroScenario {
  const actualValue = firstNumber(actual)
  const forecastValue = firstNumber(forecast)
  if (actualValue !== null && forecastValue !== null) {
    const tolerance = Math.max(Math.abs(forecastValue) * 0.02, 0.005)
    const difference = actualValue - forecastValue
    if (Math.abs(difference) <= tolerance)
      return {
        state: "released",
        tone: "flat",
        label: "Salió en línea con lo previsto",
        text: "sin sorpresa: el mercado mantiene el rumbo y la atención pasa al próximo dato",
      }
    if (difference > 0)
      return {
        state: "released",
        tone: "up",
        label: "Salió arriba de lo previsto",
        text: profile.up,
      }
    return {
      state: "released",
      tone: "down",
      label: "Salió abajo de lo previsto",
      text: profile.down,
    }
  }
  if (actual)
    return {
      state: "released",
      tone: "neutral",
      label: "Dato publicado",
      text: `referencia: ${forecast ? `previsión ${forecast}, ` : ""}lectura ${actual}`,
    }
  return {
    state: "pending",
    tone: "neutral",
    label: "Escenarios",
    text: `si sale arriba de lo previsto, ${profile.up}; si sale abajo, ${profile.down}`,
  }
}

export type MacroReading = {
  profileId: string
  title: string
  category: MacroCategory
  description: string
  assets: MacroAsset[]
  country: string
  scenario: MacroScenario
}

export function describeMacroEvent(event: {
  title: string
  currency: string
  impact: EconomicImpact
  actual: string | null
  forecast: string | null
}): MacroReading {
  const profile = matchMacroProfile(event.title)
  const country = countryNames[event.currency] ?? event.currency
  const symbols = [
    ...profile.assets,
    ...(countryAssets[event.currency] ?? []),
  ].filter((symbol, index, list) => list.indexOf(symbol) === index)
  return {
    profileId: profile.id,
    title: profile.title,
    category: profile.category,
    description: profile.description,
    assets: symbols
      .slice(0, 5)
      .map((symbol) => macroAssets[symbol])
      .filter((asset): asset is MacroAsset => Boolean(asset)),
    country,
    scenario: scenarioFor(profile, event.actual, event.forecast),
  }
}
