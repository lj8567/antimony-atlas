import {
  queryOk,
  type EdgeDetail,
  type EvidenceCounts,
  type NodeRow,
  type QueryResult,
  type TradeFlowRow,
} from '../types';
import { buildIndex, countEvidence, edgeDetails, locationPrecisionOf, maxClaimConfidence } from './assemble';
import { fetchAtlasData } from './core';

export interface MapNode extends Omit<NodeRow, 'latitude' | 'longitude'> {
  /** non-null: nodes without coordinates are excluded and counted separately */
  latitude: number;
  longitude: number;
  evidence: EvidenceCounts;
  max_confidence: number | null;
  location_precision: string | null;
}

export interface MapEventMarker {
  event_id: string;
  node_id: string;
  title: string;
  event_type: string | null;
  severity: number | null;
  event_date: string | null;
}

export interface MapTradeFlow extends TradeFlowRow {
  product_form_name: string | null;
}

export interface MapData {
  nodes: MapNode[];
  /** nodes excluded from the map because they lack coordinates */
  nodesWithoutCoordinates: number;
  edges: EdgeDetail[];
  eventMarkers: MapEventMarker[];
  tradeFlows: MapTradeFlow[];
}

export async function fetchMapData(): Promise<QueryResult<MapData>> {
  const result = await fetchAtlasData();
  if (!result.ok) return result;
  const data = result.data;
  const index = buildIndex(data);

  const nodes: MapNode[] = [];
  let skipped = 0;
  for (const node of data.nodes) {
    if (node.latitude === null || node.longitude === null) {
      skipped += 1;
      continue;
    }
    const assertions = index.assertionsByNode.get(node.node_id) ?? [];
    const observations = index.observationsByNode.get(node.node_id) ?? [];
    nodes.push({
      ...node,
      latitude: node.latitude,
      longitude: node.longitude,
      evidence: countEvidence(assertions, observations),
      max_confidence: maxClaimConfidence(assertions, observations),
      location_precision: locationPrecisionOf(assertions),
    });
  }

  const plottable = new Set(nodes.map((node) => node.node_id));
  const eventMarkers: MapEventMarker[] = data.events
    .filter((event): event is typeof event & { node_id: string } => Boolean(event.node_id && plottable.has(event.node_id)))
    .map((event) => ({
      event_id: event.event_id,
      node_id: event.node_id,
      title: event.title,
      event_type: event.event_type,
      severity: event.severity,
      event_date: event.event_date,
    }));

  return queryOk(
    {
      nodes,
      nodesWithoutCoordinates: skipped,
      edges: edgeDetails(data, index),
      eventMarkers,
      tradeFlows: data.tradeFlows.map((flow) => ({
        ...flow,
        product_form_name: flow.product_form_id
          ? (index.productFormById.get(flow.product_form_id)?.name ?? null)
          : null,
      })),
    },
    result.warnings,
  );
}
