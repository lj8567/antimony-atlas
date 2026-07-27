'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import { ConfidenceIndicator, ProvenanceBadge, StatusLabel } from '@/components/ui/badges';
import {
  SearchField,
  Segmented,
  SelectField,
  SortHeader,
  type SelectOption,
} from '@/components/ui/controls';
import { ExportCsvButton } from '@/components/ui/ExportCsvButton';
import { MetricValue } from '@/components/ui/MetricValue';
import { EmptyState } from '@/components/ui/states';
import { countryName } from '@/lib/countries';
import type { CsvColumn } from '@/lib/csv';
import {
  countActiveAssetFilters,
  DEFAULT_ASSET_FILTERS,
  filterAssets,
  parseAssetFilters,
  serializeAssetFilters,
  sortAssets,
  toQueryString,
  type AssetFilters,
  type AssetSortKey,
} from '@/lib/filters';
import { formatDate, formatNodeType, formatPeriod, formatStatus, PROVENANCE_LABEL, STATUS_ORDER } from '@/lib/format';
import type { AssetListItem } from '@/lib/supabase/types';

const PAGE_SIZE = 50;

const CSV_COLUMNS: CsvColumn<AssetListItem>[] = [
  { label: 'Asset', value: (item) => item.node.canonical_name },
  { label: 'Country code', value: (item) => item.node.country_code },
  { label: 'Country', value: (item) => countryName(item.node.country_code) },
  { label: 'Region', value: (item) => item.node.region },
  { label: 'Node type', value: (item) => formatNodeType(item.node.node_type) },
  { label: 'Status', value: (item) => formatStatus(item.node.status) },
  { label: 'Operator', value: (item) => item.operator_name },
  { label: 'Owners (current)', value: (item) => item.owner_names.join('; ') },
  { label: 'Latest metric', value: (item) => item.latest_observation?.metric?.name ?? '' },
  { label: 'Latest metric value', value: (item) => item.latest_observation?.value_numeric ?? item.latest_observation?.value_text ?? '' },
  { label: 'Unit', value: (item) => item.latest_observation?.unit ?? '' },
  {
    label: 'Metric period',
    value: (item) =>
      item.latest_observation
        ? formatPeriod(item.latest_observation.period_start, item.latest_observation.period_end)
        : '',
  },
  { label: 'Metric product form', value: (item) => item.latest_observation?.product_form?.name ?? '' },
  {
    label: 'Metric estimate type',
    value: (item) => (item.latest_observation ? PROVENANCE_LABEL[item.latest_observation.estimate_type] : ''),
  },
  {
    label: 'Metric source URL',
    value: (item) => item.latest_observation?.assertion?.source?.url ?? '',
  },
  {
    label: 'Identity provenance',
    value: (item) => (item.identity_provenance ? PROVENANCE_LABEL[item.identity_provenance] : ''),
  },
  { label: 'Identity confidence (0-100)', value: (item) => item.identity_confidence },
  { label: 'Observations on file', value: (item) => item.observation_count },
  { label: 'Distinct sources', value: (item) => item.source_count },
  { label: 'Latest event', value: (item) => item.latest_event?.headline ?? '' },
  { label: 'Last reviewed', value: (item) => formatDate(item.node.last_reviewed_at, '') },
  { label: 'Location precision', value: (item) => item.node.location_precision },
];

