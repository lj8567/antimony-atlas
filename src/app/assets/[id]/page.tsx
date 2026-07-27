import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { collectAssetSources } from '@/components/asset-detail/collect-sources';
import { SourcesDrawerButton } from '@/components/asset-detail/SourcesDrawerButton';
import { ConfidenceIndicator, ProvenanceBadge, SeverityIndicator, StatusLabel } from '@/components/ui/badges';
import { Hint } from '@/components/ui/Hint';
import { PageHeader } from '@/components/ui/PageHeader';
import { Panel } from '@/components/ui/Panel';
import { SourceLink } from '@/components/ui/SourceLink';
import { EmptyState, QueryFailure } from '@/components/ui/states';
import { countryName } from '@/lib/countries';
import {
  formatDate,
  formatEventType,
  formatFieldName,
  formatLocationPrecision,
  formatNodeType,
  formatPercent,
  formatPeriod,
  formatQuantity,
  isApproximateLocation,
  isStale,
} from '@/lib/format';
import { fetchAssetDetail, type AssetDetail } from '@/lib/supabase/queries/asset-detail';
import type { AssertionWithSource, NodeAssertion } from '@/lib/supabase/types';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Asset detail',
};

export default async function AssetDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await fetchAssetDetail(id);

  if (!result.ok) {
    return (
      <div className="page">
        <PageHeader kicker="Asset" title="Asset detail" />
        <QueryFailure result={result} />
      </div>
    );
  }
  if (result.data === null) notFound();

  const detail = result.data;
  const { node } = detail;
  const sources = collectAssetSources(detail);
  const profileAssertions = detail.assertions.filter((na) => na.field_name !== 'identity');
  const identityAssertion = pickPrimary(detail.assertions.filter((na) => na.field_name === 'identity'));
  const quality = buildQualityFlags(detail);

  return (
    <div className="page">
      <PageHeader
        kicker={`${formatNodeType(node.node_type)} · ${countryName(node.country_code)}${node.region ? ` · ${node.region}` : ''}`}
        title={node.canonical_name}
        description={node.description ?? undefined}
        actions={
          <>
            <SourcesDrawerButton entries={sources} assetName={node.canonical_name} />
            <Link className="btn" href={`/map?focus=${node.node_id}`}>
              View on map
            </Link>
          </>
        }
      />

      <div className="kpi-grid">
        <div className="kpi">
          <p className="kpi-label">Status</p>
          <p className="kpi-value" style={{ fontSize: 15 }}>
            <StatusLabel status={node.status} />
          </p>
          <p className="kpi-foot">
            {node.status_effective_date ? `as of ${formatDate(node.status_effective_date)}` : 'effective date not recorded'}
          </p>
        </div>
        <div className="kpi">
          <p className="kpi-label">Operator</p>
          <p className="kpi-value" style={{ fontSize: 15 }}>
            {detail.node.operator?.legal_name ?? 'Not reported'}
          </p>
          {detail.node.operator?.website && (
            <p className="kpi-foot">
              <SourceLink url={detail.node.operator.website} title="Website" />
            </p>
          )}
        </div>
        <div className="kpi">
          <p className="kpi-label">Identity evidence</p>
          <p className="kpi-value" style={{ fontSize: 15 }}>
            {identityAssertion?.assertion ? (
              <span className="inline-list">
                <ProvenanceBadge provenance={identityAssertion.assertion.provenance} />
                <ConfidenceIndicator score={identityAssertion.assertion.confidence_score} />
              </span>
            ) : (
              <span className="note">Not scored</span>
            )}
          </p>
        </div>
        <div className="kpi">
          <p className="kpi-label">Location</p>
          <p className="kpi-value mono" style={{ fontSize: 13.5 }}>
            {node.latitude.toFixed(3)}, {node.longitude.toFixed(3)}
          </p>
          <p className="kpi-foot">
            {isApproximateLocation(node.location_precision) ? (
              <Hint text="Coordinates are not surveyed positions. Precision reflects the best public disclosure for this site.">
                <span>{formatLocationPrecision(node.location_precision)}</span>
              </Hint>
            ) : (
              formatLocationPrecision(node.location_precision)
            )}
          </p>
        </div>
        <div className="kpi">
          <p className="kpi-label">Last reviewed</p>
          <p className="kpi-value" style={{ fontSize: 15 }}>
            {formatDate(node.last_reviewed_at, 'Not reviewed')}
          </p>
          <p className="kpi-foot">first recorded {formatDate(node.first_seen_at)}</p>
        </div>
      </div>

      <div className="panel-grid">
        <div className="col-span-8">
          <Panel
            title="Key metrics"
            note="Original units and periods; estimate qualifiers are never removed"
            flush
          >
            {detail.observations.length === 0 ? (
              <EmptyState
                title="No quantitative observations recorded"
                detail="Capacity, production and resource figures appear here with unit, period, estimate type and source."
              />
            ) : (
              <div className="table-scroll">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Metric</th>
                      <th className="num">Value</th>
                      <th>Period</th>
                      <th>Estimate type</th>
                      <th>Confidence</th>
                      <th>Source</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.observations.map((obs) => (
                      <tr key={obs.observation_id}>
                        <td className="primary-cell">
                          {obs.metric?.definition ? (
                            <Hint text={obs.metric.definition}>
                              <span>{obs.metric?.name ?? 'Unnamed metric'}</span>
                            </Hint>
                          ) : (
                            (obs.metric?.name ?? 'Unnamed metric')
                          )}
                          {obs.product_form && <span className="cell-sub">{obs.product_form.name}</span>}
                        </td>
                        <td className="num">
                          {obs.value_numeric !== null
                            ? formatQuantity(obs.value_numeric, obs.unit)
                            : (obs.value_text ?? 'Not reported')}
                        </td>
                        <td>{formatPeriod(obs.period_start, obs.period_end)}</td>
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
            )}
          </Panel>

          <Panel title="Asset profile" note="Sourced assertions" flush>
            {profileAssertions.length === 0 ? (
              <EmptyState title="No profile assertions recorded" />
            ) : (
              <div className="table-scroll">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Field</th>
                      <th>Claim</th>
                      <th>Provenance</th>
                      <th>Confidence</th>
                      <th>Source</th>
                    </tr>
                  </thead>
                  <tbody>
                    {groupAssertions(profileAssertions).map(({ fieldName, rows }) =>
                      rows.map((na, index) => (
                        <tr key={`${fieldName}-${index}`}>
                          <td className="primary-cell">
                            {index === 0 ? formatFieldName(fieldName) : ''}
                            {rows.length > 1 && index === 0 && (
                              <span className="cell-sub">{rows.length} claims on file</span>
                            )}
                          </td>
                          <td style={{ maxWidth: 420, whiteSpace: 'normal' }}>{na.assertion?.claim_text ?? '—'}</td>
                          <td>
                            <ProvenanceBadge provenance={na.assertion?.provenance ?? null} />
                          </td>
                          <td>
                            <ConfidenceIndicator score={na.assertion?.confidence_score} />
                          </td>
                          <td>
                            {na.assertion?.source ? (
                              <SourceLink url={na.assertion.source.url} title={na.assertion.source.publisher} />
                            ) : (
                              <span className="note">Missing source</span>
                            )}
                          </td>
                        </tr>
                      )),
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>

          <Panel title="Ownership" flush>
            {detail.ownership.length === 0 ? (
              <EmptyState title="No ownership records" detail="Ownership stakes appear here with effective dates and sources." />
            ) : (
              <div className="table-scroll">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Entity</th>
                      <th className="num">Stake</th>
                      <th>Effective</th>
                      <th>Provenance</th>
                      <th>Source</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.ownership.map((own, index) => (
                      <tr key={index}>
                        <td className="primary-cell">
                          {own.entity?.legal_name ?? 'Unknown entity'}
                          {own.entity?.entity_type && <span className="cell-sub">{formatNodeType(own.entity.entity_type)}</span>}
                        </td>
                        <td className="num">{formatPercent(own.ownership_pct)}</td>
                        <td>
                          {formatDate(own.effective_from, 'Not dated')}
                          {own.effective_to ? ` – ${formatDate(own.effective_to)}` : ' – present'}
                        </td>
                        <td>
                          <ProvenanceBadge provenance={own.assertion?.provenance ?? null} />
                        </td>
                        <td>
                          {own.assertion?.source ? (
                            <SourceLink url={own.assertion.source.url} title={own.assertion.source.publisher} />
                          ) : (
                            <span className="note">Missing source</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>

          <Panel
            title="Logistics & connections"
            note="Connections are evidence-classified; schematic lines are not physical routes"
            flush
          >
            {detail.edges.length === 0 ? (
              <EmptyState
                title="No recorded connections"
                detail="Links to concentrators, smelters and gateways appear here once evidenced. Absence of a link is not evidence of absence."
              />
            ) : (
              <div className="table-scroll">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Connection</th>
                      <th>Type</th>
                      <th>Product form</th>
                      <th>Relationship evidence</th>
                      <th>Confidence</th>
                      <th>Source</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.edges.map((edge) => {
                      const outbound = edge.from_node_id === node.node_id;
                      const other = outbound ? edge.to_node : edge.from_node;
                      return (
                        <tr key={edge.edge_id}>
                          <td className="primary-cell">
                            {outbound ? '→ ' : '← '}
                            {other ? (
                              <Link href={`/assets/${other.node_id}`} className="row-link">
                                {other.canonical_name}
                              </Link>
                            ) : (
                              'Unknown node'
                            )}
                            {other && <span className="cell-sub">{formatNodeType(other.node_type)} · {countryName(other.country_code)}</span>}
                          </td>
                          <td>{formatNodeType(edge.edge_type)}</td>
                          <td>{edge.product_form?.name ?? <span className="note">Not specified</span>}</td>
                          <td>
                            <ProvenanceBadge provenance={edge.relationship_status} />
                          </td>
                          <td>
                            <ConfidenceIndicator score={edge.confidence_score} />
                          </td>
                          <td>
                            {edge.assertion?.source ? (
                              <SourceLink url={edge.assertion.source.url} title={edge.assertion.source.publisher} />
                            ) : (
                              <span className="note">Missing source</span>
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

        <div className="col-span-4">
          <Panel title="Timeline" note="Linked material events" flush>
            {detail.events.length === 0 ? (
              <EmptyState title="No linked events" />
            ) : (
              <ul className="timeline">
                {detail.events.map((event) => (
                  <li key={event.event_id} className={`sev-${event.severity ?? 1}`}>
                    <strong style={{ fontSize: 12.5 }}>{event.headline}</strong>
                    <div className="note" style={{ margin: '2px 0 4px' }}>
                      {formatEventType(event.event_type)} · {formatDate(event.announced_at)}
                    </div>
                    {event.description && (
                      <p style={{ margin: '0 0 5px', fontSize: 12, color: 'var(--ink-2)' }}>{event.description}</p>
                    )}
                    <div className="inline-list">
                      <SeverityIndicator severity={event.severity} />
                      {event.assertion?.source && (
                        <SourceLink url={event.assertion.source.url} title={event.assertion.source.publisher} />
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Data quality" note="Automatic checks on this record">
            {quality.length === 0 ? (
              <p className="note">No outstanding flags on this record.</p>
            ) : (
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, color: 'var(--ink-2)' }}>
                {quality.map((flag, index) => (
                  <li key={index} style={{ marginBottom: 6 }}>
                    {flag}
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Record facts">
            <dl className="kv">
              <dt>Node type</dt>
              <dd>{formatNodeType(node.node_type)}</dd>
              <dt>Country</dt>
              <dd>
                <Link href={`/countries/${node.country_code}`}>{countryName(node.country_code)}</Link>
              </dd>
              <dt>Region</dt>
              <dd>{node.region ?? 'Not reported'}</dd>
              <dt>Coordinates</dt>
              <dd className="mono">
                {node.latitude.toFixed(4)}, {node.longitude.toFixed(4)}
              </dd>
              <dt>Location precision</dt>
              <dd>{formatLocationPrecision(node.location_precision)}</dd>
              <dt>Observations</dt>
              <dd>{detail.observations.length}</dd>
              <dt>Assertions</dt>
              <dd>{detail.assertions.length}</dd>
              <dt>Distinct sources</dt>
              <dd>{sources.length}</dd>
            </dl>
          </Panel>
        </div>
      </div>
    </div>
  );
}

function pickPrimary(assertions: NodeAssertion[]): NodeAssertion | null {
  return assertions.find((na) => na.is_primary) ?? assertions[0] ?? null;
}

function groupAssertions(assertions: NodeAssertion[]): Array<{ fieldName: string; rows: NodeAssertion[] }> {
  const byField = new Map<string, NodeAssertion[]>();
  for (const na of assertions) {
    const list = byField.get(na.field_name) ?? [];
    list.push(na);
    byField.set(na.field_name, list);
  }
  return [...byField.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([fieldName, rows]) => ({
      fieldName,
      rows: rows.sort((a, b) => Number(b.is_primary) - Number(a.is_primary)),
    }));
}

function buildQualityFlags(detail: AssetDetail): string[] {
  const flags: string[] = [];
  const { node } = detail;

  if (isApproximateLocation(node.location_precision)) {
    flags.push(`Coordinates are ${formatLocationPrecision(node.location_precision).toLowerCase()} — do not use for site-level analysis.`);
  }
  const modelledCount = detail.observations.filter((obs) => obs.estimate_type === 'modelled').length;
  if (modelledCount > 0) {
    flags.push(`${modelledCount} observation${modelledCount === 1 ? ' is a' : 's are'} modelled conversion${modelledCount === 1 ? '' : 's'} derived from reported inputs.`);
  }
  const lowConfidence: AssertionWithSource[] = [
    ...detail.assertions.map((na) => na.assertion),
    ...detail.observations.map((obs) => obs.assertion),
  ].filter((a): a is AssertionWithSource => a !== null && a.confidence_score < 65);
  if (lowConfidence.length > 0) {
    flags.push(`${lowConfidence.length} claim${lowConfidence.length === 1 ? '' : 's'} carry low confidence (< 65/100).`);
  }
  const multiClaimFields = groupAssertions(detail.assertions.filter((na) => na.field_name !== 'identity')).filter(
    ({ rows }) => rows.length > 1,
  );
  if (multiClaimFields.length > 0) {
    flags.push(
      `Multiple claims on file for: ${multiClaimFields.map(({ fieldName }) => formatFieldName(fieldName)).join(', ')} — conflicts are shown, not reconciled.`,
    );
  }
  if (isStale(node.last_reviewed_at)) {
    flags.push(
      node.last_reviewed_at
        ? `Record last reviewed ${formatDate(node.last_reviewed_at)} — more than 12 months ago.`
        : 'Record has no review date on file.',
    );
  }
  if (detail.observations.length === 0) {
    flags.push('No quantitative observations recorded yet.');
  }
  const unsourced =
    detail.assertions.filter((na) => !na.assertion?.source).length +
    detail.observations.filter((obs) => !obs.assertion?.source).length;
  if (unsourced > 0) {
    flags.push(`${unsourced} claim${unsourced === 1 ? '' : 's'} missing a source link.`);
  }
  return flags;
}
