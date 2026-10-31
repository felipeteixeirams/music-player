import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Heart, ListPlus, Loader2, Play, Search, Shuffle, X } from 'lucide-react';
import { useAudio } from '../context/AudioContext';
import { usePlaylists } from '../context/PlaylistsContext';
import { fetchAlbumPage } from '../utils/catalogClient';
import { formatTime, prefetchResolved } from '../utils/audioEngine';
import type { AlbumPage, AlbumSummary, Track } from '../types/music';
import { RemoteImage } from './RemoteImage';
import { TrackPlaybackIcon } from './PlaybackIcon';

interface AlbumScreenProps {
  album: AlbumSummary;
  onOpenArtist?: (artistName: string) => void;
}

/** Page of an album: centered cover art, Play and Shuffle actions, search filter, and numbered track list. */
export const AlbumScreen: React.FC<AlbumScreenProps> = ({ album, onOpenArtist }) => {
  const { currentTrack, isPlaying, togglePlayPause, playTrack, isLiked, toggleLike, isShuffle, toggleShuffle } = useAudio();
  const { openAddToPlaylist } = usePlaylists();

  const [page, setPage] = useState<AlbumPage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [filterQuery, setFilterQuery] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    setPage(null);
    setError(null);
    setFilterQuery('');
    fetchAlbumPage(album.id, controller.signal)
      .then((data) => {
        setPage(data);
        prefetchResolved(data.tracks.tracks.slice(0, 40));
      })
      .catch((err: unknown) => {
        if ((err as Error)?.name === 'AbortError') return;
        setError(err instanceof Error && err.message ? err.message : 'Não foi possível carregar este álbum agora.');
      });
    return () => controller.abort();
  }, [album.id, attempt]);

  const tracks = page?.tracks.tracks ?? [];

  const filteredTracks = useMemo(() => {
    const q = filterQuery.trim().toLowerCase();
    if (!q) return tracks;
    return tracks.filter(
      (t) => t.title.toLowerCase().includes(q) || t.artist.toLowerCase().includes(q)
    );
  }, [tracks, filterQuery]);

  const totalDurationSeconds = useMemo(
    () => tracks.reduce((acc, t) => acc + (t.duration || 0), 0),
    [tracks]
  );
  const totalMinutes = Math.round(totalDurationSeconds / 60);

  if (error) {
    return (
      <div className="px-4 py-10 text-center text-xs text-rose-500 space-y-2" role="alert">
        <AlertCircle className="w-6 h-6 mx-auto" />
        <p>{error}</p>
        <button
          onClick={() => setAttempt((n) => n + 1)}
          className="px-3.5 py-1.5 rounded-full bg-fill-tertiary text-label font-medium active:scale-95"
        >
          Tentar de novo
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-6" data-testid="album-page">
      {/* 1. Header: Large Centered Artwork and Album Details (Apple Music style) */}
      <header className="flex flex-col items-center text-center px-6 pt-2">
        <div className="relative group">
          <RemoteImage
            src={album.coverUrl}
            alt={`Capa do álbum ${album.title}`}
            referrerPolicy="no-referrer"
            className="h-56 w-56 sm:h-64 sm:w-64 rounded-2xl sm:rounded-3xl object-cover bg-fill-tertiary shadow-2xl shadow-black/60 ring-1 ring-white/10"
          />
        </div>

        <h1 className="mt-4 text-2xl sm:text-3xl font-bold tracking-tight text-label leading-snug max-w-md">
          {album.title}
        </h1>

        {onOpenArtist ? (
          <button
            onClick={() => onOpenArtist(album.artist)}
            className="mt-1 text-[17px] font-semibold text-accent hover:underline active:opacity-60 transition-opacity"
          >
            {album.artist}
          </button>
        ) : (
          <p className="mt-1 text-[17px] font-semibold text-accent">{album.artist}</p>
        )}

        {/* Metadata: Artist, Year, and Duration */}
        <p className="mt-1 text-[13px] text-label-secondary font-medium">
          <span>{[album.artist, album.year > 0 ? String(album.year) : ''].filter(Boolean).join(' · ')}</span>
          {tracks.length > 0 && (
            <span>{` · ${tracks.length} ${tracks.length === 1 ? 'música' : 'músicas'}${totalMinutes > 0 ? `, ${totalMinutes} min` : ''}`}</span>
          )}
        </p>
      </header>

      {!page ? (
        <div className="py-12 text-center text-label-secondary space-y-3">
          <Loader2 className="w-7 h-7 text-accent animate-spin mx-auto" />
          <p className="text-xs">Carregando álbum...</p>
        </div>
      ) : (
        <>
          {/* 2. Play and Shuffle Action Buttons */}
          <div className="grid grid-cols-2 gap-3 px-4">
            <button
              onClick={() => {
                const target = filteredTracks[0] || tracks[0];
                if (target) playTrack(target, tracks);
              }}
              disabled={tracks.length === 0}
              className="flex items-center justify-center gap-2 rounded-xl bg-fill-tertiary hover:bg-fill-secondary py-3 text-[17px] font-semibold text-accent active:scale-[0.98] transition-all disabled:opacity-40"
            >
              <Play className="h-5 w-5 fill-current" aria-hidden="true" />
              <span>Reproduzir</span>
            </button>
            <button
              onClick={() => {
                if (tracks.length === 0) return;
                if (!isShuffle) toggleShuffle();
                const randomTrack = tracks[Math.floor(Math.random() * tracks.length)];
                playTrack(randomTrack, tracks);
              }}
              disabled={tracks.length === 0}
              className="flex items-center justify-center gap-2 rounded-xl bg-fill-tertiary hover:bg-fill-secondary py-3 text-[17px] font-semibold text-accent active:scale-[0.98] transition-all disabled:opacity-40"
            >
              <Shuffle className="h-5 w-5" aria-hidden="true" />
              <span>Aleatório</span>
            </button>
          </div>

          {/* 3. In-Album Track Search / Filter */}
          {tracks.length > 3 && (
            <div className="px-4">
              <div className="relative flex items-center">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-label-secondary pointer-events-none" />
                <input
                  type="text"
                  inputMode="search"
                  value={filterQuery}
                  onChange={(e) => setFilterQuery(e.target.value)}
                  placeholder="Filtrar faixas do álbum..."
                  aria-label="Filtrar faixas do álbum"
                  className="w-full h-10 pl-10 pr-9 rounded-xl bg-fill-tertiary text-label placeholder:text-label-secondary text-[15px] focus:outline-none focus:ring-1 focus:ring-accent/50 transition-all"
                />
                {filterQuery && (
                  <button
                    onClick={() => setFilterQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-label-secondary hover:text-label active:scale-90"
                    aria-label="Limpar filtro de faixas"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
              {filterQuery.trim() && (
                <p className="mt-1.5 px-1 text-xs text-label-secondary">
                  {filteredTracks.length === 1 ? '1 faixa encontrada' : `${filteredTracks.length} faixas encontradas`}
                </p>
              )}
            </div>
          )}

          {/* 4. Numbered Track List (Apple Music style) */}
          <section aria-label={`Faixas de ${album.title}`} className="px-4">
            {filteredTracks.length === 0 ? (
              <div className="py-10 text-center text-label-secondary text-xs space-y-2">
                <p>Nenhuma faixa encontrada para "{filterQuery}".</p>
                <button
                  onClick={() => setFilterQuery('')}
                  className="px-3.5 py-1.5 rounded-full bg-fill-tertiary text-accent font-medium active:scale-95"
                >
                  Limpar filtro
                </button>
              </div>
            ) : (
              <div className="divide-y divide-separator/40">
                {filteredTracks.map((track) => {
                  const isThisTrackActive = currentTrack?.id === track.id;
                  const isThisTrackPlaying = isThisTrackActive && isPlaying;
                  const originalIndex = tracks.findIndex((t) => t.id === track.id);
                  const trackNumber = originalIndex >= 0 ? originalIndex + 1 : 1;
                  const liked = isLiked(track.id);

                  return (
                    <div
                      key={track.id}
                      onClick={() => {
                        if (isThisTrackActive) {
                          togglePlayPause();
                        } else {
                          playTrack(track, tracks);
                        }
                      }}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          if (isThisTrackActive) togglePlayPause();
                          else playTrack(track, tracks);
                        }
                      }}
                      className="group flex items-center justify-between py-3 px-2 rounded-xl cursor-pointer hover:bg-fill-tertiary/40 active:bg-fill-tertiary transition-colors"
                    >
                      {/* Left: Track Number / Active Playing Icon + Title */}
                      <div className="flex items-center gap-3 min-w-0 pr-3">
                        <div className="w-7 text-center shrink-0 flex items-center justify-center">
                          {isThisTrackPlaying ? (
                            <TrackPlaybackIcon trackId={track.id} className="w-4 h-4 text-accent" />
                          ) : (
                            <span
                              className={`text-[15px] font-medium tabular-nums ${
                                isThisTrackActive ? 'text-accent font-bold' : 'text-label-secondary'
                              }`}
                            >
                              {trackNumber}
                            </span>
                          )}
                        </div>

                        <div className="min-w-0 text-left">
                          <h3
                            className={`text-[17px] leading-tight truncate ${
                              isThisTrackActive ? 'text-accent font-semibold' : 'text-label'
                            }`}
                          >
                            {track.title}
                          </h3>
                          {track.artist && track.artist !== album.artist && (
                            <p className="text-[13px] text-label-secondary truncate mt-0.5">{track.artist}</p>
                          )}
                        </div>
                      </div>

                      {/* Right: Duration, Playlist and Like Actions */}
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[14px] text-label-secondary tabular-nums">
                          {formatTime(track.duration)}
                        </span>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openAddToPlaylist(track);
                          }}
                          aria-label={`Adicionar ${track.title} a uma playlist`}
                          className="p-1.5 rounded-full text-label-secondary hover:text-label active:scale-90 transition-transform"
                        >
                          <ListPlus className="w-4 h-4" />
                        </button>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleLike(track);
                          }}
                          aria-label={liked ? `Descurtir ${track.title}` : `Curtir ${track.title}`}
                          className={`p-1.5 rounded-full transition-all active:scale-90 ${
                            liked ? 'text-accent' : 'text-label-secondary hover:text-label'
                          }`}
                        >
                          <Heart className={`w-4 h-4 ${liked ? 'fill-current' : ''}`} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
};

