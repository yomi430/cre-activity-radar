import type { ApiResponse, ApprovalEvidence, CellSignal, CellsData, Market, PermitEvidence, RecordDetail, SourceReport, SummaryData } from '../shared/contracts';

const qs = (values: Record<string, string | number>) => new URLSearchParams(Object.entries(values).map(([key, value]) => [key, String(value)])).toString();
async function get<T>(url: string, signal?: AbortSignal): Promise<ApiResponse<T>> {
  const response = await fetch(url, { signal });
  if (!response.ok) { let message = `Request failed (${response.status})`; try { message = (await response.json()).error?.message ?? message; } catch {} throw new Error(message); }
  return response.json() as Promise<ApiResponse<T>>;
}
export const api = {
  summary: (market: Market, permitType: string, signal?: AbortSignal) => get<SummaryData>(`/api/summary?${qs({ market, permitType })}`, signal),
  cells: (market: Market, permitType: string, signal?: AbortSignal) => get<CellsData>(`/api/cells?${qs({ market, permitType })}`, signal),
  cell: (market: Market, cell: string, permitType: string, signal?: AbortSignal) => get<CellSignal>(`/api/cells/${encodeURIComponent(cell)}?${qs({ market, permitType })}`, signal),
  evidence: (market: Market, cell: string, permitType: string, period: 'current' | 'prior', offset: number, signal?: AbortSignal) => get<PermitEvidence[]>(`/api/cells/${encodeURIComponent(cell)}/evidence?${qs({ market, permitType, period, offset, limit: 25 })}`, signal),
  approvals: (market: Market, signal?: AbortSignal) => get<ApprovalEvidence[]>(`/api/approvals?${qs({ market, period: 'current', offset: 0, limit: 25 })}`, signal),
  record: (id: string, signal?: AbortSignal) => get<RecordDetail>(`/api/records/${encodeURIComponent(id)}`, signal),
  sources: (market: Market, signal?: AbortSignal) => get<SourceReport[]>(`/api/sources?${qs({ market })}`, signal)
};
