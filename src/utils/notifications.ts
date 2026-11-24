/** One notice in the person's box (INV-NOT-01). The server writes the text in `payload`; the app only shows it. */
export interface AppNotification {
  id: string;
  kind: string;
  payload: { title?: string; body?: string };
  createdAt: string;
  readAt: string | null;
}

/** Notices in the box that the person has not read yet. */
export function countUnread(notices: AppNotification[]): number {
  return notices.reduce((total, notice) => total + (notice.readAt === null ? 1 : 0), 0);
}

/** The title to show: the server's text, or a plain label when a notice came without one. */
export function noticeTitle(notice: AppNotification): string {
  const title = typeof notice.payload.title === 'string' ? notice.payload.title.trim() : '';
  return title || 'Aviso';
}

/** The text under the title, if the server sent one. */
export function noticeBody(notice: AppNotification): string {
  return typeof notice.payload.body === 'string' ? notice.payload.body.trim() : '';
}

/** Turns the database rows into notices the app uses; a row that does not fit is dropped, not shown broken. */
export function parseNotifications(rows: unknown): AppNotification[] {
  if (!Array.isArray(rows)) return [];
  const out: AppNotification[] = [];
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue;
    const r = row as Record<string, unknown>;
    if (typeof r.id !== 'string' || typeof r.kind !== 'string' || typeof r.created_at !== 'string') continue;
    const payload = r.payload && typeof r.payload === 'object' && !Array.isArray(r.payload) ? (r.payload as AppNotification['payload']) : {};
    out.push({ id: r.id, kind: r.kind, payload, createdAt: r.created_at, readAt: typeof r.read_at === 'string' ? r.read_at : null });
  }
  return out;
}
