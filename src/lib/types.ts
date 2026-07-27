export type ProvenanceClass = 'reported' | 'modelled' | 'unverified';

export interface PublicNode {
  node_id: string;
  canonical_name: string;
  node_type: string;
  status: string;
  country_code: string;
  latitude: number;
  longitude: number;
  provenance_class: ProvenanceClass;
  confidence_score: number;
}
