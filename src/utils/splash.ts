/**
 * The opening screen (index.html, #splash): it shows while the app's JavaScript loads, and is taken away once the app has
 * painted, with a fade. It stays at least SPLASH_MIN_MS from the start of the page, so a fast start still shows the
 * animation for a moment instead of a flash (INV-UI-14).
 */
export const SPLASH_MIN_MS = 900;
const FADE_MS = 400;

/** How long to keep the opening screen after `elapsedMs` since the page started (never negative). */
export function splashWait(elapsedMs: number, minMs = SPLASH_MIN_MS): number {
  return Math.max(0, minMs - elapsedMs);
}

/** Takes the opening screen away: after the app has painted (two frames) and the minimum time, with a fade. */
export function hideSplash(elapsedMs: number = performance.now()): void {
  const splash = document.getElementById('splash');
  if (!splash) return;
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      window.setTimeout(() => {
        splash.classList.add('splash-hide');
        window.setTimeout(() => splash.remove(), FADE_MS);
      }, splashWait(elapsedMs));
    });
  });
}
