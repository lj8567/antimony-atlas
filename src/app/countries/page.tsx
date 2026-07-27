import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHeader } from '@/components/ui/PageHeader';
import { Panel } from '@/components/ui/Panel';
import { EmptyState, QueryFailure, WarningsNotice } from '@/components/ui/states';
import { countryName } from '@/lib/countries';
import { GATEWAY_NODE_TYPES, PROCESSING_NODE_TYPES, supplyCategory } from '@/lib/format';
import { fetchCountrySummaryData } from '@/lib/supabase/queries/countries';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Countries',
};

interface CountryRow {
  code: string;
  upstream: number;
  processing: number;
  gateways: number;
  operating: number;
  prospective: number;
  events: number;
  inTradeData: boolean;
}

export default async function CountriesPage() {
  const result = await fetchCountrySummaryData();

  if (!result.ok) {
    return (
      <div className="page">
        <Header />
        <QueryFailure result={result} />
      </div>
    );
  }

  const { assets, events, tradeCountries, unallocatedNodes } = result.data;
  const rows = new Map<string, CountryRow>();
  const ensure = (code: string): CountryRow => {
    const existing = rows.get(code);
    if (existing) return existing;
    const created: CountryRow = {
      code,
      upstream: 0,
      processing: 0,
      gateways: 0,
      operating: 0,
      prospective: 0,
      events: 0,
      inTradeData: false,
    };
    rows.set(code, created);
    return created;
  };

  for (const item of assets) {
    if (!item.node.country_code) continue;
    const row = ensure(item.node.country_code);
    if (PROCESSING_NODE_TYPES.has(item.node.node_type)) row.processing += 1;
    else if (GATEWAY_NODE_TYPES.has(item.node.node_type)) row.gateways += 1;
    else row.upstream += 1;
    const category = supplyCategory(item.node.status);
    if (category === 'operating') row.operating += 1;
    if (category === 'prospective') row.prospective += 1;
  }
  for (const event of events) {
    if (event.node?.country_code) ensure(event.node.country_code).events += 1;
  }
  for (const flow of tradeCountries) {
    for (const code of [flow.exporter_code, flow.importer_code]) {
      if (rows.has(code)) rows.get(code)!.inTradeData = true;
    }
  }

  const sorted = [...rows.values()].sort(
    (a, b) =>
      b.upstream + b.processing + b.gateways - (a.upstream + a.processing + a.gateways) ||
      countryName(a.code).localeCompare(countryName(b.code)),
  );

  return (
    <div className="page">
      <Header />
      <WarningsNotice warnings={result.warnings} />
      <Panel flush>
        {sorted.length === 0 ? (
          <EmptyState
            title="No countries represented yet"
            detail="Countries appear here as assets, events and trade flows are loaded."
          />
        ) : (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Country</th>
                  <th className="num">Mines & projects</th>
                  <th className="num">Processing</th>
                  <th className="num">Gateways</th>
                  <th className="num">Operating</th>
                  <th className="num">Prospective</th>
                  <th className="num">Events</th>
                  <th>Trade data</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((row) => (
                  <tr key={row.code}>
                    <td className="primary-cell">
                      <Link href={`/countries/${row.code}`} className="row-link">
                        {countryName(row.code)}
                      </Link>
                      <span className="cell-sub mono">{row.code}</span>
                    </td>
                    <td className="num">{row.upstream}</td>
                    <td className="num">{row.processing}</td>
                    <td className="num">{row.gateways}</td>
                    <td className="num">{row.operating}</td>
                    <td className="num">{row.prospective}</td>
                    <td className="num">{row.events}</td>
                    <td>{row.inTradeData ? 'Present' : <span className="note">Not yet loaded</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
      <p className="note">
        Operating and prospective counts refer to node status categories, not output. Production and capacity always
        carry units, periods and provenance on the asset pages.
        {unallocatedNodes > 0 &&
          ` ${unallocatedNodes} node${unallocatedNodes === 1 ? ' has' : 's have'} no country code recorded and are not shown here.`}
      </p>
    </div>
  );
}

function Header() {
  return (
    <PageHeader
      kicker="Country intelligence"
      title="Countries"
      description="Where mapped antimony assets, processing capacity, gateways and trade participation sit, country by country."
    />
  );
}
