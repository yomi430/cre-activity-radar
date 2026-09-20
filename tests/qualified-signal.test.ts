import { describe, expect, it } from 'vitest';
import { qualifiedSignalFor, type QualifiedSignalInput } from '../src/domain/investigation.js';

function input(overrides: Partial<QualifiedSignalInput> = {}): QualifiedSignalInput {
  return {
    change: { current: 10, previous: 5, absolute: 5, percent: 100, basis: 'COMPARABLE' },
    persistence: { activeMonthsCurrent: 4, longestCurrentMonthStreak: 4, peakMonth: '2025-09', peakMonthCount: 3, topMonthConcentrationShare: 0.3 },
    topAddress: { address: '100 Test St', current: 5, share: 0.5 },
    topPermitType: { permitType: 'Renovation', current: 6, share: 0.6 },
    lowInformationShare: 0.1,
    primaryLensShare: 0.7,
    hasMaterialRecord: false,
    ...overrides,
  };
}

describe('qualified signal rules', () => {
  it('qualifies a broad pattern at its distribution and persistence boundaries', () => {
    const result = qualifiedSignalFor(input());
    expect(result).toMatchObject({ pattern: 'BROAD_BASED_LOCAL_ACTIVITY', suggestedDisposition: 'INVESTIGATE', ruleVersion: 'qualified-signal-v1.0' });
    expect(result.triggeredRules.map(item => item.id)).toEqual(['multi-site-distribution', 'persistence', 'primary-lens-mix']);
  });

  it('prioritizes a 75% low-information mix over a positive raw count change', () => {
    const result = qualifiedSignalFor(input({ lowInformationShare: 0.75 }));
    expect(result).toMatchObject({ pattern: 'ADMINISTRATIVE_PROCESS_SURGE', suggestedDisposition: 'DISMISS_AS_LOW_INFORMATION' });
    expect(result.caveat).toMatch(/do not by themselves establish commercial activity/i);
  });

  it('qualifies a persistent, site-concentrated capital-program lead at its thresholds', () => {
    const result = qualifiedSignalFor(input({
      persistence: { activeMonthsCurrent: 3, longestCurrentMonthStreak: 3, peakMonth: '2025-09', peakMonthCount: 3, topMonthConcentrationShare: 0.4 },
      topAddress: { address: '100 Test St', current: 8, share: 0.75 },
      primaryLensShare: 0.5,
    }));
    expect(result).toMatchObject({ pattern: 'CONCENTRATED_CAPITAL_PROGRAM_LEAD', suggestedDisposition: 'INVESTIGATE' });
    expect(result.observedPattern).toMatch(/75%/);
  });

  it('returns a coverage-limited qualification before interpreting an incomplete comparison', () => {
    const result = qualifiedSignalFor(input({ change: { current: 10, previous: 0, absolute: 10, percent: null, basis: 'INCOMPLETE' } }));
    expect(result).toMatchObject({ pattern: 'WEAK_OR_DECLINING_SIGNAL', label: 'Coverage-limited recorded activity', suggestedDisposition: 'MONITOR' });
    expect(result.triggeredRules[0]).toMatchObject({ id: 'incomplete-comparison' });
  });

  it('does not manufacture a lead from a flat or declining count', () => {
    const result = qualifiedSignalFor(input({ change: { current: 5, previous: 5, absolute: 0, percent: 0, basis: 'COMPARABLE' } }));
    expect(result).toMatchObject({ pattern: 'WEAK_OR_DECLINING_SIGNAL', label: 'Flat recorded activity', suggestedDisposition: 'MONITOR' });
  });

  it('returns monitorable emerging activity when stronger pattern thresholds are not met', () => {
    const result = qualifiedSignalFor(input({
      persistence: { activeMonthsCurrent: 2, longestCurrentMonthStreak: 1, peakMonth: '2025-09', peakMonthCount: 3, topMonthConcentrationShare: 0.4 },
      topAddress: { address: '100 Test St', current: 6, share: 0.6 },
    }));
    expect(result).toMatchObject({ pattern: 'EMERGING_LOW_VOLUME_LEAD', suggestedDisposition: 'MONITOR' });
  });
});
