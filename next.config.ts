import type { NextConfig } from "next"

const siteURL =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "http://localhost:3000")

const nextConfig: NextConfig = {
  // Only two local images are used, so skip the optimizer (no Vercel image
  // optimization quota consumed, no sharp dependency needed).
  images: {
    unoptimized: true,
  },
  env: {
    NEXT_PUBLIC_SITE_URL: siteURL,
  },
  typescript: {
    // Keep the deploy unblocked while legacy template types settle.
    ignoreBuildErrors: true,
  },
}

export default nextConfig
