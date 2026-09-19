import { dateOnly } from '../domain/dates.js';
import { isMarketCoordinate } from '../domain/spatial.js';
import type { NormalizedPermit } from '../domain/types.js';
const text = (v: unknown) => typeof v === 'string' && v.trim() ? v.trim() : null;
const number = (v: unknown) => { if (typeof v !== 'number' && (typeof v !== 'string' || !v.trim())) return null; const n = Number(v); return Number.isFinite(n) ? n : null; };
export function normalizeNyc(raw: Record<string, unknown>): { value?: NormalizedPermit; reason?: string } {
  // Socrata :id is snapshot identity. Job/work/sequence remain retained evidence, not a project key.
  const sourceRecordId = text(raw.source_row_id); const date = dateOnly(raw.issued_date);
  if (!sourceRecordId) return { reason: 'missing_source_row_id' }; if (!date) return { reason: 'invalid_issued_date' };
  const sourceLat = number(raw.latitude); const sourceLng = number(raw.longitude); const validCoordinate = isMarketCoordinate('NYC', sourceLat, sourceLng); const lat = validCoordinate ? sourceLat : null; const lng = validCoordinate ? sourceLng : null; const permitNumber = text(raw.work_permit) ?? text(raw.job_filing_number);
  return { value: { id: `NYC_DOB_NOW:${sourceRecordId}`, market: 'NYC', source: 'NYC_DOB_NOW', sourceRecordId, date,
    permitNumber, permitType: text(raw.work_type) ?? 'Unspecified', reportedCostCents: (() => { const n = number(raw.estimated_job_costs); return n === null || n < 0 ? null : Math.round(n * 100); })(),
    address: [text(raw.house_no), text(raw.street_name), text(raw.borough)].filter(Boolean).join(' ') || null, description: text(raw.job_description), communityArea: text(raw.borough), lat, lng, raw,
    warnings: ['DOB NOW Build issuance record; it is not a unique construction project.', ...(validCoordinate ? [] : ['Source coordinate unavailable or outside NYC sanity bounds.'])] } };
}
