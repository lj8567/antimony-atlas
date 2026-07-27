import { describe, expect, it } from 'vitest';
import { countryCentroid, countryName, isKnownCountry } from '@/lib/countries';

describe('countryName', () => {
  it('maps ISO alpha-3 codes to display names', () => {
    expect(countryName('USA')).toBe('United States');
    expect(countryName('AUS')).toBe('Australia');
    expect(countryName('TUR')).toBe('Türkiye');
  });
  it('falls back to the raw code for unknown values', () => {
    expect(countryName('XYZ')).toBe('XYZ');
  });
  it('labels missing codes', () => {
    expect(countryName(null)).toBe('Not reported');
    expect(countryName(undefined)).toBe('Not reported');
  });
  it('is case- and whitespace-tolerant', () => {
    expect(countryName(' usa ')).toBe('United States');
  });
});

describe('countryCentroid', () => {
  it('returns lon/lat pairs for catalogued countries', () => {
    const centroid = countryCentroid('USA');
    expect(centroid).not.toBeNull();
    expect(centroid![0]).toBeCloseTo(-98.6, 0);
  });
  it('returns null when not catalogued', () => {
    expect(countryCentroid('XYZ')).toBeNull();
    expect(isKnownCountry('XYZ')).toBe(false);
  });
});
