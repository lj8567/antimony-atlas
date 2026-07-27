# Antimony Supply Risk Atlas

A source-audited intelligence terminal for the antimony supply chain outside China: mines, material development
projects, concentrators, smelters, antimony metal and trioxide plants, ports and border gateways,
country-to-country trade flows and material supply events.

Every displayed claim carries a provenance class (`reported` / `modelled` / `unverified`), a 0–100 confidence
score and a path to its registered source. Missing data is labelled, never zeroed; incompatible units are never
aggregated.

## Stack

- **Next.js 15 (App Router)** + **TypeScript** (strict, no `any`)
- **Supabase** (PostgreSQL + PostGIS), anonymous read-only access enforced by row-level security
- **MapLibre GL** for the supply-chain map (lazy-loaded, no map code in other bundles)
- **Vitest + Testing Library** for tests; ESLint (`next/core-web-vitals` + `next/typescript`)
- **Vercel** for deployment — all data pages are dynamically rendered so they always read live data

## Local start

1. Install Node.js 20+ (the project is developed against Node 22).
2. Copy `.env.example` to `.env.local` and fill in:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. `npm install`
4. `npm run dev`

Without credentials the app renders an explicit "Database connection not configured" state on every page —
there is deliberately no placeholder-data fallback. Never commit `.env.local`; the service-role key must never
appear anywhere in this codebase.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` | Production build (Vercel-compatible) |
| `npm start` | Serve the production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Vitest suite (formatting, CSV, filters, URL state, components, map geometry) |

## Application structure

```
src/
  app/                      Routes (App Router, all data pages force-dynamic)
    page.tsx                Overview dashboard
    assets/                 Asset explorer + asset detail (/assets/[id])
    map/                    Interactive MapLibre supply-chain map
    countries/              Country index + profiles (/countries/[ISO3])
    trade/                  Trade-flow explorer (HS 261710 / 811010 / 282580)
    events/                 Event monitor
    sources/                Source register
    methodology/            Methodology + live coverage reporting
  components/
    shell/                  Application shell and responsive navigation
    ui/                     Design-system primitives (panels, badges, tables,
                            drawer, tooltips, filter controls, CSV export, states)
    assets/ asset-detail/ countries/ trade/ events/ sources/ map/
  lib/
    supabase/               client/server factories, schema row types,
    supabase/queries/       one typed query module per view (no inline queries in pages)
    format.ts               all display formatting (units, dates, provenance,
                            confidence bands, severity, metric-kind classification)
    filters.ts              URL-persisted filter state + pure filter/sort logic
    csv.ts                  spreadsheet-safe CSV generation (formula-injection guarded)
    countries.ts            ISO alpha-3 names + map-arc centroids
```

## Database

The schema lives in `supabase/migrations/` and is the source of truth:

1. `0001_initial.sql` — tables, enums (`provenance_class`, `node_status`), generated confidence score, seed
   metal + three antimony product forms (HS 261710, 811010, 282580).
2. `0002_security.sql` — row-level security, anonymous read policies, and the `public_nodes` view (per-node
   identity provenance/confidence).

The frontend rebuild added **no migrations, tables, views or RPCs** — it reads the existing schema as-is.
Research workflow and data-entry rules are documented in `docs/research-workflow.md` and
`docs/data-dictionary.md`; CSV templates live in `data/`.

## Evidence rules enforced by the UI

- Reported, modelled and unverified values are visually distinct (colour + shape + written label — never
  colour alone), with tooltips explaining each class.
- Confidence (0–100, weighted) is banded High ≥ 85 / Medium 65–84 / Low < 65, with the exact score always
  visible.
- Design capacity, projected production, actual production, contained metal and resources are separate,
  fully-qualified metrics; the UI never totals across units or product forms.
- Prospective project output is never added to operating supply.
- Approximate coordinates are disclosed on asset pages and drawn with an uncertainty halo on the map;
  connection lines are schematic and classified by evidence, never presented as known commercial flows.
- Customs trade flows identify countries only; mirror discrepancies are disclosed, not reconciled.
- CSV exports carry labels, units, provenance, confidence, source URLs, the active filters and an export
  timestamp, with spreadsheet-safe escaping.

See `docs/implementation-notes.md` for the frontend audit, material assumptions and known limitations.

## Deployment

1. Run both migrations in the Supabase SQL editor (in order) if setting up a fresh project.
2. Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in Vercel.
3. Deploy — `npm run build` is the only build step. Data pages render on demand, so newly researched records
   appear without a redeploy.
