"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type {
  EconomicCalendarAvailable,
  EconomicCalendarResponse,
  EconomicEvent,
  EconomicImpact,
} from "@/lib/economic-calendar"
import { describeMacroEvent } from "@/lib/macro-impact"

const TIME_ZONE = "America/Lima"
const REFRESH_MS = 10 * 60_000
const MAX_EVENTS = 8

const dayKeyFormat = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
})
const weekdayFormat = new Intl.DateTimeFormat("es-PE", {
  timeZone: TIME_ZONE,
  weekday: "short",
})
const dayNumberFormat = new Intl.DateTimeFormat("es-PE", {
  timeZone: TIME_ZONE,
  day: "numeric",
})
const monthFormat = new Intl.DateTimeFormat("es-PE", {
  timeZone: TIME_ZONE,
  month: "short",
})
const hourFormat = new Intl.DateTimeFormat("es-PE", {
  timeZone: TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
})
const updatedFormat = new Intl.DateTimeFormat("es-PE", {
  timeZone: TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
})

const impactStyle: Record<
  EconomicImpact,
  { label: string; className: string; dot: string }
> = {
  high: {
    label: "Impacto alto",
    className:
      "bg-[color-mix(in_srgb,var(--sentiment-critical)_12%,transparent)] text-[var(--sentiment-critical)]",
    dot: "bg-[var(--sentiment-critical)]",
  },
  medium: {
    label: "Impacto medio",
    className: "bg-[var(--orange-soft)] text-[#a25b00]",
    dot: "bg-[var(--orange)]",
  },
  low: {
    label: "Impacto bajo",
    className: "bg-[var(--background)] text-[var(--muted)]",
    dot: "bg-[var(--muted)]",
  },
  holiday: {
    label: "Festivo",
    className: "bg-[var(--background)] text-[var(--muted)]",
    dot: "bg-[var(--muted)]",
  },
}

