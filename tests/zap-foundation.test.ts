import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import { createSchema } from '../src/server/db.js';
import { ingestZapSnapshot, zapCellsFor, zapSummaryFor } from '../src/server/zap.js';
import { canonicalBbl, normalizePlutoParcel, normalizeZapStatus } from '../src/sources/nyc-zap.js';

const fixture = (name: string): Record<string, unknown>[] => JSON.parse(readFileSync(new URL(`../data/fixtures/${name}`, import.meta.url), 'utf8')) as Record<string, unknown>[];
const snapshot = () => ({ snapshotId: 'fixture-1', retrievedAt: '2026-09-20T00:00:00.000Z', publisherUpdatedAt: { projects: '2026-09-19T00:00:00.000Z', bbl: '2026-09-19T00:00:00.000Z', pluto: '2026-09-19T00:00:00.000Z' }, complete: true, projects: fixture('zap-projects.json'), bbls: fixture('zap-bbl.json'), parcels: fixture('zap-pluto.json') });
function database() { const db = new DatabaseSync(':memory:'); createSchema(db); return db; }

describe('NYC ZAP source foundation', () => {
  it('canonicalizes publisher numeric and decimal BBLs without a floating-point join', () => {
    expect(canonicalBbl('4087860042.00000000')).toBe('4087860042');
    expect(canonicalBbl(1000000001)).toBe('1000000001');
    expect(canonicalBbl('1')).toBe('0000000001');
    expect(canonicalBbl('1.25')).toBeNull();
    expect(canonicalBbl('10000000000')).toBeNull();
    expect(normalizePlutoParcel({ bbl: '1000000001', latitude: '40.7128', longitude: '-74.006' })).toMatchObject({ h3Cell: expect.any(String) });
  });

  it('uses only observed project status semantics and never infers approval', () => {
    expect(normalizeZapStatus('Active')).toBe('ACTIVE');
    expect(normalizeZapStatus('Complete')).toBe('COMPLETED_OTHER');
    expect(normalizeZapStatus('Record Closed')).toBe('COMPLETED_OTHER');
    expect(normalizeZapStatus('future status')).toBe('UNKNOWN');
  });

  it('counts distinct projects citywide and once per H3 despite multi-lot placement', () => {
    const db = database();
    try {
      expect(ingestZapSnapshot(db, snapshot())).toMatchObject({ acceptedProjects: 4, validatedBblRows: 4, unvalidatedBblRows: 1, nullCoordinateParcels: 1, unmappedValidatedBblRows: 2, placedProjectCells: 1 });
      const all = zapSummaryFor(db);
      expect(all).toMatchObject({ permitRankingTreatment: 'SEPARATE_ENTITLEMENT_LAYER', counts: { projectCount: 4, statusCounts: { ACTIVE: 1, COMPLETED_OTHER: 1, WITHDRAWN: 1, UNKNOWN: 1 } } });
      expect(all.coverage).toMatchObject({ allTrackedProjects: 4, projectsWithAppFiledDate: 2, missingAppFiledDate: 2, filedDateCoverage: 0.5, validatedBblRows: 4, unvalidatedBblRows: 1, unmatchedParcelRows: 2, nullCoordinateParcelRows: 1, placedProjectCells: 1 });
      expect(zapCellsFor(db)).toHaveLength(1);
      expect(zapCellsFor(db)[0]).toMatchObject({ projectCount: 1, precision: 'PARCEL_CENTROID', statusCounts: { ACTIVE: 1 } });
      expect(zapSummaryFor(db, 'FILED_24_MONTHS')).toMatchObject({ counts: { projectCount: 1 }, coverage: { window: 'FILED_24_MONTHS', includedProjects: 1 } });
    } finally { db.close(); }
  });

  it('soft flags records absent from a later complete snapshot and leaves incomplete snapshots non-destructive', () => {
    const db = database();
    try {
      ingestZapSnapshot(db, snapshot());
      const partial = snapshot(); partial.snapshotId = 'fixture-incomplete'; partial.retrievedAt = '2026-09-21T00:00:00.000Z'; partial.complete = false; partial.projects = partial.projects.slice(0, 1); partial.bbls = partial.bbls.slice(0, 1);
      ingestZapSnapshot(db, partial);
      expect(zapSummaryFor(db).coverage.possiblyRemovedProjects).toBe(0);
      const complete = snapshot(); complete.snapshotId = 'fixture-2'; complete.retrievedAt = '2026-09-22T00:00:00.000Z'; complete.projects = complete.projects.slice(0, 1); complete.bbls = complete.bbls.slice(0, 1);
      ingestZapSnapshot(db, complete);
      expect(zapSummaryFor(db).coverage).toMatchObject({ possiblyRemovedProjects: 3, possiblyRemovedBblRows: 4, includedProjects: 1 });
    } finally { db.close(); }
  });

  it('treats snapshot retries as idempotent and retains projects with malformed optional filing dates', () => {
    const db = database();
    try {
      const first = snapshot();
      first.projects = [...first.projects, { project_id: 'P-malformed-date', project_status: 'Active', app_filed_date: 'not-a-date' }];
      expect(ingestZapSnapshot(db, first).acceptedProjects).toBe(5);
      expect(ingestZapSnapshot(db, first).acceptedProjects).toBe(0);
      expect(zapSummaryFor(db).counts.projectCount).toBe(5);
      expect(zapSummaryFor(db).coverage.changeHistoryAvailable).toBe(false);
      const next = snapshot(); next.snapshotId = 'fixture-history-2'; next.retrievedAt = '2026-09-23T00:00:00.000Z';
      ingestZapSnapshot(db, next);
      expect(zapSummaryFor(db).coverage.changeHistoryAvailable).toBe(true);
    } finally { db.close(); }
  });
});
