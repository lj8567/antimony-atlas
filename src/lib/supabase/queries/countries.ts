import { queryOk, type AssetListItem, type EventDetail, type QueryResult, type TradeFlowDetail } from '../types';
import { buildAssetList, buildIndex, eventDetails, tradeFlowDetails } from './assemble';
import { fetchAtlasData } from './core';

export interface CountrySummaryData {
  assets: AssetListItem[];
  events: EventDetail[];
  tradeCountries: Array<{ exporter_code: string; importer_code: string }>;
  /** nodes with no country code recorded */
  unallocatedNodes: number;
}

export async function fetchCountrySummaryData(): Promise<QueryResult<CountrySummaryData>> {
  const result = await fetchAtlasData();
  if (!result.ok) return result;
  const data = result.data;
  const index = buildIndex(data);
  return queryOk(
    {
      assets: buildAssetList(data, index),
      events: eventDetails(data, index),
      tradeCountries: data.tradeFlows.map((flow) => ({
        exporter_code: flow.exporter_code,
        importer_code: flow.importer_code,
      })),
      unallocatedNodes: data.nodes.filter((node) => !node.country_code).length,
    },
    result.warnings,
  );
}

export interface CountryDetailData {
  assets: AssetListItem[];
  /** events on nodes in this country (events carry no country of their own) */
  events: EventDetail[];
  tradeFlows: TradeFlowDetail[];
  tradeTableExists: boolean;
}

export async function fetchCountryDetail(countryCode: string): Promise<QueryResult<CountryDetailData>> {
  const code = countryCode.trim().toUpperCase();
  const result = await fetchAtlasData();
  if (!result.ok) return result;
  const data = result.data;
  const index = buildIndex(data);

  const assets = buildAssetList(data, index).filter((item) => item.node.country_code === code);
  const nodeIds = new Set(assets.map((item) => item.node.node_id));

  return queryOk(
    {
      assets,
      events: eventDetails(data, index).filter((event) => event.node_id !== null && nodeIds.has(event.node_id)),
      tradeFlows: tradeFlowDetails(data, index).filter(
        (flow) => flow.exporter_code === code || flow.importer_code === code,
      ),
      tradeTableExists: data.tradeTableExists,
    },
    result.warnings,
  );
}
