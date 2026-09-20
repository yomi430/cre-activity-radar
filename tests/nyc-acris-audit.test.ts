import { describe, expect, it } from 'vitest';
import { canonicalAcrisBbl, distribution, legalAssociationIdentity } from '../scripts/nyc-acris-audit-lib.mjs';

describe('NYC ACRIS audit normalization', () => {
  it('canonicalizes borough/block/lot without numeric concatenation loss', () => {
    expect(canonicalAcrisBbl('3', '15828', '7501')).toBe('3158287501');
    expect(canonicalAcrisBbl(1, 16, 100)).toBe('1000160100');
    expect(canonicalAcrisBbl(5, 16, 100)).toBeNull();
    expect(canonicalAcrisBbl(1, 'bad', 100)).toBeNull();
  });

  it('keeps rights and partial-lot fields inside the Legal association identity', () => {
    const base = { document_id: '2026000000001', borough: '1', block: '16', lot: '100', easement: 'N', partial_lot: 'E', air_rights: 'N', subterranean_rights: 'N' };
    expect(legalAssociationIdentity(base)).toBe(legalAssociationIdentity({ ...base, borough: 1, block: 16, lot: 100 }));
    expect(legalAssociationIdentity(base)).not.toBe(legalAssociationIdentity({ ...base, air_rights: 'Y' }));
    expect(legalAssociationIdentity(base)).not.toBe(legalAssociationIdentity({ ...base, partial_lot: 'P' }));
  });

  it('groups high multi-BBL counts without hiding zero-to-four counts', () => {
    expect(distribution([0, 1, 2, 5, 6])).toEqual({ '0': 1, '1': 1, '2': 1, '5+': 2 });
  });
});
