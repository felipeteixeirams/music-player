import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Check, Loader2, Pause, Play } from 'lucide-react';
import { useAudio } from '../context/AudioContext';
import { useAuth } from '../context/AuthContext';
import { usePodcastProgress } from '../hooks/usePodcastProgress';
import { fetchPodcastShow } from '../utils/podcastClient';
import { formatEpisodeDate, formatEpisodeLength, formatTimeLeft } from '../utils/podcastFormat';
import { progressShare, type ProgressMap } from '../utils/podcastProgress';
import { episodeToTrack } from '../utils/podcastTrack';
import type { PodcastEpisodeItem, PodcastShowSummary } from '../types/music';
import { RemoteImage } from './RemoteImage';

type Order = 'new' | 'old';
const orderKey = (showId: string) => `aurastream_podcast_order_${showId}`;

/** The episode to start from: the one in progress, else the first not listened to in the chosen order, else the first. */
export function pickContinueEpisode(episodes: PodcastEpisodeItem[], progress: ProgressMap): PodcastEpisodeItem | undefined {
  const inProgress = episodes.find((episode) => {
    const share = progressShare(progress[episode.id], episode.durationSeconds);
    return share > 0 && share < 1;
  });
  return inProgress ?? episodes.find((episode) => !progress[episode.id]?.done) ?? episodes[0];
}