function useCalendar() {
  const [data, setData] = useState<EconomicCalendarAvailable | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const request = useRef<AbortController | null>(null)

  const refresh = useCallback(async () => {
    request.current?.abort()
    const controller = new AbortController()
    request.current = controller
    try {
      const response = await fetch("/api/economic-calendar", {
        cache: "no-store",
        signal: controller.signal,
      })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const next = (await response.json()) as EconomicCalendarResponse
      if (controller.signal.aborted) return
      setData((previous) =>
        next.status === "unavailable" ? previous : next,
      )
      setError(false)
    } catch {
      if (!controller.signal.aborted) setError(true)
    } finally {
      if (!controller.signal.aborted) setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
    const timer = setInterval(() => void refresh(), REFRESH_MS)
    return () => {
      clearInterval(timer)
      request.current?.abort()
    }
  }, [refresh])

  return { data, loading, error, refresh }
}

function AssetChip({
  asset,
  onOpen,
}: {
  asset: ReturnType<typeof describeMacroEvent>["assets"][number]
  onOpen?: (tvSymbol: string) => void
}) {
  const content = (
    <>
      {asset.symbol === "BTC" ? (
        <img
          src="/ticker/btc.svg"
          alt=""
          className="size-3.5 shrink-0 rounded-full"
        />
      ) : (
        <span
          aria-hidden="true"
          className="grid size-3.5 shrink-0 place-items-center rounded-full bg-[var(--ink)] text-[7px] font-bold leading-none text-white"
        >
          {asset.symbol.slice(0, 1)}
        </span>
      )}
      <span className="text-[10px] font-semibold tracking-wide">
        {asset.symbol}
      </span>
    </>
  )
  const className =
    "inline-flex items-center gap-1 rounded-full border border-[var(--line)] bg-[var(--background)] px-1.5 py-0.5 text-[var(--ink)] transition-colors"
  if (!onOpen)
    return (
      <span className={className} title={asset.name}>
        {content}
      </span>
    )
  return (
    <button
      type="button"
      title={`Abrir ${asset.symbol} en la Terminal de mercado`}
      aria-label={`Abrir ${asset.name} en la Terminal de mercado`}
      onClick={() => onOpen(asset.tv)}
      className={`${className} hover:border-[var(--bright)] hover:text-[var(--primary)] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--bright)]`}
    >
      {content}
    </button>
  )
}

function EventCard({
  event,
  today,
  onOpenAsset,
}: {
  event: EconomicEvent
  today: string
  onOpenAsset?: (tvSymbol: string) => void
}) {
  const date = new Date(event.date)
  const isToday = dayKeyFormat.format(date) === today
  const reading = describeMacroEvent(event)
  const impact = impactStyle[event.impact]
  const released = Boolean(event.actual)
  const values = [
    event.actual ? `Actual ${event.actual}` : null,
    event.forecast ? `Prev. ${event.forecast}` : null,
    event.previous ? `Anterior ${event.previous}` : null,
  ].filter(Boolean)

  return (
    <article className="flex gap-2.5 border-b border-[var(--line)] py-3.5 first:pt-1 last:border-b-0">
      <div className="w-9 shrink-0 text-center">
        <span className="block text-[9px] font-medium uppercase tracking-wide text-[var(--muted)]">
          {weekdayFormat.format(date).replace(/\.$/, "")}
        </span>
        <strong className="block text-base font-semibold leading-tight text-[var(--ink)] tabular-nums">
          {dayNumberFormat.format(date)}
        </strong>
        <span className="block text-[9px] uppercase tracking-wide text-[var(--muted)]">
          {monthFormat.format(date).replace(/\.$/, "")}
        </span>
        {isToday && (
          <span className="mt-1 inline-block rounded-full bg-[var(--ink)] px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-wide text-white">
            Hoy
          </span>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
          <span
            className={`rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${impact.className}`}
          >
            {impact.label}
          </span>
          <span className="text-[10px] font-semibold tabular-nums text-[var(--ink)]">
            {hourFormat.format(date)}
          </span>
          <span className="flex items-center gap-1 text-[10px] text-[var(--muted)]">
            <span className={`size-1.5 rounded-full ${impact.dot}`} />
            {reading.category} · {reading.country}
          </span>
          <span
            className={`ml-auto flex items-center gap-1 text-[9px] ${
              released
                ? "text-[var(--sentiment-greed)]"
                : "text-[var(--muted)]"
            }`}
          >
            <span
              aria-hidden="true"
              className={`size-1.5 rounded-full ${
                released
                  ? "bg-[var(--sentiment-greed)]"
                  : "bg-[var(--muted)]"
              }`}
            />
            {released ? "Publicado" : "Programado"}
          </span>
        </div>

        <h3 className="mb-0 mt-1 text-[12.5px] font-semibold leading-snug text-[var(--ink)]">
          {reading.title}
        </h3>
        <p className="mb-0 mt-1 text-[10.5px] leading-relaxed text-[var(--muted)]">
          {reading.description}
        </p>

        <div className="mt-2 flex flex-wrap gap-1">
          {reading.assets.map((asset) => (
            <AssetChip key={asset.symbol} asset={asset} onOpen={onOpenAsset} />
          ))}
        </div>

        <p className="mb-0 mt-2 border-l-2 border-[var(--line)] pl-2 text-[10px] leading-relaxed text-[var(--muted)]">
          <strong className="font-semibold text-[var(--ink)]">
            {reading.scenario.label}:
          </strong>{" "}
          {reading.scenario.text}
        </p>

        {values.length > 0 && (
          <p className="mb-0 mt-1 text-[9.5px] tabular-nums text-[var(--muted)]">
            {values.join(" · ")}
          </p>
        )}
      </div>
    </article>
  )
}

export default function MacroAgenda({
  onOpenAsset,
}: {
  onOpenAsset?: (tvSymbol: string) => void
}) {
  const { data, loading, error, refresh } = useCalendar()
  const today = dayKeyFormat.format(new Date())

  const events = useMemo(() => {
    if (!data) return []
    return data.events
      .filter(
        (event) =>
          event.currency === "USD" &&
          (event.impact === "high" || event.impact === "medium") &&
          dayKeyFormat.format(new Date(event.date)) >= today,
      )
      .sort((a, b) => Date.parse(a.date) - Date.parse(b.date))
      .slice(0, MAX_EVENTS)
  }, [data, today])

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div
        className="flex items-center justify-between gap-2 border-b border-[var(--line)] px-4 py-2 text-[10px] text-[var(--muted)]"
        role="status"
      >
        <span className="flex items-center gap-1.5">
          <span
            className={`size-1.5 shrink-0 rounded-full ${
              error
                ? "bg-[var(--orange)]"
                : data
                  ? "bg-[var(--sentiment-greed)]"
                  : "bg-[var(--muted)]"
            }`}
          />
          {loading && !data
            ? "Consultando Forex Factory"
            : error
              ? "No se pudo actualizar"
              : "Solo EE.UU. · impacto alto y medio"}
        </span>
        {data && (
          <span className="tabular-nums">
            {updatedFormat.format(new Date(data.fetchedAt))}
          </span>
        )}
      </div>

      <div className="max-h-144 min-h-0 flex-1 overflow-y-auto px-4 min-[1180px]:max-h-none">
        {error && !data && (
          <p className="mb-0 mt-3 rounded-md bg-[var(--orange-soft)] p-2.5 text-xs leading-relaxed text-[var(--muted)]">
            No se pudo consultar el calendario. Podés reintentar.
          </p>
        )}
        {loading && !data ? (
          <div className="space-y-4 py-4" aria-busy="true">
            {[0, 1, 2].map((item) => (
              <div key={item} className="space-y-2 motion-safe:animate-pulse">
                <div className="h-2 w-1/4 rounded bg-[var(--line)]" />
                <div className="h-2.5 w-full rounded bg-[var(--line)]" />
                <div className="h-2.5 w-2/3 rounded bg-[var(--line)]" />
              </div>
            ))}
          </div>
        ) : events.length ? (
          events.map((event) => (
            <EventCard
              key={event.id}
              event={event}
              today={today}
              onOpenAsset={onOpenAsset}
            />
          ))
        ) : (
          <p className="mb-0 mt-4 text-xs leading-relaxed text-[var(--muted)]">
            {data
              ? "No quedan eventos de EE.UU. con impacto alto o medio en esta semana."
              : "El calendario no está disponible en este momento."}
          </p>
        )}
      </div>

      <div className="mt-auto flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t border-[var(--line)] px-4 py-2 text-[10px] text-[var(--muted)]">
        <span>
          Fuente:{" "}
          <a
            href="https://www.forexfactory.com/calendar"
            target="_blank"
            rel="noreferrer"
            className="text-[var(--primary)] hover:underline"
          >
            Forex Factory
          </a>{" "}
          · horas America/Lima
        </span>
        <button
          type="button"
          onClick={() => void refresh()}
          disabled={loading}
          className="rounded-sm border border-[var(--line)] px-2 py-0.5 font-medium text-[var(--ink)] transition-colors hover:border-[var(--bright)] hover:text-[var(--bright)] disabled:cursor-wait disabled:opacity-50"
        >
          Actualizar
        </button>
      </div>
    </div>
  )
}
