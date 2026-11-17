import type { Metadata } from 'next';
import { PageHeader } from '@/components/ui/PageHeader';
import { Panel } from '@/components/ui/Panel';
import { ConfigNotice } from '@/components/ui/states';
import { supabaseConfig } from '@/lib/supabase/client';
import { getServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Data status',
};

/**
 * Connection diagnostics: one row-count probe per table, with the exact
 * PostgREST error when a probe fails. This page exists to separate the four
 * failure classes cleanly:
 *   - missing env vars            → config notice (nothing else runs)
 *   - wrong URL / anon key        → 401 "Invalid API key" on every table
 *   - missing grant / RLS policy  → "permission denied" (42501) per table
 *   - RLS returning zero rows     → table "reachable" with 0 rows
 * No key material is ever displayed.
 */

const TABLES = [
  'metals',
  'product_forms',
  'entities',
  'nodes',
  'node_ownership',
  'sources',
  'assertions',
  'observations',
  'mineral_estimates',
  'events',
  'edges',
  'trade_flows',
] as const;

interface Probe {
  table: string;
  ok: boolean;
  count: number | null;
  detail: string;
}

async function probeTable(table: string): Promise<Probe> {
  const client = getServerClient();
  if (!client) return { table, ok: false, count: null, detail: 'Not configured' };
  // GET (not HEAD): postgrest-js silently maps a 404 with an empty body to a
  // 204, so a HEAD probe can never distinguish a missing table from success.
  const { count, error } = await client.from(table).select('*', { count: 'exact' }).limit(1);
  if (error) {
    const missing = ['42P01', 'PGRST205'].includes(error.code ?? '');
    return {
      table,
      ok: false,
      count: null,
      detail: missing
        ? 'Table does not exist in the schema'
        : `${error.message}${error.code ? ` (code ${error.code})` : ''}`,
    };
  }
  return { table, ok: true, count: count ?? 0, detail: count === 0 ? 'Reachable, 0 rows visible to anon' : 'OK' };
}

export default async function StatusPage() {
  const config = supabaseConfig();

  return (
    <div className="page">
      <PageHeader
        kicker="Diagnostics"
        title="Data status"
        description="Live per-table connectivity between this deployment and Supabase, using the same anonymous read-only credentials as every page."
      />

      <Panel title="Environment">
        <dl className="kv">
          <dt>NEXT_PUBLIC_SUPABASE_URL</dt>
          <dd className="mono">{config ? config.url : 'Not set'}</dd>
          <dt>NEXT_PUBLIC_SUPABASE_ANON_KEY</dt>
          <dd>{config ? `Present (${config.anonKey.length} characters — value never shown)` : 'Not set'}</dd>
          <dt>Checked at</dt>
          <dd className="mono">{new Date().toISOString()}</dd>
        </dl>
      </Panel>

      {!config ? (
        <ConfigNotice />
      ) : (
        <TableProbes />
      )}

      <p className="note">
        Reading guide: an error on <em>every</em> table usually means a wrong project URL or anon key; a
        “permission denied” on specific tables means anon SELECT grants or RLS policies are missing for those tables;
        “reachable, 0 rows” with data known to exist means an RLS policy is filtering anonymous reads. After the
        supply-chain foundation migration, mineral_estimates, edges and trade_flows should all be reachable even when
        they contain no rows.
      </p>
    </div>
  );
}

async function TableProbes() {
  const probes = await Promise.all(TABLES.map((table) => probeTable(table)));
  return (
    <Panel title="Table probes" note="SELECT count via the anonymous role" flush>
      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th>Table</th>
              <th>State</th>
              <th className="num">Rows visible</th>
              <th>Detail</th>
            </tr>
          </thead>
          <tbody>
            {probes.map((probe) => (
              <tr key={probe.table}>
                <td className="mono primary-cell">{probe.table}</td>
                <td>
                  {probe.ok ? (
                    <span className="status-label status-operating">
                      <span className="dot" aria-hidden />
                      Reachable
                    </span>
                  ) : probe.detail === 'Table does not exist in the schema' ? (
                    <span className="status-label status-unknown">
                      <span className="dot" aria-hidden />
                      Absent
                    </span>
                  ) : (
                    <span className="status-label status-suspended">
                      <span className="dot" aria-hidden />
                      Failing
                    </span>
                  )}
                </td>
                <td className="num">{probe.count ?? '—'}</td>
                <td style={{ maxWidth: 420, whiteSpace: 'normal' }}>{probe.detail}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}
