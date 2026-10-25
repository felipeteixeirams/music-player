import React from 'react';
import { Play, Pause, SkipForward } from 'lucide-react';
import { useAudio } from '../context/AudioContext';
import { calculateProgress } from '../utils/audioEngine';
import { PlaybackNotice } from './PlaybackNotice';

export const MiniPlayer: React.FC = () => {
  const {
    currentTrack,
    isPlaying,
    currentTime,
    duration,
    togglePlayPause,
    playNext,
    toggleExpanded,
    radioStation,
    isLive
  } = useAudio();

  if (!currentTrack) return null;

  const progress = calculateProgress(currentTime, duration);

  return (
    <div
      className="fixed bottom-[calc(4.25rem+var(--safe-bottom))] left-0 right-0 z-40 px-3 pb-1 pt-1 pointer-events-none max-w-xl md:max-w-2xl mx-auto"
    >
      <div className="w-full pointer-events-auto">
        <PlaybackNotice className="mb-1.5" />
        {/* iOS-Style Floating Glassmorphic Container */}
        <div
          onClick={() => toggleExpanded(true)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              toggleExpanded(true);
            }
          }}
          aria-label={`Abrir player expandido para ${currentTrack.title} por ${currentTrack.artist}`}
          className="relative overflow-hidden rounded-card material-thin shadow-xl shadow-black/50 cursor-pointer select-none active:scale-[0.99] transition-all"
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
