'use client';

import dynamic from 'next/dynamic';
import type { MapData } from '@/lib/supabase/queries/map';

/**
 * Client wrapper that lazy-loads MapLibre (no SSR — the GL canvas is
 * browser-only) so map code stays out of every other page's bundle.
 */
const AtlasMap = dynamic(() => import('./AtlasMap').then((mod) => mod.AtlasMap), {
  ssr: false,
  loading: () => (
    <div className="map-page">
      <div className="map-layout" aria-busy="true">
        <div className="skeleton" style={{ position: 'absolute', inset: 12 }} />
      </div>
    </div>
  ),
});

export function MapView({ data }: { data: MapData }) {
  return <AtlasMap data={data} />;
}
