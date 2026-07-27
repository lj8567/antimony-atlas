'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import { ConfidenceIndicator, ProvenanceBadge } from '@/components/ui/badges';
import { NumberField, SelectField, SortHeader } from '@/components/ui/controls';
import { ExportCsvButton } from '@/components/ui/ExportCsvButton';
import { Hint } from '@/components/ui/Hint';
import { SourceLink } from '@/components/ui/SourceLink';
import { EmptyState } from '@/components/ui/states';
import { countryName } from '@/lib/countries';
import type { CsvColumn } from '@/lib/csv';
import {
  filterTradeFlows,
  parseTradeFilters,
  serializeTradeFilters,
  sortTradeFlows,
  toQueryString,
  type TradeFilters,
  type TradeSortKey,
} from '@/lib/filters';
import {
  formatGrossWeightKg,
  formatNumber,
  formatPeriod,
  formatUsd,
  impliedUnitValueUsdPerTonne,
  normalizeConfidence,
  PROVENANCE_LABEL,
} from '@/lib/format';
import type { ProductFormRow, TradeFlowDetail } from '@/lib/supabase/types';

const PAGE_SIZE = 50;

const CSV_COLUMNS: CsvColumn<TradeFlowDetail>[] = [
  { label: 'Period start', value: (flow) => flow.period_start },
  { label: 'Period end', value: (flow) => flow.period_end },
  { label: 'Exporter code', value: (flow) => flow.exporter_code },
  { label: 'Exporter', value: (flow) => countryName(flow.exporter_code) },
  { label: 'Importer code', value: (flow) => flow.importer_code },
  { label: 'Importer', value: (flow) => countryName(flow.importer_code) },
  { label: 'Reporter code', value: (flow) => flow.reporter_code },
  { label: 'Mirror status', value: (flow) => flow.mirror_status },
  { label: 'Product form', value: (flow) => flow.product_form?.name ?? '' },
  { label: 'HS code', value: (flow) => flow.product_form?.hs_code ?? '' },
  { label: 'Gross weight (kg)', value: (flow) => flow.gross_weight_kg },
  { label: 'Trade value (USD)', value: (flow) => flow.trade_value_usd },
  {
    label: 'Implied unit value (USD/t gross, derived)',
    value: (flow) => {
      const derived = impliedUnitValueUsdPerTonne(flow.trade_value_usd, flow.gross_weight_kg);
      return derived === null ? '' : Math.round(derived);
    },
  },
  { label: 'Provenance', value: (flow) => PROVENANCE_LABEL[flow.provenance] },
  { label: 'Confidence (0-100)', value: (flow) => normalizeConfidence(flow.confidence) },
  { label: 'Source', value: (flow) => flow.source?.title ?? '' },
  { label: 'Source URL', value: (flow) => flow.source?.url ?? '' },
];

