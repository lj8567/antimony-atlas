import type { Metadata } from 'next';
import { Suspense } from 'react';
import { AssetExplorer } from '@/components/assets/AssetExplorer';
import { PageHeader } from '@/components/ui/PageHeader';
import { QueryFailure, TableSkeleton } from '@/components/ui/states';
import { fetchAssetList } from '@/lib/supabase/queries/assets';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Assets',
};

export default async function AssetsPage() {
  const result = await fetchAssetList();

  return (
    <div className="page">
      <PageHeader
        kicker="Asset register"
        title="Assets"
        description="Mines, development projects, processing facilities and logistics gateways. Filter, sort and export; every metric keeps its unit, period, estimate type and source."
      />
      {result.ok ? (
        <Suspense fallback={<div className="panel"><TableSkeleton rows={10} /></div>}>
          <AssetExplorer items={result.data} />
        </Suspense>
      ) : (
        <QueryFailure result={result} />
      )}
    </div>
  );
}
