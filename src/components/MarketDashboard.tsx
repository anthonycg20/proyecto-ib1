"use client"
// Local-time formatters are only used after client-side fetches resolve.

// Keeps the last good copy of a section when a refresh fails.

// Padded domain with five evenly spaced ticks, so both axes share grid lines.
/* On desktop the page header is hidden, so the data status lives here. */
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"
import Link from "next/link"
import { Button, Heading, Icon } from "./ui"
import NewsThumbnail from "./NewsThumbnail"
import EconomicCalendar from "./EconomicCalendar"
import type {
  HeatmapAsset,
  HeatmapSection,
  IndicatorsSection,
  MarketComparisonResponse,
  MarketIndicator,
  MarketOverviewResponse,
} from "@/lib/market-data"
import type { HeadlineSentiment, MarketNewsResponse } from "@/lib/sentiment-nlp"

const panel =
  "min-w-0 overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--surface)]"
const positive = "text-[var(--sentiment-greed)]"
const negative = "text-[var(--sentiment-critical)]"
const decimal = (digits: number) =>
  new Intl.NumberFormat("es", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
const noDecimals = decimal(0)
const oneDecimal = decimal(1)
const twoDecimals = decimal(2)
const threeDecimals = decimal(3)
const fourDecimals = decimal(4)
const percentFormat = new Intl.NumberFormat("es", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
  signDisplay: "always",
})
const basisPointFormat = new Intl.NumberFormat("es", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
  signDisplay: "always",
})
const monthFormat = new Intl.DateTimeFormat("es", {
  month: "short",
  year: "2-digit",
  timeZone: "UTC",
})
const dayMonthFormat = new Intl.DateTimeFormat("es", {
  day: "2-digit",
  month: "short",
  timeZone: "UTC",
})
const dateFormat = new Intl.DateTimeFormat("es", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
})
const newsDateFormat = new Intl.DateTimeFormat("es", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
})
const timeFormat = new Intl.DateTimeFormat("es", {
  hour: "2-digit",
  minute: "2-digit",
})

const utcDate = (date: string) => new Date(`${date}T00:00:00Z`)

function formatIndicatorValue(item: MarketIndicator) {
  switch (item.format) {
    case "yield":
      return `${twoDecimals.format(item.price)}%`
    case "usd":
      return `$${twoDecimals.format(item.price)}`
    case "usd0":
      return `$${noDecimals.format(item.price)}`
    case "fx":
      return threeDecimals.format(item.price)
    default:
      return twoDecimals.format(item.price)
  }
}

const formatIndicatorChange = (item: MarketIndicator) =>
  item.changeUnit === "pb"
    ? `${basisPointFormat.format(item.change)} pb`
    : `${percentFormat.format(item.change)}%`

const formatAssetPrice = (price: number) =>
  `$${(price >= 1 ? twoDecimals : fourDecimals).format(price)}`

function PanelTitle({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <span className="h-3.5 w-0.5 shrink-0 rounded-full bg-[var(--bright)]" />
      <Heading
        level={2}
        className="font-sans! text-sm! font-semibold! tracking-tight!"
      >
        {children}
      </Heading>
    </div>
  )
}
function keepAvailable<T extends { status: string }>(
  next: T,
  previous: T | undefined,
): T {
  return next.status === "unavailable" && previous?.status === "available"
    ? previous
    : next
}

function useMarketOverview() {
  const [data, setData] = useState<MarketOverviewResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const request = useRef<AbortController | null>(null)
  const refresh = useCallback(async () => {
    request.current?.abort()
    const controller = new AbortController()
    request.current = controller
    setLoading(true)
    try {
      const response = await fetch("/api/market-overview", {
        signal: controller.signal,
      })
      const result = (await response.json()) as MarketOverviewResponse
      if (!result?.checkedAt || !result.indicators || !result.equities)
        throw new Error("Invalid response")
      if (controller.signal.aborted) return
      setData((previous) => ({
        checkedAt: result.checkedAt,
        indicators: keepAvailable(result.indicators, previous?.indicators),
        equities: keepAvailable(result.equities, previous?.equities),
        crypto: keepAvailable(result.crypto, previous?.crypto),
      }))
      setError(
        [result.indicators, result.equities, result.crypto].some(
          (section) => section.status === "unavailable",
        ),
      )
    } catch {
      if (!controller.signal.aborted) setError(true)
    } finally {
      if (!controller.signal.aborted) setLoading(false)
    }
  }, [])
  useEffect(() => {
    void refresh()
    const interval = window.setInterval(() => {
      if (!document.hidden) void refresh()
    }, 60_000)
    return () => {
      window.clearInterval(interval)
      request.current?.abort()
    }
  }, [refresh])
  return { data, loading, error }
}

type TickerStatus = {
  tone: string
  text: string
}

