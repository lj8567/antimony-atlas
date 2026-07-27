import type { QueryResult } from '@/lib/supabase/types';

export function EmptyState({ title, detail }: { title: string; detail?: string }) {
  return (
    <div className="empty-state" role="status">
      <h3>{title}</h3>
      {detail && <p>{detail}</p>}
    </div>
  );
}

export function ErrorState({ title = 'Data unavailable', detail }: { title?: string; detail?: string }) {
  return (
    <div className="error-state" role="alert">
      <h3>{title}</h3>
      <p>{detail ?? 'The database could not be queried. Reload the page or try again shortly.'}</p>
    </div>
  );
}

export function ConfigNotice() {
  return (
    <div className="config-notice" role="status">
      <p>
        <strong>Database connection not configured.</strong>
      </p>
      <p>
        Set <code>NEXT_PUBLIC_SUPABASE_URL</code> and <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> in the deployment
        environment (or <code>.env.local</code> for local development), then reload. No placeholder data is shown in
        their absence.
      </p>
    </div>
  );
}

/** Render the failure half of a QueryResult consistently. */
export function QueryFailure({ result }: { result: { ok: false; error: string; unconfigured: boolean } }) {
  if (result.unconfigured) return <ConfigNotice />;
  return <ErrorState detail={result.error} />;
}

export function isFailure<T>(result: QueryResult<T>): result is { ok: false; error: string; unconfigured: boolean } {
  return !result.ok;
}

export function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="panel-body" aria-hidden>
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="skeleton" style={{ height: 15, marginBottom: 10, opacity: 1 - index * 0.1 }} />
      ))}
    </div>
  );
}
