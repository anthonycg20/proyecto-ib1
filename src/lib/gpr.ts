export type GprPoint = {
  date: string
  gpr: number
  gpra: number
  gprt: number
}

export type GprAvailable = {
  status: "available"
  source: string
  updatedAt: string
  points: GprPoint[]
}

export type GprUnavailable = {
  status: "unavailable"
  checkedAt: string
}

export type GprResponse = GprAvailable | GprUnavailable

export type GprPeakHeadline = {
  title: string
  url: string
  source: string | null
}

export type GprPeakDay = GprPoint & {
  headlines: GprPeakHeadline[]
  provider: "Google News" | "Bing News" | null
}

export type GprPeakNewsResponse = {
  status: "available"
  checkedAt: string
  query: string
  days: GprPeakDay[]
} | GprUnavailable
