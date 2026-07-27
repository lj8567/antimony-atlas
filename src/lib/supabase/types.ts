/**
 * Row types mirroring the LIVE Supabase schema (project yfouuxfgkwycixiiayey),
 * per the backend hand-off brief. The live database has diverged from the
 * historical migrations in supabase/migrations/ — the live schema is
 * authoritative for the frontend:
 *
 *  - `assertions` is an entity–attribute–value table (node_id + field_name +
 *    value_text) linked directly to nodes; there is no node_assertions join
 *    table and no claim_text column.
 *  - `observations` carry a free-text `metric_name` (no metrics FK table)
 *    plus provenance/confidence/source_id directly.
 *  - `events` use title / event_type / event_date / severity / summary.
 *  - `nodes` have name, aliases[], owner_entity_id + operator_entity_id,
 *    notes, created_at/updated_at; no location_precision column (precision
 *    is an assertion field), no public_nodes view.
 *  - `edges` and `trade_flows` may not exist yet; queries must tolerate that.
 *
 * Only fields the app actually reads are typed; rows are fetched with
 * select("*") so extra columns are harmless and missing optional ones are
 * handled as undefined/null.
 */

export type ProvenanceClass = 'reported' | 'modelled' | 'unverified';

export type NodeStatus =
  | 'operating'
  | 'development'
  | 'construction'
  | 'care_and_maintenance'
  | 'suspended'
  | 'closed'
  | 'unknown';

export interface MetalRow {
  metal_id: string;
  name: string;
  symbol: string;
}

export interface EntityRow {
  entity_id: string;
  legal_name: string;
  normalised_name: string;
  entity_type: string;
  country_code: string | null;
  website: string | null;
}

export interface ProductFormRow {
  product_form_id: string;
  metal_id: string;
  name: string;
  /** present in the historical migrations; may be absent live */
  hs_code?: string | null;
}

export interface NodeRow {
  node_id: string;
  metal_id: string;
  name: string;
  aliases: string[] | null;
  node_type: string;
  status: NodeStatus;
  country_code: string | null;
  region: string | null;
  latitude: number | null;
  longitude: number | null;
  owner_entity_id: string | null;
  operator_entity_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface SourceRow {
  source_id: string;
  title: string;
  publisher: string | null;
  source_type: string | null;
  publication_date: string | null;
  url: string | null;
  licence: string | null;
}

/** EAV-style qualitative claim attached directly to a node. */
export interface AssertionRow {
  assertion_id?: string;
  node_id: string;
  field_name: string;
  value_text: string | null;
  provenance: ProvenanceClass;
  /** numeric; scale varies (0–1 fraction or 0–100) — normalise before display */
  confidence: number | null;
  source_id: string | null;
  source_reference: string | null;
  effective_date: string | null;
}

export interface ObservationRow {
  observation_id?: string;
  node_id: string;
  product_form_id: string | null;
  metric_name: string;
  value_numeric: number | null;
  unit: string | null;
  period_start: string | null;
  period_end: string | null;
  provenance: ProvenanceClass;
  confidence: number | null;
  source_id: string | null;
  source_reference: string | null;
  notes: string | null;
}

export interface NodeOwnershipRow {
  node_ownership_id?: string;
  node_id: string;
  entity_id: string;
  ownership_percentage: number | null;
  ownership_role: string;
  effective_from: string | null;
  source_id: string | null;
}

export interface EventRow {
  event_id: string;
  node_id: string | null;
  title: string;
  event_type: string | null;
  event_date: string | null;
  severity: number | null;
  summary: string | null;
  source_id: string | null;
}

/** Edge shape per the original design; the live table may not exist yet. */
export interface EdgeRow {
  edge_id: string;
  from_node_id: string;
  to_node_id: string;
  edge_type: string;
  product_form_id: string | null;
  provenance: ProvenanceClass;
  confidence: number | null;
  source_id: string | null;
  notes: string | null;
}

/** Trade-flow shape per the original design; the live table may not exist yet. */
export interface TradeFlowRow {
  trade_flow_id: string;
  exporter_code: string;
  importer_code: string;
  product_form_id: string | null;
  period_start: string;
  period_end: string | null;
  gross_weight_kg: number | null;
  trade_value_usd: number | null;
  reporter_code: string | null;
  mirror_status: string | null;
  source_id: string | null;
  provenance: ProvenanceClass;
  confidence: number | null;
}

/* ------------------------------------------------------------------ */
/* Assembled shapes returned by the query modules (in-memory joins)    */
/* ------------------------------------------------------------------ */

export interface AssertionDetail extends AssertionRow {
  source: SourceRow | null;
}

export interface ObservationDetail extends ObservationRow {
  product_form: ProductFormRow | null;
  source: SourceRow | null;
}

export interface OwnershipDetail extends NodeOwnershipRow {
  entity: EntityRow | null;
  source: SourceRow | null;
}

export interface EventDetail extends EventRow {
  node: Pick<NodeRow, 'node_id' | 'name' | 'node_type' | 'country_code'> | null;
  source: SourceRow | null;
}

export interface EdgeDetail extends EdgeRow {
  from_node: Pick<NodeRow, 'node_id' | 'name' | 'node_type' | 'status' | 'country_code' | 'latitude' | 'longitude'> | null;
  to_node: Pick<NodeRow, 'node_id' | 'name' | 'node_type' | 'status' | 'country_code' | 'latitude' | 'longitude'> | null;
  product_form: ProductFormRow | null;
  source: SourceRow | null;
}

export interface TradeFlowDetail extends TradeFlowRow {
  product_form: ProductFormRow | null;
  source: SourceRow | null;
}

/** Counts of claims (assertions + observations) by provenance class. */
export interface EvidenceCounts {
  reported: number;
  modelled: number;
  unverified: number;
}

/** Asset-explorer row assembled from nodes + entities + claims. */
export interface AssetListItem {
  node: NodeRow;
  owner_name: string | null;
  operator_name: string | null;
  /** principal antimony metric chosen by the documented preference rules */
  principal_observation: ObservationDetail | null;
  observation_count: number;
  assertion_count: number;
  evidence: EvidenceCounts;
  /** highest normalised (0–100) confidence across the node's claims */
  max_confidence: number | null;
  /** location precision from the node's location_precision assertion, if any */
  location_precision: string | null;
  latest_event: Pick<EventRow, 'event_id' | 'title' | 'event_type' | 'severity' | 'event_date'> | null;
  source_count: number;
  /** coarse metric kinds present across all observations (coverage flags) */
  metric_kinds: string[];
}

export interface SourceSupportedClaim {
  kind: 'Assertion' | 'Observation' | 'Ownership' | 'Event';
  label: string;
  node_id: string | null;
  node_name: string | null;
  provenance: ProvenanceClass | null;
  confidence: number | null;
  reference: string | null;
}

export interface SourceListItem extends SourceRow {
  supports: SourceSupportedClaim[];
}

/* ------------------------------------------------------------------ */
/* Query result envelope                                               */
/* ------------------------------------------------------------------ */

export type QueryResult<T> =
  | { ok: true; data: T; warnings: string[] }
  | { ok: false; error: string; unconfigured: boolean };

export function queryOk<T>(data: T, warnings: string[] = []): QueryResult<T> {
  return { ok: true, data, warnings };
}

export function queryError<T>(error: string, unconfigured = false): QueryResult<T> {
  return { ok: false, error, unconfigured };
}
