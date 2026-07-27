import { classifyMetricKind, normalizeConfidence } from '@/lib/format';
import type {
  AssertionDetail,
  AssertionRow,
  AssetListItem,
  EdgeDetail,
  EventDetail,
  EvidenceCounts,
  ObservationDetail,
  OwnershipDetail,
  SourceListItem,
  SourceSupportedClaim,
  TradeFlowDetail,
} from '../types';
import type { AtlasData } from './core';

/**
 * In-memory joins and display-policy rules for the live schema. All logic
 * here is pure and unit-testable; nothing invents data — it only links rows
 * by id and applies the documented selection preferences.
 */

export interface AtlasIndex {
  entityById: Map<string, AtlasData['entities'][number]>;
  sourceById: Map<string, AtlasData['sources'][number]>;
  productFormById: Map<string, AtlasData['productForms'][number]>;
  nodeById: Map<string, AtlasData['nodes'][number]>;
  assertionsByNode: Map<string, AssertionRow[]>;
  observationsByNode: Map<string, ObservationDetail[]>;
}

export function buildIndex(data: AtlasData): AtlasIndex {
  const entityById = new Map(data.entities.map((entity) => [entity.entity_id, entity]));
  const sourceById = new Map(data.sources.map((source) => [source.source_id, source]));
  const productFormById = new Map(data.productForms.map((form) => [form.product_form_id, form]));
  const nodeById = new Map(data.nodes.map((node) => [node.node_id, node]));

  const assertionsByNode = new Map<string, AssertionRow[]>();
  for (const assertion of data.assertions) {
    const list = assertionsByNode.get(assertion.node_id) ?? [];
    list.push(assertion);
    assertionsByNode.set(assertion.node_id, list);
  }
  // newest effective date first; ties keep insertion order
  for (const list of assertionsByNode.values()) {
    list.sort((a, b) => (b.effective_date ?? '').localeCompare(a.effective_date ?? ''));
  }

  const observationsByNode = new Map<string, ObservationDetail[]>();
  for (const observation of data.observations) {
    const detail: ObservationDetail = {
      ...observation,
      product_form: observation.product_form_id ? (productFormById.get(observation.product_form_id) ?? null) : null,
      source: observation.source_id ? (sourceById.get(observation.source_id) ?? null) : null,
    };
    const list = observationsByNode.get(observation.node_id) ?? [];
    list.push(detail);
    observationsByNode.set(observation.node_id, list);
  }
  for (const list of observationsByNode.values()) {
    list.sort((a, b) => (b.period_end ?? '').localeCompare(a.period_end ?? ''));
  }

  return { entityById, sourceById, productFormById, nodeById, assertionsByNode, observationsByNode };
}

/* ------------------------------------------------------------------ */
/* Principal metric selection                                          */
/* ------------------------------------------------------------------ */

const PRODUCTION_METRICS = new Set(['antimony_production', 'antimony_finished_goods_production']);
const CAPACITY_METRICS = new Set([
  'processing_design_capacity',
  'antimony_products_nameplate_capacity',
  'antimony_feed_processing_capacity',
]);

/**
 * Preference order for the single metric shown in list views (the full,
 * qualified metric list always lives on the detail page):
 *  1. actual antimony production in contained-tonnes units, latest period;
 *  2. actual antimony production in any unit;
 *  3. plant/nameplate/feed capacity;
 *  4. the most recent observation of any kind.
 * Categories are never mixed and the label always carries the metric name
 * and unit, so a capacity can never read as production.
 */
export function pickPrincipalObservation(observations: ObservationDetail[]): ObservationDetail | null {
  if (observations.length === 0) return null;
  const byPeriod = [...observations].sort((a, b) => (b.period_end ?? '').localeCompare(a.period_end ?? ''));
  const production = byPeriod.filter((obs) => PRODUCTION_METRICS.has(obs.metric_name));
  const tonnesProduction = production.find((obs) => (obs.unit ?? '').toLowerCase().startsWith('tonnes sb'));
  if (tonnesProduction) return tonnesProduction;
  if (production.length > 0) return production[0];
  const capacity = byPeriod.find((obs) => CAPACITY_METRICS.has(obs.metric_name));
  if (capacity) return capacity;
  return byPeriod[0];
}

/* ------------------------------------------------------------------ */
/* Evidence summaries                                                  */
/* ------------------------------------------------------------------ */

