// Descriptive metadata for CNN's seven components; live values come from /api/fear-greed.
export const sentimentFactors = [
  {
    id: "momentum",
    title: "Stock Price Momentum",
    subtitle: "Momentum del precio de acciones",
    explanation:
      "Compara el S&P 500 con su media móvil de 125 sesiones. Estar por debajo sugiere menor impulso del mercado.",
  },
  {
    id: "strength",
    title: "Stock Price Strength",
    subtitle: "Fuerza del precio de acciones",
    explanation:
      "Relaciona las acciones en máximos de 52 semanas con las que están en mínimos de 52 semanas en el NYSE.",
  },
  {
    id: "breadth",
    title: "Stock Price Breadth",
    subtitle: "Amplitud del mercado",
    explanation:
      "Evalúa la amplitud del volumen en acciones al alza frente a la baja mediante el indicador de McClellan.",
  },
  {
    id: "options",
    title: "Put and Call Options",
    subtitle: "Opciones de venta y compra",
    explanation:
      "Compara la demanda de opciones Put, usadas para cobertura bajista, con la de opciones Call, asociadas a exposición alcista.",
  },
  {
    id: "volatility",
    title: "Market Volatility (VIX)",
    subtitle: "Volatilidad del mercado",
    explanation:
      "El índice VIX refleja volatilidad implícita. Se interpreta junto con su promedio de 50 sesiones; el valor aislado no indica por sí solo el sentimiento.",
  },
  {
    id: "safehaven",
    title: "Safe Haven Demand",
    subtitle: "Demanda de activos refugio",
    explanation:
      "Contrasta el rendimiento a 20 sesiones de las acciones con el de los bonos del Tesoro. Una mayor preferencia por acciones indica más apetito por riesgo.",
  },
  {
    id: "junk",
    title: "Junk Bond Demand",
    subtitle: "Demanda de bonos de alto riesgo",
    explanation:
      "Compara el diferencial de rendimientos de bonos de alto riesgo frente a bonos con grado de inversión. Un diferencial menor indica más apetito por riesgo.",
  },
] as const

// Bands follow CNN: 0–24, 25–44, 45–55, 56–75 and 76–100.
export function sentimentState(score: number) {
  const value = Math.round(score)
  if (value < 25)
    return {
      label: "Miedo Extremo",
      color: "var(--sentiment-critical)",
      className:
        "text-[var(--sentiment-critical)] bg-[color-mix(in_srgb,var(--sentiment-critical)_10%,transparent)]",
    }
  if (value < 45)
    return {
      label: "Miedo",
      color: "var(--sentiment-fear)",
      className:
        "text-[var(--sentiment-fear)] bg-[color-mix(in_srgb,var(--sentiment-fear)_12%,transparent)]",
    }
  if (value <= 55)
    return {
      label: "Neutral",
      color: "var(--sentiment-neutral)",
      className:
        "text-[var(--sentiment-neutral)] bg-[color-mix(in_srgb,var(--sentiment-neutral)_12%,transparent)]",
    }
  if (value <= 75)
    return {
      label: "Codicia",
      color: "var(--sentiment-optimism)",
      className:
        "text-[var(--sentiment-optimism)] bg-[color-mix(in_srgb,var(--sentiment-optimism)_12%,transparent)]",
    }
  return {
    label: "Codicia Extrema",
    color: "var(--sentiment-greed)",
    className:
      "text-[var(--sentiment-greed)] bg-[color-mix(in_srgb,var(--sentiment-greed)_10%,transparent)]",
  }
}
