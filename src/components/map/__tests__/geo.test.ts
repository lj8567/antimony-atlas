import { describe, expect, it } from 'vitest';
import { arcCoordinates, edgesToGeoJson, nodesToGeoJson, tradeArcsToGeoJson } from '@/components/map/geo';
import type { MapNode, MapTradeFlow } from '@/lib/supabase/queries/map';
import type { EdgeDetail } from '@/lib/supabase/types';

const stibniteNode: MapNode = {
  node_id: 'node-1',
  metal_id: 'metal-1',
  canonical_name: 'Stibnite Gold Project',
  node_type: 'development_project',
  status: 'construction',
  status_effective_date: null,
  country_code: 'USA',
  region: 'Idaho',
  latitude: 44.91,
  longitude: -115.34,
  location_precision: 'approximate',
  operator_entity_id: null,
  description: null,
  first_seen_at: '2025-01-01T00:00:00Z',
  last_reviewed_at: null,
  identity_provenance: 'reported',
  identity_confidence: 82,
};

describe('nodesToGeoJson', () => {
  it('carries supply category and precision disclosure into feature properties', () => {
    const collection = nodesToGeoJson([stibniteNode]);
    expect(collection.features).toHaveLength(1);
    const properties = collection.features[0].properties;
    expect(properties.supply).toBe('prospective');
    expect(properties.approximate).toBe(true);
    expect(properties.confidence).toBe(82);
    expect(collection.features[0].geometry.coordinates).toEqual([-115.34, 44.91]);
  });
});

describe('edgesToGeoJson', () => {
  it('draws straight schematic lines and skips edges with missing endpoints', () => {
    const endpoint = {
      node_id: 'node-1',
      canonical_name: 'Stibnite Gold Project',
      node_type: 'development_project',
      status: 'construction' as const,
      country_code: 'USA',
      latitude: 44.91,
      longitude: -115.34,
    };
    const edge: EdgeDetail = {
      edge_id: 'edge-1',
      metal_id: 'metal-1',
      from_node_id: 'node-1',
      to_node_id: 'node-2',
      edge_type: 'mine_to_concentrator',
      product_form_id: null,
      relationship_status: 'unverified',
      effective_from: null,
      effective_to: null,
      confidence_score: 55,
      primary_assertion_id: 'assert-1',
      from_node: endpoint,
      to_node: { ...endpoint, node_id: 'node-2', canonical_name: 'Concentrator', latitude: 45.2, longitude: -114.9 },
      product_form: null,
      assertion: null,
    };
    const broken: EdgeDetail = { ...edge, edge_id: 'edge-2', to_node: null };
    const collection = edgesToGeoJson([edge, broken]);
    expect(collection.features).toHaveLength(1);
    expect(collection.features[0].properties.relationship_status).toBe('unverified');
    expect(collection.features[0].geometry.coordinates).toHaveLength(2);
  });
});

describe('tradeArcsToGeoJson', () => {
  const flow: MapTradeFlow = {
    trade_flow_id: 'flow-1',
    exporter_code: 'AUS',
    importer_code: 'USA',
    period_start: '2024-01-01',
    period_end: '2024-12-31',
    gross_weight_kg: 1000,
    trade_value_usd: 5000,
    provenance: 'reported',
    product_form: { name: 'Antimony ores and concentrates', hs_code: '261710' },
  };

  it('aggregates flows per exporter-importer pair', () => {
    const { collection, skipped } = tradeArcsToGeoJson([flow, { ...flow, trade_flow_id: 'flow-2', gross_weight_kg: 500 }]);
    expect(collection.features).toHaveLength(1);
    expect(skipped).toBe(0);
    expect(collection.features[0].properties.total_weight_kg).toBe(1500);
    expect(collection.features[0].properties.flow_count).toBe(2);
  });

  it('counts pairs without centroids instead of guessing locations', () => {
    const { collection, skipped } = tradeArcsToGeoJson([{ ...flow, exporter_code: 'XXX' }]);
    expect(collection.features).toHaveLength(0);
    expect(skipped).toBe(1);
  });
});

describe('arcCoordinates', () => {
  it('starts and ends exactly at the endpoints', () => {
    const arc = arcCoordinates([0, 0], [10, 10], 16);
    expect(arc[0]).toEqual([0, 0]);
    expect(arc.at(-1)?.[0]).toBeCloseTo(10);
    expect(arc.at(-1)?.[1]).toBeCloseTo(10);
    expect(arc.length).toBe(17);
  });
});
