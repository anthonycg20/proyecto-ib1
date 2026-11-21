import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type PointerEvent,
  type ReactNode,
  type RefObject,
} from "react"
import {
  countryRiskScores,
  getRiskLevel,
  riskLevels,
} from "../data/geopolitical"
import { countryDisplayName, iso3Of } from "../data/gpr-countries"
import worldMap from "../data/world-map.json"
import type { GprPeakNewsResponse, GprPoint, GprResponse } from "../lib/gpr"
import { buildCountryView, countryForIso3 } from "../lib/gpr-country"
import {
  gprDefinitions,
  type GprCountryNewsArticle,
  type GprCountryNewsProvider,
  type GprNewsArticle,
  type GprNewsCategory,
  type GprNewsResponse,
} from "../lib/gpr-news"
import { summarizeGpr } from "../lib/gpr-series"
import {
  gprTopicMeta,
  type GprTopic,
} from "../lib/gpr-topics"
import { CountryRiskCard } from "./gpr/CountryRiskCard"
import {
  useCountryNews,
  type CountryNewsStatus,
} from "./gpr/useCountryNews"
import {
  useGprData,
  type AvailableGpr,
  type GprDataStatus,
} from "./gpr/useGprData"
import { Button, Heading, Icon, Select } from "./ui"
import "./gpr-dashboard.css"

const series = [
  { key: "gpr", name: "GPR", description: "Riesgo geopolítico" },
  { key: "gpra", name: "GPRA", description: "Actos geopolíticos" },
  { key: "gprt", name: "GPRT", description: "Amenazas geopolíticas" },
] as const
type SeriesKey = typeof series[number]["key"]
type Period = "1S" | "1M" | "6M" | "1A" | "3A"
const periods: Record<Period, {
  label: string
  bucket: "day" | "week" | "month"
  days?: number
  months?: number
}> = {
  "1S": { label: "Última semana", bucket: "day", days: 7 },
  "1M": { label: "Último mes", bucket: "day", months: 1 },
  "6M": { label: "Últimos 6 meses", bucket: "week", months: 6 },
  "1A": { label: "Último año", bucket: "week", months: 12 },
  "3A": { label: "Últimos 3 años", bucket: "month", months: 36 },
}
const countryLabel = (country: typeof worldMap[number]) =>
  countryDisplayName(country.id, country.name)
const countries = [...worldMap].sort((a, b) =>
  countryLabel(a).localeCompare(countryLabel(b), "es"),
)

type MetricIllustration = "global" | "acts" | "threats"

function RiskMetricIllustration({ kind }: { kind: MetricIllustration }) {
  const labels = {
    global: "Globo terráqueo: riesgo geopolítico global",
    acts: "Bandera sobre un mapa: actos geopolíticos",
    threats: "Radar con alerta: amenazas geopolíticas",
  }
  return (
    <svg
      className="gpr-metric-illustration"
      viewBox="0 0 80 72"
      role="img"
      aria-label={labels[kind]}
    >
      {kind === "global" && (
        <g
          stroke="var(--illustration-ink)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="39" cy="35" r="27" fill="var(--illustration-soft)" />
          <path
            d="m22 16 10-6 9 3 2 7-8 6-5 10-9-4-6-8z"
            fill="var(--illustration-accent)"
            stroke="none"
          />
          <path
            d="m39 32 11 4 3 8-10 15-7-6 2-10-8-5 3-6z"
            fill="var(--illustration-accent)"
            stroke="none"
          />
          <path
            d="m55 45 6-3 1 7-5 3-5-3z"
            fill="var(--illustration-accent)"
            stroke="none"
          />
          <path
            d="M14 35h50M39 8c-8 7-12 16-12 27s4 20 12 27M39 8c8 7 12 16 12 27s-4 20-12 27"
            fill="none"
            opacity=".35"
          />
          <circle cx="39" cy="35" r="27" fill="none" />
        </g>
      )}
      {kind === "acts" && (
        <g
          stroke="var(--illustration-ink)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path
            d="m8 33 19-7 23 7 21-7v31l-21 7-23-7-19 7z"
            fill="var(--illustration-soft)"
          />
          <path d="M27 26v31M50 33v31" fill="none" opacity=".35" />
          <path
            d="M42 9c9-5 14 7 23 2v17c-9 5-14-7-23-2z"
            fill="var(--illustration-accent)"
          />
          <path d="M42 9v37" fill="none" strokeWidth="2.5" />
          <circle cx="42" cy="47" r="4" fill="var(--illustration-accent)" />
        </g>
      )}
      {kind === "threats" && (
        <g
          stroke="var(--illustration-ink)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="32" cy="32" r="25" fill="var(--illustration-soft)" />
          <path
            d="M32 32V7a25 25 0 0 1 25 25z"
            fill="var(--illustration-accent)"
            fillOpacity=".25"
            stroke="none"
          />
          <circle cx="32" cy="32" r="16" fill="none" opacity=".45" />
          <circle cx="32" cy="32" r="7" fill="none" opacity=".45" />
          <path d="m32 32 18-18" fill="none" />
          <circle cx="44" cy="20" r="3" fill="var(--illustration-accent)" />
          <path
            d="m60 35 15 26H45z"
            fill="var(--illustration-soft)"
            strokeWidth="2.5"
          />
          <path d="M60 44v7" fill="none" strokeWidth="2.5" />
          <circle
            cx="60"
            cy="56"
            r="1.5"
            fill="var(--illustration-ink)"
            stroke="none"
          />
        </g>
      )}
    </svg>
  )
}