/** A podcast show: cover, name, the order of the episodes and the episodes, with what was listened to. */
export const PodcastScreen: React.FC<{ show: PodcastShowSummary }> = ({ show }) => {
  const { storage } = useAuth();
  const { playTrack, togglePlayPause, currentTrack, isPlaying } = useAudio();
  const progress = usePodcastProgress(storage);
  const [data, setData] = useState<{ show: PodcastShowSummary; episodes: PodcastEpisodeItem[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  // Remembered for each show: series are often heard from the oldest to the newest
  const [order, setOrder] = useState<Order>(() => (storage.getItem(orderKey(show.id)) === 'old' ? 'old' : 'new'));

  useEffect(() => {
    const controller = new AbortController();
    setData(null);
    setError(null);
    window.scrollTo(0, 0);
    fetchPodcastShow(show.id, controller.signal)
      .then(setData)
      .catch((err: unknown) => {
        if ((err as Error)?.name === 'AbortError') return;
        setError(err instanceof Error && err.message ? err.message : 'Não foi possível carregar este podcast agora.');
      });
    return () => controller.abort();
  }, [show.id, attempt]);

  const info = data?.show ?? show;
  const episodes = useMemo(() => (data ? (order === 'new' ? data.episodes : [...data.episodes].reverse()) : []), [data, order]);
  // The queue the player follows: the episodes in the order on screen
  const tracks = useMemo(() => episodes.map((episode) => episodeToTrack(info, episode)), [episodes, info]);
  const continueEpisode = pickContinueEpisode(episodes, progress);

  const choose = (value: Order) => {
    setOrder(value);
    try {
      storage.setItem(orderKey(show.id), value);
    } catch {
      // storage that refuses: the order lasts for this visit
    }
  };

  const playEpisode = (index: number) => {
    const track = tracks[index];
    if (!track) return;
    if (currentTrack?.id === track.id) togglePlayPause();
    else playTrack(track, tracks);
  };

  const continueShare = continueEpisode ? progressShare(progress[continueEpisode.id], continueEpisode.durationSeconds) : 0;

  return (
    <div className="space-y-4 px-4 pt-1" data-testid="podcast-page">
      <div className="flex flex-col items-center gap-1 text-center">
        <RemoteImage src={info.coverUrl} alt="" referrerPolicy="no-referrer" className="aspect-square w-full max-w-[240px] rounded-[14px] bg-fill-tertiary object-cover shadow-xl shadow-black/30" />
        <h2 className="mt-3 text-[22px] font-bold tracking-tight text-label">{info.title}</h2>
        {info.author && <p className="text-[16px] text-accent">{info.author}</p>}
        {info.description && <p className="mt-1 line-clamp-3 text-[13px] leading-snug text-label-secondary">{info.description}</p>}
      </div>

      {error && (
        <div className="py-8 text-center text-xs text-rose-500 space-y-2" role="alert">
          <AlertCircle className="w-6 h-6 mx-auto" />
          <p>{error}</p>
          <button onClick={() => setAttempt((n) => n + 1)} className="px-3.5 py-1.5 rounded-full bg-fill-tertiary text-label font-medium active:scale-95">
            Tentar de novo
          </button>
        </div>
      )}

      {!data && !error && (
        <div className="py-10 text-center text-label-secondary space-y-3">
          <Loader2 className="w-7 h-7 text-accent animate-spin mx-auto" />
          <p className="text-xs">Carregando episódios...</p>
        </div>
      )}

      {data && data.episodes.length === 0 && <p className="text-center text-[15px] text-label-secondary">Este podcast não tem episódios para ouvir aqui.</p>}

      {data && continueEpisode && (
        <button
          onClick={() => playEpisode(episodes.indexOf(continueEpisode))}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 text-[16px] font-bold text-white active:scale-[0.98] transition-transform"
        >
          <Play className="h-5 w-5 shrink-0 fill-current" aria-hidden="true" />
          <span className="min-w-0 truncate">{continueShare > 0 ? 'Continuar' : 'Ouvir'}: {continueEpisode.title}</span>
        </button>
      )}

      {data && data.episodes.length > 0 && (
        <>
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-[20px] font-bold tracking-tight text-label">Episódios</h3>
            <div role="group" aria-label="Ordem dos episódios" className="flex rounded-[9px] bg-fill-tertiary p-0.5 text-[13px]">
              {(['new', 'old'] as const).map((value) => (
                <button
                  key={value}
                  aria-pressed={order === value}
                  onClick={() => choose(value)}
                  className={`rounded-[7px] px-3 py-1 transition-colors ${order === value ? 'bg-segment font-semibold text-label shadow-sm' : 'text-label-secondary'}`}
                >
                  {value === 'new' ? 'Mais recentes' : 'Mais antigos'}
                </button>
              ))}
            </div>
          </div>

          <ul aria-label="Episódios">
            {episodes.map((episode, index) => {
              const entry = progress[episode.id];
              const share = progressShare(entry, episode.durationSeconds);
              const current = currentTrack?.id === episode.id;
              return (
                <li key={episode.id}>
                  <button
                    onClick={() => playEpisode(index)}
                    aria-label={`${current && isPlaying ? 'Pausar' : 'Tocar'} ${episode.title}`}
                    className="grid w-full grid-cols-[1fr_auto] items-center gap-x-3 gap-y-0.5 border-b-[0.5px] border-separator py-3.5 text-left"
                  >
                    <span className="text-[12px] text-label-secondary">{formatEpisodeDate(episode.publishedAt)}</span>
                    <span className="row-span-3 flex h-10 w-10 items-center justify-center rounded-full bg-fill-tertiary text-label">
                      {current && isPlaying ? <Pause className="h-4 w-4 fill-current" /> : <Play className="h-4 w-4 fill-current" />}
                    </span>
                    <span className={`text-[16px] font-semibold leading-tight ${current ? 'text-accent' : 'text-label'}`}>{episode.title}</span>
                    <span className="flex items-center gap-2 text-[12.5px] text-label-secondary">
                      {share >= 1 ? (
                        <span className="flex items-center gap-1 font-semibold text-accent">
                          <Check className="h-3.5 w-3.5" aria-hidden="true" />
                          Ouvido
                        </span>
                      ) : share > 0 ? (
                        <>
                          <span className="h-[3px] w-[70px] overflow-hidden rounded-full bg-fill-secondary" role="progressbar" aria-label="Progresso do episódio" aria-valuenow={Math.round(share * 100)} aria-valuemin={0} aria-valuemax={100}>
                            <span className="block h-full bg-accent" style={{ width: `${Math.round(share * 100)}%` }} />
                          </span>
                          <span>{formatTimeLeft(entry?.duration || episode.durationSeconds, share)}</span>
                        </>
                      ) : (
                        <span>{formatEpisodeLength(episode.durationSeconds)}</span>
                      )}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
};