function MarketTicker({
  section,
  checkedAt,
  loading,
  status,
}: {
  section: IndicatorsSection | undefined
  checkedAt: string | undefined
  loading: boolean
  status: TickerStatus
}) {
  const items = section?.status === "available" ? section.items : []
  const indicatorCards = items.map((item) => {
    const risk = item.risingIsRisk ? item.change > 0 : item.change < 0
    return (
      <article
        key={item.id}
        title={`${item.symbol} · último dato ${newsDateFormat.format(new Date(item.marketTime))}`}
        className="w-30 shrink-0 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2.5"
      >
        <span className="block whitespace-nowrap text-xs font-medium tracking-wide text-[var(--muted)]">
          {item.label}
        </span>
        <strong className="mt-1 block whitespace-nowrap text-sm font-semibold tabular-nums tracking-tight">
          {formatIndicatorValue(item)}
        </strong>
        <span
          className={`mt-1 flex items-center gap-1 whitespace-nowrap text-xs tabular-nums ${
            item.change === 0
              ? "text-[var(--muted)]"
              : risk
                ? negative
                : positive
          }`}
        >
          <svg width="7" height="7" viewBox="0 0 8 8" aria-hidden="true">
            <path
              d={item.change < 0 ? "M0 1h8L4 7Z" : "M0 7h8L4 1Z"}
              fill="currentColor"
            />
          </svg>
          {formatIndicatorChange(item)}
        </span>
      </article>
    )
  })

  return (
    <section aria-label="Indicadores globales" className="mb-4 min-w-0">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-1 text-xs text-[var(--muted)]">
        <span className="font-medium">Mercados globales</span>
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {}
          <span
            className="hidden items-center gap-1.5 min-[861px]:flex"
            role="status"
          >
            <span
              className={`h-1.5 w-1.5 shrink-0 rounded-full ${status.tone}`}
            />
            {status.text}
          </span>
          <span>
            {items.length && checkedAt
              ? `Yahoo Finance · consulta ${timeFormat.format(new Date(checkedAt))} · puede tener demora`
              : loading
                ? "Consultando Yahoo Finance"
                : "Yahoo Finance no disponible"}
          </span>
        </span>
      </div>
      {items.length ? (
        <div
          className="market-ticker-viewport rounded-lg focus-visible:outline-2 focus-visible:outline-[var(--bright)]"
          tabIndex={0}
          role="region"
          aria-label="Indicadores globales en movimiento continuo"
        >
          <div className="market-ticker-track">
            <div className="market-ticker-group">{indicatorCards}</div>
            <div className="market-ticker-group" aria-hidden="true">
              {indicatorCards}
            </div>
          </div>
        </div>
      ) : loading ? (
        <div className="flex gap-2 overflow-hidden" role="status">
          <span className="sr-only">Cargando cotizaciones</span>
          {[0, 1, 2, 3, 4, 5, 6].map((item) => (
            <div
              key={item}
              className="h-19 w-30 shrink-0 rounded-lg border border-[var(--line)] bg-[var(--surface)] p-3 motion-safe:animate-pulse"
            >
              <div className="h-2 w-2/3 rounded bg-[var(--line)]" />
              <div className="mt-2.5 h-3 w-4/5 rounded bg-[var(--line)]" />
              <div className="mt-2.5 h-2 w-1/2 rounded bg-[var(--line)]" />
            </div>
          ))}
        </div>
      ) : (
        <p
          className="m-0 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-4 text-xs text-[var(--muted)]"
          role="status"
        >
          No se pudieron obtener cotizaciones. No mostramos valores inventados;
          reintentaremos en un minuto.
        </p>
      )}
    </section>
  )
}

type Tile = HeatmapAsset & {
  x: number
  y: number
  width: number
  height: number
}

function treemap(
  assets: HeatmapAsset[],
  x = 0,
  y = 0,
  width = 520,
  height = 270,
): Tile[] {
  if (assets.length === 1) return [{ ...assets[0], x, y, width, height }]
  const total = assets.reduce((sum, asset) => sum + asset.weight, 0)
  let split = 1
  let weight = assets[0].weight
  while (
    split < assets.length - 1 &&
    weight + assets[split].weight / 2 < total / 2
  ) {
    weight += assets[split].weight
    split++
  }
  const ratio = weight / total
  return width >= height
    ? [
        ...treemap(assets.slice(0, split), x, y, width * ratio, height),
        ...treemap(
          assets.slice(split),
          x + width * ratio,
          y,
          width * (1 - ratio),
          height,
        ),
      ]
    : [
        ...treemap(assets.slice(0, split), x, y, width, height * ratio),
        ...treemap(
          assets.slice(split),
          x,
          y + height * ratio,
          width,
          height * (1 - ratio),
        ),
      ]
}

function heatColor(change: number) {
  const token =
    change >= 0 ? "var(--sentiment-greed)" : "var(--sentiment-critical)"
  return `color-mix(in srgb, ${token} ${Math.min(96, 66 + Math.abs(change) * 12)}%, var(--navy-deep))`
}