function RiskMetric({
  label,
  value,
  detail,
  change,
  illustration,
  tone,
}: {
  label: string
  value: string
  detail: string
  change: string
  illustration: MetricIllustration
  tone: "blue" | "green" | "orange"
}) {
  return (
    <article className={`metric-card gpr-metric tone-${tone}`}>
      <div className="metric-top">
        <span>{label}</span>
        <span className="metric-dot" />
      </div>
      <div className="metric-visual">
        <div>
          <strong>{value}</strong>
          <small>{detail}</small>
          <span className="progress-label">{change}</span>
        </div>
        <RiskMetricIllustration kind={illustration} />
      </div>
    </article>
  )
}

type Bucket = "day" | "week" | "month"
type ObservationLabels = {
  label: string
  title: string
}
type Observation = GprPoint & ObservationLabels

const utcDate = (date: string) => new Date(`${date}T00:00:00Z`)
const dayLabel = new Intl.DateTimeFormat("es", {
  day: "2-digit",
  month: "short",
  timeZone: "UTC",
})
const fullDay = new Intl.DateTimeFormat("es", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
})
const monthLabel = new Intl.DateTimeFormat("es", {
  month: "short",
  year: "numeric",
  timeZone: "UTC",
})
const frequencyLabels: Record<Bucket, string> = {
  day: "valores diarios",
  week: "promedios semanales",
  month: "promedios mensuales",
}

// Groups the daily file into the frequency that fits each period.
function buildObservations(points: GprPoint[], period: Period): Observation[] {
  const last = points.at(-1)
  if (!last) return []
  const config = periods[period]
  const start = utcDate(last.date)
  if (config.days) start.setUTCDate(start.getUTCDate() - (config.days - 1))
  else start.setUTCMonth(start.getUTCMonth() - (config.months ?? 1))
  const startKey = start.toISOString().slice(0, 10)
  const selected = points.filter((point) => point.date >= startKey)

  if (config.bucket === "day")
    return selected.map((point) => ({
      date: point.date,
      gpr: Math.round(point.gpr),
      gpra: Math.round(point.gpra),
      gprt: Math.round(point.gprt),
      label: dayLabel.format(utcDate(point.date)),
      title: fullDay.format(utcDate(point.date)),
    }))

  const groups = new Map<string, GprPoint[]>()
  for (const point of selected) {
    let key = `${point.date.slice(0, 7)}-01`
    if (config.bucket === "week") {
      const monday = utcDate(point.date)
      monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7))
      key = monday.toISOString().slice(0, 10)
    }
    const group = groups.get(key)
    if (group) group.push(point)
    else groups.set(key, [point])
  }
  return [...groups].map(([date, items]) => {
    const average = (key: SeriesKey) =>
      Math.round(items.reduce((sum, item) => sum + item[key], 0) / items.length)
    return {
      date,
      gpr: average("gpr"),
      gpra: average("gpra"),
      gprt: average("gprt"),
      label:
        config.bucket === "week"
          ? dayLabel.format(utcDate(date))
          : monthLabel.format(utcDate(date)),
      title:
        config.bucket === "week"
          ? `Semana del ${fullDay.format(utcDate(date))}`
          : monthLabel.format(utcDate(date)),
    }
  })
}

function niceScale(values: number[]) {
  const min = Math.min(...values)
  const max = Math.max(...values)
  const rawStep = Math.max(1, (max - min) / 4)
  const magnitude = 10 ** Math.floor(Math.log10(rawStep))
  const step =
    [1, 2, 2.5, 5, 10]
      .map((multiple) => multiple * magnitude)
      .find((candidate) => candidate >= rawStep) ?? rawStep
  const low = Math.max(0, Math.floor(min / step) * step)
  const high = Math.max(low + step, Math.ceil(max / step) * step)
  const ticks: number[] = []
  for (let tick = low; tick <= high + step / 2; tick += step) ticks.push(tick)
  return { low, high, ticks }
}

function GprPeakNews() {
  const [data, setData] = useState<Extract<GprPeakNewsResponse, {
    status: "available"
  }> | null>(null)
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">(
    "idle",
  )

  const load = useCallback(async () => {
    if (status === "loading") return
    setStatus("loading")
    try {
      const response = await fetch("/api/gpr-peak-news")
      const result = (await response.json()) as GprPeakNewsResponse
      if (!response.ok || result.status !== "available")
        throw new Error("Peak news unavailable")
      setData(result)
      setStatus("ready")
    } catch {
      setStatus("error")
    }
  }, [status])

  return (
    <details
      className="gpr-peak-news"
      onToggle={(event) => {
        if (event.currentTarget.open && status === "idle") void load()
      }}
    >
      <summary>Titulares clave de la última semana</summary>
      <div className="gpr-peak-news-content">
        {status === "loading" && (
          <p className="gpr-peak-news-state" role="status">
            Buscando los titulares de la última semana…
          </p>
        )}
        {status === "error" && (
          <div className="gpr-peak-news-state" role="status">
            <span>No se pudieron obtener los titulares históricos.</span>
            <Button variant="secondary" onClick={() => void load()}>
              Reintentar
            </Button>
          </div>
        )}
        {status === "ready" && data && (
          <div className="gpr-peak-days">
            {data.days
              .filter((day) => day.headlines.length > 0)
              .map((day) => (
                <section key={day.date} className="gpr-peak-day">
                  <header>
                    <strong>{fullDay.format(utcDate(day.date))}</strong>
                  </header>
                  <ol>
                    {day.headlines.map((headline) => (
                      <li key={headline.url}>
                        <a
                          href={headline.url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {headline.title}
                        </a>
                      </li>
                    ))}
                  </ol>
                </section>
              ))}
          </div>
        )}
      </div>
    </details>
  )
}

