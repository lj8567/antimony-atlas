import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CountryAssetsExport } from '@/components/countries/CountryAssetsExport';
import { ConfidenceIndicator, ProvenanceBadge, SeverityIndicator, StatusLabel } from '@/components/ui/badges';
import { Hint } from '@/components/ui/Hint';
import { MetricValue } from '@/components/ui/MetricValue';
import { PageHeader } from '@/components/ui/PageHeader';
import { Panel } from '@/components/ui/Panel';
import { SourceLink } from '@/components/ui/SourceLink';
import { EmptyState, QueryFailure } from '@/components/ui/states';
import { countryName } from '@/lib/countries';
import {
  formatDate,
  formatEventType,
  formatGrossWeightKg,
  formatNodeType,
  formatNumber,
  formatUsd,
  GATEWAY_NODE_TYPES,
  PROCESSING_NODE_TYPES,
  supplyCategory,
} from '@/lib/format';
import { fetchAssetList } from '@/lib/supabase/queries/assets';
import { fetchCountryExtras } from '@/lib/supabase/queries/countries';
import type { TradeFlowDetail } from '@/lib/supabase/types';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Country profile',
};

export default async function CountryPage({ params }: { params: Promise<{ code: string }> }) {
  const { code: rawCode } = await params;
  const code = rawCode.toUpperCase();
  if (!/^[A-Z]{3}$/.test(code)) notFound();

  const [assetsRes, extrasRes] = await Promise.all([fetchAssetList(), fetchCountryExtras(code)]);

  if (!assetsRes.ok) {
    return (
      <div className="page">
        <PageHeader kicker="Country profile" title={countryName(code)} />
        <QueryFailure result={assetsRes} />
      </div>
    );
  }

  const assets = assetsRes.data.filter((item) => item.node.country_code === code);
  const extras = extrasRes.ok ? extrasRes.data : { observations: [], events: [], tradeFlows: [] };
  const hasAnything =
    assets.length > 0 || extras.observations.length > 0 || extras.events.length > 0 || extras.tradeFlows.length > 0;
  if (!hasAnything) notFound();

  const upstream = assets.filter((item) => !PROCESSING_NODE_TYPES.has(item.node.node_type) && !GATEWAY_NODE_TYPES.has(item.node.node_type));
  const processing = assets.filter((item) => PROCESSING_NODE_TYPES.has(item.node.node_type));
  const gateways = assets.filter((item) => GATEWAY_NODE_TYPES.has(item.node.node_type));
  const operating = assets.filter((item) => supplyCategory(item.node.status) === 'operating').length;
  const prospective = assets.filter((item) => supplyCategory(item.node.status) === 'prospective').length;

  const nodeEvents = assets.flatMap((item) => (item.latest_event ? [{ item, event: item.latest_event }] : []));
  const trade = summariseTrade(extras.tradeFlows, code);

  return (
    <div className="page">
      <PageHeader
        kicker={`Country profile · ${code}`}
        title={countryName(code)}
        description="Assets, processing, gateways, trade participation and events recorded for this country in the pilot dataset."
        actions={
          <>
            <CountryAssetsExport items={assets} countryCode={code} />
            <Link className="btn" href={`/assets?country=${code}`}>
              Open in asset explorer
            </Link>
          </>
        }
      />

      <div className="kpi-grid">
        <Kpi label="Mines & projects" value={upstream.length} />
        <Kpi label="Processing facilities" value={processing.length} />
        <Kpi label="Gateways" value={gateways.length} />
        <Kpi label="Operating assets" value={operating} />
        <Kpi label="Prospective assets" value={prospective} />
        <Kpi label="Events on file" value={extras.events.length} />
      </div>

      <div className="panel-grid">
        <div className="col-span-8">
          <Panel title="Assets" flush>
            {assets.length === 0 ? (
              <EmptyState title="No assets recorded in this country yet" />
            ) : (
              <div className="table-scroll">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Asset</th>
                      <th>Type</th>
                      <th>Status</th>
                      <th>Principal metric</th>
                      <th>Provenance</th>
                      <th>Confidence</th>
                    </tr>
                  </thead>
                  <tbody>
                    {assets.map((item) => (
                      <tr key={item.node.node_id}>
                        <td className="primary-cell">
                          <Link href={`/assets/${item.node.node_id}`} className="row-link">
                            {item.node.canonical_name}
                          </Link>
                          {item.node.region && <span className="cell-sub">{item.node.region}</span>}
                        </td>
                        <td>{formatNodeType(item.node.node_type)}</td>
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
            title="Trade participation"
            note={
              <Hint text="Sums combine gross weight (kg) within a single product form and direction only — never across product forms. Values are reporter-declared customs figures.">
                <span>Aggregation basis</span>
              </Hint>
            }
            flush
          >
            {trade.length === 0 ? (
              <EmptyState
                title="No trade flows loaded for this country yet"
                detail="Customs flows for HS 261710, 811010 and 282580 appear here once imported."
              />
            ) : (
              <div className="table-scroll">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Direction</th>
                      <th>Product form</th>
                      <th>Period</th>
                      <th className="num">Flows</th>
                      <th className="num">Gross weight</th>
                      <th className="num">Value</th>
                      <th>Top partner</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trade.map((row) => (
                      <tr key={row.key}>
                        <td>{row.direction}</td>
                        <td>
                          {row.productForm}
                          {row.hsCode && <span className="cell-sub mono">HS {row.hsCode}</span>}
                        </td>
                        <td>{row.year}</td>
                        <td className="num">{row.flowCount}</td>
                        <td className="num">{row.weightKg === null ? <span className="note">Not reported</span> : formatGrossWeightKg(row.weightKg)}</td>
                        <td className="num">{formatUsd(row.valueUsd)}</td>
                        <td>
                          {row.topPartner ? (
                            <>
                              {countryName(row.topPartner.code)}{' '}
                              <span className="note">({formatNumber(row.topPartner.sharePct)}% of value)</span>
                            </>
                          ) : (
                            <span className="note">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="table-foot">
              <span>
                Full flow-level records, filters and export are in the <Link href={`/trade?exporter=${code}`}>trade explorer</Link>.
              </span>
            </div>
          </Panel>

          {extras.observations.length > 0 && (
            <Panel title="Country-level observations" note="National statistics not allocated to a specific asset" flush>
              <div className="table-scroll">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Metric</th>
                      <th>Estimate type</th>
                      <th>Confidence</th>
                      <th>Source</th>
                    </tr>
                  </thead>
                  <tbody>
                    {extras.observations.map((obs) => (
                      <tr key={obs.observation_id}>
                        <td>
                          <MetricValue observation={obs} />
                        </td>
                        <td>
                          <ProvenanceBadge provenance={obs.estimate_type} />
                        </td>
                        <td>
                          <ConfidenceIndicator score={obs.assertion?.confidence_score} />
                        </td>
                        <td>
                          {obs.assertion?.source ? (
                            <SourceLink url={obs.assertion.source.url} title={obs.assertion.source.publisher} />
                          ) : (
                            <span className="note">Missing source</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
          )}
        </div>

        <div className="col-span-4">
          <Panel title="Recent events" flush>
            {extras.events.length === 0 && nodeEvents.length === 0 ? (
              <EmptyState title="No events recorded for this country" />
            ) : (
              <ul className="timeline">
                {extras.events.slice(0, 10).map((event) => (
                  <li key={event.event_id} className={`sev-${event.severity ?? 1}`}>
                    <strong style={{ fontSize: 12.5 }}>{event.headline}</strong>
                    <div className="note" style={{ margin: '2px 0 4px' }}>
                      {formatEventType(event.event_type)} · {formatDate(event.announced_at)}
                    </div>
                    <SeverityIndicator severity={event.severity} />
                  </li>
                ))}
                {extras.events.length === 0 &&
                  nodeEvents.map(({ item, event }) => (
                    <li key={event.event_id} className={`sev-${event.severity ?? 1}`}>
                      <strong style={{ fontSize: 12.5 }}>{event.headline}</strong>
                      <div className="note" style={{ margin: '2px 0 4px' }}>
                        {formatEventType(event.event_type)} · {formatDate(event.announced_at)} ·{' '}
                        <Link href={`/assets/${item.node.node_id}`}>{item.node.canonical_name}</Link>
                      </div>
                      <SeverityIndicator severity={event.severity} />
                    </li>
                  ))}
              </ul>
            )}
          </Panel>

          <Panel title="Gateways">
            {gateways.length === 0 ? (
              <p className="note">No ports or border gateways recorded for this country yet.</p>
            ) : (
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12.5 }}>
                {gateways.map((item) => (
                  <li key={item.node.node_id} style={{ marginBottom: 5 }}>
                    <Link href={`/assets/${item.node.node_id}`}>{item.node.canonical_name}</Link>{' '}
                    <span className="note">({formatNodeType(item.node.node_type)})</span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Data coverage">
            <dl className="kv">
              <dt>Assets with metrics</dt>
              <dd>
                {assets.length === 0 ? '—' : `${assets.filter((item) => item.observation_count > 0).length} of ${assets.length}`}
              </dd>
              <dt>Assets with sources</dt>
              <dd>{assets.length === 0 ? '—' : `${assets.filter((item) => item.source_count > 0).length} of ${assets.length}`}</dd>
              <dt>Country-level observations</dt>
              <dd>{extras.observations.length === 0 ? 'None recorded' : extras.observations.length}</dd>
              <dt>Trade flows</dt>
              <dd>{extras.tradeFlows.length === 0 ? 'Not yet loaded' : extras.tradeFlows.length}</dd>
            </dl>
          </Panel>
        </div>
      </div>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="kpi">
      <p className="kpi-label">{label}</p>
      <p className="kpi-value">{value}</p>
    </div>
  );
}

interface TradeSummaryRow {
  key: string;
  direction: 'Exports' | 'Imports';
  productForm: string;
  hsCode: string | null;
  year: string;
  flowCount: number;
  weightKg: number | null;
  valueUsd: number | null;
  topPartner: { code: string; sharePct: number } | null;
}

/** Group flows by direction + product form + year; sum only within a group. */
function summariseTrade(flows: TradeFlowDetail[], code: string): TradeSummaryRow[] {
  const groups = new Map<
    string,
    {
      direction: 'Exports' | 'Imports';
      productForm: string;
      hsCode: string | null;
      year: string;
      flowCount: number;
      weightKg: number | null;
      valueUsd: number | null;
      partners: Map<string, number>;
    }
  >();

  for (const flow of flows) {
    const isExport = flow.exporter_code === code;
    const direction = isExport ? 'Exports' : 'Imports';
    const partner = isExport ? flow.importer_code : flow.exporter_code;
    const year = flow.period_start.slice(0, 4);
    const formName = flow.product_form?.name ?? 'Unknown form';
    const key = `${direction}|${formName}|${year}`;
    const group =
      groups.get(key) ??
      {
        direction: direction as 'Exports' | 'Imports',
        productForm: formName,
        hsCode: flow.product_form?.hs_code ?? null,
        year,
        flowCount: 0,
        weightKg: null,
        valueUsd: null,
        partners: new Map<string, number>(),
      };
    group.flowCount += 1;
    if (flow.gross_weight_kg !== null) group.weightKg = (group.weightKg ?? 0) + flow.gross_weight_kg;
    if (flow.trade_value_usd !== null) {
      group.valueUsd = (group.valueUsd ?? 0) + flow.trade_value_usd;
      group.partners.set(partner, (group.partners.get(partner) ?? 0) + flow.trade_value_usd);
    }
    groups.set(key, group);
  }

  return [...groups.entries()]
    .map(([key, group]) => {
      const ranked = [...group.partners.entries()].sort((a, b) => b[1] - a[1]);
      const top = ranked[0];
      return {
        key,
        direction: group.direction,
        productForm: group.productForm,
        hsCode: group.hsCode,
        year: group.year,
        flowCount: group.flowCount,
        weightKg: group.weightKg,
        valueUsd: group.valueUsd,
        topPartner:
          top && group.valueUsd ? { code: top[0], sharePct: Math.round((top[1] / group.valueUsd) * 100) } : null,
      };
    })
    .sort((a, b) => b.year.localeCompare(a.year) || a.direction.localeCompare(b.direction));
}
