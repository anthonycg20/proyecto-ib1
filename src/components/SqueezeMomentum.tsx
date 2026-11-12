"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import type { PointerEvent } from "react"
import type { SqueezePoint } from "@/lib/squeeze"

const BAR_COLORS: Record<SqueezePoint["barColor"], string> = {
  lime: "#00ff00",
  green: "#008000",
  red: "#ff0000",
  maroon: "#800000",
}

const CROSS_COLORS: Record<SqueezePoint["crossColor"], string> = {
  blue: "#2962ff",
  black: "#0b0e14",
  gray: "#9aa4b2",
}

const RANGE_OPTIONS = [60, 120, 180, 300] as const
const DEFAULT_BARS = 180

const stateLabels: Record<string, string> = {
  on: "Squeeze comprimido",
  off: "Squeeze disparado",
  none: "Sin compresión",
}

const clockFormat = new Intl.DateTimeFormat("es-AR", {
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZone: "UTC",
})
const dayFormat = new Intl.DateTimeFormat("es-AR", {
  day: "2-digit",
  month: "short",
  timeZone: "UTC",
})
const stampFormat = new Intl.DateTimeFormat("es-AR", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZone: "UTC",
})

function formatValue(value: number | undefined) {
  if (value === undefined) return "—"
  const digits = Math.abs(value) < 0.01 ? 5 : Math.abs(value) < 1 ? 4 : 2
  return new Intl.NumberFormat("es-AR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value)
}

// Daily series are labelled by date; intraday ones by UTC clock time, which is
// the timezone the TradingView chart above is configured with. Windows that
// cross midnight also show the date to avoid ambiguity.
function formatWindow(points: SqueezePoint[]) {
  if (!points.length) return ""
  const step =
    points.length > 1 ? points.at(-1)!.time - points.at(-2)!.time : 0
  const first = new Date(points[0].time * 1000)
  const last = new Date(points.at(-1)!.time * 1000)
  if (step >= 86_400)
    return `${dayFormat.format(first)} – ${dayFormat.format(last)}`
  const sameDay = first.toISOString().slice(0, 10) === last.toISOString().slice(0, 10)
  if (!sameDay)
    return `${stampFormat.format(first)} – ${stampFormat.format(last)} UTC`
  return `${clockFormat.format(first)}–${clockFormat.format(last)} UTC`
}

export default function SqueezeMomentum({
  points,
  state,
  loading,
  error,
  notice,
  resetKey,
}: {
  points: SqueezePoint[]
  state: "on" | "off" | "none" | null
  loading: boolean
  error: boolean
  notice: string | null
  /** Symbol + interval; resets the window to the latest candles when it changes. */
  resetKey?: string
}) {
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const slotRef = useRef(1)
  const dragRef = useRef<{ x: number; offset: number } | null>(null)
  const [bars, setBars] = useState<number | "all">(DEFAULT_BARS)
  const [offset, setOffset] = useState(0)

  const total = points.length
  const effective = bars === "all" ? total : Math.min(bars, total)
  const maxOffset = Math.max(0, total - effective)
  const safeOffset = Math.min(offset, maxOffset)
  const end = total - safeOffset
  const start = Math.max(0, end - effective)
  const visible = useMemo(
    () => points.slice(start, end),
    [points, start, end],
  )
  const last = points.at(-1)
  const rangeLabel = formatWindow(visible)
  const page = Math.max(1, Math.round(effective / 6))

  useEffect(() => {
    setOffset(0)
  }, [resetKey])

  useEffect(() => {
    if (offset > maxOffset) setOffset(maxOffset)
  }, [offset, maxOffset])

  useEffect(() => {
    const wrap = wrapRef.current
    const canvas = canvasRef.current
    if (!wrap || !canvas) return

    const draw = () => {
      const width = wrap.clientWidth
      const height = wrap.clientHeight
      if (!width || !height) return
      const ratio = window.devicePixelRatio || 1
      canvas.width = Math.round(width * ratio)
      canvas.height = Math.round(height * ratio)
      const context = canvas.getContext("2d")
      if (!context) return
      context.setTransform(ratio, 0, 0, ratio, 0, 0)
      context.clearRect(0, 0, width, height)

      if (!visible.length) return

      const padLeft = 8
      const padRight = 44
      const padTop = 12
      const padBottom = 12
      const plotWidth = width - padLeft - padRight
      const plotHeight = height - padTop - padBottom
      if (plotWidth <= 0 || plotHeight <= 0) return

      let max = 0
      let min = 0
      for (const point of visible) {
        if (point.value > max) max = point.value
        if (point.value < min) min = point.value
      }
      if (max === min) {
        max += 1
        min -= 1
      }
      const span = max - min
      const toY = (value: number) => padTop + ((max - value) / span) * plotHeight
      const zeroY = toY(0)
      const slot = plotWidth / visible.length
      slotRef.current = slot

      context.strokeStyle = "rgba(255, 255, 255, 0.08)"
      context.lineWidth = 1
      context.beginPath()
      context.moveTo(padLeft, Math.round(zeroY) + 0.5)
      context.lineTo(width - padRight, Math.round(zeroY) + 0.5)
      context.stroke()

      const barWidth = Math.max(1, Math.min(10, slot * 0.7))
      for (let index = 0; index < visible.length; index++) {
        const point = visible[index]
        const x = padLeft + slot * index + slot / 2
        const bottom = toY(point.value)
        const top = Math.min(bottom, zeroY)
        const barHeight = Math.max(1, Math.abs(bottom - zeroY))
        context.fillStyle = BAR_COLORS[point.barColor]
        context.fillRect(x - barWidth / 2, top, barWidth, barHeight)
      }

      const half = Math.min(3, Math.max(1.2, slot * 0.35))
      for (let index = 0; index < visible.length; index++) {
        const point = visible[index]
        const x = padLeft + slot * index + slot / 2
        const drawCross = () => {
          context.beginPath()
          context.moveTo(x - half, zeroY)
          context.lineTo(x + half, zeroY)
          context.moveTo(x, zeroY - half)
          context.lineTo(x, zeroY + half)
          context.stroke()
        }
        if (point.crossColor === "black") {
          // The script plots black over a dark pane; keep it visible with a halo.
          context.strokeStyle = "rgba(255, 255, 255, 0.4)"
          context.lineWidth = 2.4
          drawCross()
        }
        context.strokeStyle = CROSS_COLORS[point.crossColor]
        context.lineWidth = 1.2
        drawCross()
      }

      context.fillStyle = "#5d6677"
      context.font = "9px ui-sans-serif, system-ui, sans-serif"
      context.textAlign = "left"
      context.fillText(formatValue(max), width - padRight + 6, padTop + 3)
      context.fillText(formatValue(min), width - padRight + 6, height - padBottom + 2)
    }

    draw()
    const observer = new ResizeObserver(draw)
    observer.observe(wrap)
    return () => observer.disconnect()
  }, [visible])

  const badge = notice
    ? "bg-white/8 text-[#9aa4b2]"
    : state === "on"
      ? "bg-[#ffb74d]/15 text-[#ffb74d]"
      : state === "off"
        ? last && last.value >= 0
          ? "bg-[#089981]/15 text-[#26a69a]"
          : "bg-[#f23645]/15 text-[#f23645]"
        : "bg-white/8 text-[#9aa4b2]"
  const badgeLabel = notice
    ? "Sin datos"
    : state
      ? stateLabels[state]
      : "Calculando"

  const presetClass = (active: boolean) =>
    `rounded px-1.5 py-0.5 text-[9px] font-medium tabular-nums transition-colors ${
      active
        ? "bg-[#2a2e39] text-white"
        : "text-[#848e9c] hover:bg-[#2a2e39] hover:text-white"
    }`
  const pagerClass =
    "grid size-5 place-items-center rounded text-[11px] leading-none text-[#848e9c] transition-colors hover:bg-[#2a2e39] hover:text-white disabled:cursor-default disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-[#848e9c]"

  const onPointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (event.button !== 0 || maxOffset === 0) return
    dragRef.current = { x: event.clientX, offset: safeOffset }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const onPointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const drag = dragRef.current
    if (!drag) return
    const delta = Math.round(
      (event.clientX - drag.x) / Math.max(1, slotRef.current),
    )
    setOffset(Math.min(maxOffset, Math.max(0, drag.offset + delta)))
  }

  const endDrag = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!dragRef.current) return
    dragRef.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId)
  }

  return (
    <div className="border-t border-[#2a2e39] bg-[#131722]">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 bg-[#1e222d] px-2.5 py-2">
        <div className="flex min-w-0 items-baseline gap-2">
          <span className="text-[11px] font-semibold text-white">
            Squeeze Momentum
          </span>
          <span className="truncate text-[9px] text-[#5d6677]">
            [LazyBear] · 20 · 2.0 · 1.5 · TR
          </span>
        </div>
        <div className="flex items-center gap-2">
          {loading && points.length > 0 && (
            <span className="text-[9px] text-[#5d6677]">actualizando…</span>
          )}
          <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${badge}`}>
            {badgeLabel}
          </span>
          <span className="text-[11px] tabular-nums text-[#d1d4dc]">
            {formatValue(last?.value)}
          </span>
        </div>
      </div>

      {points.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t border-[#2a2e39] px-2.5 py-1">
          <div
            className="flex items-center gap-0.5"
            role="group"
            aria-label="Velas visibles en el Squeeze"
          >
            <span className="mr-1 text-[8px] font-semibold uppercase tracking-[0.12em] text-[#5d6677]">
              Ventana
            </span>
            {RANGE_OPTIONS.map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={bars === value}
                onClick={() => {
                  setBars(value)
                  setOffset(0)
                }}
                className={presetClass(bars === value)}
              >
                {value}
              </button>
            ))}
            <button
              type="button"
              aria-pressed={bars === "all"}
              onClick={() => {
                setBars("all")
                setOffset(0)
              }}
              className={presetClass(bars === "all")}
            >
              Todo
            </button>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              aria-label="Ver velas más antiguas"
              title="Ver velas más antiguas"
              disabled={safeOffset >= maxOffset}
              onClick={() =>
                setOffset(Math.min(maxOffset, safeOffset + page))
              }
              className={pagerClass}
            >
              ←
            </button>
            <button
              type="button"
              aria-label="Ver velas más recientes"
              title="Ver velas más recientes"
              disabled={safeOffset === 0}
              onClick={() => setOffset(Math.max(0, safeOffset - page))}
              className={pagerClass}
            >
              →
            </button>
            <span className="min-w-[90px] text-right text-[9px] tabular-nums text-[#5d6677]">
              {rangeLabel}
            </span>
          </div>
        </div>
      )}

      <div
        ref={wrapRef}
        className="relative h-[132px] w-full"
        role="img"
        aria-label={`Squeeze Momentum: ${notice ?? (state ? stateLabels[state] : "sin datos")}, último valor ${formatValue(last?.value)}${rangeLabel ? `, ventana de ${visible.length} velas (${rangeLabel})` : ""}`}
      >
        <canvas
          ref={canvasRef}
          className={`absolute inset-0 h-full w-full ${
            maxOffset > 0 ? "cursor-grab active:cursor-grabbing" : ""
          }`}
          style={{ touchAction: "pan-y" }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onLostPointerCapture={endDrag}
          onDoubleClick={() => setOffset(0)}
        />
        {points.length === 0 && (
          <div className="absolute inset-0 grid place-items-center px-4 text-center text-[11px] text-[#848e9c]">
            {notice
              ? notice
              : error
                ? "No se pudieron cargar las velas para el Squeeze."
                : "Calculando Squeeze Momentum…"}
          </div>
        )}
      </div>
    </div>
  )
}