function Heatmap({
  title,
  badge,
  subtitle,
  section,
  loading,
}: {
  title: string
  badge: string
  subtitle: string
  section: HeatmapSection | undefined
  loading: boolean
}) {
  const assets = useMemo(
    () => (section?.status === "available" ? section.assets : []),
    [section],
  )
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null)
  const tiles = useMemo(() => (assets.length ? treemap(assets) : []), [assets])
  const selected =
    assets.find((asset) => asset.symbol === selectedSymbol) ?? assets[0]
  const available = section?.status === "available" ? section : null

  return (
    <section className={panel}>
      <div className="flex items-center justify-between gap-2 px-3.5 py-3">
        <PanelTitle>{title}</PanelTitle>
        <span className="shrink-0 rounded-sm bg-[var(--background)] px-1.5 py-0.5 text-xs font-medium text-[var(--muted)]">
          {badge}
        </span>
      </div>
      <div className="px-2.5">
        {tiles.length ? (
          <svg
            viewBox="0 0 520 270"
            className="block w-full overflow-visible"
            role="group"
            aria-label={`${title}: variaciones diarias. Seleccioná un activo para ver su detalle.`}
          >
            {tiles.map((tile) => {
              const large = tile.width > 130 && tile.height > 85
              const medium = tile.width > 68 && tile.height > 50
              const tiny = tile.width < 34 || tile.height < 22
              const centerX = tile.x + tile.width / 2
              const centerY = tile.y + tile.height / 2
              const choose = () => setSelectedSymbol(tile.symbol)
              return (
                <g
                  key={tile.symbol}
                  role="button"
                  tabIndex={0}
                  aria-label={`${tile.name}, ${percentFormat.format(tile.change)} por ciento.`}
                  aria-pressed={selected?.symbol === tile.symbol}
                  onMouseEnter={choose}
                  onFocus={choose}
                  onClick={choose}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault()
                      choose()
                    }
                  }}
                  className="group cursor-pointer outline-none"
                >
                  <rect
                    x={tile.x + 1}
                    y={tile.y + 1}
                    width={Math.max(0, tile.width - 2)}
                    height={Math.max(0, tile.height - 2)}
                    rx="2"
                    fill={heatColor(tile.change)}
                    className="stroke-[var(--surface)] stroke-1 group-focus-visible:stroke-[var(--navy)] group-focus-visible:stroke-4"
                  />
                  {!tiny && (
                    <text
                      x={centerX}
                      y={centerY - (medium ? 4 : -3)}
                      textAnchor="middle"
                      className={`pointer-events-none fill-[var(--surface)] font-medium ${
                        large ? "text-2xl" : medium ? "text-base" : "text-xs"
                      }`}
                    >
                      {tile.symbol}
                    </text>
                  )}
                  {medium && (
                    <text
                      x={centerX}
                      y={centerY + (large ? 19 : 14)}
                      textAnchor="middle"
                      className={`pointer-events-none fill-[var(--surface)] ${
                        large ? "text-base" : "text-xs"
                      }`}
                    >
                      {percentFormat.format(tile.change)}%
                    </text>
                  )}
                </g>
              )
            })}
          </svg>
        ) : (
          <div
            className={`grid aspect-[52/27] place-items-center rounded-sm bg-[var(--background)] p-4 text-center ${
              loading ? "motion-safe:animate-pulse" : ""
            }`}
            role="status"
          >
            <p className="m-0 max-w-56 text-xs leading-relaxed text-[var(--muted)]">
              {loading
                ? "Cargando mapa de calor"
                : "Fuente no disponible. No mostramos datos inventados; reintentaremos en un minuto."}
            </p>
          </div>
        )}
      </div>
      <div className="flex min-h-10 items-center justify-between gap-2 px-3.5 py-2 text-xs">
        {selected ? (
          <>
            <span className="min-w-0 truncate text-[var(--muted)]">
              {selected.symbol}{" "}
              <span className="text-[var(--ink)]">· {selected.name}</span>
              {selected.detail && <> · {selected.detail}</>}
            </span>
            <span className="flex shrink-0 items-center gap-2 tabular-nums">
              {selected.price !== null && (
                <span className="text-[var(--muted)]">
                  {formatAssetPrice(selected.price)}
                </span>
              )}
              <span
                className={`font-semibold ${
                  selected.change >= 0 ? positive : negative
                }`}
              >
                {percentFormat.format(selected.change)}%
              </span>
            </span>
          </>
        ) : (
          <span className="text-[var(--muted)]">Sin datos para mostrar</span>
        )}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--line)] px-3.5 py-2 text-xs text-[var(--muted)]">
        <span>
          {subtitle}
          {available &&
            ` · ${available.source} · ${
              available.sizing === "marketCap"
                ? "tamaño por capitalización"
                : "tamaño uniforme"
            }`}
        </span>
        <span
          className="flex items-center gap-1.5"
          aria-label="Rojo: caída; verde: suba"
        >
          <span className="h-1.5 w-1.5 rounded-sm bg-[var(--sentiment-critical)]" />
          Baja
          <span className="ml-1 h-1.5 w-1.5 rounded-sm bg-[var(--sentiment-greed)]" />
          Suba
        </span>
      </div>
    </section>
  )
}

