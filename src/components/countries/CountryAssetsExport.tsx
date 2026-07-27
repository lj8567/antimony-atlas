'use client';

import { ExportCsvButton } from '@/components/ui/ExportCsvButton';
import { countryName } from '@/lib/countries';
import type { CsvColumn } from '@/lib/csv';
import { formatDate, formatNodeType, formatPeriod, formatStatus, PROVENANCE_LABEL } from '@/lib/format';
import type { AssetListItem } from '@/lib/supabase/types';

const COLUMNS: CsvColumn<AssetListItem>[] = [
  { label: 'Asset', value: (item) => item.node.name },
  { label: 'Country code', value: (item) => item.node.country_code },
  { label: 'Country', value: (item) => countryName(item.node.country_code) },
  { label: 'Region', value: (item) => item.node.region },
  { label: 'Node type', value: (item) => formatNodeType(item.node.node_type) },
  { label: 'Status', value: (item) => formatStatus(item.node.status) },
  { label: 'Owner', value: (item) => item.owner_name },
  { label: 'Operator', value: (item) => item.operator_name },
  { label: 'Principal metric', value: (item) => item.principal_observation?.metric_name ?? '' },
  { label: 'Principal metric value', value: (item) => item.principal_observation?.value_numeric ?? '' },
  { label: 'Unit', value: (item) => item.principal_observation?.unit ?? '' },
  {
    label: 'Metric period',
    value: (item) =>
      item.principal_observation
        ? formatPeriod(item.principal_observation.period_start, item.principal_observation.period_end)
        : '',
  },
  {
    label: 'Metric provenance',
    value: (item) => (item.principal_observation ? PROVENANCE_LABEL[item.principal_observation.provenance] : ''),
  },
  { label: 'Reported claims', value: (item) => item.evidence.reported },
  { label: 'Modelled claims', value: (item) => item.evidence.modelled },
  { label: 'Unverified claims', value: (item) => item.evidence.unverified },
  { label: 'Max claim confidence (0-100)', value: (item) => item.max_confidence },
  { label: 'Distinct sources', value: (item) => item.source_count },
  { label: 'Record updated', value: (item) => formatDate(item.node.updated_at, '') },
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
