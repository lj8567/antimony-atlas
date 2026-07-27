/**
 * Row types mirroring supabase/migrations/0001_initial.sql and the
 * public_nodes view from 0002_security.sql. The migrations are the source of
 * truth; do not add fields here that the schema does not have.
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
  description: string | null;
}

export interface EntityRow {
  entity_id: string;
  legal_name: string;
  normalised_name: string;
  entity_type: string;
  country_code: string | null;
  website: string | null;
  active_from: string | null;
  active_to: string | null;
}

export interface ProductFormRow {
  product_form_id: string;
  metal_id: string;
  name: string;
  stage: string;
  hs_code: string | null;
  unit_basis: string | null;
}

export interface NodeRow {
  node_id: string;
  metal_id: string;
  canonical_name: string;
  node_type: string;
  status: NodeStatus;
  status_effective_date: string | null;
  country_code: string;
  region: string | null;
  latitude: number;
  longitude: number;
  location_precision: string;
  operator_entity_id: string | null;
  description: string | null;
  first_seen_at: string;
  last_reviewed_at: string | null;
}

export interface SourceRow {
  source_id: string;
  title: string;
  publisher: string;
  source_type: string;
  publication_date: string | null;
  effective_date: string | null;
  url: string;
  licence: string | null;
  retrieved_at: string;
}

export interface AssertionRow {
  assertion_id: string;
  source_id: string;
  claim_text: string;
  page_reference: string | null;
  table_reference: string | null;
  provenance: ProvenanceClass;
  extraction_method: string;
  reviewer: string | null;
  reviewed_at: string | null;
  source_quality: number;
  recency_score: number;
  directness_score: number;
  corroboration_score: number;
  extraction_quality: number;
  /** generated weighted score, 0–100 */
  confidence_score: number;
}

export interface MetricRow {
  metric_id: string;
  name: string;
  definition: string;
  canonical_unit: string | null;
  aggregation_rule: string | null;
}

export interface ObservationRow {
  observation_id: string;
  node_id: string | null;
  edge_id: string | null;
  country_code: string | null;
  metric_id: string;
  value_numeric: number | null;
  value_text: string | null;
  unit: string | null;
  product_form_id: string | null;
  period_start: string;
  period_end: string;
  estimate_type: ProvenanceClass;
  assertion_id: string;
}

export interface EdgeRow {
  edge_id: string;
  metal_id: string;
  from_node_id: string;
  to_node_id: string;
  edge_type: string;
  product_form_id: string | null;
  relationship_status: ProvenanceClass;
  effective_from: string | null;
  effective_to: string | null;
  confidence_score: number;
  primary_assertion_id: string;
}

export interface TradeFlowRow {
  trade_flow_id: string;
  exporter_code: string;
  importer_code: string;
  product_form_id: string;
  period_start: string;
  period_end: string;
  gross_weight_kg: number | null;
  trade_value_usd: number | null;
  reporter_code: string | null;
  partner_code: string | null;
  mirror_status: string | null;
  source_id: string;
  provenance: ProvenanceClass;
  confidence_score: number;
}

export interface EventRow {
  event_id: string;
  event_type: string;
  headline: string;
  description: string | null;
  announced_at: string | null;
  effective_from: string | null;
  effective_to: string | null;
  country_code: string | null;
  severity: number | null;
  source_assertion_id: string;
}

export interface EventImpactRow {
  event_id: string;
  node_id: string | null;
  edge_id: string | null;
  impact_type: string;
  impact_direction: string | null;
  confidence_score: number;
}

export interface NodeOwnershipRow {
  node_id: string;
  entity_id: string;
  ownership_pct: number | null;
  effective_from: string | null;
  effective_to: string | null;
  source_assertion_id: string;
}

/** public_nodes view: per-node identity provenance and confidence. */
export interface PublicNodeRow {
  node_id: string;
  canonical_name: string;
  node_type: string;
  status: string;
  country_code: string;
  latitude: number;
  longitude: number;
  provenance_class: ProvenanceClass;
  confidence_score: number;
}

/* ------------------------------------------------------------------ */
/* Joined shapes returned by the query modules                         */
/* ------------------------------------------------------------------ */

export interface SourceRef {
  source_id: string;
  title: string;
  publisher: string;
  source_type: string;
  publication_date: string | null;
  url: string;
  licence: string | null;
}

export interface AssertionWithSource {
  assertion_id: string;
  claim_text: string;
  page_reference: string | null;
  table_reference: string | null;
  provenance: ProvenanceClass;
  confidence_score: number;
  reviewed_at: string | null;
  source: SourceRef | null;
}

export interface NodeAssertion {
  field_name: string;
  is_primary: boolean;
  assertion: AssertionWithSource | null;
}

export interface ObservationDetail extends ObservationRow {
  metric: Pick<MetricRow, 'metric_id' | 'name' | 'definition' | 'canonical_unit'> | null;
  product_form: Pick<ProductFormRow, 'product_form_id' | 'name' | 'hs_code'> | null;
  assertion: AssertionWithSource | null;
}

export interface OwnershipDetail extends NodeOwnershipRow {
  entity: Pick<EntityRow, 'entity_id' | 'legal_name' | 'entity_type' | 'country_code' | 'website'> | null;
  assertion: AssertionWithSource | null;
}

export interface EdgeEndpoint {
  node_id: string;
  canonical_name: string;
  node_type: string;
  status: NodeStatus;
  country_code: string;
  latitude: number;
  longitude: number;
}

export interface EdgeDetail extends EdgeRow {
  from_node: EdgeEndpoint | null;
  to_node: EdgeEndpoint | null;
  product_form: Pick<ProductFormRow, 'product_form_id' | 'name'> | null;
  assertion: AssertionWithSource | null;
}

export interface EventDetail extends EventRow {
  assertion: AssertionWithSource | null;
  impacts: Array<
    EventImpactRow & {
      node: Pick<NodeRow, 'node_id' | 'canonical_name' | 'node_type' | 'country_code'> | null;
    }
  >;
}

export interface TradeFlowDetail extends TradeFlowRow {
  product_form: Pick<ProductFormRow, 'product_form_id' | 'name' | 'hs_code'> | null;
  source: SourceRef | null;
}

/** Asset-explorer row: node joined with identity provenance, operator,
 * ownership, its most recent observation and most recent linked event. */
export interface AssetListItem {
  node: NodeRow;
  operator_name: string | null;
  owner_names: string[];
  identity_provenance: ProvenanceClass | null;
  identity_confidence: number | null;
  latest_observation: ObservationDetail | null;
  observation_count: number;
  /** coarse kinds present across ALL of the node's observations (coverage flags) */
  metric_kinds: string[];
  latest_event: Pick<EventRow, 'event_id' | 'headline' | 'event_type' | 'severity' | 'announced_at'> | null;
  source_count: number;
}

export interface SourceListItem extends SourceRow {
  assertions: Array<{
    assertion_id: string;
    provenance: ProvenanceClass;
    confidence_score: number;
    claim_text: string;
    node_assertions: Array<{
      field_name: string;
      node: Pick<NodeRow, 'node_id' | 'canonical_name'> | null;
    }>;
  }>;
}

/* ------------------------------------------------------------------ */
/* Query result envelope                                               */
/* ------------------------------------------------------------------ */

export type QueryResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; unconfigured: boolean };

export function queryError<T>(error: string, unconfigured = false): QueryResult<T> {
  return { ok: false, error, unconfigured };
}
