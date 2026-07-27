/**
 * Central display formatting. Every value shown to a user should pass through
 * one of these helpers so units, dates, provenance and confidence are rendered
 * consistently across tables, detail pages, the map and CSV exports.
 *
 * Rules honoured here:
 *  - missing values are labelled, never silently zeroed;
 *  - units are never converted (kg→t mass display is the single exception and
 *    always labelled, with the original value preserved);
 *  - provenance and estimate qualifiers are never stripped from metric labels.
 */

import type { NodeStatus, ProvenanceClass } from './supabase/types';

export const NOT_REPORTED = 'Not reported';
export const NOT_AVAILABLE = 'Not available';

/* ------------------------------------------------------------------ */
/* Provenance                                                          */
/* ------------------------------------------------------------------ */

export const PROVENANCE_ORDER: ProvenanceClass[] = ['reported', 'modelled', 'unverified'];

export const PROVENANCE_LABEL: Record<ProvenanceClass, string> = {
  reported: 'Reported',
  modelled: 'Modelled',
  unverified: 'Unverified',
};

export const PROVENANCE_DESCRIPTION: Record<ProvenanceClass, string> = {
  reported: 'Explicitly stated by a traceable source. Provenance is not a currency or accuracy guarantee.',
  modelled: 'Reproducible calculation derived from cited reported inputs. The conversion basis is retained.',
  unverified: 'Present in the dataset but not yet sufficiently confirmed by a traceable source.',
};

export function isProvenanceClass(value: unknown): value is ProvenanceClass {
  return value === 'reported' || value === 'modelled' || value === 'unverified';
}

/* ------------------------------------------------------------------ */
/* Confidence                                                          */
/* ------------------------------------------------------------------ */

/**
 * The schema stores confidence as an integer 0–100 (weighted source-quality
 * score, see supabase/migrations/0001_initial.sql). Bands adapt the product
 * brief's 0–1 thresholds to that scale.
 */
export type ConfidenceBand = 'high' | 'medium' | 'low';

export function confidenceBand(score: number | null | undefined): ConfidenceBand | null {
  if (score === null || score === undefined || Number.isNaN(score)) return null;
  if (score >= 85) return 'high';
  if (score >= 65) return 'medium';
  return 'low';
}

export const CONFIDENCE_BAND_LABEL: Record<ConfidenceBand, string> = {
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};

export function confidenceDetail(score: number | null | undefined): string {
  if (score === null || score === undefined || Number.isNaN(score)) return 'No confidence score recorded';
  const band = confidenceBand(score);
  return `Confidence ${score}/100 (${band ? CONFIDENCE_BAND_LABEL[band] : 'unscored'}). Weighted score across source quality, recency, directness, corroboration and extraction quality.`;
}

/* ------------------------------------------------------------------ */
/* Node status / type                                                  */
/* ------------------------------------------------------------------ */

export const STATUS_LABEL: Record<NodeStatus, string> = {
  operating: 'Operating',
  development: 'Development',
  construction: 'Construction',
  care_and_maintenance: 'Care & maintenance',
  suspended: 'Suspended',
  closed: 'Closed',
  unknown: 'Unknown',
};

export const STATUS_ORDER: NodeStatus[] = [
  'operating',
  'construction',
  'development',
  'care_and_maintenance',
  'suspended',
  'closed',
  'unknown',
];

/**
 * Supply category used for the operating-vs-prospective distinction. The
 * mapping is documented on the methodology page; it must not be changed
 * without a corresponding methodology update.
 */
export type SupplyCategory = 'operating' | 'prospective' | 'inactive_or_uncertain';

export function supplyCategory(status: NodeStatus): SupplyCategory {
  if (status === 'operating') return 'operating';
  if (status === 'development' || status === 'construction') return 'prospective';
  return 'inactive_or_uncertain';
}

export const SUPPLY_CATEGORY_LABEL: Record<SupplyCategory, string> = {
  operating: 'Operating',
  prospective: 'Prospective',
  inactive_or_uncertain: 'Inactive / uncertain',
};

const NODE_TYPE_LABEL: Record<string, string> = {
  mine: 'Mine',
  development_project: 'Development project',
  concentrator: 'Concentrator',
  smelter: 'Smelter',
  metal_plant: 'Antimony metal plant',
  trioxide_plant: 'Antimony trioxide plant',
  port: 'Port',
  border_gateway: 'Border gateway',
};

