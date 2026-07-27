# Frontend rebuild — implementation notes

Date: July 2026. Scope: complete rebuild of the UI/frontend (Phase 7.2 and Phase 8) on top of the existing
Supabase schema. No database changes were made.

## 1. Audit findings (pre-rebuild)

- The starter app was a single light-themed page with a MapLibre demo. It fell back to
  `data/nodes.seed.json` whenever Supabase credentials were absent or a query failed, so a rendering page did
  not prove live data. The seed fallback and file were removed; pages now render an explicit
  "not configured" state instead.
- The home page was statically prerendered, which would have frozen "live" data at build time on Vercel. All
  data routes now declare `dynamic = 'force-dynamic'`.
- `npm run lint` could not run (no ESLint dependencies). ESLint 9 + `eslint-config-next` were added with a
  flat config.
- No tests existed. Vitest + Testing Library were added (69 tests across 9 files).
- Baseline `tsc` and `next build` passed and still do.

## 2. Schema facts the brief got wrong (migrations are authoritative)

- `provenance_class` has **three** values: `reported`, `modelled`, `unverified` — not five. The UI implements
  exactly these three.
- Confidence is an **integer 0–100** (weighted generated column on `assertions`), not 0–1. Band thresholds
  were adapted proportionally: High ≥ 85, Medium 65–84, Low < 65.
- **Three** product forms are seeded (HS 261710, 811010, 282580), not six.
- `nodes` has no aliases column; `node_ownership` has no role column; `events` uses `headline` and severity
  1–5. The UI reflects what exists.

## 3. Material assumptions and judgements

- **Operating vs prospective supply** maps from `node_status`: `operating` → operating;
  `development`/`construction` → prospective; `care_and_maintenance`/`suspended`/`closed`/`unknown` →
  inactive/uncertain, excluded from both. Documented on the methodology page; changing it requires a
  methodology update.
- **Identity evidence for a node** (asset table provenance/confidence columns) comes from the existing
  `public_nodes` view: the highest-confidence primary `identity` assertion. Nodes without one show
  "unverified / 0" per the view's `coalesce`.
- **"Principal metric"** in list views is the node's most recent observation by `period_end`, displayed with
  its full qualifiers. Metric values are never compared or sorted across nodes because units differ.
- **Metric-kind classification** (`capacity`/`production`/`resource`) is keyword-based on metric names and is
  used only for coverage flags ("no capacity metric recorded"), never for display or aggregation.
- **kg → t** for customs gross weight is the only silent unit conversion in the product (pure mass units,
  labelled "(gross)", exact kg retained in tooltips and exports). Implied US$/t is computed only when both
  value and a material weight (≥ 100 kg) exist, and is labelled as derived.
- **Trade aggregation** on country pages sums gross weight and value only within (direction, product form,
  year) groups — never across product forms.
- **Stale** = `last_reviewed_at` missing or older than 12 months.
- **URLs** use `node_id` UUIDs (`/assets/[id]`). The schema has no slug column and canonical names are only
  unique per metal+country; UUIDs are stable opaque identifiers. Country routes use ISO alpha-3 codes.

## 4. Known limitations

- **Pilot-scale data strategy**: list views fetch bounded sets (nodes ≤ 1,000, observations ≤ 2,000, trade
  flows ≤ 2,000 newest-first with a visible truncation notice) and filter client-side, which keeps filter
  state in the URL with zero-latency interaction at the target scale (~35–60 assets). If the dataset grows
  well beyond that, move filtering server-side (the pure filter logic in `lib/filters.ts` is already
  separated to make that migration contained).
- **Edges** are drawn as straight schematic lines between node coordinates and labelled as such; the
  `route_geom` PostGIS linestrings are not parsed (WKB decoding was not justified for the pilot). Trade arcs
  join country centroids from a curated table; pairs without a centroid are counted and disclosed rather than
  guessed. Arcs use simple longitude interpolation and do not split at the antimeridian, so a
  trans-Pacific pair takes the long way around visually — acceptable for schematic country-level arcs,
  worth revisiting if trade coverage grows.
- **Basemap**: the map uses OpenFreeMap vector tiles (no API key, commercial use permitted) with a custom
  restrained dark style. If the tile host is unreachable the map degrades to a dark canvas with all data
  layers intact and shows a "basemap unavailable" notice.
- **Country-level events** appear on country pages via `events.country_code`; the map plots only node-linked
  events (via `event_impacts`) because country events have no defensible point location.
- **Monthly trade periods** render via the period formatter (e.g. "Jan 2026") but the explorer's period
  filter is annual until monthly data actually exists.
- `npm audit` reports advisories in the **dev-only** ESLint toolchain (transitive `minimatch`/
  `brace-expansion`); nothing shipped to users is affected, and forcing the "fix" would install broken
  ancient versions.

## 5. Database changes

None. No migrations, tables, views, indexes or RPCs were added or altered. The existing `public_nodes` view
from `0002_security.sql` is used as-is.

## 6. Verification performed

- `npm run lint`, `npm run typecheck`, `npm test` (69 tests), `npm run build` — all clean.
- Full visual smoke test of every route (desktop 1440px and mobile 390px) against a local PostgREST-shaped
  fixture server seeded with a Stibnite-like record, verifying: live-query rendering, provenance/confidence
  badges, modelled-vs-reported distinction, approximate-location disclosure, CSV export, URL-persisted
  filters, sorting, empty states, the unconfigured state, map layers/legend/side panel/focus deep-link, and
  responsive navigation. (The fixture server was a throwaway QA harness, intentionally not committed.)
