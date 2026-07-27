/**
 * Shared PostgREST select fragments. FK column hints (e.g. sources!source_id)
 * disambiguate embedded relations; keep these in sync with the migrations.
 */

export const SOURCE_REF_SELECT = 'source_id, title, publisher, source_type, publication_date, url, licence';

export const ASSERTION_WITH_SOURCE_SELECT = `assertion_id, claim_text, page_reference, table_reference, provenance, confidence_score, reviewed_at, source:sources!source_id(${SOURCE_REF_SELECT})`;

export const OBSERVATION_DETAIL_SELECT = `*, metric:metrics!metric_id(metric_id, name, definition, canonical_unit), product_form:product_forms!product_form_id(product_form_id, name, hs_code), assertion:assertions!assertion_id(${ASSERTION_WITH_SOURCE_SELECT})`;

export const EDGE_ENDPOINT_SELECT = 'node_id, canonical_name, node_type, status, country_code, latitude, longitude';

export const EDGE_DETAIL_SELECT = `*, from_node:nodes!from_node_id(${EDGE_ENDPOINT_SELECT}), to_node:nodes!to_node_id(${EDGE_ENDPOINT_SELECT}), product_form:product_forms!product_form_id(product_form_id, name), assertion:assertions!primary_assertion_id(${ASSERTION_WITH_SOURCE_SELECT})`;

export const EVENT_DETAIL_SELECT = `*, assertion:assertions!source_assertion_id(${ASSERTION_WITH_SOURCE_SELECT}), impacts:event_impacts(event_id, node_id, edge_id, impact_type, impact_direction, confidence_score, node:nodes!node_id(node_id, canonical_name, node_type, country_code))`;
