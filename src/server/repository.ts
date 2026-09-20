import type { DatabaseSync } from 'node:sqlite';
import type { ApprovalEvidence, CellSignal, InvestigationBrief, InvestigationDriver, LensId, Market, PermitEvidence, RecordDetail, SourceReport, SummaryData } from '../shared/contracts.js';
import { change } from '../domain/change.js';
import { months, WINDOWS } from '../domain/dates.js';
import { persistenceForCurrent, sortDrivers, surfacedNarrative } from '../domain/investigation.js';
import { polygonFor } from '../domain/spatial.js';
import { classifyPermit, LENS_DEFINITIONS, lensWhere, mappingsForMarket } from '../domain/lenses.js';

type PermitRow = { id: string; market: Market; source: 'CHICAGO_PERMIT' | 'NYC_DOB_NOW'; event_date: string; permit_number: string | null; permit_type: string; reported_cost_cents: number | null; address: string | null; description: string | null; h3_cell: string | null; lat: number | null; lng: number | null; warnings_json: string; raw_json: string };
const dates = [WINDOWS.prior.start, WINDOWS.prior.endExclusive, WINDOWS.current.start, WINDOWS.current.endExclusive];
function filterWhere(market: Market, permitType: string, lens: LensId) {
  const type = permitType === 'ALL' ? { clause: '', params: [] as string[] } : { clause: ' AND permit_type = ?', params: [permitType] };
  const category = lensWhere(market, lens);
  return { clause: `${type.clause}${category.clause}`, params: [...type.params, ...category.params] };
}
function selection(permitType: string, lens: LensId) { return { permitType, lens, defaultTreatment: 'ALL_RECORDS_WITH_DEPRIORITIZATION' as const, noCompositeScore: true as const }; }
function comparable(db: DatabaseSync, market: Market): boolean { const reports = reportsFor(db, market).filter(r => r.source !== 'SBA_504'); return reports.length > 0 && reports.every(r => r.completeness === 'complete-query'); }
function countChange(db: DatabaseSync, market: Market, permitType: string, lens: LensId, mapped: boolean | null) {
  const filter = filterWhere(market, permitType, lens); const mapClause = mapped ? ' AND h3_cell IS NOT NULL' : mapped === false ? ' AND h3_cell IS NULL' : '';
  const row = db.prepare(`SELECT SUM(CASE WHEN event_date >= ? AND event_date < ? THEN 1 ELSE 0 END) AS prior, SUM(CASE WHEN event_date >= ? AND event_date < ? THEN 1 ELSE 0 END) AS current FROM permits WHERE market = ?${mapClause}${filter.clause}`).get(dates[0], dates[1], dates[2], dates[3], market, ...filter.params) as { prior: number | null; current: number | null };
  return change(row.current ?? 0, row.prior ?? 0, comparable(db, market));
}
export function reportsFor(db: DatabaseSync, market: Market): SourceReport[] { return (db.prepare('SELECT report_json FROM source_reports WHERE market = ? ORDER BY source').all(market) as Array<{ report_json: string }>).map(x => JSON.parse(x.report_json) as SourceReport); }
export function summaryFor(db: DatabaseSync, market: Market, permitType: string, lens: LensId = 'ALL'): SummaryData {
  const typeRows = db.prepare('SELECT DISTINCT permit_type FROM permits WHERE market = ? ORDER BY permit_type').all(market) as Array<{ permit_type: string }>;
  const sourceReports = reportsFor(db, market); const approval = sbaFor(db, market);
  return { market, mode: sourceReports.some(r => r.mode === 'public') ? 'public' : 'synthetic', windows: WINDOWS, comparable: comparable(db, market), permitTypes: typeRows.map(x => x.permit_type), lenses: [...LENS_DEFINITIONS], lensMappings: mappingsForMarket(market), selection: selection(permitType, lens), acceptedPermits: countChange(db, market, permitType, lens, null), mappedPermits: countChange(db, market, permitType, lens, true), unmappedPermits: countChange(db, market, permitType, lens, false), sources: sourceReports, sba: approval };
}
export function cellsFor(db: DatabaseSync, market: Market, permitType: string, lens: LensId = 'ALL') {
  const filter = filterWhere(market, permitType, lens); const rows = db.prepare(`SELECT h3_cell, MIN(address) AS address, SUM(CASE WHEN event_date >= ? AND event_date < ? THEN 1 ELSE 0 END) AS prior, SUM(CASE WHEN event_date >= ? AND event_date < ? THEN 1 ELSE 0 END) AS current FROM permits WHERE market = ? AND h3_cell IS NOT NULL${filter.clause} GROUP BY h3_cell HAVING prior > 0 OR current > 0 ORDER BY current DESC, h3_cell`).all(dates[0], dates[1], dates[2], dates[3], market, ...filter.params) as Array<{ h3_cell: string; address: string | null; prior: number; current: number }>;
  // The collection drives the map/list and does not need 24 monthly values per cell.
  // Monthly data is calculated only for the selected-cell detail endpoint.
  const isComparable = comparable(db, market);
  const cells = rows.map(row => { const permitCount = change(row.current ?? 0, row.prior ?? 0, isComparable); return { market, h3Cell: row.h3_cell, label: row.address ? `Near ${row.address}` : `${market === 'NYC' ? 'NYC' : 'Chicago'} H3 ${row.h3_cell.slice(-5)}`, permitCount, monthly: [], lowVolume: permitCount.current + permitCount.previous < 5 } satisfies CellSignal; });
  return { cells, geojson: { type: 'FeatureCollection' as const, features: cells.map(cell => ({ type: 'Feature' as const, properties: { h3Cell: cell.h3Cell, current: cell.permitCount.current, label: cell.label }, geometry: { type: 'Polygon' as const, coordinates: polygonFor(cell.h3Cell) } })) } };
}
export function signalFor(db: DatabaseSync, market: Market, cell: string, permitType: string, lens: LensId = 'ALL'): CellSignal | null {
  const filter = filterWhere(market, permitType, lens); const row = db.prepare(`SELECT SUM(CASE WHEN event_date >= ? AND event_date < ? THEN 1 ELSE 0 END) AS prior, SUM(CASE WHEN event_date >= ? AND event_date < ? THEN 1 ELSE 0 END) AS current FROM permits WHERE market = ? AND h3_cell = ?${filter.clause}`).get(dates[0], dates[1], dates[2], dates[3], market, cell, ...filter.params) as { prior: number | null; current: number | null };
  if (!(row.prior ?? 0) && !(row.current ?? 0)) return null;
  const monthlyRows = db.prepare(`SELECT substr(event_date, 1, 7) AS month, COUNT(*) AS count FROM permits WHERE market = ? AND h3_cell = ?${filter.clause} GROUP BY month`).all(market, cell, ...filter.params) as Array<{ month: string; count: number }>;
  const values = new Map(monthlyRows.map(x => [x.month, x.count])); const permitCount = change(row.current ?? 0, row.prior ?? 0, comparable(db, market));
  const address = (db.prepare(`SELECT MIN(address) AS address FROM permits WHERE market = ? AND h3_cell = ?${filter.clause}`).get(market, cell, ...filter.params) as { address: string | null }).address;
  return { market, h3Cell: cell, label: address ? `Near ${address}` : `${market === 'NYC' ? 'NYC' : 'Chicago'} H3 ${cell.slice(-5)}`, permitCount, monthly: months().map(month => ({ month, count: values.get(month) ?? 0 })), lowVolume: permitCount.current + permitCount.previous < 5 };
}

