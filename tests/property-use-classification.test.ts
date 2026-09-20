import { describe, expect, it } from 'vitest';
import { canonicalBbl, chicagoUnknownPropertyUse, classifyNycPropertyUse } from '../src/sources/nyc-property-use.js';

describe('NYC PLUTO property-use classification', () => {
  it('canonicalizes only decimal-safe BBL identities without numeric coercion', () => {
    expect(canonicalBbl('1000010001.00000000')).toBe('1000010001');
    expect(canonicalBbl('1')).toBe('0000000001');
    expect(canonicalBbl('0000000000')).toBeNull();
    expect(canonicalBbl('1000010001.5')).toBeNull();
    expect(canonicalBbl(1_000_010_001)).toBe('1000010001');
    expect(canonicalBbl(Number.MAX_SAFE_INTEGER + 1)).toBeNull();
  });

  it('maps only direct PLUTO LandUse values and retains its raw evidence', () => {
    const expected = new Map([
      ['1', 'RESIDENTIAL'],
      ['2', 'MULTIFAMILY'],
      ['3', 'MULTIFAMILY'],
      ['4', 'MIXED_USE'],
      ['5', 'LIKELY_COMMERCIAL'],
      ['6', 'LIKELY_COMMERCIAL'],
    ]);
    for (const [landuse, category] of expected) {
      expect(classifyNycPropertyUse('1000010001.00000000', { landuse, bldgclass: 'R9' })).toEqual({
        category,
        provenance: 'PLUTO_LANDUSE_DIRECT',
        confidence: 'HIGH',
        reason: null,
        canonicalBbl: '1000010001',
        landuseRaw: landuse,
        bldgclassRaw: 'R9',
      });
    }
  });

  it('keeps unmatched, invalid, missing, and unsupported land uses visibly unknown', () => {
    expect(classifyNycPropertyUse('1000010001', null)).toMatchObject({ category: 'UNKNOWN', reason: 'PLUTO_UNMATCHED', canonicalBbl: '1000010001' });
    expect(classifyNycPropertyUse(null, { landuse: '5' })).toMatchObject({ category: 'UNKNOWN', reason: 'NO_BBL', canonicalBbl: null });
    expect(classifyNycPropertyUse('1000010001', { landuse: '7', bldgclass: 'O6' })).toMatchObject({
      category: 'UNKNOWN', reason: 'UNMAPPED_LANDUSE', landuseRaw: '7', bldgclassRaw: 'O6',
    });
    expect(classifyNycPropertyUse('1000010001', { landuse: null, bldgclass: 'O6' })).toMatchObject({
      category: 'UNKNOWN', reason: 'MISSING_LANDUSE', bldgclassRaw: 'O6',
    });
  });

  it('does not invent a Chicago property-use classifier', () => {
    expect(chicagoUnknownPropertyUse()).toEqual({
      category: 'UNKNOWN', provenance: 'CHICAGO_UNAVAILABLE', confidence: 'NONE',
      reason: 'CHICAGO_PROPERTY_USE_UNAVAILABLE', canonicalBbl: null, landuseRaw: null, bldgclassRaw: null,
    });
  });
});
