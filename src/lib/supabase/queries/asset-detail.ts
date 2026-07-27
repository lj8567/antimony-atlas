import { withServerClient } from '../server';
import {
  queryError,
  type EdgeDetail,
  type EventDetail,
  type EventImpactRow,
  type EventRow,
  type NodeAssertion,
  type NodeRow,
  type ObservationDetail,
  type OwnershipDetail,
  type QueryResult,
} from '../types';
import { ASSERTION_WITH_SOURCE_SELECT, EDGE_DETAIL_SELECT, OBSERVATION_DETAIL_SELECT } from './fragments';

export interface AssetDetail {
  node: NodeRow & { operator: { entity_id: string; legal_name: string; website: string | null } | null };
  assertions: NodeAssertion[];
  ownership: OwnershipDetail[];
  observations: ObservationDetail[];
  edges: EdgeDetail[];
  events: EventDetail[];
}

interface ImpactWithEvent extends EventImpactRow {
  event: (EventRow & { assertion: EventDetail['assertion'] }) | null;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function fetchAssetDetail(nodeId: string): Promise<QueryResult<AssetDetail | null>> {
  if (!UUID_PATTERN.test(nodeId)) return { ok: true, data: null };

  return withServerClient(async (client) => {
    const [nodeRes, assertionsRes, ownershipRes, observationsRes, edgesRes, impactsRes] = await Promise.all([
      client
        .from('nodes')
        .select('*, operator:entities!operator_entity_id(entity_id, legal_name, website)')
        .eq('node_id', nodeId)
        .maybeSingle<AssetDetail['node']>(),
      client
        .from('node_assertions')
        .select(`field_name, is_primary, assertion:assertions!assertion_id(${ASSERTION_WITH_SOURCE_SELECT})`)
        .eq('node_id', nodeId)
        .returns<NodeAssertion[]>(),
      client
        .from('node_ownership')
        .select(
          `*, entity:entities!entity_id(entity_id, legal_name, entity_type, country_code, website), assertion:assertions!source_assertion_id(${ASSERTION_WITH_SOURCE_SELECT})`,
        )
        .eq('node_id', nodeId)
        .returns<OwnershipDetail[]>(),
      client
        .from('observations')
        .select(OBSERVATION_DETAIL_SELECT)
        .eq('node_id', nodeId)
        .order('period_end', { ascending: false })
        .returns<ObservationDetail[]>(),
      client
        .from('edges')
        .select(EDGE_DETAIL_SELECT)
        .or(`from_node_id.eq.${nodeId},to_node_id.eq.${nodeId}`)
        .returns<EdgeDetail[]>(),
      client
        .from('event_impacts')
        .select(
          `event_id, node_id, edge_id, impact_type, impact_direction, confidence_score, event:events!event_id(*, assertion:assertions!source_assertion_id(${ASSERTION_WITH_SOURCE_SELECT}))`,
        )
        .eq('node_id', nodeId)
        .returns<ImpactWithEvent[]>(),
    ]);

    const firstError =
      nodeRes.error ??
      assertionsRes.error ??
      ownershipRes.error ??
      observationsRes.error ??
      edgesRes.error ??
      impactsRes.error;
    if (firstError) return queryError(`Asset detail query failed: ${firstError.message}`);
    if (!nodeRes.data) return { ok: true, data: null };

    const events: EventDetail[] = (impactsRes.data ?? [])
      .filter((impact) => impact.event !== null)
      .map((impact) => ({
        ...(impact.event as EventRow),
        assertion: impact.event?.assertion ?? null,
        impacts: [
          {
            event_id: impact.event_id,
            node_id: impact.node_id,
            edge_id: impact.edge_id,
            impact_type: impact.impact_type,
            impact_direction: impact.impact_direction,
            confidence_score: impact.confidence_score,
            node: null,
          },
        ],
      }))
      .sort((a, b) => (b.announced_at ?? '').localeCompare(a.announced_at ?? ''));

    return {
      ok: true,
      data: {
        node: nodeRes.data,
        assertions: assertionsRes.data ?? [],
        ownership: ownershipRes.data ?? [],
        observations: observationsRes.data ?? [],
        edges: edgesRes.data ?? [],
        events,
      },
    };
  });
}
