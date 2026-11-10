"use client"

import { useEffect, useId, useRef, useState } from "react"
import type {
  WatchlistQuote,
  WatchlistQuotesResponse,
} from "@/lib/market-data"

type TradingViewCtor = new (options: Record<string, unknown>) => unknown

declare global {
  interface Window {
    TradingView?: { widget: TradingViewCtor }
  }
}

const TV_SCRIPT = "https://s3.tradingview.com/tv.js"
const TICKER_SCRIPT =
  "https://s3.tradingview.com/external-embedding/embed-widget-ticker-tape.js"

const scriptCache = new Map<string, Promise<void>>()

function loadScript(src: string) {
  if (typeof window === "undefined") return Promise.resolve()
  const cached = scriptCache.get(src)
  if (cached) return cached
  const promise = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script")
    script.src = src
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error(`No se pudo cargar ${src}`))
    document.head.appendChild(script)
  })
  scriptCache.set(src, promise)
  return promise
}

const tickerConfig = {
  symbols: [
    { proName: "OANDA:XAUUSD", title: "XAUUSD" },
    { proName: "FX_IDC:EURUSD", title: "EURUSD" },
    { proName: "FX_IDC:GBPUSD", title: "GBPUSD" },
    { proName: "FOREXCOM:SPX500USD", title: "S&P 500" },
    { proName: "FOREXCOM:NSXUSD", title: "NAS100" },
    { proName: "NASDAQ:AAPL", title: "AAPL" },
    { proName: "NASDAQ:TSLA", title: "TSLA" },
  ],
  showSymbolLogo: true,
  colorTheme: "dark",
  isTransparent: true,
  displayMode: "adaptive",
  locale: "es",
}

const instruments = [
  { symbol: "XAUUSD", tvSymbol: "OANDA:XAUUSD", name: "Oro / USD" },
  { symbol: "AUDUSD", tvSymbol: "FX_IDC:AUDUSD", name: "Dólar Aus." },
  { symbol: "NAS100", tvSymbol: "FOREXCOM:NSXUSD", name: "Nasdaq 100" },
  { symbol: "EURUSD", tvSymbol: "FX_IDC:EURUSD", name: "Euro / Dólar" },
  { symbol: "GBPUSD", tvSymbol: "FX_IDC:GBPUSD", name: "Libra / Dólar" },
]

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
  const tickerRef = useRef<HTMLDivElement | null>(null)
  const chartRef = useRef<HTMLDivElement | null>(null)
  const rawId = useId()
  const containerId = `tv-chart-${rawId.replace(/[^a-zA-Z0-9_-]/g, "")}`
  const [symbol, setSymbol] = useState("OANDA:XAUUSD")
  const [chartError, setChartError] = useState(false)
  const [chartReady, setChartReady] = useState(false)
  const [quotes, setQuotes] = useState<Record<string, WatchlistQuote>>({})
  const [quotesError, setQuotesError] = useState(false)

  useEffect(() => {
    let cancelled = false
    let controller: AbortController | null = null
    const load = async () => {
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
        if (!cancelled && !current.signal.aborted) setQuotesError(true)
      }
    }
    void load()
    const interval = window.setInterval(() => {
      if (!document.hidden) void load()
    }, 60_000)
    return () => {
      cancelled = true
      window.clearInterval(interval)
      controller?.abort()
    }
  }, [])

  useEffect(() => {
    const container = tickerRef.current
    if (!container) return
    container.innerHTML = ""
    const widget = document.createElement("div")
    widget.className = "tradingview-widget-container__widget"
    widget.style.height = "100%"
    const script = document.createElement("script")
    script.src = TICKER_SCRIPT
    script.type = "text/javascript"
    script.async = true
    script.innerHTML = JSON.stringify(tickerConfig)
    container.append(widget, script)
    return () => {
      container.innerHTML = ""
    }
  }, [])

  useEffect(() => {
    const container = chartRef.current
    if (!container) return
    let cancelled = false
    setChartError(false)
    setChartReady(false)
    container.innerHTML = ""
    loadScript(TV_SCRIPT)
      .then(() => {
        if (cancelled || !window.TradingView || !chartRef.current) return
        new window.TradingView.widget({
          autosize: true,
          symbol,
          interval: "1",
          timezone: "Etc/UTC",
          theme: "dark",
          style: "1",
          locale: "es",
          toolbar_bg: "#1e222d",
          enable_publishing: false,
          hide_side_toolbar: false,
          allow_symbol_change: true,
          details: false,
          hotlist: false,
          calendar: false,
          container_id: containerId,
          studies: chartStudies,
        })
        setChartReady(true)
      })
      .catch(() => {
        if (!cancelled) setChartError(true)
      })
    return () => {
      cancelled = true
      if (container) container.innerHTML = ""
    }
  }, [symbol, containerId])

  return (
    <section
      className="overflow-hidden rounded-xl border border-[#2a2e39] bg-[#131722] text-[13px] text-[#d1d4dc] shadow-[0_18px_40px_rgba(6,26,64,0.18)]"
      aria-label="Terminal de mercado TradingView"
    >
      <div className="min-h-[58px] overflow-hidden border-b border-[#2a2e39] bg-[#1e222d]">
        <div
          ref={tickerRef}
          className="tradingview-widget-container h-full w-full"
        />
      </div>

      <div className="flex min-h-0 flex-col lg:flex-row">
        <aside className="shrink-0 border-b border-[#2a2e39] bg-[#1e222d] lg:w-[280px] lg:border-b-0 lg:border-r">
          <div className="flex items-center justify-between gap-2 border-b border-[#2a2e39] px-3 py-3 font-semibold text-white">
            <span>Watchlist / Instrumentos</span>
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
                  onClick={() => setSymbol(item.tvSymbol)}
                  className={`flex min-w-[170px] items-start justify-between gap-3 border-b border-[#262b3e] px-3 py-2.5 text-left transition-colors lg:min-w-0 lg:w-full ${
                    active
                      ? "bg-[#2a2e39] shadow-[inset_2px_0_0_#2962ff]"
                      : "hover:bg-[#2a2e39]"
                  }`}
                >
                  <span className="min-w-0">
                    <span className="block font-semibold text-white">
                      {item.symbol}
                    </span>
                    <span className="block text-[11px] text-[#848e9c]">
                      {item.name}
                    </span>
                  </span>
                  <span className="shrink-0 text-right tabular-nums">
                    <span className="block">
                      {quote ? formatPrice(quote.price) : "—"}
                    </span>
                    <span
                      className={`block text-[11px] ${
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

        <div className="relative h-[430px] w-full min-w-0 lg:h-[560px] lg:flex-1">
          <div
            id={containerId}
            ref={chartRef}
            className="h-full w-full"
            aria-label={`Gráfico de velas de ${symbol}`}
          />
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
      </div>

      <p className="m-0 border-t border-[#2a2e39] bg-[#1e222d] px-3 py-2 text-[10px] leading-relaxed text-[#848e9c]">
        Gráfico y cinta: TradingView. Precios de la watchlist: Yahoo Finance,
        actualizados cada 60 segundos (XAUUSD se aproxima con futuros GC=F). No
        constituye asesoramiento de inversión.
      </p>
    </section>
  )
}
