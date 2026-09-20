import type { AcrisCellCount, AcrisDocumentEvidence, AcrisSummaryData, AdminJobAction, ApiResponse, ApprovalEvidence, CellSignal, CellsData, LensId, Market, PermitEvidence, PropertyUse, RecordDetail, SourceReport, SummaryData, ZapCellCount, ZapSummaryData, ZapWindow } from '../shared/contracts';

export type RecordedDeedCell = AcrisCellCount & { associationCount: number };
export type RecordedDeedSummary = AcrisSummaryData & {
  documentCount: number;
  exactDeedRows: number;
  duplicateMasterRows: number;
  excludedTypeRows: number;
  excludedTypeCounts: Record<string, number>;
  associationCount: number;
};

export type { PropertyUse };
export type QueueRank = 'RECORDED_CHANGE' | 'CURRENT_RECORDS' | 'LARGEST_REPORTED_COST';
export type PermitQuery = { propertyUse: PropertyUse; minReportedCostCents: number; rank: QueueRank };

const qs = (values: Record<string, string | number | null | undefined>) => new URLSearchParams(Object.entries(values).filter(([, value]) => value !== null && value !== undefined).map(([key, value]) => [key, String(value)])).toString();
const permitQuery = (market: Market, permitType: string, lens: LensId, filters: PermitQuery) => ({ market, permitType, lens, propertyUse: filters.propertyUse, rank: filters.rank, minReportedCostCents: filters.minReportedCostCents > 0 ? filters.minReportedCostCents : undefined });
async function get<T>(url: string, signal?: AbortSignal): Promise<ApiResponse<T>> {
  const response = await fetch(url, { signal });
  if (!response.ok) { let message = `Request failed (${response.status})`; try { message = (await response.json()).error?.message ?? message; } catch {} throw new Error(message); }
  return response.json() as Promise<ApiResponse<T>>;
}
async function post<T>(url: string, body: unknown): Promise<ApiResponse<T>> {
  const response = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  if (!response.ok) { let message = `Request failed (${response.status})`; try { message = (await response.json()).error?.message ?? message; } catch {} throw new Error(message); }
  return response.json() as Promise<ApiResponse<T>>;
}
export const api = {
  summary: (market: Market, permitType: string, lens: LensId, filters: PermitQuery, signal?: AbortSignal) => get<SummaryData>(`/api/summary?${qs(permitQuery(market, permitType, lens, filters))}`, signal),
  cells: (market: Market, permitType: string, lens: LensId, filters: PermitQuery, signal?: AbortSignal) => get<CellsData>(`/api/cells?${qs(permitQuery(market, permitType, lens, filters))}`, signal),
  cell: (market: Market, cell: string, permitType: string, lens: LensId, filters: PermitQuery, signal?: AbortSignal) => get<CellSignal>(`/api/cells/${encodeURIComponent(cell)}?${qs(permitQuery(market, permitType, lens, filters))}`, signal),
  brief: (market: Market, cell: string, permitType: string, lens: LensId, filters: PermitQuery, signal?: AbortSignal) => get<unknown>(`/api/cells/${encodeURIComponent(cell)}/brief?${qs(permitQuery(market, permitType, lens, filters))}`, signal),
  evidence: (market: Market, cell: string, permitType: string, lens: LensId, filters: PermitQuery, period: 'current' | 'prior', offset: number, signal?: AbortSignal) => get<PermitEvidence[]>(`/api/cells/${encodeURIComponent(cell)}/evidence?${qs({ ...permitQuery(market, permitType, lens, filters), period, offset, limit: 25 })}`, signal),
  approvals: (market: Market, signal?: AbortSignal) => get<ApprovalEvidence[]>(`/api/approvals?${qs({ market, period: 'current', offset: 0, limit: 25 })}`, signal),
  record: (id: string, signal?: AbortSignal) => get<RecordDetail>(`/api/records/${encodeURIComponent(id)}`, signal),
  sources: (market: Market, signal?: AbortSignal) => get<SourceReport[]>(`/api/sources?${qs({ market })}`, signal),
  /** NYC-only entitlement-stage data; intentionally separate from permit APIs. */
  zapSummary: (window: ZapWindow, signal?: AbortSignal) => get<ZapSummaryData>(`/api/zap/summary?${qs({ window })}`, signal),
  zapCells: (window: ZapWindow, signal?: AbortSignal) => get<ZapCellCount[]>(`/api/zap/cells?${qs({ window })}`, signal),
  /** NYC ACRIS is an evidence family, kept separate from discovery and ZAP. */
  recordedDeedSummary: (signal?: AbortSignal) => get<RecordedDeedSummary>('/api/transactions/nyc/summary', signal),
  recordedDeedCells: (signal?: AbortSignal) => get<RecordedDeedCell[]>('/api/transactions/nyc/cells', signal),
  recordedDeedDocument: (documentId: string, signal?: AbortSignal) => get<AcrisDocumentEvidence>(`/api/transactions/nyc/documents/${encodeURIComponent(documentId)}`, signal),
  pipeline: (signal?: AbortSignal) => get<unknown>('/api/admin/pipeline', signal),
  runJob: (action: AdminJobAction) => post<unknown>('/api/admin/jobs', { action })
};
