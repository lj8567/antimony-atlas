import { withServerClient } from '../server';
import {
  queryError,
  type EventDetail,
  type ObservationDetail,
  type ProvenanceClass,
  type QueryResult,
} from '../types';
import { EVENT_DETAIL_SELECT, OBSERVATION_DETAIL_SELECT } from './fragments';

export interface OverviewNode {
  node_id: string;
  canonical_name: string;
  node_type: string;
  status: string;
  country_code: string;
  last_reviewed_at: string | null;
}

export interface OverviewData {
  nodes: OverviewNode[];
  identity: Array<{ node_id: string; provenance_class: ProvenanceClass; confidence_score: number }>;
  assertions: Array<{ provenance: ProvenanceClass; confidence_score: number }>;
  observations: ObservationDetail[];
  recentEvents: EventDetail[];
  sourceCount: number;
  tradeFlowCount: number;
}

export async function fetchOverviewData(): Promise<QueryResult<OverviewData>> {
  return withServerClient(async (client) => {
    const [nodesRes, identityRes, assertionsRes, obsRes, eventsRes, sourcesRes, tradeRes] = await Promise.all([
      client
        .from('nodes')
        .select('node_id, canonical_name, node_type, status, country_code, last_reviewed_at')
        .limit(2000)
        .returns<OverviewNode[]>(),
      client
        .from('public_nodes')
        .select('node_id, provenance_class, confidence_score')
        .returns<OverviewData['identity']>(),
      client
        .from('assertions')
        .select('provenance, confidence_score')
        .limit(5000)
        .returns<OverviewData['assertions']>(),
      client
        .from('observations')
        .select(OBSERVATION_DETAIL_SELECT)
        .order('period_end', { ascending: false })
        .limit(300)
        .returns<ObservationDetail[]>(),
      client
        .from('events')
        .select(EVENT_DETAIL_SELECT)
        .order('announced_at', { ascending: false, nullsFirst: false })
        .limit(8)
        .returns<EventDetail[]>(),
      client.from('sources').select('source_id', { count: 'exact', head: true }),
      client.from('trade_flows').select('trade_flow_id', { count: 'exact', head: true }),
    ]);

    const firstError =
      nodesRes.error ??
      identityRes.error ??
      assertionsRes.error ??
      obsRes.error ??
      eventsRes.error ??
      sourcesRes.error ??
      tradeRes.error;
    if (firstError) return queryError(`Overview query failed: ${firstError.message}`);

    return {
      ok: true,
      data: {
        nodes: nodesRes.data ?? [],
        identity: identityRes.data ?? [],
        assertions: assertionsRes.data ?? [],
        observations: obsRes.data ?? [],
        recentEvents: eventsRes.data ?? [],
        sourceCount: sourcesRes.count ?? 0,
        tradeFlowCount: tradeRes.count ?? 0,
      },
    };
  });
}
