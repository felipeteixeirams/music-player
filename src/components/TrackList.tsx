import React from 'react';
import { Play, Pause, Heart, Sparkles, Music } from 'lucide-react';
import { Track } from '../types/music';
import { useAudio } from '../context/AudioContext';
import { formatTime } from '../utils/audioEngine';

interface TrackListProps {
  tracks: Track[];
  title?: string;
  onTrackSelect: (track: Track) => void;
  emptyMessage?: string;
}

export const TrackList: React.FC<TrackListProps> = ({
  tracks,
  title,
  onTrackSelect,
  emptyMessage = 'Nenhuma faixa encontrada nesta seção.'
}) => {
  const { currentTrack, isPlaying, togglePlayPause, toggleLike, isLiked } = useAudio();

  if (tracks.length === 0) {
    return (
      <div className="px-4 py-8 text-center text-white/50 text-xs">
        <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-2.5 text-white/40">
          <Music className="w-6 h-6" />
        </div>
        <p>{emptyMessage}</p>
      </div>
    );
  }

  return (
    <section className="px-4 py-3" aria-label={title || 'Lista de faixas'}>
      {title && (
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-bold text-white tracking-tight">{title}</h2>
          <span className="text-[11px] text-white/40 tabular-nums">
            {tracks.length} {tracks.length === 1 ? 'faixa' : 'faixas'}
          </span>
        </div>
      )}

      <div className="space-y-1.5">
        {tracks.map((track, idx) => {
          const isThisTrackActive = currentTrack?.id === track.id;
          const isThisTrackPlaying = isThisTrackActive && isPlaying;
          const liked = isLiked(track.id);

          return (
            <div
              key={track.id}
              onClick={() => {
                if (isThisTrackActive) {
                  togglePlayPause();
                } else {
                  onTrackSelect(track);
                }
              }}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  if (isThisTrackActive) togglePlayPause();
                  else onTrackSelect(track);
                }
              }}
              className={`flex items-center justify-between p-2.5 rounded-2xl transition-all cursor-pointer border active:scale-[0.98] ${
                isThisTrackActive
                  ? 'bg-purple-900/25 border-purple-500/30 text-white'
                  : 'bg-white/[0.02] hover:bg-white/[0.05] border-transparent hover:border-white/5 text-white/90'
              }`}
            >
              {/* Left Slot: Index / Play Icon & Artwork */}
              <div className="flex items-center gap-3 min-w-0">
                <div className="relative w-12 h-12 rounded-2xl overflow-hidden shrink-0 border border-white/10 bg-gradient-to-tr from-purple-900/40 via-pink-900/30 to-indigo-950 flex items-center justify-center">
                  <Music className="w-5 h-5 text-purple-300/60" />
                  <img
                    src={track.coverUrl}
                    alt=""
                    referrerPolicy="no-referrer"
                    className="absolute inset-0 w-full h-full object-cover"
                    loading="lazy"
                    onError={(e) => {
                      (e.currentTarget as HTMLElement).style.display = 'none';
                    }}
                  />
                  {isThisTrackPlaying && (
                    <div className="absolute inset-0 bg-black/50 backdrop-blur-[1px] flex items-center justify-center">
                      <Pause className="w-5 h-5 text-purple-400 fill-current" />
                    </div>
                  )}
                  {!isThisTrackPlaying && isThisTrackActive && (
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                      <Play className="w-5 h-5 text-white fill-current ml-0.5" />
                    </div>
                  )}
                </div>

                {/* Track Details */}
                <div className="min-w-0 text-left">
                  <h3
                    className={`text-xs font-semibold truncate ${
                      isThisTrackActive ? 'text-purple-400' : 'text-white'
                    }`}
                  >
                    {track.title}
                  </h3>
                  <div className="flex items-center gap-1.5 text-[11px] text-white/50 truncate mt-0.5">
                    <span className="truncate">{track.artist}</span>
                    <span aria-hidden="true">·</span>
                    <span className="truncate text-white/40">{track.album}</span>
                  </div>
                </div>
              </div>

              {/* Right Slot: Duration & Favorite */}
              <div className="flex items-center gap-2 shrink-0 ml-3">
                <span className="text-[11px] text-white/40 tabular-nums font-mono">
                  {formatTime(track.duration)}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleLike(track.id);
                  }}
                  aria-label={liked ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
                  className="p-2 rounded-full hover:bg-white/10 text-white/60 hover:text-white transition-transform active:scale-75"
                >
                  <Heart
                    className={`w-4 h-4 ${
                      liked ? 'fill-pink-500 text-pink-500' : 'text-white/40 hover:text-white'
                    }`}
                  />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};
