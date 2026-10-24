import React, { useState, useEffect } from 'react';
import { Play, Pause, Heart, Music, ArrowDownCircle, CheckCircle2, Loader2, AlertCircle } from 'lucide-react';
import { Track } from '../types/music';
import { useAudio } from '../context/AudioContext';
import { formatTime } from '../utils/audioEngine';
import {
  downloadTrackForOffline,
  removeOfflineTrack,
  isTrackOfflineAvailable
} from '../utils/offlineManager';

interface TrackListProps {
  tracks: Track[];
  title?: string;
  onTrackSelect: (track: Track) => void;
  emptyMessage?: string;
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
  emptyMessage = 'Nenhuma faixa encontrada nesta seção.'
}) => {
  const { currentTrack, isPlaying, togglePlayPause, toggleLike, isLiked, audioStreamUrl } = useAudio();
  const [downloadingTrackId, setDownloadingTrackId] = useState<string | null>(null);
  const [offlineStatusMap, setOfflineStatusMap] = useState<Record<string, boolean>>({});
  const [toast, setToast] = useState<ToastNotice | null>(null);

  useEffect(() => {
    const status: Record<string, boolean> = {};
    tracks.forEach((t) => {
      status[t.id] = isTrackOfflineAvailable(t.id);
    });
    setOfflineStatusMap(status);
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
      await removeOfflineTrack(track.id);
      setOfflineStatusMap((prev) => ({ ...prev, [track.id]: false }));
      setToast({
        id: Date.now().toString(),
        message: `"${track.title}" removida do armazenamento offline.`,
        type: 'success'
      });
    } else {
      setDownloadingTrackId(track.id);
      const streamUrlToCache = currentTrack?.id === track.id && audioStreamUrl ? audioStreamUrl : '';
      const result = await downloadTrackForOffline(track, streamUrlToCache);
      setDownloadingTrackId(null);

      if (result.success) {
        setOfflineStatusMap((prev) => ({ ...prev, [track.id]: true }));
        setToast({
          id: Date.now().toString(),
          message: `"${track.title}" baixada com sucesso para ouvir offline!`,
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
      <div className="px-4 py-8 text-center text-white/50 text-xs">
        <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-2.5 text-white/40">
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
          className={`fixed bottom-20 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-2xl border shadow-xl flex items-center gap-2.5 text-xs max-w-sm w-[90%] backdrop-blur-md animate-in fade-in slide-in-from-bottom-3 duration-200 ${
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
          <h2 className="text-sm font-bold text-white tracking-tight">{title}</h2>
          <span className="text-[11px] text-white/40 tabular-nums">
            {tracks.length} {tracks.length === 1 ? 'faixa' : 'faixas'}
          </span>
        </div>
      )}

      <div className="space-y-1.5">
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
              className={`flex items-center justify-between p-2.5 rounded-2xl transition-all cursor-pointer border active:scale-[0.98] ${
                isThisTrackActive
                  ? 'bg-purple-900/25 border-purple-500/30 text-white'
                  : 'bg-white/[0.02] hover:bg-white/[0.05] border-transparent hover:border-white/5 text-white/90'
              }`}
            >
              {/* Left Slot: Artwork & Details */}
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
                    <span className="truncate text-white/40">
                      {track.album && !track.album.includes('Piped') ? track.album : (track.style || 'Single')}
                    </span>
                  </div>
                </div>
              </div>

              {/* Right Slot: Duration, Download & Favorite */}
              <div className="flex items-center gap-1.5 shrink-0 ml-3">
                <span className="text-[11px] text-white/40 tabular-nums font-mono mr-1">
                  {formatTime(track.duration)}
                </span>

                {/* Offline Download Button */}
                <button
                  onClick={(e) => handleToggleOffline(e, track)}
                  disabled={isDownloading}
                  aria-label={isOffline ? 'Disponível offline (Clique para remover)' : 'Baixar para ouvir offline'}
                  title={isOffline ? 'Disponível Offline' : 'Baixar para ouvir offline'}
                  className={`p-1.5 rounded-full transition-transform active:scale-75 ${
                    isOffline
                      ? 'text-emerald-400 hover:text-emerald-300'
                      : 'text-white/40 hover:text-white'
                  }`}
                >
                  {isDownloading ? (
                    <Loader2 className="w-4 h-4 animate-spin text-purple-400" />
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
                    toggleLike(track.id);
                  }}
                  aria-label={liked ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
                  className="p-1.5 rounded-full hover:bg-white/10 text-white/60 hover:text-white transition-transform active:scale-75"
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
