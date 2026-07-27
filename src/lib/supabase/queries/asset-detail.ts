import {
  queryOk,
  type AssertionDetail,
  type AssetListItem,
  type EdgeDetail,
  type EventDetail,
  type NodeRow,
  type ObservationDetail,
  type OwnershipDetail,
  type QueryResult,
} from '../types';
import {
  assertionDetails,
  buildAssetList,
  buildIndex,
  edgeDetails,
  eventDetails,
  ownershipDetails,
} from './assemble';
import { fetchAtlasData } from './core';

export interface AssetDetail {
  node: NodeRow;
  summary: AssetListItem;
  owner: { entity_id: string; legal_name: string; website: string | null } | null;
  operator: { entity_id: string; legal_name: string; website: string | null } | null;
  assertions: AssertionDetail[];
  observations: ObservationDetail[];
  ownership: OwnershipDetail[];
  events: EventDetail[];
  edges: EdgeDetail[];
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function fetchAssetDetail(nodeId: string): Promise<QueryResult<AssetDetail | null>> {
  if (!UUID_PATTERN.test(nodeId)) return queryOk(null);

  const result = await fetchAtlasData();
  if (!result.ok) return result;
  const data = result.data;
  const index = buildIndex(data);

  const node = index.nodeById.get(nodeId);
  if (!node) return queryOk(null, result.warnings);

  const summary = buildAssetList(data, index).find((item) => item.node.node_id === nodeId);
  const entityRef = (entityId: string | null) => {
    const entity = entityId ? index.entityById.get(entityId) : undefined;
    return entity ? { entity_id: entity.entity_id, legal_name: entity.legal_name, website: entity.website } : null;
  };

  return queryOk(
    {
      node,
      summary: summary!,
      owner: entityRef(node.owner_entity_id),
      operator: entityRef(node.operator_entity_id),
      assertions: assertionDetails(index.assertionsByNode.get(nodeId) ?? [], index),
      observations: index.observationsByNode.get(nodeId) ?? [],
      ownership: ownershipDetails(data, index, nodeId),
      events: eventDetails(data, index, nodeId),
      edges: edgeDetails(data, index).filter((edge) => edge.from_node_id === nodeId || edge.to_node_id === nodeId),
    },
    result.warnings,
  );
}
