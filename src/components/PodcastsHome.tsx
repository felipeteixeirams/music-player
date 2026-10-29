import React, { useEffect, useState } from 'react';
import { AlertCircle, Loader2, Search } from 'lucide-react';
import { fetchPodcastSearch } from '../utils/podcastClient';
import type { PodcastShowSummary } from '../types/music';
import { RemoteImage } from './RemoteImage';

/** Podcasts: a search box for shows, and the shows it finds. A show opens on its own page. */
export const PodcastsHome: React.FC<{ onOpenShow: (show: PodcastShowSummary) => void }> = ({ onOpenShow }) => {
  const [text, setText] = useState('');
  const [query, setQuery] = useState('');
  const [shows, setShows] = useState<PodcastShowSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  // The search runs a moment after the typing stops, or at once on Enter
  useEffect(() => {
    const timer = setTimeout(() => setQuery(text.trim()), 450);
    return () => clearTimeout(timer);
  }, [text]);

  useEffect(() => {
    if (!query) {
      setShows(null);
      setError(null);
      return;
    }
    const controller = new AbortController();
    setError(null);
    setShows(null);
    fetchPodcastSearch(query, controller.signal)
      .then(setShows)
      .catch((err: unknown) => {
        if ((err as Error)?.name === 'AbortError') return;
        setError(err instanceof Error && err.message ? err.message : 'Não foi possível buscar podcasts agora.');
      });
    return () => controller.abort();
  }, [query, attempt]);

  return (
    <div className="px-4 pt-1 space-y-3" data-testid="podcasts-home">
      <form
        role="search"
        onSubmit={(event) => {
          event.preventDefault();
          setQuery(text.trim());
        }}
        className="flex h-[38px] items-center gap-2 rounded-[10px] bg-fill-tertiary px-2.5 text-label-secondary"
      >
        <Search className="h-4 w-4 shrink-0" aria-hidden="true" />
        <input
          value={text}
          onChange={(event) => setText(event.target.value)}
          aria-label="Buscar podcasts"
          placeholder="Nome do programa ou de quem apresenta"
          className="min-w-0 flex-1 bg-transparent text-[16px] text-label outline-none placeholder:text-label-secondary"
          autoComplete="off"
          enterKeyHint="search"
        />
      </form>

      {!query && <p className="px-1 pt-2 text-[15px] text-label-secondary">Busque um programa para ver os episódios, ouvir em ordem e voltar de onde parou.</p>}

      {query && shows === null && !error && (
        <div className="py-10 text-center text-label-secondary space-y-3">
          <Loader2 className="w-7 h-7 text-accent animate-spin mx-auto" />
          <p className="text-xs">Buscando podcasts...</p>
        </div>
      )}

      {error && (
        <div className="py-8 text-center text-xs text-rose-500 space-y-2" role="alert">
          <AlertCircle className="w-6 h-6 mx-auto" />
          <p>{error}</p>
          <button onClick={() => setAttempt((n) => n + 1)} className="px-3.5 py-1.5 rounded-full bg-fill-tertiary text-label font-medium active:scale-95">
            Tentar de novo
          </button>
        </div>
      )}

      {shows && shows.length === 0 && <p className="px-1 pt-2 text-[15px] text-label-secondary">Nenhum podcast encontrado para "{query}".</p>}

      {shows && shows.length > 0 && (
        <ul aria-label="Podcasts encontrados">
          {shows.map((show) => (
            <li key={show.id}>
              <ShowRow show={show} onOpen={onOpenShow} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

/** A show as a row: cover, name and host. */
export const ShowRow: React.FC<{ show: PodcastShowSummary; onOpen: (show: PodcastShowSummary) => void; detail?: string }> = ({ show, onOpen, detail }) => (
  <button onClick={() => onOpen(show)} className="flex w-full items-center gap-3 border-b-[0.5px] border-separator py-2.5 text-left active:opacity-60">
    <RemoteImage src={show.coverUrl} alt="" referrerPolicy="no-referrer" loading="lazy" className="h-14 w-14 shrink-0 rounded-lg bg-fill-tertiary object-cover" />
    <span className="min-w-0 flex-1">
      <span className="block truncate text-[17px] text-label">{show.title}</span>
      <span className="block truncate text-[14px] text-label-secondary">{detail ?? show.author}</span>
    </span>
  </button>
);
