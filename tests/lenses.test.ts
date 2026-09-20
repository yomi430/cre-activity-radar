import { existsSync, readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import { classifyPermit } from '../src/domain/lenses.js';
import { createSchema } from '../src/server/db.js';
import { cellsFor, evidenceFor, investigationBriefFor, summaryFor } from '../src/server/repository.js';

const cell = '882664c1a9fffff';
const express = 'PERMIT – EXPRESS PERMIT PROGRAM';

function db() {
  const value = new DatabaseSync(':memory:');
  createSchema(value);
  const report = { source: 'CHICAGO_PERMIT', market: 'CHICAGO', status: 'available', mode: 'public', completeness: 'complete-query', datasetUrl: 'https://example.test', retrievedAt: null, publisherAsOf: null, rowsRead: 0, acceptedRows: 0, rejectedRows: 0, duplicateRows: 0, outOfScopeRows: 0, resolvedRows: 0, unresolvedRows: 0, missingCostRows: 0, reasonCounts: {}, notes: [] };
  value.prepare('INSERT INTO source_reports VALUES(?,?,?)').run('CHICAGO_PERMIT', 'CHICAGO', JSON.stringify(report));
  return value;
}
function insert(value: DatabaseSync, id: string, permitType: string, raw: Record<string, unknown>) {
  value.prepare('INSERT INTO permits VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(id, 'CHICAGO', 'CHICAGO_PERMIT', id, '2025-08-01', id, permitType, null, '100 Lens St', null, null, 41.9, -87.65, cell, JSON.stringify(raw), '[]');
}

describe('auditable CRE lenses', () => {
  it('uses the stored Chicago en dash and no-space Porch raw work type', () => {
    expect(classifyPermit('CHICAGO', express, { work_type: 'Porch,Deck,Balcony,or Fire Escape' })).toMatchObject({ lens: 'REINVESTMENT', confidence: 'MEDIUM', rawWorkType: 'Porch,Deck,Balcony,or Fire Escape' });
    expect(classifyPermit('CHICAGO', 'PERMIT - EXPRESS PERMIT PROGRAM', { work_type: 'Porch,Deck,Balcony,or Fire Escape' })).toMatchObject({ lens: 'UNCLASSIFIED', confidence: 'LOW' });
  });

  it('keeps an unknown future source combination visible as unclassified', () => {
    expect(classifyPermit('NYC', 'Future work type', { work_type: 'Future work type' })).toMatchObject({ lens: 'UNCLASSIFIED', confidence: 'LOW', rawPermitType: 'Future work type', rawWorkType: 'Future work type' });
  });

  it('applies the identical lens selection to summary, cells, brief, and evidence without a score', () => {
    const value = db();
    insert(value, 'porch', express, { work_type: 'Porch,Deck,Balcony,or Fire Escape' });
    insert(value, 'admin', express, { work_type: 'Administrative Change' });
    insert(value, 'future', express, { work_type: 'Future Work Type' });
    const summary = summaryFor(value, 'CHICAGO', 'ALL', 'REINVESTMENT');
    expect(summary.acceptedPermits.current).toBe(1);
    expect(summary.lensMappings).toContainEqual(expect.objectContaining({ rawPermitType: express, rawWorkType: 'Porch,Deck,Balcony,or Fire Escape', lens: 'REINVESTMENT' }));
    expect(summary.selection).toEqual({ permitType: 'ALL', lens: 'REINVESTMENT', propertyUse: 'ALL', minReportedCostCents: null, rank: 'RECORDED_CHANGE', defaultTreatment: 'ALL_RECORDS_WITH_DEPRIORITIZATION', noCompositeScore: true });
    expect(cellsFor(value, 'CHICAGO', 'ALL', 'REINVESTMENT').cells[0]?.permitCount.current).toBe(1);
    expect(investigationBriefFor(value, 'CHICAGO', cell, 'ALL', 'REINVESTMENT')?.permitCount.current).toBe(1);
    const evidence = evidenceFor(value, 'CHICAGO', cell, 'ALL', 'current', 25, 0, 'REINVESTMENT');
    expect(evidence.data.map(row => row.id)).toEqual(['porch']);
    expect(evidence.data[0]?.lens.lens).toBe('REINVESTMENT');
    expect(evidenceFor(value, 'CHICAGO', cell, 'ALL', 'current', 25, 0, 'UNCLASSIFIED').data.map(row => row.id)).toEqual(['future']);
    value.close();
  });

  it('covers every distinct type/work-type combination in the seeded source snapshot', () => {
    const files = [
      { market: 'CHICAGO' as const, raw: 'data/raw/chicago-permits-2024-07-01_2026-07-01.jsonl', demo: 'data/demo/chicago.jsonl', type: 'permit_type' },
      { market: 'NYC' as const, raw: 'data/raw/nyc-permits-2024-07-01_2026-07-01.jsonl', demo: 'data/demo/nyc.jsonl', type: 'work_type' },
    ];
    for (const input of files) {
      const path = existsSync(input.raw) ? input.raw : input.demo;
      const unique = new Map<string, Record<string, unknown>>();
      for (const line of readFileSync(path, 'utf8').trim().split(/\r?\n/)) {
        const raw = JSON.parse(line) as Record<string, unknown>;
        const permitType = typeof raw[input.type] === 'string' && raw[input.type] ? raw[input.type] : 'Unspecified';
        const workType = typeof raw.work_type === 'string' ? raw.work_type : '';
        unique.set(`${permitType}\u0000${workType}`, raw);
      }
      expect(unique.size).toBeGreaterThan(0);
      for (const [key, raw] of unique) {
        const [permitType, workType] = key.split('\u0000');
        const classification = classifyPermit(input.market, permitType!, raw);
        expect(classification.rawPermitType).toBe(permitType);
        expect(classification.rawWorkType ?? '').toBe(workType);
        expect(['GROUND_UP_SITE', 'REINVESTMENT', 'BUILDING_SYSTEMS', 'TEMPORARY_LOGISTICS', 'SIGNAGE', 'ADMIN_LOW_INFORMATION', 'UNCLASSIFIED']).toContain(classification.lens);
        expect(classification.ambiguity).not.toMatch(/not in the versioned mapping/i);
      }
    }
  }, 15_000);
});
