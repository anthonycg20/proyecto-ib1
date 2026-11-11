import type { Candle } from "./market-data"

// Faithful port of "Squeeze Momentum Indicator [LazyBear]" (Pine), including
// its quirk: the Bollinger deviation uses multKC (1.5) instead of mult (2.0).
// Changing that would alter when the squeeze is considered active.

export type SqueezeBarColor = "lime" | "green" | "red" | "maroon"
export type SqueezeCrossColor = "blue" | "black" | "gray"

export type SqueezePoint = {
  time: number
  value: number
  barColor: SqueezeBarColor
  crossColor: SqueezeCrossColor
}

export type SqueezeState = "on" | "off" | "none"

export type SqueezeResult = {
  points: SqueezePoint[]
  state: SqueezeState | null
}

const LENGTH = 20
const LENGTH_KC = 20
const MULT_KC = 1.5

function sma(values: number[], length: number): (number | null)[] {
  const out = new Array<number | null>(values.length).fill(null)
  let sum = 0
  for (let index = 0; index < values.length; index++) {
    sum += values[index]
    if (index >= length) sum -= values[index - length]
    if (index >= length - 1) out[index] = sum / length
  }
  return out
}

// Pine's stdev is the population standard deviation (divides by n).
function stdev(values: number[], length: number): (number | null)[] {
  const out = new Array<number | null>(values.length).fill(null)
  for (let index = length - 1; index < values.length; index++) {
    let sum = 0
    for (let cursor = index - length + 1; cursor <= index; cursor++)
      sum += values[cursor]
    const mean = sum / length
    let variance = 0
    for (let cursor = index - length + 1; cursor <= index; cursor++)
      variance += (values[cursor] - mean) ** 2
    out[index] = Math.sqrt(variance / length)
  }
  return out
}

function trueRange(
  highs: number[],
  lows: number[],
  closes: number[],
): number[] {
  return highs.map((high, index) => {
    if (index === 0) return high - lows[index]
    return Math.max(
      high - lows[index],
      Math.abs(high - closes[index - 1]),
      Math.abs(lows[index] - closes[index - 1]),
    )
  })
}

function rolling(
  values: number[],
  length: number,
  pick: (left: number, right: number) => number,
): (number | null)[] {
  const out = new Array<number | null>(values.length).fill(null)
  for (let index = length - 1; index < values.length; index++) {
    let acc = values[index - length + 1]
    for (let cursor = index - length + 2; cursor <= index; cursor++)
      acc = pick(acc, values[cursor])
    out[index] = acc
  }
  return out
}

function linregAt(
  source: (number | null)[],
  index: number,
  length: number,
): number | null {
  const start = index - length + 1
  if (start < 0) return null
  let sumY = 0
  let sumXY = 0
  for (let offset = 0; offset < length; offset++) {
    const value = source[start + offset]
    if (value === null) return null
    sumY += value
    sumXY += offset * value
  }
  const n = length
  const sumX = ((n - 1) * n) / 2
  const sumX2 = ((n - 1) * n * (2 * n - 1)) / 6
  const denominator = n * sumX2 - sumX * sumX
  if (denominator === 0) return null
  const slope = (n * sumXY - sumX * sumY) / denominator
  const intercept = (sumY - slope * sumX) / n
  return intercept + slope * (n - 1)
}

export function computeSqueeze(candles: Candle[]): SqueezeResult {
  if (candles.length < LENGTH + LENGTH_KC) return { points: [], state: null }

  const closes = candles.map((candle) => candle.close)
  const highs = candles.map((candle) => candle.high)
  const lows = candles.map((candle) => candle.low)

  const basis = sma(closes, LENGTH)
  const deviations = stdev(closes, LENGTH)
  const rangema = sma(trueRange(highs, lows, closes), LENGTH_KC)
  const highestHigh = rolling(highs, LENGTH_KC, Math.max)
  const lowestLow = rolling(lows, LENGTH_KC, Math.min)

  const source = closes.map((close, index) => {
    const high = highestHigh[index]
    const low = lowestLow[index]
    const average = basis[index]
    if (high === null || low === null || average === null) return null
    return close - ((high + low) / 2 + average) / 2
  })

  const points: SqueezePoint[] = []
  let previous: number | null = null

  for (let index = 0; index < candles.length; index++) {
    const average = basis[index]
    const deviation = deviations[index]
    const range = rangema[index]
    if (average === null || deviation === null || range === null) continue

    // Same formula as the script: dev uses multKC, so "BB MultFactor" is unused.
    const offset = MULT_KC * deviation
    const upperBB = average + offset
    const lowerBB = average - offset
    const upperKC = average + range * MULT_KC
    const lowerKC = average - range * MULT_KC

    const sqzOn = lowerBB > lowerKC && upperBB < upperKC
    const sqzOff = lowerBB < lowerKC && upperBB > upperKC

    const value = linregAt(source, index, LENGTH_KC)
    if (value === null) continue

    const before = previous ?? 0
    const barColor: SqueezeBarColor =
      value > 0
        ? value > before
          ? "lime"
          : "green"
        : value < before
          ? "red"
          : "maroon"
    const crossColor: SqueezeCrossColor = sqzOn
      ? "black"
      : sqzOff
        ? "gray"
        : "blue"

    points.push({
      time: candles[index].time,
      value,
      barColor,
      crossColor,
    })
    previous = value
  }

  const last = points.at(-1)?.crossColor
  const state: SqueezeState | null =
    last === "black" ? "on" : last === "gray" ? "off" : last === "blue" ? "none" : null

  return { points, state }
}
