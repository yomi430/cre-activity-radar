import type { ActivityPersistence, Change, InvestigationDriver, QualifiedSignal, QualifiedSignalRule } from '../shared/contracts.js';
import { WINDOWS } from './dates.js';

export type MonthlyCount = { month: string; count: number };

/** Pure, hand-testable calculations used by the repository's brief query. */
export function persistenceForCurrent(monthly: MonthlyCount[]): ActivityPersistence {
  const current = monthly.filter(row => row.month >= WINDOWS.current.start.slice(0, 7));
  const active = current.filter(row => row.count > 0);
  let longest = 0;
  let running = 0;
  for (const row of current) {
    running = row.count > 0 ? running + 1 : 0;
    longest = Math.max(longest, running);
  }
  const peak = [...current].sort((a, b) => b.count - a.count || a.month.localeCompare(b.month))[0];
  const total = current.reduce((sum, row) => sum + row.count, 0);
  return {
    activeMonthsCurrent: active.length,
    longestCurrentMonthStreak: longest,
    peakMonth: peak && peak.count > 0 ? peak.month : null,
    peakMonthCount: peak?.count ?? 0,
    topMonthConcentrationShare: total > 0 && peak ? peak.count / total : null,
  };
}

export function sortDrivers(drivers: InvestigationDriver[]): InvestigationDriver[] {
  return [...drivers].sort((a, b) => b.absolute - a.absolute || b.current - a.current || a.permitType.localeCompare(b.permitType));
}

export function surfacedNarrative(change: Change, selectedType: string): string {
  const subject = selectedType === 'ALL' ? 'recorded permit activity' : `recorded ${selectedType} permit activity`;
  if (change.absolute > 0) return `${subject} increased by ${change.absolute} record${change.absolute === 1 ? '' : 's'} across the fixed comparison windows.`;
  if (change.absolute < 0) return `${subject} decreased by ${Math.abs(change.absolute)} record${Math.abs(change.absolute) === 1 ? '' : 's'} across the fixed comparison windows.`;
  return `${subject} was unchanged across the fixed comparison windows.`;
}

export interface QualifiedSignalInput {
  change: Change;
  persistence: ActivityPersistence;
  topAddress: { address: string; current: number; share: number | null } | null;
  topPermitType: { permitType: string; current: number; share: number | null } | null;
  lowInformationShare: number;
  primaryLensShare: number;
  hasMaterialRecord: boolean;
}

const version = 'qualified-signal-v1.0' as const;
const rule = (id: string, threshold: string, evidence: string): QualifiedSignalRule => ({ id, threshold, evidence });
const percent = (value: number | null) => value === null ? 'no current-window share' : `${Math.round(value * 100)}%`;

/**
 * A small, intentionally explicit rule set for research triage. It must never be
 * interpreted as a forecast, a project count, or a statement of market demand.
 */
