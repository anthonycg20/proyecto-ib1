import type {
  HeatmapAsset,
  HeatmapSection,
  IndicatorFormat,
  IndicatorsSection,
  MarketIndicator,
} from "@/lib/market-data"

// Server-only readers for Finviz pages (the same pages finvizfinance scrapes)
// and Yahoo Finance's public chart/screener endpoints.

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
const MAX_BODY_CHARS = 3_000_000

const FINVIZ_SP500_URL =
  "https://finviz.com/screener.ashx?v=111&f=idx_sp500&o=-marketcap"
const FINVIZ_CRYPTO_URL = "https://finviz.com/crypto_performance.ashx"
const YAHOO_CHART_URL = "https://query1.finance.yahoo.com/v8/finance/chart/"
const YAHOO_CRYPTO_SCREENER_URL =
  "https://query1.finance.yahoo.com/v1/finance/screener/predefined/saved?scrIds=all_cryptocurrencies_us&count=60"

type JsonRecord = Record<string, unknown>

const record = (value: unknown): JsonRecord =>
  value && typeof value === "object" && !Array.isArray(value)
    ? value as JsonRecord
    : {}
const finite = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) ? value : null
const text = (value: unknown) => (typeof value === "string" ? value.trim() : "")
const round = (value: number, digits: number) => {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

async function fetchText(url: string, accept: string, timeoutMs = 10_000) {
  const response = await fetch(url, {
    cache: "no-store",
    signal: AbortSignal.timeout(timeoutMs),
    headers: {
      "User-Agent": USER_AGENT,
      Accept: accept,
      "Accept-Language": "en-US,en;q=0.9",
    },
  })
  if (!response.ok) throw new Error(`Upstream returned ${response.status}`)
  const body = await response.text()
  if (body.length > MAX_BODY_CHARS) throw new Error("Upstream body too large")
  return body
}

const fetchJson = async (url: string) =>
  JSON.parse(await fetchText(url, "application/json")) as unknown

type CacheEntry = {
  expires: number
  value?: unknown
  pending?: Promise<unknown>
}
const memory = new Map<string, CacheEntry>()

// Deduplicates concurrent loads and serves the last good value if a refresh fails.
export function cached<T>(
  key: string,
  ttlMs: number,
  loader: () => Promise<T>,
): Promise<T> {
  const entry = memory.get(key)
  if (entry?.value !== undefined && entry.expires > Date.now())
    return Promise.resolve(entry.value as T)
  if (entry?.pending) return entry.pending as Promise<T>

  const pending = loader().then(
    (value) => {
      memory.set(key, { expires: Date.now() + ttlMs, value })
      return value
    },
    (error: unknown) => {
      const previous = memory.get(key)?.value
      if (previous === undefined) {
        memory.delete(key)
        throw error
      }
      memory.set(key, {
        expires: Date.now() + Math.min(ttlMs, 30_000),
        value: previous,
      })
      return previous as T
    },
  )
  memory.set(key, {
    expires: entry?.expires ?? 0,
    value: entry?.value,
    pending,
  })
  return pending
}

// ---------------------------------------------------------------- Yahoo charts

type YahooChart = {
  meta: JsonRecord
  timestamps: number[]
  closes: (number | null)[]
}

async function yahooChart(
  symbol: string,
  range: string,
  interval: string,
): Promise<YahooChart> {
  const data = record(
    await fetchJson(
      `${YAHOO_CHART_URL}${encodeURIComponent(symbol)}?range=${range}&interval=${interval}`,
    ),
  )
  const result = record(
    (record(data.chart).result as unknown[] | undefined)?.[0],
  )
  const meta = record(result.meta)
  if (!Object.keys(meta).length) throw new Error(`No chart for ${symbol}`)
  const quote = record(
    (record(result.indicators).quote as unknown[] | undefined)?.[0],
  )
  const timestamps = Array.isArray(result.timestamp)
    ? result.timestamp.map((value) => finite(value) ?? 0)
    : []
  const closes = Array.isArray(quote.close)
    ? quote.close.map((value) => finite(value))
    : []
  return { meta, timestamps, closes }
}

const indicatorConfig: {
  id: string
  label: string
  symbol: string
  format: IndicatorFormat
  changeUnit?: "pb"
  risingIsRisk?: boolean
}[] = [
  { id: "spx", label: "S&P 500", symbol: "^GSPC", format: "index" },
  { id: "nasdaq", label: "NASDAQ", symbol: "^IXIC", format: "index" },
  { id: "dow", label: "DOW JONES", symbol: "^DJI", format: "index" },
  {
    id: "vix",
    label: "VIX",
    symbol: "^VIX",
    format: "index",
    risingIsRisk: true,
  },
  {
    id: "us10y",
    label: "TESORO 10A",
    symbol: "^TNX",
    format: "yield",
    changeUnit: "pb",
    risingIsRisk: true,
  },
  {
    id: "dxy",
    label: "DÓLAR DXY",
    symbol: "DX-Y.NYB",
    format: "index",
    risingIsRisk: true,
  },
  {
    id: "usdpen",
    label: "USD/PEN",
    symbol: "PEN=X",
    format: "fx",
    risingIsRisk: true,
  },
  { id: "wti", label: "PETRÓLEO WTI", symbol: "CL=F", format: "usd" },
  { id: "gold", label: "ORO", symbol: "GC=F", format: "usd" },
  { id: "copper", label: "COBRE", symbol: "HG=F", format: "usd" },
  { id: "btc", label: "BITCOIN", symbol: "BTC-USD", format: "usd0" },
]

async function loadIndicator(
  config: typeof indicatorConfig[number],
): Promise<MarketIndicator> {
  // range=1d makes chartPreviousClose the prior session's close.
  const { meta } = await yahooChart(config.symbol, "1d", "1d")
  const price = finite(meta.regularMarketPrice)
  const previousClose =
    finite(meta.chartPreviousClose) ?? finite(meta.previousClose)
  const marketTime = finite(meta.regularMarketTime)
  if (price === null || !previousClose || marketTime === null)
    throw new Error(`Incomplete quote for ${config.symbol}`)
  const change =
    config.changeUnit === "pb"
      ? round((price - previousClose) * 100, 1)
      : round(((price - previousClose) / previousClose) * 100, 2)
  return {
    id: config.id,
    label: config.label,
    symbol: config.symbol,
    price,
    previousClose,
    change,
    changeUnit: config.changeUnit ?? "%",
    format: config.format,
    risingIsRisk: config.risingIsRisk ?? false,
    marketTime: new Date(marketTime * 1000).toISOString(),
  }
}

export async function loadIndicators(): Promise<Extract<IndicatorsSection, {
  status: "available"
}>> {
  const results = await Promise.allSettled(indicatorConfig.map(loadIndicator))
  const items = results.flatMap((result) =>
    result.status === "fulfilled" ? [result.value] : [],
  )
  if (!items.length) throw new Error("No Yahoo Finance quotes")
  return {
    status: "available",
    source: "Yahoo Finance",
    asOf: items
      .map((item) => item.marketTime)
      .sort()
      .at(-1)!,
    items,
  }
}

type HistoryPoint = {
  date: string
  close: number
}

// Daily S&P 500 closes keyed by exchange-local trading date.
export async function loadSp500History(): Promise<HistoryPoint[]> {
  const { meta, timestamps, closes } = await yahooChart("^GSPC", "3y", "1d")
  const offset = finite(meta.gmtoffset) ?? 0
  const points: HistoryPoint[] = []
  timestamps.forEach((timestamp, index) => {
    const close = closes[index]
    if (!timestamp || close === null || close === undefined) return
    points.push({
      date: new Date((timestamp + offset) * 1000).toISOString().slice(0, 10),
      close: round(close, 2),
    })
  })
  if (points.length < 2) throw new Error("No S&P 500 history")
  return points
}

// ---------------------------------------------------------------- Finviz maps

function jsonScripts(html: string, attribute: RegExp) {
  const values: unknown[] = []
  for (const match of html.matchAll(
    /<script\b([^>]*)>([\s\S]*?)<\/script>/gi,
  )) {
    if (!attribute.test(match[1])) continue
    try {
      values.push(JSON.parse(match[2]))
    } catch {
      // Ignore non-JSON islands and keep looking.
    }
  }
  return values
}

type AvailableHeatmap = Extract<HeatmapSection, { status: "available" }>

// Datacenter IPs (Vercel) are routinely blocked by Finviz, so the S&P 500 map
// falls back to StockAnalysis's server-rendered table and finally to Yahoo
// charts over the largest index constituents.
const STOCKANALYSIS_SP500_URL = "https://stockanalysis.com/list/sp-500-stocks/"

const SP500_FALLBACK_SYMBOLS = [
  "NVDA",
  "MSFT",
  "AAPL",
  "AMZN",
  "GOOGL",
  "AVGO",
  "META",
  "TSLA",
  "BRK-B",
  "LLY",
  "JPM",
  "WMT",
  "V",
  "ORCL",
  "MA",
  "XOM",
  "COST",
  "NFLX",
  "JNJ",
  "PG",
]

const decodeEntities = (value: string) =>
  value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")

const plainText = (value: string) =>
  decodeEntities(value.replace(/<[^>]*>/g, " "))
    .replace(/\s+/g, " ")
    .trim()

const parseNumber = (value: string) => {
  const cleaned = value.replace(/[$%\s]/g, "").replace(/,/g, "")
  if (!cleaned || cleaned === "—" || cleaned === "-") return null
  const number = Number.parseFloat(cleaned)
  return Number.isFinite(number) ? number : null
}

// StockAnalysis prints market caps as "4.98T" / "812.4B" / "12.3M".
const parseMarketCap = (value: string) => {
  const match = /^([\d.,]+)\s*([TBM])$/i.exec(value.trim())
  if (!match) return null
  const base = parseNumber(match[1])
  const scales = { T: 1e12, B: 1e9, M: 1e6 } as const
  const scale = scales[match[2].toUpperCase() as keyof typeof scales]
  return base === null ? null : base * scale
}

async function loadFinvizSp500(): Promise<AvailableHeatmap> {
  const html = await fetchText(FINVIZ_SP500_URL, "text/html")
  const rows = jsonScripts(html, /data-ssr-props=/i)
    .map((props) => record(record(props).data).rows)
    .find(Array.isArray)
  if (!rows) throw new Error("Finviz screener data not found")

  const companies = new Set<string>()
  const assets: HeatmapAsset[] = []
  for (const row of rows) {
    const labels = record(record(row).text)
    const numbers = record(record(row).numbers)
    const symbol = text(labels.ticker)
    const name = text(labels.company)
    const marketCap = finite(numbers.marketCap)
    const change = finite(numbers.change)
    // GOOG and GOOGL are one company; keep the first listed share class.
    if (!symbol || !name || !marketCap || change === null) continue
    if (companies.has(name)) continue
    companies.add(name)
    assets.push({
      symbol,
      name,
      weight: marketCap,
      change: round(change, 2),
      price: finite(numbers.price),
      detail: text(labels.sector) || null,
    })
  }
  if (!assets.length) throw new Error("Finviz screener returned no rows")
  return {
    status: "available",
    source: "Finviz",
    sizing: "marketCap",
    asOf: new Date().toISOString(),
    assets: assets.sort((a, b) => b.weight - a.weight).slice(0, 20),
  }
}

async function loadStockAnalysisSp500(): Promise<AvailableHeatmap> {
  const html = await fetchText(STOCKANALYSIS_SP500_URL, "text/html")
  // The page ships Svelte marker comments between every node; removing them
  // first keeps the row/cell regexes readable.
  const body = html.replace(/<!--[\s\S]*?-->/g, "")
  const table = /<table[^>]*id="main-table"[\s\S]*?<\/table>/i.exec(body)?.[0]
  if (!table) throw new Error("StockAnalysis table not found")

  const companies = new Set<string>()
  const assets: HeatmapAsset[] = []
  for (const row of table.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = [...row[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map(
      (cell) => plainText(cell[1]),
    )
    // Columns: rank, symbol, company, weight, price, change, market cap.
    if (cells.length < 7) continue
    const symbol = cells[1].replace(/\s+/g, "")
    const name = cells[2]
    const weight = parseNumber(cells[3])
    const change = parseNumber(cells[5])
    if (!symbol || !name || change === null) continue
    if (companies.has(name)) continue
    companies.add(name)
    assets.push({
      symbol,
      name,
      weight: weight ?? parseMarketCap(cells[6]) ?? 1,
      change: round(change, 2),
      price: parseNumber(cells[4]),
      detail: null,
    })
  }
  if (assets.length < 5)
    throw new Error("StockAnalysis returned too few rows")
  return {
    status: "available",
    source: "StockAnalysis · S&P 500",
    sizing: "marketCap",
    asOf: new Date().toISOString(),
    assets: assets.sort((a, b) => b.weight - a.weight).slice(0, 20),
  }
}

async function loadYahooSp500(): Promise<AvailableHeatmap> {
  const results = await Promise.allSettled(
    SP500_FALLBACK_SYMBOLS.map(async (symbol): Promise<HeatmapAsset> => {
      const { meta } = await yahooChart(symbol, "1d", "1d")
      const price = finite(meta.regularMarketPrice)
      const previous =
        finite(meta.chartPreviousClose) ?? finite(meta.previousClose)
      const reported = finite(meta.regularMarketChangePercent)
      const change =
        reported ??
        (price !== null && previous ? (price / previous - 1) * 100 : null)
      if (price === null || change === null)
        throw new Error(`No quote for ${symbol}`)
      return {
        symbol,
        name: text(meta.longName) || text(meta.shortName) || symbol,
        weight: 1,
        change: round(change, 2),
        price,
        detail: text(meta.exchangeName) || null,
      }
    }),
  )
  const assets = results.flatMap((result) =>
    result.status === "fulfilled" ? [result.value] : [],
  )
  if (assets.length < 8) throw new Error("Yahoo returned too few quotes")
  return {
    status: "available",
    source: "Yahoo Finance",
    sizing: "equal",
    asOf: new Date().toISOString(),
    assets,
  }
}

export async function loadSp500Heatmap(): Promise<AvailableHeatmap> {
  let lastError: unknown
  for (const loader of [
    loadFinvizSp500,
    loadStockAnalysisSp500,
    loadYahooSp500,
  ]) {
    try {
      return await loader()
    } catch (error) {
      lastError = error
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error("S&P 500 heatmap unavailable")
}

const cryptoFallbackOrder = [
  "BTC",
  "ETH",
  "XRP",
  "BNB",
  "SOL",
  "TRX",
  "DOGE",
  "ADA",
  "HYPE",
  "LINK",
  "BCH",
  "XLM",
]

async function loadCryptoMarketCaps() {
  const data = record(await fetchJson(YAHOO_CRYPTO_SCREENER_URL))
  const result = record(
    (record(data.finance).result as unknown[] | undefined)?.[0],
  )
  const caps = new Map<string, number>()
  for (const quote of Array.isArray(result.quotes) ? result.quotes : []) {
    const item = record(quote)
    // Yahoo uses suffixed ids for some coins, e.g. HYPE32196-USD.
    const base = text(item.symbol).replace(/-USD$/, "").replace(/\d+$/, "")
    const marketCap = finite(item.marketCap)
    if (base && marketCap && !caps.has(base)) caps.set(base, marketCap)
  }
  return caps
}

export async function loadCryptoHeatmap(): Promise<AvailableHeatmap> {
  const [html, caps] = await Promise.all([
    fetchText(FINVIZ_CRYPTO_URL, "text/html"),
    loadCryptoMarketCaps().catch(() => new Map<string, number>()),
  ])
  const rows = jsonScripts(html, /id=["']crypto-perf-init-data["']/i)
    .map((data) => record(data).rows)
    .find(Array.isArray)
  if (!rows) throw new Error("Finviz crypto data not found")

  const assets: HeatmapAsset[] = []
  for (const row of rows) {
    const item = record(row)
    const symbol = text(item.ticker).replace(/USD$/, "")
    const change = finite(item.perfDayPct)
    if (!symbol || change === null) continue
    assets.push({
      symbol,
      name: text(item.label) || symbol,
      weight: caps.get(symbol) ?? 0,
      change: round(change, 2),
      price: finite(item.last),
      detail: null,
    })
  }

  const sized = assets.filter((asset) => asset.weight > 0)
  const selected = sized.length
    ? sized.sort((a, b) => b.weight - a.weight).slice(0, 12)
    : cryptoFallbackOrder.flatMap((symbol) => {
        const asset = assets.find((item) => item.symbol === symbol)
        return asset ? [{ ...asset, weight: 1 }] : []
      })
  if (!selected.length) throw new Error("Finviz crypto returned no rows")
  return {
    status: "available",
    source: sized.length ? "Finviz · Yahoo Finance" : "Finviz",
    sizing: sized.length ? "marketCap" : "equal",
    asOf: new Date().toISOString(),
    assets: selected,
  }
}
