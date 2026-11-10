"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type {
  EconomicCalendarAvailable,
  EconomicCalendarResponse,
  EconomicEvent,
  EconomicImpact,
} from "@/lib/economic-calendar"
import { Heading, Select } from "./ui"

const panel =
  "min-w-0 overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--surface)]"
const TIME_ZONE = "America/Lima"
const REFRESH_MS = 10 * 60_000

const dayKeyFormat = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
})
const hourFormat = new Intl.DateTimeFormat("es-PE", {
  timeZone: TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
})
const dayLabelFormat = new Intl.DateTimeFormat("es-PE", {
  timeZone: TIME_ZONE,
  weekday: "short",
  day: "numeric",
  month: "short",
})
const rangeFormat = new Intl.DateTimeFormat("es-PE", {
  timeZone: "UTC",
  day: "numeric",
  month: "short",
})
const updatedFormat = new Intl.DateTimeFormat("es-PE", {
  timeZone: TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
})

const impactMeta: Record<
  EconomicImpact,
  { label: string; bars: number; bar: string }
> = {
  high: {
    label: "Alto",
    bars: 3,
    bar: "bg-[#f5122f]",
  },
  medium: {
    label: "Medio",
    bars: 2,
    bar: "bg-[#ff8a00]",
  },
  low: {
    label: "Bajo",
    bars: 1,
    bar: "bg-[#ffc400]",
  },
  holiday: {
    label: "Festivo",
    bars: 0,
    bar: "bg-[#94a3b8]",
  },
}

const flagCodes: Record<string, string> = {
  AUD: "au",
  CAD: "ca",
  CHF: "ch",
  CNY: "cn",
  EUR: "eu",
  GBP: "gb",
  JPY: "jp",
  NZD: "nz",
  USD: "us",
}

const impactFilters: Array<{ value: "all" | EconomicImpact; label: string }> = [
  { value: "all", label: "Todos" },
  { value: "high", label: "Alto" },
  { value: "medium", label: "Medio" },
  { value: "low", label: "Bajo" },
  { value: "holiday", label: "Festivo" },
]

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

const dayLabel = (iso: string) =>
  capitalize(
    dayLabelFormat
      .format(new Date(iso))
      .replace(/^(\w+),\s*/, "$1 ")
      .replace(/\.$/, ""),
  )

const rangeLabel = (from: string, to: string) => {
  const start = rangeFormat.format(new Date(`${from}T12:00:00Z`)).replace(/\.$/, "")
  const end = rangeFormat.format(new Date(`${to}T12:00:00Z`)).replace(/\.$/, "")
  const year = to.slice(0, 4)
  return start === end ? `${start} ${year}` : `${start} – ${end} ${year}`
}

const value = (text: string | null) => (text && text.trim() ? text : "—")

// Circular flag per currency; falls back to the code when there is no country.
function CurrencyFlag({ currency }: { currency: string }) {
  const [failed, setFailed] = useState(false)
  const code = flagCodes[currency]
  if (!code || failed) {
    return (
      <span
        className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-[var(--background)] text-[8px] font-semibold text-[var(--muted)] ring-1 ring-[var(--line)]"
        title={currency}
      >
        {currency.slice(0, 2)}
      </span>
    )
  }
  return (
    <img
      src={`https://flagcdn.com/w40/${code}.png`}
      alt={currency}
      title={currency}
      width={20}
      height={20}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className="h-4 w-4 rounded-full object-cover ring-1 ring-black/10"
    />
  )
}

// Three ascending bars: one for low, two for medium, three for high.
function ImpactBars({ impact }: { impact: EconomicImpact }) {
  const meta = impactMeta[impact]
  if (impact === "holiday") {
    return (
      <span
        role="img"
        aria-label={`Impacto ${meta.label}`}
        title={meta.label}
        className="inline-flex h-3 items-center text-[var(--sentiment-neutral)]"
      >
        <span className="h-2.5 w-2.5 rounded-[2px] border border-current" />
      </span>
    )
  }
  return (
    <span
      role="img"
      aria-label={`Impacto ${meta.label}`}
      title={meta.label}
      className="inline-flex items-end gap-[3px]"
    >
      {[7, 10, 13].map((height, index) => (
        <span
          key={height}
          className={`w-1 rounded-[1px] ${
            index < meta.bars ? meta.bar : "bg-[#e2e8f1]"
          }`}
          style={{ height }}
        />
      ))}
    </span>
  )
}