function RiskChart({
  data,
  status,
  onRetry,
}: {
  data: AvailableGpr | null
  status: GprDataStatus
  onRetry: () => void
}) {
  const [period, setPeriod] = useState<Period>("1M")
  const [visible, setVisible] = useState<Record<SeriesKey, boolean>>({
    gpr: true,
    gpra: true,
    gprt: true,
  })
  const [hovered, setHovered] = useState<number | null>(null)
  const [chartWidth, setChartWidth] = useState(800)
  const canvasRef = useRef<HTMLDivElement>(null)
  const gradientId = useId()
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const observer = new ResizeObserver(([entry]) => {
      setChartWidth(
        window.matchMedia("(max-width: 640px)").matches
          ? entry.contentRect.width
          : 800,
      )
    })
    observer.observe(canvas)
    return () => observer.disconnect()
  }, [])
  const compact = chartWidth < 800
  const plotRight = chartWidth - 24
  const plotWidth = plotRight - 48
  const config = periods[period]
  const observations = useMemo(
    () => (data ? buildObservations(data.points, period) : []),
    [data, period],
  )
  const last = observations.length - 1
  const scale = niceScale(
    observations
      .flatMap((item) =>
        series
          .filter((entry) => visible[entry.key])
          .map((entry) => item[entry.key]),
      )
      .concat(observations.length ? [] : [0, 100]),
  )
  const x = (index: number) => 48 + (index / Math.max(1, last)) * plotWidth
  const y = (value: number) =>
    226 - ((value - scale.low) / (scale.high - scale.low)) * 200
  const points = (key: SeriesKey) =>
    observations.map((item, index) => `${x(index)},${y(item[key])}`).join(" ")
  const active = observations[hovered ?? last]
  const selected = hovered === null ? null : observations[hovered]
  const selectObservation = (event: PointerEvent<SVGSVGElement>) => {
    if (last < 0) return
    const rect = event.currentTarget.getBoundingClientRect()
    const position = ((event.clientX - rect.left) / rect.width) * chartWidth
    setHovered(
      Math.max(
        0,
        Math.min(
          last,
          Math.round(((position - 48) / plotWidth) * Math.max(1, last)),
        ),
      ),
    )
  }
  const rangeFormat = config.bucket === "month" ? monthLabel : fullDay

  return (
    <section className="card gpr-chart">
      <div className="gpr-card-heading">
        <div>
          <Heading level={2}>Evolución del riesgo geopolítico</Heading>
          <p>
            {config.label} · {frequencyLabels[config.bucket]}
          </p>
        </div>
        <div
          className="gpr-periods"
          role="group"
          aria-label="Período del gráfico"
        >
          {(Object.keys(periods) as Period[]).map((item) => (
            <Button
              key={item}
              variant="ghost"
              aria-pressed={period === item}
              title={periods[item].label}
              onClick={() => {
                setPeriod(item)
                setHovered(null)
              }}
            >
              {item}
            </Button>
          ))}
        </div>
      </div>
      <div className="gpr-chart-legend">
        {series.map((item) => (
          <Button
            key={item.key}
            variant="ghost"
            className={`gpr-series-${item.key}`}
            aria-pressed={visible[item.key]}
            title={`${item.description}: mostrar u ocultar`}
            onClick={() => {
              if (
                visible[item.key] &&
                Object.values(visible).filter(Boolean).length === 1
              )
                return
              setVisible({ ...visible, [item.key]: !visible[item.key] })
            }}
          >
            <i />
            {item.name}
          </Button>
        ))}
        <span>Índices diarios · media 1985–2019 = 100</span>
      </div>
      <div className="gpr-chart-canvas" ref={canvasRef}>
        {!active ? (
          <div className="gpr-chart-state" role="status">
            {status === "error" ? (
              <>
                <span>No se pudieron obtener los datos oficiales del GPR.</span>
                <Button variant="secondary" onClick={onRetry}>
                  Reintentar
                </Button>
              </>
            ) : (
              <span>Cargando datos diarios de Caldara e Iacoviello…</span>
            )}
          </div>
        ) : (
          <>
            <svg
              viewBox={`0 0 ${chartWidth} 270`}
              role="img"
              aria-label={`Evolución de GPR, GPRA y GPRT: ${config.label.toLowerCase()}, ${frequencyLabels[config.bucket]}.`}
              onPointerDown={selectObservation}
              onPointerMove={selectObservation}
              onPointerLeave={(event) => {
                if (event.pointerType !== "touch") setHovered(null)
              }}
            >
              <defs>
                <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" className="gpr-gradient-start" />
                  <stop offset="100%" className="gpr-gradient-end" />
                </linearGradient>
              </defs>
              {scale.ticks.map((tick) => (
                <g key={tick}>
                  <line
                    className="gpr-grid-line"
                    x1="48"
                    x2={plotRight}
                    y1={y(tick)}
                    y2={y(tick)}
                  />
                  <text x="36" y={y(tick) + 4} textAnchor="end">
                    {tick}
                  </text>
                </g>
              ))}
              <text className="gpr-axis-title" x="48" y="13">
                ÍNDICE
              </text>
              {visible.gpr && (
                <polygon
                  points={`48,226 ${points("gpr")} ${x(last)},226`}
                  fill={`url(#${gradientId})`}
                />
              )}
              {series
                .filter((item) => visible[item.key])
                .map((item) => (
                  <g key={item.key} className={`gpr-series-${item.key}`}>
                    <polyline
                      className="gpr-chart-line"
                      points={points(item.key)}
                    />
                    {config.bucket === "day" &&
                      observations.map((observation, index) => (
                        <circle
                          key={observation.date}
                          className="gpr-chart-marker"
                          cx={x(index)}
                          cy={y(observation[item.key])}
                          r="2.5"
                        />
                      ))}
                    <circle
                      className="gpr-chart-point"
                      cx={x(hovered ?? last)}
                      cy={y(active[item.key])}
                      r="4"
                    />
                  </g>
                ))}
              {observations.map(
                (item, index) =>
                  (index === 0 ||
                    index === last ||
                    index % Math.max(1, Math.ceil(last / (compact ? 2 : 5))) ===
                      0) && (
                    <text
                      key={item.date}
                      x={x(index)}
                      y="254"
                      textAnchor="middle"
                    >
                      {item.label}
                    </text>
                  ),
              )}
              {hovered !== null && (
                <line
                  className="gpr-crosshair"
                  x1={x(hovered)}
                  x2={x(hovered)}
                  y1="26"
                  y2="230"
                />
              )}
              <rect
                className="gpr-chart-interaction"
                x="48"
                y="26"
                width={plotWidth}
                height="204"
                tabIndex={0}
                role="slider"
                aria-label="Fecha del gráfico, usá las flechas para explorar"
                aria-valuemin={0}
                aria-valuemax={last}
                aria-valuenow={hovered ?? last}
                aria-valuetext={`${active.title}: GPR ${active.gpr}, GPRA ${active.gpra}, GPRT ${active.gprt}`}
                onFocus={() => setHovered((current) => current ?? last)}
                onBlur={() => setHovered(null)}
                onKeyDown={(event) => {
                  if (
                    !["ArrowLeft", "ArrowRight", "Home", "End"].includes(
                      event.key,
                    )
                  )
                    return
                  event.preventDefault()
                  setHovered(
                    event.key === "Home"
                      ? 0
                      : event.key === "End"
                        ? last
                        : Math.max(
                            0,
                            Math.min(
                              last,
                              (hovered ?? last) +
                                (event.key === "ArrowRight" ? 1 : -1),
                            ),
                          ),
                  )
                }}
              />
            </svg>
            {selected && hovered !== null && (
              <div
                className="gpr-chart-tooltip"
                style={{
                  left: `${Math.min(77, Math.max(12, (x(hovered) / chartWidth) * 100))}%`,
                }}
              >
                <strong>{selected.title}</strong>
                {series
                  .filter((item) => visible[item.key])
                  .map((item) => (
                    <span key={item.key} className={`gpr-series-${item.key}`}>
                      <i />
                      {item.name}
                      <b>{selected[item.key]}</b>
                    </span>
                  ))}
              </div>
            )}
          </>
        )}
      </div>
      <div className="gpr-chart-caption">
        <span>
          Fuente: Caldara e Iacoviello
          {data && ` · último dato ${fullDay.format(utcDate(data.updatedAt))}`}
        </span>
        {active && (
          <span>
            {rangeFormat.format(utcDate(observations[0].date))} —{" "}
            {rangeFormat.format(utcDate(observations[last].date))}
          </span>
        )}
      </div>
      <GprPeakNews />
    </section>
  )
}

