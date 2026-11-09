"use client"

import { useState } from "react"
import type { MarketArticle } from "@/lib/sentiment-nlp"

// Los feeds no siempre traen foto: Google News no la incluye, pero sí el sitio
// del medio. La escalera es foto del artículo → logo del medio → inicial.
const publisherLogo = (article: MarketArticle) => {
  for (const candidate of [article.sourceUrl, article.url]) {
    if (!candidate) continue
    try {
      const host = new URL(candidate).hostname.replace(/^www\./, "")
      if (host && host !== "news.google.com")
        return `https://www.google.com/s2/favicons?sz=128&domain=${encodeURIComponent(host)}`
    } catch {
      // Ignora URLs inválidas y prueba la siguiente opción.
    }
  }
  return null
}

export default function NewsThumbnail({
  article,
  className = "",
}: {
  article: MarketArticle
  className?: string
}) {
  const sources = [article.image, publisherLogo(article)].filter(
    (value): value is string => Boolean(value),
  )
  const [attempt, setAttempt] = useState(0)
  const src = sources[attempt]
  return (
    <div
      className={`grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-md border border-[var(--line)] bg-[var(--background)] ${className}`}
    >
      {src ? (
        <img
          src={src}
          alt=""
          aria-hidden="true"
          width={56}
          height={56}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setAttempt((current) => current + 1)}
          className={`h-full w-full ${
            article.image && attempt === 0
              ? "object-cover"
              : "object-contain p-1.5"
          }`}
        />
      ) : (
        <span
          aria-hidden="true"
          className="text-sm font-bold text-[var(--primary)]"
        >
          {article.source.trim().charAt(0).toUpperCase() || "?"}
        </span>
      )}
    </div>
  )
}
