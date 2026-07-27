/**
 * URL-driven filter state and the pure filtering/sorting logic behind the
 * asset, trade and event explorers. Kept free of React so it is directly
 * unit-testable; client components serialise this state into the query
 * string so filtered views are shareable and survive reloads.
 */

import { countryName } from './countries';
import { confidenceBand, supplyCategory, type ConfidenceBand } from './format';
import type { AssetListItem, EventDetail, NodeStatus, TradeFlowDetail } from './supabase/types';

/* ------------------------------------------------------------------ */
/* Generic URL param helpers                                           */
/* ------------------------------------------------------------------ */

export type ParamRecord = Record<string, string>;

/** Build a query string, omitting empty values; '' when nothing is set. */
export function toQueryString(params: ParamRecord): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== '') search.set(key, value);
  }
  const text = search.toString();
  return text ? `?${text}` : '';
}

function pick(params: URLSearchParams, key: string, allowed?: readonly string[]): string {
  const value = params.get(key) ?? '';
  if (allowed && !allowed.includes(value)) return '';
  return value;
}

export type SortDirection = 'asc' | 'desc';

function compareNullable(a: string | number | null, b: string | number | null): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1; // missing values sort last in either direction
  if (b === null) return -1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b));
}

/* ------------------------------------------------------------------ */
/* Asset explorer                                                      */
/* ------------------------------------------------------------------ */

export const ASSET_SORT_KEYS = ['name', 'country', 'type', 'status', 'confidence', 'reviewed'] as const;
export type AssetSortKey = (typeof ASSET_SORT_KEYS)[number];

export const SUPPLY_FILTER_VALUES = ['operating', 'prospective', 'inactive'] as const;

export interface AssetFilters {
  q: string;
  country: string;
  region: string;
  type: string;
  status: string;
  productForm: string;
  provenance: string;
  confidence: '' | ConfidenceBand;
  supply: '' | (typeof SUPPLY_FILTER_VALUES)[number];
  sort: AssetSortKey;
  dir: SortDirection;
}

export const DEFAULT_ASSET_FILTERS: AssetFilters = {
  q: '',
  country: '',
  region: '',
  type: '',
  status: '',
  productForm: '',
  provenance: '',
  confidence: '',
  supply: '',
  sort: 'name',
  dir: 'asc',
};

export function parseAssetFilters(params: URLSearchParams): AssetFilters {
  return {
    q: params.get('q') ?? '',
    country: params.get('country') ?? '',
    region: params.get('region') ?? '',
    type: params.get('type') ?? '',
    status: params.get('status') ?? '',
    productForm: params.get('form') ?? '',
    provenance: pick(params, 'provenance', ['reported', 'modelled', 'unverified']),
    confidence: pick(params, 'confidence', ['high', 'medium', 'low']) as AssetFilters['confidence'],
    supply: pick(params, 'supply', SUPPLY_FILTER_VALUES) as AssetFilters['supply'],
    sort: (pick(params, 'sort', ASSET_SORT_KEYS) || 'name') as AssetSortKey,
    dir: (pick(params, 'dir', ['asc', 'desc']) || 'asc') as SortDirection,
  };
}

export function serializeAssetFilters(filters: AssetFilters): ParamRecord {
  return {
    q: filters.q,
    country: filters.country,
    region: filters.region,
    type: filters.type,
    status: filters.status,
    form: filters.productForm,
    provenance: filters.provenance,
    confidence: filters.confidence,
    supply: filters.supply,
    sort: filters.sort === 'name' ? '' : filters.sort,
    dir: filters.dir === 'asc' ? '' : filters.dir,
  };
}

export function countActiveAssetFilters(filters: AssetFilters): number {
  const { q, country, region, type, status, productForm, provenance, confidence, supply } = filters;
  return [q, country, region, type, status, productForm, provenance, confidence, supply].filter(Boolean).length;
}

function matchesSupply(status: NodeStatus, supply: AssetFilters['supply']): boolean {
  if (!supply) return true;
  const category = supplyCategory(status);
  if (supply === 'operating') return category === 'operating';
  if (supply === 'prospective') return category === 'prospective';
  return category === 'inactive_or_uncertain';
}

export function filterAssets(items: AssetListItem[], filters: AssetFilters): AssetListItem[] {
  const query = filters.q.trim().toLowerCase();
  return items.filter((item) => {
    const { node } = item;
    if (filters.country && node.country_code !== filters.country) return false;
    if (filters.region && (node.region ?? '') !== filters.region) return false;
    if (filters.type && node.node_type !== filters.type) return false;
    if (filters.status && node.status !== filters.status) return false;
    if (filters.provenance && item.identity_provenance !== filters.provenance) return false;
    if (filters.confidence && confidenceBand(item.identity_confidence) !== filters.confidence) return false;
    if (!matchesSupply(node.status, filters.supply)) return false;
    if (filters.productForm) {
      if (item.latest_observation?.product_form?.product_form_id !== filters.productForm) return false;
    }
    if (query) {
      const haystack = [
        node.canonical_name,
        node.region ?? '',
        node.country_code,
        countryName(node.country_code),
        item.operator_name ?? '',
        ...item.owner_names,
      ]
        .join(' ')
        .toLowerCase();
      if (!haystack.includes(query)) return false;
    }
    return true;
  });
}

export function sortAssets(items: AssetListItem[], sort: AssetSortKey, dir: SortDirection): AssetListItem[] {
  const factor = dir === 'desc' ? -1 : 1;
  const value = (item: AssetListItem): string | number | null => {
    switch (sort) {
      case 'name':
        return item.node.canonical_name;
      case 'country':
        return countryName(item.node.country_code);
      case 'type':
        return item.node.node_type;
      case 'status':
        return item.node.status;
      case 'confidence':
        return item.identity_confidence;
      case 'reviewed':
        return item.node.last_reviewed_at;
    }
  };
  return [...items].sort((a, b) => {
    const base = compareNullable(value(a), value(b));
    // missing values stay last regardless of direction
    if (value(a) === null || value(b) === null) return base;
    return base * factor;
  });
}

