import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type PointerEvent,
} from "react"
import {
  countryNames,
  countryRiskScores,
  getRiskLevel,
  riskLevels,
} from "../data/geopolitical"
import worldMap from "../data/world-map.json"
import type { GprPeakNewsResponse, GprPoint, GprResponse } from "../lib/gpr"
import {
  gprDefinitions,
  type GprNewsArticle,
  type GprNewsCategory,
  type GprNewsResponse,
} from "../lib/gpr-news"
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
  countryNames[country.id] ?? country.name
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
      <summary>Titulares de prensa en los picos del GPR</summary>
      <div className="gpr-peak-news-content">
        {status === "loading" && (
          <p className="gpr-peak-news-state" role="status">
            Buscando noticias de los días con mayor riesgo…
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
            {data.days.map((day) => (
              <section key={day.date} className="gpr-peak-day">
                <header>
                  <strong>{fullDay.format(utcDate(day.date))}</strong>
                </header>
                {day.headlines.length ? (
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
                ) : (
                  <p className="gpr-peak-empty">
                    No hay titulares disponibles para esta fecha.
                  </p>
                )}
              </section>
            ))}
          </div>
        )}
      </div>
    </details>
  )
}

function RiskChart() {
  const [period, setPeriod] = useState<Period>("1M")
  const [visible, setVisible] = useState<Record<SeriesKey, boolean>>({
    gpr: true,
    gpra: true,
    gprt: true,
  })
  const [hovered, setHovered] = useState<number | null>(null)
  const [chartWidth, setChartWidth] = useState(800)
  const [data, setData] = useState<Extract<GprResponse, {
    status: "available"
  }> | null>(null)
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading")
  const canvasRef = useRef<HTMLDivElement>(null)
  const gradientId = useId()
  const load = useCallback(async (signal?: AbortSignal) => {
    setStatus("loading")
    try {
      const response = await fetch("/api/gpr", { signal })
      const result: GprResponse = await response.json()
      if (
        !response.ok ||
        result.status !== "available" ||
        !result.points.length
      )
        throw new Error("GPR unavailable")
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
                <Button variant="secondary" onClick={() => void load()}>
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

function WorldRiskMap() {
  const countrySelectId = useId()
  const [selectedId, setSelectedId] = useState("RU")
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [zoom, setZoom] = useState(1)
  const [center, setCenter] = useState({ x: 450, y: 215 })
  const selected = worldMap.find((country) => country.id === selectedId)!
  const active =
    worldMap.find((country) => country.id === hoveredId) ?? selected
  const score = countryRiskScores[active.id]
  const level = getRiskLevel(score)
  const selectCountry = (id: string) => {
    setSelectedId(id)
    setHoveredId(null)
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
          onPointerLeave={() => setHoveredId(null)}
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
                  onPointerEnter={() => setHoveredId(country.id)}
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
        <div
          className={`gpr-country-detail risk-${level.className}`}
          aria-live="polite"
        >
          <span className="gpr-country-indicator" />
          <div>
            <strong>{countryLabel(active)}</strong>
            <small>Riesgo {level.label.toLowerCase()}</small>
          </div>
          <b>
            {score ?? "—"}
            <small>/ 100</small>
          </b>
        </div>
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
  return (
    <article>
      <a href={article.url} target="_blank" rel="noopener noreferrer">
        <NewsThumbnail src={article.image} />
        <span className="gpr-news-body">
          <strong className="gpr-news-title">{article.title}</strong>
          <span className="gpr-news-meta">
            <span className={`gpr-news-tag tag-${article.category}`}>
              {gprDefinitions[article.category].label}
            </span>
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
          <span className="gpr-news-signal">Señal: «{article.signal}»</span>
        </span>
        <span className="sr-only"> (se abre en una pestaña nueva)</span>
      </a>
    </article>
  )
}

function GeopoliticalNews() {
  const [filter, setFilter] = useState<GprNewsCategory | "all">("all")
  const [showAll, setShowAll] = useState(false)
  const [articles, setArticles] = useState<GprNewsArticle[]>([])
  const [sources, setSources] = useState<string[]>([])
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading")

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

  const counts = useMemo(
    () => ({
      all: articles.length,
      act: articles.filter((item) => item.category === "act").length,
      threat: articles.filter((item) => item.category === "threat").length,
    }),
    [articles],
  )
  const filtered = articles.filter(
    (item) => filter === "all" || item.category === filter,
  )
  const displayed = showAll ? filtered : filtered.slice(0, NEWS_PAGE)

  return (
    <aside className="gpr-news-column">
      <section className="card gpr-news">
        <div className="gpr-news-heading">
          <span className="gpr-section-eyebrow">GEOPOLITICAL NEWS FEED</span>
          <Heading level={2}>Noticias geopolíticas</Heading>
          <p>Titulares reales, clasificados como actos o amenazas</p>
        </div>
        <div className="gpr-news-filters" aria-label="Filtrar noticias">
          {(["all", "act", "threat"] as const).map((item) => (
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
              {status === "ready" && <small>{counts[item]}</small>}
            </Button>
          ))}
        </div>
        <div className="gpr-news-list" aria-busy={status === "loading"}>
          {status === "loading" &&
            Array.from({ length: 4 }, (_, index) => (
              <div key={index} className="gpr-news-skeleton" aria-hidden>
                <span />
                <span />
              </div>
            ))}
          {status === "error" && (
            <div className="gpr-news-state" role="status">
              <span>No se pudieron cargar los titulares ahora mismo.</span>
              <Button variant="secondary" onClick={() => void load()}>
                Reintentar
              </Button>
            </div>
          )}
          {status === "ready" && !filtered.length && (
            <p className="gpr-news-state" role="status">
              No hay titulares de este tipo en las fuentes en este momento.
            </p>
          )}
          {status === "ready" &&
            displayed.map((article) => (
              <NewsItem key={article.id} article={article} />
            ))}
        </div>
        {status === "ready" && filtered.length > NEWS_PAGE && (
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
            Titulares e imágenes de{" "}
            {sources.length
              ? sources.join(", ")
              : "The New York Times, The Guardian, BBC News y El País"}
            . Clasificación automática por palabras clave, inspirada en la
            metodología de Caldara e Iacoviello; no es el cálculo oficial del
            GPR.
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
            El gráfico de evolución usa el índice diario oficial de Caldara e
            Iacoviello. Las tarjetas y el mapa usan valores de muestra. Las
            noticias son titulares reales de las fuentes indicadas, actualizados
            cada pocos minutos y etiquetados automáticamente como GPRA o GPRT
            según las palabras que contienen. No constituye asesoramiento de
            inversión.
          </p>
        </details>
      </section>
    </aside>
  )
}

export default function GPRDashboard() {
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
              value="142.5"
              detail="Riesgo geopolítico global"
              change="+8,2% vs. mes anterior"
              illustration="global"
              tone="blue"
            />
            <RiskMetric
              label="GPRA · Actos"
              value="15"
              detail="Actos geopolíticos"
              change="+3 vs. mes anterior"
              illustration="acts"
              tone="green"
            />
            <RiskMetric
              label="GPRT · Amenazas"
              value="22"
              detail="Amenazas geopolíticas"
              change="−2 vs. mes anterior"
              illustration="threats"
              tone="orange"
            />
          </div>
          <RiskChart />
          <WorldRiskMap />
        </div>
        <GeopoliticalNews />
      </div>
      <footer className="gpr-footer">
        <Icon name="info" size={14} />
        <span>
          El gráfico de evolución usa datos diarios oficiales del GPR y las
          noticias son titulares reales. Las tarjetas y el mapa son
          ilustrativos.
        </span>
      </footer>
    </div>
  )
}
