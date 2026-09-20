import { useEffect, useMemo, useState } from 'react';
import type { ZapCellCount, ZapSummaryData, ZapWindow } from '../../shared/contracts';
import { api } from '../api';
import './ZapEntitlements.css';

type StatusCount = { status: string; count: number };
type ZapCell = { h3Cell: string; label: string; distinctProjects: number };
type ZapModel = {
  datasetId: string;
  window: ZapWindow;
  distinctProjects: number;
  placedProjects: number | null;
  statusCounts: StatusCount[];
  cells: ZapCell[];
  filedCoverage: { datedProjects: number; totalProjects: number; share: number | null } | null;
  quality: {
    retrievedAt: string | null;
    publisherAsOf: string | null;
    unvalidatedBbl: number | null;
    plutoUnmatched: number | null;
    coordinateNull: number | null;
    possiblyRemoved: number | null;
    orphanBbl: number | null;
    changeHistoryAvailable: boolean;
    projectSourceUrl: string | null;
    bblSourceUrl: string | null;
    plutoSourceUrl: string | null;
  };
};

const number = new Intl.NumberFormat('en-US');
const dateTime = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' });
const sourceHistoryDisclosure = 'NYC DCP publishes the current project-to-tax-lot association snapshot. This prototype has not yet observed enough publisher versions to determine whether a missing association was removed, replaced, or temporarily omitted. Previously observed associations are therefore flagged for review rather than immediately deleted.';

function modelFrom(summary: ZapSummaryData, cells: ZapCellCount[], datasetId: string): ZapModel {
  const project = summary.sources.find(source => source.source === 'NYC_ZAP_PROJECT_DATA');
  const bbl = summary.sources.find(source => source.source === 'NYC_ZAP_BBL');
  const pluto = summary.sources.find(source => source.source === 'NYC_PLUTO');
  return {
    datasetId,
    window: summary.window,
    distinctProjects: summary.counts.projectCount,
    placedProjects: summary.coverage.placedProjectCells,
    statusCounts: Object.entries(summary.counts.statusCounts).map(([status, count]) => ({ status, count })).sort((a, b) => b.count - a.count || a.status.localeCompare(b.status)),
    cells: cells.map(cell => ({ h3Cell: cell.h3Cell, label: `H3 ${cell.h3Cell}`, distinctProjects: cell.projectCount })).sort((a, b) => b.distinctProjects - a.distinctProjects || a.label.localeCompare(b.label)),
    filedCoverage: { datedProjects: summary.coverage.projectsWithAppFiledDate, totalProjects: summary.coverage.allTrackedProjects, share: summary.coverage.filedDateCoverage },
    quality: {
      retrievedAt: project?.retrievedAt ?? null,
      publisherAsOf: project?.publisherUpdatedAt ?? null,
      unvalidatedBbl: summary.coverage.unvalidatedBblRows,
      plutoUnmatched: summary.coverage.unmatchedParcelRows,
      coordinateNull: summary.coverage.nullCoordinateParcelRows,
      possiblyRemoved: summary.coverage.possiblyRemovedBblRows,
      orphanBbl: summary.coverage.orphanBblRows,
      changeHistoryAvailable: summary.coverage.changeHistoryAvailable,
      projectSourceUrl: project?.datasetUrl ?? null,
      bblSourceUrl: bbl?.datasetUrl ?? null,
      plutoSourceUrl: pluto?.datasetUrl ?? null
    }
  };
}

function statusLabel(status: string) { return ({ ACTIVE: 'Active', ON_HOLD: 'On hold', WITHDRAWN: 'Withdrawn', TERMINATED: 'Terminated', COMPLETED_OTHER: 'Completed / other', UNKNOWN: 'Unknown' } as Record<string, string>)[status] ?? status.replaceAll('_', ' ').toLowerCase(); }
function readableDate(value: string | null) { if (!value) return 'Not reported'; const parsed = new Date(value); return Number.isNaN(parsed.getTime()) ? value : dateTime.format(parsed); }
function metric(value: number | null) { return value === null ? 'Not reported' : number.format(value); }

