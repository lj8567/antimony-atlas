import Link from 'next/link';
import { ConfidenceIndicator, EvidenceSummary, SeverityIndicator, StatusLabel } from '@/components/ui/badges';
import { Hint } from '@/components/ui/Hint';
import { MetricValue } from '@/components/ui/MetricValue';
import { PageHeader } from '@/components/ui/PageHeader';
import { Panel } from '@/components/ui/Panel';
import { EmptyState, QueryFailure, WarningsNotice } from '@/components/ui/states';
import { countryName } from '@/lib/countries';
import {
  formatDate,
  formatEventType,
  formatNodeType,
  GATEWAY_NODE_TYPES,
  isStale,
  PROCESSING_NODE_TYPES,
  supplyCategory,
} from '@/lib/format';
import { fetchOverviewData } from '@/lib/supabase/queries/overview';
import type { NodeStatus } from '@/lib/supabase/types';

export const dynamic = 'force-dynamic';

export default async function OverviewPage() {
  const result = await fetchOverviewData();

  if (!result.ok) {
    return (
      <div className="page">
        <Header />
        <QueryFailure result={result} />
      </div>
    );
  }
  const { assets, recentEvents, sourceCount, claimCount, tradeFlowCount, tradeTableExists } = result.data;

  const upstreamAssets = assets.filter(
    (item) => !PROCESSING_NODE_TYPES.has(item.node.node_type) && !GATEWAY_NODE_TYPES.has(item.node.node_type),
  );
  const operatingAssets = upstreamAssets.filter((item) => item.node.status === 'operating').length;
  const developmentProjects = upstreamAssets.filter(
    (item) => item.node.status === 'development' || item.node.status === 'construction',
  ).length;
  const processingFacilities = assets.filter((item) => PROCESSING_NODE_TYPES.has(item.node.node_type)).length;
  const gateways = assets.filter((item) => GATEWAY_NODE_TYPES.has(item.node.node_type)).length;
  const countries = new Set(assets.map((item) => item.node.country_code).filter(Boolean)).size;

  const evidenceTotals = assets.reduce(
    (totals, item) => ({
      reported: totals.reported + item.evidence.reported,
      modelled: totals.modelled + item.evidence.modelled,
      unverified: totals.unverified + item.evidence.unverified,
    }),
    { reported: 0, modelled: 0, unverified: 0 },
  );
  const totalClaims = evidenceTotals.reported + evidenceTotals.modelled + evidenceTotals.unverified;
  const highConfidenceAssets = assets.filter((item) => (item.max_confidence ?? 0) >= 85).length;

  // Watchlist: assets with recorded observations first, then by max confidence.
  const watchlist = [...assets]
    .sort(
      (a, b) => b.observation_count - a.observation_count || (b.max_confidence ?? -1) - (a.max_confidence ?? -1),
    )
    .slice(0, 8);

  const missingProduction = upstreamAssets.filter((item) => !item.metric_kinds.includes('production')).length;
  const missingCapacity = upstreamAssets.filter((item) => !item.metric_kinds.includes('capacity')).length;
  const staleRecords = assets.filter((item) => isStale(item.node.updated_at)).length;

  // Latest principal metrics across assets, shown per metric with full qualifiers.
  const supplyMetrics = assets
    .filter((item) => item.principal_observation !== null)
    .sort((a, b) =>
      (b.principal_observation!.period_end ?? '').localeCompare(a.principal_observation!.period_end ?? ''),
    )
    .slice(0, 8);

  return (
    <div className="page">
      <Header />
      <WarningsNotice warnings={result.warnings} />

      <div className="kpi-grid">
        <Kpi label="Operating assets" value={operatingAssets} foot="mines & projects in production" />
        <Kpi label="Development projects" value={developmentProjects} foot="prospective, incl. construction" />
        <Kpi label="Processing facilities" value={processingFacilities} foot="concentrators, smelters, plants" />
        <Kpi label="Logistics gateways" value={gateways} foot="ports & border crossings" />
        <Kpi label="Countries" value={countries} foot="with mapped nodes" />
        <Kpi label="Sources" value={sourceCount} foot={`${claimCount} claims on file`} />
        <Kpi
          label="High-confidence assets"
          value={assets.length === 0 ? '—' : `${highConfidenceAssets} of ${assets.length}`}
          foot="max claim confidence ≥ 85/100"
        />
      </div>

      <div className="panel-grid">
        <div className="col-span-7">
          <Panel title="Priority assets" note="Ranked by recorded evidence, then confidence" flush>
            {watchlist.length === 0 ? (
              <EmptyState
                title="No assets recorded yet"
                detail="Assets appear here as nodes are researched and loaded into the database."
              />
            ) : (
              <div className="table-scroll">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Asset</th>
                      <th>Country</th>
                      <th>Status</th>
                      <th>Principal metric</th>
                      <th>Evidence</th>
                      <th>Max conf.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {watchlist.map((item) => (
                      <tr key={item.node.node_id}>
                        <td className="primary-cell">
                          <Link href={`/assets/${item.node.node_id}`} className="row-link">
                            {item.node.name}
                          </Link>
                          <span className="cell-sub">{formatNodeType(item.node.node_type)}</span>
                        </td>
                        <td>{countryName(item.node.country_code)}</td>
                        <td>
                          <StatusLabel status={item.node.status} />
                        </td>
                        <td>
                          {item.principal_observation ? (
                            <MetricValue observation={item.principal_observation} compact />
                          ) : (
                            <span className="note">Not yet researched</span>
                          )}
                        </td>
                        <td>
                          <EvidenceSummary counts={item.evidence} sourceCount={item.source_count} />
                        </td>
                        <td>
                          <ConfidenceIndicator score={item.max_confidence} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>

          <Panel
            title="Recorded supply metrics"
            note={
              <Hint text="Each asset's principal metric with its original unit, period and provenance. Production, capacity, resources and reserves are different things and are never aggregated into a single supply figure.">
                <span>Why no single total?</span>
              </Hint>
            }
            flush
          >
            {supplyMetrics.length === 0 ? (
              <EmptyState
                title="No quantitative observations yet"
                detail="Production, capacity and resource observations appear here with full qualifiers as they are researched."
              />
            ) : (
              <div className="table-scroll">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Asset</th>
                      <th>Metric</th>
                      <th>Supply class</th>
                    </tr>
                  </thead>
                  <tbody>
                    {supplyMetrics.map((item) => (
                      <tr key={item.node.node_id}>
                        <td className="primary-cell">
                          <Link href={`/assets/${item.node.node_id}`} className="row-link">
                            {item.node.name}
                          </Link>
                        </td>
                        <td>
                          <MetricValue observation={item.principal_observation!} />
                        </td>
                        <td>
                          <span className="note">
                            {supplyCategory(item.node.status) === 'operating'
                              ? 'Operating supply'
                              : supplyCategory(item.node.status) === 'prospective'
                                ? 'Prospective supply'
                                : 'Inactive / uncertain'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </div>

        <div className="col-span-5">
          <Panel title="Recent material events" note={<Link href="/events">Event monitor →</Link>} flush>
            {recentEvents.length === 0 ? (
              <EmptyState
                title="No events recorded yet"
                detail="Suspensions, commissioning milestones, permits and other material events will appear here."
              />
            ) : (
              <ul className="timeline">
                {recentEvents.map((event) => (
                  <li key={event.event_id} className={`sev-${event.severity ?? 1}`}>
                    <strong style={{ fontSize: 12.5 }}>{event.title}</strong>
                    <div className="note" style={{ marginTop: 2 }}>
                      {formatEventType(event.event_type)} · {formatDate(event.event_date)}
                      {event.node ? (
                        <>
                          {' · '}
                          <Link href={`/assets/${event.node.node_id}`}>{event.node.name}</Link>
                        </>
                      ) : null}
                    </div>
                    <div style={{ marginTop: 4 }}>
                      <SeverityIndicator severity={event.severity} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Evidence mix" note="All claims across assets">
            {totalClaims === 0 ? (
              <EmptyState title="No claims yet" />
            ) : (
              <div>
                {(['reported', 'modelled', 'unverified'] as const).map((prov) => {
                  const count = evidenceTotals[prov];
                  return (
                    <div className="bar-row" key={prov}>
                      <span style={{ textTransform: 'capitalize' }}>{prov}</span>
                      <div className="bar-track">
                        <div
                          className="bar-fill"
                          style={{
                            width: count > 0 ? `${Math.max(2, (count / totalClaims) * 100)}%` : 0,
                            background:
                              prov === 'reported'
                                ? 'var(--prov-reported)'
                                : prov === 'modelled'
                                  ? 'var(--prov-modelled)'
                                  : 'var(--prov-unverified)',
                            opacity: 0.75,
                          }}
                        />
                      </div>
                      <span className="num">
                        {count} <span className="note">({Math.round((count / totalClaims) * 100)}%)</span>
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </Panel>

          <Panel title="Data coverage" note={<Link href="/methodology">Methodology →</Link>}>
            <dl className="kv">
              <dt>Upstream assets without a production metric</dt>
              <dd className="num" style={{ textAlign: 'left' }}>
                {upstreamAssets.length === 0 ? 'No upstream assets yet' : `${missingProduction} of ${upstreamAssets.length}`}
              </dd>
              <dt>Upstream assets without a capacity metric</dt>
              <dd className="num" style={{ textAlign: 'left' }}>
                {upstreamAssets.length === 0 ? 'No upstream assets yet' : `${missingCapacity} of ${upstreamAssets.length}`}
              </dd>
              <dt>Records not updated in 12 months</dt>
              <dd className="num" style={{ textAlign: 'left' }}>
                {assets.length === 0 ? 'No nodes yet' : `${staleRecords} of ${assets.length}`}
              </dd>
              <dt>Trade flows on file</dt>
              <dd className="num" style={{ textAlign: 'left' }}>
                {!tradeTableExists ? 'Table not yet created' : tradeFlowCount === 0 ? 'Not yet loaded' : tradeFlowCount}
              </dd>
            </dl>
          </Panel>

          <Panel title="Status mix" note="All node types">
            <dl className="kv">
              {(
                ['operating', 'construction', 'development', 'care_and_maintenance', 'suspended', 'closed', 'unknown'] as NodeStatus[]
              )
                .map((status) => ({ status, count: assets.filter((item) => item.node.status === status).length }))
                .filter(({ count }) => count > 0)
                .map(({ status, count }) => (
                  <StatusRow key={status} status={status} count={count} />
                ))}
            </dl>
            {assets.length === 0 && <EmptyState title="No nodes yet" />}
          </Panel>
        </div>
      </div>
    </div>
  );
}

function Header() {
  return (
    <PageHeader
      kicker="Market overview"
      title="Non-Chinese antimony supply landscape"
      description="Operating and prospective assets, processing, gateways and material events — every figure carries its provenance, confidence and source."
    />
  );
}

function Kpi({ label, value, foot }: { label: string; value: number | string; foot?: string }) {
  return (
    <div className="kpi">
      <p className="kpi-label">{label}</p>
      <p className="kpi-value">{value}</p>
      {foot && <p className="kpi-foot">{foot}</p>}
    </div>
  );
}

function StatusRow({ status, count }: { status: NodeStatus; count: number }) {
  return (
    <>
      <dt>
        <StatusLabel status={status} />
      </dt>
      <dd className="num" style={{ textAlign: 'left' }}>
        {count}
      </dd>
    </>
  );
}
