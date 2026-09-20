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

/** NYC ACRIS is a bounded, separate recorded-deed evidence family. */
export interface AcrisSourceMetadata {
  source: 'NYC_ACRIS_MASTER' | 'NYC_ACRIS_LEGALS' | 'NYC_PLUTO'; datasetId: 'bnx9-e6tj' | '8h5j-fqxa' | '64uk-42ks';
  datasetUrl: string; publisherUpdatedAt: string | null; retrievedAt: string; snapshotId: string; caveat: string;
}
export interface AcrisQuality {
  masterRows: number; acceptedDocuments: number; duplicateMasterRows: number; excludedRawTypeCounts: Record<string, number>;
  legalRows: number; duplicateLegalRows: number; invalidBblRows: number; deedsWithoutLegals: number;
  distinctLegalBbls: number; unmatchedBbls: number; plutoUnmatchedBbl: number; nullCoordinateBbls: number; coordinateNull: number; placedDocumentCells: number;
  multiBblDocuments: number; caveats: string[];
}
export interface AcrisDocumentEvidence {
  documentId: string; recordedDate: string; documentDate: string | null; docType: 'DEED'; bbls: string[];
  h3Cells: string[]; placementPrecision: 'PARCEL_CENTROID' | null; documentAmountDisclosure: 'NOT_A_SALE_PRICE';
}
export interface AcrisCellCount { h3Cell: string; documentCount: number; precision: 'PARCEL_CENTROID'; }
export interface AcrisSummaryData { window: { startInclusive: string; endExclusive: string }; distinctDocuments: number; cells: AcrisCellCount[]; quality: AcrisQuality; sources: AcrisSourceMetadata[]; permitRankingTreatment: 'SEPARATE_RECORDED_DEED_CONTEXT'; disclosure: string; }

/** NYC ZAP is an entitlement-stage source. It must never be blended into permit ranking. */
export const zapWindowIds = ['ALL_RECORDS', 'FILED_24_MONTHS'] as const;
export const zapWindowSchema = z.enum(zapWindowIds);
export type ZapWindow = (typeof zapWindowIds)[number];
export const zapProjectStatusIds = ['ACTIVE', 'ON_HOLD', 'WITHDRAWN', 'TERMINATED', 'COMPLETED_OTHER', 'UNKNOWN'] as const;
export type ZapProjectStatus = (typeof zapProjectStatusIds)[number];
export interface ZapSourceMetadata {
  source: 'NYC_ZAP_PROJECT_DATA' | 'NYC_ZAP_BBL' | 'NYC_PLUTO';
  datasetId: 'hgx4-8ukb' | '2iga-a6mk' | '64uk-42ks';
  datasetUrl: string;
  publisherUpdatedAt: string | null;
  retrievedAt: string;
  snapshotId: string;
  caveat: string;
}
export interface ZapCoverage {
  window: ZapWindow;
  allTrackedProjects: number;
  includedProjects: number;
  projectsWithAppFiledDate: number;
  missingAppFiledDate: number;
  filedDateCoverage: number | null;
  validatedBblRows: number;
  unvalidatedBblRows: number;
  unmatchedParcelRows: number;
  nullCoordinateParcelRows: number;
  placedProjectCells: number;
  possiblyRemovedProjects: number;
  possiblyRemovedBblRows: number;
  orphanBblRows: number;
  changeHistoryAvailable: boolean;
  caveats: string[];
}
export interface ZapProjectCount {
  projectCount: number;
  statusCounts: Record<ZapProjectStatus, number>;
}
export interface ZapCellCount extends ZapProjectCount {
  h3Cell: string;
  precision: 'PARCEL_CENTROID';
}
export interface ZapSummaryData {
  window: ZapWindow;
  counts: ZapProjectCount;
  coverage: ZapCoverage;
  sources: ZapSourceMetadata[];
  permitRankingTreatment: 'SEPARATE_ENTITLEMENT_LAYER';
}
export const lensIds = ['ALL', 'GROUND_UP_SITE', 'REINVESTMENT', 'BUILDING_SYSTEMS', 'TEMPORARY_LOGISTICS', 'SIGNAGE', 'ADMIN_LOW_INFORMATION', 'UNCLASSIFIED'] as const;
export const lensIdSchema = z.enum(lensIds);
export type LensId = z.infer<typeof lensIdSchema>;
/** Property use is parcel context, not a claim about the permit's work or tenancy. */
export const propertyUseIds = ['ALL', 'LIKELY_COMMERCIAL', 'MULTIFAMILY', 'MIXED_USE', 'RESIDENTIAL', 'UNKNOWN'] as const;
export const propertyUseSchema = z.enum(propertyUseIds);
export type PropertyUse = z.infer<typeof propertyUseSchema>;
export const rankIds = ['RECORDED_CHANGE', 'CURRENT_RECORDS', 'LARGEST_REPORTED_COST'] as const;
export const rankSchema = z.enum(rankIds);
export type Rank = z.infer<typeof rankSchema>;
export interface PropertyUseEvidence {
  category: Exclude<PropertyUse, 'ALL'>;
  provenance: 'PLUTO_LANDUSE_DIRECT' | 'CHICAGO_UNAVAILABLE';
  confidence: 'HIGH' | 'NONE';
  reason: string | null;
  canonicalBbl: string | null;
  landuseRaw: string | null;
  bldgclassRaw: string | null;
  snapshotId: string | null;
  classifiedAsOf: string | null;
}
export interface LensDefinition { id: LensId; label: string; rankingTreatment: 'ALL_RECORDS' | 'PRIMARY' | 'DEPRIORITIZED'; description: string; }
export interface LensClassification { lens: Exclude<LensId, 'ALL'>; confidence: 'HIGH' | 'MEDIUM' | 'LOW'; ambiguity: string; officialSourceUrl: string; rawPermitType: string; rawWorkType: string | null; }
export interface LensMapping extends LensClassification { market: Market; }
export interface LensSelection { permitType: string; lens: LensId; propertyUse: PropertyUse; minReportedCostCents: number | null; rank: Rank; defaultTreatment: 'ALL_RECORDS_WITH_DEPRIORITIZATION'; noCompositeScore: true; }
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
  /** Maximum one-record applicant-reported cost; never a summed investment amount. */
  largestReportedCostCents: number | null;
  currentReportedCost: { withReportedCost: number; missingReportedCost: number; coverageShare: number | null };
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
  propertyUse: PropertyUseEvidence;
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
/** A record-count composition only; neither lens nor type rows represent projects. */
export interface H3CompositionRow {
  key: string;
  label: string;
  current: number;
  prior: number;
  absolute: number;
  currentShare: number | null;
}
export interface H3MonthlyCadenceRow {
  month: string;
  period: Period;
  count: number;
}
export interface H3ReportedCostCoverage {
  currentWithReportedCost: number;
  currentMissingReportedCost: number;
  currentCoverageShare: number | null;
  caveat: string;
}
/**
 * The unfiltered contents of a selected H3 cell. This intentionally remains
 * separate from the analyst's type/lens drill-down so the cell can be understood
 * before a filter hides part of it.
 */
