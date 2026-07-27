import { withServerClient } from '../server';
import { queryError, type EventDetail, type QueryResult } from '../types';
import { EVENT_DETAIL_SELECT } from './fragments';

/** All events with source assertion and impacted nodes, newest first. */
export async function fetchEvents(): Promise<QueryResult<EventDetail[]>> {
  return withServerClient(async (client) => {
    const { data, error } = await client
      .from('events')
      .select(EVENT_DETAIL_SELECT)
      .order('announced_at', { ascending: false, nullsFirst: false })
      .limit(1000)
      .returns<EventDetail[]>();
    if (error) return queryError(`Event query failed: ${error.message}`);
    return { ok: true, data: data ?? [] };
  });
}
