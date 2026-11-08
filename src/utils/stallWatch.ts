/**
 * Counts frames that came late (a stall the user sees as a freeze) during the first minute after the app opens. It
 * works on every browser, the iPhone's Safari included (which has no long-task measurement), and it only watches
 * that first minute, so it costs nothing afterwards. The result is one line in the Settings > Diagnóstico report.
 */
export const STALL_THRESHOLD_MS = 50;
export const STALL_WATCH_MS = 60_000;

export interface StallSummary {
  /** Frames that took longer than the threshold. */
  count: number;
  /** The longest frame, in milliseconds. */
  worstMs: number;
}

/** The pure part: feed it the frame times and it keeps the late ones. */
export function createStallCounter(startedAt: number, windowMs: number = STALL_WATCH_MS) {
  let last = startedAt;
  let count = 0;
  let worst = 0;
  return {
    /** A frame at `now`. Frames while the page is hidden, and the first one after it returns, are not stalls. */
    frame(now: number, visible: boolean): void {
      const gap = now - last;
      last = now;
      if (!visible || now - startedAt > windowMs || gap <= STALL_THRESHOLD_MS) return;
      count += 1;
      worst = Math.max(worst, gap);
    },
    /** Hide the page: the next frame starts a new measure instead of counting the time away. */
    restart(now: number): void {
      last = now;
    },
    summary: (): StallSummary => ({ count, worstMs: Math.round(worst) }),
  };
}

let counter: ReturnType<typeof createStallCounter> | null = null;

/** Starts once per page load, at the app's opening. */
export function startStallWatch(): void {
  if (counter || typeof requestAnimationFrame !== 'function' || typeof document === 'undefined') return;
  const startedAt = performance.now();
  const current = createStallCounter(startedAt);
  counter = current;
  document.addEventListener('visibilitychange', () => current.restart(performance.now()));
  const tick = (now: number) => {
    current.frame(now, document.visibilityState === 'visible');
    if (now - startedAt <= STALL_WATCH_MS) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

/** The line for the report: how many frames were late in the first minute, and the longest. */
export function stallLine(): string {
  if (!counter) return 'travadas (quadros acima de 50 ms) na abertura: sem medida nesta abertura';
  const { count, worstMs } = counter.summary();
  return `travadas (quadros acima de 50 ms) no 1º minuto: ${count}${count > 0 ? `, maior ${worstMs} ms` : ''}`;
}
