import { queryOk, type QueryResult, type SourceListItem } from '../types';
import { buildSourceList } from './assemble';
import { fetchAtlasData } from './core';

/** Source register with the claims each source supports. */
export async function fetchSources(): Promise<QueryResult<SourceListItem[]>> {
  const result = await fetchAtlasData();
  if (!result.ok) return result;
  return queryOk(buildSourceList(result.data), result.warnings);
}