function WorldRiskMap({
  selectedId,
  onSelect,
  children,
}: {
  selectedId: string
  onSelect: (id: string) => void
  children: ReactNode
}) {
  const countrySelectId = useId()
  const [zoom, setZoom] = useState(1)
  const [center, setCenter] = useState({ x: 450, y: 215 })
  const selectCountry = (id: string) => {
    onSelect(id)
  }

  return (
    <section className="card gpr-map">
      <div className="gpr-card-heading">
        <div>
          <span className="gpr-section-eyebrow">COUNTRY RISK ASSESSMENT</span>
          <Heading level={2}>Mapa global de riesgo geopolítico</Heading>
          <p>Explorá el nivel de riesgo por país</p>
        </div>
        <div className="gpr-country-select">
          <label className="gpr-country-label" htmlFor={countrySelectId}>
            Seleccionar país del mapa
          </label>
          <Select
            id={countrySelectId}
            aria-label="Seleccionar país del mapa"
            value={selectedId}
            onChange={(event) => {
              selectCountry(event.target.value)
              setZoom(1)
              setCenter({ x: 450, y: 215 })
            }}
          >
            {countries.map((country) => (
              <option key={country.id} value={country.id}>
                {countryLabel(country)}
              </option>
            ))}
          </Select>
        </div>
      </div>
      <div className="gpr-map-canvas">
        <div className="gpr-map-coordinate gpr-map-coordinate-top">85° N</div>
        <svg
          viewBox="0 0 900 430"
          role="group"
          aria-label="Mapa mundial interactivo. Los colores representan niveles de riesgo ilustrativos."
        >
          <g className="gpr-graticule" aria-hidden="true">
            {[90, 180, 270, 360].map((y) => (
              <line key={y} x1="18" x2="882" y1={y} y2={y} />
            ))}
            {[150, 300, 450, 600, 750].map((x) => (
              <line key={x} x1={x} x2={x} y1="25" y2="405" />
            ))}
          </g>
          <g
            transform={`translate(450 215) scale(${zoom}) translate(${-center.x} ${-center.y})`}
          >
            {worldMap.map((country) => {
              const countryScore = countryRiskScores[country.id]
              const countryLevel = getRiskLevel(countryScore)
              return (
                <path
                  key={country.id}
                  d={country.path}
                  className={`gpr-country risk-${countryLevel.className} ${
                    selectedId === country.id ? "is-selected" : ""
                  }`}
                  role="button"
                  tabIndex={-1}
                  aria-label={`${countryLabel(country)}: ${
                    countryScore === undefined
                      ? "sin datos"
                      : `${countryScore} de 100, riesgo ${countryLevel.label}`
                  }`}
                  aria-pressed={selectedId === country.id}
                  onClick={(event) => {
                    selectCountry(country.id)
                    if (zoom === 1) {
                      const bounds = event.currentTarget.getBBox()
                      setCenter({
                        x: bounds.x + bounds.width / 2,
                        y: bounds.y + bounds.height / 2,
                      })
                      setZoom(1.5)
                    }
                  }}
                >
                  <title>
                    {countryLabel(country)} ·{" "}
                    {countryScore === undefined
                      ? "Sin datos"
                      : `${countryScore}/100 · ${countryLevel.label}`}
                  </title>
                </path>
              )
            })}
          </g>
        </svg>
        <div className="gpr-map-controls" aria-label="Controles del mapa">
          <Button
            variant="ghost"
            aria-label="Acercar mapa"
            disabled={zoom >= 2.5}
            onClick={() => setZoom(Math.min(2.5, zoom + 0.5))}
          >
            <Icon name="plus" size={16} />
          </Button>
          <Button
            variant="ghost"
            aria-label="Alejar mapa"
            disabled={zoom <= 1}
            onClick={() => {
              const next = Math.max(1, zoom - 0.5)
              setZoom(next)
              if (next === 1) setCenter({ x: 450, y: 215 })
            }}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M5 12h14"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
          </Button>
          <Button
            variant="ghost"
            aria-label="Restablecer mapa"
            onClick={() => {
              setZoom(1)
              setCenter({ x: 450, y: 215 })
            }}
          >
            <Icon name="history" size={15} />
          </Button>
        </div>
        {children}
      </div>
      <div className="gpr-map-legend">
        {riskLevels.map((item, index) => (
          <span key={item.className}>
            <i className={`risk-${item.className}`} />
            {item.label}
            <small>
              {index ? index * 20 + 1 : 0}–{item.max}
            </small>
          </span>
        ))}
      </div>
      <p className="gpr-map-note">
        Escala ilustrativa 0–100 · Gris: sin datos · Cartografía: Natural Earth
      </p>
    </section>
  )
}

