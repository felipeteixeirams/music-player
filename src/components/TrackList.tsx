import React, { useState, useEffect } from 'react';
import { Play, Pause, Heart, Music, ArrowDownCircle, CheckCircle2, Loader2, AlertCircle, ListPlus, MinusCircle } from 'lucide-react';
import { Track } from '../types/music';
import { useAudio } from '../context/AudioContext';
import { useAuth } from '../context/AuthContext';
import { prefetchResolved } from '../utils/audioEngine';
import { usePlaylists } from '../context/PlaylistsContext';
import { formatTime } from '../utils/audioEngine';
import { LoadMoreSentinel } from './LoadMoreSentinel';
import {
  downloadTrackForOffline,
  removeOfflineTrack,
  isTrackOfflineAvailable
} from '../utils/offlineManager';

interface TrackListProps {
  tracks: Track[];
  title?: string;
  onTrackSelect: (track: Track) => void;
  /** Inside a playlist: shows a button that takes the track out of it, instead of the one that adds it to a playlist. */
  onRemove?: (track: Track) => void;
  emptyMessage?: string;
  /** Total in the whole list when it is loaded page by page; shown as "N de TOTAL". */
  totalCount?: number;
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
  totalCount,
  hasMore = false,
  isLoadingMore = false,
  error = null,
  onLoadMore,
  onRetry
}) => {
  const { currentTrack, isPlaying, togglePlayPause, toggleLike, isLiked, audioStreamUrl } = useAudio();
  const { openAddToPlaylist } = usePlaylists();
  const { storage } = useAuth();
  const [downloadingTrackId, setDownloadingTrackId] = useState<string | null>(null);
  const [offlineStatusMap, setOfflineStatusMap] = useState<Record<string, boolean>>({});
  const [toast, setToast] = useState<ToastNotice | null>(null);

  useEffect(() => {
    const status: Record<string, boolean> = {};
    tracks.forEach((t) => {
      status[t.id] = isTrackOfflineAvailable(t.id, storage);
    });
    // Keep the previous object when nothing changed, so an identical status does not re-render
    setOfflineStatusMap((prev) => {
      const ids = Object.keys(status);
      const same = ids.length === Object.keys(prev).length && ids.every((id) => prev[id] === status[id]);
      return same ? prev : status;
    });
  }, [tracks, storage]);

  // Ask the shared cache about the tracks shown, so tapping one somebody already played starts with no wait
  useEffect(() => {
    prefetchResolved(tracks.slice(0, 40));
  }, [tracks]);

  // Toast notice timer
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(timer);
  }, [toast]);

  const handleToggleOffline = async (e: React.MouseEvent, track: Track) => {
    e.stopPropagation();
    const isCurrentlyOffline = offlineStatusMap[track.id];

    if (isCurrentlyOffline) {
      await removeOfflineTrack(track.id, storage);
      setOfflineStatusMap((prev) => ({ ...prev, [track.id]: false }));
      setToast({
        id: Date.now().toString(),
        message: `"${track.title}" removida do armazenamento offline.`,
        type: 'success'
      });
    } else {
      setDownloadingTrackId(track.id);
      const streamUrlToCache = currentTrack?.id === track.id && audioStreamUrl ? audioStreamUrl : '';
      const result = await downloadTrackForOffline(track, streamUrlToCache, storage);
      setDownloadingTrackId(null);

      if (result.success) {
        setOfflineStatusMap((prev) => ({ ...prev, [track.id]: true }));
        setToast({
          id: Date.now().toString(),
          message: result.previewOnly
            ? `Prévia de 30s de "${track.title}" salva para ouvir offline.`
            : `"${track.title}" baixada com sucesso para ouvir offline!`,
          type: 'success'
        });
      } else {
        setToast({
          id: Date.now().toString(),
          message: result.error || `Não foi possível baixar "${track.title}".`,
          type: 'error'
        });
      }
    }
  };

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
      {toast && (
        <div
          className={`fixed bottom-[calc(10.5rem+var(--safe-bottom))] left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-2xl border shadow-xl flex items-center gap-2.5 text-xs max-w-sm w-[90%] backdrop-blur-md animate-in fade-in slide-in-from-bottom-3 duration-200 ${
            toast.type === 'success'
              ? 'bg-emerald-950/90 border-emerald-500/40 text-emerald-200'
              : 'bg-rose-950/90 border-rose-500/40 text-rose-200'
          }`}
        >
          {toast.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
          )}
          <span className="truncate flex-1 font-medium">{toast.message}</span>
        </div>
      )}

      {title && (
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-[22px] font-bold text-label tracking-tight">{title}</h2>
          <span className="text-[13px] text-label-tertiary tabular-nums">
            {totalCount !== undefined && totalCount > tracks.length
              ? `${tracks.length} de ${totalCount} faixas`
              : `${tracks.length} ${tracks.length === 1 ? 'faixa' : 'faixas'}`}
          </span>
        </div>
      )}

      <div>
        {tracks.map((track) => {
          const isThisTrackActive = currentTrack?.id === track.id;
          const isThisTrackPlaying = isThisTrackActive && isPlaying;
          const liked = isLiked(track.id);
          const isOffline = offlineStatusMap[track.id];
          const isDownloading = downloadingTrackId === track.id;

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
                  {isThisTrackPlaying && (
                    <div className="absolute inset-0 bg-black/50 backdrop-blur-[1px] flex items-center justify-center">
                      <Pause className="w-5 h-5 text-white fill-current" />
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
                    className={`text-[17px] truncate ${
                      isThisTrackActive ? 'text-accent' : 'text-label'
                    }`}
                  >
                    {track.title}
                  </h3>
                  <p className="text-[15px] text-label-secondary truncate">{track.artist}</p>
                </div>
              </div>

              {/* Right Slot: Duration, Download & Favorite */}
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

                {/* Offline Download Button */}
                <button
                  onClick={(e) => handleToggleOffline(e, track)}
                  disabled={isDownloading}
                  aria-label={isOffline ? 'Disponível offline (Clique para remover)' : 'Baixar para ouvir offline'}
                  title={isOffline ? 'Disponível Offline' : 'Baixar para ouvir offline'}
                  className={`p-1.5 rounded-full transition-transform active:scale-75 ${
                    isOffline
                      ? 'text-emerald-400 hover:text-emerald-300'
                      : 'text-label-secondary hover:text-label'
                  }`}
                >
                  {isDownloading ? (
                    <Loader2 className="w-4 h-4 animate-spin text-accent" />
                  ) : isOffline ? (
                    <CheckCircle2 className="w-4 h-4 fill-emerald-500/20" />
                  ) : (
                    <ArrowDownCircle className="w-4 h-4" />
                  )}
                </button>

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
