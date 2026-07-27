/**
 * Pure GeoJSON builders for the atlas map. Kept free of MapLibre and React so
 * they can be unit-tested. All geometry is schematic: node points are as
 * precise as the recorded location-precision claim, edge lines are straight
 * connectors (not physical routes) and trade arcs join country centroids.
 */

import { countryCentroid } from '@/lib/countries';
import { isApproximateLocation, supplyCategory } from '@/lib/format';
import type { MapEventMarker, MapNode, MapTradeFlow } from '@/lib/supabase/queries/map';
import type { EdgeDetail } from '@/lib/supabase/types';

export interface NodeFeatureProperties {
  id: string;
  name: string;
  node_type: string;
  status: string;
  supply: 'operating' | 'prospective' | 'inactive_or_uncertain';
  country_code: string | null;
  region: string | null;
  reported_claims: number;
  modelled_claims: number;
  unverified_claims: number;
  max_confidence: number | null;
  approximate: boolean;
  location_precision: string | null;
}

type Feature<G, P> = { type: 'Feature'; geometry: G; properties: P };
type Point = { type: 'Point'; coordinates: [number, number] };
type LineString = { type: 'LineString'; coordinates: [number, number][] };

export interface FeatureCollection<G, P> {
  type: 'FeatureCollection';
  features: Feature<G, P>[];
}

export function nodesToGeoJson(nodes: MapNode[]): FeatureCollection<Point, NodeFeatureProperties> {
  return {
    type: 'FeatureCollection',
    features: nodes.map((node) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [node.longitude, node.latitude] },
      properties: {
        id: node.node_id,
        name: node.name,
        node_type: node.node_type,
        status: node.status,
        supply: supplyCategory(node.status),
        country_code: node.country_code,
        region: node.region,
        reported_claims: node.evidence.reported,
        modelled_claims: node.evidence.modelled,
        unverified_claims: node.evidence.unverified,
        max_confidence: node.max_confidence,
        approximate: isApproximateLocation(node.location_precision),
        location_precision: node.location_precision,
      },
    })),
  };
}

export interface EdgeFeatureProperties {
  id: string;
  edge_type: string;
  provenance: string;
  confidence: number | null;
  from_name: string;
  to_name: string;
  product_form: string | null;
}

export function edgesToGeoJson(edges: EdgeDetail[]): FeatureCollection<LineString, EdgeFeatureProperties> {
  return {
    type: 'FeatureCollection',
    features: edges
      .filter(
        (edge) =>
          edge.from_node &&
          edge.to_node &&
          edge.from_node.latitude !== null &&
          edge.from_node.longitude !== null &&
          edge.to_node.latitude !== null &&
          edge.to_node.longitude !== null,
      )
      .map((edge) => ({
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: [
            [edge.from_node!.longitude!, edge.from_node!.latitude!],
            [edge.to_node!.longitude!, edge.to_node!.latitude!],
          ],
        },
        properties: {
          id: edge.edge_id,
          edge_type: edge.edge_type,
          provenance: edge.provenance,
          confidence: edge.confidence,
          from_name: edge.from_node!.name,
          to_name: edge.to_node!.name,
          product_form: edge.product_form?.name ?? null,
        },
      })),
  };
}

export interface EventFeatureProperties {
  event_id: string;
  node_id: string;
  title: string;
  event_type: string | null;
  severity: number | null;
  event_date: string | null;
  node_name: string;
}

export function eventsToGeoJson(
  markers: MapEventMarker[],
  nodes: MapNode[],
): FeatureCollection<Point, EventFeatureProperties> {
  const nodeById = new Map(nodes.map((node) => [node.node_id, node]));
  return {
    type: 'FeatureCollection',
    features: markers.flatMap((marker) => {
      const node = nodeById.get(marker.node_id);
      if (!node) return [];
      return [
        {
          type: 'Feature' as const,
          geometry: { type: 'Point' as const, coordinates: [node.longitude, node.latitude] as [number, number] },
          properties: {
            event_id: marker.event_id,
            node_id: marker.node_id,
            title: marker.title,
            event_type: marker.event_type,
            severity: marker.severity,
            event_date: marker.event_date,
            node_name: node.name,
          },
        },
      ];
    }),
  };
}

