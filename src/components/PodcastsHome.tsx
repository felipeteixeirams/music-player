import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  BookOpen,
  ChevronRight,
  Cpu,
  Heart,
  Loader2,
  Newspaper,
  Pause,
  Play,
  Podcast,
  Search,
  Smile,
  Sparkles,
  TrendingUp,
  Trophy,
  X
} from 'lucide-react';
import { useAudio } from '../context/AudioContext';
import {
  PODCAST_CATEGORIES,
  FEATURED_SHOW_SEEDS,
  type PodcastCategory
} from '../data/podcastCategories';
import type { PodcastEpisodeItem, PodcastShowSummary } from '../types/music';
import {
  fetchFeaturedEpisodes,
  fetchPodcastSearch,
  type FeaturedEpisodeEntry
} from '../utils/podcastClient';
import { formatEpisodeDate, formatEpisodeLength } from '../utils/podcastFormat';
import { episodeToTrack } from '../utils/podcastTrack';
import { RemoteImage } from './RemoteImage';

interface PodcastsHomeProps {
  onOpenShow: (show: PodcastShowSummary) => void;
}

const getCategoryIcon = (id: string) => {
  switch (id) {
    case 'noticias':
      return <Newspaper className="w-8 h-8 text-white/30" aria-hidden="true" />;
    case 'comedia':
      return <Smile className="w-8 h-8 text-white/30" aria-hidden="true" />;
    case 'tecnologia':
      return <Cpu className="w-8 h-8 text-white/30" aria-hidden="true" />;
    case 'crimes':
      return <Search className="w-8 h-8 text-white/30" aria-hidden="true" />;
    case 'cultura':
      return <BookOpen className="w-8 h-8 text-white/30" aria-hidden="true" />;
    case 'negocios':
      return <TrendingUp className="w-8 h-8 text-white/30" aria-hidden="true" />;
    case 'saude':
      return <Heart className="w-8 h-8 text-white/30" aria-hidden="true" />;
    case 'esportes':
      return <Trophy className="w-8 h-8 text-white/30" aria-hidden="true" />;
    case 'ciencia':
      return <Sparkles className="w-8 h-8 text-white/30" aria-hidden="true" />;
    default:
      return <Podcast className="w-8 h-8 text-white/30" aria-hidden="true" />;
  }
};

/**
 * Podcasts Home Screen:
 * - Immediate rich content on arrival
 * - Section 1: "Não perca estes episódios" (direct playable episodes)
 * - Section 2: "Novidades de podcast" (trending/new podcast shows)
 * - Section 3: "Categorias" (thematic cards with on-demand loading)
 * - Top search bar for free-text search
 */
