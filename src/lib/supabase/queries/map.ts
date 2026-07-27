import { withServerClient } from '../server';
import {
  queryError,
  type EdgeDetail,
  type NodeRow,
  type ProvenanceClass,
  type QueryResult,
} from '../types';
import { EDGE_DETAIL_SELECT } from './fragments';

export interface MapNode extends NodeRow {
  identity_provenance: ProvenanceClass | null;
  identity_confidence: number | null;
}

export interface MapEventMarker {
  event_id: string;
  node_id: string;
  headline: string;
  event_type: string;
  severity: number | null;
  announced_at: string | null;
}

export interface MapTradeFlow {
  trade_flow_id: string;
  exporter_code: string;
  importer_code: string;
  period_start: string;
  period_end: string;
  gross_weight_kg: number | null;
  trade_value_usd: number | null;
  provenance: ProvenanceClass;
  product_form: { name: string; hs_code: string | null } | null;
}

export interface MapData {
  nodes: MapNode[];
  edges: EdgeDetail[];
  eventMarkers: MapEventMarker[];
  tradeFlows: MapTradeFlow[];
}

interface ImpactEventJoin {
  node_id: string | null;
  event: {
    event_id: string;
    headline: string;
    event_type: string;
    severity: number | null;
    announced_at: string | null;
  } | null;
}

export async function fetchMapData(): Promise<QueryResult<MapData>> {
  return withServerClient(async (client) => {
    const [nodesRes, identityRes, edgesRes, impactsRes, tradeRes] = await Promise.all([
      client.from('nodes').select('*').limit(2000).returns<NodeRow[]>(),
      client
        .from('public_nodes')
        .select('node_id, provenance_class, confidence_score')
        .returns<Array<{ node_id: string; provenance_class: ProvenanceClass; confidence_score: number }>>(),
      client.from('edges').select(EDGE_DETAIL_SELECT).limit(2000).returns<EdgeDetail[]>(),
      client
        .from('event_impacts')
        .select('node_id, event:events!event_id(event_id, headline, event_type, severity, announced_at)')
        .not('node_id', 'is', null)
        .limit(2000)
        .returns<ImpactEventJoin[]>(),
      client
        .from('trade_flows')
        .select(
          'trade_flow_id, exporter_code, importer_code, period_start, period_end, gross_weight_kg, trade_value_usd, provenance, product_form:product_forms!product_form_id(name, hs_code)',
        )
        .order('period_start', { ascending: false })
        .limit(2000)
        .returns<MapTradeFlow[]>(),
    ]);

    const firstError = nodesRes.error ?? identityRes.error ?? edgesRes.error ?? impactsRes.error ?? tradeRes.error;
    if (firstError) return queryError(`Map query failed: ${firstError.message}`);

    const identityByNode = new Map((identityRes.data ?? []).map((row) => [row.node_id, row]));
    const nodes: MapNode[] = (nodesRes.data ?? []).map((node) => ({
      ...node,
      identity_provenance: identityByNode.get(node.node_id)?.provenance_class ?? null,
      identity_confidence: identityByNode.get(node.node_id)?.confidence_score ?? null,
    }));

    const eventMarkers: MapEventMarker[] = (impactsRes.data ?? [])
      .filter((row): row is ImpactEventJoin & { node_id: string } => Boolean(row.node_id && row.event))
      .map((row) => ({
        event_id: row.event!.event_id,
        node_id: row.node_id,
        headline: row.event!.headline,
        event_type: row.event!.event_type,
        severity: row.event!.severity,
        announced_at: row.event!.announced_at,
      }));

    return {
      ok: true,
      data: {
        nodes,
        edges: edgesRes.data ?? [],
        eventMarkers,
        tradeFlows: tradeRes.data ?? [],
      },
    };
  });
}
