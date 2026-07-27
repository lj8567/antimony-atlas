import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { collectAssetSources } from '@/components/asset-detail/collect-sources';
import { SourcesDrawerButton } from '@/components/asset-detail/SourcesDrawerButton';
import { ConfidenceIndicator, EvidenceSummary, ProvenanceBadge, SeverityIndicator, StatusLabel } from '@/components/ui/badges';
import { Hint } from '@/components/ui/Hint';
import { PageHeader } from '@/components/ui/PageHeader';
import { Panel } from '@/components/ui/Panel';
import { SourceLink } from '@/components/ui/SourceLink';
import { EmptyState, QueryFailure, WarningsNotice } from '@/components/ui/states';
import { countryName } from '@/lib/countries';
import {
  formatDate,
  formatEventType,
  formatFieldName,
  formatLocationPrecision,
  formatMetricName,
  formatNodeType,
  formatPercent,
  formatPeriod,
  formatQuantity,
  isApproximateLocation,
  isStale,
  normalizeConfidence,
} from '@/lib/format';
import { fetchAssetDetail, type AssetDetail } from '@/lib/supabase/queries/asset-detail';
import type { AssertionDetail } from '@/lib/supabase/types';

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
  const { node, summary } = detail;
  const sources = collectAssetSources(detail);
  const profileAssertions = detail.assertions.filter((a) => a.field_name !== 'location_precision');
  const quality = buildQualityFlags(detail);
  const hasCoordinates = node.latitude !== null && node.longitude !== null;

  return (
    <div className="page">
      <PageHeader
        kicker={`${formatNodeType(node.node_type)} · ${countryName(node.country_code)}${node.region ? ` · ${node.region}` : ''}`}
        title={node.name}
        description={
          node.aliases && node.aliases.length > 0
            ? `Also known as ${node.aliases.join(', ')}.${node.notes ? ` ${node.notes}` : ''}`
            : (node.notes ?? undefined)
        }
        actions={
          <>
            <SourcesDrawerButton entries={sources} assetName={node.name} />
            {hasCoordinates && (
              <Link className="btn" href={`/map?focus=${node.node_id}`}>
                View on map
              </Link>
            )}
          </>
        }
      />
      <WarningsNotice warnings={result.warnings} />

      <div className="kpi-grid">
        <div className="kpi">
          <p className="kpi-label">Status</p>
          <p className="kpi-value" style={{ fontSize: 15 }}>
            <StatusLabel status={node.status} />
          </p>
          <p className="kpi-foot">canonical status from the nodes register</p>
        </div>
        <div className="kpi">
          <p className="kpi-label">Owner / operator</p>
          <p className="kpi-value" style={{ fontSize: 15 }}>
            {detail.owner?.legal_name ?? detail.operator?.legal_name ?? 'Not reported'}
          </p>
          <p className="kpi-foot">
            {detail.operator && detail.owner && detail.operator.entity_id !== detail.owner.entity_id
              ? `operated by ${detail.operator.legal_name}`
              : (detail.owner?.website && <SourceLink url={detail.owner.website} title="Website" />) || ' '}
          </p>
        </div>
        <div className="kpi">
          <p className="kpi-label">Evidence on file</p>
          <p className="kpi-value" style={{ fontSize: 15 }}>
            <EvidenceSummary counts={summary.evidence} sourceCount={summary.source_count} />
          </p>
          <p className="kpi-foot">
            {summary.assertion_count} assertions · {summary.observation_count} observations
          </p>
        </div>
        <div className="kpi">
          <p className="kpi-label">Location</p>
          <p className="kpi-value mono" style={{ fontSize: 13.5 }}>
            {hasCoordinates ? `${node.latitude!.toFixed(3)}, ${node.longitude!.toFixed(3)}` : 'No coordinates'}
          </p>
          <p className="kpi-foot">
            {isApproximateLocation(summary.location_precision) ? (
              <Hint text="Coordinates are not surveyed positions. Precision reflects the best public disclosure for this site; where no precision claim exists the location is treated as approximate.">
                <span>{formatLocationPrecision(summary.location_precision)}</span>
              </Hint>
            ) : (
              formatLocationPrecision(summary.location_precision)
            )}
          </p>
        </div>
        <div className="kpi">
          <p className="kpi-label">Record updated</p>
          <p className="kpi-value" style={{ fontSize: 15 }}>
            {formatDate(node.updated_at, 'Not recorded')}
          </p>
          <p className="kpi-foot">first recorded {formatDate(node.created_at)}</p>
        </div>
      </div>

      <div className="panel-grid">
        <div className="col-span-8">
          <Panel
            title="Key metrics"
            note="Original units and periods; production, capacity, resources and reserves are never merged"
            flush
          >
            {detail.observations.length === 0 ? (
              <EmptyState
                title="No quantitative observations recorded"
                detail="Capacity, production and resource figures appear here with unit, period and provenance."
              />
            ) : (
              <div className="table-scroll">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Metric</th>
                      <th className="num">Value</th>
                      <th>Period</th>
                      <th>Provenance</th>
                      <th>Confidence</th>
                      <th>Source</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.observations.map((obs, index) => (
                      <tr key={obs.observation_id ?? index}>
                        <td className="primary-cell">
                          {obs.notes ? (
                            <Hint text={obs.notes}>
                              <span>{formatMetricName(obs.metric_name)}</span>
                            </Hint>
                          ) : (
                            formatMetricName(obs.metric_name)
                          )}
                          {obs.product_form && <span className="cell-sub">{obs.product_form.name}</span>}
                        </td>
                        <td className="num">
                          {obs.value_numeric !== null ? formatQuantity(obs.value_numeric, obs.unit) : 'Not reported'}
                        </td>
                        <td>{formatPeriod(obs.period_start, obs.period_end)}</td>
                        <td>
                          <ProvenanceBadge provenance={obs.provenance} />
                        </td>
                        <td>
                          <ConfidenceIndicator score={normalizeConfidence(obs.confidence)} />
                        </td>
                        <td>
                          {obs.source ? (
                            <SourceLink url={obs.source.url} title={obs.source.publisher ?? obs.source.title} />
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

          <Panel title="Asset profile" note="Sourced assertions; conflicts are shown, not reconciled" flush>
            {profileAssertions.length === 0 ? (
              <EmptyState title="No profile assertions recorded" />
            ) : (
              <div className="table-scroll">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Field</th>
                      <th>Claim</th>
                      <th>Effective</th>
                      <th>Provenance</th>
                      <th>Confidence</th>
                      <th>Source</th>
                    </tr>
                  </thead>
                  <tbody>
                    {groupAssertions(profileAssertions).map(({ fieldName, rows }) =>
                      rows.map((assertion, index) => (
                        <tr key={`${fieldName}-${index}`}>
                          <td className="primary-cell">
                            {index === 0 ? formatFieldName(fieldName) : ''}
                            {rows.length > 1 && index === 0 && (
                              <span className="cell-sub">{rows.length} claims on file</span>
                            )}
                          </td>
                          <td style={{ maxWidth: 420, whiteSpace: 'normal' }}>{assertion.value_text ?? '—'}</td>
                          <td>{formatDate(assertion.effective_date, '—')}</td>
                          <td>
                            <ProvenanceBadge provenance={assertion.provenance} />
                          </td>
                          <td>
                            <ConfidenceIndicator score={normalizeConfidence(assertion.confidence)} />
                          </td>
                          <td>
                            {assertion.source ? (
                              <SourceLink
                                url={assertion.source.url}
                                title={assertion.source.publisher ?? assertion.source.title}
                              />
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

          <Panel title="Ownership" note="History from node_ownership; the header shows the current registered owner" flush>
            {detail.ownership.length === 0 ? (
              <EmptyState title="No ownership records" detail="Ownership stakes appear here with roles, effective dates and sources." />
            ) : (
              <div className="table-scroll">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Entity</th>
                      <th>Role</th>
                      <th className="num">Stake</th>
                      <th>Effective from</th>
                      <th>Source</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.ownership.map((own, index) => (
                      <tr key={own.node_ownership_id ?? index}>
                        <td className="primary-cell">
                          {own.entity?.legal_name ?? 'Unknown entity'}
                          {own.entity?.entity_type && <span className="cell-sub">{formatNodeType(own.entity.entity_type)}</span>}
                        </td>
                        <td>{formatNodeType(own.ownership_role)}</td>
                        <td className="num">{formatPercent(own.ownership_percentage)}</td>
                        <td>{formatDate(own.effective_from, 'Not dated')}</td>
                        <td>
                          {own.source ? (
                            <SourceLink url={own.source.url} title={own.source.publisher ?? own.source.title} />
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
                detail="Links to processing facilities and gateways appear here once evidenced. Absence of a link is not evidence of absence."
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
                                {other.name}
                              </Link>
                            ) : (
                              'Unknown node'
                            )}
                            {other && (
                              <span className="cell-sub">
                                {formatNodeType(other.node_type)} · {countryName(other.country_code)}
                              </span>
                            )}
                          </td>
                          <td>{formatNodeType(edge.edge_type)}</td>
                          <td>{edge.product_form?.name ?? <span className="note">Not specified</span>}</td>
                          <td>
                            <ProvenanceBadge provenance={edge.provenance} />
                          </td>
                          <td>
                            <ConfidenceIndicator score={normalizeConfidence(edge.confidence)} />
                          </td>
                          <td>
                            {edge.source ? (
                              <SourceLink url={edge.source.url} title={edge.source.publisher ?? edge.source.title} />
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
                    <strong style={{ fontSize: 12.5 }}>{event.title}</strong>
                    <div className="note" style={{ margin: '2px 0 4px' }}>
                      {formatEventType(event.event_type)} · {formatDate(event.event_date)}
                    </div>
                    {event.summary && (
                      <p style={{ margin: '0 0 5px', fontSize: 12, color: 'var(--ink-2)' }}>{event.summary}</p>
                    )}
                    <div className="inline-list">
                      <SeverityIndicator severity={event.severity} />
                      {event.source && <SourceLink url={event.source.url} title={event.source.publisher ?? event.source.title} />}
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
                {node.country_code ? (
                  <Link href={`/countries/${node.country_code}`}>{countryName(node.country_code)}</Link>
                ) : (
                  'Not reported'
                )}
              </dd>
              <dt>Region</dt>
              <dd>{node.region ?? 'Not reported'}</dd>
              <dt>Coordinates</dt>
              <dd className="mono">
                {hasCoordinates ? `${node.latitude!.toFixed(4)}, ${node.longitude!.toFixed(4)}` : 'Not recorded'}
              </dd>
              <dt>Location precision</dt>
              <dd>{formatLocationPrecision(summary.location_precision)}</dd>
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

function groupAssertions(assertions: AssertionDetail[]): Array<{ fieldName: string; rows: AssertionDetail[] }> {
  const byField = new Map<string, AssertionDetail[]>();
  for (const assertion of assertions) {
    const list = byField.get(assertion.field_name) ?? [];
    list.push(assertion);
    byField.set(assertion.field_name, list);
  }
  // rows within a field are already newest-effective-date-first from the index
  return [...byField.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([fieldName, rows]) => ({ fieldName, rows }));
}

function buildQualityFlags(detail: AssetDetail): string[] {
  const flags: string[] = [];
  const { node, summary } = detail;

  if (node.latitude === null || node.longitude === null) {
    flags.push('No coordinates recorded — this asset cannot be plotted on the map.');
  } else if (isApproximateLocation(summary.location_precision)) {
    flags.push(
      summary.location_precision
        ? `Coordinates are ${formatLocationPrecision(summary.location_precision).toLowerCase()} — do not use for site-level analysis.`
        : 'No location-precision claim on file — coordinates are treated as approximate.',
    );
  }
  const modelledCount = detail.observations.filter((obs) => obs.provenance === 'modelled').length;
  if (modelledCount > 0) {
    flags.push(
      `${modelledCount} observation${modelledCount === 1 ? ' is a' : 's are'} modelled conversion${modelledCount === 1 ? '' : 's'} derived from reported inputs.`,
    );
  }
  const lowConfidence = [...detail.assertions, ...detail.observations].filter((claim) => {
    const normalized = normalizeConfidence(claim.confidence);
    return normalized !== null && normalized < 65;
  }).length;
  if (lowConfidence > 0) {
    flags.push(`${lowConfidence} claim${lowConfidence === 1 ? '' : 's'} carry low confidence (< 65/100).`);
  }
  const multiClaimFields = groupAssertions(detail.assertions).filter(({ rows }) => rows.length > 1);
  if (multiClaimFields.length > 0) {
    flags.push(
      `Multiple claims on file for: ${multiClaimFields.map(({ fieldName }) => formatFieldName(fieldName)).join(', ')} — conflicts are shown, not reconciled.`,
    );
  }
  if (isStale(node.updated_at)) {
    flags.push(`Record last updated ${formatDate(node.updated_at)} — more than 12 months ago.`);
  }
  if (detail.observations.length === 0) {
    flags.push('No quantitative observations recorded yet.');
  }
  const unsourced = [...detail.assertions, ...detail.observations].filter((claim) => !claim.source_id).length;
  if (unsourced > 0) {
    flags.push(`${unsourced} claim${unsourced === 1 ? '' : 's'} missing a source link.`);
  }
  return flags;
}
