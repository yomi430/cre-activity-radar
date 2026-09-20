import { useEffect, useMemo, useState, type FormEvent } from 'react';
import type { AcrisDocumentEvidence } from '../../shared/contracts';
import { api, type RecordedDeedCell, type RecordedDeedSummary } from '../api';
import './RecordedDeeds.css';

type Model = Omit<RecordedDeedSummary, 'cells'> & { datasetId: string; cells: RecordedDeedCell[] };

const number = new Intl.NumberFormat('en-US');
const dateTime = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' });
const coverageStatement = 'ACRIS recorded-deed context: four boroughs; Staten Island is not covered.';
const caveats = [
  'This is a separately sourced public-record context. It does not recolor the permit map, change permit ranking, or change a Qualified Signal.',
  'Only the exact raw ACRIS document type DEED is included. Similar or compound values, including DEED, TS, remain excluded and counted as coverage context.',
  'Recorded date is recorded_datetime. document_date is retained as source evidence but is not the event date used here.',
  'ACRIS document_amt is principal debt or obligation, not a sale price. No sale price is shown or inferred.',
  'A deed may link to multiple BBL associations. City counts are distinct document IDs; H3 counts are also distinct documents and must not be summed into a city total.',
  'Only coordinate-bearing PLUTO matches receive an H3 placement, at parcel-centroid precision. Unmatched deeds remain in city totals.'
];

function metric(value: number | undefined | null) { return value === undefined || value === null ? 'Not reported' : number.format(value); }
function readableDate(value: string | null | undefined) { if (!value) return 'Not reported'; const date = new Date(value); return Number.isNaN(date.getTime()) ? value : dateTime.format(date); }
function source(summary: RecordedDeedSummary, name: string) { return summary.sources.find(item => item.source === name); }
function escapeHtml(value: unknown) { return String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!); }

