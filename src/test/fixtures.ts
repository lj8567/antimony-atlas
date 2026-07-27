/**
 * Test fixtures shaped like the LIVE Supabase schema, modelled on the seeded
 * records (Stibnite, Costerfield, Thompson Falls…). Used only by the
 * automated tests — never by application pages.
 */

import type {
  AssertionRow,
  AssetListItem,
  EventDetail,
  NodeRow,
  ObservationDetail,
  ObservationRow,
  SourceRow,
  TradeFlowDetail,
} from '@/lib/supabase/types';
import type { AtlasData } from '@/lib/supabase/queries/core';

export const STIBNITE_ID = '11111111-1111-4111-8111-111111111111';
export const COSTERFIELD_ID = '22222222-2222-4222-8222-222222222222';

export const feasibilitySource: SourceRow = {
  source_id: 'cccccccc-0000-4000-8000-000000000001',
  title: 'Stibnite Gold Project Technical Report Summary',
  publisher: 'Perpetua Resources Corp.',
  source_type: 'technical_report',
  publication_date: '2025-01-15',
  url: 'https://example.com/stibnite-feasibility',
  licence: null,
};

export const stibniteNode: NodeRow = {
  node_id: STIBNITE_ID,
  metal_id: 'metal-1',
  name: 'Stibnite Gold Project',
  aliases: ['Stibnite'],
  node_type: 'development_project',
  status: 'construction',
  country_code: 'USA',
  region: 'Valley County, Idaho',
  latitude: 44.91,
  longitude: -115.34,
  owner_entity_id: 'entity-1',
  operator_entity_id: 'entity-1',
  notes: 'Gold-antimony project in central Idaho.',
  created_at: '2025-01-01T00:00:00Z',
  updated_at: '2026-06-15T00:00:00Z',
};

export const stibniteObservation: ObservationDetail = {
  observation_id: 'obs-1',
  node_id: STIBNITE_ID,
  product_form_id: 'form-1',
  metric_name: 'antimony_production',
  value_numeric: 12300,
  unit: 'tonnes Sb contained',
  period_start: '2028-01-01',
  period_end: '2028-12-31',
  provenance: 'modelled',
  confidence: 0.78,
  source_id: feasibilitySource.source_id,
  source_reference: 'p. 22',
  notes: 'Modelled conversion from reported pounds.',
  product_form: { product_form_id: 'form-1', metal_id: 'metal-1', name: 'Antimony concentrate' },
  source: feasibilitySource,
};

export function makeAsset(overrides: Partial<NodeRow> = {}, rest: Partial<AssetListItem> = {}): AssetListItem {
  return {
    node: { ...stibniteNode, ...overrides },
    owner_name: 'Perpetua Resources Corp.',
    operator_name: 'Perpetua Resources Corp.',
    principal_observation: stibniteObservation,
    observation_count: 3,
    assertion_count: 4,
    evidence: { reported: 5, modelled: 2, unverified: 0 },
    max_confidence: 82,
    location_precision: 'approximate',
    latest_event: {
      event_id: 'event-1',
      title: 'Construction start announced',
      event_type: 'construction_update',
      severity: 2,
      event_date: '2025-06-10',
    },
    source_count: 4,
    metric_kinds: ['production', 'capacity'],
    ...rest,
  };
}

export const costerfield: AssetListItem = makeAsset(
  {
    node_id: COSTERFIELD_ID,
    name: 'Costerfield Operation',
    aliases: null,
    node_type: 'mine_and_concentrator',
    status: 'operating',
    country_code: 'AUS',
    region: 'Victoria',
    latitude: -36.88,
    longitude: 144.79,
  },
  {
    owner_name: 'Alkane Resources Limited',
    operator_name: 'Alkane Resources Limited',
    principal_observation: null,
    observation_count: 0,
    assertion_count: 1,
    evidence: { reported: 1, modelled: 0, unverified: 0 },
    max_confidence: 90,
    location_precision: 'exact',
    latest_event: null,
    source_count: 1,
    metric_kinds: [],
  },
);

export const sampleEvent: EventDetail = {
  event_id: 'event-1',
  node_id: STIBNITE_ID,
  title: 'Final federal permit issued',
  event_type: 'commissioning_milestone',
  event_date: '2025-01-06',
  severity: 3,
  summary: 'Record of decision issued for the Stibnite Gold Project.',
  source_id: feasibilitySource.source_id,
  node: { node_id: STIBNITE_ID, name: 'Stibnite Gold Project', node_type: 'development_project', country_code: 'USA' },
  source: feasibilitySource,
};

export const sampleTradeFlow: TradeFlowDetail = {
  trade_flow_id: 'flow-1',
  exporter_code: 'AUS',
  importer_code: 'USA',
  product_form_id: 'form-1',
  period_start: '2024-01-01',
  period_end: '2024-12-31',
  gross_weight_kg: 2_500_000,
  trade_value_usd: 9_000_000,
  reporter_code: 'AUS',
  mirror_status: 'reporter',
  source_id: feasibilitySource.source_id,
  provenance: 'reported',
  confidence: 88,
  product_form: { product_form_id: 'form-1', metal_id: 'metal-1', name: 'Antimony concentrate' },
  source: feasibilitySource,
};

