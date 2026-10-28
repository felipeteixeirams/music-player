/**
 * Resolving ahead of the tap. A track nobody has played has no known video: the search happens after the tap, takes
 * a second or two, and by then the iPhone no longer accepts the player starting by itself. For the few tracks the
 * person is likely to play (the next ones in the queue, the first of each personal card) the search is done in
 * the idle time before, so the tap finds the video already known (the only case measured as starting by itself).
 *
 * It costs YouTube searches, so it is slow and small: one at a time, a few per session, only on a visible page and a
 * connection that is not in data saver, and it stops for the day when the server says the part of the daily allowance
 * kept for warming is spent (the server holds the real limit: `WARM_RESERVE` in `api/_resolveEndpoint.ts`).
 */

export type WarmResult = 'cached' | 'searched' | 'skipped' | 'failed';

export interface WarmTrack {
  id: string;
}

export interface WarmQueueOptions<T extends WarmTrack> {
  isKnown: (id: string) => boolean;
  warm: (track: T) => Promise<WarmResult>;
  canRun: () => boolean;
  /** The day, for remembering that the server refused: "2026-10-28". */
  today: () => string;
  stoppedDay: { get: () => string | null; set: (day: string) => void };
  /** Searches (not cache hits) allowed in one session of the app. */
  maxSearches?: number;
  startDelayMs?: number;
  gapMs?: number;
  schedule?: (callback: () => void, ms: number) => unknown;
}

export function createWarmQueue<T extends WarmTrack>(options: WarmQueueOptions<T>) {
  const maxSearches = options.maxSearches ?? 6;
  const startDelayMs = options.startDelayMs ?? 3000;
  const gapMs = options.gapMs ?? 1500;
  const schedule = options.schedule ?? ((callback, ms) => setTimeout(callback, ms));

  const queue: T[] = [];
  const seen = new Set<string>();
  let searches = 0;
  let failures = 0;
  let stopped = false;
  let running = false;
  let scheduled = false;

  const stop = () => {
    stopped = true;
    queue.length = 0;
  };

  const next = (ms: number) => {
    if (scheduled || stopped) return;
    scheduled = true;
    schedule(() => {
      scheduled = false;
      void run();
    }, ms);
  };

  async function run(): Promise<void> {
    if (running || stopped) return;
    if (options.stoppedDay.get() === options.today()) return stop();
    if (!options.canRun()) return next(gapMs * 4);
    let track = queue.shift();
    while (track && options.isKnown(track.id)) track = queue.shift();
    if (!track) return;

    running = true;
    let result: WarmResult = 'failed';
    try {
      result = await options.warm(track);
    } catch {
      result = 'failed';
    }
    running = false;

    if (result === 'skipped') {
      options.stoppedDay.set(options.today());
      return stop();
    }
    if (result === 'searched') {
      failures = 0;
      searches += 1;
      if (searches >= maxSearches) return stop();
    } else if (result === 'failed') {
      failures += 1;
      if (failures >= 3) return stop();
    }
    // A cache hit cost nothing: the next one may follow soon
    if (queue.length > 0) next(result === 'cached' ? 250 : gapMs);
  }

  return {
    /** `first` puts them ahead of what is waiting (the next track of the queue matters more than a card's). */
    enqueue(tracks: T[], first = false): void {
      if (stopped) return;
      const fresh = tracks.filter((track) => !seen.has(track.id) && !options.isKnown(track.id));
      for (const track of fresh) seen.add(track.id);
      if (first) queue.unshift(...fresh);
      else queue.push(...fresh);
      if (queue.length > 0) next(startDelayMs);
    },
    /** For tests and the report: what happened in this session. */
    stats: () => ({ searches, failures, stopped, waiting: queue.length })
  };
}
