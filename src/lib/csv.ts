/**
 * Spreadsheet-safe CSV generation for filtered exports.
 *
 * - Fields containing delimiters, quotes or newlines are quoted; quotes are
 *   doubled per RFC 4180.
 * - Values beginning with =, +, -, @ or control characters are prefixed with
 *   an apostrophe so spreadsheet applications never interpret them as
 *   formulas (CSV-injection guard).
 * - Every export starts with commented metadata lines (# ...) recording the
 *   product, timestamp and active filters so a file found later is
 *   self-describing.
 */

export interface CsvColumn<Row> {
  label: string;
  value: (row: Row) => string | number | null | undefined;
}

const FORMULA_TRIGGERS = new Set(['=', '+', '-', '@', '\t', '\r']);

export function escapeCsvField(raw: string | number | null | undefined): string {
  if (raw === null || raw === undefined) return '';
  let text = String(raw);
  if (text.length > 0 && FORMULA_TRIGGERS.has(text.charAt(0))) {
    text = `'${text}`;
  }
  if (/[",\n\r]/.test(text)) {
    text = `"${text.replaceAll('"', '""')}"`;
  }
  return text;
}

export interface CsvMetadata {
  title: string;
  filters?: Record<string, string | undefined>;
  rowCount: number;
  /** injectable for tests */
  now?: Date;
}

export function buildCsv<Row>(columns: CsvColumn<Row>[], rows: Row[], meta: CsvMetadata): string {
  const timestamp = (meta.now ?? new Date()).toISOString();
  const lines: string[] = [
    `# Antimony Supply Risk Atlas — ${meta.title}`,
    `# Exported ${timestamp} · ${meta.rowCount} row(s)`,
  ];
  const activeFilters = Object.entries(meta.filters ?? {}).filter(([, v]) => v !== undefined && v !== '');
  lines.push(
    activeFilters.length > 0
      ? `# Filters: ${activeFilters.map(([k, v]) => `${k}=${v}`).join('; ')}`
      : '# Filters: none',
  );
  lines.push('# Provenance and confidence columns qualify every quantity; do not aggregate across units.');
  lines.push(columns.map((c) => escapeCsvField(c.label)).join(','));
  for (const row of rows) {
    lines.push(columns.map((c) => escapeCsvField(c.value(row))).join(','));
  }
  return `${lines.join('\r\n')}\r\n`;
}

/** Browser-only: trigger a download of the given CSV text. */
export function downloadCsv(filename: string, csvText: string): void {
  const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
