import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { supabaseConfig } from './client';

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