function sourceSemantics(market: Market): string {
  return market === 'CHICAGO'
    ? 'Chicago Building Permits records are recorded permit issuances. They are not unique development projects or construction starts.'
    : 'NYC DOB NOW: Build records are approved permit issuances. The source does not represent all NYC permit systems, and records are not unique development projects.';
}

/**
 * Builds an auditable research queue item from source records for one H3 cell.
 * The output intentionally contains no modeled score, causal claim, or prediction.
 */
export function investigationBriefFor(db: DatabaseSync, market: Market, cell: string, permitType: string, lens: LensId = 'ALL'): InvestigationBrief | null {
  const signal = signalFor(db, market, cell, permitType, lens);
  if (!signal) return null;
  const filter = filterWhere(market, permitType, lens);
  const base = `market = ? AND h3_cell = ?${filter.clause}`;
  const baseParams = [market, cell, ...filter.params];
  const counts = signal.permitCount;
  const totalCurrent = counts.current;
  const drivers = sortDrivers((db.prepare(`SELECT permit_type AS permitType,
      SUM(CASE WHEN event_date >= ? AND event_date < ? THEN 1 ELSE 0 END) AS prior,
      SUM(CASE WHEN event_date >= ? AND event_date < ? THEN 1 ELSE 0 END) AS current
      FROM permits WHERE ${base} GROUP BY permit_type HAVING prior > 0 OR current > 0`)
    .all(dates[0], dates[1], dates[2], dates[3], ...baseParams) as Array<{ permitType: string; prior: number; current: number }>)
    .map(row => ({ permitType: row.permitType, prior: row.prior ?? 0, current: row.current ?? 0, absolute: (row.current ?? 0) - (row.prior ?? 0), currentShare: totalCurrent > 0 ? (row.current ?? 0) / totalCurrent : null } satisfies InvestigationDriver))).slice(0, 5);
  const persistence = persistenceForCurrent(signal.monthly);
  const missing = db.prepare(`SELECT COUNT(*) AS n FROM permits WHERE ${base} AND event_date >= ? AND event_date < ? AND reported_cost_cents IS NULL`)
    .get(...baseParams, WINDOWS.current.start, WINDOWS.current.endExclusive) as { n: number };
  const addressRows = db.prepare(`SELECT address,
      SUM(CASE WHEN event_date >= ? AND event_date < ? THEN 1 ELSE 0 END) AS prior,
      SUM(CASE WHEN event_date >= ? AND event_date < ? THEN 1 ELSE 0 END) AS current
      FROM permits WHERE ${base} AND address IS NOT NULL AND trim(address) <> ''
      GROUP BY address HAVING current > 0
      ORDER BY (current - prior) DESC, current DESC, address ASC LIMIT 5`)
    .all(dates[0], dates[1], dates[2], dates[3], ...baseParams) as Array<{ address: string; prior: number; current: number }>;
  const repeatedAddresses = addressRows.map(row => {
    const ids = (db.prepare(`SELECT id FROM permits WHERE ${base} AND address = ? AND event_date >= ? AND event_date < ? ORDER BY event_date DESC, id ASC LIMIT 10`)
      .all(...baseParams, row.address, WINDOWS.current.start, WINDOWS.current.endExclusive) as Array<{ id: string }>).map(record => record.id);
    const params = new URLSearchParams({ market, permitType, lens, period: 'current' });
    return { address: row.address, prior: row.prior ?? 0, current: row.current ?? 0, absolute: (row.current ?? 0) - (row.prior ?? 0), currentRecordIds: ids, evidencePath: `/api/cells/${cell}/evidence?${params.toString()}` };
  });
  const largestCurrentPermits = (db.prepare(`SELECT id, event_date, address, permit_type, reported_cost_cents FROM permits WHERE ${base}
      AND event_date >= ? AND event_date < ? AND reported_cost_cents IS NOT NULL
      ORDER BY reported_cost_cents DESC, event_date DESC, id ASC LIMIT 5`)
    .all(...baseParams, WINDOWS.current.start, WINDOWS.current.endExclusive) as Array<{ id: string; event_date: string; address: string | null; permit_type: string; reported_cost_cents: number }>)
    .map(row => ({ id: row.id, date: row.event_date, address: row.address, permitType: row.permit_type, reportedCostCents: row.reported_cost_cents, recordPath: `/api/records/${encodeURIComponent(row.id)}` }));
  const facts = [
    `${counts.current} current-window record${counts.current === 1 ? '' : 's'} versus ${counts.previous} prior-window record${counts.previous === 1 ? '' : 's'} (${counts.absolute >= 0 ? '+' : ''}${counts.absolute}).`,
    persistence.peakMonth ? `${persistence.activeMonthsCurrent} active current-window month${persistence.activeMonthsCurrent === 1 ? '' : 's'}; peak ${persistence.peakMonth} with ${persistence.peakMonthCount} record${persistence.peakMonthCount === 1 ? '' : 's'}.` : 'No current-window records were observed.',
    `${missing.n ?? 0} of ${counts.current} current-window record${counts.current === 1 ? '' : 's'} ${missing.n === 1 ? 'is' : 'are'} missing a reported cost.`,
  ];
  const canSuggest = [
    counts.absolute > 0 ? 'The selected area has more recorded permit activity in the current fixed window than in the prior window.' : counts.absolute < 0 ? 'The selected area has fewer recorded permit activity records in the current fixed window than in the prior window.' : 'The selected area has the same number of recorded permit activity records in both fixed windows.',
    persistence.activeMonthsCurrent > 1 ? `Recorded activity appeared in ${persistence.activeMonthsCurrent} current-window months.` : 'The timing shown is limited to the recorded permit dates in this source.',
  ];
  const cannotConclude = [
    'This evidence does not establish new supply, tenant demand, rent growth, property value, or investment performance.',
    'Permit issuance records are not unique projects, construction starts, completed work, or a commercial-only activity measure.',
    'Reported costs are applicant-reported estimates; they should not be summed as construction investment.',
  ];
  const recommendedNextChecks = [
    'Open the listed source records and verify permit descriptions, dates, and addresses before treating the change as an investigation lead.',
    ...(repeatedAddresses.length > 0 ? [`Check whether records at ${repeatedAddresses[0]!.address} describe one site, repeated filings, or separate work.`] : []),
    ...(largestCurrentPermits.length > 0 ? ['Review the largest reported-cost records individually; reported costs are incomplete and are not investment totals.'] : []),
    ...(missing.n > 0 ? ['Account for records without a reported cost before using cost fields in further research.'] : []),
    ...(counts.basis === 'NO_BASELINE' ? ['Check prior-period source coverage and record semantics before interpreting a zero prior count as a new trend.'] : []),
  ];
  return {
    market, h3Cell: cell, permitType, lens, selection: selection(permitType, lens), label: signal.label, windows: WINDOWS, permitCount: counts,
    whySurfaced: { narrative: surfacedNarrative(counts, permitType), facts }, drivers,
    activityPersistence: persistence, repeatedAddresses, largestCurrentPermits,
    dataQuality: {
      mappedEvidence: { current: counts.current, prior: counts.previous, note: 'All evidence in this brief has a source coordinate assigned to this H3 visualization cell.' },
      missingReportedCost: { current: missing.n ?? 0, currentShare: totalCurrent > 0 ? (missing.n ?? 0) / totalCurrent : null, caveat: 'Missing reported cost is not zero. Reported costs remain record-level evidence and are not a project or investment total.' },
      sourceSemantics: sourceSemantics(market),
    },
    canSuggest, cannotConclude, recommendedNextChecks,
  };
}
export function evidenceFor(db: DatabaseSync, market: Market, cell: string, type: string, period: 'prior' | 'current', limit: number, offset: number, lens: LensId = 'ALL') {
  const filter = filterWhere(market, type, lens); const w = WINDOWS[period]; const where = `market = ? AND h3_cell = ? AND event_date >= ? AND event_date < ?${filter.clause}`;
  const total = (db.prepare(`SELECT COUNT(*) AS n FROM permits WHERE ${where}`).get(market, cell, w.start, w.endExclusive, ...filter.params) as { n: number }).n;
  const rows = db.prepare(`SELECT * FROM permits WHERE ${where} ORDER BY event_date DESC, id LIMIT ? OFFSET ?`).all(market, cell, w.start, w.endExclusive, ...filter.params, limit, offset) as PermitRow[];
  return { data: rows.map(evidence), total };
}
function evidence(row: PermitRow): PermitEvidence { return { id: row.id, market: row.market, source: row.source, date: row.event_date, permitNumber: row.permit_number, permitType: row.permit_type, lens: classifyPermit(row.market, row.permit_type, JSON.parse(row.raw_json) as Record<string, unknown>), address: row.address, description: row.description, reportedCostCents: row.reported_cost_cents, h3Cell: row.h3_cell, point: row.lat === null || row.lng === null ? null : { lat: row.lat, lng: row.lng, precision: 'SOURCE_COORDINATE', provider: row.source }, warnings: JSON.parse(row.warnings_json) }; }
export function recordFor(db: DatabaseSync, id: string): RecordDetail | null {
  const permit = db.prepare('SELECT * FROM permits WHERE id = ?').get(id) as PermitRow | undefined;
  if (permit) return { id, normalized: evidence(permit), raw: JSON.parse(permit.raw_json), sourceUrl: permit.source === 'CHICAGO_PERMIT' ? `https://data.cityofchicago.org/resource/ydr8-5enu.json?id=${encodeURIComponent(permit.id.split(':')[1]!)}` : `https://data.cityofnewyork.us/resource/rbx6-tga4.json?$where=${encodeURIComponent(`source_row_id='${permit.id.split(':')[1]!}'`)}`, warnings: JSON.parse(permit.warnings_json) };
  const approval = db.prepare('SELECT * FROM approvals WHERE id = ?').get(id) as { market: Market; event_date: string; borrower_name: string | null; approval_amount_cents: number; loan_status: string | null; city: string; state: string; raw_json: string } | undefined;
  return approval ? { id, normalized: { id, market: approval.market, source: 'SBA_504', date: approval.event_date, borrowerName: approval.borrower_name, approvalAmountCents: approval.approval_amount_cents, status: approval.loan_status, city: approval.city, state: approval.state, geographyBasis: 'BORROWER_CITY' }, raw: JSON.parse(approval.raw_json), sourceUrl: 'https://data.sba.gov/dataset/7a-504-foia', warnings: ['Borrower-city context; not assigned to a permit cell.'] } : null;
}
export function approvalsFor(db: DatabaseSync, market: Market, period: 'prior' | 'current', limit: number, offset: number) { const w = WINDOWS[period]; const where = 'market = ? AND event_date >= ? AND event_date < ?'; const total = (db.prepare(`SELECT COUNT(*) AS n FROM approvals WHERE ${where}`).get(market, w.start, w.endExclusive) as { n: number }).n; const rows = db.prepare(`SELECT * FROM approvals WHERE ${where} ORDER BY event_date DESC, id LIMIT ? OFFSET ?`).all(market, w.start, w.endExclusive, limit, offset) as Array<{ id: string; market: Market; event_date: string; borrower_name: string | null; approval_amount_cents: number; loan_status: string | null; city: string; state: string }>;
  return { total, data: rows.map(x => ({ id: x.id, market: x.market, source: 'SBA_504' as const, date: x.event_date, borrowerName: x.borrower_name, approvalAmountCents: x.approval_amount_cents, status: x.loan_status, city: x.city, state: x.state, geographyBasis: 'BORROWER_CITY' as const })) }; }
