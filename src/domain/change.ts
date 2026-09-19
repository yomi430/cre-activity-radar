import type { Change } from '../shared/contracts.js';
export function change(current: number, previous: number, comparable: boolean): Change {
  if (!comparable) return { current, previous, absolute: current - previous, percent: null, basis: 'INCOMPLETE' };
  if (previous === 0) return { current, previous, absolute: current, percent: null, basis: current === 0 ? 'NO_ACTIVITY' : 'NO_BASELINE' };
  return { current, previous, absolute: current - previous, percent: (current - previous) / previous * 100, basis: 'COMPARABLE' };
}
