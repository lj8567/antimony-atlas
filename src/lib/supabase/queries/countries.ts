import { withServerClient } from '../server';
import {
  queryError,
  type EventDetail,
  type NodeRow,
  type ObservationDetail,
  type QueryResult,
  type TradeFlowDetail,
} from '../types';
import { EVENT_DETAIL_SELECT, OBSERVATION_DETAIL_SELECT, SOURCE_REF_SELECT } from './fragments';

export type NodeSummary = Pick<
  NodeRow,
  'node_id' | 'canonical_name' | 'node_type' | 'status' | 'country_code' | 'region' | 'last_reviewed_at'
>;

export interface CountrySummaryData {
  nodes: NodeSummary[];
  events: Array<{ event_id: string; country_code: string | null; severity: number | null; announced_at: string | null }>;
  tradeCountries: Array<{ exporter_code: string; importer_code: string }>;
}

/** Minimal data needed to derive the country index in memory. */
export async function fetchCountrySummaryData(): Promise<QueryResult<CountrySummaryData>> {
  return withServerClient(async (client) => {
    const [nodesRes, eventsRes, tradeRes] = await Promise.all([
      client
        .from('nodes')
        .select('node_id, canonical_name, node_type, status, country_code, region, last_reviewed_at')
        .limit(2000)
        .returns<NodeSummary[]>(),
      client
        .from('events')
        .select('event_id, country_code, severity, announced_at')
        .limit(2000)
        .returns<CountrySummaryData['events']>(),
      client
        .from('trade_flows')
        .select('exporter_code, importer_code')
        .limit(5000)
        .returns<CountrySummaryData['tradeCountries']>(),
    ]);
    const firstError = nodesRes.error ?? eventsRes.error ?? tradeRes.error;
    if (firstError) return queryError(`Country query failed: ${firstError.message}`);
    return {
      ok: true,
      data: {
        nodes: nodesRes.data ?? [],
        events: eventsRes.data ?? [],
        tradeCountries: tradeRes.data ?? [],
      },
    };
  });
}

export interface CountryExtras {
  /** country-level observations (observations.country_code = code) */
  observations: ObservationDetail[];
  /** events tagged with this country code */
  events: EventDetail[];
  /** trade flows where the country is exporter or importer */
  tradeFlows: TradeFlowDetail[];
}

export async function fetchCountryExtras(countryCode: string): Promise<QueryResult<CountryExtras>> {
  const code = countryCode.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(code)) return { ok: true, data: { observations: [], events: [], tradeFlows: [] } };

  return withServerClient(async (client) => {
    const [obsRes, eventsRes, tradeRes] = await Promise.all([
      client
        .from('observations')
        .select(OBSERVATION_DETAIL_SELECT)
        .eq('country_code', code)
        .order('period_end', { ascending: false })
        .limit(500)
        .returns<ObservationDetail[]>(),
      client
        .from('events')
        .select(EVENT_DETAIL_SELECT)
        .eq('country_code', code)
        .order('announced_at', { ascending: false, nullsFirst: false })
        .limit(200)
        .returns<EventDetail[]>(),
      client
        .from('trade_flows')
        .select(
          `*, product_form:product_forms!product_form_id(product_form_id, name, hs_code), source:sources!source_id(${SOURCE_REF_SELECT})`,
        )
        .or(`exporter_code.eq.${code},importer_code.eq.${code}`)
        .order('period_start', { ascending: false })
        .limit(1000)
        .returns<TradeFlowDetail[]>(),
    ]);
    const firstError = obsRes.error ?? eventsRes.error ?? tradeRes.error;
    if (firstError) return queryError(`Country detail query failed: ${firstError.message}`);
    return {
      ok: true,
      data: {
        observations: obsRes.data ?? [],
        events: eventsRes.data ?? [],
        tradeFlows: tradeRes.data ?? [],
      },
    };
  });
}
