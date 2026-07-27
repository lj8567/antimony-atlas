# Antimony Supply Risk Atlas

A source-audited pilot mapping antimony mines, projects, processing facilities, logistics gateways and country-level trade flows.

## Local start

1. Install Node.js 20+.
2. Copy `.env.example` to `.env.local`.
3. Run `npm install`.
4. Run `npm run dev`.

The app uses `data/nodes.seed.json` until Supabase credentials are supplied.

## Deployment sequence

1. Run `supabase/migrations/0001_initial.sql` in Supabase SQL Editor.
2. Run `supabase/migrations/0002_security.sql`.
3. Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` to Vercel.
4. Import researched data through the scripts added in the next phase.

## Data rule

No displayed assertion may exist without provenance class, confidence score and a source record, except explicitly marked demonstration seed data.