function download(kind: 'json' | 'html', data: Model) {
  const generatedAt = new Date().toISOString();
  const packet = {
    generatedAt,
    datasetId: data.datasetId,
    title: 'NYC ACRIS recorded-deed evidence',
    coverage: coverageStatement,
    eventDate: 'recorded_datetime',
    includedDocumentType: 'Exact raw DEED only',
    citySummary: { distinctDocumentIds: data.distinctDocuments, exactDeedRows: data.exactDeedRows, multiBblDocuments: data.quality.multiBblDocuments, associationRows: data.associationCount },
    h3Evidence: data.cells,
    sourceQuality: data.quality,
    sources: data.sources,
    caveats
  };
  const body = kind === 'json' ? JSON.stringify(packet, null, 2) : `<!doctype html><html><head><meta charset="utf-8"><title>NYC ACRIS recorded-deed evidence</title><style>body{font:15px system-ui;max-width:920px;margin:40px auto;line-height:1.5}table{border-collapse:collapse;width:100%}th,td{padding:7px;text-align:left;border-bottom:1px solid #ddd}code{background:#eef2f1;padding:2px 4px}</style></head><body><h1>NYC ACRIS recorded-deed evidence</h1><p>Generated ${escapeHtml(generatedAt)}. <strong>${escapeHtml(coverageStatement)}</strong></p><p>Included documents use exact raw <code>DEED</code>; event date is <code>recorded_datetime</code>. <strong>document_amt is not sale price and is not shown.</strong></p><h2>City summary</h2><p>${metric(data.distinctDocuments)} distinct document IDs; ${metric(data.quality.multiBblDocuments)} document IDs have multiple BBL associations. Do not sum H3 counts into this city total.</p><h2>H3 evidence</h2><p>Only coordinate-bearing PLUTO matches are placed, using parcel centroids.</p><table><thead><tr><th>H3 cell</th><th>Distinct documents</th><th>BBL associations</th><th>Precision</th></tr></thead><tbody>${data.cells.map(row => `<tr><td><code>${escapeHtml(row.h3Cell)}</code></td><td>${metric(row.documentCount)}</td><td>${metric(row.associationCount)}</td><td>${escapeHtml(row.precision)}</td></tr>`).join('')}</tbody></table><h2>Limitations</h2><ul>${caveats.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul></body></html>`;
  const blob = new Blob([body], { type: kind === 'json' ? 'application/json' : 'text/html' });
  const url = URL.createObjectURL(blob), anchor = document.createElement('a');
  anchor.href = url; anchor.download = `nyc-acris-recorded-deeds-${generatedAt.slice(0, 10)}.${kind}`; anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

export function RecordedDeeds() {
  const [data, setData] = useState<Model | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [documentId, setDocumentId] = useState('');
  const [document, setDocument] = useState<AcrisDocumentEvidence | null>(null);
  const [documentError, setDocumentError] = useState('');
  const [documentLoading, setDocumentLoading] = useState(false);
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setError('');
    Promise.all([api.recordedDeedSummary(controller.signal), api.recordedDeedCells(controller.signal)]).then(([summary, cells]) => {
      if (!controller.signal.aborted) setData({ ...summary.data, cells: cells.data, datasetId: summary.datasetId });
    }).catch(value => { if (!controller.signal.aborted) { setData(null); setError(value instanceof Error ? value.message : 'NYC ACRIS recorded-deed data could not load.'); } }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, []);
  const topCells = useMemo(() => data?.cells.slice().sort((a, b) => b.documentCount - a.documentCount || a.h3Cell.localeCompare(b.h3Cell)).slice(0, 8) ?? [], [data]);
  const master = data && source(data, 'NYC_ACRIS_MASTER'), legal = data && source(data, 'NYC_ACRIS_LEGALS'), pluto = data && source(data, 'NYC_PLUTO');
  const lookupDocument = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = documentId.trim();
    if (!value) return;
    setDocumentLoading(true); setDocumentError(''); setDocument(null);
    try { const result = await api.recordedDeedDocument(value); setDocument(result.data); }
    catch (value) { setDocumentError(value instanceof Error ? value.message : 'Recorded deed could not load.'); }
    finally { setDocumentLoading(false); }
  };
  return <section className="recorded-deeds" aria-labelledby="recorded-deeds-title">
    <div className="deeds-head"><div><p className="eyebrow">Separate NYC public-record context</p><h2 id="recorded-deeds-title">NYC recorded deeds</h2><p>Use recorded-deed evidence to decide what property or ownership research to do next. It is separate from permit discovery and from ZAP entitlement applications.</p></div>{data && <div className="deeds-export"><button onClick={() => download('json', data)}>Export deed JSON</button><button onClick={() => download('html', data)}>Export deed evidence</button></div>}</div>
    <aside className="deeds-coverage" aria-label="ACRIS coverage limitation"><strong>{coverageStatement}</strong><p>NYC Department of Finance ACRIS covers Manhattan, Bronx, Brooklyn, and Queens. Richmond County Clerk records are outside this source, so this is not an NYC-wide total.</p></aside>
    {loading ? <p className="empty">Loading NYC ACRIS recorded-deed context…</p> : error ? <div className="error inline-error"><p>{error}</p></div> : data && <>
      <section className="deeds-method" aria-label="Recorded-deed method"><div><strong>Included record</strong><span>Exact raw <code>DEED</code> only</span></div><div><strong>Event date</strong><span><code>recorded_datetime</code></span></div><div><strong>Price</strong><span>Not available — <code>document_amt</code> is debt/obligation</span></div></section>
      <section className="deeds-metrics" aria-label="Recorded-deed city summary"><div><span>Distinct recorded deeds</span><strong>{metric(data.distinctDocuments)}</strong><small>Distinct ACRIS document IDs; four boroughs only</small></div><div><span>Multiple-BBL deeds</span><strong>{metric(data.quality.multiBblDocuments)}</strong><small>One document can have several parcel associations</small></div><div><span>Mapped H3 placements</span><strong>{metric(data.quality.placedDocumentCells)}</strong><small>Distinct document/cell placements; do not sum for a city total</small></div><div><span>PLUTO-unmatched BBLs</span><strong>{metric(data.quality.unmatchedBbls)}</strong><small>Remain in city count without H3 placement</small></div></section>
      <section className="deeds-evidence"><div><p className="eyebrow">H3 / parcel evidence</p><h3>Where matched deeds can be placed</h3><p>These rows count distinct document IDs once per H3 cell. A multi-BBL document can appear in more than one cell. Placement uses a PLUTO parcel centroid, not a building footprint or transaction location.</p></div>{topCells.length ? <div className="table-wrap"><table><thead><tr><th>H3 cell</th><th>Distinct deeds</th><th>BBL associations</th><th>Geography precision</th></tr></thead><tbody>{topCells.map(cell => <tr key={cell.h3Cell}><td><code>{cell.h3Cell}</code></td><td>{metric(cell.documentCount)}</td><td>{metric(cell.associationCount)}</td><td>Parcel centroid</td></tr>)}</tbody></table></div> : <p className="empty">No coordinate-bearing PLUTO matches are available for H3 placement in this snapshot.</p>}</section>
      <section className="deeds-document" aria-labelledby="deeds-document-title"><div><p className="eyebrow">Document evidence</p><h3 id="deeds-document-title">Look up a retained ACRIS document</h3><p>Enter a document ID from the recorded-deed source to review its retained dates, BBL associations, and H3 placement. Amounts are never returned or presented as sale prices.</p></div><form onSubmit={lookupDocument}><label htmlFor="acris-document-id">ACRIS document ID</label><div><input id="acris-document-id" value={documentId} onChange={event => setDocumentId(event.target.value)} inputMode="numeric" autoComplete="off" required /><button disabled={documentLoading}>{documentLoading ? 'Loading…' : 'Look up document'}</button></div></form>{documentError && <p className="error inline-error" role="status">{documentError}</p>}{document && <div className="deed-document-result" aria-live="polite"><strong>Document {document.documentId}</strong><dl><div><dt>Recorded event date</dt><dd>{document.recordedDate}</dd></div><div><dt>Source document date</dt><dd>{document.documentDate ?? 'Not reported'}</dd></div><div><dt>BBL associations</dt><dd>{document.bbls.length ? document.bbls.join(', ') : 'None retained'}</dd></div><div><dt>H3 placement</dt><dd>{document.h3Cells.length ? `${document.h3Cells.join(', ')} · Parcel centroid` : 'No coordinate-bearing PLUTO placement'}</dd></div></dl><p><strong>Price:</strong> Not available. <code>document_amt</code> is a debt or obligation field and is not a sale price.</p></div>}</section>
      <section className="deeds-quality" aria-labelledby="deeds-quality-title"><div><p className="eyebrow">Snapshot quality and freshness</p><h3 id="deeds-quality-title">What was retained and what could be placed</h3><p>Publisher extracts can be corrected or overwritten. This local snapshot preserves source retrieval and publisher-update metadata; it does not substitute an extract freshness date for <code>recorded_datetime</code>.</p></div><dl><div><dt>Exact DEED Master rows</dt><dd>{metric(data.exactDeedRows)}</dd></div><div><dt>Duplicate Master rows</dt><dd>{metric(data.duplicateMasterRows)}</dd></div><div><dt>Excluded non-exact types</dt><dd>{metric(data.excludedTypeRows)}</dd></div><div><dt>Legal BBL associations</dt><dd>{metric(data.associationCount)}</dd></div><div><dt>Distinct Legal BBLs</dt><dd>{metric(data.quality.distinctLegalBbls)}</dd></div><div><dt>PLUTO-unmatched BBLs</dt><dd>{metric(data.quality.unmatchedBbls)}</dd></div><div><dt>Coordinate-null matches</dt><dd>{metric(data.quality.nullCoordinateBbls)}</dd></div><div><dt>Placed document/cell rows</dt><dd>{metric(data.quality.placedDocumentCells)}</dd></div></dl>
        {data.excludedTypeCounts && Object.keys(data.excludedTypeCounts).length ? <p className="deeds-excluded"><strong>Excluded raw types include:</strong> {Object.entries(data.excludedTypeCounts).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([docType, count]) => `${docType} (${number.format(count)})`).join(' · ')}. They are not silently treated as deeds.</p> : null}
        <div className="deeds-sources"><div><strong>Master</strong><span>{master?.datasetUrl ? <a href={master.datasetUrl} target="_blank" rel="noreferrer">ACRIS Real Property Master ↗</a> : 'ACRIS Real Property Master'}</span><small>Retrieved {readableDate(master?.retrievedAt)} · publisher update {readableDate(master?.publisherUpdatedAt)}</small></div><div><strong>Legals</strong><span>{legal?.datasetUrl ? <a href={legal.datasetUrl} target="_blank" rel="noreferrer">ACRIS Real Property Legals ↗</a> : 'ACRIS Real Property Legals'}</span><small>Retrieved {readableDate(legal?.retrievedAt)} · publisher update {readableDate(legal?.publisherUpdatedAt)}</small></div><div><strong>Parcel geography</strong><span>{pluto?.datasetUrl ? <a href={pluto.datasetUrl} target="_blank" rel="noreferrer">NYC PLUTO ↗</a> : 'NYC PLUTO'}</span><small>Retrieved {readableDate(pluto?.retrievedAt)} · publisher update {readableDate(pluto?.publisherUpdatedAt)}</small></div></div>
      </section>
      <section className="deeds-limitations"><h3>How to use this evidence</h3><ul>{caveats.map(item => <li key={item}>{item}</li>)}</ul></section>
    </>}
  </section>;
}
