import { apiFetch } from './apiFetch';
import { getPlaybackLog } from './playbackDiagnostics';

/** What the server accepts (`api/_reportEndpoint.ts`). */
export type ReportKind = 'error' | 'unhandledrejection' | 'react' | 'webgl' | 'startup';

const MAX_REPORTS_PER_SESSION = 5;
/** Errors that say nothing we could act on: a cross-origin script (the YouTube frame) or a browser notice. */
const IGNORED = [/^Script error\.?$/i, /ResizeObserver loop/i, /AbortError/, /The operation was aborted/i];

export const shouldReport = (message: string): boolean => Boolean(message) && !IGNORED.some((pattern) => pattern.test(message));

const sent = new Set<string>();

/** Sends an error to the server's log, without ever throwing: a report must not be a second error. Returns whether it was sent. */
export async function reportClientError(kind: ReportKind, error: unknown, extra = ''): Promise<boolean> {
  const message = error instanceof Error ? error.message || error.name : typeof error === 'string' ? error : String(error ?? '');
  if (!shouldReport(message)) return false;
  const key = `${kind}:${message}`;
  // A loop of the same error, or a flood of different ones, must not become a flood of requests
  if (sent.has(key) || sent.size >= MAX_REPORTS_PER_SESSION) return false;
  sent.add(key);
  try {
    const standalone = window.matchMedia('(display-mode: standalone)').matches || Boolean((navigator as { standalone?: boolean }).standalone);
    const response = await apiFetch('/api/report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      keepalive: true,
      body: JSON.stringify({
        kind,
        message: extra ? `${message} (${extra})` : message,
        stack: error instanceof Error ? error.stack : undefined,
        version: __APP_VERSION__,
        mode: standalone ? 'pwa' : 'browser',
        userAgent: navigator.userAgent,
        path: window.location.pathname,
        recent: getPlaybackLog().slice(-8).map((entry) => entry.text)
      })
    });
    return response.ok;
  } catch {
    return false;
  }
}

/** Reports what the page itself could not handle: uncaught errors and promises rejected with nobody listening. */
export function installErrorReporter(): void {
  window.addEventListener('error', (event) => {
    void reportClientError('error', event.error ?? event.message, event.filename ? `${event.filename.split('/').pop()}:${event.lineno}` : '');
  });
  window.addEventListener('unhandledrejection', (event) => {
    void reportClientError('unhandledrejection', event.reason);
  });
}

/** For tests: forget what was already reported. */
export const resetErrorReports = (): void => sent.clear();
