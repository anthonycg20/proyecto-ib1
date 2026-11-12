"use client"

import { useEffect, useRef, useState } from "react"
import type { GprCountryNewsResponse } from "../../lib/gpr-news"

export type CountryNewsStatus = "idle" | "loading" | "ready" | "error"

export type CountryNewsState = {
  status: CountryNewsStatus
  data: GprCountryNewsResponse | null
}

// Country news is fetched on demand (one request per selected country) and
// memoized per ISO-3 for the session, so flipping between countries is instant.
export function useCountryNews(iso3: string) {
  const cache = useRef(new Map<string, GprCountryNewsResponse>())
  const [state, setState] = useState<CountryNewsState>({
    status: "idle",
    data: null,
  })

  useEffect(() => {
    const cached = cache.current.get(iso3)
    if (cached) {
      setState({ status: "ready", data: cached })
      return
    }

    const controller = new AbortController()
    setState({ status: "loading", data: null })

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
        if (!controller.signal.aborted)
          setState({ status: "error", data: null })
      })

    return () => controller.abort()
  }, [iso3])

  return state
}
