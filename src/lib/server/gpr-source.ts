import { get } from "node:https"
import type { GprPoint, GprResponse } from "@/lib/gpr"

// Server-only loader for the daily Caldara & Iacoviello GPR file.
const BASE_URL = "https://www.matteoiacoviello.com/gpr.htm"
const headers = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Accept-Encoding": "identity",
}
const CACHE_MS = 6 * 60 * 60 * 1000
const MAX_PAGE_BYTES = 20_000_000
const MAX_FILE_BYTES = 20_000_000
const MAX_REDIRECTS = 3
export type AvailableGpr = Extract<GprResponse, { status: "available" }>

type CachedGpr = {
  expires: number
  data: AvailableGpr
}

type UpstreamResponse = {
  status: number
  body: Buffer
}

let cached: CachedGpr | null = null
let pending: Promise<AvailableGpr> | null = null

const number = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) ? value : null
const oneDecimal = (value: number) => Math.round(value * 10) / 10

function readUpstream(
  url: URL,
  maxBytes: number,
  timeoutMs: number,
  redirects = 0,
): Promise<UpstreamResponse> {
  return new Promise((resolve, reject) => {
    let settled = false
    const fail = (error: Error) => {
      if (settled) return
      settled = true
      reject(error)
    }
    const request = get(url, { headers }, (response) => {
      const status = response.statusCode ?? 0
      const location = response.headers.location
      if (status >= 300 && status < 400 && location) {
        response.resume()
        if (redirects >= MAX_REDIRECTS) {
          fail(new Error("Too many GPR redirects"))
          return
        }
        const redirectUrl = new URL(location, url)
        if (
          redirectUrl.protocol !== "https:" ||
          redirectUrl.hostname !== "www.matteoiacoviello.com"
        ) {
          fail(new Error("Invalid GPR redirect"))
          return
        }
        settled = true
        resolve(readUpstream(redirectUrl, maxBytes, timeoutMs, redirects + 1))
        return
      }

      const contentLength = Number(response.headers["content-length"] ?? 0)
      if (contentLength > maxBytes) {
        response.resume()
        fail(new Error("GPR response too large"))
        return
      }

      const chunks: Buffer[] = []
      let bytes = 0
      response.on("data", (chunk: Buffer | string) => {
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
        bytes += buffer.byteLength
        if (bytes > maxBytes) {
          response.destroy(new Error("GPR response too large"))
          fail(new Error("GPR response too large"))
          return
        }
        chunks.push(buffer)
      })
      response.on("end", () => {
        if (settled) return
        settled = true
        resolve({ status, body: Buffer.concat(chunks) })
      })
      response.on("aborted", () => fail(new Error("GPR response aborted")))
      response.on("error", fail)
    })
    request.setTimeout(timeoutMs, () => {
      request.destroy(new Error("GPR request timed out"))
    })
    request.on("error", fail)
  })
}

async function loadDailyGpr(): Promise<AvailableGpr> {
  // 1. Read the publication page and collect its Excel links.
  const page = await readUpstream(new URL(BASE_URL), MAX_PAGE_BYTES, 10_000)
  if (page.status < 200 || page.status >= 300)
    throw new Error("GPR page unavailable")
  const html = page.body.toString("utf8")
  const excelUrls: string[] = []
  for (const match of html.matchAll(/href\s*=\s*["']([^"']+\.xlsx?)["']/gi)) {
    const url = new URL(match[1], BASE_URL)
    if (
      url.protocol === "https:" &&
      url.hostname === "www.matteoiacoviello.com" &&
      !excelUrls.includes(url.href)
    )
      excelUrls.push(url.href)
  }

  // 2. Use the daily recent file (the second link on the page).
  const dailyUrl = excelUrls.find((url) => /daily/i.test(url)) ?? excelUrls[1]
  if (!dailyUrl) throw new Error("Daily GPR file not found")
  const file = await readUpstream(new URL(dailyUrl), MAX_FILE_BYTES, 30_000)
  if (file.status < 200 || file.status >= 300)
    throw new Error("Daily GPR file unavailable")

  // 3. Parse the spreadsheet and keep GPRD, GPRD_ACT and GPRD_THREAT.
  const XLSX = await import("xlsx")
  const workbook = XLSX.read(file.body, { type: "buffer" })
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  if (!sheet) throw new Error("Empty GPR file")
  const points: GprPoint[] = []
  for (const row of XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet)) {
    const day = String(row.DAY ?? "")
    const gpr = number(row.GPRD)
    const gpra = number(row.GPRD_ACT)
    const gprt = number(row.GPRD_THREAT)
    if (!/^\d{8}$/.test(day) || gpr === null || gpra === null || gprt === null)
      continue
    points.push({
      date: `${day.slice(0, 4)}-${day.slice(4, 6)}-${day.slice(6, 8)}`,
      gpr: oneDecimal(gpr),
      gpra: oneDecimal(gpra),
      gprt: oneDecimal(gprt),
    })
  }
  points.sort((a, b) => a.date.localeCompare(b.date))
  const last = points.at(-1)
  if (!last) throw new Error("No GPR observations")

  // 4. Send the latest three years, enough for every chart period.
  const cutoff = new Date(`${last.date}T00:00:00Z`)
  cutoff.setUTCFullYear(cutoff.getUTCFullYear() - 3)
  cutoff.setUTCDate(cutoff.getUTCDate() - 7)
  const cutoffKey = cutoff.toISOString().slice(0, 10)
  return {
    status: "available",
    source: dailyUrl,
    updatedAt: last.date,
    points: points.filter((point) => point.date >= cutoffKey),
  }
}

// Shares one download across callers and keeps the last good copy on failure.
export async function getDailyGpr(): Promise<AvailableGpr> {
  if (cached && cached.expires > Date.now()) return cached.data
  pending ??= loadDailyGpr().finally(() => {
    pending = null
  })
  try {
    cached = { expires: Date.now() + CACHE_MS, data: await pending }
  } catch (error) {
    if (!cached) throw error
  }
  return cached.data
}
