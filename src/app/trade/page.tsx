import type { Metadata } from 'next';
import { Suspense } from 'react';
import { TradeExplorer } from '@/components/trade/TradeExplorer';
import { PageHeader } from '@/components/ui/PageHeader';
import { QueryFailure, TableSkeleton } from '@/components/ui/states';
import { fetchTradeData } from '@/lib/supabase/queries/trade';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Trade flows',
};

export default async function TradePage() {
  const result = await fetchTradeData();

  return (
    <div className="page">
      <PageHeader
        kicker="Trade flows"
        title="Country-to-country antimony trade"
        description="Customs flows for antimony ores and concentrates (HS 261710), unwrought antimony and powders (HS 811010) and antimony oxides (HS 282580)."
      />
      <div className="warn-strip" role="note">
        <span aria-hidden>⚠</span>
        <span>
          Customs data is reporter-declared and product forms are not interchangeable. Flows identify countries, not
          mines, buyers or facilities. Mirror discrepancies between reporters are shown, not reconciled.
        </span>
      </div>
      {result.ok ? (
        <Suspense fallback={<div className="panel"><TableSkeleton rows={10} /></div>}>
          <TradeExplorer flows={result.data.flows} productForms={result.data.productForms} truncated={result.data.truncated} />
        </Suspense>
      ) : (
        <QueryFailure result={result} />
      )}
    </div>
  );
}
