import { formatFieldName, formatMetricName } from '@/lib/format';
import type { AssetDetail } from '@/lib/supabase/queries/asset-detail';
import type { ProvenanceClass, SourceRow } from '@/lib/supabase/types';

export interface SupportedClaim {
  kind: 'Assertion' | 'Observation' | 'Ownership' | 'Event' | 'Connection';
  label: string;
  provenance: ProvenanceClass | null;
  confidence: number | null;
  reference: string | null;
}

export interface AssetSourceEntry {
  source: SourceRow;
  supports: SupportedClaim[];
}

/**
 * Deduplicate every source cited across a node's assertions, observations,
 * ownership records, events and edges, listing what each source supports.
 */
export function collectAssetSources(detail: AssetDetail): AssetSourceEntry[] {
  const bySourceId = new Map<string, AssetSourceEntry>();

  const add = (source: SourceRow | null | undefined, claim: SupportedClaim) => {
    if (!source) return;
    const entry = bySourceId.get(source.source_id) ?? { source, supports: [] };
    entry.supports.push(claim);
    bySourceId.set(source.source_id, entry);
  };

  for (const assertion of detail.assertions) {
    add(assertion.source, {
      kind: 'Assertion',
      label: formatFieldName(assertion.field_name),
      provenance: assertion.provenance,
      confidence: assertion.confidence,
      reference: assertion.source_reference,
    });
  }

  for (const observation of detail.observations) {
    add(observation.source, {
      kind: 'Observation',
      label: formatMetricName(observation.metric_name),
      provenance: observation.provenance,
      confidence: observation.confidence,
      reference: observation.source_reference,
    });
  }

  for (const ownership of detail.ownership) {
    add(ownership.source, {
      kind: 'Ownership',
      label: ownership.entity?.legal_name ?? 'Ownership record',
      provenance: null,
      confidence: null,
      reference: null,
    });
  }

  for (const event of detail.events) {
    add(event.source, {
      kind: 'Event',
      label: event.title,
      provenance: null,
      confidence: null,
      reference: null,
    });
  }

  for (const edge of detail.edges) {
    add(edge.source, {
      kind: 'Connection',
      label: `${edge.from_node?.name ?? '?'} → ${edge.to_node?.name ?? '?'}`,
      provenance: edge.provenance,
      confidence: edge.confidence,
      reference: null,
    });
  }

  return [...bySourceId.values()].sort((a, b) => b.supports.length - a.supports.length);
}
