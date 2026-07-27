import Link from 'next/link';
import { ConfidenceIndicator, ProvenanceBadge, SeverityIndicator, StatusLabel } from '@/components/ui/badges';
import { Hint } from '@/components/ui/Hint';
import { MetricValue } from '@/components/ui/MetricValue';
import { PageHeader } from '@/components/ui/PageHeader';
import { Panel } from '@/components/ui/Panel';
import { EmptyState, QueryFailure } from '@/components/ui/states';
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
import { fetchAssetList } from '@/lib/supabase/queries/assets';
import { fetchOverviewData } from '@/lib/supabase/queries/overview';
import type { AssetListItem, NodeStatus } from '@/lib/supabase/types';

export const dynamic = 'force-dynamic';

export default async function OverviewPage() {
  const [overviewRes, assetsRes] = await Promise.all([fetchOverviewData(), fetchAssetList()]);

  if (!overviewRes.ok) {
    return (
      <div className="page">
        <Header />
        <QueryFailure result={overviewRes} />
      </div>
    );
  }
  const overview = overviewRes.data;
  const assets: AssetListItem[] = assetsRes.ok ? assetsRes.data : [];
  const assetByNodeId = new Map(assets.map((item) => [item.node.node_id, item]));

  const countByStatus = (status: NodeStatus) => overview.nodes.filter((n) => n.status === status).length;
  const operatingAssets = overview.nodes.filter(
    (n) => !PROCESSING_NODE_TYPES.has(n.node_type) && !GATEWAY_NODE_TYPES.has(n.node_type) && n.status === 'operating',
  ).length;
  const developmentProjects = overview.nodes.filter(
    (n) =>
      !PROCESSING_NODE_TYPES.has(n.node_type) &&
      !GATEWAY_NODE_TYPES.has(n.node_type) &&
      (n.status === 'development' || n.status === 'construction'),
  ).length;
  const processingFacilities = overview.nodes.filter((n) => PROCESSING_NODE_TYPES.has(n.node_type)).length;
  const gateways = overview.nodes.filter((n) => GATEWAY_NODE_TYPES.has(n.node_type)).length;
  const countries = new Set(overview.nodes.map((n) => n.country_code)).size;

  const totalAssertions = overview.assertions.length;
  const highConfidence = overview.assertions.filter((a) => a.confidence_score >= 85).length;
  const highConfidenceShare = totalAssertions > 0 ? Math.round((highConfidence / totalAssertions) * 100) : null;

  const provenanceMix = ['reported', 'modelled', 'unverified'].map((prov) => ({
    prov: prov as 'reported' | 'modelled' | 'unverified',
    count: overview.assertions.filter((a) => a.provenance === prov).length,
  }));

  // Watchlist: assets with recorded observations first, then by identity confidence.
  const watchlist = [...assets]
    .sort((a, b) => b.observation_count - a.observation_count || (b.identity_confidence ?? -1) - (a.identity_confidence ?? -1))
    .slice(0, 8);

  // Coverage flags (counts, upstream assets only for production/capacity)
  const upstream = assets.filter((a) => a.node.node_type === 'mine' || a.node.node_type === 'development_project');
  const missingProduction = upstream.filter(
    (a) => a.observation_count === 0 || !hasMetricKind(a, 'production'),
  ).length;
  const missingCapacity = upstream.filter((a) => a.observation_count === 0 || !hasMetricKind(a, 'capacity')).length;
  const staleRecords = overview.nodes.filter((n) => isStale(n.last_reviewed_at)).length;
  const lowConfidenceIdentity = overview.identity.filter((row) => row.confidence_score < 65).length;

  const supplyMetrics = overview.observations.filter((obs) => obs.node_id !== null).slice(0, 8);

  return (
    <div className="page">
      <Header />

      <div className="kpi-grid">
        <Kpi label="Operating assets" value={operatingAssets} foot="mines & projects in production" />
        <Kpi label="Development projects" value={developmentProjects} foot="prospective, incl. construction" />
        <Kpi label="Processing facilities" value={processingFacilities} foot="concentrators to trioxide plants" />
        <Kpi label="Logistics gateways" value={gateways} foot="ports & border crossings" />
        <Kpi label="Countries" value={countries} foot="with mapped nodes" />
        <Kpi label="Sources" value={overview.sourceCount} foot={`${totalAssertions} assertions on file`} />
        <Kpi
          label="High-confidence"
          value={highConfidenceShare === null ? '—' : `${highConfidenceShare}%`}
          foot="assertions scoring ≥ 85/100"
        />
      </div>

      <div className="panel-grid">
        <div className="col-span-7">
          <Panel
            title="Priority assets"
            note="Ranked by recorded evidence, then identity confidence"
            flush
          >
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
                      <th>Provenance</th>
                      <th>Confidence</th>
                    </tr>
                  </thead>
                  <tbody>
                    {watchlist.map((item) => (
                      <tr key={item.node.node_id}>
                        <td className="primary-cell">
                          <Link href={`/assets/${item.node.node_id}`} className="row-link">
                            {item.node.canonical_name}
                          </Link>
                          <span className="cell-sub">{formatNodeType(item.node.node_type)}</span>
                        </td>
                        <td>{countryName(item.node.country_code)}</td>
                        <td>
                          <StatusLabel status={item.node.status} />
                        </td>
                        <td>
                          {item.latest_observation ? (
                            <MetricValue observation={item.latest_observation} compact />
                          ) : (
                            <span className="note">Not yet researched</span>
                          )}
                        </td>
                        <td>
                          <ProvenanceBadge provenance={item.identity_provenance} />
                        </td>
                        <td>
                          <ConfidenceIndicator score={item.identity_confidence} />
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
              <Hint text="Quantities are shown per metric with their original unit, period and estimate type. Different product forms and units are never aggregated into a single supply figure.">
                <span>Why no single total?</span>
              </Hint>
            }
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
                    {supplyMetrics.map((obs) => {
                      const asset = obs.node_id ? assetByNodeId.get(obs.node_id) : undefined;
                      return (
                        <tr key={obs.observation_id}>
                          <td className="primary-cell">
                            {asset ? (
                              <Link href={`/assets/${asset.node.node_id}`} className="row-link">
                                {asset.node.canonical_name}
                              </Link>
                            ) : (
                              <span className="note">Country-level</span>
                            )}
                          </td>
                          <td>
                            <MetricValue observation={obs} />
                          </td>
                          <td>
                            {asset ? (
                              <span className="note">
                                {supplyCategory(asset.node.status) === 'operating'
                                  ? 'Operating supply'
                                  : supplyCategory(asset.node.status) === 'prospective'
                                    ? 'Prospective supply'
                                    : 'Inactive / uncertain'}
                              </span>
                            ) : (
                              <span className="note">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </div>

        <div className="col-span-5">
          <Panel title="Recent material events" note={<Link href="/events">Event monitor →</Link>} flush>
            {overview.recentEvents.length === 0 ? (
              <EmptyState
                title="No events recorded yet"
                detail="Export controls, suspensions, permits and other material events will appear here."
              />
            ) : (
              <ul className="timeline">
                {overview.recentEvents.map((event) => (
                  <li key={event.event_id} className={`sev-${event.severity ?? 1}`}>
                    <div className="inline-list" style={{ justifyContent: 'space-between' }}>
                      <strong style={{ fontSize: 12.5 }}>{event.headline}</strong>
                    </div>
                    <div className="note" style={{ marginTop: 2 }}>
                      {formatEventType(event.event_type)} · {formatDate(event.announced_at)}
                      {event.country_code ? ` · ${countryName(event.country_code)}` : ''}
                    </div>
                    <div style={{ marginTop: 4 }}>
                      <SeverityIndicator severity={event.severity} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Evidence mix" note="All assertions on file">
            {totalAssertions === 0 ? (
              <EmptyState title="No assertions yet" />
            ) : (
              <div>
                {provenanceMix.map(({ prov, count }) => (
                  <div className="bar-row" key={prov}>
                    <ProvenanceBadge provenance={prov} withHint={false} />
                    <div className="bar-track">
                      <div
                        className="bar-fill"
                        style={{
                          width: count > 0 ? `${Math.max(2, (count / totalAssertions) * 100)}%` : 0,
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
                      {count} <span className="note">({Math.round((count / totalAssertions) * 100)}%)</span>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Panel>

          <Panel title="Data coverage" note={<Link href="/methodology">Methodology →</Link>}>
            <dl className="kv">
              <dt>Upstream assets without a production metric</dt>
              <dd className="num" style={{ textAlign: 'left' }}>
                {upstream.length === 0 ? 'No upstream assets yet' : `${missingProduction} of ${upstream.length}`}
              </dd>
              <dt>Upstream assets without a capacity metric</dt>
              <dd className="num" style={{ textAlign: 'left' }}>
                {upstream.length === 0 ? 'No upstream assets yet' : `${missingCapacity} of ${upstream.length}`}
              </dd>
              <dt>Nodes not reviewed in 12 months</dt>
              <dd className="num" style={{ textAlign: 'left' }}>
                {overview.nodes.length === 0 ? 'No nodes yet' : `${staleRecords} of ${overview.nodes.length}`}
              </dd>
              <dt>Nodes with low-confidence identity (&lt; 65)</dt>
              <dd className="num" style={{ textAlign: 'left' }}>
                {overview.identity.length === 0 ? 'No scored nodes yet' : `${lowConfidenceIdentity} of ${overview.identity.length}`}
              </dd>
              <dt>Trade flows on file</dt>
              <dd className="num" style={{ textAlign: 'left' }}>
                {overview.tradeFlowCount === 0 ? 'Not yet loaded' : overview.tradeFlowCount}
              </dd>
            </dl>
          </Panel>

          <Panel title="Status mix" note="All node types">
            <dl className="kv">
              {(
                ['operating', 'construction', 'development', 'care_and_maintenance', 'suspended', 'closed', 'unknown'] as NodeStatus[]
              )
                .map((status) => ({ status, count: countByStatus(status) }))
                .filter(({ count }) => count > 0)
                .map(({ status, count }) => (
                  <StatusRow key={status} status={status} count={count} />
                ))}
            </dl>
            {overview.nodes.length === 0 && <EmptyState title="No nodes yet" />}
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

function hasMetricKind(item: AssetListItem, kind: 'production' | 'capacity'): boolean {
  return item.metric_kinds.includes(kind);
}