export const PodcastsHome: React.FC<PodcastsHomeProps> = ({ onOpenShow }) => {
  const { playTrack, togglePlayPause, currentTrack, isPlaying } = useAudio();

  // Search input state
  const [text, setText] = useState('');
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<PodcastShowSummary[] | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Category drilldown state
  const [selectedCategory, setSelectedCategory] = useState<PodcastCategory | null>(null);
  const [categoryShows, setCategoryShows] = useState<PodcastShowSummary[] | null>(null);
  const [categoryLoading, setCategoryLoading] = useState(false);
  const [categoryError, setCategoryError] = useState<string | null>(null);
  const [categoryVisibleCount, setCategoryVisibleCount] = useState(10);

  // Section 1: "Não perca estes episódios"
  const [featuredEpisodes, setFeaturedEpisodes] = useState<FeaturedEpisodeEntry[]>([]);
  const [episodesLoading, setEpisodesLoading] = useState(true);
  const [episodesVisibleCount, setEpisodesVisibleCount] = useState(5);

  // Section 2: "Novidades de podcast"
  const [trendingShows, setTrendingShows] = useState<PodcastShowSummary[]>(FEATURED_SHOW_SEEDS);
  const [showsLoading, setShowsLoading] = useState(false);
  const [showsVisibleCount, setShowsVisibleCount] = useState(6);

  // Live search debounce
  useEffect(() => {
    const timer = setTimeout(() => setQuery(text.trim()), 400);
    return () => clearTimeout(timer);
  }, [text]);

  // Execute free-text search
  useEffect(() => {
    if (!query) {
      setSearchResults(null);
      setSearchError(null);
      return;
    }
    const controller = new AbortController();
    setSearchLoading(true);
    setSearchError(null);
    fetchPodcastSearch(query, controller.signal)
      .then((res) => {
        setSearchResults(res);
        setSearchLoading(false);
      })
      .catch((err: unknown) => {
        if ((err as Error)?.name === 'AbortError') return;
        setSearchError('Não foi possível buscar podcasts agora.');
        setSearchLoading(false);
      });

    return () => controller.abort();
  }, [query]);

  // Load Section 1: "Não perca estes episódios"
  useEffect(() => {
    const controller = new AbortController();
    setEpisodesLoading(true);

    const seedIds = FEATURED_SHOW_SEEDS.map((s) => s.id);
    fetchFeaturedEpisodes(seedIds, controller.signal)
      .then((entries) => {
        setFeaturedEpisodes(entries);
        setEpisodesLoading(false);
      })
      .catch((err) => {
        if ((err as Error)?.name === 'AbortError') return;
        setEpisodesLoading(false);
      });

    return () => controller.abort();
  }, []);

  // Load Section 2: "Novidades de podcast" (fetch dynamic live trending shows)
  useEffect(() => {
    const controller = new AbortController();
    setShowsLoading(true);

    fetchPodcastSearch('podcast brasil', controller.signal)
      .then((liveShows) => {
        if (liveShows && liveShows.length > 0) {
          // Merge seed shows with live shows, deduplicating by ID
          const map = new Map<string, PodcastShowSummary>();
          FEATURED_SHOW_SEEDS.forEach((s) => map.set(s.id, s));
          liveShows.forEach((s) => map.set(s.id, s));
          setTrendingShows(Array.from(map.values()));
        }
        setShowsLoading(false);
      })
      .catch((err) => {
        if ((err as Error)?.name === 'AbortError') return;
        setShowsLoading(false);
      });

    return () => controller.abort();
  }, []);

  // Load selected category shows
  useEffect(() => {
    if (!selectedCategory) {
      setCategoryShows(null);
      setCategoryError(null);
      return;
    }
    const controller = new AbortController();
    setCategoryLoading(true);
    setCategoryError(null);
    setCategoryVisibleCount(10);

    fetchPodcastSearch(selectedCategory.query, controller.signal)
      .then((shows) => {
        setCategoryShows(shows);
        setCategoryLoading(false);
      })
      .catch((err) => {
        if ((err as Error)?.name === 'AbortError') return;
        setCategoryError('Não foi possível carregar os podcasts desta categoria.');
        setCategoryLoading(false);
      });

    return () => controller.abort();
  }, [selectedCategory]);

  // Playlist of playable tracks from the featured episodes list
  const episodeTracks = useMemo(
    () => featuredEpisodes.map((entry) => episodeToTrack(entry.show, entry.episode)),
    [featuredEpisodes]
  );

  const handlePlayEpisode = (entry: FeaturedEpisodeEntry, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const track = episodeToTrack(entry.show, entry.episode);
    if (currentTrack?.id === track.id) {
      togglePlayPause();
    } else {
      playTrack(track, episodeTracks);
    }
  };

  return (
    <div className="px-4 pt-1 space-y-4" data-testid="podcasts-home">
      {/* Search Input Bar */}
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          setQuery(text.trim());
        }}
        className="flex h-[38px] items-center gap-2 rounded-[10px] bg-fill-tertiary px-2.5 text-label-secondary transition-colors focus-within:ring-1 focus-within:ring-accent"
      >
        <Search className="h-4 w-4 shrink-0" aria-hidden="true" />
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          aria-label="Buscar podcasts"
          placeholder="Nome do programa ou apresentador"
          className="min-w-0 flex-1 bg-transparent text-[16px] text-label outline-none placeholder:text-label-secondary"
          autoComplete="off"
          enterKeyHint="search"
        />
        {text && (
          <button
            type="button"
            onClick={() => {
              setText('');
              setQuery('');
            }}
            aria-label="Limpar busca"
            className="p-1 text-label-tertiary hover:text-label transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </form>

      {/* VIEW A: Active Free-Text Search Results */}
      {query ? (
        <div className="space-y-3 pt-1">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-[17px] font-semibold text-label">
              Resultados para "{query}"
            </h2>
          </div>

          {searchLoading && (
            <div className="py-12 text-center text-label-secondary space-y-3">
              <Loader2 className="w-7 h-7 text-accent animate-spin mx-auto" />
              <p className="text-xs">Buscando podcasts...</p>
            </div>
          )}

          {searchError && (
            <div className="py-8 text-center text-xs text-rose-500 space-y-2" role="alert">
              <AlertCircle className="w-6 h-6 mx-auto" />
              <p>{searchError}</p>
              <button
                onClick={() => setQuery(query)}
                className="px-3.5 py-1.5 rounded-full bg-fill-tertiary text-label font-medium active:scale-95"
              >
                Tentar de novo
              </button>
            </div>
          )}

          {!searchLoading && searchResults && searchResults.length === 0 && (
            <p className="px-1 py-8 text-center text-[15px] text-label-secondary">
              Nenhum podcast encontrado para "{query}".
            </p>
          )}

          {!searchLoading && searchResults && searchResults.length > 0 && (
            <ul aria-label="Podcasts encontrados" className="divide-y divide-separator/30">
              {searchResults.map((show) => (
                <li key={show.id}>
                  <ShowRow show={show} onOpen={onOpenShow} />
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : selectedCategory ? (
        /* VIEW B: Category Drilldown View */
        <div className="space-y-4 pt-1 animate-in fade-in duration-200">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSelectedCategory(null)}
              className="flex items-center gap-1.5 text-accent text-[15px] font-medium active:opacity-60 transition-opacity"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Todos os podcasts</span>
            </button>
          </div>

          <div
            className="p-4 rounded-2xl relative overflow-hidden"
            style={{
              background: `linear-gradient(135deg, ${selectedCategory.colorFrom}, ${selectedCategory.colorTo})`
            }}
          >
            <div className="absolute right-3 top-3">
              {getCategoryIcon(selectedCategory.id)}
            </div>
            <h2 className="text-[22px] font-bold text-white tracking-tight">
              {selectedCategory.name}
            </h2>
            <p className="text-[13px] text-white/80 mt-1 max-w-[85%]">
              {selectedCategory.description}
            </p>
          </div>

          {categoryLoading && (
            <div className="py-12 text-center text-label-secondary space-y-3">
              <Loader2 className="w-7 h-7 text-accent animate-spin mx-auto" />
              <p className="text-xs">Carregando podcasts de {selectedCategory.name}...</p>
            </div>
          )}

          {categoryError && (
            <div className="py-8 text-center text-xs text-rose-500 space-y-2" role="alert">
              <AlertCircle className="w-6 h-6 mx-auto" />
              <p>{categoryError}</p>
              <button
                onClick={() => setSelectedCategory({ ...selectedCategory })}
                className="px-3.5 py-1.5 rounded-full bg-fill-tertiary text-label font-medium active:scale-95"
              >
                Tentar de novo
              </button>
            </div>
          )}

          {!categoryLoading && categoryShows && categoryShows.length === 0 && (
            <p className="px-1 py-8 text-center text-[15px] text-label-secondary">
              Nenhum podcast disponível nesta categoria no momento.
            </p>
          )}

          {!categoryLoading && categoryShows && categoryShows.length > 0 && (
            <div className="space-y-3">
              <ul className="divide-y divide-separator/30">
                {categoryShows.slice(0, categoryVisibleCount).map((show) => (
                  <li key={show.id}>
                    <ShowRow show={show} onOpen={onOpenShow} />
                  </li>
                ))}
              </ul>

              {categoryVisibleCount < categoryShows.length && (
                <div className="pt-2 pb-4 text-center">
                  <button
                    onClick={() => setCategoryVisibleCount((prev) => prev + 10)}
                    className="px-4 py-2 rounded-full bg-fill-tertiary hover:bg-fill-secondary text-label font-medium text-[14px] active:scale-95 transition-all"
                  >
                    Carregar mais ({categoryShows.length - categoryVisibleCount} restantes)
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        /* VIEW C: Hybrid 3-Section Home Page */
        <div className="space-y-6 pt-1">
          {/* SEÇÃO 1: "Não perca estes episódios" */}
          <section aria-label="Não perca estes episódios" className="space-y-2.5">
            <div className="flex items-center justify-between px-1">
              <div>
                <h2 className="text-[20px] font-bold text-label tracking-tight">
                  Não perca estes episódios
                </h2>
                <p className="text-[13px] text-label-secondary">
                  Episódios em destaque prontos para ouvir
                </p>
              </div>
            </div>

            {episodesLoading && featuredEpisodes.length === 0 ? (
              <div className="py-8 flex flex-col items-center justify-center gap-2 text-label-secondary">
                <Loader2 className="w-6 h-6 animate-spin text-accent" />
                <span className="text-xs">Carregando episódios recomendados...</span>
              </div>
            ) : featuredEpisodes.length > 0 ? (
              <div className="space-y-1.5">
                <div className="divide-y divide-separator/25 rounded-2xl bg-fill-quaternary overflow-hidden">
                  {featuredEpisodes.slice(0, episodesVisibleCount).map((entry) => {
                    const track = episodeToTrack(entry.show, entry.episode);
                    const isCurrent = currentTrack?.id === track.id;
                    const isTrackPlaying = isCurrent && isPlaying;

                    return (
                      <div
                        key={entry.episode.id}
                        onClick={() => handlePlayEpisode(entry)}
                        className={`flex items-center gap-3 p-3 transition-colors text-left cursor-pointer active:bg-fill-secondary ${
                          isCurrent ? 'bg-fill-tertiary' : 'hover:bg-fill-secondary/60'
                        }`}
                      >
                        {/* Play/Pause Button on Thumbnail */}
                        <div className="relative w-14 h-14 shrink-0 rounded-xl overflow-hidden bg-fill-tertiary shadow-sm group">
                          <RemoteImage
                            src={entry.episode.coverUrl || entry.show.coverUrl}
                            alt=""
                            referrerPolicy="no-referrer"
                            loading="lazy"
                            className="w-full h-full object-cover"
                          />
                          <button
                            type="button"
                            onClick={(e) => handlePlayEpisode(entry, e)}
                            aria-label={isTrackPlaying ? 'Pausar episódio' : 'Reproduzir episódio'}
                            className={`absolute inset-0 flex items-center justify-center transition-all ${
                              isTrackPlaying
                                ? 'bg-black/50 text-accent opacity-100'
                                : 'bg-black/35 text-white opacity-0 group-hover:opacity-100 hover:scale-105'
                            }`}
                          >
                            {isTrackPlaying ? (
                              <Pause className="w-6 h-6 fill-current" />
                            ) : (
                              <Play className="w-6 h-6 fill-current translate-x-0.5" />
                            )}
                          </button>
                        </div>

                        {/* Title, Show & Metadata */}
                        <div className="min-w-0 flex-1">
                          <p
                            className={`text-[15px] font-semibold line-clamp-1 leading-snug transition-colors ${
                              isCurrent ? 'text-accent' : 'text-label'
                            }`}
                          >
                            {entry.episode.title}
                          </p>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onOpenShow(entry.show);
                            }}
                            className="text-[13px] text-label-secondary hover:text-label truncate block text-left transition-colors max-w-full"
                          >
                            {entry.show.title}
                          </button>
                          <div className="flex items-center gap-1.5 text-[12px] text-label-tertiary mt-0.5 font-medium">
                            <span>{formatEpisodeDate(entry.episode.publishedAt)}</span>
                            <span aria-hidden="true">·</span>
                            <span>{formatEpisodeLength(entry.episode.durationSeconds)}</span>
                          </div>
                        </div>

                        {/* Arrow to View Podcast Show */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenShow(entry.show);
                          }}
                          aria-label={`Ver programa ${entry.show.title}`}
                          className="p-1.5 text-label-tertiary hover:text-label active:scale-90 transition-all shrink-0"
                        >
                          <ChevronRight className="w-5 h-5" />
                        </button>
                      </div>
                    );
                  })}
                </div>

                {episodesVisibleCount < featuredEpisodes.length && (
                  <button
                    onClick={() => setEpisodesVisibleCount((prev) => prev + 5)}
                    className="w-full py-2.5 text-center text-[14px] font-semibold text-accent hover:opacity-80 active:scale-95 transition-all"
                  >
                    Ver mais episódios ({featuredEpisodes.length - episodesVisibleCount})
                  </button>
                )}
              </div>
            ) : null}
          </section>

          {/* SEÇÃO 2: "Novidades de podcast" */}
          <section aria-label="Novidades de podcast" className="space-y-2.5">
            <div className="flex items-center justify-between px-1">
              <div>
                <h2 className="text-[20px] font-bold text-label tracking-tight">
                  Novidades de podcast
                </h2>
                <p className="text-[13px] text-label-secondary">
                  Programas em alta e lançamentos imperdíveis
                </p>
              </div>
            </div>

            <div className="divide-y divide-separator/30">
              {trendingShows.slice(0, showsVisibleCount).map((show) => (
                <ShowRow key={show.id} show={show} onOpen={onOpenShow} />
              ))}
            </div>

            {showsVisibleCount < trendingShows.length && (
              <button
                onClick={() => setShowsVisibleCount((prev) => prev + 6)}
                className="w-full py-2.5 text-center text-[14px] font-semibold text-accent hover:opacity-80 active:scale-95 transition-all"
              >
                Ver mais programas ({trendingShows.length - showsVisibleCount})
              </button>
            )}
          </section>

          {/* SEÇÃO 3: "Categorias" */}
          <section aria-label="Categorias de podcasts" className="space-y-3 pb-8">
            <div className="px-1">
              <h2 className="text-[20px] font-bold text-label tracking-tight">
                Categorias
              </h2>
              <p className="text-[13px] text-label-secondary">
                Descubra podcasts por gênero e assunto
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {PODCAST_CATEGORIES.map((category) => (
                <button
                  key={category.id}
                  onClick={() => setSelectedCategory(category)}
                  className="relative overflow-hidden rounded-card aspect-[16/10] text-left p-3.5 flex flex-col justify-between active:scale-[0.97] transition-transform shadow-md group"
                  style={{
                    background: `linear-gradient(135deg, ${category.colorFrom}, ${category.colorTo})`
                  }}
                >
                  <div className="self-end opacity-40 group-hover:opacity-60 transition-opacity">
                    {getCategoryIcon(category.id)}
                  </div>
                  <span className="text-[16px] font-bold leading-snug text-white drop-shadow-md">
                    {category.name}
                  </span>
                </button>
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  );
};

/** A show as a row: cover, name, host and tap action. */
export const ShowRow: React.FC<{
  show: PodcastShowSummary;
  onOpen: (show: PodcastShowSummary) => void;
  detail?: string;
}> = ({ show, onOpen, detail }) => (
  <button
    onClick={() => onOpen(show)}
    className="flex w-full items-center gap-3.5 border-b-[0.5px] border-separator/35 py-3 text-left active:opacity-60 transition-opacity group"
  >
    <RemoteImage
      src={show.coverUrl}
      alt=""
      referrerPolicy="no-referrer"
      loading="lazy"
      className="h-14 w-14 shrink-0 rounded-xl bg-fill-tertiary object-cover shadow-sm ring-1 ring-white/5"
    />
    <span className="min-w-0 flex-1">
      <span className="block truncate text-[16px] font-semibold text-label group-hover:text-accent transition-colors">
        {show.title}
      </span>
      <span className="block truncate text-[13px] text-label-secondary font-normal mt-0.5">
        {detail ?? show.author}
      </span>
    </span>
    <ChevronRight className="w-5 h-5 text-label-tertiary group-hover:text-label transition-colors shrink-0" />
  </button>
);