/* ------------------------------------------------------------------ */
/* Trade explorer                                                      */
/* ------------------------------------------------------------------ */

export const TRADE_SORT_KEYS = ['period', 'value', 'weight', 'exporter', 'importer'] as const;
export type TradeSortKey = (typeof TRADE_SORT_KEYS)[number];

export interface TradeFilters {
  form: string;
  exporter: string;
  importer: string;
  reporter: string;
  year: string;
  provenance: string;
  minValueUsd: string;
  sort: TradeSortKey;
  dir: SortDirection;
}

export const DEFAULT_TRADE_FILTERS: TradeFilters = {
  form: '',
  exporter: '',
  importer: '',
  reporter: '',
  year: '',
  provenance: '',
  minValueUsd: '',
  sort: 'period',
  dir: 'desc',
};

export function parseTradeFilters(params: URLSearchParams): TradeFilters {
  return {
    form: params.get('form') ?? '',
    exporter: params.get('exporter') ?? '',
    importer: params.get('importer') ?? '',
    reporter: params.get('reporter') ?? '',
    year: params.get('year') ?? '',
    provenance: pick(params, 'provenance', ['reported', 'modelled', 'unverified']),
    minValueUsd: params.get('min') ?? '',
    sort: (pick(params, 'sort', TRADE_SORT_KEYS) || 'period') as TradeSortKey,
    dir: (pick(params, 'dir', ['asc', 'desc']) || 'desc') as SortDirection,
  };
}

export function serializeTradeFilters(filters: TradeFilters): ParamRecord {
  return {
    form: filters.form,
    exporter: filters.exporter,
    importer: filters.importer,
    reporter: filters.reporter,
    year: filters.year,
    provenance: filters.provenance,
    min: filters.minValueUsd,
    sort: filters.sort === 'period' ? '' : filters.sort,
    dir: filters.dir === 'desc' ? '' : filters.dir,
  };
}

export function filterTradeFlows(flows: TradeFlowDetail[], filters: TradeFilters): TradeFlowDetail[] {
  const minValue = Number(filters.minValueUsd);
  return flows.filter((flow) => {
    if (filters.form && flow.product_form_id !== filters.form) return false;
    if (filters.exporter && flow.exporter_code !== filters.exporter) return false;
    if (filters.importer && flow.importer_code !== filters.importer) return false;
    if (filters.reporter && flow.reporter_code !== filters.reporter) return false;
    if (filters.year && !flow.period_start.startsWith(filters.year)) return false;
    if (filters.provenance && flow.provenance !== filters.provenance) return false;
    if (filters.minValueUsd && Number.isFinite(minValue)) {
      if (flow.trade_value_usd === null || flow.trade_value_usd < minValue) return false;
    }
    return true;
  });
}

export function sortTradeFlows(flows: TradeFlowDetail[], sort: TradeSortKey, dir: SortDirection): TradeFlowDetail[] {
  const factor = dir === 'desc' ? -1 : 1;
  const value = (flow: TradeFlowDetail): string | number | null => {
    switch (sort) {
      case 'period':
        return flow.period_start;
      case 'value':
        return flow.trade_value_usd;
      case 'weight':
        return flow.gross_weight_kg;
      case 'exporter':
        return countryName(flow.exporter_code);
      case 'importer':
        return countryName(flow.importer_code);
    }
  };
  return [...flows].sort((a, b) => {
    const base = compareNullable(value(a), value(b));
    if (value(a) === null || value(b) === null) return base;
    return base * factor;
  });
}

/* ------------------------------------------------------------------ */
/* Event monitor                                                       */
/* ------------------------------------------------------------------ */

export interface EventFilters {
  q: string;
  type: string;
  country: string;
  minSeverity: string;
  year: string;
}

export const DEFAULT_EVENT_FILTERS: EventFilters = {
  q: '',
  type: '',
  country: '',
  minSeverity: '',
  year: '',
};

export function parseEventFilters(params: URLSearchParams): EventFilters {
  return {
    q: params.get('q') ?? '',
    type: params.get('type') ?? '',
    country: params.get('country') ?? '',
    minSeverity: pick(params, 'severity', ['1', '2', '3', '4', '5']),
    year: params.get('year') ?? '',
  };
}

export function serializeEventFilters(filters: EventFilters): ParamRecord {
  return {
    q: filters.q,
    type: filters.type,
    country: filters.country,
    severity: filters.minSeverity,
    year: filters.year,
  };
}

export function filterEvents(events: EventDetail[], filters: EventFilters): EventDetail[] {
  const query = filters.q.trim().toLowerCase();
  const minSeverity = Number(filters.minSeverity);
  return events.filter((event) => {
    if (filters.type && event.event_type !== filters.type) return false;
    if (filters.country) {
      const impactCountries = event.impacts.map((impact) => impact.node?.country_code).filter(Boolean);
      if (event.country_code !== filters.country && !impactCountries.includes(filters.country)) return false;
    }
    if (filters.minSeverity) {
      if (event.severity === null || event.severity < minSeverity) return false;
    }
    if (filters.year && !(event.announced_at ?? '').startsWith(filters.year)) return false;
    if (query) {
      const haystack = [
        event.headline,
        event.description ?? '',
        ...event.impacts.map((impact) => impact.node?.canonical_name ?? ''),
      ]
        .join(' ')
        .toLowerCase();
      if (!haystack.includes(query)) return false;
    }
    return true;
  });
}
