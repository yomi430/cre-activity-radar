import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import { persistenceForCurrent } from '../src/domain/investigation.js';
import { createSchema } from '../src/server/db.js';
import { investigationBriefFor } from '../src/server/repository.js';

const cell = '882664c1a9fffff';
function report() {
  return { source: 'CHICAGO_PERMIT', market: 'CHICAGO', status: 'available', mode: 'public', completeness: 'complete-query', datasetUrl: 'https://example.test', retrievedAt: null, publisherAsOf: null, rowsRead: 0, acceptedRows: 0, rejectedRows: 0, duplicateRows: 0, outOfScopeRows: 0, resolvedRows: 0, unresolvedRows: 0, missingCostRows: 0, reasonCounts: {}, notes: [] };
}
function database() {
  const db = new DatabaseSync(':memory:');
  createSchema(db);
  db.prepare('INSERT INTO source_reports VALUES(?,?,?)').run('CHICAGO_PERMIT', 'CHICAGO', JSON.stringify(report()));
  return db;
}
function insert(db: DatabaseSync, values: { id: string; date: string; type: string; address: string; cost?: number | null }) {
  db.prepare('INSERT INTO permits VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(
    values.id, 'CHICAGO', 'CHICAGO_PERMIT', values.id, values.date, values.id, values.type, values.cost === undefined ? 10000 : values.cost,
    values.address, null, null, 41.9, -87.65, cell, '{}', '[]',
  );
}

describe('investigation brief', () => {
  it('calculates drivers, persistence, repeated-address evidence, and missing-cost caveats from fixed-window records', () => {
    const db = database();
    insert(db, { id: 'p-alpha-1', date: '2024-08-01', type: 'Renovation', address: '100 Alpha St' });
    insert(db, { id: 'p-alpha-2', date: '2025-01-01', type: 'Renovation', address: '100 Alpha St' });
    insert(db, { id: 'p-beta', date: '2025-03-01', type: 'Sign', address: '200 Beta Ave' });
    insert(db, { id: 'c-alpha-1', date: '2025-07-02', type: 'Renovation', address: '100 Alpha St', cost: 90000 });
    insert(db, { id: 'c-alpha-2', date: '2025-07-03', type: 'Renovation', address: '100 Alpha St', cost: null });
    insert(db, { id: 'c-alpha-3', date: '2025-08-01', type: 'Renovation', address: '100 Alpha St', cost: 80000 });
    insert(db, { id: 'c-beta-1', date: '2025-08-02', type: 'Sign', address: '200 Beta Ave', cost: 70000 });
    insert(db, { id: 'c-beta-2', date: '2025-09-01', type: 'Sign', address: '200 Beta Ave', cost: 60000 });

    const brief = investigationBriefFor(db, 'CHICAGO', cell, 'ALL');
    expect(brief?.permitCount).toMatchObject({ current: 5, previous: 3, absolute: 2, basis: 'COMPARABLE' });
    expect(brief?.drivers).toEqual([
      { permitType: 'Renovation', current: 3, prior: 2, absolute: 1, currentShare: 0.6 },
      { permitType: 'Sign', current: 2, prior: 1, absolute: 1, currentShare: 0.4 },
    ]);
    expect(brief?.activityPersistence).toEqual({ activeMonthsCurrent: 3, longestCurrentMonthStreak: 3, peakMonth: '2025-07', peakMonthCount: 2, topMonthConcentrationShare: 0.4 });
    expect(brief?.repeatedAddresses[0]).toMatchObject({ address: '100 Alpha St', current: 3, prior: 2, absolute: 1, currentRecordIds: ['c-alpha-3', 'c-alpha-2', 'c-alpha-1'] });
    expect(brief?.dataQuality.missingReportedCost).toMatchObject({ current: 1, currentShare: 0.2 });
    expect(brief?.largestCurrentPermits[0]).toMatchObject({ id: 'c-alpha-1', reportedCostCents: 90000 });
    expect(brief?.subsectionBreakdown).toMatchObject({
      scope: { permitType: 'ALL', lens: 'ALL' },
      permitCount: { current: 5, previous: 3, absolute: 2 },
      reportedCostCoverage: { currentWithReportedCost: 4, currentMissingReportedCost: 1, currentCoverageShare: 0.8 },
    });
    expect(brief?.subsectionBreakdown.permitTypeComposition).toContainEqual(expect.objectContaining({ key: 'Renovation', current: 3, prior: 2, currentShare: 0.6 }));
    expect(brief?.subsectionBreakdown.monthlyCadence.find(row => row.month === '2025-08')).toMatchObject({ period: 'current', count: 2 });
    // The fixture retains no work-type details, so its otherwise unknown source values
    // are deliberately visible as unclassified rather than promoted to a CRE lead.
    expect(brief?.qualifiedSignal).toMatchObject({ pattern: 'ADMINISTRATIVE_PROCESS_SURGE', suggestedDisposition: 'DISMISS_AS_LOW_INFORMATION', ruleVersion: 'qualified-signal-v1.0' });
    expect(brief?.cannotConclude.join(' ')).toMatch(/not unique projects/i);
    db.close();
  });

  it('preserves the no-baseline condition instead of fabricating a percentage or score', () => {
    const db = database();
    insert(db, { id: 'only-current', date: '2025-08-01', type: 'Renovation', address: '100 Alpha St' });
    const brief = investigationBriefFor(db, 'CHICAGO', cell, 'ALL');
    expect(brief?.permitCount).toMatchObject({ current: 1, previous: 0, absolute: 1, percent: null, basis: 'NO_BASELINE' });
    expect(brief?.recommendedNextChecks.join(' ')).toMatch(/prior-period source coverage/i);
    db.close();
  });

  it('counts a current-month streak without treating inactive months as activity', () => {
    expect(persistenceForCurrent([
      { month: '2025-07', count: 1 }, { month: '2025-08', count: 2 }, { month: '2025-09', count: 0 }, { month: '2025-10', count: 1 },
    ])).toMatchObject({ activeMonthsCurrent: 3, longestCurrentMonthStreak: 2, peakMonth: '2025-08', peakMonthCount: 2, topMonthConcentrationShare: 0.5 });
  });
});
