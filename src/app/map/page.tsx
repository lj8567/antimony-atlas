import type { Metadata } from 'next';
import { Suspense } from 'react';
import { MapView } from '@/components/map/MapView';
import { PageHeader } from '@/components/ui/PageHeader';
import { QueryFailure } from '@/components/ui/states';
import { fetchMapData } from '@/lib/supabase/queries/map';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Map',
};

export default async function MapPage() {
  const result = await fetchMapData();

  if (!result.ok) {
    return (
      <div className="page">
        <PageHeader kicker="Geospatial" title="Supply-chain map" />
        <QueryFailure result={result} />
      </div>
    );
  }

  return (
    <Suspense>
      <MapView data={result.data} />
    </Suspense>
  );
}
