"use client"

import type { GprCountry } from "../../lib/gpr-country"
import type { GprCountryNewsProvider } from "../../lib/gpr-news"
import { Icon } from "../ui"
import type { CountryNewsStatus } from "./useCountryNews"

type CountryRiskCardProps = {
  country: GprCountry
  expanded: boolean
  newsStatus: CountryNewsStatus
  provider: GprCountryNewsProvider | null
  partial: boolean
  activeTag: string | null
  onToggle: () => void
  onClose: () => void
  onTagClick: (tag: string) => void
  onOpenNews: () => void
}

function TrendLine({ trend }: { trend: number }) {
  const tone = trend > 0 ? "up" : trend < 0 ? "down" : "flat"
  const symbol = trend > 0 ? "▲" : trend < 0 ? "▼" : "="
  const value =
    trend === 0 ? "0 pts" : `${trend > 0 ? "+" : "−"}${Math.abs(trend)} pts`
  return (
    <p className={`gpr-country-trend is-${tone}`}>
      <span aria-hidden>{symbol}</span> {value}{" "}
      <small>vs. mes anterior</small>
    </p>
  )
}

function Highlights({
  country,
  status,
}: {
  country: GprCountry
  status: CountryNewsStatus
}) {
  if (status === "loading" || status === "idle")
    return (
      <div className="gpr-country-skeletons" aria-hidden>
        <span />
        <span />
        <span />
        <span />
      </div>
    )

  if (status === "error")
    return (
      <p className="gpr-country-empty">
        No se pudieron cargar los hechos clave de {country.name} con las fuentes
        actuales.
      </p>
    )

  if (!country.highlights.length)
    return (
      <p className="gpr-country-empty">
        Sin hechos clave para {country.name} en los últimos 30 días. Los
        titulares recientes siguen disponibles en el feed.
      </p>
    )

  return (
    <ol className="gpr-country-highlights">
      {country.highlights.map((highlight) => (
        <li key={highlight.url}>
          <a href={highlight.url} target="_blank" rel="noopener noreferrer">
            <span className="gpr-country-highlight-title">
              {highlight.title}
            </span>
            <span className="gpr-country-highlight-source">
              {highlight.source}
            </span>
          </a>
        </li>
      ))}
    </ol>
  )
}

export function CountryRiskCard({
  country,
  expanded,
  newsStatus,
  provider,
  partial,
  activeTag,
  onToggle,
  onClose,
  onTagClick,
  onOpenNews,
}: CountryRiskCardProps) {
  return (
    <section
      className={`gpr-country-card risk-${country.level.className} ${
        expanded ? "is-expanded" : "is-collapsed"
      }`}
      aria-label={`Detalle de riesgo de ${country.name}`}
    >
      <div className="gpr-country-head">
        <span className="gpr-country-accent" aria-hidden />
        <div className="gpr-country-identity" aria-live="polite">
          <strong>{country.name}</strong>
          <small>Riesgo {country.level.label.toLowerCase()}</small>
        </div>
        <div className="gpr-country-score">
          <b>{country.score ?? "—"}</b>
          <small>/ 100</small>
        </div>
        <button
          type="button"
          className="gpr-country-action"
          aria-expanded={expanded}
          aria-label={
            expanded
              ? `Cerrar detalle de ${country.name}`
              : `Ver detalle de ${country.name}`
          }
          onClick={expanded ? onClose : onToggle}
        >
          {expanded ? (
            <span className="gpr-country-close-mark" aria-hidden>
              ✕
            </span>
          ) : (
            <Icon name="arrow" size={14} />
          )}
        </button>
      </div>

      {expanded && (
        <div className="gpr-country-body">
          <div className="gpr-country-breakdown">
            <div>
              <span>GPRA (Actos)</span>
              <b>{country.gpra ?? "—"}</b>
            </div>
            <div>
              <span>GPRT (Amenazas)</span>
              <b>{country.gprt ?? "—"}</b>
            </div>
          </div>

          <TrendLine trend={country.trend} />

          <div className="gpr-country-section">
            <span className="gpr-country-label">Hechos clave</span>
            <Highlights country={country} status={newsStatus} />
            {newsStatus === "ready" && provider && (
              <span className="gpr-country-source">
                Últimos 30 días · Titulares: {provider}
                {partial ? " · datos parciales" : ""}
              </span>
            )}
          </div>

          {country.tags.length > 0 && (
            <div className="gpr-country-section">
              <span className="gpr-country-label">Top etiquetas</span>
              <div className="gpr-country-tags">
                {country.tags.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    className={`gpr-country-tag ${
                      activeTag === tag ? "is-active" : ""
                    }`}
                    aria-pressed={activeTag === tag}
                    onClick={() => onTagClick(tag)}
                  >
                    #{tag}
                  </button>
                ))}
              </div>
            </div>
          )}

          <button
            type="button"
            className="gpr-country-link"
            onClick={onOpenNews}
          >
            Ver noticias de {country.name} en el feed{" "}
            <span aria-hidden>→</span>
          </button>

          <p className="gpr-country-note">
            Desglose y tendencia estimados a partir del score ilustrativo.
          </p>
        </div>
      )}
    </section>
  )
}