function useEconomicCalendar() {
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
      // Keep the last good copy when a refresh degrades.
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

export default function EconomicCalendar() {
  const { data, loading, error, refresh } = useEconomicCalendar()
  const [impact, setImpact] = useState<"all" | EconomicImpact>("all")
  const [currency, setCurrency] = useState("all")

  const currencies = useMemo(() => {
    if (!data) return []
    return [...new Set(data.events.map((event) => event.currency))].sort()
  }, [data])

  const groups = useMemo(() => {
    if (!data) return []
    const filtered = data.events.filter(
      (event) =>
        (impact === "all" || event.impact === impact) &&
        (currency === "all" || event.currency === currency),
    )
    const byDay = new Map<string, EconomicEvent[]>()
    for (const event of filtered) {
      const key = dayKeyFormat.format(new Date(event.date))
      const list = byDay.get(key)
      if (list) list.push(event)
      else byDay.set(key, [event])
    }
    return [...byDay.entries()].map(([key, events]) => ({ key, events }))
  }, [data, impact, currency])

  const today = dayKeyFormat.format(new Date())
  const total = groups.reduce((sum, group) => sum + group.events.length, 0)
  const released = data?.events.filter((event) => event.actual).length ?? 0

  return (
    <section
      className={`${panel} flex flex-col`}
      aria-label="Calendario económico"
    >
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 border-b border-[var(--line)] px-3 py-2">
        <div className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-0.5">
          <div className="flex items-center gap-1.5">
            <span className="h-3 w-0.5 shrink-0 rounded-full bg-[var(--bright)]" />
            <Heading
              level={2}
              className="font-sans! text-[13px]! font-semibold! tracking-tight!"
            >
              Calendario económico
            </Heading>
          </div>
          {data && (
            <span className="text-[11px] text-[var(--muted)]">
              {rangeLabel(data.weekStart, data.weekEnd)}
            </span>
          )}
          <span
            className="flex items-center gap-1.5 text-[11px] text-[var(--muted)]"
            role="status"
          >
            <span
              className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                loading && !data
                  ? "bg-[var(--muted)]"
                  : error
                    ? "bg-[var(--orange)]"
                    : "bg-[var(--sentiment-greed)]"
              }`}
            />
            {loading && !data
              ? "Consultando Forex Factory"
              : error
                ? "No se pudo actualizar"
                : data?.actualsAvailable
                  ? `${released} de ${data.events.length} con dato publicado`
                  : "Datos publicados no disponibles"}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div
            className="flex items-center gap-0.5 rounded-md border border-[var(--line)] bg-[var(--background)] p-0.5"
            role="group"
            aria-label="Filtrar por impacto"
          >
            {impactFilters.map((option) => {
              const active = impact === option.value
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setImpact(option.value)}
                  aria-pressed={active}
                  className={`rounded-[5px] px-1.5 py-[2px] text-[10px] font-medium transition-colors ${
                    active
                      ? "bg-[var(--surface)] text-[var(--ink)] shadow-[0_1px_2px_rgba(16,42,86,0.12)]"
                      : "text-[var(--muted)] hover:text-[var(--ink)]"
                  }`}
                >
                  {option.label}
                </button>
              )
            })}
          </div>
          <Select
            aria-label="Filtrar por divisa"
            value={currency}
            onChange={(event) => setCurrency(event.target.value)}
            className="min-h-6! w-26! rounded-sm! border-[var(--line)]! px-1.5! py-0.5! text-[10px]!"
          >
            <option value="all">Todas las divisas</option>
            {currencies.map((code) => (
              <option key={code} value={code}>
                {code}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {error && (
        <div
          className="mx-4 mt-3 rounded-sm bg-[var(--orange-soft)] px-3 py-2 text-xs leading-relaxed text-[var(--muted)]"
          role="status"
        >
          {data
            ? "No se pudo actualizar. Se muestra la última consulta correcta."
            : "Forex Factory no respondió. El calendario volverá a intentarlo en unos minutos."}
        </div>
      )}

      {!data && loading ? (
        <div className="space-y-2 px-4 py-4" aria-busy="true">
          {Array.from({ length: 8 }, (_, index) => (
            <div
              key={index}
              className="h-6 animate-pulse rounded-sm bg-[var(--background)]"
            />
          ))}
        </div>
      ) : !data ? (
        <div className="flex flex-col items-start gap-3 px-4 py-6">
          <p className="m-0 text-sm text-[var(--muted)]">
            El calendario no está disponible en este momento.
          </p>
          <button
            type="button"
            onClick={() => void refresh()}
            className="rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 py-1.5 text-xs font-medium text-[var(--ink)] transition-colors hover:border-[var(--bright)] hover:text-[var(--bright)]"
          >
            Reintentar
          </button>
        </div>
      ) : groups.length === 0 ? (
        <p className="m-0 px-4 py-6 text-sm text-[var(--muted)]">
          No hay eventos que coincidan con los filtros elegidos.
        </p>
      ) : (
        <>
          <p className="m-0 border-b border-[var(--line)] bg-[var(--background)] px-3 py-1 text-[10px] text-[var(--muted)] sm:hidden">
            Deslizá la tabla para ver Actual, Previsión y Anterior.
          </p>
          <div className="max-h-104 min-h-0 flex-1 overflow-auto min-[1180px]:max-h-none">
            <table className="w-full min-w-[520px] border-collapse text-left text-[11px]">
            <thead className="sticky top-0 z-10 bg-[var(--surface)]">
              <tr className="border-b border-[var(--line)] text-[10px]! uppercase tracking-wide text-[var(--muted)]">
                <th scope="col" className="py-1.5! pl-3! pr-1.5! font-medium">
                  Fecha
                </th>
                <th scope="col" className="px-1.5! py-1.5! text-left! font-medium">
                  Hora
                </th>
                <th scope="col" className="px-1.5! py-1.5! text-left! font-medium">
                  Divisa
                </th>
                <th scope="col" className="px-1.5! py-1.5! text-left! font-medium">
                  Impacto
                </th>
                <th scope="col" className="px-1.5! py-1.5! text-left! font-medium">
                  Evento
                </th>
                <th scope="col" className="px-1.5! py-1.5! text-right font-medium">
                  Actual
                </th>
                <th scope="col" className="px-1.5! py-1.5! text-right font-medium">
                  Previsión
                </th>
                <th scope="col" className="py-1.5! pl-1.5! pr-3! text-right font-medium">
                  Anterior
                </th>
              </tr>
            </thead>
            <tbody>
              {groups.map((group, groupIndex) => {
                const isToday = group.key === today
                return group.events.map((event, index) => {
                  const shade =
                    groupIndex % 2 === 1 ? "bg-[var(--background)]" : ""
                  return (
                    <tr
                      key={event.id}
                      className={`border-b border-[var(--line)] last:border-0 ${shade}`}
                    >
                      {index === 0 && (
                        <th
                          scope="rowgroup"
                          rowSpan={group.events.length}
                          className="w-[4.5rem] border-r border-[var(--line)] bg-transparent! py-1! pl-3! pr-1.5! text-left! align-top text-[11px]! font-medium! normal-case!"
                        >
                          <span
                            className={`whitespace-nowrap ${
                              isToday
                                ? "text-[var(--bright)]"
                                : "text-[var(--ink)]"
                            }`}
                          >
                            {dayLabel(event.date)}
                          </span>
                          {isToday && (
                            <span className="mt-0.5 block text-[9px] font-normal uppercase tracking-wide text-[var(--bright)]">
                              Hoy
                            </span>
                          )}
                        </th>
                      )}
                      <td className="whitespace-nowrap px-1.5! py-1! text-[var(--muted)] tabular-nums">
                        {hourFormat.format(new Date(event.date))}
                      </td>
                      <td className="px-1.5! py-1! text-left!">
                        <CurrencyFlag currency={event.currency} />
                      </td>
                      <td className="whitespace-nowrap px-1.5! py-1! text-left!">
                        <ImpactBars impact={event.impact} />
                      </td>
                      <td className="px-1.5! py-1! text-left! text-[var(--ink)]">
                        {event.title}
                      </td>
                      <td
                        className={`whitespace-nowrap px-1.5! py-1! text-right tabular-nums ${
                          event.actual
                            ? "font-semibold text-[var(--ink)]"
                            : "text-[var(--muted)]"
                        }`}
                      >
                        {value(event.actual)}
                      </td>
                      <td className="whitespace-nowrap px-1.5! py-1! text-right tabular-nums text-[var(--muted)]">
                        {value(event.forecast)}
                      </td>
                      <td className="whitespace-nowrap py-1! pl-1.5! pr-3! text-right tabular-nums text-[var(--muted)]">
                        {value(event.previous)}
                      </td>
                    </tr>
                  )
                })
              })}
            </tbody>
          </table>
          </div>
        </>
      )}

      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t border-[var(--line)] px-3 py-1.5 text-[10px] text-[var(--muted)]">
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
          · horas en America/Lima (UTC−5)
        </span>
        <span className="flex items-center gap-2">
          {data && (
            <span>
              {total} {total === 1 ? "evento" : "eventos"}
              {data && ` · actualizado ${updatedFormat.format(new Date(data.fetchedAt))}`}
            </span>
          )}
          <button
            type="button"
            onClick={() => void refresh()}
            className="rounded-sm border border-[var(--line)] px-2 py-0.5 font-medium text-[var(--ink)] transition-colors hover:border-[var(--bright)] hover:text-[var(--bright)]"
          >
            Actualizar
          </button>
        </span>
      </div>
    </section>
  )
}
