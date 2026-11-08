/**
 * Pure helpers for the daily-use panel (INV-ADMIN-03): the days a person opened the app, summarized for the
 * administrator. Days are "YYYY-MM-DD" in São Paulo time, as the database stores them.
 */

/** How far back the panel looks (days). */
export const ACTIVITY_WINDOW_DAYS = 30;

/** The day `count` days before `day` (the same calendar, no time zone arithmetic needed). */
export function dayBefore(day: string, count: number): string {
  const [year, month, date] = day.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, date - count)).toISOString().slice(0, 10);
}

export interface ActivitySummary {
  /** Distinct days in the last 7 days, today included. */
  days7: number;
  /** Distinct days in the last 30 days, today included. */
  days30: number;
  /** The most recent day with an open, or null. */
  last: string | null;
  /** Consecutive days with an open, ending today (or yesterday, when today has none yet). */
  streak: number;
}

/** Summarizes the days one person opened the app. `days` may repeat and come in any order; the ones after `today` are ignored. */
export function summarizeDays(days: string[], today: string): ActivitySummary {
  const set = new Set(days.filter((day) => /^\d{4}-\d{2}-\d{2}$/.test(day) && day <= today));
  const within = (count: number) => {
    const floor = dayBefore(today, count - 1);
    return [...set].filter((day) => day >= floor).length;
  };
  const last = [...set].sort().at(-1) ?? null;
  let cursor = set.has(today) ? today : dayBefore(today, 1);
  let streak = 0;
  while (set.has(cursor)) {
    streak += 1;
    cursor = dayBefore(cursor, 1);
  }
  return { days7: within(7), days30: within(ACTIVITY_WINDOW_DAYS), last, streak };
}
