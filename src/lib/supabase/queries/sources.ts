import { withServerClient } from '../server';
import { queryError, type QueryResult, type SourceListItem } from '../types';

/**
 * Source register with the assertions each source supports and the nodes
 * those assertions attach to — the provenance spine of the product.
 */
export async function fetchSources(): Promise<QueryResult<SourceListItem[]>> {
  return withServerClient(async (client) => {
    const { data, error } = await client
      .from('sources')
      .select(
        `*, assertions:assertions!source_id(assertion_id, provenance, confidence_score, claim_text, node_assertions(field_name, node:nodes!node_id(node_id, canonical_name)))`,
      )
      .order('publication_date', { ascending: false, nullsFirst: false })
      .limit(1000)
      .returns<SourceListItem[]>();
    if (error) return queryError(`Source query failed: ${error.message}`);
    return { ok: true, data: data ?? [] };
  });
}
