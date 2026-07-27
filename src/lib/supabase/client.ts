import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Shared Supabase client factory. The app only ever uses the public anon key
 * (row-level security limits it to read-only SELECT); the service-role key
 * must never appear in this codebase.
 */

export function supabaseConfig(): { url: string; anonKey: string } | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;
  return { url, anonKey };
}

export function isSupabaseConfigured(): boolean {
  return supabaseConfig() !== null;
}

let browserClient: SupabaseClient | null = null;

/** Client for use in client components (browser). Reuses one instance. */
export function getBrowserClient(): SupabaseClient | null {
  const config = supabaseConfig();
  if (!config) return null;
  if (!browserClient) {
    browserClient = createClient(config.url, config.anonKey, {
      auth: { persistSession: false },
    });
  }
  return browserClient;
}
