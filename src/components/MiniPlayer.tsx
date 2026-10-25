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
    toggleExpanded
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
          className="relative overflow-hidden rounded-3xl bg-[#12121e]/90 backdrop-blur-2xl border border-white/[0.12] shadow-2xl shadow-black/80 cursor-pointer select-none active:scale-[0.99] transition-all"
        >
          {/* Micro Progress Bar on top edge */}
          <div className="absolute top-0 left-0 right-0 h-[2.5px] bg-white/10">
            <div
              className="h-full bg-gradient-to-r from-purple-500 via-pink-500 to-cyan-400 transition-all duration-150"
              style={{ width: `${progress}%` }}
            />
          </div>

          <div className="flex items-center justify-between p-2 pl-3 gap-3">
            {/* Left Slot: Rotating Album Artwork (Vinyl effect) */}
            <div className="relative shrink-0">
              <div
                className={`w-10 h-10 rounded-2xl overflow-hidden border border-white/20 shadow-md bg-gradient-to-tr from-purple-900/60 to-pink-900/60 flex items-center justify-center relative ${
                  isPlaying ? 'animate-[spin_10s_linear_infinite]' : ''
                }`}
                style={{ transformOrigin: 'center' }}
              >
                <img
                  src={currentTrack.coverUrl}
                  alt=""
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover rounded-2xl"
                  onError={(e) => {
                    (e.currentTarget as HTMLElement).style.display = 'none';
                  }}
                />
              </div>

              {/* Center vinyl pin hole micro-detail */}
              <div className="absolute inset-0 m-auto w-2 h-2 rounded-full bg-black/60 border border-white/40 pointer-events-none" />
            </div>

            {/* Middle Slot: Track Name & Artist */}
            <div className="min-w-0 flex-1 text-left">
              <div className="flex items-center gap-1.5">
                <h3 className="text-xs font-bold text-white truncate">
                  {currentTrack.title}
                </h3>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-white/50 truncate">
                <span className="truncate">{currentTrack.artist}</span>
                {currentTrack.album && !currentTrack.album.includes('Piped') && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="truncate text-white/40">{currentTrack.album}</span>
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
                className="w-9 h-9 rounded-full flex items-center justify-center bg-white text-black hover:bg-white/90 active:scale-90 transition-all shadow-md"
              >
                {isPlaying ? (
                  <Pause className="w-4 h-4 fill-current" />
                ) : (
                  <Play className="w-4 h-4 fill-current ml-0.5" />
                )}
              </button>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  playNext();
                }}
                aria-label="Avançar para a próxima faixa"
                className="w-9 h-9 rounded-full flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 active:scale-90 transition-all"
              >
                <SkipForward className="w-4 h-4 fill-current" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