const newsFilters = {
  all: "Todas",
  act: "GPRA · Actos",
  threat: "GPRT · Amenazas",
} as const

// Display order of the area chips in the country feed (not the classifier
// tie-break order, which puts law/finance before economy).
const topicFilters: GprTopic[] = [
  "gpr",
  "politics",
  "economy",
  "finance",
  "law",
]
const NEWS_PAGE = 6

const relativeTime = new Intl.RelativeTimeFormat("es", { numeric: "auto" })
const shortDate = new Intl.DateTimeFormat("es", {
  day: "numeric",
  month: "short",
})

function publishedLabel(value: string | null) {
  if (!value) return null
  const date = new Date(value)
  const minutes = Math.round((Date.now() - date.getTime()) / 60_000)
  if (minutes < 0 || minutes >= 7 * 24 * 60) return shortDate.format(date)
  if (minutes < 60) return relativeTime.format(-Math.max(minutes, 1), "minute")
  if (minutes < 24 * 60)
    return relativeTime.format(-Math.round(minutes / 60), "hour")
  return relativeTime.format(-Math.round(minutes / 1440), "day")
}

function NewsThumbnail({ src }: { src: string | null }) {
  return (
    <span className="gpr-news-thumb">
      <Icon name="report" size={18} />
      {src && (
        <span
          className="gpr-news-thumb-image"
          style={{ backgroundImage: `url(${JSON.stringify(src)})` }}
          aria-hidden
        />
      )}
    </span>
  )
}

function NewsItem({ article }: { article: GprNewsArticle }) {
  const published = publishedLabel(article.publishedAt)
  const topic = article.topic
  const category = article.category
  const mention = article.inTitle === false
  return (
    <article>
      <a href={article.url} target="_blank" rel="noopener noreferrer">
        <NewsThumbnail src={article.image} />
        <span className="gpr-news-body">
          <strong className="gpr-news-title">{article.title}</strong>
          <span className="gpr-news-meta">
            {topic ? (
              <span
                className={`gpr-news-tag ${
                  gprTopicMeta[topic].className
                }`}
              >
                {gprTopicMeta[topic].label}
              </span>
            ) : category ? (
              <span className={`gpr-news-tag tag-${category}`}>
                {gprDefinitions[category].label}
              </span>
            ) : null}
            {mention && (
              <span className="gpr-news-tag tag-mention">Mención</span>
            )}
            <span>
              {article.source}
              {published && (
                <>
                  {" · "}
                  <time dateTime={article.publishedAt ?? undefined}>
                    {published}
                  </time>
                </>
              )}
            </span>
          </span>
          {category && article.signal && (
            <span className="gpr-news-signal">Señal: «{article.signal}»</span>
          )}
        </span>
        <span className="sr-only"> (se abre en una pestaña nueva)</span>
      </a>
    </article>
  )
}

