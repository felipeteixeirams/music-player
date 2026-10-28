import { AsyncLocalStorage } from 'node:async_hooks';
import { randomBytes } from 'node:crypto';

/**
 * Traceability of the server log: every line written while a request is handled starts with who and what it is
 * (`rid=` the request, `sid=` the app session on that device, `uid=` the account, `route=` the endpoint), so the
 * lines of one flow (a track being played: resolve, quota, start) can be followed together in the Vercel logs and
 * tied to one person. The ids are made by the app and sent as headers; the server never trusts their shape.
 * Never put a token, a key or an e-mail in a log line (see `scrub`).
 */

export interface TraceContext {
  /** This request. The app makes it, so a call that never reached the server is still named in the app's own log. */
  rid: string;
  /** The app session on one device (a page load), shared by all its requests and its error reports. */
  sid: string | null;
  /** The signed-in account's id, once the login was checked. */
  uid: string | null;
  /** The endpoint: `search`, `resolve`... */
  route: string;
}

type Headers = Record<string, string | string[] | undefined>;

const storage = new AsyncLocalStorage<TraceContext>();
const ID_SHAPE = /^[A-Za-z0-9_-]{6,40}$/;

function header(headers: Headers, name: string): string | undefined {
  const value = headers[name];
  return Array.isArray(value) ? value[0] : value;
}

const cleanId = (value: string | undefined): string | null => (value && ID_SHAPE.test(value) ? value : null);

/** The route out of the address: `/api/search?q=x` -> `search`. */
export function routeOf(url: string | undefined): string {
  const match = /^\/api\/([a-z-]+)/.exec((url ?? '').split('?')[0]);
  return match ? match[1] : 'unknown';
}

/** Starts the trace of a request: from here on, the log lines of this request carry its ids. */
export function startTrace(headers: Headers, url?: string): TraceContext {
  const context: TraceContext = {
    rid: cleanId(header(headers, 'x-request-id')) ?? randomBytes(5).toString('hex'),
    sid: cleanId(header(headers, 'x-session-id')),
    uid: null,
    route: routeOf(url)
  };
  storage.enterWith(context);
  return context;
}

export function setTraceUser(context: TraceContext, userId: string): void {
  context.uid = userId;
}

export const currentTrace = (): TraceContext | undefined => storage.getStore();

/** The start of a log line for a context: only what is known is written. */
export function traceTag(context: TraceContext | undefined = storage.getStore()): string {
  if (!context) return '';
  const parts = [`rid=${context.rid}`];
  if (context.sid) parts.push(`sid=${context.sid}`);
  if (context.uid) parts.push(`uid=${context.uid}`);
  parts.push(`route=${context.route}`);
  return `${parts.join(' ')} `;
}

let installed = false;

/** Makes every `console` line written during a request start with its trace tag. Safe to call more than once. */
export function installTraceLogging(): void {
  if (installed) return;
  installed = true;
  for (const method of ['log', 'info', 'warn', 'error'] as const) {
    const original = console[method].bind(console);
    console[method] = (...args: unknown[]) => {
      const tag = traceTag();
      if (!tag) return original(...args);
      return typeof args[0] === 'string' ? original(`${tag}${args[0]}`, ...args.slice(1)) : original(tag.trim(), ...args);
    };
  }
}

const EMAIL = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g;
const JWT = /eyJ[\w-]+\.[\w-]+\.[\w-]*/g;
const BEARER = /Bearer\s+\S+/gi;
const LONG_SECRET = /[A-Za-z0-9_-]{32,}/g;

/** Text from outside (an error message, a stack) made safe for a log line: no e-mail, token or key, one line, cut short. */
export function scrub(text: unknown, max: number): string {
  if (typeof text !== 'string') return '';
  return text
    .replace(EMAIL, '[e-mail]')
    .replace(JWT, '[token]')
    .replace(BEARER, 'Bearer [token]')
    .replace(LONG_SECRET, '[segredo]')
    .replace(/\s*[\r\n]+\s*/g, ' ⏎ ')
    .trim()
    .slice(0, max);
}
