import React, { useEffect, useState } from 'react';
import { AlertCircle, Loader2, Radio } from 'lucide-react';
import { PlayShuffleButtons } from './PlayShuffleButtons';
import { TrackList } from './TrackList';
import { useAudio } from '../context/AudioContext';
import { fetchArtistPage } from '../utils/catalogClient';
import type { AlbumSummary, ArtistSummary, ArtistPage, Track } from '../types/music';
import { RemoteImage } from './RemoteImage';

const formatFans = (fans: number) => (fans > 0 ? `${new Intl.NumberFormat('pt-BR').format(fans)} ouvintes` : '');

/** Page of an artist of the online catalog: photo, play and shuffle, and the most played tracks. */
export const ArtistScreen: React.FC<{ artistId: string; onOpenAlbum: (album: AlbumSummary) => void; onOpenArtist: (artist: ArtistSummary) => void }> = ({ artistId, onOpenAlbum, onOpenArtist }) => {
  const { playTrack, startRadio } = useAudio();
  const [page, setPage] = useState<ArtistPage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [startingRadio, setStartingRadio] = useState(false);
  const [radioError, setRadioError] = useState<string | null>(null);

  /** The radio of this artist (INV-RAD-01): it starts from the tap, as a station does. */
  const startArtistRadio = async () => {
    if (!page || startingRadio) return;
    setStartingRadio(true);
    setRadioError(null);
    const started = await startRadio({ id: Number(artistId), name: page.artist.name, picture: page.artist.pictureUrl || null, source: 'artist' });
    setStartingRadio(false);
    if (!started) setRadioError(`Não foi possível iniciar a rádio de ${page.artist.name} agora. Tente de novo.`);
  };

  useEffect(() => {
    const controller = new AbortController();
    setPage(null);
    setError(null);
    window.scrollTo(0, 0);
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
  const albums = page.albums ?? [];
  const related = page.related ?? [];

  return (
    <div className="space-y-4" data-testid="artist-page">
      <div className="flex flex-col items-center gap-2 px-4 pt-1">
        <RemoteImage src={page.artist.pictureUrl} alt="" referrerPolicy="no-referrer" className="h-32 w-32 rounded-full object-cover bg-fill-tertiary" />
        {formatFans(page.artist.fans) && <p className="text-[13px] text-label-secondary">{formatFans(page.artist.fans)}</p>}
      </div>
      <PlayShuffleButtons tracks={tracks} />
      <div className="px-4">
        <button
          onClick={() => void startArtistRadio()}
          disabled={startingRadio}
          aria-label={`Iniciar rádio de ${page.artist.name}`}
          className="flex w-full items-center justify-center gap-2 rounded-card bg-fill-tertiary py-2.5 text-[17px] font-semibold text-accent active:scale-[0.97] transition-transform disabled:opacity-40"
        >
          {startingRadio ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Radio className="h-4 w-4" aria-hidden="true" />}
          <span>Iniciar rádio</span>
        </button>
        {radioError && <p role="alert" className="pt-2 text-center text-[13px] text-rose-500">{radioError}</p>}
      </div>
      <TrackList
        tracks={tracks}
        title="Músicas mais tocadas"
        emptyMessage="Nenhuma música deste artista por aqui."
        onTrackSelect={(track) => playTrack(track, tracks)}
      />
      {albums.length > 0 && (
        <section aria-label="Álbuns" className="px-4">
          <h2 className="text-[22px] font-bold text-label tracking-tight mb-2">Álbuns</h2>
          <div className="flex gap-3 overflow-x-auto pb-1">
            {albums.map((album) => (
              <button key={album.id} onClick={() => onOpenAlbum(album)} className="w-36 shrink-0 text-left active:opacity-60">
                <RemoteImage src={album.coverUrl} alt="" referrerPolicy="no-referrer" loading="lazy" className="h-36 w-36 rounded-cover object-cover bg-fill-tertiary" />
                <p className="mt-1.5 truncate text-[15px] text-label">{album.title}</p>
                {album.year > 0 && <p className="text-[13px] text-label-secondary">{album.year}</p>}
              </button>
            ))}
          </div>
        </section>
      )}
      {related.length > 0 && (
        <section aria-label="Artistas semelhantes" className="px-4">
          <h2 className="text-[22px] font-bold text-label tracking-tight mb-2">Artistas semelhantes</h2>
          <div className="flex gap-4 overflow-x-auto pb-1">
            {related.map((artist) => (
              <button key={artist.id} onClick={() => onOpenArtist(artist)} className="flex w-24 shrink-0 flex-col items-center gap-1.5 active:opacity-60">
                <RemoteImage src={artist.pictureUrl} alt="" referrerPolicy="no-referrer" loading="lazy" className="h-24 w-24 rounded-full object-cover bg-fill-tertiary" />
                <span className="w-full truncate text-center text-[13px] text-label">{artist.name}</span>
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};
