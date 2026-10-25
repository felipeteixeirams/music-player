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
  /** Size of the whole collection when `tracks` is only its first page. */
  totalCount?: number;
  /** Opens the whole collection. */
  onSeeAll?: () => void;
}

export const TrackCarousel: React.FC<TrackCarouselProps> = ({
  title,
  subtitle,
  tracks,
  onTrackSelect,
  totalCount,
  onSeeAll
}) => {
  const { currentTrack, isPlaying, togglePlayPause, toggleLike, isLiked } = useAudio();

  if (tracks.length === 0) return null;

  return (
    <section className="py-3" aria-label={title}>
      {/* Header */}
      <div className="px-4 flex items-baseline justify-between mb-2.5">
        <div>
          <h2 className="text-[22px] font-bold text-label tracking-tight flex items-center gap-1.5">
            <span>{title}</span>
          </h2>
          {subtitle && (
            <p className="text-[13px] text-label-secondary mt-0.5">{subtitle}</p>
          )}
        </div>
        <div className="flex items-center gap-2.5 shrink-0">
          <span className="text-[13px] text-label-secondary tabular-nums">
            {totalCount ?? tracks.length} {(totalCount ?? tracks.length) === 1 ? 'faixa' : 'faixas'}
          </span>
          {onSeeAll && (
            <button
              onClick={onSeeAll}
              aria-label={`Ver todas as faixas de ${title}`}
              className="text-[15px] text-accent hover:text-accent-pressed active:scale-95"
            >
              Ver tudo
            </button>
          )}
        </div>
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
                className={`relative aspect-square w-full rounded-cover overflow-hidden cursor-pointer transition-all active:scale-95 shadow-lg shadow-black/50 ${
                  isThisTrackActive ? 'ring-2 ring-accent' : ''
                }`}
              >
                <img
                  src={track.coverUrl}
                  alt=""
                  referrerPolicy="no-referrer"
                  loading="lazy"
                  decoding="async"
                  className={`w-full h-full object-cover transition-transform duration-500 group-hover:scale-105 ${
                    isThisTrackPlaying ? 'scale-105' : ''
                  }`}
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).src = 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=400&auto=format&fit=crop&q=80';
                  }}
                />

                {/* Gradient Scrim */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

                {/* Quick Play Trigger Button */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div
                    className={`w-11 h-11 rounded-full flex items-center justify-center shadow-xl transition-all duration-200 ${
                      isThisTrackPlaying
                        ? 'bg-accent text-white scale-100 opacity-100'
                        : isThisTrackActive
                        ? 'bg-white text-black scale-100 opacity-100'
                        : 'material-thin text-white group-hover:scale-100 group-hover:opacity-100 opacity-0 sm:group-hover:opacity-100 active:scale-90'
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
                <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between text-[10px] text-white font-medium">
                  <span className="tabular-nums material-ultrathin px-1.5 py-0.5 rounded-md">
                    {formatTime(track.duration)}
                  </span>
                  {isThisTrackPlaying && (
                    <span className="flex items-center gap-0.5">
                      <span className="w-1 h-3 bg-white rounded-full animate-pulse" />
                      <span className="w-1 h-2 bg-white rounded-full animate-pulse delay-75" />
                      <span className="w-1 h-3.5 bg-white rounded-full animate-pulse delay-150" />
                    </span>
                  )}
                </div>

                {/* Favorite Heart Button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleLike(track);
                  }}
                  aria-label={liked ? `Desfavoritar ${track.title}` : `Favoritar ${track.title}`}
                  className="absolute top-2 right-2 p-1.5 rounded-full material-ultrathin text-white transition-transform active:scale-80"
                >
                  <Heart
                    className={`w-3.5 h-3.5 ${
                      liked ? 'fill-accent text-accent' : 'text-white'
                    }`}
                  />
                </button>
              </div>

              {/* Title & Artist Info */}
              <div className="mt-2 text-left">
                <h3
                  className={`text-[15px] font-medium truncate ${
                    isThisTrackActive ? 'text-accent' : 'text-label'
                  }`}
                >
                  {track.title}
                </h3>
                <p className="text-[13px] text-label-secondary truncate">
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
