import type { ApiResponse, ApprovalEvidence, CellSignal, CellsData, LensId, Market, PermitEvidence, RecordDetail, SourceReport, SummaryData, ZapCellCount, ZapSummaryData, ZapWindow } from '../shared/contracts';

const qs = (values: Record<string, string | number>) => new URLSearchParams(Object.entries(values).map(([key, value]) => [key, String(value)])).toString();
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
  summary: (market: Market, permitType: string, lens: LensId, signal?: AbortSignal) => get<SummaryData>(`/api/summary?${qs({ market, permitType, lens })}`, signal),
  cells: (market: Market, permitType: string, lens: LensId, signal?: AbortSignal) => get<CellsData>(`/api/cells?${qs({ market, permitType, lens })}`, signal),
  cell: (market: Market, cell: string, permitType: string, lens: LensId, signal?: AbortSignal) => get<CellSignal>(`/api/cells/${encodeURIComponent(cell)}?${qs({ market, permitType, lens })}`, signal),
  brief: (market: Market, cell: string, permitType: string, lens: LensId, signal?: AbortSignal) => get<unknown>(`/api/cells/${encodeURIComponent(cell)}/brief?${qs({ market, permitType, lens })}`, signal),
  evidence: (market: Market, cell: string, permitType: string, lens: LensId, period: 'current' | 'prior', offset: number, signal?: AbortSignal) => get<PermitEvidence[]>(`/api/cells/${encodeURIComponent(cell)}/evidence?${qs({ market, permitType, lens, period, offset, limit: 25 })}`, signal),
  approvals: (market: Market, signal?: AbortSignal) => get<ApprovalEvidence[]>(`/api/approvals?${qs({ market, period: 'current', offset: 0, limit: 25 })}`, signal),
  record: (id: string, signal?: AbortSignal) => get<RecordDetail>(`/api/records/${encodeURIComponent(id)}`, signal),
  sources: (market: Market, signal?: AbortSignal) => get<SourceReport[]>(`/api/sources?${qs({ market })}`, signal),
  /** NYC-only entitlement-stage data; intentionally separate from permit APIs. */
  zapSummary: (window: ZapWindow, signal?: AbortSignal) => get<ZapSummaryData>(`/api/zap/summary?${qs({ window })}`, signal),
  zapCells: (window: ZapWindow, signal?: AbortSignal) => get<ZapCellCount[]>(`/api/zap/cells?${qs({ window })}`, signal)
  ,pipeline: (signal?: AbortSignal) => get<unknown>('/api/admin/pipeline', signal)
  ,runJob: (action: 'REFRESH_CHICAGO' | 'REFRESH_NYC' | 'REFRESH_SBA' | 'REBUILD_DATABASE' | 'VERIFY_DATASET') => post<unknown>('/api/admin/jobs', { action })
};
