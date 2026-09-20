import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import { createSchema } from '../src/server/db.js';
import { acrisDocumentFor, acrisSummaryFor, ingestAcrisSnapshot } from '../src/server/acris.js';
import { createApp } from '../src/server/app.js';

function database() {
  const db = new DatabaseSync(':memory:');
  createSchema(db);
  return db;
}

const master = (documentId: string, overrides: Record<string, unknown> = {}) => ({
  document_id: documentId, doc_type: 'DEED', recorded_datetime: '2026-01-02T12:00:00.000',
  document_date: '2025-12-20T00:00:00.000', document_amt: '999999', good_through_date: '2026-09-01T00:00:00.000',
  ...overrides,
});
const legal = (documentId: string, lot: string, overrides: Record<string, unknown> = {}) => ({
  document_id: documentId, borough: '1', block: '1', lot, easement: 'N', partial_lot: 'N', air_rights: 'N', subterranean_rights: 'N',
  ...overrides,
});

function fixture() {
  return {
    snapshotId: 'acceptance-1', retrievedAt: '2026-09-20T12:00:00.000Z', complete: true,
    publisherUpdatedAt: { master: '2026-09-10T00:00:00.000Z', legals: '2026-09-10T00:00:00.000Z', pluto: '2026-09-10T00:00:00.000Z' },
    master: [
      master('deed-a'), master('deed-a'), master('deed-b'),
      master('excluded-compound', { doc_type: 'DEED, TS' }), master('excluded-other', { doc_type: 'SAT' }),
    ],
    legals: [
      legal('deed-a', '1'), legal('deed-a', '1'), // duplicate association collapses
      legal('deed-a', '1', { air_rights: 'Y' }), // rights remain part of identity
      legal('deed-a', '2'), legal('deed-b', '3'),
    ],
    parcels: [
      { bbl: '1000010001', latitude: '40.7000', longitude: '-74.0000' },
      { bbl: '1000010002', latitude: null, longitude: null }, // matched, but no coordinate placement
      // BBL 1000010003 is deliberately unmatched.
    ],
  };
}

describe('NYC ACRIS acceptance boundary', () => {
  it('keeps exact-DEED documents distinct from rights-aware parcel evidence and reports excluded/geography quality', () => {
    const db = database();
    try {
      const result = ingestAcrisSnapshot(db, fixture());
      expect(result).toMatchObject({
        acceptedDocuments: 2, duplicateMasterRows: 1,
        excludedRawTypeCounts: { 'DEED, TS': 1, SAT: 1 },
        acceptedAssociations: 4, duplicateLegalRows: 1,
        unmatchedBbls: 1, nullCoordinateBbls: 1, placedDocumentCells: 1, multiBblDocuments: 1,
      });

      const summary = acrisSummaryFor(db);
      expect(summary).toMatchObject({
        distinctDocuments: 2, exactDeedRows: 3, excludedTypeRows: 2, associationCount: 4,
        permitRankingTreatment: 'SEPARATE_RECORDED_DEED_CONTEXT',
        disclosure: 'ACRIS recorded-deed context: four boroughs; Staten Island is not covered.',
        quality: { distinctLegalBbls: 3, unmatchedBbls: 1, nullCoordinateBbls: 1, multiBblDocuments: 1 },
      });
      // The city total is a distinct document count. One deed's two rights-aware
      // associations in one cell must still count as one document there.
      expect(summary.cells).toHaveLength(1);
      expect(summary.cells[0]).toMatchObject({ documentCount: 1, associationCount: 2, precision: 'PARCEL_CENTROID' });

      const deed = acrisDocumentFor(db, 'deed-a');
      expect(deed).toMatchObject({ docType: 'DEED', bbls: ['1000010001', '1000010002'], placementPrecision: 'PARCEL_CENTROID', documentAmountDisclosure: 'NOT_A_SALE_PRICE' });
      expect(JSON.stringify(deed)).not.toContain('999999');
      expect(db.prepare('SELECT COUNT(*) AS n FROM permits').get()).toEqual({ n: 0 });
    } finally { db.close(); }
  });

  it('refuses a material duplicate-Master conflict before it can activate any transaction evidence', () => {
    const db = database();
    try {
      const input = fixture();
      input.master = [master('conflicted'), master('conflicted', { recorded_datetime: '2026-01-03T12:00:00.000' })];
      expect(() => ingestAcrisSnapshot(db, input)).toThrow(/duplicate conflicted disagrees on material event fields/i);
      expect(db.prepare('SELECT COUNT(*) AS n FROM acris_snapshots').get()).toEqual({ n: 0 });
      expect(db.prepare('SELECT COUNT(*) AS n FROM acris_documents').get()).toEqual({ n: 0 });
    } finally { db.close(); }
  });

  it('is snapshot-id idempotent and does not turn a repeated load into additional documents or cells', () => {
    const db = database();
    try {
      const input = fixture();
      ingestAcrisSnapshot(db, input);
      const before = acrisSummaryFor(db);
      expect(ingestAcrisSnapshot(db, input)).toMatchObject({ acceptedDocuments: 0, placedDocumentCells: 0 });
      expect(acrisSummaryFor(db)).toEqual(before);
    } finally { db.close(); }
  });

  it('rejects unsupported ACRIS query parameters before a fixed-scope evidence route can run', async () => {
    const server = createApp().listen(0, '127.0.0.1');
    await new Promise<void>(resolve => server.once('listening', resolve));
    try {
      const address = server.address();
      if (!address || typeof address === 'string') throw new Error('Expected a TCP test server.');
      for (const path of ['summary?window=ALL', 'cells?market=CHICAGO', 'documents/nope?limit=1']) {
        const response = await fetch(`http://127.0.0.1:${address.port}/api/transactions/nyc/${path}`);
        expect(response.status).toBe(400);
        await expect(response.json()).resolves.toMatchObject({ error: { code: 'VALIDATION' } });
      }
    } finally { await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); }
  });
});
