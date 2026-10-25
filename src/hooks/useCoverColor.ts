import { useEffect, useState } from 'react';
import { darkenForText, pickDominantColor } from '../utils/coverColor';

const SAMPLE_SIZE = 24;

/** `rgb(...)` text of the cover's dominant color, darkened for a white-text background; null until known or when unreadable. */
export function useCoverColor(coverUrl: string | undefined): string | null {
  const [color, setColor] = useState<string | null>(null);

  useEffect(() => {
    setColor(null);
    if (!coverUrl) return;
    let cancelled = false;
    const image = new Image();
    // Without CORS approval the canvas is tainted and cannot be read: the player keeps its neutral background
    image.crossOrigin = 'anonymous';
    image.referrerPolicy = 'no-referrer';
    image.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = SAMPLE_SIZE;
        canvas.height = SAMPLE_SIZE;
        const context = canvas.getContext('2d', { willReadFrequently: true });
        if (!context) return;
        context.drawImage(image, 0, 0, SAMPLE_SIZE, SAMPLE_SIZE);
        const dominant = pickDominantColor(context.getImageData(0, 0, SAMPLE_SIZE, SAMPLE_SIZE).data);
        if (dominant && !cancelled) {
          const [r, g, b] = darkenForText(dominant);
          setColor(`rgb(${r} ${g} ${b})`);
        }
      } catch {
        // Tainted canvas: keep the neutral background
      }
    };
    image.src = coverUrl;
    return () => {
      cancelled = true;
      image.onload = null;
    };
  }, [coverUrl]);

  return color;
}
