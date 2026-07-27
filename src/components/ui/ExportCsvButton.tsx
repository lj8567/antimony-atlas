'use client';

import { buildCsv, downloadCsv, type CsvColumn } from '@/lib/csv';

/**
 * Exports the rows currently visible after filtering. The file carries an
 * export timestamp and the active filters as commented metadata lines.
 */
export function ExportCsvButton<Row>({
  filename,
  title,
  columns,
  rows,
  filters,
  disabled,
}: {
  filename: string;
  title: string;
  columns: CsvColumn<Row>[];
  rows: Row[];
  filters?: Record<string, string | undefined>;
  disabled?: boolean;
}) {
  const handleExport = () => {
    const csv = buildCsv(columns, rows, { title, filters, rowCount: rows.length });
    downloadCsv(filename, csv);
  };
  return (
    <button type="button" className="btn" onClick={handleExport} disabled={disabled || rows.length === 0}>
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden>
        <path d="M6 1v7M3 5.5 6 8.5l3-3M1.5 10.5h9" />
      </svg>
      Export CSV
      <span className="visually-hidden"> of {rows.length} filtered rows</span>
    </button>
  );
}