export function TradeExplorer({
  flows,
  productForms,
}: {
  flows: TradeFlowDetail[];
  productForms: ProductFormRow[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [page, setPage] = useState(0);

  const filters = useMemo(() => parseTradeFilters(new URLSearchParams(searchParams.toString())), [searchParams]);

  const apply = (patch: Partial<TradeFilters>) => {
    setPage(0);
    const next = { ...filters, ...patch };
    router.replace(`${pathname}${toQueryString(serializeTradeFilters(next))}`, { scroll: false });
  };

  const toggleSort = (key: TradeSortKey) => {
    if (filters.sort === key) apply({ dir: filters.dir === 'asc' ? 'desc' : 'asc' });
    else apply({ sort: key, dir: 'desc' });
  };

  const options = useMemo(() => {
    const codes = (extract: (flow: TradeFlowDetail) => string | null) =>
      [...new Set(flows.map(extract).filter((code): code is string => Boolean(code)))]
        .sort((a, b) => countryName(a).localeCompare(countryName(b)))
        .map((code) => ({ value: code, label: countryName(code) }));
    return {
      forms: productForms.map((form) => ({
        value: form.product_form_id,
        label: form.hs_code ? `${form.name} (HS ${form.hs_code})` : form.name,
      })),
      exporters: codes((flow) => flow.exporter_code),
      importers: codes((flow) => flow.importer_code),
      reporters: codes((flow) => flow.reporter_code),
      years: [...new Set(flows.map((flow) => flow.period_start.slice(0, 4)))]
        .sort()
        .reverse()
        .map((year) => ({ value: year, label: year })),
    };
  }, [flows, productForms]);

  const filtered = useMemo(
    () => sortTradeFlows(filterTradeFlows(flows, filters), filters.sort, filters.dir),
    [flows, filters],
  );
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount - 1);
  const visible = filtered.slice(currentPage * PAGE_SIZE, currentPage * PAGE_SIZE + PAGE_SIZE);

  const partnerRanking = useMemo(() => rankPartners(filtered), [filtered]);
  const hasFilters = Object.values(serializeTradeFilters(filters)).some(Boolean);

  return (
    <>
      {partnerRanking.length > 0 && (
        <section className="panel">
          <header className="panel-head">
            <h2 className="panel-title">Top corridors by declared value</h2>
            <span className="panel-note">Within the current filter · US$, reporter-declared customs value</span>
          </header>
          <div className="panel-body">
            {partnerRanking.map((row) => (
              <div className="bar-row" key={row.key}>
                <span>
                  {countryName(row.exporter)} → {countryName(row.importer)}
                </span>
                <div className="bar-track">
                  <div className="bar-fill" style={{ width: `${row.widthPct * 100}%` }} />
                </div>
                <span className="num">
                  {formatUsd(row.valueUsd)} <span className="note">({formatNumber(row.share * 100)}%)</span>
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="panel">
        <div className="filter-bar">
          <SelectField label="Product / HS" value={filters.form} options={options.forms} onChange={(form) => apply({ form })} />
          <SelectField label="Exporter" value={filters.exporter} options={options.exporters} onChange={(exporter) => apply({ exporter })} />
          <SelectField label="Importer" value={filters.importer} options={options.importers} onChange={(importer) => apply({ importer })} />
          <SelectField label="Reporter" value={filters.reporter} options={options.reporters} onChange={(reporter) => apply({ reporter })} />
          <SelectField label="Year" value={filters.year} options={options.years} onChange={(year) => apply({ year })} />
          <SelectField
            label="Provenance"
            value={filters.provenance}
            options={[
              { value: 'reported', label: 'Reported' },
              { value: 'modelled', label: 'Modelled' },
              { value: 'unverified', label: 'Unverified' },
            ]}
            onChange={(provenance) => apply({ provenance })}
          />
          <NumberField
            label="Min value US$"
            value={filters.minValueUsd}
            placeholder="e.g. 100000"
            onChange={(minValueUsd) => apply({ minValueUsd })}
          />
          {hasFilters && (
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                setPage(0);
                router.replace(pathname, { scroll: false });
              }}
            >
              Clear all
            </button>
          )}
          <div style={{ marginLeft: 'auto' }}>
            <ExportCsvButton
              filename="antimony-atlas-trade-flows.csv"
              title="Trade flows (filtered)"
              columns={CSV_COLUMNS}
              rows={filtered}
              filters={Object.fromEntries(Object.entries(serializeTradeFilters(filters)).filter(([, v]) => v))}
            />
          </div>
        </div>

        {visible.length === 0 ? (
          <EmptyState
            title={flows.length === 0 ? 'No trade flows loaded yet' : 'No flows match the current filters'}
            detail={
              flows.length === 0
                ? 'Country-to-country customs data for HS 261710, 811010 and 282580 appears here once imported.'
                : 'Relax or clear filters to see more flows.'
            }
          />
        ) : (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>
                    <SortHeader label="Period" active={filters.sort === 'period'} direction={filters.dir} onSort={() => toggleSort('period')} />
                  </th>
                  <th>
                    <SortHeader label="Exporter" active={filters.sort === 'exporter'} direction={filters.dir} onSort={() => toggleSort('exporter')} />
                  </th>
                  <th>
                    <SortHeader label="Importer" active={filters.sort === 'importer'} direction={filters.dir} onSort={() => toggleSort('importer')} />
                  </th>
                  <th>Product</th>
                  <th className="num">
                    <SortHeader label="Weight" active={filters.sort === 'weight'} direction={filters.dir} onSort={() => toggleSort('weight')} />
                  </th>
                  <th className="num">
                    <SortHeader label="Value" active={filters.sort === 'value'} direction={filters.dir} onSort={() => toggleSort('value')} />
                  </th>
                  <th className="num">
                    <Hint text="Derived: declared value ÷ gross weight. Indicative only; not a market price. Blank when weight is missing or too small.">
                      <span>US$/t*</span>
                    </Hint>
                  </th>
                  <th>Reporter</th>
                  <th>Provenance</th>
                  <th>Confidence</th>
                  <th>Source</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((flow) => {
                  const implied = impliedUnitValueUsdPerTonne(flow.trade_value_usd, flow.gross_weight_kg);
                  return (
                    <tr key={flow.trade_flow_id}>
                      <td>{formatPeriod(flow.period_start, flow.period_end)}</td>
                      <td>{countryName(flow.exporter_code)}</td>
                      <td>{countryName(flow.importer_code)}</td>
                      <td>
                        {flow.product_form?.name ?? 'Unknown form'}
                        {flow.product_form?.hs_code && <span className="cell-sub mono">HS {flow.product_form.hs_code}</span>}
                      </td>
                      <td className="num">
                        {flow.gross_weight_kg !== null ? (
                          <Hint text={`${formatNumber(flow.gross_weight_kg)} kg gross weight as declared`}>
                            <span>{formatGrossWeightKg(flow.gross_weight_kg)}</span>
                          </Hint>
                        ) : (
                          <span className="note">Not reported</span>
                        )}
                      </td>
                      <td className="num">{formatUsd(flow.trade_value_usd)}</td>
                      <td className="num">{implied === null ? <span className="note">—</span> : formatUsd(Math.round(implied))}</td>
                      <td>
                        {flow.reporter_code ? countryName(flow.reporter_code) : <span className="note">Not stated</span>}
                        {flow.mirror_status && <span className="cell-sub">{flow.mirror_status}</span>}
                      </td>
                      <td>
                        <ProvenanceBadge provenance={flow.provenance} />
                      </td>
                      <td>
                        <ConfidenceIndicator score={normalizeConfidence(flow.confidence)} />
                      </td>
                      <td>
                        {flow.source ? (
                          <SourceLink url={flow.source.url} title={flow.source.publisher ?? flow.source.title} />
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

        <div className="table-foot">
          <span>
            {filtered.length} of {flows.length} flows
          </span>
          {pageCount > 1 && (
            <span className="inline-list">
              <button type="button" className="btn btn-ghost" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>
                ← Previous
              </button>
              <span>
                Page {currentPage + 1} of {pageCount}
              </span>
              <button
                type="button"
                className="btn btn-ghost"
                disabled={currentPage >= pageCount - 1}
                onClick={() => setPage(currentPage + 1)}
              >
                Next →
              </button>
            </span>
          )}
        </div>
      </section>
    </>
  );
}

interface PartnerRow {
  key: string;
  exporter: string;
  importer: string;
  valueUsd: number;
  /** share of the filtered total (label) */
  share: number;
  /** width relative to the largest bar (geometry) */
  widthPct: number;
}

function rankPartners(flows: TradeFlowDetail[]): PartnerRow[] {
  const totals = new Map<string, { exporter: string; importer: string; valueUsd: number }>();
  for (const flow of flows) {
    if (flow.trade_value_usd === null) continue;
    const key = `${flow.exporter_code}→${flow.importer_code}`;
    const entry = totals.get(key) ?? { exporter: flow.exporter_code, importer: flow.importer_code, valueUsd: 0 };
    entry.valueUsd += flow.trade_value_usd;
    totals.set(key, entry);
  }
  const rows = [...totals.entries()].map(([key, entry]) => ({ key, ...entry }));
  rows.sort((a, b) => b.valueUsd - a.valueUsd);
  const max = rows[0]?.valueUsd ?? 0;
  const grandTotal = rows.reduce((sum, row) => sum + row.valueUsd, 0);
  return rows.slice(0, 8).map((row) => ({
    ...row,
    share: grandTotal > 0 ? row.valueUsd / grandTotal : 0,
    widthPct: max > 0 ? row.valueUsd / max : 0,
  }));
}
