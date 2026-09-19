export const WINDOWS = {
  prior: { start: '2024-07-01', endExclusive: '2025-07-01' },
  current: { start: '2025-07-01', endExclusive: '2026-07-01' },
} as const;
export type Period = keyof typeof WINDOWS;
export function dateOnly(value: unknown): string | null {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}/.test(value)) return null;
  const date = value.slice(0, 10); const parsed = new Date(`${date}T00:00:00Z`);
  return Number.isNaN(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== date ? null : date;
}
export function periodFor(date: string): Period | null {
  for (const [period, window] of Object.entries(WINDOWS) as Array<[Period, typeof WINDOWS[Period]]>) {
    if (date >= window.start && date < window.endExclusive) return period;
  }
  return null;
}
export function months(): string[] {
  const result: string[] = []; let year = 2024; let month = 7;
  for (let i = 0; i < 24; i += 1) { result.push(`${year}-${String(month).padStart(2, '0')}`); month += 1; if (month === 13) { month = 1; year += 1; } }
  return result;
}
