import { queryOk, type AssetListItem, type QueryResult } from '../types';
import { buildAssetList } from './assemble';
import { fetchAtlasData } from './core';

/** Full asset register assembled from nodes + entities + claims + events. */
export async function fetchAssetList(): Promise<QueryResult<AssetListItem[]>> {
  const result = await fetchAtlasData();
  if (!result.ok) return result;
  return queryOk(buildAssetList(result.data), result.warnings);
}
