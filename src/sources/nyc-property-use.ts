import type { PropertyUse } from '../shared/contracts.js';

export type PropertyUseCategory = Exclude<PropertyUse, 'ALL'>;
export type PropertyUseClassification = {
  category: PropertyUseCategory;
  provenance: 'PLUTO_LANDUSE_DIRECT';
  confidence: 'HIGH';
  reason: string | null;
  canonicalBbl: string | null;
  landuseRaw: string | null;
  bldgclassRaw: string | null;
};

/**
 * BBL is a decimal-safe tax-lot identity. It must never pass through Number:
 * DOB and PLUTO disagree on whether an all-zero decimal suffix is displayed.
 */
export function canonicalBbl(value: unknown): string | null {
  const source = typeof value === 'string' ? value.trim() : typeof value === 'bigint' ? value.toString() : typeof value === 'number' && Number.isSafeInteger(value) ? String(value) : '';
  const match = /^(\d+)(?:\.0+)?$/.exec(source);
  if (!match) return null;
  try {
    const parsed = BigInt(match[1]);
    return parsed > 0n && parsed <= 9_999_999_999n ? parsed.toString().padStart(10, '0') : null;
  } catch { return null; }
}

function text(value: unknown): string | null { return typeof value === 'string' && value.trim() ? value.trim() : null; }

/** Direct DCP LandUse only. BldgClass is retained as review evidence, never guessed. */
export function classifyNycPropertyUse(permitBbl: unknown, pluto: Record<string, unknown> | null): PropertyUseClassification {
  const canonical = canonicalBbl(permitBbl);
  if (!canonical) return { category: 'UNKNOWN', provenance: 'PLUTO_LANDUSE_DIRECT', confidence: 'HIGH', reason: permitBbl === null || permitBbl === undefined || text(permitBbl) === null ? 'NO_BBL' : 'INVALID_OR_ZERO_BBL', canonicalBbl: null, landuseRaw: null, bldgclassRaw: null };
  if (!pluto) return { category: 'UNKNOWN', provenance: 'PLUTO_LANDUSE_DIRECT', confidence: 'HIGH', reason: 'PLUTO_UNMATCHED', canonicalBbl: canonical, landuseRaw: null, bldgclassRaw: null };
  const landuse = text(pluto.landuse);
  const bldgclass = text(pluto.bldgclass);
  const category: Record<string, PropertyUseCategory> = { '1': 'RESIDENTIAL', '2': 'MULTIFAMILY', '3': 'MULTIFAMILY', '4': 'MIXED_USE', '5': 'LIKELY_COMMERCIAL', '6': 'LIKELY_COMMERCIAL' };
  if (landuse && category[landuse]) return { category: category[landuse], provenance: 'PLUTO_LANDUSE_DIRECT', confidence: 'HIGH', reason: null, canonicalBbl: canonical, landuseRaw: landuse, bldgclassRaw: bldgclass };
  return { category: 'UNKNOWN', provenance: 'PLUTO_LANDUSE_DIRECT', confidence: 'HIGH', reason: landuse ? 'UNMAPPED_LANDUSE' : 'MISSING_LANDUSE', canonicalBbl: canonical, landuseRaw: landuse, bldgclassRaw: bldgclass };
}

export function chicagoUnknownPropertyUse() {
  return { category: 'UNKNOWN' as const, provenance: 'CHICAGO_UNAVAILABLE' as const, confidence: 'NONE' as const, reason: 'CHICAGO_PROPERTY_USE_UNAVAILABLE', canonicalBbl: null, landuseRaw: null, bldgclassRaw: null };
}