export function countEvidence(assertions: AssertionRow[], observations: ObservationDetail[]): EvidenceCounts {
  const counts: EvidenceCounts = { reported: 0, modelled: 0, unverified: 0 };
  for (const claim of [...assertions, ...observations]) {
    if (claim.provenance in counts) counts[claim.provenance] += 1;
  }
  return counts;
}

export function maxClaimConfidence(assertions: AssertionRow[], observations: ObservationDetail[]): number | null {
  let max: number | null = null;
  for (const claim of [...assertions, ...observations]) {
    const normalized = normalizeConfidence(claim.confidence);
    if (normalized !== null && (max === null || normalized > max)) max = normalized;
  }
  return max;
}

/** Location precision comes from the node's location_precision assertion. */
export function locationPrecisionOf(assertions: AssertionRow[]): string | null {
  const claim = assertions.find((assertion) => assertion.field_name === 'location_precision');
  return claim?.value_text ?? null;
}

function distinctSourceCount(
  assertions: AssertionRow[],
  observations: ObservationDetail[],
  ownership: AtlasData['ownership'],
  events: AtlasData['events'],
  nodeId: string,
): number {
  const ids = new Set<string>();
  for (const row of assertions) if (row.source_id) ids.add(row.source_id);
  for (const row of observations) if (row.source_id) ids.add(row.source_id);
  for (const row of ownership) if (row.node_id === nodeId && row.source_id) ids.add(row.source_id);
  for (const row of events) if (row.node_id === nodeId && row.source_id) ids.add(row.source_id);
  return ids.size;
}

/* ------------------------------------------------------------------ */
/* Asset list                                                          */
/* ------------------------------------------------------------------ */

export function buildAssetList(data: AtlasData, index: AtlasIndex = buildIndex(data)): AssetListItem[] {
  const latestEventByNode = new Map<string, AtlasData['events'][number]>();
  for (const event of data.events) {
    if (!event.node_id) continue;
    const current = latestEventByNode.get(event.node_id);
    if (!current || (event.event_date ?? '') > (current.event_date ?? '')) {
      latestEventByNode.set(event.node_id, event);
    }
  }

  return [...data.nodes]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((node) => {
      const assertions = index.assertionsByNode.get(node.node_id) ?? [];
      const observations = index.observationsByNode.get(node.node_id) ?? [];
      const latestEvent = latestEventByNode.get(node.node_id) ?? null;
      return {
        node,
        owner_name: node.owner_entity_id ? (index.entityById.get(node.owner_entity_id)?.legal_name ?? null) : null,
        operator_name: node.operator_entity_id
          ? (index.entityById.get(node.operator_entity_id)?.legal_name ?? null)
          : null,
        principal_observation: pickPrincipalObservation(observations),
        observation_count: observations.length,
        assertion_count: assertions.length,
        evidence: countEvidence(assertions, observations),
        max_confidence: maxClaimConfidence(assertions, observations),
        location_precision: locationPrecisionOf(assertions),
        latest_event: latestEvent
          ? {
              event_id: latestEvent.event_id,
              title: latestEvent.title,
              event_type: latestEvent.event_type,
              severity: latestEvent.severity,
              event_date: latestEvent.event_date,
            }
          : null,
        source_count: distinctSourceCount(assertions, observations, data.ownership, data.events, node.node_id),
        metric_kinds: [...new Set(observations.map((obs) => classifyMetricKind(obs.metric_name)))],
      };
    });
}

/* ------------------------------------------------------------------ */
/* Detail shapes                                                       */
/* ------------------------------------------------------------------ */

export function assertionDetails(assertions: AssertionRow[], index: AtlasIndex): AssertionDetail[] {
  return assertions.map((assertion) => ({
    ...assertion,
    source: assertion.source_id ? (index.sourceById.get(assertion.source_id) ?? null) : null,
  }));
}

export function ownershipDetails(data: AtlasData, index: AtlasIndex, nodeId: string): OwnershipDetail[] {
  return data.ownership
    .filter((row) => row.node_id === nodeId)
    .map((row) => ({
      ...row,
      entity: index.entityById.get(row.entity_id) ?? null,
      source: row.source_id ? (index.sourceById.get(row.source_id) ?? null) : null,
    }))
    .sort((a, b) => (b.effective_from ?? '').localeCompare(a.effective_from ?? ''));
}