export function AssetExplorer({ items }: { items: AssetListItem[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [page, setPage] = useState(0);

  const filters = useMemo(
    () => parseAssetFilters(new URLSearchParams(searchParams.toString())),
    [searchParams],
  );

  const apply = (patch: Partial<AssetFilters>) => {
    setPage(0);
    const next = { ...filters, ...patch };
    router.replace(`${pathname}${toQueryString(serializeAssetFilters(next))}`, { scroll: false });
  };

  const toggleSort = (key: AssetSortKey) => {
    if (filters.sort === key) {
      apply({ dir: filters.dir === 'asc' ? 'desc' : 'asc' });
    } else {
      apply({ sort: key, dir: 'asc' });
    }
  };

  const options = useMemo(() => deriveOptions(items), [items]);

  const filtered = useMemo(() => sortAssets(filterAssets(items, filters), filters.sort, filters.dir), [items, filters]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount - 1);
  const visible = filtered.slice(currentPage * PAGE_SIZE, currentPage * PAGE_SIZE + PAGE_SIZE);
  const activeCount = countActiveAssetFilters(filters);

  return (
    <section className="panel">
      <div className="filter-bar">
        <SearchField
          value={filters.q}
          placeholder="Asset, region, country, owner…"
          onChange={(q) => apply({ q })}
        />
        <SelectField label="Country" value={filters.country} options={options.countries} onChange={(country) => apply({ country })} />
        {options.regions.length > 0 && (
          <SelectField label="Region" value={filters.region} options={options.regions} onChange={(region) => apply({ region })} />
        )}
        <SelectField label="Type" value={filters.type} options={options.types} onChange={(type) => apply({ type })} />
        <SelectField label="Status" value={filters.status} options={options.statuses} onChange={(status) => apply({ status })} />
        {options.productForms.length > 0 && (
          <SelectField
            label="Product form"
            value={filters.productForm}
            options={options.productForms}
            onChange={(productForm) => apply({ productForm })}
          />
        )}
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
        <SelectField
          label="Confidence"
          value={filters.confidence}
          options={[
            { value: 'high', label: 'High (≥ 85)' },
            { value: 'medium', label: 'Medium (65–84)' },
            { value: 'low', label: 'Low (< 65)' },
          ]}
          onChange={(confidence) => apply({ confidence: confidence as AssetFilters['confidence'] })}
        />
        <Segmented
          label="Supply"
          value={filters.supply}
          options={[
            { value: '', label: 'All' },
            { value: 'operating', label: 'Operating' },
            { value: 'prospective', label: 'Prospective' },
          ]}
          onChange={(supply) => apply({ supply: supply as AssetFilters['supply'] })}
        />
        {activeCount > 0 && (
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => {
              setPage(0);
              router.replace(pathname, { scroll: false });
            }}
          >
            Clear all ({activeCount})
          </button>
        )}
        <div style={{ marginLeft: 'auto' }}>
          <ExportCsvButton
            filename="antimony-atlas-assets.csv"
            title="Asset register (filtered)"
            columns={CSV_COLUMNS}
            rows={filtered}
            filters={activeFilterSummary(filters)}
          />
        </div>
      </div>

      {visible.length === 0 ? (
        <EmptyState
          title={items.length === 0 ? 'No assets in the database yet' : 'No assets match the current filters'}
          detail={
            items.length === 0
              ? 'The pilot dataset is being researched asset by asset; records appear here once loaded with sources.'
              : 'Relax or clear filters to see more of the register.'
          }
        />
      ) : (
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>
                  <SortHeader label="Asset" active={filters.sort === 'name'} direction={filters.dir} onSort={() => toggleSort('name')} />
                </th>
                <th>
                  <SortHeader label="Country" active={filters.sort === 'country'} direction={filters.dir} onSort={() => toggleSort('country')} />
                </th>
                <th>
                  <SortHeader label="Type" active={filters.sort === 'type'} direction={filters.dir} onSort={() => toggleSort('type')} />
                </th>
                <th>
                  <SortHeader label="Status" active={filters.sort === 'status'} direction={filters.dir} onSort={() => toggleSort('status')} />
                </th>
                <th>Owner / operator</th>
                <th>Principal metric</th>
                <th>Provenance</th>
                <th>
                  <SortHeader
                    label="Confidence"
                    active={filters.sort === 'confidence'}
                    direction={filters.dir}
                    onSort={() => toggleSort('confidence')}
                  />
                </th>
                <th>Latest event</th>
                <th>
                  <SortHeader
                    label="Reviewed"
                    active={filters.sort === 'reviewed'}
                    direction={filters.dir}
                    onSort={() => toggleSort('reviewed')}
                  />
                </th>
              </tr>
            </thead>
            <tbody>
              {visible.map((item) => (
                <tr key={item.node.node_id}>
                  <td className="primary-cell">
                    <Link href={`/assets/${item.node.node_id}`} className="row-link">
                      {item.node.canonical_name}
                    </Link>
                    {item.node.region && <span className="cell-sub">{item.node.region}</span>}
                  </td>
                  <td>
                    <Link href={`/countries/${item.node.country_code}`}>{countryName(item.node.country_code)}</Link>
                  </td>
                  <td>{formatNodeType(item.node.node_type)}</td>
                  <td>
                    <StatusLabel status={item.node.status} />
                  </td>
                  <td>
                    {item.operator_name ?? item.owner_names[0] ?? <span className="note">Not reported</span>}
                    {item.owner_names.length > 0 && item.operator_name && (
                      <span className="cell-sub">{item.owner_names.join(', ')}</span>
                    )}
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
                  <td>
                    {item.latest_event ? (
                      <span style={{ fontSize: 12 }}>
                        {item.latest_event.headline}
                        <span className="cell-sub">{formatDate(item.latest_event.announced_at)}</span>
                      </span>
                    ) : (
                      <span className="note">None linked</span>
                    )}
                  </td>
                  <td>{formatDate(item.node.last_reviewed_at, 'Not reviewed')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="table-foot">
        <span>
          {filtered.length} of {items.length} assets
          {activeCount > 0 ? ` · ${activeCount} filter${activeCount === 1 ? '' : 's'} active` : ''}
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
  );
}

function deriveOptions(items: AssetListItem[]): {
  countries: SelectOption[];
  regions: SelectOption[];
  types: SelectOption[];
  statuses: SelectOption[];
  productForms: SelectOption[];
} {
  const countries = [...new Set(items.map((item) => item.node.country_code))]
    .sort((a, b) => countryName(a).localeCompare(countryName(b)))
    .map((code) => ({ value: code, label: countryName(code) }));
  const regions = [...new Set(items.map((item) => item.node.region).filter((r): r is string => Boolean(r)))]
    .sort()
    .map((region) => ({ value: region, label: region }));
  const types = [...new Set(items.map((item) => item.node.node_type))]
    .sort()
    .map((type) => ({ value: type, label: formatNodeType(type) }));
  const statuses = STATUS_ORDER.filter((status) => items.some((item) => item.node.status === status)).map((status) => ({
    value: status,
    label: formatStatus(status),
  }));
  const formMap = new Map<string, string>();
  for (const item of items) {
    const form = item.latest_observation?.product_form;
    if (form) formMap.set(form.product_form_id, form.name);
  }
  const productForms = [...formMap.entries()]
    .sort((a, b) => a[1].localeCompare(b[1]))
    .map(([value, label]) => ({ value, label }));
  return { countries, regions, types, statuses, productForms };
}

function activeFilterSummary(filters: AssetFilters): Record<string, string | undefined> {
  const record: Record<string, string | undefined> = {};
  const serialized = serializeAssetFilters(filters);
  for (const [key, value] of Object.entries(serialized)) {
    if (value && value !== DEFAULT_ASSET_FILTERS[key as keyof AssetFilters]) record[key] = value;
  }
  return record;
}