function GeopoliticalNews({
  countryFilter,
  countryName,
  countryArticles,
  countryStatus,
  countryUpdatedAt,
  countryProvider,
  countryPartial,
  tagFilter,
  onClearCountry,
  onClearTag,
  feedRef,
}: {
  countryFilter: string | null
  countryName: string | null
  countryArticles: GprCountryNewsArticle[]
  countryStatus: CountryNewsStatus
  countryUpdatedAt: string | null
  countryProvider: GprCountryNewsProvider | null
  countryPartial: boolean
  tagFilter: string | null
  onClearCountry: () => void
  onClearTag: () => void
  feedRef: RefObject<HTMLElement | null>
}) {
  const [filter, setFilter] = useState<GprNewsCategory | "all">("all")
  const [topicFilter, setTopicFilter] = useState<GprTopic | "all">("all")
  const [showAll, setShowAll] = useState(false)
  const [articles, setArticles] = useState<GprNewsArticle[]>([])
  const [sources, setSources] = useState<string[]>([])
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading")
  const isCountry = !!countryFilter

  useEffect(() => {
    setTopicFilter("all")
    setShowAll(false)
  }, [countryFilter])

  const load = useCallback(async (signal?: AbortSignal) => {
    setStatus("loading")
    try {
      const response = await fetch("/api/gpr-news", { signal })
      const result = (await response.json()) as GprNewsResponse
      if (!response.ok || result.status !== "available")
        throw new Error("News unavailable")
      setArticles(result.articles)
      setSources(result.sources)
      setStatus("ready")
    } catch {
      if (!signal?.aborted) setStatus("error")
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    void load(controller.signal)
    return () => controller.abort()
  }, [load])

  // The country feed already arrives ordered (headlines first, then mentions
  // outside the headline, newest first). If it is empty we fall back to the
  // world feed filtered by country and say so.
  const base = useMemo<GprNewsArticle[]>(() => {
    if (!countryFilter) return articles
    if (countryArticles.length) return countryArticles
    return articles.filter((item) => item.countries.includes(countryFilter))
  }, [articles, countryArticles, countryFilter])

  const countryFallback =
    isCountry && !countryArticles.length && base.length > 0

  const scoped = useMemo(
    () =>
      base.filter((item) => !tagFilter || item.tags.includes(tagFilter)),
    [base, tagFilter],
  )
  const counts = useMemo(
    () => ({
      all: scoped.length,
      act: scoped.filter((item) => item.category === "act").length,
      threat: scoped.filter((item) => item.category === "threat").length,
    }),
    [scoped],
  )
  // Country mode filters by area instead of GPRA/GPRT.
  const topicCounts = useMemo(() => {
    const totals = new Map<GprTopic, number>()
    for (const item of scoped) {
      if (!item.topic) continue
      totals.set(item.topic, (totals.get(item.topic) ?? 0) + 1)
    }
    return totals
  }, [scoped])
  const filtered = isCountry
    ? scoped.filter(
        (item) => topicFilter === "all" || item.topic === topicFilter,
      )
    : scoped.filter((item) => filter === "all" || item.category === filter)
  const displayed = showAll ? filtered : filtered.slice(0, NEWS_PAGE)
  const loading =
    status === "loading" ||
    (isCountry && countryStatus === "loading" && !countryArticles.length)

  const updatedLabel = countryUpdatedAt
    ? new Intl.DateTimeFormat("es-PE", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "America/Lima",
      }).format(new Date(countryUpdatedAt))
    : null

  const footnoteSources = (
    isCountry ? [...new Set(base.map((item) => item.source))] : sources
  ).slice(0, 6)

  return (
    <aside className="gpr-news-column" ref={feedRef} tabIndex={-1}>
      <section className="card gpr-news">
        <div className="gpr-news-heading">
          <span className="gpr-section-eyebrow">GEOPOLITICAL NEWS FEED</span>
          <Heading level={2}>
            {isCountry
              ? `Noticias de ${countryName ?? countryFilter}`
              : "Noticias geopolíticas"}
          </Heading>
          <p>
            {isCountry
              ? "Últimos 30 días · GPR, política, economía, finanzas y derecho"
              : "Titulares reales, clasificados como actos o amenazas"}
          </p>
        </div>
        <div className="gpr-news-filters" aria-label="Filtrar noticias">
          {isCountry ? (
            <>
              <Button
                variant="ghost"
                aria-pressed={topicFilter === "all"}
                onClick={() => {
                  setTopicFilter("all")
                  setShowAll(false)
                }}
              >
                Todas
                {!loading && <small>{scoped.length}</small>}
              </Button>
              {topicFilters.map((topic) => {
                const total = topicCounts.get(topic) ?? 0
                return (
                  <Button
                    key={topic}
                    variant="ghost"
                    className={gprTopicMeta[topic].className}
                    aria-pressed={topicFilter === topic}
                    disabled={total === 0}
                    onClick={() => {
                      setTopicFilter(topic)
                      setShowAll(false)
                    }}
                  >
                    {gprTopicMeta[topic].label}
                    {!loading && <small>{total}</small>}
                  </Button>
                )
              })}
            </>
          ) : (
            (["all", "act", "threat"] as const).map((item) => (
              <Button
                key={item}
                variant="ghost"
                aria-pressed={filter === item}
                onClick={() => {
                  setFilter(item)
                  setShowAll(false)
                }}
              >
                {newsFilters[item]}
                {!loading && <small>{counts[item]}</small>}
              </Button>
            ))
          )}
        </div>
        {countryFallback && (
          <p className="gpr-news-fallback">
            <Icon name="info" size={13} />
            <span>
              Sin cobertura específica reciente; mostramos el feed global
              filtrado por país.
            </span>
          </p>
        )}
        {(countryFilter || tagFilter) && (
          <div className="gpr-news-scope" aria-label="Filtros activos">
            {countryFilter && (
              <button
                type="button"
                className="gpr-news-scope-chip"
                onClick={onClearCountry}
              >
                {countryName ?? countryFilter}
                <span aria-hidden>✕</span>
              </button>
            )}
            {tagFilter && (
              <button
                type="button"
                className="gpr-news-scope-chip"
                onClick={onClearTag}
              >
                #{tagFilter}
                <span aria-hidden>✕</span>
              </button>
            )}
            <span className="gpr-news-scope-count">
              {loading ? "Filtrando…" : `${filtered.length} titulares`}
              {isCountry && updatedLabel && !loading
                ? ` · Actualizado ${updatedLabel}`
                : ""}
            </span>
          </div>
        )}
        <div className="gpr-news-list" aria-busy={loading}>
          {loading &&
            Array.from({ length: 4 }, (_, index) => (
              <div key={index} className="gpr-news-skeleton" aria-hidden>
                <span />
                <span />
              </div>
            ))}
          {status === "error" && !countryArticles.length && (
            <div className="gpr-news-state" role="status">
              <span>No se pudieron cargar los titulares ahora mismo.</span>
              <Button variant="secondary" onClick={() => void load()}>
                Reintentar
              </Button>
            </div>
          )}
          {!loading && !filtered.length && (
            <div className="gpr-news-state" role="status">
              <span>
                {countryName
                  ? `No hay titulares de ${countryName} en los últimos 30 días.`
                  : "No hay titulares de este tipo en las fuentes en este momento."}
              </span>
              {(countryFilter || tagFilter) && (
                <Button
                  variant="secondary"
                  onClick={() => {
                    onClearCountry()
                    onClearTag()
                  }}
                >
                  Quitar filtros
                </Button>
              )}
            </div>
          )}
          {!loading &&
            displayed.map((article) => (
              <NewsItem key={article.id} article={article} />
            ))}
        </div>
        {!loading && filtered.length > NEWS_PAGE && (
          <Button
            variant="ghost"
            className="gpr-news-more"
            onClick={() => setShowAll(!showAll)}
          >
            {showAll ? "Ver menos" : `Ver ${filtered.length - NEWS_PAGE} más`}
            <Icon name="arrow" size={15} />
          </Button>
        )}
        <div className="gpr-news-disclaimer">
          <Icon name="info" size={15} />
          <span>
            {isCountry ? (
              <>
                Titulares de{" "}
                {footnoteSources.length
                  ? footnoteSources.join(", ")
                  : "las fuentes actuales"}
                . Ventana de 30 días; clasificación automática por tema
                (GPR, política, economía, finanzas y derecho).
                {countryProvider && (
                  <>
                    {" "}
                    Fuente: {countryProvider}
                    {countryPartial ? " · datos parciales" : ""}.
                  </>
                )}
              </>
            ) : (
              <>
                Titulares e imágenes de{" "}
                {sources.length
                  ? sources.join(", ")
                  : "The New York Times, The Guardian, BBC News y El País"}
                . Clasificación automática por palabras clave, inspirada en la
                metodología de Caldara e Iacoviello; no es el cálculo oficial
                del GPR.
              </>
            )}
          </span>
        </div>
      </section>
      <section className="gpr-methodology">
        <span className="gpr-method-icon">
          <Icon name="book" size={19} />
        </span>
        <Heading level={3}>Una lectura, tres perspectivas</Heading>
        <dl className="gpr-method-terms">
          {(["all", "act", "threat"] as const).map((key) => (
            <div key={key} className={`tone-${key}`}>
              <dt>
                <b>{gprDefinitions[key].label}</b>
                <span>{gprDefinitions[key].name}</span>
              </dt>
              <dd>{gprDefinitions[key].text}</dd>
            </div>
          ))}
        </dl>
        <details>
          <summary>Sobre los datos</summary>
          <p>
            El gráfico y las tarjetas de arriba usan el índice diario oficial de
            Caldara e Iacoviello. El mapa, el desglose GPRA/GPRT y el trend por
            país son ilustrativos: no existe un desglose oficial por país. Las
            noticias son titulares reales de las fuentes indicadas,
            actualizados cada pocos minutos. El feed global se etiqueta como
            GPRA o GPRT; el feed por país prioriza los últimos 30 días y
            etiqueta cada titular como GPR, política, economía, finanzas o
            derecho. La card del país consulta GDELT y Google News y muestra
            hasta cuatro hechos clave de los últimos 30 días, cada uno con el
            titular original y su fuente; cuando un país no tiene cobertura
            suficiente se indica de forma explícita. No constituye
            asesoramiento de inversión.
          </p>
        </details>
      </section>
    </aside>
  )
}

