import { withServerClient } from '../server';
import { queryError, type ProductFormRow, type QueryResult, type TradeFlowDetail } from '../types';
import { SOURCE_REF_SELECT } from './fragments';

export interface TradeData {
  flows: TradeFlowDetail[];
  productForms: ProductFormRow[];
  /** true when the row limit was hit and older periods may be truncated */
  truncated: boolean;
}

const TRADE_LIMIT = 2000;

/**
 * Trade flows (newest period first, bounded) plus the product-form register
 * so filters can show every HS category even before flows exist for it.
 */
export async function fetchTradeData(): Promise<QueryResult<TradeData>> {
  return withServerClient(async (client) => {
    const [flowsRes, formsRes] = await Promise.all([
      client
        .from('trade_flows')
        .select(
          `*, product_form:product_forms!product_form_id(product_form_id, name, hs_code), source:sources!source_id(${SOURCE_REF_SELECT})`,
        )
        .order('period_start', { ascending: false })
        .limit(TRADE_LIMIT)
        .returns<TradeFlowDetail[]>(),
      client.from('product_forms').select('*').order('name').returns<ProductFormRow[]>(),
    ]);

    const firstError = flowsRes.error ?? formsRes.error;
    if (firstError) return queryError(`Trade query failed: ${firstError.message}`);

    const flows = flowsRes.data ?? [];
    return {
      ok: true,
      data: { flows, productForms: formsRes.data ?? [], truncated: flows.length >= TRADE_LIMIT },
    };
  });
}
