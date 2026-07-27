-- Additive migration for the authoritative live Supabase schema.
--
-- The historical 0001/0002 migrations no longer match the production database.
-- This migration deliberately depends only on the live core tables and enums:
--   public.nodes, public.metals, public.product_forms, public.sources,
--   public.provenance_class.
-- It adds the structured resources/reserves layer, bilateral customs flows,
-- and evidence-backed physical/commercial edges without rewriting live data.

create extension if not exists pgcrypto;
create extension if not exists postgis;

-- ---------------------------------------------------------------------------
-- Resources and reserves
-- ---------------------------------------------------------------------------

create table if not exists public.mineral_estimates (
  estimate_id uuid primary key default gen_random_uuid(),
  node_id uuid not null references public.nodes(node_id) on delete cascade,
  metal_id uuid not null references public.metals(metal_id) on delete restrict,

  estimate_type text not null check (
    estimate_type in ('resource', 'reserve', 'exploration_target')
  ),
  classification text not null check (
    classification in (
      'measured',
      'indicated',
      'inferred',
      'measured_and_indicated',
      'proven',
      'probable',
      'proven_and_probable',
      'historical_resource',
      'historical_reserve',
      'unclassified'
    )
  ),
  estimate_date date,
  reporting_code text,
  basis text not null default 'gross' check (
    basis in ('gross', 'attributable', 'recoverable', 'in_situ')
  ),
  deposit_name text,
  zone_name text,

  ore_tonnage numeric,
  ore_tonnage_unit text,
  grade numeric,
  grade_unit text,
  contained_metal numeric,
  contained_metal_unit text,
  cutoff_grade numeric,
  cutoff_grade_unit text,

  is_inclusive boolean,
  attributable_percentage numeric check (
    attributable_percentage is null
    or attributable_percentage between 0 and 100
  ),
  is_current boolean not null default true,
  supersedes_estimate_id uuid references public.mineral_estimates(estimate_id) on delete set null,

  provenance public.provenance_class not null,
  confidence numeric(5,2) not null check (confidence between 0 and 100),
  source_id uuid not null references public.sources(source_id) on delete restrict,
  source_reference text not null,
  notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  check (ore_tonnage is not null or contained_metal is not null),
  check (ore_tonnage is null or ore_tonnage >= 0),
  check (contained_metal is null or contained_metal >= 0),
  check (grade is null or grade >= 0),
  check (cutoff_grade is null or cutoff_grade >= 0),
  check (supersedes_estimate_id is null or supersedes_estimate_id <> estimate_id),
  check (
    (ore_tonnage is null and ore_tonnage_unit is null)
    or (ore_tonnage is not null and ore_tonnage_unit is not null)
  ),
  check (
    (grade is null and grade_unit is null)
    or (grade is not null and grade_unit is not null)
  ),
  check (
    (contained_metal is null and contained_metal_unit is null)
    or (contained_metal is not null and contained_metal_unit is not null)
  ),
  check (
    (cutoff_grade is null and cutoff_grade_unit is null)
    or (cutoff_grade is not null and cutoff_grade_unit is not null)
  )
);

create index if not exists mineral_estimates_node_idx
  on public.mineral_estimates(node_id);
create index if not exists mineral_estimates_current_idx
  on public.mineral_estimates(node_id, estimate_type, classification)
  where is_current;
create index if not exists mineral_estimates_date_idx
  on public.mineral_estimates(estimate_date desc nulls last);
create index if not exists mineral_estimates_source_idx
  on public.mineral_estimates(source_id);

comment on table public.mineral_estimates is
  'Source-audited mineral resource, ore reserve and exploration-target components. Never aggregate current with superseded estimates, resources with reserves, or gross with attributable figures.';
comment on column public.mineral_estimates.is_inclusive is
  'Whether the reported category includes lower-confidence categories, e.g. measured and indicated inclusive of inferred. Null means the source does not make the convention clear.';
comment on column public.mineral_estimates.source_reference is
  'Page, table, section or other precise locator within the registered source.';

-- ---------------------------------------------------------------------------
-- Evidence-backed node-to-node relationships
-- ---------------------------------------------------------------------------

