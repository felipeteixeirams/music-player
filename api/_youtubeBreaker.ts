/**
 * The circuit breaker of the YouTube search API. When the daily quota is spent the API answers every search with an
 * error, and trying again on every tap only adds delay: the first refusal opens the breaker, the next searches skip the
 * official API (and go to the web search) until the quota resets, and every serverless instance learns of it through
 * the database. All of it fails open: if the state cannot be read or written, searching goes on as if it were closed.
 */

export type BreakerReason = 'quota' | 'rate' | 'key';

export interface BreakerState {
  /** When the breaker closes again, in ms since the epoch. */
  until: number;
  reason: BreakerReason;
}

/** Where the state is kept for every instance (the `service_state` table). */
export interface BreakerStore {
  get(key: string): Promise<BreakerState | null>;
  set(key: string, state: BreakerState): Promise<void>;
}

export interface YoutubeBreaker {
  /** The state while the breaker is open, null when closed. */
  check(): Promise<BreakerState | null>;
  /** The official API refused a search for this reason: keep it off for a while. */
  trip(reason: BreakerReason): Promise<BreakerState>;
}

export const BREAKER_KEY = 'youtube_api';
/** How long a "closed" answer is trusted before the shared state is read again. */
const CLOSED_TTL_MS = 30_000;
const RATE_PAUSE_MS = 60_000;
const KEY_PAUSE_MS = 10 * 60_000;

/** An error answer from the YouTube Data API, with the reason it gave. */
export class YouTubeApiError extends Error {
  constructor(public readonly status: number, public readonly reason: string, message?: string) {
    super(message ?? `YouTube HTTP ${status}${reason ? ` ${reason}` : ''}`);
  }
}

/**
 * What an official-search failure means: `quota` (the day's units are spent), `rate` (too many requests in a moment),
 * `key` (the key is refused or the API is not enabled: the configuration, not the day), or null for anything else
 * (a timeout, a 500): those say nothing about the day, so they do not open the breaker.
 */
export function classifyYouTubeError(error: unknown): BreakerReason | null {
  if (!(error instanceof YouTubeApiError)) return null;
  const reason = error.reason;
  if (reason === 'quotaExceeded' || reason === 'dailyLimitExceeded') return 'quota';
  if (reason === 'rateLimitExceeded' || reason === 'userRateLimitExceeded') return 'rate';
  if (['keyInvalid', 'keyExpired', 'accessNotConfigured', 'ipRefererBlocked', 'forbidden'].includes(reason)) return 'key';
  if (error.status === 429) return 'rate';
  return null;
}

/** The next midnight in Pacific time (when YouTube resets the daily quota), in ms. Offsets are whole hours, so hour steps hit it exactly. */
export function nextQuotaReset(now: number): number {
  const hourPt = (t: number) => Number(new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', hour: 'numeric', hourCycle: 'h23' }).format(t));
  const HOUR = 3_600_000;
  let t = Math.floor(now / HOUR) * HOUR + HOUR;
  for (let i = 0; i < 26 && hourPt(t) !== 0; i += 1) t += HOUR;
  return t;
}

export function breakerUntil(reason: BreakerReason, now: number): number {
  return reason === 'quota' ? nextQuotaReset(now) : now + (reason === 'rate' ? RATE_PAUSE_MS : KEY_PAUSE_MS);
}

/** What one instance remembers between requests (module level, shared by every request it serves). */
export interface BreakerMemory {
  state: BreakerState | null;
  /** When "closed" was last confirmed against the shared state. */
  checkedAt: number;
}

export const newBreakerMemory = (): BreakerMemory => ({ state: null, checkedAt: 0 });

export function createYoutubeBreaker(options: {
  memory: BreakerMemory;
  store: BreakerStore | null;
  now?: () => number;
  log?: (line: string) => void;
}): YoutubeBreaker {
  const { memory, store } = options;
  const now = options.now ?? Date.now;
  const log = options.log ?? ((line: string) => console.warn(line));

  return {
    async check() {
      const at = now();
      if (memory.state && memory.state.until > at) return memory.state;
      memory.state = null;
      if (!store || at - memory.checkedAt < CLOSED_TTL_MS) return null;
      memory.checkedAt = at;
      try {
        const shared = await store.get(BREAKER_KEY);
        if (shared && shared.until > at) memory.state = shared;
      } catch (err) {
        log(`[YouTube] disjuntor: estado compartilhado indisponível (${(err as Error).message}); seguindo sem ele`);
      }
      return memory.state;
    },
    async trip(reason) {
      const at = now();
      const state: BreakerState = { until: breakerUntil(reason, at), reason };
      const already = memory.state && memory.state.until >= state.until;
      if (!already) {
        memory.state = state;
        log(`[YouTube] disjuntor aberto (${reason}): busca oficial suspensa até ${new Date(state.until).toISOString()}`);
        if (store) await store.set(BREAKER_KEY, state).catch((err: Error) => log(`[YouTube] disjuntor não gravado (${err.message}); vale só nesta instância`));
      }
      return memory.state ?? state;
    }
  };
}
