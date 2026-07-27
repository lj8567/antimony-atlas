import { describe, expect, it } from 'vitest';
import {
  classifyMetricKind,
  confidenceBand,
  formatDate,
  formatGrossWeightKg,
  formatLocationPrecision,
  formatMetricName,
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
  normalizeConfidence,
  NOT_REPORTED,
  supplyCategory,
} from '@/lib/format';

describe('normalizeConfidence', () => {
  it('reads fractions as percentages and passes 0-100 scores through', () => {
    expect(normalizeConfidence(0.78)).toBe(78);
    expect(normalizeConfidence(0.855)).toBe(86);
    expect(normalizeConfidence(1)).toBe(100);
    expect(normalizeConfidence(82)).toBe(82);
    expect(normalizeConfidence(100)).toBe(100);
  });
  it('clamps out-of-range values and preserves missing ones', () => {
    expect(normalizeConfidence(140)).toBe(100);
    expect(normalizeConfidence(-2)).toBe(0);
    expect(normalizeConfidence(null)).toBeNull();
    expect(normalizeConfidence(undefined)).toBeNull();
  });
});

describe('confidenceBand', () => {
  it('bands the normalised 0-100 scale', () => {
    expect(confidenceBand(92)).toBe('high');
    expect(confidenceBand(85)).toBe('high');
    expect(confidenceBand(84)).toBe('medium');
    expect(confidenceBand(65)).toBe('medium');
    expect(confidenceBand(64)).toBe('low');
  });
  it('returns null for missing scores', () => {
    expect(confidenceBand(null)).toBeNull();
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
  it('collapses full calendar years and detects quarters', () => {
    expect(formatPeriod('2025-01-01', '2025-12-31')).toBe('2025');
    expect(formatPeriod('2025-01-01', '2027-12-31')).toBe('2025–2027');
    expect(formatPeriod('2026-01-01', '2026-03-31')).toBe('Q1 2026');
    expect(formatPeriod('2026-02-01', '2026-02-28')).toBe('Feb 2026');
    expect(formatPeriod('2025-10-21', '2025-11-03')).toBe('21 Oct 2025 – 3 Nov 2025');
  });
  it('flags stale and missing update dates', () => {
    const now = new Date('2026-07-01T00:00:00Z');
    expect(isStale('2025-01-01', 12, now)).toBe(true);
    expect(isStale('2026-06-01', 12, now)).toBe(false);
    expect(isStale(null, 12, now)).toBe(true);
  });
});

describe('numbers and units', () => {
  it('keeps stored units verbatim on quantities', () => {
    expect(formatQuantity(1282, 'tonnes Sb contained')).toBe('1,282 tonnes Sb contained');
    expect(formatQuantity(22000, 'short tons ore per day')).toBe('22,000 short tons ore per day');
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
  });
  it('guards implied unit values against tiny weights and missing inputs', () => {
    expect(impliedUnitValueUsdPerTonne(9_000_000, 2_500_000)).toBeCloseTo(3600);
    expect(impliedUnitValueUsdPerTonne(9_000_000, 50)).toBeNull();
    expect(impliedUnitValueUsdPerTonne(null, 2_500_000)).toBeNull();
  });
});

describe('labels', () => {
  it('labels known node types and title-cases unknown ones', () => {
    expect(formatNodeType('development_project')).toBe('Development project');
    expect(formatNodeType('mine_and_concentrator')).toBe('Mine & concentrator');
    expect(formatNodeType('weird_new_type')).toBe('Weird new type');
    expect(formatNodeType(null)).toBe(NOT_REPORTED);
  });
  it('labels metric names from snake_case', () => {
    expect(formatMetricName('antimony_finished_goods_production')).toBe('Antimony finished goods production');
    expect(formatMetricName('proven_and_probable_contained_antimony')).toBe('Proven and probable contained antimony');
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
    expect(formatSeverity(null)).toBe('Unrated');
  });
  it('treats missing precision claims as approximate (conservative)', () => {
    expect(isApproximateLocation('approximate')).toBe(true);
    expect(isApproximateLocation('exact')).toBe(false);
    expect(isApproximateLocation('Exact coordinates')).toBe(false);
    expect(isApproximateLocation(null)).toBe(true);
    expect(formatLocationPrecision('approximate')).toBe('Approximate location');
    expect(formatLocationPrecision(null)).toBe('Precision not recorded');
  });
});

describe('classifyMetricKind (live metric names)', () => {
  it('classifies production, capacity, resources and reserves correctly', () => {
    expect(classifyMetricKind('antimony_production')).toBe('production');
    expect(classifyMetricKind('antimony_finished_goods_production')).toBe('production');
    expect(classifyMetricKind('historical_antimony_production_annual_average')).toBe('production');
    expect(classifyMetricKind('processing_design_capacity')).toBe('capacity');
    expect(classifyMetricKind('antimony_products_nameplate_capacity')).toBe('capacity');
    expect(classifyMetricKind('antimony_feed_processing_capacity')).toBe('capacity');
    // announced capacity must never classify as production
    expect(classifyMetricKind('announced_expanded_production_capacity')).toBe('capacity');
    // resource inventory must never classify as production
    expect(classifyMetricKind('measured_and_indicated_contained_antimony')).toBe('resource');
    expect(classifyMetricKind('inferred_contained_antimony')).toBe('resource');
    expect(classifyMetricKind('proven_and_probable_ore_reserve_tonnage')).toBe('resource');
    expect(classifyMetricKind('operational_small_rotary_furnaces')).toBe('other');
    expect(classifyMetricKind(null)).toBe('other');
  });
});
