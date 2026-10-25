export type Rgb = [number, number, number];

/** Max relative brightness of the player background, so white text stays legible on any cover. */
const MAX_BRIGHTNESS = 0.42;

function saturation(r: number, g: number, b: number): number {
  const max = Math.max(r, g, b);
  return max === 0 ? 0 : (max - Math.min(r, g, b)) / max;
}

/**
 * The most representative color of an image's RGBA pixels: pixels are grouped in coarse color buckets and the
 * bucket with most pixels wins, with colorful buckets favored over gray ones. Null when nothing is visible.
 */
export function pickDominantColor(pixels: ArrayLike<number>): Rgb | null {
  const buckets = new Map<number, { count: number; r: number; g: number; b: number }>();
  for (let i = 0; i + 3 < pixels.length; i += 4) {
    if (pixels[i + 3] < 128) continue;
    const r = pixels[i];
    const g = pixels[i + 1];
    const b = pixels[i + 2];
    const key = ((r >> 5) << 6) | ((g >> 5) << 3) | (b >> 5);
    const bucket = buckets.get(key) ?? { count: 0, r: 0, g: 0, b: 0 };
    bucket.count += 1;
    bucket.r += r;
    bucket.g += g;
    bucket.b += b;
    buckets.set(key, bucket);
  }

  let best: { score: number; rgb: Rgb } | null = null;
  for (const { count, r, g, b } of buckets.values()) {
    const rgb: Rgb = [Math.round(r / count), Math.round(g / count), Math.round(b / count)];
    // Near-black and near-white buckets say little about a cover's mood
    const brightness = Math.max(...rgb) / 255;
    const edgePenalty = brightness < 0.15 || Math.min(...rgb) > 235 ? 0.2 : 1;
    const score = count * (0.25 + saturation(...rgb)) * edgePenalty;
    if (!best || score > best.score) best = { score, rgb };
  }
  return best?.rgb ?? null;
}

/** Scales a color down until its brightest channel is at most `MAX_BRIGHTNESS`. */
export function darkenForText([r, g, b]: Rgb): Rgb {
  const brightness = Math.max(r, g, b) / 255;
  const factor = brightness > MAX_BRIGHTNESS ? MAX_BRIGHTNESS / brightness : 1;
  return [Math.round(r * factor), Math.round(g * factor), Math.round(b * factor)];
}
