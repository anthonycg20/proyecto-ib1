"use client"

import { useEffect, useRef, useState } from "react"
import type { GprCountryNewsResponse } from "../../lib/gpr-news"

export type CountryNewsStatus = "idle" | "loading" | "ready" | "error"

export type CountryNewsState = {
  status: CountryNewsStatus
  data: GprCountryNewsResponse | null
}

// Country news is fetched on demand (one request per selected country) and
// memoized per ISO-3 for the session. Cached responses older than 15 minutes
// are refreshed in the background while the previous data stays visible.
const MAX_AGE_MS = 15 * 60_000

export function useCountryNews(iso3: string) {
  const cache = useRef(new Map<string, GprCountryNewsResponse>())
  const [state, setState] = useState<CountryNewsState>({
    status: "idle",
    data: null,
  })

  useEffect(() => {
    const cached = cache.current.get(iso3)
    const checkedAt = cached ? Date.parse(cached.checkedAt) : NaN
    const fresh =
      cached && Number.isFinite(checkedAt) && Date.now() - checkedAt < MAX_AGE_MS

    if (fresh) {
      setState({ status: "ready", data: cached })
      return
    }

    // Show stale data immediately, then refresh it.
    setState({ status: cached ? "ready" : "loading", data: cached ?? null })

    const controller = new AbortController()
    fetch(`/api/gpr-country-news?iso3=${encodeURIComponent(iso3)}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        const result = (await response.json()) as GprCountryNewsResponse & {
          status: string
        }
        if (!response.ok || result.status !== "available")
          throw new Error("Country news unavailable")
        cache.current.set(iso3, result)
        setState({ status: "ready", data: result })
      })
      .catch(() => {
        if (!controller.signal.aborted && !cached)
          setState({ status: "error", data: null })
      })

    return () => controller.abort()
  }, [iso3])

  return state
}
