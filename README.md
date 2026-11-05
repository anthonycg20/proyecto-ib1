# IB1 — Investment Business One

Plataforma de análisis financiero para PyMEs: indicadores de mercado, índice GPR
(riesgo geopolítico), análisis de sentimiento y herramientas de evaluación
financiera (liquidez, endeudamiento, préstamos, VAN/TIR/payback, escenarios,
informes y biblioteca).

Next.js 16 (App Router) + React 19 + Tailwind CSS v4, en TypeScript. Desplegable
en Vercel sin base de datos: la persistencia de usuario vive en `localStorage`.

## Comandos

```bash
pnpm install
pnpm dev     # http://localhost:3000
pnpm build
pnpm start
```

## Estructura

- `src/App.tsx` — shell de la aplicación y sus 11 secciones (client component).
- `src/components/` — dashboards de mercado, GPR y sentimiento.
- `src/lib/` — cálculos financieros, NLP de titulares, importación de documentos.
- `src/lib/server/` — lectores de servidor de las fuentes externas.
- `src/app/(frontend)/api/` — route handlers (Node runtime):

| Endpoint | Fuente |
|---|---|
| `/api/market-overview` | Yahoo Finance (quotes/screener) + Finviz (heatmaps) |
| `/api/fear-greed` | CNN Fear & Greed graphdata |
| `/api/gpr` | Caldara & Iacoviello, `matteoiacoviello.com/gpr.htm` (xlsx diario) |
| `/api/gpr-news` | RSS de NYT, Guardian, BBC y El País |
| `/api/gpr-peak-news` | Google News RSS (fallback Bing News RSS) |
| `/api/market-comparison` | GPR + S&P 500 (Yahoo) |
| `/api/market-sentiment` | Google News, El País Economía y BBC Business |

No requiere variables de entorno. Opcional: `NEXT_PUBLIC_SITE_URL` para el
dominio canónico (en Vercel se autodetecta).

## Notas

- Ninguna fuente usa API key: son endpoints públicos y RSS. Yahoo, Finviz y CNN
  pueden bloquear IPs de datacenter; la UI muestra el estado "no disponible".
- Cache en memoria por instancia (60 s a 6 h) más `Cache-Control` para el CDN.
- `.figma/make/site.json` conserva los metadatos del sitio (título, descripción,
  `robots.index`).