/* ------------------------------------------------------------------ */
/* Raw AtlasData bundle for assembly tests                             */
/* ------------------------------------------------------------------ */

const rawAssertions: AssertionRow[] = [
  {
    node_id: STIBNITE_ID,
    field_name: 'operating_status',
    value_text: 'Early works construction under way',
    provenance: 'reported',
    confidence: 0.88,
    source_id: feasibilitySource.source_id,
    source_reference: 'p. 3',
    effective_date: '2025-06-01',
  },
  {
    node_id: STIBNITE_ID,
    field_name: 'operating_status',
    value_text: 'Awaiting record of decision',
    provenance: 'reported',
    confidence: 0.8,
    source_id: feasibilitySource.source_id,
    source_reference: 'p. 2',
    effective_date: '2024-06-01',
  },
  {
    node_id: STIBNITE_ID,
    field_name: 'location_precision',
    value_text: 'approximate',
    provenance: 'modelled',
    confidence: 0.6,
    source_id: null,
    source_reference: null,
    effective_date: null,
  },
];

const rawObservations: ObservationRow[] = [
  // actual production, pounds (reported) and tonnes (modelled) — never summed
  {
    observation_id: 'obs-lb',
    node_id: STIBNITE_ID,
    product_form_id: null,
    metric_name: 'antimony_production',
    value_numeric: 1_409_000,
    unit: 'pounds Sb contained',
    period_start: '2025-01-01',
    period_end: '2025-12-31',
    provenance: 'reported',
    confidence: 0.9,
    source_id: feasibilitySource.source_id,
    source_reference: null,
    notes: null,
  },
  {
    observation_id: 'obs-t',
    node_id: STIBNITE_ID,
    product_form_id: null,
    metric_name: 'antimony_production',
    value_numeric: 639.1,
    unit: 'tonnes Sb contained',
    period_start: '2025-01-01',
    period_end: '2025-12-31',
    provenance: 'modelled',
    confidence: 0.85,
    source_id: feasibilitySource.source_id,
    source_reference: null,
    notes: 'Metric conversion of reported pounds.',
  },
  {
    observation_id: 'obs-cap',
    node_id: STIBNITE_ID,
    product_form_id: null,
    metric_name: 'processing_design_capacity',
    value_numeric: 22_000,
    unit: 'short tons ore per day',
    period_start: '2028-01-01',
    period_end: '2028-12-31',
    provenance: 'reported',
    confidence: 0.84,
    source_id: feasibilitySource.source_id,
    source_reference: 'p. 14',
    notes: null,
  },
  {
    observation_id: 'obs-res',
    node_id: STIBNITE_ID,
    product_form_id: null,
    metric_name: 'measured_and_indicated_contained_antimony',
    value_numeric: 67_100,
    unit: 'tonnes Sb contained',
    period_start: '2024-12-31',
    period_end: '2024-12-31',
    provenance: 'reported',
    confidence: 0.86,
    source_id: feasibilitySource.source_id,
    source_reference: 'p. 22',
    notes: null,
  },
];

export const atlasFixture: AtlasData = {
  nodes: [
    stibniteNode,
    {
      ...stibniteNode,
      node_id: COSTERFIELD_ID,
      name: 'Costerfield Operation',
      aliases: null,
      node_type: 'mine_and_concentrator',
      status: 'operating',
      country_code: 'AUS',
      region: 'Victoria',
      owner_entity_id: 'entity-2',
      operator_entity_id: 'entity-2',
    },
  ],
  entities: [
    {
      entity_id: 'entity-1',
      legal_name: 'Perpetua Resources Corp.',
      normalised_name: 'perpetua resources',
      entity_type: 'company',
      country_code: 'USA',
      website: 'https://example.com',
    },
    {
      entity_id: 'entity-2',
      legal_name: 'Alkane Resources Limited',
      normalised_name: 'alkane resources',
      entity_type: 'company',
      country_code: 'AUS',
      website: null,
    },
  ],
  productForms: [{ product_form_id: 'form-1', metal_id: 'metal-1', name: 'Antimony concentrate' }],
  sources: [feasibilitySource],
  assertions: rawAssertions,
  observations: rawObservations,
  ownership: [
    {
      node_ownership_id: 'own-1',
      node_id: STIBNITE_ID,
      entity_id: 'entity-1',
      ownership_percentage: 100,
      ownership_role: 'owner',
      effective_from: '2021-02-01',
      source_id: feasibilitySource.source_id,
    },
  ],
  events: [
    {
      event_id: 'event-1',
      node_id: STIBNITE_ID,
      title: 'Final federal permit issued',
      event_type: 'commissioning_milestone',
      event_date: '2025-01-06',
      severity: 3,
      summary: 'Record of decision issued.',
      source_id: feasibilitySource.source_id,
    },
  ],
  edges: [],
  tradeFlows: [],
  tradeTableExists: false,
  edgeTableExists: false,
};