export function qualifiedSignalFor(input: QualifiedSignalInput): QualifiedSignal {
  const { change, persistence, topAddress, topPermitType, lowInformationShare, primaryLensShare, hasMaterialRecord } = input;
  const rules: QualifiedSignalRule[] = [];
  const addressEvidence = topAddress ? `${percent(topAddress.share)} of current records are at ${topAddress.address}.` : 'No supplied address was available for concentration analysis.';
  const typeEvidence = topPermitType ? `${percent(topPermitType.share)} of current records use ${topPermitType.permitType}.` : 'No current exact permit type was available.';
  const persistenceEvidence = `${persistence.activeMonthsCurrent} active current-window months; longest consecutive streak ${persistence.longestCurrentMonthStreak}.`;

  if (change.basis !== 'COMPARABLE') {
    rules.push(rule('incomplete-comparison', 'Both permit source reports must be complete-query before trend qualification.', `Comparison basis is ${change.basis}.`));
    return {
      ruleVersion: version, pattern: 'WEAK_OR_DECLINING_SIGNAL', label: 'Coverage-limited recorded activity',
      observedPattern: `${change.current} current-window record${change.current === 1 ? '' : 's'} are available, but the comparison is ${change.basis.toLowerCase().replace('_', ' ')}.`,
      hypothesis: 'The records are consistent with activity in the selected H3, but the available source coverage cannot support a trend conclusion.',
      alternativeExplanation: 'The apparent change may be caused by incomplete source coverage or a publication difference rather than a change in activity.',
      suggestedDisposition: 'MONITOR', triggeredRules: rules,
      recommendedNextChecks: ['Verify prior and current source completeness before qualifying a change.', 'Review source records individually if the area is already strategically relevant.'],
      caveat: 'Permit records are not projects, construction starts, demand, value, or investment performance.'
    };
  }

  if (change.absolute <= 0) {
    rules.push(rule('no-positive-change', 'Current record count must exceed prior record count.', `${change.current} current versus ${change.previous} prior records (${change.absolute >= 0 ? '+' : ''}${change.absolute}).`));
    return {
      ruleVersion: version, pattern: 'WEAK_OR_DECLINING_SIGNAL', label: change.absolute < 0 ? 'Declining recorded activity' : 'Flat recorded activity',
      observedPattern: `${change.current} current versus ${change.previous} prior records; no positive increase was observed.`,
      hypothesis: 'The records do not establish an emerging permit-activity lead in this comparison window.',
      alternativeExplanation: 'A meaningful project may still exist outside this time window or outside the publisher source.',
      suggestedDisposition: 'MONITOR', triggeredRules: rules,
      recommendedNextChecks: ['Review known strategic properties directly rather than inferring an area trend from this count.', 'Check the next publisher refresh for a sustained change.'],
      caveat: 'A declining or flat permit count does not prove that local demand or asset performance declined.'
    };
  }

  if (lowInformationShare >= 0.75) {
    rules.push(rule('low-information-dominance', 'At least 75% of current records are temporary, administrative, or unclassified.', `${percent(lowInformationShare)} of current records are in low-information lenses.`));
    rules.push(rule('positive-change', 'Current record count exceeds prior record count.', `${change.current} current versus ${change.previous} prior records (+${change.absolute}).`));
    return {
      ruleVersion: version, pattern: 'ADMINISTRATIVE_PROCESS_SURGE', label: 'Administrative / process-led recorded increase',
      observedPattern: `Recorded activity rose ${change.absolute} records, but ${percent(lowInformationShare)} of current records are temporary, administrative, or unclassified. ${typeEvidence}`,
      hypothesis: 'The increase is primarily process or low-specificity filings and has weak development specificity.',
      alternativeExplanation: 'Low-information filings can accompany a material program whose underlying work is only visible in record descriptions or other sources.',
      suggestedDisposition: 'DISMISS_AS_LOW_INFORMATION', triggeredRules: rules,
      recommendedNextChecks: ['Inspect descriptions for a repeated project, owner, or address before dismissing.', 'Check whether a smaller primary-lens subset is tied to the same site.'],
      caveat: 'Administrative, temporary, and unclassified permit records remain evidence, but do not by themselves establish commercial activity.'
    };
  }

  const concentrated = (topAddress?.share ?? 0) >= 0.75 && persistence.activeMonthsCurrent >= 3 && (primaryLensShare >= 0.5 || hasMaterialRecord);
  if (concentrated) {
    rules.push(rule('address-concentration', 'One supplied address accounts for at least 75% of current records.', addressEvidence));
    rules.push(rule('persistence', 'Activity appears in at least 3 current-window months.', persistenceEvidence));
    rules.push(rule('capital-specificity', 'At least 50% are primary-lens records or an individually material reported-cost record exists.', `${percent(primaryLensShare)} primary-lens share; ${hasMaterialRecord ? 'at least one record has a reported cost of $10M or more.' : 'no individually material reported-cost record.'}`));
    return {
      ruleVersion: version, pattern: 'CONCENTRATED_CAPITAL_PROGRAM_LEAD', label: 'Persistent, site-concentrated capital-program lead',
      observedPattern: `Recorded activity rose ${change.absolute} records and appeared in ${persistence.activeMonthsCurrent} months. ${addressEvidence}`,
      hypothesis: 'The records are consistent with a continuing site-specific capital program, not broad local market momentum.',
      alternativeExplanation: 'The pattern may be repeated filings, a broad permit process, or multiple unrelated records at one complex property.',
      suggestedDisposition: 'INVESTIGATE', triggeredRules: rules,
      recommendedNextChecks: ['Reconcile the listed permits into actual projects using descriptions, applicants, and addresses.', 'Review individually material reported-cost records; reported costs are not investment totals.'],
      caveat: 'Do not describe this concentrated record pattern as submarket growth, construction starts, or investment performance.'
    };
  }

  const broad = persistence.activeMonthsCurrent >= 4 && (topAddress?.share ?? 0) <= 0.5 && primaryLensShare >= 0.5;
  if (broad) {
    rules.push(rule('multi-site-distribution', 'No supplied address accounts for more than 50% of current records.', addressEvidence));
    rules.push(rule('persistence', 'Activity appears in at least 4 current-window months.', persistenceEvidence));
    rules.push(rule('primary-lens-mix', 'At least 50% of current records are in primary CRE lenses.', `${percent(primaryLensShare)} of current records are in ground-up/site, reinvestment, or building-systems lenses.`));
    return {
      ruleVersion: version, pattern: 'BROAD_BASED_LOCAL_ACTIVITY', label: 'Persistent, multi-site recorded activity lead',
      observedPattern: `Recorded activity rose ${change.absolute} records across ${persistence.activeMonthsCurrent} active months with no supplied address above ${percent(topAddress?.share ?? null)} of the current count.`,
      hypothesis: 'The records are consistent with broader local permit activity that merits property- and market-level validation.',
      alternativeExplanation: 'The apparent distribution may reflect incomplete addresses, record fragmentation, or several filings for the same underlying projects.',
      suggestedDisposition: 'INVESTIGATE', triggeredRules: rules,
      recommendedNextChecks: ['Sample records across the leading addresses and types to determine whether they are distinct projects.', 'Validate relevant properties with parcel, entitlement, brokerage, and market sources.'],
      caveat: 'Distributed permit records do not prove local demand, rent growth, values, or completed construction.'
    };
  }

  rules.push(rule('small-or-early-change', 'Positive change does not meet the persistence and distribution thresholds for a stronger qualification.', `${change.current} current versus ${change.previous} prior records (+${change.absolute}); ${persistenceEvidence}`));
  return {
    ruleVersion: version, pattern: 'EMERGING_LOW_VOLUME_LEAD', label: 'Emerging recorded-activity lead',
    observedPattern: `Recorded activity rose ${change.absolute} records from ${change.previous} prior records. ${persistenceEvidence}`,
    hypothesis: 'The records are consistent with an early or low-volume activity change that needs validation before escalation.',
    alternativeExplanation: 'A small base, one-off filing, or source timing can create the observed increase without a sustained development pattern.',
    suggestedDisposition: 'MONITOR', triggeredRules: rules,
    recommendedNextChecks: ['Monitor the next publisher refresh for persistence.', 'Review the current records for a material project, repeated address, or primary-lens work.'],
    caveat: 'A low-volume increase does not establish a trend, project count, or market outcome.'
  };
}
