import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import { createSchema } from '../src/server/db.js';
import { cellsFor, evidenceFor, investigationBriefFor, signalFor, summaryFor } from '../src/server/repository.js';

const highMaxCell = '882664c1a9fffff';
const highSumCell = '882664c1abfffff';

function database() {
  const db = new DatabaseSync(':memory:');
  createSchema(db);
  db.prepare('INSERT INTO source_reports VALUES(?,?,?)').run('NYC_DOB_NOW', 'NYC', JSON.stringify({
    source: 'NYC_DOB_NOW', market: 'NYC', status: 'available', mode: 'public', completeness: 'complete-query', datasetUrl: 'https://example.test', retrievedAt: null, publisherAsOf: null,
    rowsRead: 0, acceptedRows: 0, rejectedRows: 0, duplicateRows: 0, outOfScopeRows: 0, resolvedRows: 0, unresolvedRows: 0, missingCostRows: 0, reasonCounts: {}, notes: [],
  }));
  return db;
}

function insert(db: DatabaseSync, id: string, cell: string, cost: number | null, category: string, type = 'Foundation') {
  db.prepare('INSERT INTO permits VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(
    id, 'NYC', 'NYC_DOB_NOW', id, '2025-08-01', id, type, cost, `${id} Ave`, null, null, 40.7, -74, cell,
    JSON.stringify({ work_type: type, bbl: '1000010001.00000000' }), '[]',
  );
  db.prepare('INSERT INTO permit_property_use VALUES(?,?,?,?,?,?,?,?,?)').run(
    id, null, '1000010001', category, 'PLUTO_LANDUSE_DIRECT', 'HIGH', null, category === 'LIKELY_COMMERCIAL' ? '5' : '1', 'O4',
  );
}

describe('property-use and reported-cost controls', () => {
  it('intersects exact lens, direct property context, and individual-record cost filters across every permit result', () => {
    const db = database();
    try {
      insert(db, 'max-single', highMaxCell, 1_000_000, 'LIKELY_COMMERCIAL');
      insert(db, 'sum-one', highSumCell, 900_000, 'LIKELY_COMMERCIAL');
      insert(db, 'sum-two', highSumCell, 900_000, 'LIKELY_COMMERCIAL');
      insert(db, 'under-threshold', highSumCell, 899_999, 'LIKELY_COMMERCIAL');
      insert(db, 'missing-cost', highSumCell, null, 'LIKELY_COMMERCIAL');
      insert(db, 'residential', highMaxCell, 2_000_000, 'RESIDENTIAL');
      insert(db, 'wrong-lens', highMaxCell, 2_000_000, 'LIKELY_COMMERCIAL', 'Sign');

      const filters = { propertyUse: 'LIKELY_COMMERCIAL' as const, minReportedCostCents: 900_000, rank: 'LARGEST_REPORTED_COST' as const };
      const summary = summaryFor(db, 'NYC', 'ALL', 'GROUND_UP_SITE', filters);
      expect(summary.selection).toMatchObject(filters);
      expect(summary.acceptedPermits.current).toBe(3);

      const cells = cellsFor(db, 'NYC', 'ALL', 'GROUND_UP_SITE', filters).cells;
      // The first H3 has one $10,000 record. The second has two $9,000 records:
      // cost ranking must use a maximum individual record, never an H3 sum.
      expect(cells.map(row => row.h3Cell)).toEqual([highMaxCell, highSumCell]);
      expect(cells.map(row => row.permitCount.current)).toEqual([1, 2]);

      expect(signalFor(db, 'NYC', highSumCell, 'ALL', 'GROUND_UP_SITE', filters)?.permitCount.current).toBe(2);
      const brief = investigationBriefFor(db, 'NYC', highSumCell, 'ALL', 'GROUND_UP_SITE', filters);
      expect(brief?.permitCount.current).toBe(2);
      expect(brief?.largestCurrentPermits.map(row => row.id)).toEqual(['sum-one', 'sum-two']);

      const evidence = evidenceFor(db, 'NYC', highSumCell, 'ALL', 'current', 25, 0, 'GROUND_UP_SITE', filters);
      expect(evidence.total).toBe(2);
      expect(evidence.data.map(row => row.id).sort()).toEqual(['sum-one', 'sum-two']);
      expect(evidence.data.every(row => row.propertyUse.category === 'LIKELY_COMMERCIAL')).toBe(true);
      expect(evidence.data.every(row => row.propertyUse.landuseRaw === '5')).toBe(true);
    } finally {
      db.close();
    }
  });
});
