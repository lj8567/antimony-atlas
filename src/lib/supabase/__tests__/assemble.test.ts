import { describe, expect, it } from 'vitest';
import {
  buildAssetList,
  buildIndex,
  buildSourceList,
  countEvidence,
  eventDetails,
  pickPrincipalObservation,
} from '@/lib/supabase/queries/assemble';
import { atlasFixture, STIBNITE_ID } from '@/test/fixtures';

describe('buildAssetList (live schema assembly)', () => {
  const items = buildAssetList(atlasFixture);
  const stibnite = items.find((item) => item.node.node_id === STIBNITE_ID)!;

  it('joins owner and operator names from entities in memory', () => {
    expect(stibnite.owner_name).toBe('Perpetua Resources Corp.');
    const costerfield = items.find((item) => item.node.name === 'Costerfield Operation')!;
    expect(costerfield.owner_name).toBe('Alkane Resources Limited');
  });

  it('derives location precision from the location_precision assertion', () => {
    expect(stibnite.location_precision).toBe('approximate');
  });

  it('counts evidence by provenance without merging classes', () => {
    // 3 assertions (2 reported + 1 modelled) + 4 observations (3 reported + 1 modelled)
    expect(stibnite.evidence).toEqual({ reported: 5, modelled: 2, unverified: 0 });
  });

  it('normalises mixed confidence scales to 0-100 and reports the max', () => {
    // highest stored value is 0.9 (fraction) → 90
    expect(stibnite.max_confidence).toBe(90);
  });

  it('classifies metric kinds for coverage flags', () => {
    expect(stibnite.metric_kinds).toContain('production');
    expect(stibnite.metric_kinds).toContain('capacity');
    expect(stibnite.metric_kinds).toContain('resource');
  });
});

describe('pickPrincipalObservation', () => {
  const index = buildIndex(atlasFixture);
  const observations = index.observationsByNode.get(STIBNITE_ID)!;

  it('prefers actual production in contained-tonnes over pounds, capacity and resources', () => {
    const principal = pickPrincipalObservation(observations);
    expect(principal?.metric_name).toBe('antimony_production');
    expect(principal?.unit).toBe('tonnes Sb contained');
    // the modelled tonnes conversion, not the reported pounds twin — and never a sum
    expect(principal?.value_numeric).toBe(639.1);
    expect(principal?.provenance).toBe('modelled');
  });

  it('falls back to capacity when no production metric exists', () => {
    const withoutProduction = observations.filter((obs) => obs.metric_name !== 'antimony_production');
    const principal = pickPrincipalObservation(withoutProduction);
    expect(principal?.metric_name).toBe('processing_design_capacity');
  });

  it('returns null for empty input', () => {
    expect(pickPrincipalObservation([])).toBeNull();
  });
});

describe('eventDetails', () => {
  it('links events to nodes and sources by id', () => {
    const events = eventDetails(atlasFixture, buildIndex(atlasFixture));
    expect(events).toHaveLength(1);
    expect(events[0].node?.name).toBe('Stibnite Gold Project');
    expect(events[0].source?.publisher).toBe('Perpetua Resources Corp.');
  });
});

describe('buildSourceList', () => {
  it('lists the claims each source supports with node context', () => {
    const sources = buildSourceList(atlasFixture);
    expect(sources).toHaveLength(1);
    const supports = sources[0].supports;
    // 2 sourced assertions + 4 observations + 1 ownership + 1 event (location_precision has no source)
    expect(supports).toHaveLength(8);
    expect(supports.some((claim) => claim.kind === 'Ownership')).toBe(true);
    expect(supports.every((claim) => claim.node_name === 'Stibnite Gold Project')).toBe(true);
  });
});

describe('countEvidence', () => {
  it('is a pure count with no judgement', () => {
    expect(countEvidence([], [])).toEqual({ reported: 0, modelled: 0, unverified: 0 });
  });
});
