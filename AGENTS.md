# AGENTS.md

Contexto operativo para asistentes de IA que trabajen en este repositorio.

## Producto

IB1 — Investment Business One concentra información de los mercados financieros
para el análisis y la toma de decisiones de inversión: índices y cotizaciones,
riesgo geopolítico (GPR), calendario económico, sentimiento de noticias y
seguimiento de cartera.

Secciones de la app (`src/App.tsx`):

- **Mercado**: Inicio (radar de noticias y agenda macro), GPR Index, Sentiment Analysis.
- **Análisis**: Financiamiento, Proyectos de inversión, Simulador de escenarios, Crear gráficos.
- **Registro**: Informes financieros, Biblioteca, Historial, Configuración.

No hay base de datos ni autenticación: la cartera, los análisis y los informes
del usuario se guardan en `localStorage`.

## Stack

- Next.js 16.4.6 (App Router) + React 19.2 + TypeScript `strict`.
- Tailwind CSS v4 vía PostCSS; estilos propios en `src/components/gpr-dashboard.css`
  y `src/app/(frontend)/finance.css`.
- pnpm 10.34.3, Node >= 20.9.
- Alias de imports: `@/*` → `src/*`.

## Comandos

```bash
pnpm install
pnpm dev
pnpm build
pnpm start
pnpm format        # oxfmt
npx tsc --noEmit   # verificación de tipos
```

## Mapa del código

- `src/App.tsx` — shell de la aplicación, navegación y las 11 secciones.
- `src/app/(frontend)/layout.tsx` — metadata del sitio; la lee de `.figma/make/site.json`
  (título, descripción, `robots`, Open Graph). Cambiar el SEO implica editar ese JSON.
- `src/app/(frontend)/api/**` — 11 route handlers en Node runtime.
- `src/components/` — dashboards: `MarketDashboard.tsx`, `GPRDashboard.tsx`,
  `SentimentDashboard.tsx`, `TradingTerminal.tsx`, `SqueezeMomentum.tsx`,
  `EconomicCalendar.tsx`, `MacroAgenda.tsx`.
- `src/components/gpr/` — `CountryRiskCard.tsx` (card "Hechos clave"),
  `useCountryNews.ts`, `useGprData.ts`.
- `src/lib/gpr-news.ts` — contratos (`GprHighlight`, `GprCountryNewsResponse`).
- `src/lib/gpr-country.ts` — `buildCountryView`, alias de países.
- `src/lib/gpr-sources.ts` — jerarquía de fuentes (`SourceTier: high | medium | low`).
- `src/lib/gpr-topics.ts` — clasificación temática.
- `src/lib/server/` — lectores de fuentes: `market-sources.ts`, `gpr-source.ts`,
  `gpr-news-source.ts`, `gpr-peak-news-source.ts`, `gpr-country-news.ts`,
  `gdelt-source.ts`, `economic-calendar-source.ts`.

## Convenciones

- TypeScript estricto: evitar `any`; tipar los contratos de API en `src/lib`.
- `finance.css` define `button { font: inherit }`, que **anula** las utilidades de
  tamaño/peso de Tailwind en botones. En esos casos hay que usar el modificador
  importante (`text-[11px]! font-medium!`).
- Mantener la estética existente: tarjetas con bordes suaves, tipografía compacta,
  estados "no disponible" cuando una fuente falla.
- No agregar dependencias sin necesidad real.

## Reglas editoriales del GPR (no romper)

- Ventana de 30 días y el país debe aparecer en el titular.
- Solo titulares originales con su fuente y enlace: nunca reescribir ni parafrasear.
- Jerarquía de fuentes en `gpr-sources.ts` (peso 3 high, 1 medium, 0 low).
- Excluir deportes, farándula, crimen local, opinión, resúmenes de mercado y
  contenido patrocinado.
- Los "Hechos clave" (`pickHighlights` en `src/lib/server/gpr-country-news.ts`)
  son 3-4 hechos elegidos de forma determinista: sin LLM, con deduplicación y
  diversidad temática.

## Datos y caché

- Ninguna fuente usa API key: Yahoo Finance, Finviz, StockAnalysis, CNN Fear &
  Greed, Caldara & Iacoviello, Google News, GDELT, RSS de NYT/Guardian/BBC/El País
  y calendario de Forex Factory.
- `cached()` en `src/lib/server/market-sources.ts` aplica TTL en memoria por
  instancia (60 s a 6 h) y se acompaña de `Cache-Control` para el CDN.
- Yahoo, Finviz y CNN pueden bloquear IPs de datacenter; la UI debe degradar a
  "no disponible" sin romperse.

## Deploy

- Repositorio: `https://github.com/anthonycg20/proyecto-ib1`, rama `main`.
- Producción: `https://proyecto-ib1.vercel.app` (proyecto `anthonycotrina25-2329/proyecto-ib1`).
- El deploy es manual: `vercel --prod --yes`. No hay integración Git con Vercel,
  así que un `git push` no publica nada por sí solo.
- Variables de entorno, si alguna vez se necesitan, se cargan en el panel de Vercel.
  `.env*` está en `.gitignore`: nunca subir secretos.
- Los binarios (imágenes, PDF, fuentes) se versionan con Git LFS según `.gitattributes`.

## Al actualizar la documentación

El propósito del producto debe describirse siempre como plataforma de información
de mercados para análisis y decisiones de inversión. `README.md` y la `description`
de `.figma/make/site.json` deben mantenerse alineados.
