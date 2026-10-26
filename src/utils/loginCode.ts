import type { KeyValueStorage } from './scopedStorage';

/**
 * How long a code stays valid. This must match "Email OTP Expiration" in the Supabase project (Authentication >
 * Sign In / Providers > Email): the server is what actually expires the code, this only drives the countdown.
 */
export const CODE_TTL_MS = 90_000;
/** How long before another code may be asked for the same address. The server enforces its own interval too. */
export const RESEND_COOLDOWN_MS = 60_000;

const SENT_KEY = 'aurastream_code_sent';
const MAX_REMEMBERED = 5;

export const normalizeEmail = (email: string) => email.trim().toLowerCase();

type Sent = Record<string, number>;

function readSent(storage: Pick<KeyValueStorage, 'getItem'>): Sent {
  try {
    const parsed: unknown = JSON.parse(storage.getItem(SENT_KEY) ?? '{}');
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return Object.fromEntries(Object.entries(parsed).filter((entry): entry is [string, number] => typeof entry[1] === 'number'));
  } catch {
    return {};
  }
}

/** When a code was last sent to this address, so reloading the page does not reset the wait. */
export function lastSentAt(storage: Pick<KeyValueStorage, 'getItem'>, email: string): number | null {
  return readSent(storage)[normalizeEmail(email)] ?? null;
}

export function rememberSent(storage: Pick<KeyValueStorage, 'getItem' | 'setItem'>, email: string, at: number): void {
  try {
    const entries = Object.entries({ ...readSent(storage), [normalizeEmail(email)]: at }).sort(([, a], [, b]) => a - b);
    storage.setItem(SENT_KEY, JSON.stringify(Object.fromEntries(entries.slice(-MAX_REMEMBERED))));
  } catch {
    // The wait then lasts only while the page stays open
  }
}

export interface CodeTimers {
  /** Time left before the code expires (0: expired). */
  codeLeftMs: number;
  /** Time left before another code may be asked for (0: now). */
  resendLeftMs: number;
}

export function codeTimers(sentAt: number, now: number): CodeTimers {
  return {
    codeLeftMs: Math.max(0, sentAt + CODE_TTL_MS - now),
    resendLeftMs: Math.max(0, sentAt + RESEND_COOLDOWN_MS - now)
  };
}

/** "1:05" for 65 s; rounds up, so the display never reads 0:00 while there is still time. */
export function formatCountdown(ms: number): string {
  const seconds = Math.ceil(ms / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

/** Supabase says "you can only request this after 52 seconds" when the same user asks too soon. */
export function parseWaitSeconds(message: string | undefined): number | null {
  const match = message?.match(/after (\d+) seconds?/i);
  return match ? Number(match[1]) : null;
}

export interface RateLimitMessage {
  error: string;
  /** Set when the server said how long to wait: that wait, in seconds. */
  waitSeconds?: number;
}

/**
 * What to tell the user when the server refuses to send a code because of a rate limit. Supabase has three:
 * the same address asked too soon (it says how many seconds), the project's e-mails per hour were all used
 * (nothing the user did, and it can last up to an hour), and too many requests from one network.
 */
export function describeRateLimit(error: { code?: string; message?: string }): RateLimitMessage {
  const waitSeconds = parseWaitSeconds(error.message);
  if (waitSeconds) return { error: `Aguarde ${waitSeconds} s para pedir outro código.`, waitSeconds };

  const text = `${error.code ?? ''} ${error.message ?? ''}`.toLowerCase();
  if (text.includes('over_email_send_rate_limit') || text.includes('email rate limit')) {
    return { error: 'O limite de e-mails por hora do servidor foi atingido. Tente de novo mais tarde ou avise quem te convidou.' };
  }
  if (text.includes('over_request_rate_limit') || text.includes('request rate limit')) {
    return { error: 'Muitos pedidos vindos desta rede. Aguarde alguns minutos e tente de novo.' };
  }
  return { error: 'Muitos pedidos de código. Aguarde alguns minutos e tente de novo.' };
}
