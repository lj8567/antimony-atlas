import { queryOk, type AssetListItem, type EventDetail, type QueryResult } from '../types';
import { buildAssetList, buildIndex, eventDetails } from './assemble';
import { fetchAtlasData } from './core';

export interface OverviewData {
  assets: AssetListItem[];
  recentEvents: EventDetail[];
  sourceCount: number;
  /** total claims (assertions + observations) on file */
  claimCount: number;
  tradeFlowCount: number;
  tradeTableExists: boolean;
}

export async function fetchOverviewData(): Promise<QueryResult<OverviewData>> {
  const result = await fetchAtlasData();
  if (!result.ok) return result;
  const data = result.data;
  const index = buildIndex(data);

  return queryOk(
    {
      assets: buildAssetList(data, index),
      recentEvents: eventDetails(data, index).slice(0, 8),
      sourceCount: data.sources.length,
      claimCount: data.assertions.length + data.observations.length,
      tradeFlowCount: data.tradeFlows.length,
      tradeTableExists: data.tradeTableExists,
    },
    result.warnings,
  );
}
