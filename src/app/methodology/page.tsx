import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHeader } from '@/components/ui/PageHeader';
import { Panel } from '@/components/ui/Panel';
import { EmptyState, QueryFailure, WarningsNotice } from '@/components/ui/states';
import { countryName } from '@/lib/countries';
import { formatNodeType, isStale, normalizeConfidence, PROVENANCE_DESCRIPTION } from '@/lib/format';
import { buildAssetList } from '@/lib/supabase/queries/assemble';
import { fetchAtlasData } from '@/lib/supabase/queries/core';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Methodology & coverage',
};

export default async function MethodologyPage() {
  const result = await fetchAtlasData();

  if (!result.ok) {
    return (
      <div className="page">
        <Header />
        <QueryFailure result={result} />
      </div>
    );
  }

  const data = result.data;
  const assets = buildAssetList(data);

  const byCountryType = new Map<string, Map<string, number>>();
  const typeSet = new Set<string>();
  for (const node of data.nodes) {
    if (!node.country_code) continue;
    typeSet.add(node.node_type);
    const inner = byCountryType.get(node.country_code) ?? new Map<string, number>();
    inner.set(node.node_type, (inner.get(node.node_type) ?? 0) + 1);
    byCountryType.set(node.country_code, inner);
  }
  const types = [...typeSet].sort();

  const claims = [...data.assertions, ...data.observations];
  const provenanceCounts = (['reported', 'modelled', 'unverified'] as const).map((prov) => ({
    prov,
    count: claims.filter((claim) => claim.provenance === prov).length,
  }));
  const lowConfidence = claims.filter((claim) => {
    const normalized = normalizeConfidence(claim.confidence);
    return normalized !== null && normalized < 65;
  }).length;
  const unsourced = claims.filter((claim) => !claim.source_id).length;
  const upstream = assets.filter(
    (item) => item.node.node_type === 'mine' || item.node.node_type === 'mine_and_concentrator' || item.node.node_type === 'development_project',
  );
  const missingProduction = upstream.filter((item) => !item.metric_kinds.includes('production')).length;
  const missingCapacity = upstream.filter((item) => !item.metric_kinds.includes('capacity')).length;
  const stale = data.nodes.filter((node) => isStale(node.updated_at)).length;

  return (
    <div className="page">
      <Header />
      <WarningsNotice warnings={result.warnings} />

      <div className="panel-grid">
        <div className="col-span-7">
          <Panel title="Methodology">
            <div className="prose">
              <h2 style={{ marginTop: 0 }}>Scope</h2>
              <p>
                The pilot covers the antimony supply chain outside China: mines, material development projects,
                concentrators, smelters and processing plants, important ports and land-border gateways,
                country-to-country trade flows for the three antimony HS codes, and material operational, policy and
                geopolitical events. Selected Chinese facilities may appear only where needed for context;
                comprehensive Chinese coverage is out of scope, as are buyer lists, private contract terms, vessel
                tracking, inventories, downstream manufacturers and other metals.
              </p>

              <h2>How facts are stored</h2>
              <p>
                The database is relational, not a flat asset table. Qualitative facts (mining method, products, access
                route, status commentary) are individual sourced <em>assertions</em> against a node; numeric facts are{' '}
                <em>observations</em> with a metric name, value, unit and period; ownership history, events and sources
                are separate registers. An asset page assembles all of these; a value you do not see is a value that
                has not yet been researched — never a zero.
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
                Confidence is an analyst-recorded numeric score per claim, normalised to a 0–100 scale for display
                (stored fractions are read as percentages). The interface bands it as High (≥ 85), Medium (65–84) and
                Low (&lt; 65); exact scores are visible in tooltips and exports. List views show the <em>highest</em>{' '}
                claim confidence on file for an asset, clearly labelled as such — per-claim scores are on the asset
                page.
              </p>

              <h2>Capacity is not production</h2>
              <p>
                Actual production, plant and nameplate capacity, announced future capacity, feed throughput, mineral
                resources, ore reserves and grades are stored as separate named metrics with their own units and
                periods. The interface never merges them, never converts between product forms without an explicit
                modelled conversion, and never adds prospective project output into operating supply. Where the same
                physical quantity is stored twice (reported pounds and a modelled tonnes conversion), both rows are
                shown with their provenance and are never summed.
              </p>
              <p>
                Operating versus prospective supply follows node status: <em>operating</em> counts as operating supply;{' '}
                <em>development</em> and <em>construction</em> count as prospective; care-and-maintenance, suspended,
                closed and unknown statuses are treated as inactive or uncertain and are excluded from both. The
                canonical status is always the nodes register — never inferred from events or observations.
              </p>

              <h2>Units</h2>
              <p>
                Quantities keep their stored units verbatim — tonnes Sb contained, tonnes ore per year, pounds,
                ounces, furnaces, US dollars. The only silent conversion anywhere is kilograms to tonnes for customs
                gross weight, which is a pure mass-unit change, always labelled “(gross)”. Missing values are labelled
                as not reported; they are never shown as zero.
              </p>

              <h2>Trade data</h2>
              <p>
                Trade flows are reporter-declared customs records for HS 261710 (ores and concentrates), HS 811010
                (unwrought antimony and powders) and HS 282580 (antimony oxides). Mirror discrepancies between
                reporters are disclosed rather than reconciled. Customs flows identify countries — they never identify
                mines, buyers or facilities. Implied unit values (US$/t) are derived figures, shown only when weight
                is material, and are not market prices.
              </p>

              <h2>Locations and routes</h2>
              <p>
                Coordinates may be approximate: where a location-precision claim exists it is shown, and where none
                exists the location is conservatively treated as approximate and drawn with an uncertainty ring on the
                map. Supply-chain connections are classified as reported, modelled or unverified; map lines are
                schematic straight lines between nodes, not physical routes. An inferred connection is never presented
                as a known commercial flow.
              </p>

              <h2>Update cadence</h2>
              <p>
                Research is manual and source-first: each source is registered before extraction, one claim per
                material fact, conflicts are kept visible, and every node carries created/updated timestamps. Records
                not updated for twelve months are flagged as stale. There are no automated daily updates in the pilot.
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
                <CoverageRow key={prov} label={`${prov[0].toUpperCase()}${prov.slice(1)} claims`} value={count} />
              ))}
              <CoverageRow label="Low-confidence claims (< 65)" value={lowConfidence} />
              <CoverageRow label="Claims without a source link" value={unsourced} />
              <CoverageRow
                label="Upstream assets missing a production metric"
                value={upstream.length === 0 ? '—' : `${missingProduction} of ${upstream.length}`}
              />
              <CoverageRow
                label="Upstream assets missing a capacity metric"
                value={upstream.length === 0 ? '—' : `${missingCapacity} of ${upstream.length}`}
              />
              <CoverageRow
                label="Nodes stale (> 12 months)"
                value={data.nodes.length === 0 ? '—' : `${stale} of ${data.nodes.length}`}
              />
              <CoverageRow label="Sources registered" value={data.sources.length} />
              <CoverageRow
                label="Trade flows loaded"
                value={!data.tradeTableExists ? 'Table not yet created' : data.tradeFlows.length}
              />
            </dl>
            <p className="note" style={{ marginTop: 10 }}>
              Coverage targets for the pilot: roughly 35–60 mines and development projects, 20–40 processing facilities
              and 20–30 logistics gateways, all source-cited. Connection status can be checked any time on the{' '}
              <Link href="/status">data status page</Link>.
            </p>
          </Panel>
        </div>
      </div>
    </div>
  );
}

function Header() {
  return (
    <PageHeader
      kicker="Methodology & coverage"
      title="How to read this atlas"
      description="Scope, evidence rules, unit discipline and the current state of dataset coverage."
    />
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
