/** The São Paulo calendar day of a moment, as "YYYY-MM-DD" (the day the database and the administrator's panel use). */
export function saoPauloDayOf(now: number): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(now);
}
