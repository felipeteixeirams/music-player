import React, { useRef, useState } from 'react';
import { Play, Pause, SkipForward } from 'lucide-react';
import { useAudio } from '../context/AudioContext';
import { calculateProgress } from '../utils/audioEngine';
import { PlaybackNotice } from './PlaybackNotice';
import { swipeAction } from '../utils/scrollChrome';

interface MiniPlayerProps {
  /** The tab bar below is collapsed, so the mini player sits lower. */
  compact?: boolean;
}

export const MiniPlayer: React.FC<MiniPlayerProps> = ({ compact = false }) => {
  const {
    currentTrack,
    isPlaying,
    currentTime,
    duration,
    togglePlayPause,
    playNext,
    playPrevious,
    toggleExpanded,
    radioStation,
    isLive
  } = useAudio();

  const dragStart = useRef<{ x: number; y: number } | null>(null);
  const justSwiped = useRef(false);
  const [dragX, setDragX] = useState(0);

  if (!currentTrack) return null;

  // Dragging sideways changes track as in Apple Music: a live broadcast has neither, a station mix only has next
  const allowed = { next: !isLive, previous: !isLive && !radioStation };

  const progress = calculateProgress(currentTime, duration);

  return (
    <div
      className={`fixed left-0 right-0 z-40 px-3 pb-1 pt-1 pointer-events-none max-w-xl md:max-w-2xl mx-auto transition-[bottom] duration-300 motion-reduce:transition-none ${
        compact ? 'bottom-[calc(3rem+var(--safe-bottom))]' : 'bottom-[calc(4.25rem+var(--safe-bottom))]'
      }`}
    >
      <div className="w-full pointer-events-auto">
        <PlaybackNotice className="mb-1.5" />
        {/* iOS-Style Floating Glassmorphic Container */}
        <div
          onClick={() => {
            if (justSwiped.current) return;
            toggleExpanded(true);
          }}
          onPointerDown={(e) => {
            if ((e.target as HTMLElement).closest('button')) return;
            dragStart.current = { x: e.clientX, y: e.clientY };
          }}
          onPointerMove={(e) => {
            const start = dragStart.current;
            if (!start) return;
            const dx = e.clientX - start.x;
            if (Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(e.clientY - start.y)) {
              setDragX(Math.max(-80, Math.min(80, dx * 0.5)));
            }
          }}
          onPointerUp={(e) => {
            const start = dragStart.current;
            dragStart.current = null;
            setDragX(0);
            if (!start) return;
            const dx = e.clientX - start.x;
            const action = swipeAction(dx, e.clientY - start.y, allowed);
            if (Math.abs(dx) > 10) {
              // The click that follows a drag must not open the full player
              justSwiped.current = true;
              window.setTimeout(() => { justSwiped.current = false; }, 0);
            }
            if (action === 'next') playNext();
            else if (action === 'previous') playPrevious();
          }}
          onPointerCancel={() => {
            dragStart.current = null;
            setDragX(0);
          }}
          style={{ transform: dragX ? `translateX(${dragX}px)` : undefined }}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              toggleExpanded(true);
            }
          }}
          aria-label={`Abrir player expandido para ${currentTrack.title} por ${currentTrack.artist}`}
          className="relative overflow-hidden rounded-card material-thin shadow-xl shadow-black/50 cursor-pointer select-none touch-pan-y active:scale-[0.99] transition-all"
        >
          {/* Micro Progress Bar on top edge (a radio has no timeline; a live one shows a pulsing line) */}
          <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-fill-tertiary">
            {isLive ? (
              <div className={`h-full w-full bg-accent ${isPlaying ? 'animate-pulse' : 'opacity-40'}`} />
            ) : radioStation ? null : (
            <div
              className="h-full bg-label transition-all duration-150"
              style={{ width: `${progress}%` }}
            />
            )}
          </div>

          <div className="flex items-center justify-between p-2 pl-3 gap-3">
            {/* Left Slot: Rotating Album Artwork (Vinyl effect) */}
            <div className="relative shrink-0">
              <div
                className="w-11 h-11 rounded-md overflow-hidden shadow-md bg-elevated-2 flex items-center justify-center relative"
              >
                <img
                  src={currentTrack.coverUrl}
                  alt=""
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.currentTarget as HTMLElement).style.display = 'none';
                  }}
                />
              </div>
            </div>

            {/* Middle Slot: Track Name & Artist */}
            <div className="min-w-0 flex-1 text-left">
              <div className="flex items-center gap-1.5">
                <h3 className="text-[15px] font-medium text-label truncate">
                  {currentTrack.title}
                </h3>
              </div>
              <div className="flex items-center gap-1.5 text-[13px] text-label-secondary truncate">
                <span className="truncate">{currentTrack.artist}</span>
                {currentTrack.album && !currentTrack.album.includes('Piped') && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="truncate text-label-tertiary">{currentTrack.album}</span>
                  </>
                )}
              </div>
            </div>

            {/* Right Slot: Quick Play/Pause & Next Buttons */}
            <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  togglePlayPause();
                }}
                aria-label={isPlaying ? 'Pausar música' : 'Reproduzir música'}
                className="w-11 h-11 rounded-full flex items-center justify-center text-label active:scale-90 transition-all"
              >
                {isPlaying ? (
                  <Pause className="w-6 h-6 fill-current" />
                ) : (
                  <Play className="w-6 h-6 fill-current ml-0.5" />
                )}
              </button>

              {!isLive && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  playNext();
                }}
                aria-label="Avançar para a próxima faixa"
                className="w-11 h-11 rounded-full flex items-center justify-center text-label-secondary hover:text-label active:scale-90 transition-all"
              >
                <SkipForward className="w-6 h-6 fill-current" />
              </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
