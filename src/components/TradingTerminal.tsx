"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import type {
  Candle,
  CandleInterval,
  CandlesResponse,
  WatchlistQuote,
  WatchlistQuotesResponse,
} from "@/lib/market-data"
import { computeSqueeze } from "@/lib/squeeze"
import SqueezeMomentum from "./SqueezeMomentum"

const CHART_TAG = "tv-advanced-chart"
const CHART_SCRIPT =
  "https://widgets.tradingview-widget.com/w/es/tv-advanced-chart.js"

let chartScript: Promise<void> | null = null

function loadChartScript() {
  if (typeof window === "undefined") return Promise.resolve()
  if (chartScript) return chartScript
  chartScript = new Promise<void>((resolve, reject) => {
    if (window.customElements.get(CHART_TAG)) {
      resolve()
      return
    }
    const script = document.createElement("script")
    script.type = "module"
    script.src = CHART_SCRIPT
    script.onload = () => {
      window.customElements.whenDefined(CHART_TAG).then(
        () => resolve(),
        (error) => reject(error),
      )
    }
    script.onerror = () =>
      reject(new Error(`No se pudo cargar ${CHART_SCRIPT}`))
    document.head.appendChild(script)
  })
  chartScript.catch(() => {
    chartScript = null
  })
  return chartScript
}

const instruments = [
  { symbol: "XAUUSD", tvSymbol: "OANDA:XAUUSD", name: "Oro / USD" },
  { symbol: "AUDUSD", tvSymbol: "FX_IDC:AUDUSD", name: "Dólar Aus." },
  { symbol: "NAS100", tvSymbol: "FOREXCOM:NSXUSD", name: "Nasdaq 100" },
  { symbol: "EURUSD", tvSymbol: "FX_IDC:EURUSD", name: "Euro / Dólar" },
  { symbol: "GBPUSD", tvSymbol: "FX_IDC:GBPUSD", name: "Libra / Dólar" },
]

// The web component reports what the user picks in TradingView's own toolbar:
// "interval" changes from "1" to "60", "D", etc. This is the only reliable
// bridge we found, so the app mirrors those attributes into its own state.
const intervalMap: Record<string, CandleInterval> = {
  "1": "1m",
  "5": "5m",
  "15": "15m",
  "30": "30m",
  "60": "1h",
  "1H": "1h",
  D: "1d",
  "1D": "1d",
}

const intervalLabels: Record<string, string> = {
  "1": "1m",
  "3": "3m",
  "5": "5m",
  "15": "15m",
  "30": "30m",
  "45": "45m",
  "60": "1h",
  "1H": "1h",
  "120": "2h",
  "180": "3h",
  "240": "4h",
  D: "1D",
  "1D": "1D",
  W: "1S",
  "1W": "1S",
  M: "1M",
  "1M": "1M",
}

type ChartTarget = {
  ticker: string
  label: string
}

const knownTargets: Record<string, ChartTarget> = {
  "OANDA:XAUUSD": { ticker: "GC=F", label: "XAUUSD" },
  "FX_IDC:AUDUSD": { ticker: "AUDUSD=X", label: "AUDUSD" },
  "FOREXCOM:NSXUSD": { ticker: "^NDX", label: "NAS100" },
  "FX_IDC:EURUSD": { ticker: "EURUSD=X", label: "EURUSD" },
  "FX_IDC:GBPUSD": { ticker: "GBPUSD=X", label: "GBPUSD" },
}

const forexExchanges = new Set([
  "OANDA",
  "FX_IDC",
  "FX",
  "SAXO",
  "PEPPERSTONE",
  "EASYMARKETS",
])

