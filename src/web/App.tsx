import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ApprovalEvidence, CellSignal, Market, PermitEvidence, RecordDetail, SourceReport, SummaryData } from '../shared/contracts';
import { api } from './api';
import { ActivityMap } from './components/ActivityMap';

const number = new Intl.NumberFormat('en-US');
const dollars = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const periodLabel = (period: 'current' | 'prior') => period === 'current' ? 'Jul 2025–Jun 2026' : 'Jul 2024–Jun 2025';

function change(data: CellSignal['permitCount']) {
  if (data.basis === 'INCOMPLETE') return 'Comparison unavailable';
  if (data.percent === null) return data.basis === 'NO_BASELINE' ? 'New activity' : 'No baseline';
  return `${data.percent >= 0 ? '+' : ''}${data.percent.toFixed(0)}%`;
}

function Metric({ label, value, note }: { label: string; value: string; note?: string }) { return <div className="metric"><span>{label}</span><strong>{value}</strong>{note && <small>{note}</small>}</div>; }

function Evidence({ market, cell, permitType, open }: { market: Market; cell: string; permitType: string; open: (id: string) => void }) {
  const [period, setPeriod] = useState<'current' | 'prior'>('current');
  const [offset, setOffset] = useState(0);
  const [rows, setRows] = useState<PermitEvidence[]>([]);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => { setPeriod('current'); setOffset(0); }, [market, cell, permitType]);
  useEffect(() => {
    const controller = new AbortController();
    setError(''); setRows([]); setTotal(0); setLoading(true);
    api.evidence(market, cell, permitType, period, offset, controller.signal)
      .then(response => { setRows(response.data); setTotal(response.pagination?.total ?? response.data.length); })
      .catch(error => { if (!controller.signal.aborted) setError(error.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [market, cell, permitType, period, offset, attempt]);

  return <section className="evidence" aria-live="polite">
    <div className="section-head"><div><h3>Permit evidence</h3><p>Records assigned to this H3 area.</p></div><div className="tabs" aria-label="Evidence period"><button className={period === 'current' ? 'active' : ''} aria-pressed={period === 'current'} onClick={() => { setPeriod('current'); setOffset(0); }}>Current</button><button className={period === 'prior' ? 'active' : ''} aria-pressed={period === 'prior'} onClick={() => { setPeriod('prior'); setOffset(0); }}>Prior</button></div></div>
    <p className="period-caption">{periodLabel(period)}</p>
    {loading ? <p className="empty">Loading evidence…</p> : error ? <div className="error inline-error"><p>{error}</p><button onClick={() => setAttempt(value => value + 1)}>Retry</button></div> : rows.length === 0 ? <p className="empty">No records for this period and type.</p> : <div className="table-wrap"><table><thead><tr><th>Date</th><th>Type / address</th><th>Estimate</th></tr></thead><tbody>{rows.map(row => <tr key={row.id}><td>{row.date}</td><td><button className="record-link" onClick={() => open(row.id)}>{row.permitType}</button><small>{row.address ?? 'Address unavailable'}</small></td><td>{row.reportedCostCents === null ? 'Not reported' : dollars.format(row.reportedCostCents / 100)}</td></tr>)}</tbody></table></div>}
    <div className="pager"><span>{total ? `${offset + 1}–${Math.min(offset + 25, total)} of ${total}` : ''}</span><button disabled={!offset || loading} onClick={() => setOffset(Math.max(0, offset - 25))}>Previous</button><button disabled={loading || offset + 25 >= total} onClick={() => setOffset(offset + 25)}>Next</button></div>
  </section>;
}

function Detail({ signal, market, permitType, open }: { signal: CellSignal; market: Market; permitType: string; open: (id: string) => void }) {
  const max = Math.max(1, ...signal.monthly.map(item => item.count));
  return <><div className="detail-head"><div><p className="eyebrow">Selected H3 area</p><h2>{signal.label}</h2><p className="mono">{signal.h3Cell}</p></div><div className="change"><strong>{signal.permitCount.absolute >= 0 ? '+' : ''}{number.format(signal.permitCount.absolute)}</strong><span>{change(signal.permitCount)}</span></div></div><div className="detail-metrics"><Metric label="Current" value={number.format(signal.permitCount.current)} /><Metric label="Prior" value={number.format(signal.permitCount.previous)} /><Metric label="Precision" value="Source coordinate" note="Mapped permits only" /></div><section className="chart"><h3>Monthly permit count</h3><svg viewBox="0 0 480 112" role="img" aria-label="Monthly permit counts"><title>Monthly permit counts</title>{signal.monthly.map((item, index) => <rect key={item.month} x={index * 20 + 2} y={98 - item.count / max * 88} width="16" height={item.count / max * 88} rx="1"><title>{`${item.month}: ${item.count}`}</title></rect>)}<line x1="0" x2="480" y1="99" y2="99" /></svg><div className="chart-labels"><span>{signal.monthly[0]?.month}</span><span>{signal.monthly[11]?.month}</span><span>{signal.monthly[23]?.month}</span></div><details><summary>Monthly values</summary><p>{signal.monthly.map(item => `${item.month}: ${item.count}`).join(' · ')}</p></details></section><Evidence market={market} cell={signal.h3Cell} permitType={permitType} open={open} /></>;
}

function Sba({ market, summary, open }: { market: Market; summary: SummaryData; open: (id: string) => void }) {
  const [rows, setRows] = useState<ApprovalEvidence[]>([]);
  const [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController(); setRows([]); setError('');
    if (summary.sba.status === 'unavailable') return () => controller.abort();
    api.approvals(market, controller.signal).then(response => setRows(response.data)).catch(error => { if (!controller.signal.aborted) setError(error.message); });
    return () => controller.abort();
  }, [market, summary.sba.status]);
  const item = summary.sba;
  return <section className="sba"><p className="eyebrow">City-level context</p><h2>SBA 504 approvals</h2><p>{item.geographyLabel}</p>{item.status === 'unavailable' ? <p className="unavailable">Unavailable — {item.note}</p> : <><div className="sba-metrics"><Metric label="Current approvals" value={item.approvalCount ? number.format(item.approvalCount.current) : '—'} /><Metric label="Approval amount" value={item.approvalAmountCents ? dollars.format(item.approvalAmountCents.current / 100) : '—'} /></div><p className="hint">{item.note} These records never belong to a permit area.</p>{error ? <p className="error inline-error">SBA evidence could not load: {error}</p> : <div className="approval-list">{rows.slice(0, 4).map(row => <button key={row.id} onClick={() => open(row.id)}><span>{row.date} · {row.borrowerName ?? 'Borrower unavailable'}</span><strong>{dollars.format(row.approvalAmountCents / 100)}</strong></button>)}</div>}</>}</section>;
}

function Sources({ sources }: { sources: SourceReport[] }) { return <section className="source-health"><h2>Source quality</h2>{sources.length ? sources.map(source => <div className="source-row" key={`${source.market}-${source.source}`}><strong>{source.source.replaceAll('_', ' ')}</strong><span className={source.status}>{source.status}</span><span>{source.completeness.replaceAll('-', ' ')}</span><span>{number.format(source.acceptedRows)} accepted · {number.format(source.rejectedRows)} rejected · {number.format(source.duplicateRows)} duplicate</span><span>{number.format(source.resolvedRows)} mapped · {number.format(source.unresolvedRows)} unmatched · {number.format(source.missingCostRows)} missing costs</span><span>{source.retrievedAt ? `Retrieved ${new Date(source.retrievedAt).toLocaleDateString()}` : 'Retrieval time unavailable'}</span><a href={source.datasetUrl} target="_blank" rel="noreferrer">Source ↗</a>{source.notes[0] && <small>{source.notes[0]}</small>}</div>) : <p>Source reports unavailable.</p>}</section>; }

function Dialog({ record, close }: { record: RecordDetail; close: () => void }) {
  const closeButton = useRef<HTMLButtonElement>(null);
  useEffect(() => { const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null; closeButton.current?.focus(); const keydown = (event: KeyboardEvent) => { if (event.key === 'Escape') close(); }; document.addEventListener('keydown', keydown); return () => { document.removeEventListener('keydown', keydown); previous?.focus(); }; }, [close]);
  return <div className="dialog-backdrop" onMouseDown={close}><section className="dialog" role="dialog" aria-modal="true" aria-labelledby="record-dialog-title" onMouseDown={event => event.stopPropagation()}><button ref={closeButton} className="close" onClick={close}>Close</button><p className="eyebrow">Retained source fields</p><h2 id="record-dialog-title">Record provenance</h2><a href={record.sourceUrl} target="_blank" rel="noreferrer">Open official source ↗</a><pre>{JSON.stringify(record.raw, null, 2)}</pre>{record.warnings.length > 0 && <p className="warning">{record.warnings.join(' · ')}</p>}</section></div>;
}

export function App() {
  const [market, setMarket] = useState<Market>('CHICAGO'); const [type, setType] = useState('ALL'); const [summary, setSummary] = useState<SummaryData | null>(null); const [cells, setCells] = useState<{ cells: CellSignal[]; geojson: GeoJSON.FeatureCollection } | null>(null); const [sources, setSources] = useState<SourceReport[]>([]); const [selected, setSelected] = useState<string | null>(null); const [detail, setDetail] = useState<CellSignal | null>(null); const [record, setRecord] = useState<RecordDetail | null>(null); const [low, setLow] = useState(false); const [sort, setSort] = useState<'change' | 'count'>('change'); const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const [reload, setReload] = useState(0); const recordRequest = useRef<AbortController | null>(null);
  useEffect(() => { const controller = new AbortController(); setLoading(true); setError(''); setSummary(null); setCells(null); setSources([]); setSelected(null); setDetail(null); setRecord(null); Promise.all([api.summary(market, type, controller.signal), api.cells(market, type, controller.signal), api.sources(market, controller.signal)]).then(([summaryResponse, cellsResponse, sourceResponse]) => { setSummary(summaryResponse.data); setCells(cellsResponse.data); setSources(sourceResponse.data); }).catch(error => { if (!controller.signal.aborted) setError(error.message); }).finally(() => { if (!controller.signal.aborted) setLoading(false); }); return () => controller.abort(); }, [market, type, reload]);
  useEffect(() => { if (!selected) { setDetail(null); return; } const controller = new AbortController(); setDetail(null); api.cell(market, selected, type, controller.signal).then(response => setDetail(response.data)).catch(error => { if (!controller.signal.aborted) setError(error.message); }); return () => controller.abort(); }, [market, selected, type]);
  useEffect(() => () => recordRequest.current?.abort(), []);
  const visible = useMemo(() => (cells?.cells ?? []).filter(item => low || !item.lowVolume).sort((a, b) => sort === 'count' || !summary?.comparable ? b.permitCount.current - a.permitCount.current || a.h3Cell.localeCompare(b.h3Cell) : b.permitCount.absolute - a.permitCount.absolute || b.permitCount.current - a.permitCount.current || a.h3Cell.localeCompare(b.h3Cell)), [cells, low, sort, summary?.comparable]);
  const mapGeo = useMemo(() => ({ type: 'FeatureCollection' as const, features: (cells?.geojson.features ?? []).filter(feature => visible.some(item => item.h3Cell === (feature.properties as { h3Cell: string } | null)?.h3Cell)) }), [cells, visible]);
  const selectCell = useCallback((cell: string) => setSelected(cell), []);
  useEffect(() => { if (selected && !visible.some(item => item.h3Cell === selected)) setSelected(null); }, [selected, visible]);
  const open = useCallback((id: string) => { recordRequest.current?.abort(); const controller = new AbortController(); recordRequest.current = controller; setError(''); api.record(id, controller.signal).then(response => { if (!controller.signal.aborted) setRecord(response.data); }).catch(error => { if (!controller.signal.aborted) setError(error.message); }); }, []);
  const switchMarket = (value: Market) => { if (value !== market) { recordRequest.current?.abort(); setMarket(value); setType('ALL'); setSelected(null); setDetail(null); setRecord(null); } };
  const incomplete = summary && !summary.comparable;
  return <main className="app"><header className="topbar"><div><p className="eyebrow">Frozen permit comparison</p><h1>CRE Activity Radar</h1><p className="subtitle">See where recorded permit activity changed, then inspect the records behind it.</p></div><label className="market-select">Market<select value={market} onChange={event => switchMarket(event.target.value as Market)}><option value="CHICAGO">Chicago</option><option value="NYC">New York City</option></select></label></header>{error && <div className="error banner"><span>{error}</span><button onClick={() => setReload(value => value + 1)}>Retry</button></div>}{loading && !summary ? <div className="loading">Loading the local dataset…</div> : summary && <><section className="overview"><div className={`badge ${summary.mode}`}>{summary.mode === 'public' ? 'Public snapshot' : 'Synthetic demo'}</div><p className="dates">Jul 2025–Jun 2026 versus Jul 2024–Jun 2025<br /><small>{summary.windows.current.start} to {summary.windows.current.endExclusive} versus {summary.windows.prior.start} to {summary.windows.prior.endExclusive}</small></p><Metric label="Accepted permits" value={number.format(summary.acceptedPermits.current)} note={incomplete ? 'Comparison unavailable: incomplete source' : `${summary.acceptedPermits.absolute >= 0 ? '+' : ''}${number.format(summary.acceptedPermits.absolute)} vs prior`} /><Metric label="Mapped to areas" value={number.format(summary.mappedPermits.current)} note={`${number.format(summary.unmappedPermits.current)} unmapped`} /><label className="type-filter">Permit type<select value={type} onChange={event => { setType(event.target.value); setSelected(null); }}><option value="ALL">All types</option>{summary.permitTypes.map(item => <option key={item}>{item}</option>)}</select></label></section>{incomplete && <p className="comparison-note">This source is incomplete. Growth percentages and increase ranking are unavailable; areas are ordered by current permit count.</p>}<section className="workspace"><div className="map-panel"><div className="panel-heading"><div><h2>Activity by H3 area</h2><p>Color shows current permit count.</p></div><span className="legend"><i /> Fewer <b /> More</span></div><ActivityMap geojson={mapGeo} market={market} selected={selected} onSelect={selectCell} /><p className="map-note">H3 cells support comparison; the workflow remains useful with map tiles blocked.</p></div><aside className="areas"><div className="section-head"><div><h2>Areas to investigate</h2><p>{low ? `${visible.length} areas` : 'Areas with 5+ permits across both periods'}</p></div><select aria-label="Area sort" value={sort} onChange={event => setSort(event.target.value as 'change' | 'count')}><option value="change" disabled={Boolean(incomplete)}>Largest increase</option><option value="count">Current count</option></select></div><label className="toggle"><input type="checkbox" checked={low} onChange={event => setLow(event.target.checked)} /> Show low-volume areas</label><div className="area-list">{visible.length ? visible.map(item => <button className={`area ${selected === item.h3Cell ? 'active' : ''}`} key={item.h3Cell} onClick={() => selectCell(item.h3Cell)}><span>{item.label}<small>{item.h3Cell}</small></span><strong>{number.format(item.permitCount.current)}<em>{incomplete ? 'Comparison unavailable' : `${item.permitCount.absolute >= 0 ? '+' : ''}${number.format(item.permitCount.absolute)}`}</em></strong></button>) : <p className="empty">No mapped areas match this filter.</p>}</div></aside></section><section className="lower"><div className="detail">{detail ? <Detail signal={detail} market={market} permitType={type} open={open} /> : selected ? <div className="empty-detail"><h2>Loading area</h2><p>Getting the selected area’s counts and evidence.</p></div> : <div className="empty-detail"><h2>Select an area</h2><p>Choose a map polygon or an area-list row to see permit evidence.</p></div>}</div><Sba market={market} summary={summary} open={open} /></section><Sources sources={sources} /></>}{record && <Dialog record={record} close={() => setRecord(null)} />}</main>;
}
