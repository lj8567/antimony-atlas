import { describe, expect, it } from 'vitest';
import { buildCsv, escapeCsvField } from '@/lib/csv';

describe('escapeCsvField', () => {
  it('quotes delimiters and doubles quotes', () => {
    expect(escapeCsvField('a,b')).toBe('"a,b"');
    expect(escapeCsvField('say "hi"')).toBe('"say ""hi"""');
    expect(escapeCsvField('line\nbreak')).toBe('"line\nbreak"');
  });
  it('guards against spreadsheet formula injection', () => {
    expect(escapeCsvField('=SUM(A1)')).toBe("'=SUM(A1)");
    expect(escapeCsvField('+123')).toBe("'+123");
    expect(escapeCsvField('@cmd')).toBe("'@cmd");
    expect(escapeCsvField('-5')).toBe("'-5");
  });
  it('passes plain values through and blanks nullish ones', () => {
    expect(escapeCsvField('plain')).toBe('plain');
    expect(escapeCsvField(42)).toBe('42');
    expect(escapeCsvField(null)).toBe('');
    expect(escapeCsvField(undefined)).toBe('');
  });
});

describe('buildCsv', () => {
  const columns = [
    { label: 'Name', value: (row: { name: string; qty: number | null }) => row.name },
    { label: 'Quantity (t)', value: (row: { name: string; qty: number | null }) => row.qty },
  ];
  const rows = [
    { name: 'Stibnite, Idaho', qty: 12300 },
    { name: '=EVIL()', qty: null },
  ];

  it('includes metadata, headers and escaped rows', () => {
    const csv = buildCsv(columns, rows, {
      title: 'Test export',
      filters: { country: 'USA', status: undefined },
      rowCount: rows.length,
      now: new Date('2026-07-27T12:00:00Z'),
    });
    const lines = csv.trimEnd().split('\r\n');
    expect(lines[0]).toBe('# Antimony Supply Risk Atlas — Test export');
    expect(lines[1]).toContain('2026-07-27T12:00:00.000Z');
    expect(lines[1]).toContain('2 row(s)');
    expect(lines[2]).toBe('# Filters: country=USA');
    expect(lines[4]).toBe('Name,Quantity (t)');
    expect(lines[5]).toBe('"Stibnite, Idaho",12300');
    expect(lines[6]).toBe("'=EVIL(),");
  });

  it('notes when no filters are active', () => {
    const csv = buildCsv(columns, [], { title: 'Empty', rowCount: 0 });
    expect(csv).toContain('# Filters: none');
  });
});
