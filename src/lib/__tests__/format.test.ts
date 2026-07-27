import { describe, expect, it } from 'vitest';
import {
  classifyMetricKind,
  confidenceBand,
  formatDate,
  formatGrossWeightKg,
  formatLocationPrecision,
  formatNodeType,
  formatNumber,
  formatPeriod,
  formatQuantity,
  formatSeverity,
  formatStatus,
  formatUsd,
  impliedUnitValueUsdPerTonne,
  isApproximateLocation,
  isStale,
  NOT_REPORTED,
  supplyCategory,
} from '@/lib/format';

describe('confidenceBand', () => {
  it('bands the 0-100 schema scale', () => {
    expect(confidenceBand(92)).toBe('high');
    expect(confidenceBand(85)).toBe('high');
    expect(confidenceBand(84)).toBe('medium');
    expect(confidenceBand(65)).toBe('medium');
    expect(confidenceBand(64)).toBe('low');
    expect(confidenceBand(0)).toBe('low');
  });
  it('returns null for missing scores', () => {
    expect(confidenceBand(null)).toBeNull();
    expect(confidenceBand(undefined)).toBeNull();
  });
});

describe('dates and periods', () => {
  it('formats dates as 21 Oct 2025', () => {
    expect(formatDate('2025-10-21')).toBe('21 Oct 2025');
  });
  it('labels missing dates instead of inventing them', () => {
    expect(formatDate(null)).toBe(NOT_REPORTED);
    expect(formatDate('garbage')).toBe(NOT_REPORTED);
  });
  it('collapses full calendar years', () => {
    expect(formatPeriod('2025-01-01', '2025-12-31')).toBe('2025');
    expect(formatPeriod('2025-01-01', '2027-12-31')).toBe('2025–2027');
  });
  it('detects quarters and months', () => {
    expect(formatPeriod('2026-01-01', '2026-03-31')).toBe('Q1 2026');
    expect(formatPeriod('2026-04-01', '2026-06-30')).toBe('Q2 2026');
    expect(formatPeriod('2026-02-01', '2026-02-28')).toBe('Feb 2026');
  });
  it('falls back to explicit ranges', () => {
    expect(formatPeriod('2025-10-21', '2025-11-03')).toBe('21 Oct 2025 – 3 Nov 2025');
  });
  it('flags stale and missing review dates', () => {
    const now = new Date('2026-07-01T00:00:00Z');
    expect(isStale('2025-01-01', 12, now)).toBe(true);
    expect(isStale('2026-06-01', 12, now)).toBe(false);
    expect(isStale(null, 12, now)).toBe(true);
  });
});

describe('numbers and units', () => {
  it('keeps units attached to quantities', () => {
    expect(formatQuantity(12300, 't Sb')).toBe('12,300 t contained Sb');
    expect(formatQuantity(1200, 'tpa')).toBe('1,200 t/y');
  });
  it('never converts missing values to zero', () => {
    expect(formatQuantity(null, 't')).toBe(NOT_REPORTED);
    expect(formatNumber(null)).toBe(NOT_REPORTED);
    expect(formatUsd(null)).toBe(NOT_REPORTED);
  });
  it('renders customs gross weight in tonnes with the (gross) label', () => {
    expect(formatGrossWeightKg(2_500_000)).toBe('2,500 t (gross)');
    expect(formatGrossWeightKg(500)).toBe('500 kg (gross)');
    expect(formatGrossWeightKg(null)).toBe(NOT_REPORTED);
  });
  it('guards implied unit values against tiny weights and missing inputs', () => {
    expect(impliedUnitValueUsdPerTonne(9_000_000, 2_500_000)).toBeCloseTo(3600);
    expect(impliedUnitValueUsdPerTonne(9_000_000, 50)).toBeNull();
    expect(impliedUnitValueUsdPerTonne(null, 2_500_000)).toBeNull();
    expect(impliedUnitValueUsdPerTonne(9_000_000, null)).toBeNull();
  });
});

describe('labels', () => {
  it('labels known node types and title-cases unknown ones', () => {
    expect(formatNodeType('development_project')).toBe('Development project');
    expect(formatNodeType('trioxide_plant')).toBe('Antimony trioxide plant');
    expect(formatNodeType('weird_new_type')).toBe('Weird new type');
    expect(formatNodeType(null)).toBe(NOT_REPORTED);
  });
  it('labels statuses', () => {
    expect(formatStatus('care_and_maintenance')).toBe('Care & maintenance');
    expect(formatStatus('operating')).toBe('Operating');
  });
  it('maps status to supply category per the methodology', () => {
    expect(supplyCategory('operating')).toBe('operating');
    expect(supplyCategory('development')).toBe('prospective');
    expect(supplyCategory('construction')).toBe('prospective');
    expect(supplyCategory('suspended')).toBe('inactive_or_uncertain');
    expect(supplyCategory('unknown')).toBe('inactive_or_uncertain');
  });
  it('labels severity levels', () => {
    expect(formatSeverity(5)).toBe('Critical');
    expect(formatSeverity(1)).toBe('Minimal');
    expect(formatSeverity(null)).toBe('Unrated');
  });
  it('discloses location precision', () => {
    expect(isApproximateLocation('approximate')).toBe(true);
    expect(isApproximateLocation('exact')).toBe(false);
    expect(formatLocationPrecision('approximate')).toBe('Approximate location');
  });
});

describe('classifyMetricKind', () => {
  it('classifies for coverage flags only', () => {
    expect(classifyMetricKind('Processing design capacity')).toBe('capacity');
    expect(classifyMetricKind('Projected recovered antimony (annualised)')).toBe('production');
    expect(classifyMetricKind('Measured and indicated resource')).toBe('resource');
    expect(classifyMetricKind('Something else')).toBe('other');
    expect(classifyMetricKind(null)).toBe('other');
  });
});
