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
export const lensIds = ['ALL', 'GROUND_UP_SITE', 'REINVESTMENT', 'BUILDING_SYSTEMS', 'TEMPORARY_LOGISTICS', 'SIGNAGE', 'ADMIN_LOW_INFORMATION', 'UNCLASSIFIED'] as const;
export const lensIdSchema = z.enum(lensIds);
export type LensId = z.infer<typeof lensIdSchema>;
export interface LensDefinition { id: LensId; label: string; rankingTreatment: 'ALL_RECORDS' | 'PRIMARY' | 'DEPRIORITIZED'; description: string; }
export interface LensClassification { lens: Exclude<LensId, 'ALL'>; confidence: 'HIGH' | 'MEDIUM' | 'LOW'; ambiguity: string; officialSourceUrl: string; rawPermitType: string; rawWorkType: string | null; }
export interface LensMapping extends LensClassification { market: Market; }
export interface LensSelection { permitType: string; lens: LensId; defaultTreatment: 'ALL_RECORDS_WITH_DEPRIORITIZATION'; noCompositeScore: true; }
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
  lenses: LensDefinition[];
  lensMappings: LensMapping[];
  selection: LensSelection;
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
  lens: LensClassification;
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

/**
 * An evidence-first explanation for one selected map cell.  None of these fields
 * are predictions or a composite "opportunity" score: every number is calculated
 * from permit records in the fixed comparison windows.
 */
export interface InvestigationDriver {
  permitType: string;
  current: number;
  prior: number;
  absolute: number;
  currentShare: number | null;
}
export interface ActivityPersistence {
  activeMonthsCurrent: number;
  longestCurrentMonthStreak: number;
  peakMonth: string | null;
  peakMonthCount: number;
  topMonthConcentrationShare: number | null;
}
export interface RepeatedAddressSignal {
  address: string;
  current: number;
  prior: number;
  absolute: number;
  currentRecordIds: string[];
  evidencePath: string;
}
export interface LargestPermitSignal {
  id: string;
  date: string;
  address: string | null;
  permitType: string;
  reportedCostCents: number;
  recordPath: string;
}
export interface InvestigationDataQuality {
  mappedEvidence: { current: number; prior: number; note: string };
  missingReportedCost: { current: number; currentShare: number | null; caveat: string };
  sourceSemantics: string;
}
export interface InvestigationBrief {
  market: Market;
  h3Cell: string;
  permitType: string;
  lens: LensId;
  selection: LensSelection;
  label: string;
  windows: Windows;
  permitCount: Change;
  whySurfaced: { narrative: string; facts: string[] };
  drivers: InvestigationDriver[];
  activityPersistence: ActivityPersistence;
  repeatedAddresses: RepeatedAddressSignal[];
  largestCurrentPermits: LargestPermitSignal[];
  dataQuality: InvestigationDataQuality;
  canSuggest: string[];
  cannotConclude: string[];
  recommendedNextChecks: string[];
}

export const adminJobActions = ['REFRESH_CHICAGO', 'REFRESH_NYC', 'REFRESH_SBA', 'REBUILD_DATABASE', 'VERIFY_DATASET'] as const;
export type AdminJobAction = (typeof adminJobActions)[number];
export const adminJobActionSchema = z.enum(adminJobActions);
export interface AdminJob {
  id: string;
  action: AdminJobAction;
  status: 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'INTERRUPTED';
  /** Current machine-readable stage emitted by the fixed local workflow. */
  stage: string;
  /** Refresh result. UP_TO_DATE means its fixed analysis window did not change. */
  outcome: 'UP_TO_DATE' | 'UPDATED' | null;
  startedAt: string;
  finishedAt: string | null;
  exitCode: number | null;
  stdout: string;
  stderr: string;
  outputTruncated: boolean;
  note: string | null;
}
export interface PipelineSourceStatus {
  source: Source;
  market: Market;
  status: SourceReport['status'];
  completeness: SourceReport['completeness'];
  retrievedAt: string | null;
  publisherAsOf: string | null;
  coverageStart: string | null;
  coverageEndExclusive: string | null;
  acceptedRows: number;
  resolvedRows: number;
  unresolvedRows: number;
  missingCostRows: number;
  checksum: string | null;
}
export interface PipelineStatus {
  datasetId: string | null;
  manifest: { mode: string; coverageStart: string | null; coverageEndExclusive: string | null; importedAt: string | null } | null;
  sources: PipelineSourceStatus[];
  currentJob: AdminJob | null;
  lastJob: AdminJob | null;
  serverRestartLimitation: string;
}
