import { dateOnly } from '../domain/dates.js';
import { isMarketCoordinate } from '../domain/spatial.js';
import type { NormalizedPermit } from '../domain/types.js';
const text = (v: unknown) => typeof v === 'string' && v.trim() ? v.trim() : null;
const number = (v: unknown) => { if (typeof v !== 'number' && (typeof v !== 'string' || !v.trim())) return null; const n = Number(v); return Number.isFinite(n) ? n : null; };
const cents = (v: unknown) => { const n = number(v); return n === null || n < 0 ? null : Math.round(n * 100); };
export function normalizeChicago(raw: Record<string, unknown>): { value?: NormalizedPermit; reason?: string } {
  const sourceRecordId = text(raw.id); const date = dateOnly(raw.issue_date);
  if (!sourceRecordId) return { reason: 'missing_id' }; if (!date) return { reason: 'invalid_issue_date' };
  const address = [text(raw.street_number), text(raw.street_direction), text(raw.street_name)].filter(Boolean).join(' ') || null;
  const sourceLat = number(raw.latitude); const sourceLng = number(raw.longitude); const validCoordinate = isMarketCoordinate('CHICAGO', sourceLat, sourceLng); const lat = validCoordinate ? sourceLat : null; const lng = validCoordinate ? sourceLng : null;
  return { value: { id: `CHICAGO_PERMIT:${sourceRecordId}`, market: 'CHICAGO', source: 'CHICAGO_PERMIT', sourceRecordId, date,
    permitNumber: text(raw.permit_), permitType: text(raw.permit_type) ?? 'Unspecified', reportedCostCents: cents(raw.reported_cost), address,
    description: text(raw.work_description), communityArea: text(raw.community_area), lat, lng, raw, warnings: validCoordinate ? [] : ['Source coordinate unavailable or outside Chicago sanity bounds.'] } };
}
