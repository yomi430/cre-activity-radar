import { z } from 'zod';

export const marketSchema = z.enum(['CHICAGO', 'NYC']);
export type Market = z.infer<typeof marketSchema>;

export const healthResponseSchema = z.object({
  datasetId: z.string(),
  data: z.object({ status: z.literal('ok'), seeded: z.boolean(), markets: z.array(marketSchema) })
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;

export type Period = 'current' | 'prior';
export type Source = 'CHICAGO_PERMIT' | 'NYC_DOB_NOW' | 'SBA_504';
export interface ApiResponse<T> {
  datasetId: string;
  market?: Market;
  data: T;
  pagination?: { offset: number; limit: number; total: number };
}
export interface Windows {
  prior: { start: string; endExclusive: string };
  current: { start: string; endExclusive: string };
}
export interface Change {
  current: number;
  previous: number;
  absolute: number;
  percent: number | null;
  basis: 'COMPARABLE' | 'NO_BASELINE' | 'NO_ACTIVITY' | 'INCOMPLETE';
}
export interface CellSignal {
  market: Market;
  h3Cell: string;
  label: string;
  permitCount: Change;
  monthly: Array<{ month: string; count: number }>;
  lowVolume: boolean;
}
export interface CellsData {
  cells: CellSignal[];
  geojson: {
    type: 'FeatureCollection';
    features: Array<{
      type: 'Feature';
      properties: { h3Cell: string; current: number; label: string };
      geometry: { type: 'Polygon'; coordinates: number[][][] };
    }>;
  };
}
export interface SourceReport {
  source: Source;
  market: Market;
  status: 'available' | 'unavailable';
  mode: 'public' | 'synthetic';
  completeness: 'complete-query' | 'partial' | 'synthetic' | 'unavailable';
  datasetUrl: string;
  retrievedAt: string | null;
  publisherAsOf: string | null;
  rowsRead: number;
  acceptedRows: number;
  rejectedRows: number;
  duplicateRows: number;
  outOfScopeRows: number;
  resolvedRows: number;
  unresolvedRows: number;
  missingCostRows: number;
  reasonCounts: Record<string, number>;
  notes: string[];
}
export interface SbaContext {
  status: 'available' | 'unavailable';
  geographyLabel: string;
  approvalCount: Change | null;
  approvalAmountCents: Change | null;
  note: string;
}
export interface SummaryData {
  market: Market;
  mode: 'public' | 'synthetic';
  windows: Windows;
  comparable: boolean;
  permitTypes: string[];
  acceptedPermits: Change;
  mappedPermits: Change;
  unmappedPermits: Change;
  sources: SourceReport[];
  sba: SbaContext;
}
export interface PermitEvidence {
  id: string;
  market: Market;
  source: 'CHICAGO_PERMIT' | 'NYC_DOB_NOW';
  date: string;
  permitNumber: string | null;
  permitType: string;
  address: string | null;
  description: string | null;
  reportedCostCents: number | null;
  h3Cell: string | null;
  point: { lat: number; lng: number; precision: 'SOURCE_COORDINATE' | 'JOINED_PARCEL'; provider: string } | null;
  warnings: string[];
}
export interface ApprovalEvidence {
  id: string;
  market: Market;
  source: 'SBA_504';
  date: string;
  borrowerName: string | null;
  approvalAmountCents: number;
  status: string | null;
  city: string;
  state: string;
  geographyBasis: 'PROJECT_CITY' | 'BORROWER_CITY';
}
export interface RecordDetail {
  id: string;
  normalized: PermitEvidence | ApprovalEvidence;
  raw: Record<string, unknown>;
  sourceUrl: string;
  warnings: string[];
}