const periods = [
  { label: "1M", months: 1 },
  { label: "3M", months: 3 },
  { label: "6M", months: 6 },
  { label: "1A", months: 12 },
  { label: "3A", months: 36 },
] as const
type PeriodLabel = typeof periods[number]["label"]
type ComparisonData = Extract<MarketComparisonResponse, { status: "available" }>
function axis(values: number[]) {
  const min = Math.min(...values)
  const max = Math.max(...values)
  const pad = Math.max((max - min) * 0.08, Math.abs(max) * 0.005, 0.5)
  const low = min - pad
  const high = max + pad
  const format = high - low >= 20 ? noDecimals : oneDecimal
  return {
    low,
    high,
    ticks: [0, 1, 2, 3, 4].map((tick) =>
      format.format(high - ((high - low) * tick) / 4),
    ),
  }
}

function ComparisonChart({ openGPR }: { openGPR: () => void }) {
  const [period, setPeriod] = useState<PeriodLabel>("1A")
  const [hovered, setHovered] = useState<number | null>(null)
  const [visible, setVisible] = useState({ gpr: true, market: true })
  const [data, setData] = useState<ComparisonData | null>(null)
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading")
  const load = useCallback(async (signal?: AbortSignal) => {
    setStatus("loading")
    try {
      const response = await fetch("/api/market-comparison", { signal })
      const result = (await response.json()) as MarketComparisonResponse
      if (
        !response.ok ||
        result.status !== "available" ||
        result.points.length < 2
      )
        throw new Error("Comparison unavailable")
      if (!signal?.aborted) {
        setData(result)
        setStatus("ready")
      }
    } catch {
      if (!signal?.aborted) setStatus("error")
    }
  }, [])
  useEffect(() => {
    const controller = new AbortController()
    void load(controller.signal)
    return () => controller.abort()
  }, [load])

  const months = periods.find((item) => item.label === period)!.months
  const points = useMemo(() => {
    const last = data?.points.at(-1)
    if (!data || !last) return []
    const start = utcDate(last.date)
    start.setUTCMonth(start.getUTCMonth() - months)
    const startKey = start.toISOString().slice(0, 10)
    const selected = data.points.filter((point) => point.date >= startKey)
    const base = selected[0]?.market || 1
    return selected.map((point) => ({
      ...point,
      indexed: (point.market / base) * 100,
    }))
  }, [data, months])

  const ready = status === "ready" && points.length >= 2
  const current = ready ? points[hovered ?? points.length - 1] : null
  const gprAxis = useMemo(
    () => (points.length ? axis(points.map((point) => point.gpr)) : null),
    [points],
  )
  const marketAxis = useMemo(
    () => (points.length ? axis(points.map((point) => point.indexed)) : null),
    [points],
  )
  const x = (index: number) => 48 + (index / (points.length - 1)) * 654
  const scale = (value: number, range: ReturnType<typeof axis>) =>
    250 - ((value - range.low) / (range.high - range.low)) * 220
  const yGPR = (value: number) => (gprAxis ? scale(value, gprAxis) : 250)
  const yMarket = (value: number) =>
    marketAxis ? scale(value, marketAxis) : 250
  const path = (key: "gpr" | "market") =>
    points
      .map(
        (point, index) =>
          `${index ? "L" : "M"}${x(index).toFixed(1)},${(key === "gpr"
            ? yGPR(point.gpr)
            : yMarket(point.indexed)
          ).toFixed(1)}`,
      )
      .join(" ")
  const tickIndices = [
    ...new Set([
      0,
      Math.round((points.length - 1) / 3),
      Math.round(((points.length - 1) * 2) / 3),
      points.length - 1,
    ]),
  ]
  const tickLabel = (date: string) =>
    months <= 3
      ? dayMonthFormat.format(utcDate(date))
      : monthFormat.format(utcDate(date))

  return (
    <section className={panel}>
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 pt-4">
        <div>
          <PanelTitle>GPR Index vs. desempeño del mercado</PanelTitle>
          <p className="mb-0 mt-1.5 text-xs text-[var(--muted)]">
            Riesgo geopolítico diario y S&amp;P 500 · datos reales
          </p>
        </div>
        <div
          className="flex gap-0.5 rounded-md bg-[var(--background)] p-1"
          role="group"
          aria-label="Período del gráfico"
        >
          {periods.map((item) => (
            <Button
              key={item.label}
              variant="ghost"
              aria-pressed={period === item.label}
              className={`min-h-8! rounded-sm! px-2! text-xs! hover:translate-y-0! ${
                period === item.label
                  ? "bg-[var(--surface)]! text-[var(--primary)]! shadow-sm!"
                  : "text-[var(--muted)]!"
              }`}
              onClick={() => {
                setPeriod(item.label)
                setHovered(null)
              }}
            >
              {item.label}
            </Button>
          ))}
        </div>
      </div>
      {current && gprAxis && marketAxis ? (
        <>
          <div className="mx-4 mt-4 flex flex-wrap items-center justify-between gap-2 border-y border-[var(--line)] py-2">
            <div className="flex flex-wrap gap-x-3 gap-y-1">
              {([
                {
                  id: "gpr",
                  label: "GPR Index",
                  value: noDecimals.format(current.gpr),
                  note: "media 7 d",
                  color: "bg-[var(--sentiment-critical)]",
                },
                {
                  id: "market",
                  label: "S&P 500",
                  value: twoDecimals.format(current.market),
                  note: `${percentFormat.format(current.indexed - 100)}%`,
                  color: "bg-[var(--sentiment-greed)]",
                },
              ] as const).map((series) => (
                <Button
                  key={series.id}
                  variant="ghost"
                  aria-pressed={visible[series.id]}
                  aria-label={`${
                    visible[series.id] ? "Ocultar" : "Mostrar"
                  } ${series.label}`}
                  onClick={() =>
                    setVisible((previous) => ({
                      ...previous,
                      [series.id]: !previous[series.id],
                    }))
                  }
                  className={`min-h-7! gap-1.5! rounded-sm! p-0! text-xs! text-[var(--muted)]! hover:translate-y-0! ${
                    visible[series.id] ? "" : "opacity-40"
                  }`}
                >
                  <span className={`h-0.5 w-4 rounded-full ${series.color}`} />
                  {series.label}
                  <strong className="ml-1 font-semibold tabular-nums text-[var(--ink)]">
                    {series.value}
                  </strong>
                  <span className="tabular-nums">{series.note}</span>
                </Button>
              ))}
            </div>
            <time
              dateTime={current.date}
              className="text-xs tabular-nums text-[var(--muted)]"
            >
              {dateFormat.format(utcDate(current.date))}
            </time>
          </div>
          <div
            className="overflow-x-auto px-2 pt-3 sm:px-3"
            tabIndex={0}
            role="region"
            aria-label="Gráfico comparativo. Desplazá horizontalmente en pantallas pequeñas."
          >
            <svg
              viewBox="0 0 750 286"
              className="block w-full min-w-144 rounded-sm focus-visible:outline-2 focus-visible:outline-[var(--bright)] sm:min-w-0"
              role="img"
              tabIndex={0}
              aria-label={`Comparación de ${period}: ${dateFormat.format(utcDate(points[0].date))} al ${dateFormat.format(utcDate(points.at(-1)!.date))}. Flechas izquierda y derecha para explorar. GPR ${noDecimals.format(current.gpr)}; S&P 500 ${twoDecimals.format(current.market)}, ${percentFormat.format(current.indexed - 100)} por ciento desde el inicio del período.`}
              onPointerMove={(event) => {
                const bounds = event.currentTarget.getBoundingClientRect()
                const relativeX =
                  ((event.clientX - bounds.left) / bounds.width) * 750
                setHovered(
                  Math.max(
                    0,
                    Math.min(
                      points.length - 1,
                      Math.round(
                        ((relativeX - 48) / 654) * (points.length - 1),
                      ),
                    ),
                  ),
                )
              }}
              onPointerLeave={() => setHovered(null)}
              onBlur={() => setHovered(null)}
              onKeyDown={(event) => {
                if (
                  !["ArrowLeft", "ArrowRight", "Home", "End"].includes(
                    event.key,
                  )
                )
                  return
                event.preventDefault()
                setHovered((previous) => {
                  if (event.key === "Home") return 0
                  if (event.key === "End") return points.length - 1
                  return Math.max(
                    0,
                    Math.min(
                      points.length - 1,
                      (previous ?? points.length - 1) +
                        (event.key === "ArrowLeft" ? -1 : 1),
                    ),
                  )
                })
              }}
            >
              <defs>
                <linearGradient
                  id="home-market-area"
                  x1="0"
                  x2="0"
                  y1="0"
                  y2="1"
                >
                  <stop
                    offset="0%"
                    stopColor="var(--sentiment-greed)"
                    stopOpacity="0.12"
                  />
                  <stop
                    offset="100%"
                    stopColor="var(--sentiment-greed)"
                    stopOpacity="0"
                  />
                </linearGradient>
              </defs>
              <text x="48" y="13" className="fill-[var(--muted)] text-xs">
                GPR · puntos
              </text>
              <text
                x="702"
                y="13"
                textAnchor="end"
                className="fill-[var(--muted)] text-xs"
              >
                S&amp;P 500 · base 100
              </text>
              {[0, 1, 2, 3, 4].map((tick) => (
                <g key={tick}>
                  <line
                    x1="48"
                    x2="702"
                    y1={30 + tick * 55}
                    y2={30 + tick * 55}
                    stroke="var(--line)"
                    strokeDasharray={tick === 4 ? undefined : "3 4"}
                  />
                  <text
                    x="37"
                    y={34 + tick * 55}
                    textAnchor="end"
                    className="fill-[var(--muted)] text-xs"
                  >
                    {gprAxis.ticks[tick]}
                  </text>
                  <text
                    x="714"
                    y={34 + tick * 55}
                    className="fill-[var(--muted)] text-xs"
                  >
                    {marketAxis.ticks[tick]}
                  </text>
                </g>
              ))}
              {visible.market && (
                <path
                  d={`${path("market")} L702,250 L48,250 Z`}
                  fill="url(#home-market-area)"
                />
              )}
              {visible.market && (
                <path
                  d={path("market")}
                  fill="none"
                  stroke="var(--sentiment-greed)"
                  strokeWidth="2.25"
                  strokeLinejoin="round"
                />
              )}
              {visible.gpr && (
                <path
                  d={path("gpr")}
                  fill="none"
                  stroke="var(--sentiment-critical)"
                  strokeWidth="2"
                  strokeLinejoin="round"
                />
              )}
              {hovered !== null && (
                <g>
                  <line
                    x1={x(hovered)}
                    x2={x(hovered)}
                    y1="30"
                    y2="250"
                    stroke="var(--muted)"
                    strokeDasharray="3 3"
                    opacity="0.5"
                  />
                  {visible.gpr && (
                    <circle
                      cx={x(hovered)}
                      cy={yGPR(current.gpr)}
                      r="4"
                      fill="var(--sentiment-critical)"
                      stroke="var(--surface)"
                      strokeWidth="2"
                    />
                  )}
                  {visible.market && (
                    <circle
                      cx={x(hovered)}
                      cy={yMarket(current.indexed)}
                      r="4"
                      fill="var(--sentiment-greed)"
                      stroke="var(--surface)"
                      strokeWidth="2"
                    />
                  )}
                </g>
              )}
              {tickIndices.map((index) => (
                <text
                  key={index}
                  x={x(index)}
                  y="273"
                  textAnchor={
                    index === 0
                      ? "start"
                      : index === points.length - 1
                        ? "end"
                        : "middle"
                  }
                  className="fill-[var(--muted)] text-xs"
                >
                  {tickLabel(points[index].date)}
                </text>
              ))}
            </svg>
          </div>
        </>
      ) : (
        <div
          className={`mx-4 mb-1 mt-4 grid min-h-72 place-items-center rounded-md bg-[var(--background)] p-6 text-center ${
            status === "loading" ? "motion-safe:animate-pulse" : ""
          }`}
          role="status"
        >
          {status === "loading" ? (
            <p className="m-0 text-xs text-[var(--muted)]">
              Cargando GPR diario y cierres del S&amp;P 500
            </p>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <p className="m-0 max-w-64 text-xs leading-relaxed text-[var(--muted)]">
                No se pudieron obtener las series. No mostramos datos
                inventados.
              </p>
              <Button
                variant="secondary"
                className="min-h-8! text-xs!"
                onClick={() => void load()}
              >
                Reintentar
              </Button>
            </div>
          )}
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--line)] px-4 py-2.5">
        <span className="max-w-lg text-xs leading-relaxed text-[var(--muted)]">
          GPR diario de Caldara &amp; Iacoviello (media móvil de 7 días) ·
          S&amp;P 500: cierres de Yahoo Finance, base 100 al inicio del período
          {data && ` · GPR al ${dateFormat.format(utcDate(data.gprUpdatedAt))}`}
          . Escalas independientes; no implica causalidad.
        </span>
        <Button
          variant="ghost"
          className="min-h-7! gap-1! p-0! text-xs!"
          onClick={openGPR}
        >
          Explorar GPR Index <Icon name="arrow" size={13} />
        </Button>
      </div>
    </section>
  )
}

