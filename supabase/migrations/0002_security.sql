alter table metals enable row level security;
alter table entities enable row level security;
alter table product_forms enable row level security;
alter table nodes enable row level security;
alter table sources enable row level security;
alter table assertions enable row level security;
alter table node_assertions enable row level security;
alter table node_ownership enable row level security;
alter table edges enable row level security;
alter table metrics enable row level security;
alter table observations enable row level security;
alter table trade_flows enable row level security;
alter table events enable row level security;
alter table event_impacts enable row level security;

create view public_nodes as
select n.node_id, n.canonical_name, n.node_type, n.status::text, n.country_code,
       n.latitude::float8, n.longitude::float8,
       coalesce(a.provenance::text,'unverified') as provenance_class,
       coalesce(a.confidence_score,0) as confidence_score
from nodes n
left join lateral (
  select ar.provenance, ar.confidence_score
  from node_assertions na join assertions ar using(assertion_id)
  where na.node_id=n.node_id and na.field_name='identity' and na.is_primary=true
  order by ar.confidence_score desc limit 1
) a on true;

create policy "Public read metals" on metals for select to anon using(true);
create policy "Public read product forms" on product_forms for select to anon using(true);
create policy "Public read nodes" on nodes for select to anon using(true);
create policy "Public read sources" on sources for select to anon using(true);
create policy "Public read assertions" on assertions for select to anon using(true);
create policy "Public read node assertions" on node_assertions for select to anon using(true);
create policy "Public read ownership" on node_ownership for select to anon using(true);
create policy "Public read entities" on entities for select to anon using(true);
create policy "Public read edges" on edges for select to anon using(true);
create policy "Public read observations" on observations for select to anon using(true);
create policy "Public read trade" on trade_flows for select to anon using(true);
create policy "Public read events" on events for select to anon using(true);
create policy "Public read event impacts" on event_impacts for select to anon using(true);

grant select on public_nodes to anon, authenticated;
grant select on metals, product_forms, nodes, sources, assertions, node_assertions, node_ownership, entities, edges, observations, trade_flows, events, event_impacts to anon, authenticated;
