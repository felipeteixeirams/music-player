import React from 'react';
import { Play, Pause, Heart, Sparkles } from 'lucide-react';
import { Track } from '../types/music';
import { useAudio } from '../context/AudioContext';
import { formatTime } from '../utils/audioEngine';

interface TrackCarouselProps {
  title: string;
  subtitle?: string;
  tracks: Track[];
  onTrackSelect: (track: Track) => void;
}

export const TrackCarousel: React.FC<TrackCarouselProps> = ({
  title,
  subtitle,
  tracks,
  onTrackSelect
}) => {
  const { currentTrack, isPlaying, togglePlayPause, toggleLike, isLiked } = useAudio();

  if (tracks.length === 0) return null;

  return (
    <section className="py-3" aria-label={title}>
      {/* Header */}
      <div className="px-4 flex items-baseline justify-between mb-2.5">
        <div>
          <h2 className="text-sm font-bold text-white tracking-tight flex items-center gap-1.5">
            <span>{title}</span>
          </h2>
          {subtitle && (
            <p className="text-[11px] text-white/40 mt-0.5">{subtitle}</p>
          )}
        </div>
        <span className="text-[11px] text-white/40 tabular-nums">
          {tracks.length} {tracks.length === 1 ? 'faixa' : 'faixas'}
        </span>
      </div>

      {/* Smooth Horizontal Carousel */}
      <div className="flex gap-3 px-4 overflow-x-auto scroll-smooth snap-x snap-mandatory no-scrollbar pb-2 pt-1">
        {tracks.map((track) => {
          const isThisTrackPlaying = currentTrack?.id === track.id && isPlaying;
          const isThisTrackActive = currentTrack?.id === track.id;
          const liked = isLiked(track.id);

          return (
            <div
              key={track.id}
              className="snap-start shrink-0 w-[148px] sm:w-[164px] flex flex-col group"
            >
              {/* Artwork Container */}
              <div
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
                className={`relative aspect-square w-full rounded-3xl overflow-hidden cursor-pointer border transition-all active:scale-95 shadow-lg ${
                  isThisTrackActive
                    ? 'border-purple-500 shadow-purple-900/40 ring-2 ring-purple-500/40'
                    : 'border-white/10 group-hover:border-white/20'
                }`}
              >
                <img
                  src={track.coverUrl}
                  alt={`Capa do álbum ${track.album} por ${track.artist}`}
                  referrerPolicy="no-referrer"
                  className={`w-full h-full object-cover transition-transform duration-500 group-hover:scale-105 ${
                    isThisTrackPlaying ? 'scale-105' : ''
                  }`}
                  loading="lazy"
                />

                {/* Gradient Scrim */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20" />

                {/* Quick Play Trigger Button */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div
                    className={`w-11 h-11 rounded-full flex items-center justify-center backdrop-blur-md shadow-xl transition-all duration-200 ${
                      isThisTrackPlaying
                        ? 'bg-purple-600 text-white scale-100 opacity-100 ring-4 ring-purple-500/30'
                        : isThisTrackActive
                        ? 'bg-white text-black scale-100 opacity-100'
                        : 'bg-black/60 text-white group-hover:scale-100 group-hover:opacity-100 opacity-0 sm:group-hover:opacity-100 active:scale-90'
                    }`}
                  >
                    {isThisTrackPlaying ? (
                      <Pause className="w-5 h-5 fill-current" />
                    ) : (
                      <Play className="w-5 h-5 fill-current ml-0.5" />
                    )}
                  </div>
                </div>

                {/* Duration Tag & Style Pill */}
                <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between text-[10px] text-white/80 font-medium">
                  <span className="tabular-nums bg-black/60 backdrop-blur-md px-1.5 py-0.5 rounded-lg border border-white/10">
                    {formatTime(track.duration)}
                  </span>
                  {isThisTrackPlaying && (
                    <span className="flex items-center gap-0.5 text-purple-400">
                      <span className="w-1 h-3 bg-purple-400 rounded-full animate-pulse" />
                      <span className="w-1 h-2 bg-pink-400 rounded-full animate-pulse delay-75" />
                      <span className="w-1 h-3.5 bg-cyan-400 rounded-full animate-pulse delay-150" />
                    </span>
                  )}
                </div>

                {/* Favorite Heart Button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleLike(track.id);
                  }}
                  aria-label={liked ? `Desfavoritar ${track.title}` : `Favoritar ${track.title}`}
                  className="absolute top-2 right-2 p-1.5 rounded-full bg-black/50 backdrop-blur-md text-white/70 hover:text-white border border-white/10 transition-transform active:scale-80"
                >
                  <Heart
                    className={`w-3.5 h-3.5 ${
                      liked ? 'fill-pink-500 text-pink-500' : 'text-white/80'
                    }`}
                  />
                </button>
              </div>

              {/* Title & Artist Info */}
              <div className="mt-2 text-left">
                <h3
                  className={`text-xs font-semibold truncate ${
                    isThisTrackActive ? 'text-purple-400' : 'text-white'
                  }`}
                >
                  {track.title}
                </h3>
                <p className="text-[11px] text-white/50 truncate">
                  {track.artist}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};
