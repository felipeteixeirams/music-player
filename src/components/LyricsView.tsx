import React, { useEffect, useRef, useState, useCallback } from 'react';
import { ArrowDown, Sparkles } from 'lucide-react';
import type { LrcLine } from '../utils/lrclibClient';
import { triggerHaptic } from '../utils/haptics';

interface LyricsViewProps {
  lines: LrcLine[];
  /** Lines with real timestamps: the active one is highlighted and follows the song, and a tap on a line jumps to it. */
  synced: boolean;
  currentTime: number;
  onSeek: (seconds: number) => void;
}

/** How long manual scrolling pauses auto-tracking before smoothly resuming (ms). */
const MANUAL_SCROLL_PAUSE_MS = 4000;

/**
 * Lyrics view rendered inside the expanded player: Apple Music karaoke styling,
 * container-relative smooth auto-centering, tap-to-seek, and manual scroll resume pill.
 */
export const LyricsView: React.FC<LyricsViewProps> = ({ lines, synced, currentTime, onSeek }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const lineRefs = useRef<(HTMLParagraphElement | null)[]>([]);
  const [isManualScroll, setIsManualScroll] = useState(false);
  const scrollTimeoutRef = useRef<number | null>(null);

  // Compute active lyric index based on current playback second
  const activeIndex = synced
    ? lines.reduce((found, line, idx) => (currentTime >= line.time ? idx : found), -1)
    : -1;

  // Smooth scroll container to center the active lyric line
  const scrollToActiveLine = useCallback((smooth = true) => {
    const container = containerRef.current;
    if (!container || activeIndex < 0) return;

    const activeEl = lineRefs.current[activeIndex];
    if (!activeEl) return;

    const containerHeight = container.clientHeight;
    const targetScroll = activeEl.offsetTop - (containerHeight / 2) + (activeEl.clientHeight / 2);

    container.scrollTo({
      top: Math.max(0, targetScroll),
      behavior: smooth ? 'smooth' : 'auto'
    });
  }, [activeIndex]);

  // Handle auto-scroll whenever active line changes (unless user paused by manual scroll)
  useEffect(() => {
    if (!synced || isManualScroll) return;
    scrollToActiveLine(true);
  }, [activeIndex, synced, isManualScroll, scrollToActiveLine]);

  // Track user manual scrolling via touch or wheel
  const handleUserInteraction = () => {
    setIsManualScroll(true);
    if (scrollTimeoutRef.current) {
      window.clearTimeout(scrollTimeoutRef.current);
    }
    scrollTimeoutRef.current = window.setTimeout(() => {
      setIsManualScroll(false);
    }, MANUAL_SCROLL_PAUSE_MS);
  };

  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) {
        window.clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

  const handleResumeSync = () => {
    triggerHaptic('selection');
    setIsManualScroll(false);
    scrollToActiveLine(true);
  };

  return (
    <div className="relative w-full h-full select-none">
      <div
        ref={containerRef}
        role="region"
        aria-label="Letra da música"
        onTouchStart={handleUserInteraction}
        onWheel={handleUserInteraction}
        className="absolute inset-0 overflow-y-auto text-left no-scrollbar [mask-image:linear-gradient(to_bottom,transparent,#000_10%,#000_90%,transparent)] px-2"
      >
        <div className="space-y-6 py-20 pb-32">
          {lines.map((line, idx) => {
            const isActive = idx === activeIndex;
            const isPast = idx < activeIndex;

            return (
              <p
                key={`${line.time}-${idx}`}
                ref={(el) => {
                  lineRefs.current[idx] = el;
                }}
                onClick={
                  synced
                    ? () => {
                        triggerHaptic('light');
                        onSeek(line.time);
                      }
                    : undefined
                }
                data-active={isActive || undefined}
                className={`transition-all duration-300 leading-tight ${
                  !synced
                    ? 'text-[24px] sm:text-[28px] font-bold text-white'
                    : isActive
                    ? 'text-[30px] sm:text-[34px] font-extrabold text-white drop-shadow-[0_2px_18px_rgba(255,255,255,0.4)] scale-[1.02] origin-left py-1'
                    : isPast
                    ? 'text-[24px] sm:text-[28px] font-bold text-white/35 hover:text-white/60 active:scale-[0.99]'
                    : 'text-[24px] sm:text-[28px] font-bold text-white/55 hover:text-white/80 active:scale-[0.99]'
                } ${synced ? 'cursor-pointer' : ''}`}
              >
                {line.text}
              </p>
            );
          })}
        </div>
      </div>

      {/* Floating Resume Sync Pill when user scrolled manually */}
      {synced && isManualScroll && activeIndex >= 0 && (
        <div className="absolute bottom-6 left-0 right-0 flex justify-center pointer-events-none z-20 animate-in fade-in zoom-in-95 duration-200">
          <button
            onClick={handleResumeSync}
            className="pointer-events-auto flex items-center gap-2 px-4 py-2 rounded-full bg-black/60 backdrop-blur-md border border-white/20 text-white text-[13px] font-semibold shadow-xl active:scale-95 transition-transform"
          >
            <ArrowDown className="w-3.5 h-3.5 text-accent animate-bounce" />
            <span>Voltar ao momento atual</span>
          </button>
        </div>
      )}
    </div>
  );
};
