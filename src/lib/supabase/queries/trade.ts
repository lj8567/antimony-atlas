import { queryOk, type ProductFormRow, type QueryResult, type TradeFlowDetail } from '../types';
import { buildIndex, tradeFlowDetails } from './assemble';
import { fetchAtlasData } from './core';

export interface TradeData {
  flows: TradeFlowDetail[];
  productForms: ProductFormRow[];
  /** false when the trade_flows table does not exist in the live schema yet */
  tableExists: boolean;
}

export async function fetchTradeData(): Promise<QueryResult<TradeData>> {
  const result = await fetchAtlasData();
  if (!result.ok) return result;
  return queryOk(
    {
      flows: tradeFlowDetails(result.data, buildIndex(result.data)),
      productForms: [...result.data.productForms].sort((a, b) => a.name.localeCompare(b.name)),
      tableExists: result.data.tradeTableExists,
    },
    result.warnings,
  );
}
