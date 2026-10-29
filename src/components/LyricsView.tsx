import React, { useEffect, useRef } from 'react';
import type { LrcLine } from '../utils/lrclibClient';

interface LyricsViewProps {
  lines: LrcLine[];
  /** Lines with real timestamps: the active one is highlighted and follows the song, and a tap on a line jumps to it. */
  synced: boolean;
  currentTime: number;
  onSeek: (seconds: number) => void;
}

/** How long the scrolling leaves the lyrics alone after the person scrolled them by hand. */
const MANUAL_SCROLL_MS = 3000;

/** The lyrics in the middle of the player, as in the music apps: the active line large, the others dim; a tap on a line seeks to it. */
export const LyricsView: React.FC<LyricsViewProps> = ({ lines, synced, currentTime, onSeek }) => {
  const activeRef = useRef<HTMLParagraphElement | null>(null);
  const touchedAt = useRef(0);
  const activeIndex = synced ? lines.reduce((found, line, idx) => (currentTime >= line.time ? idx : found), -1) : -1;

  useEffect(() => {
    if (!synced || performance.now() - touchedAt.current < MANUAL_SCROLL_MS) return;
    activeRef.current?.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
  }, [activeIndex, synced]);

  return (
    <div
      role="region"
      aria-label="Letra da música"
      className="absolute inset-0 overflow-y-auto text-left no-scrollbar [mask-image:linear-gradient(to_bottom,transparent,#000_8%,#000_92%,transparent)]"
      onTouchStart={() => (touchedAt.current = performance.now())}
      onWheel={() => (touchedAt.current = performance.now())}
    >
      <div className="space-y-5 py-10">
        {lines.map((line, idx) => {
          const active = idx === activeIndex;
          return (
            <p
              key={`${line.time}-${idx}`}
              ref={active ? activeRef : undefined}
              onClick={synced ? () => onSeek(line.time) : undefined}
              data-active={active || undefined}
              className={`text-[28px] font-bold leading-tight transition-all duration-300 ${
                !synced ? 'text-label' : active ? 'text-label' : idx < activeIndex ? 'text-label/30' : 'text-label/50'
              } ${synced ? 'cursor-pointer' : ''}`}
            >
              {line.text}
            </p>
          );
        })}
      </div>
    </div>
  );
};
