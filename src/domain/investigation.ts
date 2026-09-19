import type { ActivityPersistence, Change, InvestigationDriver } from '../shared/contracts.js';
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
