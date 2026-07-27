'use client';

import { useEffect, useRef } from 'react';
import maplibregl, { Map } from 'maplibre-gl';
import type { PublicNode } from '@/lib/types';

export function AssetMap({ nodes }: { nodes: PublicNode[] }) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Map | null>(null);

  useEffect(() => {
    if (!container.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: container.current,
      style: 'https://demotiles.maplibre.org/style.json',
      center: [20, 20],
      zoom: 1.2
    });
    map.addControl(new maplibregl.NavigationControl(), 'top-right');
    map.on('load', () => {
      map.addSource('nodes', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: nodes.map(node => ({
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [node.longitude, node.latitude] },
            properties: node
          }))
        }
      });
      map.addLayer({
        id: 'nodes-circle',
        type: 'circle',
        source: 'nodes',
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 1, 5, 6, 10],
          'circle-color': ['match', ['get', 'provenance_class'], 'reported', '#157f3b', 'modelled', '#b06c00', '#9b2c2c'],
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 1.5
        }
      });
      map.on('click', 'nodes-circle', event => {
        const feature = event.features?.[0];
        if (!feature || feature.geometry.type !== 'Point') return;
        const p = feature.properties as PublicNode;
        new maplibregl.Popup()
          .setLngLat(feature.geometry.coordinates as [number, number])
          .setHTML(`<strong>${p.canonical_name}</strong><br/>${p.node_type} · ${p.country_code}<br/>${p.status}<br/><small>${p.provenance_class}, confidence ${p.confidence_score}</small>`)
          .addTo(map);
      });
      map.on('mouseenter', 'nodes-circle', () => { map.getCanvas().style.cursor = 'pointer'; });
      map.on('mouseleave', 'nodes-circle', () => { map.getCanvas().style.cursor = ''; });
    });
    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; };
  }, [nodes]);

  return <div ref={container} className="map" aria-label="Antimony asset map" />;
}