const sentimentLabels = {
  positive: "Positivo",
  negative: "Negativo",
  neutral: "Neutral",
}

function NewsFeed({ openSentiment }: { openSentiment: () => void }) {
  const [news, setNews] = useState<MarketNewsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [filter, setFilter] = useState<"all" | HeadlineSentiment>("all")
  const request = useRef<AbortController | null>(null)
  const refresh = useCallback(async () => {
    request.current?.abort()
    const controller = new AbortController()
    request.current = controller
    setLoading(true)
    setError(false)
    try {
      const response = await fetch("/api/market-sentiment", {
        signal: controller.signal,
      })
      if (!response.ok) throw new Error("News unavailable")
      const result: MarketNewsResponse = await response.json()
      if (!Array.isArray(result.articles) || !result.checkedAt)
        throw new Error("Invalid response")
      if (!controller.signal.aborted) {
        setNews((previous) =>
          result.status === "unavailable" && previous?.articles.length
            ? previous
            : result,
        )
        setError(result.status === "unavailable")
      }
    } catch {
      if (!controller.signal.aborted) setError(true)
    } finally {
      if (!controller.signal.aborted) setLoading(false)
    }
  }, [])
  useEffect(() => {
    void refresh()
    const interval = window.setInterval(() => {
      if (!document.hidden) void refresh()
    }, 60_000)
    return () => {
      window.clearInterval(interval)
      request.current?.abort()
    }
  }, [refresh])
  const articles = (news?.articles ?? []).filter(
    (article) => filter === "all" || article.sentiment === filter,
  )
  const available = Boolean(news?.articles.length)

  return (
    <aside
      className={`${panel} flex h-full flex-col min-[1180px]:col-start-2 min-[1180px]:row-start-1 min-[1180px]:row-span-2`}
      aria-label="Noticias de fuentes públicas"
    >
      <div className="flex items-center justify-between gap-2 px-4 pt-4">
        <PanelTitle>Radar de noticias</PanelTitle>
        <Button
          variant="ghost"
          aria-label="Actualizar noticias"
          disabled={loading}
          onClick={() => void refresh()}
          className="min-h-8! min-w-8! rounded-md! border border-[var(--line)] p-0! disabled:cursor-wait disabled:opacity-50"
        >
          <span
            className={loading ? "animate-spin motion-reduce:animate-none" : ""}
          >
            <Icon name="history" size={15} />
          </span>
        </Button>
      </div>
      <div
        className="flex items-center gap-1.5 px-4 pb-3 pt-1.5 text-xs text-[var(--muted)]"
        role="status"
      >
        <span
          className={`h-1.5 w-1.5 shrink-0 rounded-full ${
            error
              ? "bg-[var(--orange)]"
              : available
                ? "bg-[var(--sentiment-greed)]"
                : "bg-[var(--muted)]"
          }`}
        />
        {loading
          ? "Consultando fuentes públicas"
          : error
            ? available
              ? "Última consulta disponible"
              : "Fuentes no disponibles"
            : "Fuentes públicas · actualización cada 60 s"}
      </div>
      <div
        className="flex gap-1 border-y border-[var(--line)] px-3 py-2"
        role="group"
        aria-label="Filtrar titulares por sentimiento NLP"
      >
        {(["all", "positive", "negative"] as const).map((state) => (
          <Button
            key={state}
            variant="ghost"
            aria-pressed={filter === state}
            onClick={() => setFilter(state)}
            className={`min-h-8! rounded-md! px-2.5! text-xs! hover:translate-y-0! ${
              filter === state
                ? "bg-[var(--blue-soft)]! text-[var(--primary)]!"
                : "text-[var(--muted)]!"
            }`}
          >
            {state === "all"
              ? "Todas"
              : state === "positive"
                ? "Positivas"
                : "Negativas"}
          </Button>
        ))}
      </div>
      {error && (
        <p
          className="mx-4 mb-0 mt-3 rounded-md bg-[var(--orange-soft)] p-2.5 text-xs leading-relaxed text-[var(--muted)]"
          role="status"
        >
          {available
            ? "No se pudo actualizar. Se conservan los titulares y fechas de la última consulta correcta."
            : "No se pudieron consultar las fuentes. No mostramos titulares inventados; podés volver a intentar."}
        </p>
      )}
      <div
        className="max-h-144 flex-1 overflow-y-auto px-4 min-[1180px]:max-h-136"
        aria-busy={loading}
      >
        {loading && !news ? (
          <div className="divide-y divide-[var(--line)]" role="status">
            <span className="sr-only">Cargando noticias</span>
            {[0, 1, 2, 3, 4].map((item) => (
              <div
                key={item}
                className="space-y-2 py-5 motion-safe:animate-pulse"
              >
                <div className="h-2 w-1/3 rounded bg-[var(--line)]" />
                <div className="h-2.5 w-full rounded bg-[var(--line)]" />
                <div className="h-2.5 w-3/4 rounded bg-[var(--line)]" />
              </div>
            ))}
          </div>
        ) : articles.length ? (
          articles.map((article) => (
            <article
              key={article.id}
              className="border-b border-[var(--line)] py-4 last:border-b-0"
            >
              <div className="mb-2 flex items-center gap-2">
                <span
                  className="grid h-5 w-5 shrink-0 place-items-center rounded-md bg-[var(--blue-soft)] text-xs font-bold text-[var(--primary)]"
                  aria-hidden="true"
                >
                  {article.source[0]}
                </span>
                <span className="min-w-0 truncate text-xs font-semibold">
                  {article.source}
                </span>
              </div>
              <div className="flex items-start gap-2.5">
                <NewsThumbnail article={article} />
                <div className="min-w-0 flex-1">
                  <Link
                    href={article.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block text-sm font-medium leading-5 text-[var(--ink)] no-underline underline-offset-4 hover:text-[var(--primary)] hover:underline focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-[var(--bright)]"
                  >
                    {article.title}
                    <span className="sr-only">
                      {" "}
                      (abre la fuente en otra pestaña)
                    </span>
                  </Link>
                  <div className="mt-1.5 flex flex-wrap items-center justify-between gap-1">
                    <time
                      dateTime={article.publishedAt ?? undefined}
                      className="text-xs tabular-nums text-[var(--muted)]"
                    >
                      {article.publishedAt
                        ? newsDateFormat.format(new Date(article.publishedAt))
                        : "Sin fecha disponible"}
                    </time>
                    <span
                      title="Sentimiento inferido por análisis NLP, no nivel de impacto"
                      className={`flex items-center gap-1 text-xs ${
                        article.sentiment === "positive"
                          ? positive
                          : article.sentiment === "negative"
                            ? negative
                            : "text-[var(--muted)]"
                      }`}
                    >
                      <span
                        className={`h-1 w-1 rounded-full ${
                          article.sentiment === "positive"
                            ? "bg-[var(--sentiment-greed)]"
                            : article.sentiment === "negative"
                              ? "bg-[var(--sentiment-critical)]"
                              : "bg-[var(--muted)]"
                        }`}
                      />
                      {sentimentLabels[article.sentiment]}
                    </span>
                  </div>
                </div>
              </div>
            </article>
          ))
        ) : (
          <div className="flex min-h-60 flex-col items-center justify-center gap-3 py-10 text-center text-[var(--muted)]">
            <Icon name={available ? "search" : "report"} size={28} />
            <p className="m-0 max-w-56 text-xs leading-relaxed">
              {available
                ? "No hay titulares con este sentimiento. Probá con Todas."
                : "Las noticias aparecerán aquí cuando las fuentes estén disponibles."}
            </p>
            {error && (
              <Button
                variant="secondary"
                onClick={() => void refresh()}
                disabled={loading}
                className="min-h-8! text-xs!"
              >
                Reintentar
              </Button>
            )}
          </div>
        )}
      </div>
      <div className="mt-auto border-t border-[var(--line)] px-4 py-3">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--muted)]">
          <span>Sentimiento inferido por NLP</span>
          {news && (
            <time dateTime={news.checkedAt}>
              Consulta: {newsDateFormat.format(new Date(news.checkedAt))}
            </time>
          )}
        </div>
        <Button
          variant="ghost"
          className="min-h-8! w-full justify-between! rounded-md! bg-[var(--background)]! px-2.5! text-xs!"
          onClick={openSentiment}
        >
          Ver Sentiment Analysis <Icon name="arrow" size={14} />
        </Button>
      </div>
    </aside>
  )
}

