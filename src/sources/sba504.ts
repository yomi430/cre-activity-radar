import { dateOnly } from '../domain/dates.js';
import type { NormalizedApproval } from '../domain/types.js';
const text = (v: unknown) => typeof v === 'string' && v.trim() ? v.trim() : null;
export function normalizeSba(raw: Record<string, string>, rowNumber: number): NormalizedApproval[] {
  const date = dateOnly(raw.ApprovalDate); const city = text(raw.BorrCity); const state = text(raw.BorrState)?.toUpperCase();
  const amount = Number(raw.GrossApproval); if (!date || !city || !state || !Number.isFinite(amount) || amount < 0) return [];
  const canonical = city.toUpperCase().replaceAll('.', '').trim();
  const markets: Array<{ market: 'CHICAGO' | 'NYC'; accepted: boolean }> = [
    { market: 'CHICAGO', accepted: state === 'IL' && canonical === 'CHICAGO' },
    // New York City is deliberately limited to the five explicit city labels found in borrower-city data.
    { market: 'NYC', accepted: state === 'NY' && ['NEW YORK', 'BROOKLYN', 'BRONX', 'QUEENS', 'STATEN ISLAND'].includes(canonical) },
  ];
  const sourceRecord = text(raw.LocationID) ?? `snapshot-row-${rowNumber}`;
  return markets.filter(x => x.accepted).map(({ market }) => ({ id: `SBA_504:${market}:${sourceRecord}:${rowNumber}`, market, date, borrowerName: text(raw.BorrName), approvalAmountCents: Math.round(amount * 100), status: text(raw.LoanStatus), city, state, raw }));
}
