"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { Button, Heading, Icon, Select } from "./ui"
import { sentimentFactors, sentimentState } from "@/data/sentiment-reference"
import type {
  FearGreedData,
  FearGreedFactor,
  FearGreedFactorId,
  FearGreedResponse,
} from "@/lib/fear-greed"
import type { HeadlineSentiment, MarketNewsResponse } from "@/lib/sentiment-nlp"

const panel = "rounded-lg border border-[var(--line)] bg-[var(--surface)]"
const newsStates = {
  positive: {
    label: "Positivo",
    className: "text-[var(--sentiment-greed)] bg-[var(--green-soft)]",
  },
  negative: {
    label: "Negativo",
    className: "text-[var(--sentiment-critical)] bg-[var(--red-soft)]",
  },
  neutral: {
    label: "Neutral",
    className: "text-[var(--muted)] bg-[var(--background)]",
  },
}
const dateFormat = new Intl.DateTimeFormat("es", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
})
type FearGreedStatus = "loading" | "live" | "unavailable"

const signed = (value: number, digits: number, suffix = "") =>
  `${
    value > 0 ? "+" : value < 0 ? "−" : ""
  }${Math.abs(value).toFixed(digits)}${suffix}`
const factorDisplay: Record<FearGreedFactorId, {
  unit: string
  format: (factor: FearGreedFactor) => string
}> = {
  momentum: {
    unit: "S&P 500 vs. media de 125 días",
    format: (factor) => signed(factor.value, 1, "%"),
  },
  strength: {
    unit: "Máximos netos de 52 semanas · NYSE",
    format: (factor) => signed(factor.value, 1, "%"),
  },
  breadth: {
    unit: "McClellan Volume Summation",
    format: (factor) => signed(factor.value, 0),
  },
  options: {
    unit: "Ratio Put / Call · media de 5 días",
    format: (factor) => factor.value.toFixed(2),
  },
  volatility: {
    unit: "Puntos VIX · media de 50 días",
    format: (factor) => factor.value.toFixed(2),
  },
  safehaven: {
    unit: "Acciones vs. bonos · retorno a 20 días",
    format: (factor) => signed(factor.value, 2, " pp"),
  },
  junk: {
    unit: "Spread high yield / investment grade",
    format: (factor) => `${factor.value.toFixed(2)} pp`,
  },
}
const sourceLabel = (status: FearGreedStatus, data: FearGreedData | null) =>
  status === "loading" && !data
    ? "Consultando CNN"
    : status === "unavailable"
      ? data
        ? "Última lectura recibida"
        : "CNN no disponible"
      : "CNN · en vivo"

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="h-3.5 w-0.5 rounded-full bg-[var(--bright)]" />
      <Heading
        level={2}
        className="text-sm! font-sans! font-semibold! tracking-tight!"
      >
        {children}
      </Heading>
    </div>
  )
}

