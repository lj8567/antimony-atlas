import type { Metadata } from 'next';
import { Suspense } from 'react';
import { EventMonitor } from '@/components/events/EventMonitor';
import { PageHeader } from '@/components/ui/PageHeader';
import { QueryFailure, TableSkeleton, WarningsNotice } from '@/components/ui/states';
import { fetchEvents } from '@/lib/supabase/queries/events';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Events',
};

export default async function EventsPage() {
  const result = await fetchEvents();

  return (
    <div className="page">
      <PageHeader
        kicker="Event monitor"
        title="Material supply events"
        description="Ownership changes, commissioning milestones, suspensions, recommissioning, supply agreements and capacity changes affecting the antimony supply chain. Severity is analyst-rated 1–5; supply impacts are never invented."
      />
      {result.ok ? (
        <>
          <WarningsNotice warnings={result.warnings} />
          <Suspense fallback={<div className="panel"><TableSkeleton rows={8} /></div>}>
            <EventMonitor events={result.data} />
          </Suspense>
        </>
      ) : (
        <QueryFailure result={result} />
      )}
    </div>
  );
}
