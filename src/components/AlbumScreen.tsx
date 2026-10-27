import React, { useEffect, useState } from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';
import { PlayShuffleButtons } from './PlayShuffleButtons';
import { TrackList } from './TrackList';
import { useAudio } from '../context/AudioContext';
import { fetchAlbumPage } from '../utils/catalogClient';
import type { AlbumPage, AlbumSummary } from '../types/music';

/** Page of an album: cover, play and shuffle, and the tracks in album order. */
export const AlbumScreen: React.FC<{ album: AlbumSummary }> = ({ album }) => {
  const { playTrack } = useAudio();
  const [page, setPage] = useState<AlbumPage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setPage(null);
    setError(null);
    fetchAlbumPage(album.id, controller.signal)
      .then(setPage)
      .catch((err: unknown) => {
        if ((err as Error)?.name === 'AbortError') return;
        setError(err instanceof Error && err.message ? err.message : 'Não foi possível carregar este álbum agora.');
      });
    return () => controller.abort();
  }, [album.id, attempt]);

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

  const tracks = page?.tracks.tracks ?? [];
  return (
    <div className="space-y-4" data-testid="album-page">
      <div className="flex flex-col items-center gap-2 px-4 pt-1">
        <img src={album.coverUrl} alt="" referrerPolicy="no-referrer" className="h-48 w-48 rounded-cover object-cover bg-fill-tertiary shadow-xl" />
        <p className="text-[13px] text-label-secondary">{[album.artist, album.year > 0 ? String(album.year) : ''].filter(Boolean).join(' · ')}</p>
      </div>
      {!page ? (
        <div className="py-8 text-center text-label-secondary">
          <Loader2 className="w-7 h-7 text-accent animate-spin mx-auto" />
        </div>
      ) : (
        <>
          <PlayShuffleButtons tracks={tracks} />
          <TrackList tracks={tracks} emptyMessage="Este álbum está vazio no momento." onTrackSelect={(track) => playTrack(track, tracks)} />
        </>
      )}
    </div>
  );
};