function FearGreedGauge({
  data,
  status,
}: {
  data: FearGreedData | null
  status: FearGreedStatus
}) {
  const score = data?.score ?? null
  const change = data ? data.score - data.previousClose : 0
  const state = score === null ? null : sentimentState(score)
  const changeColor =
    change >= 0 ? "var(--sentiment-greed)" : "var(--sentiment-critical)"
  const point = (value: number, radius = 145) => {
    const angle = Math.PI * (1 - value / 100)
    return [200 + Math.cos(angle) * radius, 184 - Math.sin(angle) * radius]
  }
  const arc = (from: number, to: number) => {
    const a = point(from)
    const b = point(to)
    return `M ${a[0]} ${a[1]} A 145 145 0 0 1 ${b[0]} ${b[1]}`
  }
  const needle = score === null ? null : point(score, 132)
  const origin = score === null ? null : point(score, 108)
  const segments = [
    { from: 0, to: 25, color: "var(--sentiment-critical)" },
    { from: 25, to: 45, color: "var(--sentiment-fear)" },
    { from: 45, to: 55, color: "var(--sentiment-neutral)" },
    { from: 55, to: 75, color: "var(--sentiment-optimism)" },
    { from: 75, to: 100, color: "var(--sentiment-greed)" },
  ]
  const history = data
    ? [
        { label: "Cierre anterior", score: data.previousClose },
        { label: "Hace 1 semana", score: data.previousWeek },
        { label: "Hace 1 mes", score: data.previousMonth },
        { label: "Hace 1 año", score: data.previousYear },
      ]
    : []
  return (
    <section className={`${panel} sentiment-gauge overflow-hidden`}>
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 pt-4">
        <SectionTitle>CNN Fear &amp; Greed Index</SectionTitle>
        <span className="flex items-center gap-1.5 text-xs text-[var(--muted)]">
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              status === "live"
                ? "bg-[var(--sentiment-greed)]"
                : status === "loading"
                  ? "animate-pulse bg-[var(--sentiment-neutral)] motion-reduce:animate-none"
                  : "bg-[var(--sentiment-fear)]"
            }`}
          />
          {sourceLabel(status, data)}
        </span>
      </div>
      <div className="mx-auto max-w-80 px-4 pt-2">
        <svg
          viewBox="0 0 400 232"
          className="block w-full"
          role="img"
          aria-label={
            score === null || !state
              ? "Fear & Greed: dato de CNN no disponible."
              : `Fear & Greed: ${score.toFixed(1)} de 100, ${state.label}. Variación frente al cierre anterior: ${signed(change, 1)} puntos.`
          }
        >
          {segments.map((segment) => (
            <path
              key={segment.from}
              d={arc(segment.from, segment.to)}
              fill="none"
              stroke={segment.color}
              strokeWidth="30"
              opacity={score === null ? 0.35 : 1}
            />
          ))}
          {[0, 20, 40, 60, 80, 100].map((value) => {
            const p = point(value, 173)
            return (
              <text
                key={value}
                x={p[0]}
                y={p[1] + 4}
                textAnchor="middle"
                className="fill-[var(--muted)] text-xs"
              >
                {value}
              </text>
            )
          })}
          {score !== null && needle && origin && (
            <>
              <path
                d={arc(0, score)}
                fill="none"
                stroke="var(--navy)"
                strokeWidth="5"
                strokeLinecap="round"
                opacity="0.85"
              />
              <line
                x1={origin[0]}
                x2={needle[0]}
                y1={origin[1]}
                y2={needle[1]}
                stroke="var(--navy)"
                strokeWidth="5"
                strokeLinecap="round"
              />
            </>
          )}
          <text
            x="200"
            y="149"
            textAnchor="middle"
            className="fill-[var(--ink)] text-5xl font-semibold tracking-tighter"
          >
            {score === null ? "—" : score.toFixed(1)}
          </text>
          <text
            x="200"
            y="174"
            textAnchor="middle"
            fill={state?.color ?? "var(--muted)"}
            className="text-xs font-semibold"
          >
            {state
              ? state.label.toUpperCase()
              : status === "loading"
                ? "CARGANDO"
                : "SIN DATOS"}
          </text>
          {data && (
            <>
              <path
                d={
                  change < 0
                    ? "M 169 187 l 4 6 l 4 -6 Z"
                    : "M 169 193 l 4 -6 l 4 6 Z"
                }
                fill={changeColor}
              />
              <text
                x="204"
                y="195"
                textAnchor="middle"
                fill={changeColor}
                className="text-xs font-semibold"
              >
                {signed(change, 1)} pts
              </text>
            </>
          )}
        </svg>
      </div>
      {data && (
        <dl className="m-0 grid grid-cols-2 gap-px border-t border-[var(--line)] bg-[var(--line)] sm:grid-cols-4">
          {history.map((item) => {
            const itemState = sentimentState(item.score)
            return (
              <div key={item.label} className="bg-[var(--surface)] px-4 py-2.5">
                <dt className="text-xs text-[var(--muted)]">{item.label}</dt>
                <dd className="m-0 mt-1 flex items-baseline gap-1.5">
                  <strong className="text-sm font-semibold tabular-nums text-[var(--ink)]">
                    {item.score.toFixed(1)}
                  </strong>
                  <span
                    className="truncate text-xs"
                    style={{ color: itemState.color }}
                  >
                    {itemState.label}
                  </span>
                </dd>
              </div>
            )
          })}
        </dl>
      )}
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t border-[var(--line)] px-4 py-2.5 text-xs text-[var(--muted)]">
        <span>
          {data ? (
            <>
              Actualizado{" "}
              <time dateTime={data.updatedAt} className="tabular-nums">
                {dateFormat.format(new Date(data.updatedAt))}
              </time>{" "}
              · se consulta cada 5 min
            </>
          ) : status === "loading" ? (
            "Obteniendo la lectura de CNN"
          ) : (
            "CNN no respondió. No se muestran valores estimados."
          )}
        </span>
        <Link
          className="shrink-0 font-medium text-[var(--primary)] underline-offset-4 hover:underline"
          href="https://www.cnn.com/markets/fear-and-greed"
          target="_blank"
          rel="noopener noreferrer"
        >
          Consultar fuente
        </Link>
      </div>
    </section>
  )
}

function FactorCards({ data }: { data: FearGreedData | null }) {
  return (
    <section className={`${panel} sentiment-factors overflow-hidden`}>
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
        <Heading level={2} className="text-sm! font-sans! font-semibold!">
          Desglose de Factores Fear &amp; Greed
        </Heading>
        <span className="text-xs text-[var(--muted)]">7 indicadores</span>
      </div>
      <div className="grid grid-cols-1 gap-px border-y border-[var(--line)] bg-[var(--line)] min-[360px]:grid-cols-2 sm:grid-cols-3">
        {sentimentFactors.map((factor) => {
          const live = data?.factors.find((item) => item.id === factor.id)
          const display = factorDisplay[factor.id]
          const score = live ? Math.round(live.score) : null
          const state = live ? sentimentState(live.score) : null
          return (
            <article
              key={factor.id}
              className="flex min-w-0 flex-col bg-[var(--surface)] p-3"
              title={factor.subtitle}
            >
              <Heading level={3} className="text-xs! font-sans! leading-snug!">
                {factor.title}
              </Heading>
              <div className="mt-2 flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1">
                <strong className="text-2xl font-semibold tabular-nums tracking-tight text-[var(--ink)]">
                  {live ? display.format(live) : "—"}
                </strong>
                <span
                  className={`rounded-sm px-1.5 py-0.5 text-xs font-medium ${
                    state?.className ??
                    "bg-[var(--background)] text-[var(--muted)]"
                  }`}
                >
                  {state?.label ?? "Sin dato"}
                </span>
              </div>
              <p className="mb-3 mt-1 text-xs leading-snug text-[var(--muted)]">
                {factor.id === "volatility" && live?.reference
                  ? `${display.unit}: ${live.reference.toFixed(2)}`
                  : display.unit}
              </p>
              <div
                className="mt-auto h-1 overflow-hidden rounded-sm bg-[var(--line)]"
                role="progressbar"
                aria-label={`${factor.title}: puntuación de CNN`}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={score ?? undefined}
              >
                {state && (
                  <div
                    className="h-full rounded-sm"
                    style={{
                      width: `${score}%`,
                      backgroundColor: state.color,
                    }}
                  />
                )}
              </div>
              <div className="mt-1.5 flex justify-between text-xs tabular-nums text-[var(--muted)]">
                <span>0</span>
                <span>{score ?? "—"} / 100</span>
                <span>100</span>
              </div>
            </article>
          )
        })}
        <aside
          className="bg-[var(--background)] p-3 sm:col-span-2"
          aria-label="Escala de sentimientos"
        >
          <span className="text-xs font-semibold text-[var(--ink)]">
            Una escala, cinco lecturas
          </span>
          <div className="mt-2 grid gap-x-4 gap-y-1.5 sm:grid-cols-2">
            {[
              { score: 12, range: "0–24" },
              { score: 35, range: "25–44" },
              { score: 50, range: "45–55" },
              { score: 65, range: "56–75" },
              { score: 88, range: "76–100" },
            ].map((item) => {
              const state = sentimentState(item.score)
              return (
                <div
                  key={item.range}
                  className="flex items-center gap-1.5 text-xs text-[var(--muted)]"
                >
                  <span
                    className="h-1.5 w-1.5 shrink-0 rounded-full"
                    style={{ backgroundColor: state.color }}
                  />
                  <span>{state.label}</span>
                  <span className="ml-auto tabular-nums">{item.range}</span>
                </div>
              )
            })}
          </div>
        </aside>
      </div>
      <details className="px-4 py-3 text-xs text-[var(--muted)]">
        <summary className="cursor-pointer text-xs font-medium text-[var(--primary)]">
          Cómo interpretar los siete factores
        </summary>
        <p className="mt-3 text-xs leading-relaxed">
          Cada barra muestra la puntuación de 0 a 100 que CNN asigna al factor.
          El índice general es el promedio de esos siete componentes, calculado
          por CNN.
        </p>
        <dl className="mt-3 grid gap-3 sm:grid-cols-2">
          {sentimentFactors.map((factor) => (
            <div key={factor.id}>
              <dt className="mb-1 text-xs font-semibold text-[var(--ink)]">
                {factor.title}
              </dt>
              <dd className="m-0 text-xs leading-relaxed">
                {factor.explanation}
              </dd>
            </div>
          ))}
        </dl>
      </details>
    </section>
  )
}

export default function SentimentDashboard() {
  const [news, setNews] = useState<MarketNewsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [filter, setFilter] = useState<"all" | HeadlineSentiment>("all")
  const [showAll, setShowAll] = useState(false)
  const request = useRef<AbortController | null>(null)
  const [fearGreed, setFearGreed] = useState<FearGreedData | null>(null)
  const [fearGreedStatus, setFearGreedStatus] =
    useState<FearGreedStatus>("loading")
  const fearGreedRequest = useRef<AbortController | null>(null)
  const refreshFearGreed = useCallback(async () => {
    fearGreedRequest.current?.abort()
    const controller = new AbortController()
    fearGreedRequest.current = controller
    setFearGreedStatus("loading")
    try {
      const response = await fetch("/api/fear-greed", {
        signal: controller.signal,
      })
      const result: FearGreedResponse = await response.json()
      if (!response.ok || result.status !== "available")
        throw new Error("CNN unavailable")
      if (!controller.signal.aborted) {
        setFearGreed(result)
        setFearGreedStatus("live")
      }
    } catch {
      if (!controller.signal.aborted) setFearGreedStatus("unavailable")
    }
  }, [])
  useEffect(() => {
    void refreshFearGreed()
    const interval = window.setInterval(() => {
      if (!document.hidden) void refreshFearGreed()
    }, 300_000)
    return () => {
      window.clearInterval(interval)
      fearGreedRequest.current?.abort()
    }
  }, [refreshFearGreed])
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
      if (
        !Array.isArray(result.articles) ||
        !result.reading ||
        !result.checkedAt
      )
        throw new Error("Invalid response")
      if (!controller.signal.aborted) {
        setNews((previous) =>
          result.status === "unavailable" && previous?.status === "available"
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
  const filtered = (news?.articles ?? []).filter(
    (article) => filter === "all" || article.sentiment === filter,
  )
  const displayed = showAll ? filtered : filtered.slice(0, 6)
  const available = Boolean(news?.articles.length)

  return (
    <div className="sentiment-dashboard text-[var(--ink)]">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] pb-3 min-[861px]:mb-3 min-[861px]:pb-2">
        <div>
          <Heading
            level={1}
            className="inline-page-title text-xl! font-sans! font-semibold! tracking-tight!"
          >
            Sentiment Analysis
          </Heading>
          <p className="mb-0 mt-1.5 flex items-center gap-1.5 text-xs text-[var(--muted)]">
            <span
              className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                error
                  ? "bg-[var(--sentiment-fear)]"
                  : available
                    ? "bg-[var(--sentiment-greed)]"
                    : "bg-[var(--sentiment-neutral)]"
              }`}
            />
            {loading
              ? "Consultando fuentes"
              : error
                ? available
                  ? "Mostrando la última lectura recibida"
                  : "Fuentes no disponibles"
                : "Noticias conectadas · actualización cada 60 s"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {news && (
            <time
              className="hidden text-xs tabular-nums text-[var(--muted)] sm:block"
              dateTime={news.checkedAt}
            >
              {dateFormat.format(new Date(news.checkedAt))}
            </time>
          )}
          <Button
            variant="ghost"
            aria-label="Actualizar índice y noticias"
            className="min-h-8! rounded-md! border border-[var(--line)] bg-[var(--surface)]! px-2.5! text-xs!"
            onClick={() => {
              void refresh()
              void refreshFearGreed()
            }}
            disabled={loading || fearGreedStatus === "loading"}
          >
            <span
              className={
                loading || fearGreedStatus === "loading"
                  ? "animate-spin motion-reduce:animate-none"
                  : ""
              }
            >
              <Icon name="history" size={15} />
            </span>
            {loading || fearGreedStatus === "loading"
              ? "Actualizando"
              : "Actualizar"}
          </Button>
        </div>
      </header>
      <div className="grid items-start gap-3 min-[1180px]:grid-cols-[minmax(0,1.65fr)_minmax(280px,1fr)]">
        <FearGreedGauge data={fearGreed} status={fearGreedStatus} />
        <aside
          className="flex min-w-0 flex-col gap-3 min-[1180px]:col-start-2 min-[1180px]:row-start-1 min-[1180px]:row-span-2"
          aria-label="Lectura y noticias del mercado"
        >
          <section
            className={`${panel} sentiment-reading p-4`}
            aria-live="polite"
          >
            <div className="mb-3 flex items-center justify-between gap-2">
              <SectionTitle>Lectura diaria</SectionTitle>
              <span className="text-xs text-[var(--muted)]">Análisis NLP</span>
            </div>
            {!news && loading ? (
              <div
                role="status"
                className="animate-pulse space-y-2 motion-reduce:animate-none"
              >
                <span className="block h-2 w-full rounded bg-[var(--line)]" />
                <span className="block h-2 w-5/6 rounded bg-[var(--line)]" />
                <span className="block h-2 w-3/4 rounded bg-[var(--line)]" />
                <span className="sr-only">Analizando titulares de mercado</span>
              </div>
            ) : (
              <p className="m-0 text-xs leading-5 text-[var(--ink)]">
                {news?.reading.text ??
                  "No pudimos consultar las fuentes. Actualizá las noticias para generar la lectura diaria."}
              </p>
            )}
            {available && (
              <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-[var(--line)] pt-2.5">
                {(["negative", "neutral", "positive"] as const).map((state) => (
                  <span
                    key={state}
                    className="text-xs tabular-nums text-[var(--muted)]"
                  >
                    <span
                      className={`font-semibold ${
                        state === "negative"
                          ? "text-[var(--sentiment-critical)]"
                          : state === "positive"
                            ? "text-[var(--sentiment-greed)]"
                            : "text-[var(--muted)]"
                      }`}
                    >
                      {news!.reading.counts[state]}
                    </span>{" "}
                    {
                      {
                        positive: "positivos",
                        negative: "negativos",
                        neutral: "neutrales",
                      }[state]
                    }
                  </span>
                ))}
              </div>
            )}
            <details className="mt-2 text-xs leading-relaxed text-[var(--muted)]">
              <summary className="cursor-pointer text-[var(--primary)]">
                Sobre esta lectura
              </summary>
              <p className="mb-0 mt-2">
                Síntesis automática por léxico financiero y temas. No es una
                generación LLM ni una medición oficial de CNN.
              </p>
            </details>
          </section>
          <section className={`${panel} sentiment-news overflow-hidden`}>
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--line)] px-4 py-3">
              <SectionTitle>Noticias del mercado</SectionTitle>
              <Select
                aria-label="Filtrar noticias por sentimiento"
                value={filter}
                onChange={(event) => {
                  setFilter(event.target.value as typeof filter)
                  setShowAll(false)
                }}
                className="w-24! min-h-7! rounded-sm! border-[var(--line)]! px-2! py-1! text-xs!"
              >
                <option value="all">Todos</option>
                <option value="positive">Positivos</option>
                <option value="negative">Negativos</option>
                <option value="neutral">Neutrales</option>
              </Select>
            </div>
            {error && (
              <div
                className="m-3 rounded-sm bg-[var(--orange-soft)] p-3 text-xs leading-relaxed text-[var(--muted)]"
                role="status"
              >
                {available
                  ? "No se pudo actualizar. Los titulares conservan la fecha de la última consulta correcta."
                  : "Las fuentes no respondieron. No se mostrarán titulares inventados."}
              </div>
            )}
            <div className="max-h-104 overflow-y-auto px-4" aria-busy={loading}>
              {displayed.map((article) => (
                <article
                  key={article.id}
                  className="border-b border-[var(--line)] py-3 last:border-b-0"
                >
                  <div className="mb-1.5 flex items-center justify-between gap-2">
                    <span className="min-w-0 truncate text-xs font-semibold text-[var(--ink)]">
                      {article.source}
                    </span>
                    <time
                      className="shrink-0 text-xs tabular-nums text-[var(--muted)]"
                      dateTime={article.publishedAt ?? undefined}
                    >
                      {article.publishedAt
                        ? dateFormat.format(new Date(article.publishedAt))
                        : "Sin fecha"}
                    </time>
                  </div>
                  <Link
                    href={article.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block text-sm leading-5 text-[var(--ink)] no-underline underline-offset-2 transition-colors hover:text-[var(--primary)] hover:underline"
                  >
                    {article.title}
                  </Link>
                  <span
                    className={`mt-2 inline-block rounded-sm px-1.5 py-0.5 text-xs ${newsStates[article.sentiment].className}`}
                  >
                    {newsStates[article.sentiment].label}
                  </span>
                </article>
              ))}
              {!displayed.length && (
                <div className="py-10 text-center text-xs leading-6 text-[var(--muted)]">
                  {loading
                    ? "Cargando titulares…"
                    : available
                      ? "No hay noticias con este sentimiento."
                      : "Sin noticias disponibles."}
                </div>
              )}
            </div>
            {filtered.length > 6 && (
              <Button
                variant="ghost"
                className="min-h-9! w-full rounded-none! border-t border-[var(--line)] text-xs!"
                onClick={() => setShowAll(!showAll)}
              >
                {showAll
                  ? "Ver menos titulares"
                  : `Ver los ${filtered.length} titulares`}
                <Icon name="arrow" size={14} />
              </Button>
            )}
            <p className="m-0 border-t border-[var(--line)] px-4 py-2.5 text-xs leading-relaxed text-[var(--muted)]">
              Titulares originales · sentimiento inferido por NLP
            </p>
          </section>
        </aside>
        <div className="min-w-0 min-[1180px]:col-start-1 min-[1180px]:row-start-2">
          <FactorCards data={fearGreed} />
        </div>
      </div>
      <footer className="mt-4 border-t border-[var(--line)] pt-3 text-xs leading-relaxed text-[var(--muted)]">
        <span>
          Índice y factores: CNN Fear &amp; Greed Index. Noticias de fuentes
          públicas. No constituye asesoramiento de inversión.
        </span>
      </footer>
    </div>
  )
}