export default function MarketDashboard({
  navigate,
}: {
  navigate: (section: "datos" | "diagnostico") => void
}) {
  const { data, loading, error } = useMarketOverview()
  const status = {
    tone: !data
      ? loading
        ? "bg-[var(--muted)]"
        : "bg-[var(--orange)]"
      : error
        ? "bg-[var(--orange)]"
        : "bg-[var(--sentiment-greed)]",
    text: !data
      ? loading
        ? "Conectando con fuentes de mercado"
        : "Fuentes de mercado no disponibles"
      : error
        ? "Algunas fuentes no respondieron"
        : "Datos de mercado · actualización cada 60 s",
  }
  return (
    <div className="min-w-0 text-[var(--ink)]">
      <header className="inline-page-header mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <Heading
            level={1}
            className="inline-page-title font-sans! text-xl! font-semibold! tracking-tight!"
          >
            Panorama de mercado
          </Heading>
          <p className="mb-0 mt-1.5 text-xs leading-relaxed text-[var(--muted)]">
            Una mirada global a los mercados, el riesgo y las noticias.
          </p>
        </div>
        <span
          className="flex items-center gap-1.5 rounded-md border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1.5 text-xs text-[var(--muted)]"
          role="status"
        >
          <span
            className={`h-1.5 w-1.5 shrink-0 rounded-full ${status.tone}`}
          />
          {status.text}
        </span>
      </header>
      <MarketTicker
        section={data?.indicators}
        checkedAt={data?.checkedAt}
        loading={loading}
        status={status}
      />
      <div className="mb-3">
        <EconomicCalendar />
      </div>
      <div className="grid items-stretch gap-3 min-[1180px]:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
        <div className="grid min-w-0 gap-3 sm:grid-cols-2">
          <Heatmap
            title="S&P 500 Heatmap"
            badge="1D"
            subtitle="Top 20 por capitalización"
            section={data?.equities}
            loading={loading}
          />
          <Heatmap
            title="Crypto Heatmap"
            badge="1D"
            subtitle="Principales criptoactivos"
            section={data?.crypto}
            loading={loading}
          />
        </div>
        <div className="min-w-0 min-[1180px]:col-start-1 min-[1180px]:row-start-2">
          <ComparisonChart openGPR={() => navigate("datos")} />
        </div>
        <NewsFeed openSentiment={() => navigate("diagnostico")} />
      </div>
      <footer className="mt-4 flex items-start gap-2 text-xs leading-relaxed text-[var(--muted)]">
        <span className="mt-0.5 shrink-0">
          <Icon name="info" size={13} />
        </span>
        <span>
          Cotizaciones: Yahoo Finance. Mapas de calor: Finviz, con respaldo en
          StockAnalysis y Yahoo Finance cuando la fuente principal no responde
          (cripto dimensionado por capitalización de Yahoo Finance). Calendario
          económico: Forex Factory. Los precios pueden tener demora. GPR: Caldara
          &amp; Iacoviello. Noticias: fuentes públicas con fecha de publicación.
          No constituye asesoramiento de inversión.
        </span>
      </footer>
    </div>
  )
}
