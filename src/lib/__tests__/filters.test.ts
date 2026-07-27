import { describe, expect, it } from 'vitest';
import {
  DEFAULT_ASSET_FILTERS,
  filterAssets,
  filterEvents,
  filterTradeFlows,
  parseAssetFilters,
  parseTradeFilters,
  serializeAssetFilters,
  sortAssets,
  sortTradeFlows,
  toQueryString,
} from '@/lib/filters';
import { costerfield, makeAsset, sampleEvent, sampleTradeFlow } from '@/test/fixtures';

const stibnite = makeAsset();
const items = [stibnite, costerfield];

describe('asset filter URL state', () => {
  it('round-trips through the query string', () => {
    const filters = {
      ...DEFAULT_ASSET_FILTERS,
      q: 'stibnite',
      country: 'USA',
      supply: 'prospective' as const,
      confidence: 'medium' as const,
      sort: 'confidence' as const,
      dir: 'desc' as const,
    };
    const qs = toQueryString(serializeAssetFilters(filters));
    const parsed = parseAssetFilters(new URLSearchParams(qs));
    expect(parsed).toEqual(filters);
  });

  it('ignores invalid enum values from the URL', () => {
    const parsed = parseAssetFilters(new URLSearchParams('?provenance=bogus&confidence=extreme&sort=hack'));
    expect(parsed.provenance).toBe('');
    expect(parsed.confidence).toBe('');
    expect(parsed.sort).toBe('name');
  });

  it('omits defaults from the query string', () => {
    expect(toQueryString(serializeAssetFilters(DEFAULT_ASSET_FILTERS))).toBe('');
  });
});

describe('filterAssets', () => {
  it('searches names, aliases, regions, owners and country names', () => {
    expect(filterAssets(items, { ...DEFAULT_ASSET_FILTERS, q: 'idaho' })).toEqual([stibnite]);
    expect(filterAssets(items, { ...DEFAULT_ASSET_FILTERS, q: 'alkane' })).toEqual([costerfield]);
    expect(filterAssets(items, { ...DEFAULT_ASSET_FILTERS, q: 'australia' })).toEqual([costerfield]);
    // alias search
    expect(filterAssets(items, { ...DEFAULT_ASSET_FILTERS, q: 'stibnite' })).toEqual([stibnite]);
  });
  it('filters by country, type, status and supply category (statuses are live enum values)', () => {
    expect(filterAssets(items, { ...DEFAULT_ASSET_FILTERS, country: 'AUS' })).toEqual([costerfield]);
    expect(filterAssets(items, { ...DEFAULT_ASSET_FILTERS, type: 'mine_and_concentrator' })).toEqual([costerfield]);
    expect(filterAssets(items, { ...DEFAULT_ASSET_FILTERS, status: 'construction' })).toEqual([stibnite]);
    expect(filterAssets(items, { ...DEFAULT_ASSET_FILTERS, supply: 'operating' })).toEqual([costerfield]);
    expect(filterAssets(items, { ...DEFAULT_ASSET_FILTERS, supply: 'prospective' })).toEqual([stibnite]);
    // a made-up status like "active" matches nothing
    expect(filterAssets(items, { ...DEFAULT_ASSET_FILTERS, status: 'active' })).toEqual([]);
  });
  it('filters by evidence provenance and max-confidence band', () => {
    // stibnite has modelled claims; costerfield does not
    expect(filterAssets(items, { ...DEFAULT_ASSET_FILTERS, provenance: 'modelled' })).toEqual([stibnite]);
    expect(filterAssets(items, { ...DEFAULT_ASSET_FILTERS, provenance: 'reported' })).toHaveLength(2);
    expect(filterAssets(items, { ...DEFAULT_ASSET_FILTERS, confidence: 'high' })).toEqual([costerfield]);
    expect(filterAssets(items, { ...DEFAULT_ASSET_FILTERS, confidence: 'medium' })).toEqual([stibnite]);
  });
});

describe('sortAssets', () => {
  it('sorts by max confidence descending', () => {
    const sorted = sortAssets(items, 'confidence', 'desc');
    expect(sorted[0]).toBe(costerfield);
  });
  it('keeps missing values last in either direction', () => {
    const noConfidence = makeAsset(
      { node_id: '33333333-3333-4333-8333-333333333333', name: 'Mystery' },
      { max_confidence: null },
    );
    const sorted = sortAssets([noConfidence, ...items], 'confidence', 'desc');
    expect(sorted.at(-1)).toBe(noConfidence);
    const sortedAsc = sortAssets([noConfidence, ...items], 'confidence', 'asc');
    expect(sortedAsc.at(-1)).toBe(noConfidence);
  });
});

describe('trade filters', () => {
  it('filters by year, provenance and minimum value', () => {
    const flows = [sampleTradeFlow];
    expect(filterTradeFlows(flows, { ...parseTradeFilters(new URLSearchParams()), year: '2024' })).toHaveLength(1);
    expect(filterTradeFlows(flows, { ...parseTradeFilters(new URLSearchParams()), year: '2023' })).toHaveLength(0);
    expect(filterTradeFlows(flows, { ...parseTradeFilters(new URLSearchParams()), minValueUsd: '10000000' })).toHaveLength(0);
    expect(filterTradeFlows(flows, { ...parseTradeFilters(new URLSearchParams()), provenance: 'modelled' })).toHaveLength(0);
  });
  it('sorts by value with missing values last', () => {
    const noValue = { ...sampleTradeFlow, trade_flow_id: 'flow-2', trade_value_usd: null };
    const sorted = sortTradeFlows([noValue, sampleTradeFlow], 'value', 'desc');
    expect(sorted[0]).toBe(sampleTradeFlow);
    expect(sorted.at(-1)).toBe(noValue);
  });
});

describe('event filters', () => {
  const base = { q: '', type: '', country: '', minSeverity: '', year: '' };
  it('matches country via the linked node (events carry no country of their own)', () => {
    expect(filterEvents([sampleEvent], { ...base, country: 'USA' })).toHaveLength(1);
    expect(filterEvents([sampleEvent], { ...base, country: 'AUS' })).toHaveLength(0);
  });
  it('applies minimum severity and excludes unrated events', () => {
    expect(filterEvents([sampleEvent], { ...base, minSeverity: '3' })).toHaveLength(1);
    const unrated = { ...sampleEvent, event_id: 'event-2', severity: null };
    expect(filterEvents([unrated], { ...base, minSeverity: '3' })).toHaveLength(0);
  });
  it('filters by event_date year and searches title/summary/asset name', () => {
    expect(filterEvents([sampleEvent], { ...base, year: '2025' })).toHaveLength(1);
    expect(filterEvents([sampleEvent], { ...base, year: '2024' })).toHaveLength(0);
    expect(filterEvents([sampleEvent], { ...base, q: 'stibnite' })).toHaveLength(1);
    expect(filterEvents([sampleEvent], { ...base, q: 'record of decision' })).toHaveLength(1);
  });
});
