import { describe, expect, it } from 'vitest';
import { arcCoordinates, edgesToGeoJson, nodesToGeoJson, tradeArcsToGeoJson } from '@/components/map/geo';
import type { MapNode, MapTradeFlow } from '@/lib/supabase/queries/map';
import type { EdgeDetail } from '@/lib/supabase/types';

const stibniteNode: MapNode = {
  node_id: 'node-1',
  metal_id: 'metal-1',
  name: 'Stibnite Gold Project',
  aliases: null,
  node_type: 'development_project',
  status: 'construction',
  country_code: 'USA',
  region: 'Idaho',
  latitude: 44.91,
  longitude: -115.34,
  owner_entity_id: null,
  operator_entity_id: null,
  notes: null,
  created_at: '2025-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  evidence: { reported: 5, modelled: 2, unverified: 0 },
  max_confidence: 90,
  location_precision: 'approximate',
};

describe('nodesToGeoJson', () => {
  it('carries supply category, evidence and precision disclosure into feature properties', () => {
    const collection = nodesToGeoJson([stibniteNode]);
    expect(collection.features).toHaveLength(1);
    const properties = collection.features[0].properties;
    expect(properties.supply).toBe('prospective');
    expect(properties.approximate).toBe(true);
    expect(properties.reported_claims).toBe(5);
    expect(properties.max_confidence).toBe(90);
    expect(collection.features[0].geometry.coordinates).toEqual([-115.34, 44.91]);
  });
  it('treats a missing precision claim as approximate', () => {
    const collection = nodesToGeoJson([{ ...stibniteNode, location_precision: null }]);
    expect(collection.features[0].properties.approximate).toBe(true);
  });
});

describe('edgesToGeoJson', () => {
  const endpoint = {
    node_id: 'node-1',
    name: 'Stibnite Gold Project',
    node_type: 'development_project',
    status: 'construction' as const,
    country_code: 'USA',
    latitude: 44.91,
    longitude: -115.34,
  };
  const edge: EdgeDetail = {
    edge_id: 'edge-1',
    from_node_id: 'node-1',
    to_node_id: 'node-2',
    edge_type: 'mine_to_concentrator',
    product_form_id: null,
    provenance: 'unverified',
    confidence: 55,
    source_id: null,
    notes: null,
    from_node: endpoint,
    to_node: { ...endpoint, node_id: 'node-2', name: 'Concentrator', latitude: 45.2, longitude: -114.9 },
    product_form: null,
    source: null,
  };

  it('draws straight schematic lines and skips edges with missing endpoints', () => {
    const broken: EdgeDetail = { ...edge, edge_id: 'edge-2', to_node: null };
    const collection = edgesToGeoJson([edge, broken]);
    expect(collection.features).toHaveLength(1);
    expect(collection.features[0].properties.provenance).toBe('unverified');
    expect(collection.features[0].geometry.coordinates).toHaveLength(2);
  });

  it('skips edges whose endpoints lack coordinates', () => {
    const noCoords: EdgeDetail = { ...edge, edge_id: 'edge-3', to_node: { ...edge.to_node!, latitude: null, longitude: null } };
    expect(edgesToGeoJson([noCoords]).features).toHaveLength(0);
  });
});

describe('tradeArcsToGeoJson', () => {
  const flow: MapTradeFlow = {
    trade_flow_id: 'flow-1',
    exporter_code: 'AUS',
    importer_code: 'USA',
    product_form_id: 'form-1',
    period_start: '2024-01-01',
    period_end: '2024-12-31',
    gross_weight_kg: 1000,
    trade_value_usd: 5000,
    reporter_code: 'AUS',
    mirror_status: null,
    source_id: null,
    provenance: 'reported',
    confidence: 88,
    product_form_name: 'Antimony concentrate',
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
