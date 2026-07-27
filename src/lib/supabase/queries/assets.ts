import { classifyMetricKind } from '@/lib/format';
import { withServerClient } from '../server';
import {
  queryError,
  type AssetListItem,
  type EventRow,
  type NodeRow,
  type ObservationDetail,
  type ProvenanceClass,
  type QueryResult,
} from '../types';
import { OBSERVATION_DETAIL_SELECT } from './fragments';

interface NodeWithOperator extends NodeRow {
  operator: { legal_name: string } | null;
}

interface IdentityRow {
  node_id: string;
  provenance_class: ProvenanceClass;
  confidence_score: number;
}

interface OwnershipNameRow {
  node_id: string;
  effective_to: string | null;
  entity: { legal_name: string } | null;
}

interface ImpactEventRow {
  node_id: string | null;
  event: Pick<EventRow, 'event_id' | 'headline' | 'event_type' | 'severity' | 'announced_at'> | null;
}

interface NodeSourceRow {
  node_id: string;
  assertion: { source_id: string } | null;
}

/**
 * Full asset register with per-node identity provenance, current owners,
 * most recent observation and most recent linked event. Five bounded parallel
 * queries merged in memory — acceptable at pilot scale (≤ a few hundred
 * nodes) and avoids N+1 patterns.
 */
export async function fetchAssetList(): Promise<QueryResult<AssetListItem[]>> {
  return withServerClient(async (client) => {
    const [nodesRes, identityRes, obsRes, ownersRes, impactsRes, sourcesRes] = await Promise.all([
      client
        .from('nodes')
        .select('*, operator:entities!operator_entity_id(legal_name)')
        .order('canonical_name')
        .limit(1000)
        .returns<NodeWithOperator[]>(),
      client
        .from('public_nodes')
        .select('node_id, provenance_class, confidence_score')
        .returns<IdentityRow[]>(),
      client
        .from('observations')
        .select(OBSERVATION_DETAIL_SELECT)
        .not('node_id', 'is', null)
        .order('period_end', { ascending: false })
        .limit(2000)
        .returns<ObservationDetail[]>(),
      client
        .from('node_ownership')
        .select('node_id, effective_to, entity:entities!entity_id(legal_name)')
        .returns<OwnershipNameRow[]>(),
      client
        .from('event_impacts')
        .select('node_id, event:events!event_id(event_id, headline, event_type, severity, announced_at)')
        .not('node_id', 'is', null)
        .returns<ImpactEventRow[]>(),
      client
        .from('node_assertions')
        .select('node_id, assertion:assertions!assertion_id(source_id)')
        .returns<NodeSourceRow[]>(),
    ]);

    const firstError =
      nodesRes.error ?? identityRes.error ?? obsRes.error ?? ownersRes.error ?? impactsRes.error ?? sourcesRes.error;
    if (firstError) return queryError(`Asset query failed: ${firstError.message}`);

    const identityByNode = new Map(identityRes.data?.map((row) => [row.node_id, row]) ?? []);

    const observationsByNode = new Map<string, ObservationDetail[]>();
    for (const obs of obsRes.data ?? []) {
      if (!obs.node_id) continue;
      const list = observationsByNode.get(obs.node_id) ?? [];
      list.push(obs);
      observationsByNode.set(obs.node_id, list);
    }

    const ownersByNode = new Map<string, string[]>();
    for (const row of ownersRes.data ?? []) {
      if (!row.entity?.legal_name) continue;
      if (row.effective_to !== null) continue; // current ownership only
      const list = ownersByNode.get(row.node_id) ?? [];
      if (!list.includes(row.entity.legal_name)) list.push(row.entity.legal_name);
      ownersByNode.set(row.node_id, list);
    }

    const latestEventByNode = new Map<string, ImpactEventRow['event']>();
    for (const row of impactsRes.data ?? []) {
      if (!row.node_id || !row.event) continue;
      const current = latestEventByNode.get(row.node_id);
      if (!current || (row.event.announced_at ?? '') > (current.announced_at ?? '')) {
        latestEventByNode.set(row.node_id, row.event);
      }
    }

    const sourceIdsByNode = new Map<string, Set<string>>();
    for (const row of sourcesRes.data ?? []) {
      if (!row.assertion?.source_id) continue;
      const set = sourceIdsByNode.get(row.node_id) ?? new Set<string>();
      set.add(row.assertion.source_id);
      sourceIdsByNode.set(row.node_id, set);
    }

    const items: AssetListItem[] = (nodesRes.data ?? []).map((node) => {
      const identity = identityByNode.get(node.node_id);
      const observations = observationsByNode.get(node.node_id) ?? [];
      return {
        node,
        operator_name: node.operator?.legal_name ?? null,
        owner_names: ownersByNode.get(node.node_id) ?? [],
        identity_provenance: identity?.provenance_class ?? null,
        identity_confidence: identity?.confidence_score ?? null,
        latest_observation: observations[0] ?? null,
        observation_count: observations.length,
        metric_kinds: [...new Set(observations.map((obs) => classifyMetricKind(obs.metric?.name)))],
        latest_event: latestEventByNode.get(node.node_id) ?? null,
        source_count: sourceIdsByNode.get(node.node_id)?.size ?? 0,
      };
    });

    return { ok: true, data: items };
  });
}
