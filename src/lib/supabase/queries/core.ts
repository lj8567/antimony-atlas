import { cache } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getServerClient, UNCONFIGURED_MESSAGE } from '../server';
import {
  queryError,
  queryOk,
  type AssertionRow,
  type EdgeRow,
  type EntityRow,
  type EventRow,
  type NodeOwnershipRow,
  type NodeRow,
  type ObservationRow,
  type ProductFormRow,
  type QueryResult,
  type SourceRow,
  type TradeFlowRow,
} from '../types';

/**
 * Live-schema data access, per the backend hand-off brief:
 *
 *  - plain select("*") on base tables — no PostgREST embeds, so relationship
 *    naming can never fail (nodes has TWO FKs to entities, which makes bare
 *    embeds ambiguous: PGRST201);
 *  - all joins and ordering happen in memory at pilot scale;
 *  - tables that may not exist yet (edges, trade_flows) degrade to empty
 *    with a recorded warning instead of failing the page;
 *  - errors are never swallowed silently: required-table failures fail the
 *    page visibly, optional-table failures surface in `warnings`.
 */

const MISSING_TABLE_CODES = new Set(['42P01', 'PGRST205', 'PGRST200', 'PGRST202']);

interface TableFetch<T> {
  rows: T[];
  /** populated when the query failed for a reason other than a missing table */
  error: string | null;
  /** true when the table does not exist in the live schema */
  missing: boolean;
}

async function selectAll<T>(client: SupabaseClient, table: string, limit: number): Promise<TableFetch<T>> {
  const { data, error } = await client.from(table).select('*').limit(limit);
  if (error) {
    if (MISSING_TABLE_CODES.has(error.code ?? '')) {
      return { rows: [], error: null, missing: true };
    }
    return { rows: [], error: `${table}: ${error.message}${error.code ? ` (${error.code})` : ''}`, missing: false };
  }
  return { rows: (data ?? []) as T[], error: null, missing: false };
}

export interface AtlasData {
  nodes: NodeRow[];
  entities: EntityRow[];
  productForms: ProductFormRow[];
  sources: SourceRow[];
  assertions: AssertionRow[];
  observations: ObservationRow[];
  ownership: NodeOwnershipRow[];
  events: EventRow[];
  edges: EdgeRow[];
  tradeFlows: TradeFlowRow[];
  /** true when the trade_flows table exists in the live schema */
  tradeTableExists: boolean;
  /** true when the edges table exists in the live schema */
  edgeTableExists: boolean;
}

/**
 * Fetch the full pilot dataset (bounded) in one parallel pass. Deduplicated
 * per request via React cache so pages composing several views still hit
 * Supabase once. `nodes` failing is fatal; every other table degrades with a
 * warning so one broken grant cannot blank the whole product.
 */
export const fetchAtlasData = cache(async (): Promise<QueryResult<AtlasData>> => {
  const client = getServerClient();
  if (!client) return queryError(UNCONFIGURED_MESSAGE, true);

  try {
    const [nodes, entities, productForms, sources, assertions, observations, ownership, events, edges, tradeFlows] =
      await Promise.all([
        selectAll<NodeRow>(client, 'nodes', 2000),
        selectAll<EntityRow>(client, 'entities', 2000),
        selectAll<ProductFormRow>(client, 'product_forms', 200),
        selectAll<SourceRow>(client, 'sources', 2000),
        selectAll<AssertionRow>(client, 'assertions', 5000),
        selectAll<ObservationRow>(client, 'observations', 5000),
        selectAll<NodeOwnershipRow>(client, 'node_ownership', 2000),
        selectAll<EventRow>(client, 'events', 2000),
        selectAll<EdgeRow>(client, 'edges', 2000),
        selectAll<TradeFlowRow>(client, 'trade_flows', 5000),
      ]);

    if (nodes.error) return queryError(`Core node query failed — ${nodes.error}`);
    if (nodes.missing) return queryError('Core node query failed — the nodes table was not found in the schema.');

    const warnings: string[] = [];
    const optional: Array<[string, TableFetch<unknown>]> = [
      ['entities', entities],
      ['product_forms', productForms],
      ['sources', sources],
      ['assertions', assertions],
      ['observations', observations],
      ['node_ownership', ownership],
      ['events', events],
      ['edges', edges],
      ['trade_flows', tradeFlows],
    ];
    for (const [name, fetchResult] of optional) {
      if (fetchResult.error) warnings.push(`Could not load ${name} — ${fetchResult.error}`);
    }

    return queryOk(
      {
        nodes: nodes.rows,
        entities: entities.rows,
        productForms: productForms.rows,
        sources: sources.rows,
        assertions: assertions.rows,
        observations: observations.rows,
        ownership: ownership.rows,
        events: events.rows,
        edges: edges.rows,
        tradeFlows: tradeFlows.rows,
        tradeTableExists: !tradeFlows.missing,
        edgeTableExists: !edges.missing,
      },
      warnings,
    );
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : 'Unknown query failure';
    return queryError(`Supabase query failed: ${message}`);
  }
});