export interface TradeArcProperties {
  exporter: string;
  importer: string;
  total_weight_kg: number | null;
  total_value_usd: number | null;
  flow_count: number;
  product_forms: string;
}

/**
 * Aggregate flows by exporter→importer pair and draw a gently curved arc
 * between country centroids. Pairs without a catalogued centroid are counted
 * in `skipped` so the UI can disclose the omission.
 */
export function tradeArcsToGeoJson(flows: MapTradeFlow[]): {
  collection: FeatureCollection<LineString, TradeArcProperties>;
  skipped: number;
} {
  const pairs = new Map<
    string,
    { exporter: string; importer: string; weight: number | null; value: number | null; count: number; forms: Set<string> }
  >();
  for (const flow of flows) {
    const key = `${flow.exporter_code}→${flow.importer_code}`;
    const entry =
      pairs.get(key) ?? { exporter: flow.exporter_code, importer: flow.importer_code, weight: null, value: null, count: 0, forms: new Set<string>() };
    entry.count += 1;
    if (flow.gross_weight_kg !== null) entry.weight = (entry.weight ?? 0) + flow.gross_weight_kg;
    if (flow.trade_value_usd !== null) entry.value = (entry.value ?? 0) + flow.trade_value_usd;
    if (flow.product_form_name) entry.forms.add(flow.product_form_name);
    pairs.set(key, entry);
  }

  let skipped = 0;
  const features: Feature<LineString, TradeArcProperties>[] = [];
  for (const entry of pairs.values()) {
    const from = countryCentroid(entry.exporter);
    const to = countryCentroid(entry.importer);
    if (!from || !to) {
      skipped += 1;
      continue;
    }
    features.push({
      type: 'Feature',
      geometry: { type: 'LineString', coordinates: arcCoordinates(from, to) },
      properties: {
        exporter: entry.exporter,
        importer: entry.importer,
        total_weight_kg: entry.weight,
        total_value_usd: entry.value,
        flow_count: entry.count,
        product_forms: [...entry.forms].join('; '),
      },
    });
  }
  return { collection: { type: 'FeatureCollection', features }, skipped };
}

/** Quadratic-bezier arc between two lon/lat points, bowed perpendicular to the chord. */
export function arcCoordinates(
  from: [number, number],
  to: [number, number],
  segments = 24,
): [number, number][] {
  const [x1, y1] = from;
  const [x2, y2] = to;
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const distance = Math.hypot(dx, dy);
  if (distance === 0) return [from, to];
  // control point offset ~15% of chord length, perpendicular to the chord
  const offset = distance * 0.15;
  const cx = mx - (dy / distance) * offset;
  const cy = my + (dx / distance) * offset;
  const points: [number, number][] = [];
  for (let index = 0; index <= segments; index += 1) {
    const t = index / segments;
    const a = (1 - t) * (1 - t);
    const b = 2 * (1 - t) * t;
    const c = t * t;
    points.push([a * x1 + b * cx + c * x2, a * y1 + b * cy + c * y2]);
  }
  return points;
}

/* ------------------------------------------------------------------ */
/* Shared styling constants (legend + layers use the same values)      */
/* ------------------------------------------------------------------ */

export const NODE_TYPE_COLORS: Record<string, string> = {
  mine: '#6da8dc',
  mine_and_concentrator: '#6da8dc',
  development_project: '#8f83cd',
  concentrator: '#d6a54e',
  smelter: '#cf8340',
  refinery: '#c0913d',
  processing_plant: '#b98a3b',
  metal_plant: '#b98a3b',
  trioxide_plant: '#dcb765',
  port: '#55b0a5',
  rail_terminal: '#4f9e8f',
  border_gateway: '#5da06b',
  logistics_gateway: '#5da06b',
};

export const NODE_DEFAULT_COLOR = '#8a97a3';
