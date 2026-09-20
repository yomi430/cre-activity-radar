import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import { createSchema } from '../src/server/db.js';
import { ingestZapSnapshot, zapCellsFor, zapSummaryFor } from '../src/server/zap.js';

function database() {
  const db = new DatabaseSync(':memory:');
  createSchema(db);
  return db;
}

function fixture() {
  return {
    snapshotId: 'zap-fixture-1',
    retrievedAt: '2026-09-20T12:00:00.000Z',
    publisherUpdatedAt: { projects: '2026-09-20T00:00:00.000Z', bbl: '2026-09-20T00:00:00.000Z', pluto: '2026-09-20T00:00:00.000Z' },
    complete: true,
    projects: [
      { project_id: 'project-one', project_status: 'Active', app_filed_date: '2025-08-01T00:00:00.000' },
      { project_id: 'project-two', project_status: 'Complete', app_filed_date: null },
      { project_id: 'project-three', project_status: 'Future publisher status', app_filed_date: null },
    ],
    bbls: [
      { project_id: 'project-one', bbl: '1000000001.00000000', validated: 'true' },
      { project_id: 'project-one', bbl: '1000000002', validated: 'true' },
      { project_id: 'project-two', bbl: '2000000001', validated_borough: 'MANHATTAN' },
      { project_id: 'project-two', bbl: null, validated: false },
      { project_id: 'project-three', bbl: '3000000001', validated: 'true' },
    ],
    parcels: [
      // Project one deliberately touches two H3 cells; its first cell also contains project two.
      { bbl: '1000000001', latitude: '40.7000', longitude: '-74.0000' },
      { bbl: '1000000002', latitude: '40.8200', longitude: '-73.9000' },
      { bbl: '2000000001', latitude: '40.7000', longitude: '-74.0000' },
    ],
  };
}

describe('NYC ZAP entitlement integration', () => {
  it('keeps distinct project totals separate from multi-lot and multi-cell placement', () => {
    const db = database();
    const result = ingestZapSnapshot(db, fixture());
    expect(result).toMatchObject({ acceptedProjects: 3, validatedBblRows: 4, unvalidatedBblRows: 1, unmappedValidatedBblRows: 1, placedProjectCells: 3 });

    const all = zapSummaryFor(db, 'ALL_RECORDS');
    expect(all).toMatchObject({
      window: 'ALL_RECORDS',
      counts: { projectCount: 3, statusCounts: { ACTIVE: 1, COMPLETED_OTHER: 1, UNKNOWN: 1 } },
      permitRankingTreatment: 'SEPARATE_ENTITLEMENT_LAYER',
      coverage: { allTrackedProjects: 3, includedProjects: 3, validatedBblRows: 4, unvalidatedBblRows: 1, unmatchedParcelRows: 1, nullCoordinateParcelRows: 0, placedProjectCells: 3 },
    });

    const cells = zapCellsFor(db, 'ALL_RECORDS');
    expect(cells).toHaveLength(2);
    expect(cells.map(item => item.projectCount).sort((a, b) => a - b)).toEqual([1, 2]);
    // One project is allowed in each touched cell, but the citywide total remains distinct.
    expect(cells.reduce((total, item) => total + item.projectCount, 0)).toBe(3);
    expect(all.counts.projectCount).toBe(3);
    expect(cells.every(item => item.precision === 'PARCEL_CENTROID')).toBe(true);
    db.close();
  });

  it('makes the filed-date subset explicit and reports its coverage instead of treating missing dates as out of scope', () => {
    const db = database();
    ingestZapSnapshot(db, fixture());
    const all = zapSummaryFor(db, 'ALL_RECORDS');
    const filed = zapSummaryFor(db, 'FILED_24_MONTHS');
    expect(all.coverage).toMatchObject({ projectsWithAppFiledDate: 1, missingAppFiledDate: 2, filedDateCoverage: 1 / 3 });
    expect(filed).toMatchObject({ window: 'FILED_24_MONTHS', counts: { projectCount: 1 }, coverage: { allTrackedProjects: 3, includedProjects: 1, missingAppFiledDate: 2 } });
    expect(filed.coverage.caveats.join(' ')).toMatch(/must disclose filed-date coverage/i);
    db.close();
  });

  it('keeps source history and soft removals visible after a later complete snapshot', () => {
    const db = database();
    ingestZapSnapshot(db, fixture());
    const next = fixture();
    next.snapshotId = 'zap-fixture-2';
    next.retrievedAt = '2026-09-21T12:00:00.000Z';
    next.projects = [next.projects[0]!];
    next.bbls = [next.bbls[0]!];
    next.parcels = [next.parcels[0]!];
    ingestZapSnapshot(db, next);
    const summary = zapSummaryFor(db, 'ALL_RECORDS');
    expect(summary).toMatchObject({
      counts: { projectCount: 1, statusCounts: { ACTIVE: 1 } },
      coverage: { possiblyRemovedProjects: 2, possiblyRemovedBblRows: 4 },
    });
    expect(summary.sources).toHaveLength(3);
    expect(summary.sources.every(source => source.caveat.includes('Change history is unavailable'))).toBe(true);
    db.close();
  });
});
