import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchAssetDetail } from '@/lib/supabase/queries/asset-detail';
import { fetchAssetList } from '@/lib/supabase/queries/assets';

describe('query modules without Supabase configuration', () => {
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', '');
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns a typed unconfigured error instead of placeholder data', async () => {
    const result = await fetchAssetList();
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.unconfigured).toBe(true);
      expect(result.error).toContain('NEXT_PUBLIC_SUPABASE_URL');
    }
  });

  it('treats a non-UUID asset id as not-found without querying', async () => {
    const result = await fetchAssetDetail('not-a-uuid');
    expect(result).toEqual({ ok: true, data: null });
  });
});
