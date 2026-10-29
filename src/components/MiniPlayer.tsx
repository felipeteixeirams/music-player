import React, { useRef, useState } from 'react';
import { SkipForward } from 'lucide-react';
import { PlaybackIcon, playbackLabel, usePlaybackState } from './PlaybackIcon';
import { useAudio } from '../context/AudioContext';
import { swipeAction } from '../utils/scrollChrome';
import { RemoteImage } from './RemoteImage';

export const MiniPlayer: React.FC = () => {
  const playback = usePlaybackState();
  const {
    currentTrack,
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

  return (
    <div className="w-full">
      <div className="w-full">
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
          className="relative h-12 overflow-hidden rounded-full material-regular ring-[0.5px] ring-separator shadow-xl shadow-black/30 cursor-pointer select-none touch-pan-y active:scale-[0.99] transition-all"
        >
          <div className="flex items-center justify-between p-1.5 pl-1.5 gap-2.5">
            {/* Left Slot: Rotating Album Artwork (Vinyl effect) */}
            <div className="relative shrink-0">
              <div
                className="w-9 h-9 rounded-full overflow-hidden shadow-md bg-elevated-2 flex items-center justify-center relative"
              >
                <RemoteImage
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
                <h3 className="text-[15px] leading-tight font-medium text-label truncate">
                  {currentTrack.title}
                </h3>
              </div>
              <p className="text-[13px] text-label-secondary truncate">{currentTrack.artist}</p>
            </div>

            {/* Right Slot: Quick Play/Pause & Next Buttons */}
            <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  togglePlayPause();
                }}
                aria-label={playbackLabel(playback, { pause: 'Pausar música', play: 'Reproduzir música', loading: 'Carregando música' })}
                aria-busy={playback === 'loading'}
                className="w-10 h-10 rounded-full flex items-center justify-center text-label active:scale-90 transition-all"
              >
                <PlaybackIcon state={playback} className="w-6 h-6" />
              </button>

              {!isLive && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  playNext();
                }}
                aria-label="Avançar para a próxima faixa"
                className="w-10 h-10 rounded-full flex items-center justify-center text-label-secondary hover:text-label active:scale-90 transition-all"
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