function exportZap(kind: 'json' | 'html', data: ZapModel) {
  const generatedAt = new Date().toISOString();
  const packet = { generatedAt, datasetId: data.datasetId, scope: data.window === 'ALL_RECORDS' ? 'All tracked NYC ZAP applications' : 'Filed-date subset only; coverage-limited', distinctProjects: data.distinctProjects, statusCounts: data.statusCounts, areaCounts: data.cells, sourceQuality: data.quality, disclosure: sourceHistoryDisclosure, caveats: ['ZAP is a separate earlier-stage entitlement context and does not affect permit queue ranking or qualified signals.', 'Project statuses are publisher labels. Completed / other is not interpreted as an approval outcome.', 'Projects are counted once citywide by project ID. A multi-parcel project can appear in more than one H3 area, so area counts must not be summed into a citywide total.', 'Mapped locations use PLUTO parcel centroids, not project footprints.'] };
  const body = kind === 'json' ? JSON.stringify(packet, null, 2) : `<!doctype html><html><head><meta charset="utf-8"><title>NYC ZAP entitlement evidence</title><style>body{font:15px system-ui;max-width:900px;margin:40px auto;line-height:1.5}table{border-collapse:collapse;width:100%}th,td{border-bottom:1px solid #ddd;padding:7px;text-align:left}</style></head><body><h1>NYC ZAP entitlement evidence</h1><p>Generated ${generatedAt}. ${packet.scope}.</p><h2>Distinct tracked projects</h2><p>${data.distinctProjects}</p><h2>Source history disclosure</h2><p>${sourceHistoryDisclosure}</p><h2>Status counts</h2><table><thead><tr><th>Publisher status grouping</th><th>Projects</th></tr></thead><tbody>${data.statusCounts.map(row => `<tr><td>${statusLabel(row.status)}</td><td>${row.count}</td></tr>`).join('')}</tbody></table><h2>Data quality</h2><p>Snapshot retrieval: ${readableDate(data.quality.retrievedAt)}. Publisher update: ${readableDate(data.quality.publisherAsOf)}. Unvalidated BBL: ${metric(data.quality.unvalidatedBbl)}. PLUTO unmatched: ${metric(data.quality.plutoUnmatched)}. Coordinate null: ${metric(data.quality.coordinateNull)}. Possibly removed: ${metric(data.quality.possiblyRemoved)}.</p></body></html>`;
  const blob = new Blob([body], { type: kind === 'json' ? 'application/json' : 'text/html' });
  const url = URL.createObjectURL(blob), anchor = document.createElement('a');
  anchor.href = url; anchor.download = `nyc-zap-entitlements-${generatedAt.slice(0, 10)}.${kind}`; anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

export function ZapEntitlements() {
  const [window, setWindow] = useState<ZapWindow>('ALL_RECORDS');
  const [data, setData] = useState<ZapModel | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError('');
    Promise.all([api.zapSummary(window, controller.signal), api.zapCells(window, controller.signal)]).then(([summary, cells]) => {
      if (!controller.signal.aborted) setData(modelFrom(summary.data, cells.data, summary.datasetId));
    }).catch(value => { if (!controller.signal.aborted) { setData(null); setError(value instanceof Error ? value.message : 'NYC ZAP entitlement data could not load.'); } }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [window]);
  const topCells = useMemo(() => data?.cells.slice(0, 5) ?? [], [data]);
  return <section className="zap-entitlements" aria-labelledby="zap-title">
    <div className="zap-head"><div><p className="eyebrow">Separate earlier-stage NYC context</p><h2 id="zap-title">NYC ZAP entitlement applications</h2><p>Official land-use applications are shown separately from permits. They do not recolor the H3 heatmap, alter the discovery queue, or change a permit Qualified Signal.</p></div>{data && <div className="zap-export"><button onClick={() => exportZap('json', data)}>Export ZAP JSON</button><button onClick={() => exportZap('html', data)}>Export ZAP evidence</button></div>}</div>
    <fieldset className="zap-window" aria-describedby="zap-window-help"><legend>Application scope</legend><label><input type="radio" name="zap-window" checked={window === 'ALL_RECORDS'} onChange={() => setWindow('ALL_RECORDS')} /> All tracked applications</label><label><input type="radio" name="zap-window" checked={window === 'FILED_24_MONTHS'} onChange={() => setWindow('FILED_24_MONTHS')} /> Filed-date subset</label><small id="zap-window-help">All tracked applications is the default. The filed-date subset is optional and never substitutes for the all-record view.</small></fieldset>
    {loading ? <p className="empty">Loading NYC ZAP entitlement context…</p> : error ? <div className="error inline-error"><p>{error}</p></div> : data && <>
      {window === 'FILED_24_MONTHS' && <aside className="zap-coverage" aria-label="Filed date coverage limitation"><strong>Coverage-limited filed-date subset</strong><p>{data.filedCoverage ? `${number.format(data.filedCoverage.datedProjects)} of ${number.format(data.filedCoverage.totalProjects)} published projects (${((data.filedCoverage.share ?? 0) * 100).toFixed(2)}%) have an app_filed_date.` : 'The publisher did not report filed-date coverage for this snapshot.'} Missing dates do not mean a project is outside the period. Current milestone dates are not used as a substitute for filing dates.</p></aside>}
      <div className="zap-metrics"><div><span>Distinct tracked projects</span><strong>{number.format(data.distinctProjects)}</strong><small>Counted once citywide by project ID.</small></div><div><span>Parcel-centroid placements</span><strong>{data.placedProjects === null ? 'Not reported' : number.format(data.placedProjects)}</strong><small>PLUTO parcel centroid context, not a project footprint.</small></div><div><span>Current snapshot</span><strong>{readableDate(data.quality.publisherAsOf)}</strong><small>Publisher update time; retrieval below.</small></div></div>
      <section className="zap-statuses" aria-labelledby="zap-status-title"><h3 id="zap-status-title">Publisher project status</h3><p>Status is a publisher label, not an approval determination. In particular, “Completed / other” does not mean approved.</p><div>{data.statusCounts.length ? data.statusCounts.map(row => <span key={row.status}><b>{number.format(row.count)}</b> {statusLabel(row.status)}</span>) : <small>No status counts reported in this snapshot.</small>}</div></section>
      <section className="zap-areas" aria-labelledby="zap-area-title"><div><h3 id="zap-area-title">Parcel-centroid area context</h3><p>Projects count once in each H3 area touched by a validated parcel centroid. Multi-cell projects may appear in multiple areas; do not sum these area counts to create a citywide total.</p></div>{topCells.length ? <ol>{topCells.map(item => <li key={item.h3Cell}><span>{item.label}</span><strong>{number.format(item.distinctProjects)} distinct project{item.distinctProjects === 1 ? '' : 's'}</strong><small>H3 {item.h3Cell}</small></li>)}</ol> : <p className="empty">No parcel-centroid area counts are available for this snapshot.</p>}</section>
      <section className="zap-quality" aria-labelledby="zap-quality-title"><div><p className="eyebrow">Required source-history disclosure</p><h3 id="zap-quality-title">ZAP source quality and coverage</h3><p>{sourceHistoryDisclosure}</p></div><dl><div><dt>Snapshot retrieved</dt><dd>{readableDate(data.quality.retrievedAt)}</dd></div><div><dt>Publisher update</dt><dd>{readableDate(data.quality.publisherAsOf)}</dd></div><div><dt>Unvalidated BBL associations</dt><dd>{metric(data.quality.unvalidatedBbl)}</dd></div><div><dt>Orphaned BBL associations</dt><dd>{metric(data.quality.orphanBbl)}</dd></div><div><dt>PLUTO-unmatched associations</dt><dd>{metric(data.quality.plutoUnmatched)}</dd></div><div><dt>Coordinate-null placements</dt><dd>{metric(data.quality.coordinateNull)}</dd></div><div><dt>Possibly removed associations</dt><dd>{data.quality.changeHistoryAvailable ? metric(data.quality.possiblyRemoved) : 'Change history not yet available'}</dd></div></dl><p className="zap-history-status">{data.quality.changeHistoryAvailable ? 'Change history is available for this stored snapshot sequence.' : 'Change history not yet available. Missing associations are flagged for review rather than deleted.'}</p><p className="zap-sources">Official datasets: {data.quality.projectSourceUrl ? <a href={data.quality.projectSourceUrl} target="_blank" rel="noreferrer">Project Data ↗</a> : 'Project Data'} · {data.quality.bblSourceUrl ? <a href={data.quality.bblSourceUrl} target="_blank" rel="noreferrer">ZAP BBL ↗</a> : 'ZAP BBL'} · {data.quality.plutoSourceUrl ? <a href={data.quality.plutoSourceUrl} target="_blank" rel="noreferrer">PLUTO ↗</a> : 'PLUTO'}</p></section>
    </>}
  </section>;
}
