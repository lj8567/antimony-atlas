'use client';

import maplibregl, {
  Map as MapLibreMap,
  type ExpressionSpecification,
  type GeoJSONSource,
  type StyleSpecification,
} from 'maplibre-gl';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ConfidenceIndicator, EvidenceSummary, StatusLabel } from '@/components/ui/badges';
import { SelectField } from '@/components/ui/controls';
import { countryName } from '@/lib/countries';
import { toQueryString } from '@/lib/filters';
import {
  confidenceBand,
  formatDate,
  formatEventType,
  formatLocationPrecision,
  formatNodeType,
  formatStatus,
  STATUS_ORDER,
  type ConfidenceBand,
} from '@/lib/format';
import type { MapData } from '@/lib/supabase/queries/map';
import {
  edgesToGeoJson,
  eventsToGeoJson,
  NODE_DEFAULT_COLOR,
  NODE_TYPE_COLORS,
  nodesToGeoJson,
  tradeArcsToGeoJson,
} from './geo';

interface MapFilters {
  type: string;
  status: string;
  country: string;
  provenance: string;
  confidence: '' | ConfidenceBand;
  showEdges: boolean;
  showEvents: boolean;
  showTrade: boolean;
}

const DEFAULT_SHOW = 'edges,events';

function parseMapFilters(params: URLSearchParams): MapFilters {
  const show = (params.get('show') ?? DEFAULT_SHOW).split(',');
  const conf = params.get('conf') ?? '';
  return {
    type: params.get('type') ?? '',
    status: params.get('status') ?? '',
    country: params.get('country') ?? '',
    provenance: params.get('provenance') ?? '',
    confidence: conf === 'high' || conf === 'medium' || conf === 'low' ? conf : '',
    showEdges: show.includes('edges'),
    showEvents: show.includes('events'),
    showTrade: show.includes('trade'),
  };
}

function serializeMapFilters(filters: MapFilters, focus: string | null): Record<string, string> {
  const show = [
    filters.showEdges ? 'edges' : null,
    filters.showEvents ? 'events' : null,
    filters.showTrade ? 'trade' : null,
  ]
    .filter(Boolean)
    .join(',');
  return {
    type: filters.type,
    status: filters.status,
    country: filters.country,
    provenance: filters.provenance,
    conf: filters.confidence,
    show: show === DEFAULT_SHOW ? '' : show || 'none',
    focus: focus ?? '',
  };
}

const NODE_COLOR_EXPRESSION = [
  'match',
  ['get', 'node_type'],
  ...Object.entries(NODE_TYPE_COLORS).flat(),
  NODE_DEFAULT_COLOR,
] as unknown as ExpressionSpecification;

/**
 * The initial style contains only a background layer so `load` always fires
 * instantly and the data layers mount even when the basemap host is
 * unreachable. The OpenFreeMap vector basemap is attached afterwards,
 * beneath the data layers, and any failure simply flags a notice.
 */
const MINIMAL_STYLE: StyleSpecification = {
  version: 8,
  glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
  sources: {},
  layers: [{ id: 'background', type: 'background', paint: { 'background-color': '#11161d' } }],
};

function attachBasemap(map: MapLibreMap, beforeId: string) {
  map.addSource('omt', { type: 'vector', url: 'https://tiles.openfreemap.org/planet' });
  map.addLayer(
    {
      id: 'water',
      type: 'fill',
      source: 'omt',
      'source-layer': 'water',
      paint: { 'fill-color': '#0a0e13' },
    },
    beforeId,
  );
  map.addLayer(
    {
      id: 'boundary-country',
      type: 'line',
      source: 'omt',
      'source-layer': 'boundary',
      filter: ['all', ['==', ['get', 'admin_level'], 2], ['==', ['get', 'maritime'], 0]],
      paint: { 'line-color': '#2b3745', 'line-width': 0.8 },
    },
    beforeId,
  );
  map.addLayer(
    {
      id: 'country-label',
      type: 'symbol',
      source: 'omt',
      'source-layer': 'place',
      filter: ['==', ['get', 'class'], 'country'],
      minzoom: 1.6,
      layout: {
        'text-field': ['coalesce', ['get', 'name:en'], ['get', 'name:latin'], ['get', 'name']],
        'text-font': ['Noto Sans Regular'],
        'text-size': 10.5,
        'text-transform': 'uppercase',
        'text-letter-spacing': 0.12,
      },
      paint: { 'text-color': '#5a6773', 'text-halo-color': '#11161d', 'text-halo-width': 1.1 },
    },
    beforeId,
  );
}

