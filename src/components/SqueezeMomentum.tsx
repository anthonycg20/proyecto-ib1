"use client"

import { useEffect, useRef } from "react"
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

const VISIBLE_BARS = 180

const stateLabels: Record<string, string> = {
  on: "Squeeze comprimido",
  off: "Squeeze disparado",
  none: "Sin compresión",
}

function formatValue(value: number | undefined) {
  if (value === undefined) return "—"
  const digits = Math.abs(value) < 0.01 ? 5 : Math.abs(value) < 1 ? 4 : 2
  return new Intl.NumberFormat("es-AR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value)
}

export default function SqueezeMomentum({
  points,
  state,
  loading,
  error,
  notice,
}: {
  points: SqueezePoint[]
  state: "on" | "off" | "none" | null
  loading: boolean
  error: boolean
  notice: string | null
}) {
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const last = points.at(-1)

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

      const visible = points.slice(-VISIBLE_BARS)
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

      context.strokeStyle = "rgba(255, 255, 255, 0.08)"
      context.lineWidth = 1
      context.beginPath()
      context.moveTo(padLeft, Math.round(zeroY) + 0.5)
      context.lineTo(width - padRight, Math.round(zeroY) + 0.5)
      context.stroke()

      const barWidth = Math.max(1, Math.min(5, slot * 0.66))
      for (let index = 0; index < visible.length; index++) {
        const point = visible[index]
        const x = padLeft + slot * index + slot / 2
        const bottom = toY(point.value)
        const top = Math.min(bottom, zeroY)
        const barHeight = Math.max(1, Math.abs(bottom - zeroY))
        context.fillStyle = BAR_COLORS[point.barColor]
        context.fillRect(x - barWidth / 2, top, barWidth, barHeight)
      }

      const half = Math.min(2.4, Math.max(1.2, slot * 0.35))
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
  }, [points])

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

      <div
        ref={wrapRef}
        className="relative h-[132px] w-full"
        role="img"
        aria-label={`Squeeze Momentum: ${notice ?? (state ? stateLabels[state] : "sin datos")}, último valor ${formatValue(last?.value)}`}
      >
        <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
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
