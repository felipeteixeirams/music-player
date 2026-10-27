import React, { useEffect } from 'react';
import { Heart, Music, ListPlus, MinusCircle } from 'lucide-react';
import { TrackPlaybackIcon } from './PlaybackIcon';
import { Track } from '../types/music';
import { useAudio } from '../context/AudioContext';
import { prefetchResolved } from '../utils/audioEngine';
import { usePlaylists } from '../context/PlaylistsContext';
import { formatTime } from '../utils/audioEngine';
import { LoadMoreSentinel } from './LoadMoreSentinel';

interface TrackListProps {
  tracks: Track[];
  title?: string;
  onTrackSelect: (track: Track) => void;
  /** Inside a playlist: shows a button that takes the track out of it, instead of the one that adds it to a playlist. */
  onRemove?: (track: Track) => void;
  emptyMessage?: string;
  /** Total in the whole list when it is loaded page by page; shown as "N de TOTAL". */
  /** Pagination: pass `onLoadMore` to load the next page as the end of the list nears the screen. */
  hasMore?: boolean;
  isLoadingMore?: boolean;
  error?: string | null;
  onLoadMore?: () => void;
  onRetry?: () => void;
}

interface ToastNotice {
  id: string;
  message: string;
  type: 'success' | 'error';
}

export const TrackList: React.FC<TrackListProps> = ({
  tracks,
  title,
  onTrackSelect,
  onRemove,
  emptyMessage = 'Nenhuma faixa encontrada nesta seção.',
  hasMore = false,
  isLoadingMore = false,
  error = null,
  onLoadMore,
  onRetry
}) => {
  const { currentTrack, isPlaying, togglePlayPause, toggleLike, isLiked } = useAudio();
  const { openAddToPlaylist } = usePlaylists();

  // Ask the shared cache about the tracks shown, so tapping one somebody already played starts with no wait
  useEffect(() => {
    prefetchResolved(tracks.slice(0, 40));
  }, [tracks]);

  if (tracks.length === 0) {
    return (
      <div className="px-4 py-8 text-center text-label-secondary text-xs">
        <div className="w-12 h-12 rounded-card bg-fill-tertiary flex items-center justify-center mx-auto mb-2.5 text-label-tertiary">
          <Music className="w-6 h-6" />
        </div>
        <p>{emptyMessage}</p>
      </div>
    );
  }

  return (
    <section className="px-4 py-3 relative" aria-label={title || 'Lista de faixas'}>
      {/* Toast Notification Banner */}
      {title && (
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-[22px] font-bold text-label tracking-tight">{title}</h2>
        </div>
      )}

      <div>
        {tracks.map((track) => {
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
              className={`relative flex items-center justify-between py-2 [content-visibility:auto] [contain-intrinsic-size:auto_72px] transition-colors cursor-pointer active:bg-fill-tertiary after:absolute after:bottom-[0.5px] after:left-[4.5rem] after:right-0 after:h-[0.5px] after:bg-separator`}
            >
              {/* Left Slot: Artwork & Details */}
              <div className="flex items-center gap-3 min-w-0">
                <div className="relative w-14 h-14 rounded-cover overflow-hidden shrink-0 bg-elevated-2 flex items-center justify-center">
                  <Music className="w-5 h-5 text-label-tertiary" />
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
                  {isThisTrackActive && (
                    <div className={`absolute inset-0 flex items-center justify-center ${isThisTrackPlaying ? 'bg-black/50 backdrop-blur-[1px]' : 'bg-black/40'}`}>
                      <TrackPlaybackIcon trackId={track.id} className="w-5 h-5 text-white" />
                    </div>
                  )}
                </div>

                {/* Track Details */}
                <div className="min-w-0 text-left">
                  <h3
                    className={`text-[17px] truncate ${
                      isThisTrackActive ? 'text-accent' : 'text-label'
                    }`}
                  >
                    {track.title}
                  </h3>
                  <p className="text-[15px] text-label-secondary truncate">{track.artist}</p>
                </div>
              </div>

              {/* Right Slot: Duration, playlist and favorite */}
              <div className="flex items-center gap-1.5 shrink-0 ml-3">
                <span className="text-[13px] text-label-secondary tabular-nums mr-1">
                  {formatTime(track.duration)}
                </span>

                {onRemove ? (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemove(track);
                    }}
                    aria-label={`Remover ${track.title} da playlist`}
                    className="p-1.5 rounded-full text-label-secondary hover:text-label transition-transform active:scale-75"
                  >
                    <MinusCircle className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      openAddToPlaylist(track);
                    }}
                    aria-label={`Adicionar ${track.title} a uma playlist`}
                    className="p-1.5 rounded-full text-label-secondary hover:text-label transition-transform active:scale-75"
                  >
                    <ListPlus className="w-4 h-4" />
                  </button>
                )}

                {/* Like / Favorite Button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleLike(track);
                  }}
                  aria-label={liked ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
                  className="p-1.5 rounded-full text-label-secondary hover:text-label transition-transform active:scale-75"
                >
                  <Heart
                    className={`w-4 h-4 ${
                      liked ? 'fill-accent text-accent' : 'text-label-secondary hover:text-label'
                    }`}
                  />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {onLoadMore && (
        <LoadMoreSentinel
          loadedCount={tracks.length}
          hasMore={hasMore}
          isLoadingMore={isLoadingMore}
          error={error}
          onLoadMore={onLoadMore}
          onRetry={onRetry ?? onLoadMore}
        />
      )}
    </section>
  );
};