export interface H3SubsectionBreakdown {
  scope: { permitType: 'ALL'; lens: 'ALL' };
  permitCount: Change;
  lensComposition: H3CompositionRow[];
  permitTypeComposition: H3CompositionRow[];
  monthlyCadence: H3MonthlyCadenceRow[];
  leadingAddresses: RepeatedAddressSignal[];
  reportedCostCoverage: H3ReportedCostCoverage;
  caveat: string;
}
export type QualifiedSignalPattern =
  | 'BROAD_BASED_LOCAL_ACTIVITY'
  | 'CONCENTRATED_CAPITAL_PROGRAM_LEAD'
  | 'EMERGING_LOW_VOLUME_LEAD'
  | 'ADMINISTRATIVE_PROCESS_SURGE'
  | 'WEAK_OR_DECLINING_SIGNAL';
export type SuggestedDisposition = 'ESCALATE' | 'INVESTIGATE' | 'MONITOR' | 'DISMISS_AS_LOW_INFORMATION';
export interface QualifiedSignalRule {
  id: string;
  threshold: string;
  evidence: string;
}
/** A deterministic, evidence-first triage aid. It is not a score or prediction. */
export interface QualifiedSignal {
  ruleVersion: 'qualified-signal-v1.0';
  pattern: QualifiedSignalPattern;
  label: string;
  observedPattern: string;
  hypothesis: string;
  alternativeExplanation: string;
  suggestedDisposition: SuggestedDisposition;
  triggeredRules: QualifiedSignalRule[];
  recommendedNextChecks: string[];
  caveat: string;
}
export interface InvestigationBrief {
  market: Market;
  h3Cell: string;
  permitType: string;
  lens: LensId;
  propertyUse: PropertyUse;
  minReportedCostCents: number | null;
  rank: Rank;
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
  subsectionBreakdown: H3SubsectionBreakdown;
  qualifiedSignal: QualifiedSignal;
  canSuggest: string[];
  cannotConclude: string[];
  recommendedNextChecks: string[];
}

export const adminJobActions = ['REFRESH_CHICAGO', 'REFRESH_NYC', 'REFRESH_ZAP', 'REFRESH_ACRIS', 'REFRESH_SBA', 'REBUILD_DATABASE', 'VERIFY_DATASET'] as const;
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