/** node_type is free text in the schema; label known values, title-case the rest. */
export function formatNodeType(nodeType: string | null | undefined): string {
  if (!nodeType) return NOT_REPORTED;
  const known = NODE_TYPE_LABEL[nodeType];
  if (known) return known;
  const words = nodeType.replaceAll('_', ' ').trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export function formatStatus(status: string | null | undefined): string {
  if (!status) return NOT_REPORTED;
  return STATUS_LABEL[status as NodeStatus] ?? formatNodeType(status);
}

export const PROCESSING_NODE_TYPES = new Set(['concentrator', 'smelter', 'metal_plant', 'trioxide_plant']);
export const GATEWAY_NODE_TYPES = new Set(['port', 'border_gateway']);
export const UPSTREAM_NODE_TYPES = new Set(['mine', 'development_project']);

/* ------------------------------------------------------------------ */
/* Location precision                                                  */
/* ------------------------------------------------------------------ */

export function formatLocationPrecision(precision: string | null | undefined): string {
  if (!precision) return 'Precision not recorded';
  const map: Record<string, string> = {
    exact: 'Exact coordinates',
    approximate: 'Approximate location',
    site: 'Site-level coordinates',
    district: 'District-level location',
    country: 'Country-level location',
  };
  return map[precision] ?? formatNodeType(precision);
}

export function isApproximateLocation(precision: string | null | undefined): boolean {
  return precision !== 'exact';
}

/* ------------------------------------------------------------------ */
/* Dates and periods                                                   */
/* ------------------------------------------------------------------ */

const DATE_FORMAT = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});

const MONTH_YEAR_FORMAT = new Intl.DateTimeFormat('en-GB', {
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});

function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** "21 Oct 2025"; missing values become the provided fallback label. */
export function formatDate(value: string | null | undefined, fallback: string = NOT_REPORTED): string {
  const date = parseDate(value);
  return date ? DATE_FORMAT.format(date) : fallback;
}

/**
 * Compact period label: full calendar years become "2025" (or "2025–2027"),
 * quarters become "Q1 2026", single months "Jan 2026", other spans render as
 * an explicit date range. Exact bounds stay available via formatDate.
 */
export function formatPeriod(start: string | null | undefined, end: string | null | undefined): string {
  const startDate = parseDate(start);
  const endDate = parseDate(end);
  if (!startDate && !endDate) return NOT_REPORTED;
  if (!startDate || !endDate) return formatDate(start ?? end);

  const sy = startDate.getUTCFullYear();
  const ey = endDate.getUTCFullYear();
  const isYearStart = startDate.getUTCMonth() === 0 && startDate.getUTCDate() === 1;
  const isYearEnd = endDate.getUTCMonth() === 11 && endDate.getUTCDate() === 31;
  if (isYearStart && isYearEnd) return sy === ey ? String(sy) : `${sy}–${ey}`;

  const sameYear = sy === ey;
  if (sameYear && startDate.getUTCDate() === 1) {
    const sm = startDate.getUTCMonth();
    const em = endDate.getUTCMonth();
    const lastDayOfEndMonth = new Date(Date.UTC(ey, em + 1, 0)).getUTCDate();
    if (endDate.getUTCDate() === lastDayOfEndMonth) {
      if (em - sm === 2 && sm % 3 === 0) return `Q${sm / 3 + 1} ${sy}`;
      if (em === sm) return MONTH_YEAR_FORMAT.format(startDate);
    }
  }
  return `${DATE_FORMAT.format(startDate)} – ${DATE_FORMAT.format(endDate)}`;
}

/** Rough staleness check for review dates (used by data-quality panels). */
export function isStale(reviewedAt: string | null | undefined, months = 12, now: Date = new Date()): boolean {
  const date = parseDate(reviewedAt);
  if (!date) return true;
  const threshold = new Date(now);
  threshold.setUTCMonth(threshold.getUTCMonth() - months);
  return date < threshold;
}

/* ------------------------------------------------------------------ */
/* Numbers and units                                                   */
/* ------------------------------------------------------------------ */

const NUMBER_FORMAT = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });
const PRECISE_FORMAT = new Intl.NumberFormat('en-US', { maximumFractionDigits: 4 });
const USD_FORMAT = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

export function formatNumber(value: number | null | undefined, fallback: string = NOT_REPORTED): string {
  if (value === null || value === undefined || Number.isNaN(value)) return fallback;
  const abs = Math.abs(value);
  if (abs !== 0 && abs < 0.01) return PRECISE_FORMAT.format(value);
  return NUMBER_FORMAT.format(value);
}

export function formatUsd(value: number | null | undefined, fallback: string = NOT_REPORTED): string {
  if (value === null || value === undefined || Number.isNaN(value)) return fallback;
  return USD_FORMAT.format(value);
}

