import { createClient } from '@supabase/supabase-js';
import type { PublicNode } from './types';
import seed from '../../data/nodes.seed.json';

export async function getPublicNodes(): Promise<PublicNode[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return seed as PublicNode[];

  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const { data, error } = await supabase.from('public_nodes').select('*').order('canonical_name');
  if (error || !data) {
    console.error('Supabase query failed; using seed data.', error);
    return seed as PublicNode[];
  }
  return data as PublicNode[];
}
