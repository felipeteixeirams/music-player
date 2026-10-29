import React, { useEffect, useRef } from 'react';
import { ChevronDown } from 'lucide-react';
import type { LrcLine } from '../utils/lrclibClient';

interface LyricsViewProps {
  title: string;
  artist: string;
  lines: LrcLine[];
  /** Lines with real timestamps: the active one is highlighted and follows the song, and a tap on a line jumps to it. */
  synced: boolean;
  currentTime: number;
  onSeek: (seconds: number) => void;
  onClose: () => void;
}

/** How long the scrolling leaves the lyrics alone after the person scrolled them by hand. */
const MANUAL_SCROLL_MS = 3000;

/** The lyrics full screen, as in the music apps: the active line large and centered, the others dim; a tap on a line seeks to it. */
export const LyricsView: React.FC<LyricsViewProps> = ({ title, artist, lines, synced, currentTime, onSeek, onClose }) => {
  const activeRef = useRef<HTMLParagraphElement | null>(null);
  const touchedAt = useRef(0);
  const activeIndex = synced ? lines.reduce((found, line, idx) => (currentTime >= line.time ? idx : found), -1) : -1;

  useEffect(() => {
    if (!synced || performance.now() - touchedAt.current < MANUAL_SCROLL_MS) return;
    activeRef.current?.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
  }, [activeIndex, synced]);

  return (
    <div
      role="dialog"
      aria-label="Letra"
      className="absolute inset-0 z-20 flex flex-col bg-black/70 backdrop-blur-xl animate-in fade-in"
      style={{ paddingTop: 'max(var(--safe-top), 12px)', paddingBottom: 'max(var(--safe-bottom), 20px)' }}
    >
      <div className="mx-auto flex w-full max-w-lg items-center justify-between px-5 pt-1">
        <button onClick={onClose} aria-label="Fechar a letra" className="flex h-10 w-10 items-center justify-center rounded-full material-ultrathin text-label active:scale-90">
          <ChevronDown className="h-5 w-5" />
        </button>
        <div className="min-w-0 px-3 text-center">
          <p className="truncate text-[15px] font-semibold text-label">{title}</p>
          <p className="truncate text-[13px] text-label-secondary">{artist}</p>
        </div>
        <div className="h-10 w-10 shrink-0" aria-hidden="true" />
      </div>

      <div
        className="mx-auto mt-3 w-full max-w-lg flex-1 overflow-y-auto px-6 pb-24 text-left no-scrollbar"
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
    </div>
  );
};
