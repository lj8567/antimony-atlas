import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { supabaseConfig } from './client';
import { queryError, type QueryResult } from './types';

/**
 * Server-side Supabase access. A fresh lightweight client per request scope;
 * anon key + RLS only, no session state, no service-role key.
 */
export function getServerClient(): SupabaseClient | null {
  const config = supabaseConfig();
  if (!config) return null;
  return createClient(config.url, config.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export const UNCONFIGURED_MESSAGE =
  'Supabase connection is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.';

/**
 * Run a query body with a guaranteed client, translating a missing
 * configuration or a thrown/network failure into a typed error result that
 * pages can render honestly instead of crashing.
 */
export async function withServerClient<T>(
  run: (client: SupabaseClient) => Promise<QueryResult<T>>,
): Promise<QueryResult<T>> {
  const client = getServerClient();
  if (!client) return queryError(UNCONFIGURED_MESSAGE, true);
  try {
    return await run(client);
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : 'Unknown query failure';
    return queryError(`Supabase query failed: ${message}`);
  }
}
