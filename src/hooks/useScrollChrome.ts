import { useEffect, useState } from 'react';
import { nextCompact } from '../utils/scrollChrome';

/** Whether the bottom bar should be collapsed: true while the page is being scrolled down. */
export function useScrollChrome(): { compact: boolean; expand: () => void } {
  const [compact, setCompact] = useState(false);

  useEffect(() => {
    let previousY = window.scrollY;
    let frame = 0;
    const onScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        const y = Math.max(0, window.scrollY);
        setCompact((current) => nextCompact(current, y, previousY));
        previousY = y;
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  return { compact, expand: () => setCompact(false) };
}