// Maps a TradingView symbol to something Yahoo Finance can price. Only forex
// pairs can be derived safely from the ticker; everything else needs a manual
// entry in knownTargets, otherwise the Squeeze pane reports it as unavailable.
function resolveTarget(tvSymbol: string): ChartTarget | null {
  const direct = knownTargets[tvSymbol.toUpperCase()]
  if (direct) return direct
  const [exchange, code] = tvSymbol.split(":")
  if (!exchange || !code) return null
  if (forexExchanges.has(exchange.toUpperCase()) && /^[A-Z]{6}$/.test(code))
    return { ticker: `${code}=X`, label: code }
  return null
}

const priceFormatters = new Map<number, Intl.NumberFormat>()

function formatPrice(value: number) {
  const digits = value < 10 ? 5 : 2
  let formatter = priceFormatters.get(digits)
  if (!formatter) {
    formatter = new Intl.NumberFormat("es-AR", {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    })
    priceFormatters.set(digits, formatter)
  }
  return formatter.format(value)
}

function formatPercent(value: number) {
  const formatted = new Intl.NumberFormat("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(value))
  return `${value >= 0 ? "+" : "-"}${formatted}%`
}

const chartStudies = [
  "MASimple@tv-basicstudies",
  "MAExp@tv-basicstudies",
  "RSI@tv-basicstudies",
  "MACD@tv-basicstudies",
  "BB@tv-basicstudies",
  "StochasticRSI@tv-basicstudies",
]

export default function TradingTerminal() {
  const chartRef = useRef<HTMLElement | null>(null)
  const chartHostRef = useRef<HTMLDivElement | null>(null)
  const [symbol, setSymbol] = useState("OANDA:XAUUSD")
  const [rawInterval, setRawInterval] = useState("1")
  const [timeframe, setTimeframe] = useState<CandleInterval | null>("1m")
  const [target, setTarget] = useState<ChartTarget | null>({
    ticker: "GC=F",
    label: "XAUUSD",
  })
  const [chartError, setChartError] = useState(false)
  const [chartReady, setChartReady] = useState(false)
  const [quotes, setQuotes] = useState<Record<string, WatchlistQuote>>({})
  const [quotesError, setQuotesError] = useState(false)
  const [candles, setCandles] = useState<Candle[]>([])
  const [candlesLoading, setCandlesLoading] = useState(true)
  const [candlesError, setCandlesError] = useState(false)
  const activeInstrument = instruments.find((item) => item.tvSymbol === symbol)
  const squeeze = useMemo(() => computeSqueeze(candles), [candles])
  const ticker = target?.ticker ?? null
  const intervalLabel = intervalLabels[rawInterval] ?? rawInterval
  const notice = !target
    ? `Squeeze no disponible para ${symbol.split(":").at(-1) ?? symbol}`
    : !timeframe
      ? `Temporalidad ${intervalLabel} no disponible`
      : null

  useEffect(() => {
    let cancelled = false
    let controller: AbortController | null = null
    let retry: number | null = null
    const load = async () => {
      if (retry !== null) {
        window.clearTimeout(retry)
        retry = null
      }
      controller?.abort()
      const current = new AbortController()
      controller = current
      try {
        const response = await fetch("/api/watchlist-quotes", {
          signal: current.signal,
        })
        const data = (await response.json()) as WatchlistQuotesResponse
        if (data.status !== "available") throw new Error("unavailable")
        if (cancelled) return
        setQuotes(
          Object.fromEntries(data.items.map((item) => [item.id, item])),
        )
        setQuotesError(false)
      } catch {
        if (cancelled || current.signal.aborted) return
        setQuotesError(true)
        retry = window.setTimeout(() => void load(), 15_000)
      }
    }
    void load()
    const interval = window.setInterval(() => {
      if (!document.hidden) void load()
    }, 60_000)
    return () => {
      cancelled = true
      window.clearInterval(interval)
      if (retry !== null) window.clearTimeout(retry)
      controller?.abort()
    }
  }, [])

  useEffect(() => {
    if (!ticker || !timeframe) {
      setCandles([])
      setCandlesLoading(false)
      setCandlesError(false)
      return
    }
    let cancelled = false
    let controller: AbortController | null = null
    let retry: number | null = null
    const load = async () => {
      if (retry !== null) {
        window.clearTimeout(retry)
        retry = null
      }
      controller?.abort()
      const current = new AbortController()
      controller = current
      try {
        const response = await fetch(
          `/api/candles?yahoo=${encodeURIComponent(ticker)}&interval=${timeframe}`,
          { signal: current.signal },
        )
        const data = (await response.json()) as CandlesResponse
        if (data.status !== "available") throw new Error("unavailable")
        if (cancelled) return
        setCandles(data.candles)
        setCandlesError(false)
      } catch {
        if (cancelled || current.signal.aborted) return
        setCandlesError(true)
        retry = window.setTimeout(() => void load(), 15_000)
      } finally {
        if (!cancelled && !current.signal.aborted) setCandlesLoading(false)
      }
    }
    setCandles([])
    setCandlesLoading(true)
    setCandlesError(false)
    void load()
    const poller = window.setInterval(() => {
      if (!document.hidden) void load()
    }, 60_000)
    return () => {
      cancelled = true
      window.clearInterval(poller)
      if (retry !== null) window.clearTimeout(retry)
      controller?.abort()
    }
  }, [ticker, timeframe])

  useEffect(() => {
    const host = chartHostRef.current
    if (!host) return
    let cancelled = false
    let element: HTMLElement | null = null
    let observer: MutationObserver | null = null

    const sync = (chart: HTMLElement) => {
      const raw = chart.getAttribute("interval") ?? "1"
      setRawInterval(raw)
      setTimeframe(intervalMap[raw] ?? null)
      const nextSymbol = chart.getAttribute("symbol")
      if (!nextSymbol) return
      setSymbol(nextSymbol)
      setTarget(resolveTarget(nextSymbol))
    }

    setChartError(false)
    setChartReady(false)
    loadChartScript()
      .then(() => {
        if (cancelled || !chartHostRef.current) return
        const chart = document.createElement(CHART_TAG)
        chart.setAttribute("symbol", "OANDA:XAUUSD")
        chart.setAttribute("interval", "1")
        chart.setAttribute("theme", "dark")
        chart.setAttribute("timezone", "Etc/UTC")
        chart.setAttribute("allow-symbol-change", "")
        chart.setAttribute("show-drawing-toolbar", "")
        chart.setAttribute("studies", JSON.stringify(chartStudies))
        chart.setAttribute("aria-label", "Gráfico de velas de TradingView")
        chart.style.display = "block"
        chart.style.width = "100%"
        chart.style.height = "100%"
        chart.addEventListener("tv-widget-ready", () => {
          if (!cancelled) setChartReady(true)
        })
        chart.addEventListener("tv-widget-error", () => {
          if (!cancelled) setChartError(true)
        })
        observer = new MutationObserver(() => sync(chart))
        observer.observe(chart, {
          attributes: true,
          attributeFilter: ["interval", "symbol"],
        })
        host.appendChild(chart)
        element = chart
        chartRef.current = chart
      })
      .catch(() => {
        if (!cancelled) setChartError(true)
      })

    return () => {
      cancelled = true
      observer?.disconnect()
      chartRef.current = null
      element?.remove()
    }
  }, [])

  const selectInstrument = (tvSymbol: string) => {
    const chart = chartRef.current
    if (!chart || chart.getAttribute("symbol") === tvSymbol) return
    chart.setAttribute("symbol", tvSymbol)
  }

  return (
    <section
      className="overflow-hidden rounded-xl border border-[#2a2e39] bg-[#131722] text-[13px] text-[#d1d4dc] shadow-[0_18px_40px_rgba(6,26,64,0.18)]"
      aria-label="Terminal de mercado TradingView"
    >
      <div className="flex min-h-0 flex-col lg:flex-row">
        <aside className="shrink-0 border-b border-[#2a2e39] bg-[#1e222d] lg:w-[210px] lg:border-b-0 lg:border-r">
          <div className="flex items-center justify-between gap-2 border-b border-[#2a2e39] px-2.5 py-2.5 text-[12px] font-semibold text-white">
            <span>Instrumentos</span>
            <span
              className={`flex items-center gap-1.5 text-[10px] font-normal ${
                quotesError ? "text-[#f23645]" : "text-[#848e9c]"
              }`}
            >
              <span
                aria-hidden="true"
                className={`size-1.5 rounded-full ${
                  quotesError ? "bg-[#f23645]" : "bg-[#089981]"
                }`}
              />
              {quotesError ? "Sin datos" : "En vivo"}
            </span>
          </div>
          <div
            className="flex overflow-x-auto lg:block lg:overflow-visible"
            role="group"
            aria-label="Instrumentos disponibles"
          >
            {instruments.map((item) => {
              const active = item.tvSymbol === symbol
              const quote = quotes[item.symbol]
              const positive = quote ? quote.changePercent >= 0 : true
              return (
                <button
                  key={item.symbol}
                  type="button"
                  aria-pressed={active}
                  onClick={() => selectInstrument(item.tvSymbol)}
                  className={`flex min-w-[150px] items-start justify-between gap-2 border-b border-[#262b3e] px-2.5 py-2 text-left transition-colors lg:min-w-0 lg:w-full ${
                    active
                      ? "bg-[#2a2e39] shadow-[inset_2px_0_0_#2962ff]"
                      : "hover:bg-[#2a2e39]"
                  }`}
                >
                  <span className="min-w-0">
                    <span className="block font-semibold text-white">
                      {item.symbol}
                    </span>
                    <span className="block text-[10px] text-[#848e9c]">
                      {item.name}
                    </span>
                  </span>
                  <span className="shrink-0 text-right text-[12px] tabular-nums">
                    <span className="block">
                      {quote ? formatPrice(quote.price) : "—"}
                    </span>
                    <span
                      className={`block text-[10px] ${
                        quote
                          ? positive
                            ? "text-[#089981]"
                            : "text-[#f23645]"
                          : "text-[#848e9c]"
                      }`}
                    >
                      {quote ? formatPercent(quote.changePercent) : "—"}
                    </span>
                  </span>
                </button>
              )
            })}
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="relative h-[460px] w-full min-w-0 lg:h-[calc(100svh-215px)] lg:min-h-[520px] lg:max-h-[1020px]">
            <div ref={chartHostRef} className="h-full w-full" />
            {!chartReady && !chartError && (
              <div
                className="pointer-events-none absolute inset-0 grid place-items-center bg-[#131722] text-xs text-[#848e9c]"
                role="status"
              >
                Cargando gráfico de TradingView…
              </div>
            )}
            {chartError && (
              <div
                className="absolute inset-0 grid place-items-center bg-[#131722] px-6 text-center text-xs leading-relaxed text-[#848e9c]"
                role="status"
              >
                No se pudo cargar el gráfico de TradingView. Revisá la conexión y
                volvé a intentarlo.
              </div>
            )}
          </div>

          <SqueezeMomentum
            points={squeeze.points}
            state={squeeze.state}
            loading={candlesLoading}
            error={candlesError}
            notice={notice}
          />
        </div>
      </div>

      <p className="m-0 border-t border-[#2a2e39] bg-[#1e222d] px-3 py-2 text-[10px] leading-relaxed text-[#848e9c]">
        Gráfico: TradingView; la temporalidad y el símbolo que elegís en su barra
        se aplican al panel. Squeeze Momentum: réplica del script de LazyBear (BB
        20 con 1,5σ, KC 20 con 1,5·ATR, regresión lineal de 20 velas); en la
        línea de cero, negro = comprimido, gris = disparado, azul = sin
        compresión. Velas y precios: Yahoo Finance, cada 60 segundos (XAUUSD se
        aproxima con futuros GC=F). No constituye asesoramiento de inversión.
      </p>
    </section>
  )
}