const metricNumber = new Intl.NumberFormat("es", { maximumFractionDigits: 0 })
const signedPercent = new Intl.NumberFormat("es", {
  maximumFractionDigits: 1,
  signDisplay: "always",
})
const signedPoints = new Intl.NumberFormat("es", {
  maximumFractionDigits: 0,
  signDisplay: "always",
})

export default function GPRDashboard() {
  const [selectedIso2, setSelectedIso2] = useState("RU")
  const [countryFilter, setCountryFilter] = useState<string | null>(null)
  const [tagFilter, setTagFilter] = useState<string | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const feedRef = useRef<HTMLElement>(null)
  const { data, status, reload } = useGprData()
  const summary = useMemo(
    () => (data ? summarizeGpr(data.points) : null),
    [data],
  )
  const selectedIso3 = iso3Of(selectedIso2)
  const news = useCountryNews(selectedIso3)
  const country = useMemo(
    () =>
      buildCountryView(
        selectedIso2,
        news.data?.iso3 === selectedIso3 ? news.data : null,
      ),
    [selectedIso2, selectedIso3, news.data],
  )
  const filterCountry = countryFilter ? countryForIso3(countryFilter) : null
  // Never show the previous country's headlines while the new request loads.
  const countryNews =
    countryFilter && news.data?.iso3 === countryFilter ? news.data : null
  const countryArticles = countryNews?.articles ?? []

  const selectCountry = useCallback((iso2: string) => {
    setSelectedIso2(iso2)
    setCountryFilter(iso3Of(iso2))
    setTagFilter(null)
    setDetailOpen(true)
  }, [])

  const openNews = () => {
    setCountryFilter(iso3Of(selectedIso2))
    setTagFilter(null)
    const node = feedRef.current
    if (!node) return
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches
    node.scrollIntoView({
      behavior: reduceMotion ? "auto" : "smooth",
      block: "start",
    })
    node.focus({ preventScroll: true })
  }

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return
      if (detailOpen) {
        setDetailOpen(false)
        return
      }
      if (countryFilter || tagFilter) {
        setCountryFilter(null)
        setTagFilter(null)
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [detailOpen, countryFilter, tagFilter])

  const unavailable =
    status === "error" ? "No se pudieron cargar los datos" : "Calculando…"
  const gprChange =
    summary?.gprDeltaPct != null
      ? `${signedPercent.format(summary.gprDeltaPct)}% vs. media del mes anterior`
      : unavailable
  const gpraChange =
    summary?.gpraDelta != null
      ? `${signedPoints.format(summary.gpraDelta)} pts vs. media del mes anterior`
      : unavailable
  const gprtChange =
    summary?.gprtDelta != null
      ? `${signedPoints.format(summary.gprtDelta)} pts vs. media del mes anterior`
      : unavailable

  return (
    <div className="gpr-dashboard">
      <header className="gpr-page-header">
        <div>
          <span className="eyebrow">INTELIGENCIA GEOPOLÍTICA</span>
          <Heading level={1} className="inline-page-title">
            GPR Index<span className="gpr-demo-badge">Demo</span>
          </Heading>
          <p>El panorama global, en una sola mirada.</p>
        </div>
      </header>
      <div className="gpr-layout">
        <div className="gpr-main-column">
          <div className="gpr-metrics">
            <RiskMetric
              label="GPR Index"
              value={summary ? metricNumber.format(summary.gpr) : "—"}
              detail="Riesgo geopolítico global"
              change={gprChange}
              illustration="global"
              tone="blue"
            />
            <RiskMetric
              label="GPRA · Actos"
              value={summary ? metricNumber.format(summary.gpra) : "—"}
              detail="Actos geopolíticos"
              change={gpraChange}
              illustration="acts"
              tone="green"
            />
            <RiskMetric
              label="GPRT · Amenazas"
              value={summary ? metricNumber.format(summary.gprt) : "—"}
              detail="Amenazas geopolíticas"
              change={gprtChange}
              illustration="threats"
              tone="orange"
            />
          </div>
          <RiskChart
            data={data}
            status={status}
            onRetry={() => {
              void reload()
            }}
          />
          <WorldRiskMap selectedId={selectedIso2} onSelect={selectCountry}>
            <CountryRiskCard
              country={country}
              expanded={detailOpen}
              newsStatus={news.status}
              provider={news.data?.provider ?? null}
              partial={news.data?.partial ?? false}
              activeTag={tagFilter}
              onToggle={() => setDetailOpen(true)}
              onClose={() => setDetailOpen(false)}
              onTagClick={(tag) => {
                setCountryFilter(iso3Of(selectedIso2))
                setTagFilter((current) => (current === tag ? null : tag))
              }}
              onOpenNews={openNews}
            />
          </WorldRiskMap>
        </div>
        <GeopoliticalNews
          countryFilter={countryFilter}
          countryName={filterCountry?.name ?? null}
          countryArticles={countryArticles}
          countryStatus={news.status}
          countryUpdatedAt={countryNews?.checkedAt ?? null}
          countryProvider={countryNews?.provider ?? null}
          countryPartial={countryNews?.partial ?? false}
          tagFilter={tagFilter}
          onClearCountry={() => setCountryFilter(null)}
          onClearTag={() => setTagFilter(null)}
          feedRef={feedRef}
        />
      </div>
      <footer className="gpr-footer">
        <Icon name="info" size={14} />
        <span>
          El gráfico y las tarjetas de arriba usan el mismo índice diario oficial
          del GPR; el mapa y el desglose por país son ilustrativos. Las noticias
          son titulares reales.
        </span>
      </footer>
    </div>
  )
}