export function AtlasMap({ data }: { data: MapData }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [basemapError, setBasemapError] = useState(false);

  const filters = useMemo(() => parseMapFilters(new URLSearchParams(searchParams.toString())), [searchParams]);
  const focusId = searchParams.get('focus');
  const selectedNode = useMemo(
    () => (focusId ? (data.nodes.find((node) => node.node_id === focusId) ?? null) : null),
    [focusId, data.nodes],
  );

  const apply = useCallback(
    (patch: Partial<MapFilters>, focus?: string | null) => {
      const next = { ...filters, ...patch };
      const nextFocus = focus === undefined ? focusId : focus;
      router.replace(`${pathname}${toQueryString(serializeMapFilters(next, nextFocus))}`, { scroll: false });
    },
    [filters, focusId, pathname, router],
  );

  /* Keep the latest apply() reachable from stable map event handlers. */
  const applyRef = useRef(apply);
  useEffect(() => {
    applyRef.current = apply;
  }, [apply]);

  const filteredNodes = useMemo(() => {
    return data.nodes.filter((node) => {
      if (filters.type && node.node_type !== filters.type) return false;
      if (filters.status && node.status !== filters.status) return false;
      if (filters.country && node.country_code !== filters.country) return false;
      if (filters.provenance && node.evidence[filters.provenance as keyof typeof node.evidence] === 0) return false;
      if (filters.confidence && confidenceBand(node.max_confidence) !== filters.confidence) return false;
      return true;
    });
  }, [data.nodes, filters]);

  const visibleNodeIds = useMemo(() => new Set(filteredNodes.map((node) => node.node_id)), [filteredNodes]);

  const filteredEdges = useMemo(
    () =>
      filters.showEdges
        ? data.edges.filter(
            (edge) => visibleNodeIds.has(edge.from_node_id) || visibleNodeIds.has(edge.to_node_id),
          )
        : [],
    [data.edges, filters.showEdges, visibleNodeIds],
  );

  const filteredEvents = useMemo(
    () => (filters.showEvents ? data.eventMarkers.filter((marker) => visibleNodeIds.has(marker.node_id)) : []),
    [data.eventMarkers, filters.showEvents, visibleNodeIds],
  );

  const tradeArcs = useMemo(
    () => (filters.showTrade ? tradeArcsToGeoJson(data.tradeFlows) : { collection: { type: 'FeatureCollection' as const, features: [] }, skipped: 0 }),
    [data.tradeFlows, filters.showTrade],
  );

  /* Map initialisation — once. */
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: MINIMAL_STYLE,
      center: [10, 25],
      zoom: 1.6,
      minZoom: 1,
      maxZoom: 12,
      attributionControl: { compact: true },
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-left');

    map.on('error', (event) => {
      // Basemap tiles/glyphs unreachable → data layers still work on the dark canvas.
      const url = String((event as { error?: { message?: string } }).error?.message ?? '');
      if (url.includes('openfreemap') || url.includes('tile') || url.includes('glyph') || url.includes('Failed to fetch')) {
        setBasemapError(true);
      }
    });

    map.on('load', () => {
      map.addSource('trade', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      map.addSource('edges', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      map.addSource('nodes', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      map.addSource('events', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });

      map.addLayer({
        id: 'trade-arcs',
        type: 'line',
        source: 'trade',
        layout: { 'line-cap': 'round' },
        paint: {
          'line-color': '#9db4c8',
          'line-opacity': 0.42,
          'line-width': [
            'interpolate',
            ['linear'],
            ['coalesce', ['get', 'total_weight_kg'], 0],
            0,
            1,
            1_000_000,
            2.5,
            100_000_000,
            6,
          ] as unknown as ExpressionSpecification,
        },
      });

      const edgeLayer = (id: string, status: string, dash?: number[]) =>
        map.addLayer({
          id,
          type: 'line',
          source: 'edges',
          filter: ['==', ['get', 'provenance'], status],
          layout: { 'line-cap': 'round' },
          paint: {
            'line-color': status === 'reported' ? '#6ea6d9' : status === 'modelled' ? '#d19d47' : '#c9748c',
            'line-opacity': 0.75,
            'line-width': 1.4,
            ...(dash ? { 'line-dasharray': dash } : {}),
          },
        });
      edgeLayer('edges-reported', 'reported');
      edgeLayer('edges-modelled', 'modelled', [2.4, 1.6]);
      edgeLayer('edges-unverified', 'unverified', [0.6, 1.8]);

      map.addLayer({
        id: 'node-halos',
        type: 'circle',
        source: 'nodes',
        filter: ['==', ['get', 'approximate'], true],
        paint: {
          'circle-color': NODE_COLOR_EXPRESSION,
          'circle-opacity': 0.12,
          'circle-radius': [
            'interpolate',
            ['linear'],
            ['zoom'],
            1,
            11,
            6,
            22,
          ] as unknown as ExpressionSpecification,
        },
      });

      map.addLayer({
        id: 'nodes-circle',
        type: 'circle',
        source: 'nodes',
        paint: {
          'circle-color': NODE_COLOR_EXPRESSION,
          'circle-radius': [
            'interpolate',
            ['linear'],
            ['zoom'],
            1,
            4.5,
            6,
            8,
          ] as unknown as ExpressionSpecification,
          'circle-opacity': [
            'match',
            ['get', 'supply'],
            'operating',
            0.95,
            'prospective',
            0.3,
            0.55,
          ] as unknown as ExpressionSpecification,
          'circle-stroke-width': [
            'match',
            ['get', 'supply'],
            'prospective',
            1.8,
            1,
          ] as unknown as ExpressionSpecification,
          'circle-stroke-color': [
            'case',
            ['==', ['get', 'supply'], 'prospective'],
            NODE_COLOR_EXPRESSION,
            '#0d1115',
          ] as unknown as ExpressionSpecification,
        },
      });

      map.addLayer({
        id: 'events-circle',
        type: 'circle',
        source: 'events',
        paint: {
          'circle-color': [
            'match',
            ['coalesce', ['get', 'severity'], 1],
            1,
            '#7d8a96',
            2,
            '#b8a355',
            3,
            '#cf9440',
            4,
            '#cd7052',
            5,
            '#d05b5b',
            '#7d8a96',
          ] as unknown as ExpressionSpecification,
          'circle-radius': 3.6,
          'circle-translate': [0, -11],
          'circle-stroke-color': '#0d1115',
          'circle-stroke-width': 1,
        },
      });

      try {
        attachBasemap(map, 'trade-arcs');
      } catch {
        setBasemapError(true);
      }

      setMapReady(true);
    });

    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      setMapReady(false);
    };
  }, []);

  /* Interactions — bound once after load. */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    const selectNode = (event: maplibregl.MapLayerMouseEvent) => {
      const feature = event.features?.[0];
      if (!feature) return;
      const id = String(feature.properties?.id ?? '');
      if (id) applyRef.current({}, id);
    };

    const showEventPopup = (event: maplibregl.MapLayerMouseEvent) => {
      const feature = event.features?.[0];
      if (!feature || feature.geometry.type !== 'Point') return;
      const props = feature.properties as Record<string, unknown>;
      openPopup(
        map,
        feature.geometry.coordinates as [number, number],
        `<strong>${escapeHtml(String(props.title ?? ''))}</strong><br/>${escapeHtml(
          formatEventType(String(props.event_type ?? '')),
        )} · ${escapeHtml(formatDate(props.event_date ? String(props.event_date) : null))}<br/><small>Severity ${escapeHtml(
          String(props.severity ?? '—'),
        )}/5 · ${escapeHtml(String(props.node_name ?? ''))}</small>`,
      );
    };

    const showEdgePopup = (event: maplibregl.MapLayerMouseEvent) => {
      const feature = event.features?.[0];
      if (!feature) return;
      const props = feature.properties as Record<string, unknown>;
      openPopup(
        map,
        event.lngLat.toArray() as [number, number],
        `<strong>${escapeHtml(String(props.from_name ?? ''))} → ${escapeHtml(String(props.to_name ?? ''))}</strong><br/>${escapeHtml(
          formatNodeType(String(props.edge_type ?? '')),
        )}${props.product_form ? ` · ${escapeHtml(String(props.product_form))}` : ''}<br/><small>${escapeHtml(
          String(props.provenance ?? ''),
        )} relationship · confidence ${escapeHtml(String(props.confidence ?? '—'))}/100<br/>Schematic line — not the physical route</small>`,
      );
    };

    const showTradePopup = (event: maplibregl.MapLayerMouseEvent) => {
      const feature = event.features?.[0];
      if (!feature) return;
      const props = feature.properties as Record<string, unknown>;
      const weight = props.total_weight_kg ? `${Math.round(Number(props.total_weight_kg) / 1000).toLocaleString()} t (gross)` : 'weight not reported';
      const value = props.total_value_usd ? `US$${Math.round(Number(props.total_value_usd)).toLocaleString()}` : 'value not reported';
      openPopup(
        map,
        event.lngLat.toArray() as [number, number],
        `<strong>${escapeHtml(countryName(String(props.exporter ?? '')))} → ${escapeHtml(
          countryName(String(props.importer ?? '')),
        )}</strong><br/>${escapeHtml(String(props.product_forms ?? ''))}<br/><small>${escapeHtml(weight)} · ${escapeHtml(
          value,
        )} · ${escapeHtml(String(props.flow_count ?? '0'))} flow(s)<br/>Country-level customs arc — not a facility route</small>`,
      );
    };

    const pointer = () => {
      map.getCanvas().style.cursor = 'pointer';
    };
    const unpointer = () => {
      map.getCanvas().style.cursor = '';
    };

    map.on('click', 'nodes-circle', selectNode);
    map.on('click', 'events-circle', showEventPopup);
    for (const layer of ['edges-reported', 'edges-modelled', 'edges-unverified']) {
      map.on('click', layer, showEdgePopup);
      map.on('mouseenter', layer, pointer);
      map.on('mouseleave', layer, unpointer);
    }
    map.on('click', 'trade-arcs', showTradePopup);
    for (const layer of ['nodes-circle', 'events-circle', 'trade-arcs']) {
      map.on('mouseenter', layer, pointer);
      map.on('mouseleave', layer, unpointer);
    }

    return () => {
      map.off('click', 'nodes-circle', selectNode);
      map.off('click', 'events-circle', showEventPopup);
      for (const layer of ['edges-reported', 'edges-modelled', 'edges-unverified']) {
        map.off('click', layer, showEdgePopup);
        map.off('mouseenter', layer, pointer);
        map.off('mouseleave', layer, unpointer);
      }
      map.off('click', 'trade-arcs', showTradePopup);
      for (const layer of ['nodes-circle', 'events-circle', 'trade-arcs']) {
        map.off('mouseenter', layer, pointer);
        map.off('mouseleave', layer, unpointer);
      }
    };
  }, [mapReady]);

  /* Data updates on filter change. */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    (map.getSource('nodes') as GeoJSONSource | undefined)?.setData(nodesToGeoJson(filteredNodes));
    (map.getSource('edges') as GeoJSONSource | undefined)?.setData(edgesToGeoJson(filteredEdges));
    (map.getSource('events') as GeoJSONSource | undefined)?.setData(eventsToGeoJson(filteredEvents, data.nodes));
    (map.getSource('trade') as GeoJSONSource | undefined)?.setData(tradeArcs.collection);
  }, [mapReady, filteredNodes, filteredEdges, filteredEvents, tradeArcs, data.nodes]);

  /* Fly to focused node. */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !selectedNode) return;
    map.flyTo({ center: [selectedNode.longitude, selectedNode.latitude], zoom: Math.max(map.getZoom(), 5), speed: 1.6 });
  }, [mapReady, selectedNode]);

  const options = useMemo(() => {
    const types = [...new Set(data.nodes.map((node) => node.node_type))].sort().map((type) => ({
      value: type,
      label: formatNodeType(type),
    }));
    const statuses = STATUS_ORDER.filter((status) => data.nodes.some((node) => node.status === status)).map(
      (status) => ({ value: status, label: formatStatus(status) }),
    );
    const countries = [...new Set(data.nodes.map((node) => node.country_code).filter((c): c is string => Boolean(c)))]
      .sort((a, b) => countryName(a).localeCompare(countryName(b)))
      .map((code) => ({ value: code, label: countryName(code) }));
    return { types, statuses, countries };
  }, [data.nodes]);

  const typesPresent = useMemo(
    () => [...new Set(filteredNodes.map((node) => node.node_type))].sort(),
    [filteredNodes],
  );

  return (
    <div className="map-page">
      <div className="map-filter-bar">
        <SelectField label="Type" value={filters.type} options={options.types} onChange={(type) => apply({ type })} />
        <SelectField label="Status" value={filters.status} options={options.statuses} onChange={(status) => apply({ status })} />
        <SelectField label="Country" value={filters.country} options={options.countries} onChange={(country) => apply({ country })} />
        <SelectField
          label="Provenance"
          value={filters.provenance}
          options={[
            { value: 'reported', label: 'Reported' },
            { value: 'modelled', label: 'Modelled' },
            { value: 'unverified', label: 'Unverified' },
          ]}
          onChange={(provenance) => apply({ provenance })}
        />
        <SelectField
          label="Confidence"
          value={filters.confidence}
          options={[
            { value: 'high', label: 'High (≥ 85)' },
            { value: 'medium', label: 'Medium (65–84)' },
            { value: 'low', label: 'Low (< 65)' },
          ]}
          onChange={(confidence) => apply({ confidence: confidence as MapFilters['confidence'] })}
        />
        <div className="field">
          <span className="field-label">Layers</span>
          <div className="seg" role="group" aria-label="Map layers">
            <button type="button" aria-pressed={filters.showEdges} onClick={() => apply({ showEdges: !filters.showEdges })}>
              Connections
            </button>
            <button type="button" aria-pressed={filters.showEvents} onClick={() => apply({ showEvents: !filters.showEvents })}>
              Events
            </button>
            <button type="button" aria-pressed={filters.showTrade} onClick={() => apply({ showTrade: !filters.showTrade })}>
              Trade arcs
            </button>
          </div>
        </div>
        <span className="note" style={{ alignSelf: 'center', marginLeft: 'auto' }}>
          {filteredNodes.length} of {data.nodes.length} nodes shown
        </span>
      </div>

      <div className="map-layout">
        <div ref={containerRef} className="map-canvas" role="application" aria-label="Antimony supply chain map" />

        <div className="map-legend" aria-label="Map legend">
          <h4>Node types</h4>
          {(typesPresent.length > 0 ? typesPresent : Object.keys(NODE_TYPE_COLORS)).slice(0, 8).map((type) => (
            <div className="legend-row" key={type}>
              <span className="legend-swatch" style={{ background: NODE_TYPE_COLORS[type] ?? NODE_DEFAULT_COLOR }} />
              {formatNodeType(type)}
            </div>
          ))}
          <h4 style={{ marginTop: 8 }}>Symbols</h4>
          <div className="legend-row">
            <span className="legend-swatch" style={{ background: 'var(--ink-2)' }} />
            Filled — operating
          </div>
          <div className="legend-row">
            <span className="legend-swatch" style={{ background: 'transparent', border: '2px solid var(--ink-2)' }} />
            Hollow — prospective
          </div>
          <div className="legend-row">
            <span className="legend-swatch" style={{ background: 'var(--ink-2)', opacity: 0.25, boxShadow: '0 0 0 3px rgba(157,180,200,0.18)' }} />
            Halo — approximate location
          </div>
          {filters.showEdges && (
            <>
              <h4 style={{ marginTop: 8 }}>Connections (schematic)</h4>
              <div className="legend-row">
                <span className="legend-line" style={{ borderColor: '#6ea6d9' }} />
                Reported
              </div>
              <div className="legend-row">
                <span className="legend-line dashed" style={{ borderColor: '#d19d47' }} />
                Modelled
              </div>
              <div className="legend-row">
                <span className="legend-line dotted" style={{ borderColor: '#c9748c' }} />
                Unverified
              </div>
            </>
          )}
          {filters.showTrade && (
            <div className="legend-row" style={{ marginTop: 6 }}>
              <span className="legend-line" style={{ borderColor: '#9db4c8', opacity: 0.6 }} />
              Trade arc — country level only
              {tradeArcs.skipped > 0 && <span className="note"> ({tradeArcs.skipped} pair(s) without centroid omitted)</span>}
            </div>
          )}
          {data.nodesWithoutCoordinates > 0 && (
            <p className="note" style={{ marginTop: 8, marginBottom: 0 }}>
              {data.nodesWithoutCoordinates} node{data.nodesWithoutCoordinates === 1 ? '' : 's'} without coordinates not
              shown — see the <Link href="/assets">asset register</Link>.
            </p>
          )}
          {basemapError && (
            <p className="note" style={{ marginTop: 8, marginBottom: 0 }}>
              Basemap tiles unavailable — data layers remain accurate.
            </p>
          )}
        </div>

        {selectedNode && (
          <aside className="map-panel">
            <div className="panel-head">
              <h2 className="panel-title">{selectedNode.name}</h2>
              <button type="button" className="close-button" aria-label="Close node panel" onClick={() => apply({}, null)}>
                ✕
              </button>
            </div>
            <div className="panel-body">
              <dl className="kv">
                <dt>Type</dt>
                <dd>{formatNodeType(selectedNode.node_type)}</dd>
                <dt>Status</dt>
                <dd>
                  <StatusLabel status={selectedNode.status} />
                </dd>
                <dt>Country</dt>
                <dd>{countryName(selectedNode.country_code)}</dd>
                {selectedNode.region && (
                  <>
                    <dt>Region</dt>
                    <dd>{selectedNode.region}</dd>
                  </>
                )}
                <dt>Coordinates</dt>
                <dd className="mono">
                  {selectedNode.latitude.toFixed(3)}, {selectedNode.longitude.toFixed(3)}
                </dd>
                <dt>Precision</dt>
                <dd>{formatLocationPrecision(selectedNode.location_precision)}</dd>
                <dt>Evidence on file</dt>
                <dd>
                  <span className="inline-list">
                    <EvidenceSummary counts={selectedNode.evidence} />
                    <ConfidenceIndicator score={selectedNode.max_confidence} withHint={false} />
                  </span>
                </dd>
              </dl>
              <p style={{ marginTop: 12 }}>
                <Link className="btn" href={`/assets/${selectedNode.node_id}`}>
                  Open asset page →
                </Link>
              </p>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}

function openPopup(map: MapLibreMap, lngLat: [number, number], html: string) {
  new maplibregl.Popup({ closeButton: true, maxWidth: '300px' }).setLngLat(lngLat).setHTML(html).addTo(map);
}

function escapeHtml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
