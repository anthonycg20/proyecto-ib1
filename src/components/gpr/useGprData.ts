"use client"

import { useCallback, useEffect, useState } from "react"
import type { GprResponse } from "../../lib/gpr"

export type AvailableGpr = Extract<GprResponse, { status: "available" }>
export type GprDataStatus = "loading" | "ready" | "error"

// Single fetch shared by the metric cards and the evolution chart so both show
// exactly the same series.
export function useGprData() {
  const [data, setData] = useState<AvailableGpr | null>(null)
  const [status, setStatus] = useState<GprDataStatus>("loading")

  const load = useCallback(async (signal?: AbortSignal) => {
    setStatus("loading")
    try {
      const response = await fetch("/api/gpr", { signal })
      const result = (await response.json()) as GprResponse
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

  return { data, status, reload: load }
}
