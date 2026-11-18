import React, { useRef, useState } from 'react';
import { SkipForward } from 'lucide-react';
import { PlaybackIcon, SoundWaveEqualizer, playbackLabel, usePlaybackState } from './PlaybackIcon';
import { useAudio, usePlaybackTime } from '../context/AudioContext';
import { swipeAction } from '../utils/scrollChrome';
import { RemoteImage } from './RemoteImage';
import { triggerHaptic } from '../utils/haptics';

/** Separate sub-component to isolate 4Hz clock renders from MiniPlayer controls and container */
const MiniPlayerProgress: React.FC = () => {
  const { currentTime, duration } = usePlaybackTime();
  const percent = duration > 0 ? Math.min(100, Math.max(0, (currentTime / duration) * 100)) : 0;
  if (percent <= 0) return null;

  return (
    <div className="absolute inset-x-0 bottom-0 h-[2px] bg-white/[0.08] overflow-hidden pointer-events-none">
      <div
        className="h-full bg-accent transition-[width] duration-200 ease-linear"
        style={{ width: `${percent}%` }}
      />
    </div>
  );
};

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
        {/* iOS-Style Floating Glassmorphic Container with Specular Top Highlight */}
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
            if (action === 'next') {
              triggerHaptic('selection');
              playNext();
            } else if (action === 'previous') {
              triggerHaptic('selection');
              playPrevious();
            }
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
          className="relative h-12 overflow-hidden rounded-full material-regular ring-[0.5px] ring-separator shadow-2xl shadow-black/40 cursor-pointer select-none touch-pan-y active:scale-[0.99] transition-all"
        >
          {/* Real-time integrated progress line */}
          {!isLive && <MiniPlayerProgress />}

          <div className="flex items-center justify-between p-1.5 pl-2 gap-2.5">
            {/* Left Slot: Rotating Album Artwork with Ambient Halo */}
            <div className="relative shrink-0">
              <div
                className="absolute -inset-1 rounded-full bg-accent/25 blur-[5px] pointer-events-none"
                aria-hidden="true"
              />
              <div
                className="w-9 h-9 rounded-full overflow-hidden shadow-md bg-elevated-2 flex items-center justify-center relative ring-1 ring-white/15"
              >
                <RemoteImage
                  src={currentTrack.coverUrl}
                  sizes="36px"
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
                {playback === 'playing' && (
                  <SoundWaveEqualizer isPlaying={true} className="h-2.5 w-2.5 shrink-0" barClassName="bg-accent" />
                )}
              </div>
              <p className="text-[13px] text-label-secondary truncate">{currentTrack.artist}</p>
            </div>

            {/* Right Slot: Quick Play/Pause & Next Buttons */}
            <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  triggerHaptic('light');
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
                  triggerHaptic('selection');
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
