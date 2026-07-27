import { formatFieldName } from '@/lib/format';
import type { AssetDetail } from '@/lib/supabase/queries/asset-detail';
import type { ProvenanceClass, SourceRef } from '@/lib/supabase/types';

export interface SupportedClaim {
  kind: 'Assertion' | 'Observation' | 'Ownership' | 'Connection' | 'Event';
  label: string;
  provenance: ProvenanceClass;
  confidence: number;
  reference: string | null;
}

export interface AssetSourceEntry {
  source: SourceRef;
  supports: SupportedClaim[];
}

/**
 * Deduplicate every source cited across a node's assertions, observations,
 * ownership records, edges and events, listing what each source supports.
 */
export function collectAssetSources(detail: AssetDetail): AssetSourceEntry[] {
  const bySourceId = new Map<string, AssetSourceEntry>();

  const add = (source: SourceRef | null | undefined, claim: SupportedClaim) => {
    if (!source) return;
    const entry = bySourceId.get(source.source_id) ?? { source, supports: [] };
    entry.supports.push(claim);
    bySourceId.set(source.source_id, entry);
  };

  for (const nodeAssertion of detail.assertions) {
    const assertion = nodeAssertion.assertion;
    if (!assertion) continue;
    add(assertion.source, {
      kind: 'Assertion',
      label: formatFieldName(nodeAssertion.field_name),
      provenance: assertion.provenance,
      confidence: assertion.confidence_score,
      reference: assertion.page_reference ?? assertion.table_reference,
    });
  }

  for (const observation of detail.observations) {
    const assertion = observation.assertion;
    if (!assertion) continue;
    add(assertion.source, {
      kind: 'Observation',
      label: observation.metric?.name ?? 'Quantitative observation',
      provenance: assertion.provenance,
      confidence: assertion.confidence_score,
      reference: assertion.page_reference ?? assertion.table_reference,
    });
  }

  for (const ownership of detail.ownership) {
    const assertion = ownership.assertion;
    if (!assertion) continue;
    add(assertion.source, {
      kind: 'Ownership',
      label: ownership.entity?.legal_name ?? 'Ownership record',
      provenance: assertion.provenance,
      confidence: assertion.confidence_score,
      reference: assertion.page_reference ?? assertion.table_reference,
    });
  }

  for (const edge of detail.edges) {
    const assertion = edge.assertion;
    if (!assertion) continue;
    add(assertion.source, {
      kind: 'Connection',
      label: `${edge.from_node?.canonical_name ?? '?'} → ${edge.to_node?.canonical_name ?? '?'}`,
      provenance: assertion.provenance,
      confidence: assertion.confidence_score,
      reference: assertion.page_reference ?? assertion.table_reference,
    });
  }

  for (const event of detail.events) {
    const assertion = event.assertion;
    if (!assertion) continue;
    add(assertion.source, {
      kind: 'Event',
      label: event.headline,
      provenance: assertion.provenance,
      confidence: assertion.confidence_score,
      reference: assertion.page_reference ?? assertion.table_reference,
    });
  }

  return [...bySourceId.values()].sort((a, b) => b.supports.length - a.supports.length);
}
