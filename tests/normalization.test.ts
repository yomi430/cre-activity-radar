import { describe, expect, it } from 'vitest';
import { normalizeChicago } from '../src/sources/chicago.js';
import { normalizeNyc } from '../src/sources/nyc.js';
import { change } from '../src/domain/change.js';
import { months, periodFor } from '../src/domain/dates.js';

describe('public permit normalization', () => {
  it('keeps a Chicago permit with missing geography as accepted', () => {
    const result = normalizeChicago({ id: '42', issue_date: '2025-07-02T00:00:00.000', permit_: '100', permit_type: 'PERMIT - SIGNS', reported_cost: '1.25' });
    expect(result.value).toMatchObject({ id: 'CHICAGO_PERMIT:42', date: '2025-07-02', reportedCostCents: 125 });
    expect(result.value?.warnings[0]).toMatch(/coordinate unavailable/i);
  });
  it('uses NYC Socrata source row identity and labels issuance records honestly', () => {
    const result = normalizeNyc({ source_row_id: 'row-a', issued_date: '2024-12-01', work_permit: 'M1', work_type: 'Plumbing', latitude: '40.7', longitude: '-74' });
    expect(result.value?.id).toBe('NYC_DOB_NOW:row-a');
    expect(result.value?.warnings[0]).toMatch(/issuance record/i);
  });
  it('uses fixed dates and safe changes', () => {
    expect(periodFor('2025-07-01')).toBe('current'); expect(periodFor('2026-07-01')).toBeNull(); expect(months()).toHaveLength(24);
    expect(change(5, 0, true)).toMatchObject({ percent: null, basis: 'NO_BASELINE' });
  });
  it('does not map blank, swapped, or out-of-market coordinates', () => {
    expect(normalizeChicago({ id: 'x', issue_date: '2025-01-01', latitude: '', longitude: '' }).value?.lat).toBeNull();
    expect(normalizeNyc({ source_row_id: 'x', issued_date: '2025-01-01', latitude: '-73.9', longitude: '40.7' }).value?.lng).toBeNull();
    expect(normalizeChicago({ id: 'x', issue_date: '2025-01-01', latitude: '40.7', longitude: '-74' }).value?.lat).toBeNull();
    expect(normalizeChicago({ id: 'x', issue_date: '2025-02-30' }).reason).toBe('invalid_issue_date');
  });
});
