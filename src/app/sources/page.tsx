import type { Metadata } from 'next';
import { Suspense } from 'react';
import { SourceExplorer } from '@/components/sources/SourceExplorer';
import { PageHeader } from '@/components/ui/PageHeader';
import { QueryFailure, TableSkeleton, WarningsNotice } from '@/components/ui/states';
import { fetchSources } from '@/lib/supabase/queries/sources';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Sources',
};

export default async function SourcesPage() {
  const result = await fetchSources();

  return (
    <div className="page">
      <PageHeader
        kicker="Evidence base"
        title="Source register"
        description="Every material claim in the atlas traces to a registered source. Expand a source to see the exact claims it supports and the assets they attach to."
      />
      {result.ok ? (
        <>
          <WarningsNotice warnings={result.warnings} />
          <Suspense fallback={<div className="panel"><TableSkeleton rows={8} /></div>}>
            <SourceExplorer sources={result.data} />
          </Suspense>
        </>
      ) : (
        <QueryFailure result={result} />
      )}
    </div>
  );
}
