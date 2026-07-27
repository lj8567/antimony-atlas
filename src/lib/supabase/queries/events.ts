import { queryOk, type EventDetail, type QueryResult } from '../types';
import { buildIndex, eventDetails } from './assemble';
import { fetchAtlasData } from './core';

/** All events with node and source context, newest first. */
export async function fetchEvents(): Promise<QueryResult<EventDetail[]>> {
  const result = await fetchAtlasData();
  if (!result.ok) return result;
  return queryOk(eventDetails(result.data, buildIndex(result.data)), result.warnings);
}
