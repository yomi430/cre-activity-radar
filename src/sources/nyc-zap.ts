import { dateOnly } from '../domain/dates.js';
import { cellFor, isMarketCoordinate } from '../domain/spatial.js';
import type { ZapProjectStatus } from '../shared/contracts.js';

const nonBlank = (value: unknown): string | null => typeof value === 'string' && value.trim() ? value.trim() : null;
const finiteNumber = (value: unknown): number | null => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string' && value.trim()) { const number = Number(value); return Number.isFinite(number) ? number : null; }
  return null;
};

/**
 * NYC publishes BBLs as numbers (and PLUTO sometimes serializes a zero-only decimal).
 * Parse decimal text with BigInt, never Number, so a join cannot silently lose digits.
 */
export function canonicalBbl(value: unknown): string | null {
  const source = typeof value === 'number' ? (Number.isSafeInteger(value) ? String(value) : null) : typeof value === 'string' ? value.trim() : null;
  if (!source) return null;
  const match = /^(\d+)(?:\.0+)?$/.exec(source);
  if (!match) return null;
  try {
    const integer = BigInt(match[1]!);
    if (integer <= 0n || integer > 9_999_999_999n) return null;
    return integer.toString().padStart(10, '0');
  } catch { return null; }
}

export function normalizeZapStatus(value: unknown): ZapProjectStatus {
  switch (nonBlank(value)?.toLowerCase()) {
    case 'active': return 'ACTIVE';
    case 'on-hold': return 'ON_HOLD';
    case 'withdrawn-other': return 'WITHDRAWN';
    case 'terminated':
    case 'terminated-applicant unresponsive': return 'TERMINATED';
    case 'complete':
    case 'record closed': return 'COMPLETED_OTHER';
    default: return 'UNKNOWN';
  }
}

export interface NormalizedZapProject {
  projectId: string;
  rawStatus: string | null;
  status: ZapProjectStatus;
  publicStatus: string | null;
  appFiledDate: string | null;
  raw: Record<string, unknown>;
}
export function normalizeZapProject(raw: Record<string, unknown>): NormalizedZapProject | { reason: string } {
  const projectId = nonBlank(raw.project_id);
  if (!projectId) return { reason: 'missing_project_id' };
  const rawDate = raw.app_filed_date;
  const appFiledDate = rawDate === null || rawDate === undefined || rawDate === '' ? null : dateOnly(rawDate);
  // A malformed optional filing date must not discard a valid project identity.
  // The coverage-limited view simply excludes it and exposes missing-date coverage.
  return { projectId, rawStatus: nonBlank(raw.project_status), status: normalizeZapStatus(raw.project_status), publicStatus: nonBlank(raw.public_status), appFiledDate, raw };
}

function validated(raw: Record<string, unknown>): boolean {
  const flag = raw.validated;
  if (flag === true || flag === 1 || nonBlank(flag)?.toLowerCase() === 'true' || nonBlank(flag) === '1') return true;
  return nonBlank(raw.validated_borough) !== null;
}
export interface NormalizedZapBbl {
  projectId: string;
  bbl: string | null;
  validated: boolean;
  raw: Record<string, unknown>;
}
export function normalizeZapBbl(raw: Record<string, unknown>): NormalizedZapBbl | { reason: string } {
  const projectId = nonBlank(raw.project_id);
  if (!projectId) return { reason: 'missing_project_id' };
  const isValidated = validated(raw);
  const bbl = canonicalBbl(raw.bbl);
  if (isValidated && !bbl) return { reason: 'invalid_validated_bbl' };
  return { projectId, bbl, validated: isValidated, raw };
}

export interface NormalizedPlutoParcel {
  bbl: string;
  lat: number | null;
  lng: number | null;
  h3Cell: string | null;
  raw: Record<string, unknown>;
}
export function normalizePlutoParcel(raw: Record<string, unknown>): NormalizedPlutoParcel | { reason: string } {
  const bbl = canonicalBbl(raw.bbl);
  if (!bbl) return { reason: 'invalid_bbl' };
  const candidateLat = finiteNumber(raw.latitude), candidateLng = finiteNumber(raw.longitude);
  const mapped = isMarketCoordinate('NYC', candidateLat, candidateLng);
  const lat = mapped ? candidateLat : null, lng = mapped ? candidateLng : null;
  return { bbl, lat, lng, h3Cell: cellFor(lat, lng), raw };
}