create table if not exists public.edges (
  edge_id uuid primary key default gen_random_uuid(),
  metal_id uuid not null references public.metals(metal_id) on delete cascade,
  from_node_id uuid not null references public.nodes(node_id) on delete cascade,
  to_node_id uuid not null references public.nodes(node_id) on delete cascade,
  edge_type text not null,
  product_form_id uuid references public.product_forms(product_form_id) on delete set null,
  relationship_status public.provenance_class not null,
  route_geom geography(linestring, 4326),
  effective_from date,
  effective_to date,
  confidence numeric(5,2) not null check (confidence between 0 and 100),
  source_id uuid not null references public.sources(source_id) on delete restrict,
  source_reference text not null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  check (from_node_id <> to_node_id),
  check (effective_to is null or effective_from is null or effective_to >= effective_from)
);

create index if not exists edges_from_node_idx on public.edges(from_node_id);
create index if not exists edges_to_node_idx on public.edges(to_node_id);
create index if not exists edges_product_form_idx on public.edges(product_form_id);
create index if not exists edges_route_gix on public.edges using gist(route_geom);

comment on table public.edges is
  'Evidence-backed mine, processor, port and gateway relationships. Lines are schematic unless route_geom is supported by a source; announced relationships remain distinct from verified commercial flows.';

-- ---------------------------------------------------------------------------
-- Bilateral customs trade flows
-- ---------------------------------------------------------------------------

create table if not exists public.trade_flows (
  trade_flow_id uuid primary key default gen_random_uuid(),
  reporter_country_code char(3) not null,
  partner_country_code char(3) not null,
  trade_direction text not null check (trade_direction in ('import', 'export')),
  product_form_id uuid not null references public.product_forms(product_form_id) on delete restrict,

  period_start date not null,
  period_end date not null,
  frequency text not null check (frequency in ('annual', 'monthly')),

  trade_value_usd numeric,
  net_weight_kg numeric,
  supplementary_quantity numeric,
  supplementary_unit text,

  provenance public.provenance_class not null,
  confidence numeric(5,2) not null check (confidence between 0 and 100),
  source_id uuid not null references public.sources(source_id) on delete restrict,
  source_reference text not null,
  revision_status text,
  notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  check (reporter_country_code <> partner_country_code),
  check (period_end >= period_start),
  check (trade_value_usd is null or trade_value_usd >= 0),
  check (net_weight_kg is null or net_weight_kg >= 0),
  check (supplementary_quantity is null or supplementary_quantity >= 0),
  check (
    (supplementary_quantity is null and supplementary_unit is null)
    or (supplementary_quantity is not null and supplementary_unit is not null)
  ),
  unique (
    reporter_country_code,
    partner_country_code,
    trade_direction,
    product_form_id,
    period_start,
    period_end,
    source_id,
    revision_status
  )
);

create index if not exists trade_flows_reporter_period_idx
  on public.trade_flows(reporter_country_code, period_end desc);
create index if not exists trade_flows_partner_period_idx
  on public.trade_flows(partner_country_code, period_end desc);
create index if not exists trade_flows_product_period_idx
  on public.trade_flows(product_form_id, period_end desc);
create index if not exists trade_flows_pair_idx
  on public.trade_flows(reporter_country_code, partner_country_code, product_form_id, period_start);
create index if not exists trade_flows_source_idx
  on public.trade_flows(source_id);

comment on table public.trade_flows is
  'Raw reporter-side bilateral customs observations. Exporter reports and importer mirror reports are separate rows and must not be averaged or silently reconciled.';
comment on column public.trade_flows.trade_direction is
  'Direction from the reporter country perspective.';
comment on column public.trade_flows.net_weight_kg is
  'Reported net weight in kilograms. Derived tonnes and unit values belong in queries or views, not the raw record.';

-- ---------------------------------------------------------------------------
-- Anonymous read access: match the existing public read-only application model
-- ---------------------------------------------------------------------------

alter table public.mineral_estimates enable row level security;
alter table public.edges enable row level security;
alter table public.trade_flows enable row level security;

grant usage on schema public to anon, authenticated;
grant select on table
  public.mineral_estimates,
  public.edges,
  public.trade_flows
  to anon, authenticated;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'mineral_estimates'
      and policyname = 'Public read mineral estimates'
  ) then
    create policy "Public read mineral estimates"
      on public.mineral_estimates for select to anon, authenticated using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'edges'
      and policyname = 'Public read edges'
  ) then
    create policy "Public read edges"
      on public.edges for select to anon, authenticated using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'trade_flows'
      and policyname = 'Public read trade flows'
  ) then
    create policy "Public read trade flows"
      on public.trade_flows for select to anon, authenticated using (true);
  end if;
end
$$;

-- Keep PostgREST aware of the new schema immediately after execution in the
-- Supabase SQL editor.
notify pgrst, 'reload schema';
