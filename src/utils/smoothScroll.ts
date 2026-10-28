/**
 * Scrolls the page to the top with a curve of our own (the browser's `behavior: 'smooth'` has no say on the curve and
 * not every iPhone version has it): a gentle start, quick in the middle and a long, soft stop, like a native list
 * returning to the top. Nothing is reloaded: only the scroll position moves.
 */

/** Material's "standard" curve: starts softly (the first tenth of the time covers about 4% of the way) and brakes for the last third. */
const CURVE = [0.4, 0, 0.2, 1] as const;
const MIN_MS = 450;
const MAX_MS = 750;

/** A CSS-style cubic Bézier: `t` (time, 0..1) in, progress (0..1) out. */
export function cubicBezier(x1: number, y1: number, x2: number, y2: number): (t: number) => number {
  const axis = (a: number, b: number, s: number) => 3 * a * (1 - s) * (1 - s) * s + 3 * b * (1 - s) * s * s + s * s * s;
  const slope = (a: number, b: number, s: number) => 3 * a * (1 - s) * (1 - s) + 6 * (b - a) * (1 - s) * s + 3 * (1 - b) * s * s;
  return (t) => {
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    // Find the curve parameter whose x is t: Newton's steps, then bisection when the slope is too flat
    let s = t;
    for (let i = 0; i < 8; i += 1) {
      const error = axis(x1, x2, s) - t;
      if (Math.abs(error) < 1e-5) return axis(y1, y2, s);
      const d = slope(x1, x2, s);
      if (Math.abs(d) < 1e-6) break;
      s -= error / d;
    }
    let low = 0;
    let high = 1;
    s = t;
    for (let i = 0; i < 24; i += 1) {
      const x = axis(x1, x2, s);
      if (Math.abs(x - t) < 1e-5) break;
      if (x < t) low = s;
      else high = s;
      s = (low + high) / 2;
    }
    return axis(y1, y2, s);
  };
}

export const easeScroll = cubicBezier(...CURVE);

/** Longer trips take longer, within bounds: a near scroll is not a slow crawl and a far one is not a blink. */
export const scrollDuration = (distance: number): number => Math.min(MAX_MS, MIN_MS + Math.max(0, distance) * 0.05);

/**
 * Animates the page to the top. The person's own touch, wheel or key takes over at once (the animation stops where it
 * is). With "reduce motion" on, it just goes. Returns a function that stops it.
 */
export function scrollToTop(): () => void {
  const from = window.scrollY;
  if (from <= 0) return () => undefined;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    window.scrollTo(0, 0);
    return () => undefined;
  }

  const duration = scrollDuration(from);
  const start = performance.now();
  let frame = 0;
  const interrupts = ['touchstart', 'wheel', 'pointerdown', 'keydown'] as const;

  const stop = () => {
    window.cancelAnimationFrame(frame);
    for (const type of interrupts) window.removeEventListener(type, stop);
  };
  const step = (now: number) => {
    const progress = Math.min(1, (now - start) / duration);
    window.scrollTo(0, Math.round(from * (1 - easeScroll(progress))));
    if (progress < 1) frame = window.requestAnimationFrame(step);
    else stop();
  };

  for (const type of interrupts) window.addEventListener(type, stop, { passive: true, once: true });
  frame = window.requestAnimationFrame(step);
  return stop;
}
