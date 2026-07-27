create extension if not exists pgcrypto;
create extension if not exists postgis;

create type provenance_class as enum ('reported','modelled','unverified');
create type node_status as enum ('operating','development','construction','care_and_maintenance','suspended','closed','unknown');

create table metals (
  metal_id uuid primary key default gen_random_uuid(),
  name text not null unique,
  symbol text not null unique,
  description text
);

create table entities (
  entity_id uuid primary key default gen_random_uuid(),
  legal_name text not null,
  normalised_name text not null,
  entity_type text not null,
  country_code char(3),
  website text,
  active_from date,
  active_to date,
  unique(normalised_name, country_code)
);

create table product_forms (
  product_form_id uuid primary key default gen_random_uuid(),
  metal_id uuid not null references metals on delete cascade,
  name text not null,
  stage text not null,
  hs_code text,
  unit_basis text,
  unique(metal_id, name)
);

create table nodes (
  node_id uuid primary key default gen_random_uuid(),
  metal_id uuid not null references metals on delete cascade,
  canonical_name text not null,
  node_type text not null,
  status node_status not null default 'unknown',
  status_effective_date date,
  country_code char(3) not null,
  region text,
  latitude numeric(9,6) not null check(latitude between -90 and 90),
  longitude numeric(9,6) not null check(longitude between -180 and 180),
  geom geography(point,4326) generated always as (st_setsrid(st_makepoint(longitude,latitude),4326)::geography) stored,
  location_precision text not null default 'approximate',
  operator_entity_id uuid references entities,
  description text,
  first_seen_at timestamptz not null default now(),
  last_reviewed_at timestamptz,
  unique(metal_id, canonical_name, country_code)
);
create index nodes_geom_gix on nodes using gist(geom);
create index nodes_country_idx on nodes(country_code);

create table sources (
  source_id uuid primary key default gen_random_uuid(),
  title text not null,
  publisher text not null,
  source_type text not null,
  publication_date date,
  effective_date date,
  url text not null,
  licence text,
  file_hash text,
  retrieved_at timestamptz not null default now(),
  unique(url)
);

create table assertions (
  assertion_id uuid primary key default gen_random_uuid(),
  source_id uuid not null references sources on delete restrict,
  claim_text text not null,
  page_reference text,
  table_reference text,
  provenance provenance_class not null,
  extraction_method text not null,
  reviewer text,
  reviewed_at timestamptz,
  source_quality smallint not null check(source_quality between 0 and 100),
  recency_score smallint not null check(recency_score between 0 and 100),
  directness_score smallint not null check(directness_score between 0 and 100),
  corroboration_score smallint not null check(corroboration_score between 0 and 100),
  extraction_quality smallint not null check(extraction_quality between 0 and 100),
  confidence_score smallint generated always as (
    round(0.35*source_quality + 0.20*recency_score + 0.20*directness_score + 0.15*corroboration_score + 0.10*extraction_quality)
  ) stored
);

create table node_assertions (
  node_id uuid not null references nodes on delete cascade,
  assertion_id uuid not null references assertions on delete cascade,
  field_name text not null,
  is_primary boolean not null default false,
  primary key(node_id, assertion_id, field_name)
);

create table node_ownership (
  node_id uuid not null references nodes on delete cascade,
  entity_id uuid not null references entities on delete cascade,
  ownership_pct numeric(6,3) check(ownership_pct between 0 and 100),
  effective_from date,
  effective_to date,
  source_assertion_id uuid not null references assertions,
  primary key(node_id, entity_id, effective_from)
);

create table edges (
  edge_id uuid primary key default gen_random_uuid(),
  metal_id uuid not null references metals on delete cascade,
  from_node_id uuid not null references nodes on delete cascade,
  to_node_id uuid not null references nodes on delete cascade,
  edge_type text not null,
  product_form_id uuid references product_forms,
  relationship_status provenance_class not null,
  route_geom geography(linestring,4326),
  effective_from date,
  effective_to date,
  confidence_score smallint not null check(confidence_score between 0 and 100),
  primary_assertion_id uuid not null references assertions,
  check(from_node_id <> to_node_id)
);
create index edges_route_gix on edges using gist(route_geom);

create table metrics (
  metric_id uuid primary key default gen_random_uuid(),
  name text not null unique,
  definition text not null,
  canonical_unit text,
  aggregation_rule text
);

create table observations (
  observation_id uuid primary key default gen_random_uuid(),
  node_id uuid references nodes on delete cascade,
  edge_id uuid references edges on delete cascade,
  country_code char(3),
  metric_id uuid not null references metrics,
  value_numeric numeric,
  value_text text,
  unit text,
  product_form_id uuid references product_forms,
  period_start date not null,
  period_end date not null,
  estimate_type provenance_class not null,
  assertion_id uuid not null references assertions,
  check(num_nonnulls(node_id, edge_id, country_code) = 1),
  check(period_end >= period_start),
  check(value_numeric is not null or value_text is not null)
);

create table trade_flows (
  trade_flow_id uuid primary key default gen_random_uuid(),
  exporter_code char(3) not null,
  importer_code char(3) not null,
  product_form_id uuid not null references product_forms,
  period_start date not null,
  period_end date not null,
  gross_weight_kg numeric,
  trade_value_usd numeric,
  reporter_code char(3),
  partner_code char(3),
  mirror_status text,
  source_id uuid not null references sources,
  provenance provenance_class not null,
  confidence_score smallint not null check(confidence_score between 0 and 100),
  unique(exporter_code, importer_code, product_form_id, period_start, reporter_code, source_id)
);

create table events (
  event_id uuid primary key default gen_random_uuid(),
  event_type text not null,
  headline text not null,
  description text,
  announced_at timestamptz,
  effective_from date,
  effective_to date,
  country_code char(3),
  severity smallint check(severity between 1 and 5),
  source_assertion_id uuid not null references assertions
);

create table event_impacts (
  event_id uuid not null references events on delete cascade,
  node_id uuid references nodes on delete cascade,
  edge_id uuid references edges on delete cascade,
  impact_type text not null,
  impact_direction text,
  confidence_score smallint not null check(confidence_score between 0 and 100),
  check(num_nonnulls(node_id, edge_id) = 1),
  primary key(event_id, node_id, edge_id)
);

insert into metals(name,symbol,description) values ('Antimony','Sb','Antimony supply-risk pilot');
insert into product_forms(metal_id,name,stage,hs_code,unit_basis)
select metal_id,'Antimony ores and concentrates','upstream','261710','gross weight and contained Sb where available' from metals where symbol='Sb';
insert into product_forms(metal_id,name,stage,hs_code,unit_basis)
select metal_id,'Unwrought antimony and powders','refined','811010','gross weight' from metals where symbol='Sb';
insert into product_forms(metal_id,name,stage,hs_code,unit_basis)
select metal_id,'Antimony oxides','processed','282580','gross weight' from metals where symbol='Sb';