/**
 * Unit strings are stored free-text; render known codes with a consistent
 * label and leave everything else verbatim so no meaning is invented.
 */
const UNIT_LABEL: Record<string, string> = {
  t: 't',
  tonne: 't',
  tonnes: 't',
  kg: 'kg',
  lb: 'lb',
  lbs: 'lb',
  't/y': 't/y',
  tpa: 't/y',
  'tonnes per year': 't/y',
  'tonnes per annum': 't/y',
  't/d': 't/d',
  tpd: 't/d',
  'tonnes per day': 't/d',
  't sb': 't contained Sb',
  't contained sb': 't contained Sb',
  'tonnes contained sb': 't contained Sb',
  'lb sb': 'lb contained Sb',
  'lbs contained sb': 'lb contained Sb',
  usd: 'US$',
  'usd/t': 'US$/t',
  'usd/kg': 'US$/kg',
  '%': '%',
  pct: '%',
};

export function formatUnit(unit: string | null | undefined): string {
  if (!unit) return '';
  return UNIT_LABEL[unit.trim().toLowerCase()] ?? unit.trim();
}

/** "12,300 t/y" — value plus normalised unit label, never a bare number. */
export function formatQuantity(
  value: number | null | undefined,
  unit: string | null | undefined,
  fallback: string = NOT_REPORTED,
): string {
  if (value === null || value === undefined || Number.isNaN(value)) return fallback;
  const unitLabel = formatUnit(unit);
  return unitLabel ? `${formatNumber(value)} ${unitLabel}` : formatNumber(value);
}

/**
 * Display helper for customs gross weight stored in kilograms. Pure mass unit
 * conversion (kg → t), always labelled "(gross)"; the exact kg figure should
 * accompany it in tooltips and exports.
 */
export function formatGrossWeightKg(kg: number | null | undefined): string {
  if (kg === null || kg === undefined || Number.isNaN(kg)) return NOT_REPORTED;
  if (Math.abs(kg) < 1000) return `${formatNumber(kg)} kg (gross)`;
  return `${formatNumber(kg / 1000)} t (gross)`;
}

/**
 * Implied unit value from customs data (US$ per tonne, gross weight basis).
 * Returns null when either input is missing or the weight is too small for
 * the ratio to be defensible.
 */
export function impliedUnitValueUsdPerTonne(
  valueUsd: number | null | undefined,
  grossWeightKg: number | null | undefined,
): number | null {
  if (!valueUsd || !grossWeightKg || grossWeightKg < 100) return null;
  return valueUsd / (grossWeightKg / 1000);
}

export function formatPercent(value: number | null | undefined, fallback: string = NOT_REPORTED): string {
  if (value === null || value === undefined || Number.isNaN(value)) return fallback;
  return `${NUMBER_FORMAT.format(value)}%`;
}

/* ------------------------------------------------------------------ */
/* Metric classification (coverage flags only — labels stay verbatim)  */
/* ------------------------------------------------------------------ */

export type MetricKind = 'capacity' | 'production' | 'resource' | 'other';

/**
 * Coarse classification of free-text metric names, used only for coverage
 * reporting ("no capacity metric recorded"). It never alters how a metric is
 * displayed — metric names and qualifiers always render verbatim.
 */
export function classifyMetricKind(metricName: string | null | undefined): MetricKind {
  if (!metricName) return 'other';
  const name = metricName.toLowerCase();
  if (name.includes('capacity') || name.includes('throughput') || name.includes('nameplate')) return 'capacity';
  if (
    name.includes('production') ||
    name.includes('recovered') ||
    name.includes('output') ||
    name.includes('contained')
  ) {
    return 'production';
  }
  if (name.includes('resource') || name.includes('reserve')) return 'resource';
  return 'other';
}

/** Human label for assertion field names (free text, e.g. "mining_method"). */
export function formatFieldName(fieldName: string | null | undefined): string {
  return formatNodeType(fieldName);
}

/* ------------------------------------------------------------------ */
/* Events                                                              */
/* ------------------------------------------------------------------ */

export function formatSeverity(severity: number | null | undefined): string {
  if (severity === null || severity === undefined) return 'Unrated';
  const labels: Record<number, string> = {
    1: 'Minimal',
    2: 'Low',
    3: 'Moderate',
    4: 'High',
    5: 'Critical',
  };
  return labels[severity] ?? `Severity ${severity}`;
}

export function formatEventType(eventType: string | null | undefined): string {
  return formatNodeType(eventType);
}
