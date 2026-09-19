export type Market = 'CHICAGO' | 'NYC';
export type PermitSource = 'CHICAGO_PERMIT' | 'NYC_DOB_NOW';
export type Source = PermitSource | 'SBA_504';

export interface NormalizedPermit {
  id: string; market: Market; source: PermitSource; sourceRecordId: string; date: string;
  permitNumber: string | null; permitType: string; reportedCostCents: number | null;
  address: string | null; description: string | null; communityArea: string | null;
  lat: number | null; lng: number | null; raw: Record<string, unknown>; warnings: string[];
}
export interface NormalizedApproval {
  id: string; market: Market; date: string; borrowerName: string | null; approvalAmountCents: number;
  status: string | null; city: string; state: string; raw: Record<string, unknown>;
}