export function eventDetails(data: AtlasData, index: AtlasIndex, nodeId?: string): EventDetail[] {
  return data.events
    .filter((event) => nodeId === undefined || event.node_id === nodeId)
    .map((event) => {
      const node = event.node_id ? (index.nodeById.get(event.node_id) ?? null) : null;
      return {
        ...event,
        node: node
          ? { node_id: node.node_id, name: node.name, node_type: node.node_type, country_code: node.country_code }
          : null,
        source: event.source_id ? (index.sourceById.get(event.source_id) ?? null) : null,
      };
    })
    .sort((a, b) => (b.event_date ?? '').localeCompare(a.event_date ?? ''));
}

export function edgeDetails(data: AtlasData, index: AtlasIndex): EdgeDetail[] {
  const endpoint = (id: string) => {
    const node = index.nodeById.get(id);
    return node
      ? {
          node_id: node.node_id,
          name: node.name,
          node_type: node.node_type,
          status: node.status,
          country_code: node.country_code,
          latitude: node.latitude,
          longitude: node.longitude,
        }
      : null;
  };
  return data.edges.map((edge) => ({
    ...edge,
    from_node: endpoint(edge.from_node_id),
    to_node: endpoint(edge.to_node_id),
    product_form: edge.product_form_id ? (index.productFormById.get(edge.product_form_id) ?? null) : null,
    source: edge.source_id ? (index.sourceById.get(edge.source_id) ?? null) : null,
  }));
}

export function tradeFlowDetails(data: AtlasData, index: AtlasIndex): TradeFlowDetail[] {
  return data.tradeFlows
    .map((flow) => ({
      ...flow,
      product_form: flow.product_form_id ? (index.productFormById.get(flow.product_form_id) ?? null) : null,
      source: flow.source_id ? (index.sourceById.get(flow.source_id) ?? null) : null,
    }))
    .sort((a, b) => (b.period_start ?? '').localeCompare(a.period_start ?? ''));
}

/* ------------------------------------------------------------------ */
/* Source register                                                     */
/* ------------------------------------------------------------------ */

export function buildSourceList(data: AtlasData, index: AtlasIndex = buildIndex(data)): SourceListItem[] {
  const supportsBySource = new Map<string, SourceSupportedClaim[]>();
  const push = (sourceId: string | null, claim: SourceSupportedClaim) => {
    if (!sourceId) return;
    const list = supportsBySource.get(sourceId) ?? [];
    list.push(claim);
    supportsBySource.set(sourceId, list);
  };

  for (const assertion of data.assertions) {
    push(assertion.source_id, {
      kind: 'Assertion',
      label: `${assertion.field_name}: ${assertion.value_text ?? '—'}`,
      node_id: assertion.node_id,
      node_name: index.nodeById.get(assertion.node_id)?.name ?? null,
      provenance: assertion.provenance,
      confidence: assertion.confidence,
      reference: assertion.source_reference,
    });
  }
  for (const observation of data.observations) {
    push(observation.source_id, {
      kind: 'Observation',
      label: observation.metric_name,
      node_id: observation.node_id,
      node_name: index.nodeById.get(observation.node_id)?.name ?? null,
      provenance: observation.provenance,
      confidence: observation.confidence,
      reference: observation.source_reference,
    });
  }
  for (const ownership of data.ownership) {
    push(ownership.source_id, {
      kind: 'Ownership',
      label: `${index.entityById.get(ownership.entity_id)?.legal_name ?? 'Ownership record'} (${ownership.ownership_role})`,
      node_id: ownership.node_id,
      node_name: index.nodeById.get(ownership.node_id)?.name ?? null,
      provenance: null,
      confidence: null,
      reference: null,
    });
  }
  for (const event of data.events) {
    push(event.source_id, {
      kind: 'Event',
      label: event.title,
      node_id: event.node_id,
      node_name: event.node_id ? (index.nodeById.get(event.node_id)?.name ?? null) : null,
      provenance: null,
      confidence: null,
      reference: null,
    });
  }

  return [...data.sources]
    .map((source) => ({ ...source, supports: supportsBySource.get(source.source_id) ?? [] }))
    .sort(
      (a, b) =>
        (b.publication_date ?? '').localeCompare(a.publication_date ?? '') || a.title.localeCompare(b.title),
    );
}
