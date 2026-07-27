import type { Metadata } from 'next';
import Link from 'next/link';
import { ProvenanceBadge } from '@/components/ui/badges';
import { PageHeader } from '@/components/ui/PageHeader';
import { Panel } from '@/components/ui/Panel';
import { EmptyState } from '@/components/ui/states';
import { countryName } from '@/lib/countries';
import { formatNodeType, isStale, PROVENANCE_DESCRIPTION } from '@/lib/format';
import { fetchAssetList } from '@/lib/supabase/queries/assets';
import { fetchOverviewData } from '@/lib/supabase/queries/overview';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Methodology & coverage',
};

export default async function MethodologyPage() {
  const [overviewRes, assetsRes] = await Promise.all([fetchOverviewData(), fetchAssetList()]);
  const overview = overviewRes.ok ? overviewRes.data : null;
  const assets = assetsRes.ok ? assetsRes.data : [];

  const byCountryType = new Map<string, Map<string, number>>();
  const typeSet = new Set<string>();
  for (const node of overview?.nodes ?? []) {
    typeSet.add(node.node_type);
    const inner = byCountryType.get(node.country_code) ?? new Map<string, number>();
    inner.set(node.node_type, (inner.get(node.node_type) ?? 0) + 1);
    byCountryType.set(node.country_code, inner);
  }
  const types = [...typeSet].sort();

  const provenanceCounts = (['reported', 'modelled', 'unverified'] as const).map((prov) => ({
    prov,
    count: (overview?.assertions ?? []).filter((a) => a.provenance === prov).length,
  }));
  const lowConfidence = (overview?.assertions ?? []).filter((a) => a.confidence_score < 65).length;
  const upstream = assets.filter((a) => a.node.node_type === 'mine' || a.node.node_type === 'development_project');
  const missingProduction = upstream.filter((a) => !a.metric_kinds.includes('production')).length;
  const missingCapacity = upstream.filter((a) => !a.metric_kinds.includes('capacity')).length;
  const stale = (overview?.nodes ?? []).filter((n) => isStale(n.last_reviewed_at)).length;

  return (
    <div className="page">
      <PageHeader
        kicker="Methodology & coverage"
        title="How to read this atlas"
        description="Scope, evidence rules, unit discipline and the current state of dataset coverage."
      />

      <div className="panel-grid">
        <div className="col-span-7">
          <Panel title="Methodology">
            <div className="prose">
              <h2 style={{ marginTop: 0 }}>Scope</h2>
              <p>
                The pilot covers the antimony supply chain outside China: mines, material development projects,
                concentrators, smelters, antimony metal and trioxide plants, important ports and land-border gateways,
                country-to-country trade flows for the three antimony HS codes, and material operational, policy and
                geopolitical events. Selected Chinese facilities may appear only where needed for context; comprehensive
                Chinese coverage is out of scope, as are buyer lists, private contract terms, vessel tracking,
                inventories, downstream manufacturers and other metals.
              </p>

              <h2>Provenance</h2>
              <p>Every claim carries one of three provenance classes:</p>
              <ul>
                <li>
                  <strong>Reported</strong> — {PROVENANCE_DESCRIPTION.reported}
                </li>
                <li>
                  <strong>Modelled</strong> — {PROVENANCE_DESCRIPTION.modelled}
                </li>
                <li>
                  <strong>Unverified</strong> — {PROVENANCE_DESCRIPTION.unverified}
                </li>
              </ul>
              <p>
                Provenance is not a quality grade: a reported figure can be outdated or self-serving. That is what the
                separate confidence score is for.
              </p>

              <h2>Confidence</h2>
              <p>
                Confidence is a weighted 0–100 score computed from source quality (35%), recency (20%), directness
                (20%), corroboration (15%) and extraction quality (10%). The interface bands it as High (≥ 85), Medium
                (65–84) and Low (&lt; 65); the exact score is always available in tooltips and exports.
              </p>

              <h2>Capacity is not production</h2>
              <p>
                Design capacity, nameplate capacity, projected production, actual production, resources and reserves are
                stored as separate metrics with their own units and periods. The interface never merges them, never
                converts between product forms without an explicit modelled conversion, and never adds prospective
                project output into operating supply.
              </p>
              <p>
                Operating versus prospective supply follows node status: <em>operating</em> counts as operating supply;{' '}
                <em>development</em> and <em>construction</em> count as prospective; care-and-maintenance, suspended,
                closed and unknown statuses are treated as inactive or uncertain and are excluded from both.
              </p>

              <h2>Units</h2>
              <p>
                Quantities keep their source units — ore tonnes, concentrate tonnes, contained antimony, pounds, tonnes
                per year or per day. The only silent conversion anywhere is kilograms to tonnes for customs gross
                weight, which is a pure mass-unit change and is always labelled “(gross)” with the exact kilogram figure
                retained. Missing values are labelled as not reported; they are never shown as zero.
              </p>

              <h2>Trade data</h2>
              <p>
                Trade flows are reporter-declared customs records for HS 261710 (ores and concentrates), HS 811010
                (unwrought antimony and powders) and HS 282580 (antimony oxides). Mirror discrepancies between reporters
                are disclosed rather than reconciled. Customs flows identify countries — they do not identify mines,
                buyers or facilities, and the atlas never implies otherwise. Implied unit values (US$/t) are derived
                figures, shown only when weight is material, and are not market prices.
              </p>

              <h2>Locations and routes</h2>
              <p>
                Coordinates carry a location-precision field; anything other than exact precision is disclosed on asset
                pages and drawn with an uncertainty ring on the map. Supply-chain connections are classified as
                reported, modelled or unverified; map lines are schematic straight lines between nodes, not physical
                routes. An inferred connection is never presented as a known commercial flow.
              </p>

              <h2>Update cadence</h2>
              <p>
                Research is manual and source-first: each source is registered before extraction, one assertion per
                material claim, conflicts are kept visible, and every node carries a last-reviewed date. Records older
                than twelve months are flagged as stale. There are no automated daily updates in the pilot.
              </p>
            </div>
          </Panel>
        </div>

        <div className="col-span-5">
          <Panel title="Coverage — nodes by country and type" flush>
            {byCountryType.size === 0 ? (
              <EmptyState title="No nodes loaded yet" />
            ) : (
              <div className="table-scroll">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Country</th>
                      {types.map((type) => (
                        <th key={type} className="num">
                          {formatNodeType(type)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[...byCountryType.entries()]
                      .sort((a, b) => countryName(a[0]).localeCompare(countryName(b[0])))
                      .map(([code, counts]) => (
                        <tr key={code}>
                          <td className="primary-cell">
                            <Link href={`/countries/${code}`}>{countryName(code)}</Link>
                          </td>
                          {types.map((type) => (
                            <td key={type} className="num">
                              {counts.get(type) ?? '—'}
                            </td>
                          ))}
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>

          <Panel title="Coverage — evidence">
            <dl className="kv">
              {provenanceCounts.map(({ prov, count }) => (
                <CoverageRow key={prov} label={<ProvenanceBadge provenance={prov} withHint={false} />} value={count} />
              ))}
              <CoverageRow label="Low-confidence assertions (< 65)" value={lowConfidence} />
              <CoverageRow
                label="Upstream assets missing a production metric"
                value={upstream.length === 0 ? '—' : `${missingProduction} of ${upstream.length}`}
              />
              <CoverageRow
                label="Upstream assets missing a capacity metric"
                value={upstream.length === 0 ? '—' : `${missingCapacity} of ${upstream.length}`}
              />
              <CoverageRow
                label="Nodes stale (> 12 months) or unreviewed"
                value={(overview?.nodes.length ?? 0) === 0 ? '—' : `${stale} of ${overview?.nodes.length}`}
              />
              <CoverageRow label="Sources registered" value={overview?.sourceCount ?? '—'} />
              <CoverageRow label="Trade flows loaded" value={overview?.tradeFlowCount ?? '—'} />
            </dl>
            <p className="note" style={{ marginTop: 10 }}>
              Coverage targets for the pilot: roughly 35–60 mines and development projects, 20–40 processing facilities
              and 20–30 logistics gateways, all source-cited.
            </p>
          </Panel>
        </div>
      </div>
    </div>
  );
}

function CoverageRow({ label, value }: { label: React.ReactNode; value: React.ReactNode }) {
  return (
    <>
      <dt>{label}</dt>
      <dd className="num" style={{ textAlign: 'left' }}>
        {value}
      </dd>
    </>
  );
}
