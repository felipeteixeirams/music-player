import React, { useEffect, useState } from 'react';
import { AlertCircle, Loader2, Play, Shuffle } from 'lucide-react';
import { TrackList } from './TrackList';
import { useAudio } from '../context/AudioContext';
import { fetchArtistPage } from '../utils/catalogClient';
import type { ArtistPage, Track } from '../types/music';

const formatFans = (fans: number) => (fans > 0 ? `${new Intl.NumberFormat('pt-BR').format(fans)} ouvintes` : '');

/** Page of an artist of the online catalog: photo, play and shuffle, and the most played tracks. */
export const ArtistScreen: React.FC<{ artistId: string }> = ({ artistId }) => {
  const { playTrack, isShuffle, toggleShuffle } = useAudio();
  const [page, setPage] = useState<ArtistPage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setPage(null);
    setError(null);
    fetchArtistPage(artistId, 0, controller.signal)
      .then(setPage)
      .catch((err: unknown) => {
        if ((err as Error)?.name === 'AbortError') return;
        setError(err instanceof Error && err.message ? err.message : 'Não foi possível carregar este artista agora.');
      });
    return () => controller.abort();
  }, [artistId, attempt]);

  if (error) {
    return (
      <div className="px-4 py-10 text-center text-xs text-rose-500 space-y-2" role="alert">
        <AlertCircle className="w-6 h-6 mx-auto" />
        <p>{error}</p>
        <button onClick={() => setAttempt((n) => n + 1)} className="px-3.5 py-1.5 rounded-full bg-fill-tertiary text-label font-medium active:scale-95">
          Tentar de novo
        </button>
      </div>
    );
  }
  if (!page) {
    return (
      <div className="py-12 text-center text-label-secondary space-y-3">
        <Loader2 className="w-7 h-7 text-accent animate-spin mx-auto" />
        <p className="text-xs">Carregando artista...</p>
      </div>
    );
  }

  const tracks: Track[] = page.top.tracks;
  const playAll = () => tracks[0] && playTrack(tracks[0], tracks);
  const playShuffled = () => {
    if (tracks.length === 0) return;
    if (!isShuffle) toggleShuffle();
    playTrack(tracks[Math.floor(Math.random() * tracks.length)], tracks);
  };

  return (
    <div className="space-y-4" data-testid="artist-page">
      <div className="flex flex-col items-center gap-2 px-4 pt-1">
        <img src={page.artist.pictureUrl} alt="" referrerPolicy="no-referrer" className="h-32 w-32 rounded-full object-cover bg-fill-tertiary" />
        {formatFans(page.artist.fans) && <p className="text-[13px] text-label-secondary">{formatFans(page.artist.fans)}</p>}
      </div>
      <div className="grid grid-cols-2 gap-3 px-4">
        <button onClick={playAll} className="flex items-center justify-center gap-2 rounded-card bg-fill-tertiary py-2.5 text-[17px] font-semibold text-accent active:scale-[0.97] transition-transform">
          <Play className="h-4 w-4 fill-current" aria-hidden="true" />
          <span>Reproduzir</span>
        </button>
        <button onClick={playShuffled} className="flex items-center justify-center gap-2 rounded-card bg-fill-tertiary py-2.5 text-[17px] font-semibold text-accent active:scale-[0.97] transition-transform">
          <Shuffle className="h-4 w-4" aria-hidden="true" />
          <span>Aleatório</span>
        </button>
      </div>
      <TrackList
        tracks={tracks}
        title="Músicas mais tocadas"
        emptyMessage="Nenhuma música deste artista por aqui."
        onTrackSelect={(track) => playTrack(track, tracks)}
      />
    </div>
  );
};
