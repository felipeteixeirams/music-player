import { scrub } from './_trace.js';

/** What the app reports about itself: errors it could not handle, so a "black screen" can be found in the log. */
export const REPORT_KINDS = ['error', 'unhandledrejection', 'react', 'webgl', 'startup'] as const;
export type ReportKind = (typeof REPORT_KINDS)[number];

const MAX_BODY_CHARS = 8000;
const MAX_RECENT = 8;

const text = (value: unknown, max: number): string => scrub(typeof value === 'string' ? value : '', max);

/**
 * One log line for an app report (or null when it is not one): single line, no e-mail, token or key, every field
 * cut short. The trace tag in front (request, session, account) is added by the logger.
 */
export function formatClientReport(body: unknown): string | null {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
  if (JSON.stringify(body).length > MAX_BODY_CHARS) return null;
  const report = body as Record<string, unknown>;
  const kind = REPORT_KINDS.find((candidate) => candidate === report.kind);
  if (!kind) return null;

  const recent = Array.isArray(report.recent) ? report.recent.slice(-MAX_RECENT).map((entry) => text(entry, 120)).filter(Boolean) : [];
  const fields = [
    `kind=${kind}`,
    `v=${text(report.version, 20) || '?'}`,
    `mode=${report.mode === 'pwa' ? 'pwa' : 'browser'}`,
    `ua="${text(report.userAgent, 160)}"`,
    `path=${text(report.path, 100) || '/'}`,
    `msg="${text(report.message, 300)}"`
  ];
  const stack = text(report.stack, 900);
  if (stack) fields.push(`stack="${stack}"`);
  if (recent.length > 0) fields.push(`recent="${recent.join(' | ')}"`);
  return `[Client] ${fields.join(' ')}`;
}

export function reportEndpoint(body: unknown): { status: number; body: unknown } {
  const line = formatClientReport(body);
  if (!line) return { status: 400, body: { error: 'Relatório inválido' } };
  console.error(line);
  return { status: 204, body: null };
}
