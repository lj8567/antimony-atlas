'use client';

import { ExportCsvButton } from '@/components/ui/ExportCsvButton';
import { countryName } from '@/lib/countries';
import type { CsvColumn } from '@/lib/csv';
import { formatDate, formatNodeType, formatPeriod, formatStatus, PROVENANCE_LABEL } from '@/lib/format';
import type { AssetListItem } from '@/lib/supabase/types';

const COLUMNS: CsvColumn<AssetListItem>[] = [
  { label: 'Asset', value: (item) => item.node.canonical_name },
  { label: 'Country code', value: (item) => item.node.country_code },
  { label: 'Country', value: (item) => countryName(item.node.country_code) },
  { label: 'Region', value: (item) => item.node.region },
  { label: 'Node type', value: (item) => formatNodeType(item.node.node_type) },
  { label: 'Status', value: (item) => formatStatus(item.node.status) },
  { label: 'Operator', value: (item) => item.operator_name },
  { label: 'Latest metric', value: (item) => item.latest_observation?.metric?.name ?? '' },
  {
    label: 'Latest metric value',
    value: (item) => item.latest_observation?.value_numeric ?? item.latest_observation?.value_text ?? '',
  },
  { label: 'Unit', value: (item) => item.latest_observation?.unit ?? '' },
  {
    label: 'Metric period',
    value: (item) =>
      item.latest_observation ? formatPeriod(item.latest_observation.period_start, item.latest_observation.period_end) : '',
  },
  {
    label: 'Metric estimate type',
    value: (item) => (item.latest_observation ? PROVENANCE_LABEL[item.latest_observation.estimate_type] : ''),
  },
  {
    label: 'Identity provenance',
    value: (item) => (item.identity_provenance ? PROVENANCE_LABEL[item.identity_provenance] : ''),
  },
  { label: 'Identity confidence (0-100)', value: (item) => item.identity_confidence },
  { label: 'Last reviewed', value: (item) => formatDate(item.node.last_reviewed_at, '') },
];

export function CountryAssetsExport({ items, countryCode }: { items: AssetListItem[]; countryCode: string }) {
  return (
    <ExportCsvButton
      filename={`antimony-atlas-assets-${countryCode.toLowerCase()}.csv`}
      title={`Asset list — ${countryName(countryCode)}`}
      columns={COLUMNS}
      rows={items}
      filters={{ country: countryCode }}
    />
  );
}