function sbaFor(db: DatabaseSync, market: Market) { const source = reportsFor(db, market).find(r => r.source === 'SBA_504'); if (!source || source.status === 'unavailable') return { status: 'unavailable' as const, geographyLabel: 'SBA 504 city context unavailable', approvalCount: null, approvalAmountCents: null, note: source?.notes[0] ?? 'No verified SBA source was seeded.' }; const row = db.prepare('SELECT SUM(CASE WHEN event_date >= ? AND event_date < ? THEN 1 ELSE 0 END) AS pc, SUM(CASE WHEN event_date >= ? AND event_date < ? THEN 1 ELSE 0 END) AS cc, SUM(CASE WHEN event_date >= ? AND event_date < ? THEN approval_amount_cents ELSE 0 END) AS pa, SUM(CASE WHEN event_date >= ? AND event_date < ? THEN approval_amount_cents ELSE 0 END) AS ca FROM approvals WHERE market = ?').get(dates[0], dates[1], dates[2], dates[3], dates[0], dates[1], dates[2], dates[3], market) as { pc: number; cc: number; pa: number; ca: number }; return { status: 'available' as const, geographyLabel: market === 'CHICAGO' ? 'Chicago-labelled borrower city, Illinois; not a municipal-boundary match' : 'Five explicit borough-labelled borrower cities, New York; aliases such as Flushing are excluded', approvalCount: change(row.cc ?? 0, row.pc ?? 0, true), approvalAmountCents: change(row.ca ?? 0, row.pa ?? 0, true), note: 'SBA 504 approval records use verified borrower-city fields; approvals are not disbursements or permit-area activity. Loan status is later status as of 2026-06-30.' }; }
