/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { AudioProvider, useAudio } from './context/AudioContext';
import { TopBar } from './components/TopBar';
import { CategoryGrid } from './components/CategoryGrid';
import { TrackCarousel } from './components/TrackCarousel';
import { TrackList } from './components/TrackList';
import { MiniPlayer } from './components/MiniPlayer';
import { ExpandedPlayer } from './components/ExpandedPlayer';
import { HeadlessPlayerFallback } from './components/HeadlessPlayerFallback';
import { OfflineIndicator } from './components/OfflineIndicator';
import { CacheSettingsModal } from './components/CacheSettingsModal';
import { BottomNavBar, type AppTab } from './components/BottomNavBar';
import { RadioView } from './components/RadioView';
import { UpdateBanner } from './components/UpdateBanner';
import { preloadYouTubePlayer } from './components/youtubePlayer';
import { CATEGORIES, getCategoryById } from './data/musicCatalog';
import { Play, Sparkles, Globe, Loader2, AlertCircle } from 'lucide-react';
import { FeedResponse, Track } from './types/music';
import { usePagedTracks } from './hooks/usePagedTracks';
import { fetchCategoryPage, fetchFeed, fetchSearchPage } from './utils/catalogClient';

/** How many tracks of each collection go into the mixed list on the home screen. */
const MIX_TRACKS_PER_CATEGORY = 4;

const MusicAppContent: React.FC = () => {
  const { playTrack, likedTracks, hydrateLikedTracks, currentTrack } = useAudio();

  const [feed, setFeed] = useState<FeedResponse | null>(null);
  const [isLoadingFeed, setIsLoadingFeed] = useState<boolean>(true);
  const [feedError, setFeedError] = useState<string | null>(null);
  const [feedAttempt, setFeedAttempt] = useState<number>(0);

  const [activeTab, setActiveTab] = useState<AppTab>('home');
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isSearchOpen, setIsSearchOpen] = useState<boolean>(false);
  const [searchScope, setSearchScope] = useState<'catalog' | 'online'>('catalog');
  // Each submit starts a new search, even for the same words
  const [submittedSearch, setSubmittedSearch] = useState<{ query: string; id: number } | null>(null);
  const [isCacheSettingsOpen, setIsCacheSettingsOpen] = useState<boolean>(false);

  // Register service worker on mount
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .then((reg) => console.log('AuraStream Service Worker registered:', reg.scope))
        .catch((err) => console.warn('Service Worker registration note:', err));
    }
  }, []);

  // Fetch the YouTube player chunk now, while this deploy still serves it
  useEffect(() => {
    const timer = window.setTimeout(preloadYouTubePlayer, 2000);
    return () => window.clearTimeout(timer);
  }, []);

  // First page of every collection, from the backend, on boot (and on retry)
  useEffect(() => {
    const controller = new AbortController();
    setIsLoadingFeed(true);
    setFeedError(null);

    fetchFeed(controller.signal)
      .then((data) => {
        setFeed(data);
        setIsLoadingFeed(false);
      })
      .catch((err) => {
        if (controller.signal.aborted || err?.name === 'AbortError') return;
        console.warn('Erro ao carregar as coleções:', err);
        setFeedError(err?.message || 'Não foi possível carregar as coleções agora.');
        setIsLoadingFeed(false);
      });

    return () => controller.abort();
  }, [feedAttempt]);

  // Sync BottomNavBar tabs with TopBar search states
  const handleSelectTab = (tab: AppTab) => {
    setActiveTab(tab);
    // Text typed in the search box belongs to the search screen; left behind it would filter the others
    if (tab !== 'search') setSearchQuery('');
    if (tab === 'search') {
      setIsSearchOpen(true);
      setSearchScope('online');
    } else if (tab === 'library') {
      setIsSearchOpen(false);
      setActiveFilter('liked');
    } else if (tab === 'radio') {
      setIsSearchOpen(false);
      setActiveFilter('all');
      setSelectedCategoryId(null);
    } else {
      setIsSearchOpen(false);
      setActiveFilter('all');
      setSelectedCategoryId(null);
    }
  };

  // Collection or filter chip being viewed: the grid wins over the chips
  const activeCategoryId = useMemo(() => {
    if (selectedCategoryId && getCategoryById(selectedCategoryId)) return selectedCategoryId;
    return getCategoryById(activeFilter) ? activeFilter : null;
  }, [selectedCategoryId, activeFilter]);
  const activeCategory = activeCategoryId ? getCategoryById(activeCategoryId) : undefined;

  // The collection being viewed, loaded page by page; it starts from the page the home feed already brought
  const categoryList = usePagedTracks(
    activeCategoryId ? `category:${activeCategoryId}` : null,
    (index, signal) => fetchCategoryPage(activeCategoryId as string, index, signal),
    activeCategoryId ? feed?.categories[activeCategoryId] : undefined
  );

  // Online search results, loaded page by page
  const onlineSearch = usePagedTracks(
    submittedSearch ? `search:${submittedSearch.id}:${submittedSearch.query}` : null,
    (index, signal) => fetchSearchPage(submittedSearch!.query, index, signal)
  );

  const performOnlineSearch = useCallback(() => {
    const query = searchQuery.trim();
    if (!query) return;
    setSubmittedSearch((prev) => ({ query, id: (prev?.id ?? 0) + 1 }));
  }, [searchQuery]);

  // Everything the home feed brought, without repeats
  const allLiveTracks = useMemo(() => {
    const map = new Map<string, Track>();
    Object.values(feed?.categories ?? {}).forEach((page) => {
      page.tracks.forEach((t) => map.set(t.id, t));
    });
    return Array.from(map.values());
  }, [feed]);

  // Favorites saved before their metadata was stored regain it when the track shows up again
  useEffect(() => {
    hydrateLikedTracks([...allLiveTracks, ...onlineSearch.tracks, ...categoryList.tracks]);
  }, [allLiveTracks, onlineSearch.tracks, categoryList.tracks, hydrateLikedTracks]);

  // A few tracks of each collection, in the order of the collections
  const mixTracks = useMemo(() => {
    const map = new Map<string, Track>();
    CATEGORIES.forEach((category) => {
      feed?.categories[category.id]?.tracks.slice(0, MIX_TRACKS_PER_CATEGORY).forEach((t) => map.set(t.id, t));
    });
    return Array.from(map.values());
  }, [feed]);

  // Size of each collection, as reported by the playlist behind it
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    CATEGORIES.forEach((category) => {
      const total = feed?.categories[category.id]?.total;
      if (total) counts[category.id] = total;
    });
    return counts;
  }, [feed]);

  // Search inside what is already loaded, and the favorites library
  const filteredCatalogTracks = useMemo(() => {
    if (searchQuery.trim() && searchScope === 'catalog') {
      const q = searchQuery.toLowerCase().trim();
      return allLiveTracks.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          t.artist.toLowerCase().includes(q) ||
          t.album.toLowerCase().includes(q) ||
          t.style.toLowerCase().includes(q)
      );
    }
    if (activeFilter === 'liked' || activeTab === 'library') return likedTracks;
    return allLiveTracks;
  }, [allLiveTracks, searchQuery, searchScope, activeFilter, likedTracks, activeTab]);

  const featuredTrack = feed?.featured ?? null;
  const isRadioTab = activeTab === 'radio' && !isSearchOpen && !searchQuery;
  // The tab shown as selected follows what is on screen, also when search is opened or closed from the top bar
  const navTab: AppTab = isSearchOpen ? 'search' : activeTab === 'search' ? 'home' : activeTab;

  return (
    <div className="min-h-screen bg-canvas text-label flex flex-col font-sans selection:bg-accent selection:text-white">
      {/* Offline Status Banner */}
      <OfflineIndicator />
      <UpdateBanner />

      {/* Main Mobile/Tablet Wrapper */}
      <div className="w-full max-w-xl md:max-w-2xl mx-auto flex flex-col flex-1 pb-[calc(9rem+var(--safe-bottom))]">
        {/* Top App Bar with live search */}
        <TopBar
          activeFilter={activeFilter}
          onSelectFilter={(filter) => {
            setActiveFilter(filter);
            setSelectedCategoryId(null);
            // Favorites are the library; everything else is shown on the home screen
            setActiveTab(filter === 'liked' ? 'library' : 'home');
          }}
          searchQuery={searchQuery}
          onSearchChange={(q) => setSearchQuery(q)}
          isSearchOpen={isSearchOpen}
          onToggleSearch={() => {
            setIsSearchOpen((prev) => !prev);
            if (!isSearchOpen) setSearchScope('online');
            else setSearchQuery('');
          }}
          searchScope={searchScope}
          onSearchScopeChange={(scope) => setSearchScope(scope)}
          onSubmitOnlineSearch={performOnlineSearch}
          isSearchingOnline={onlineSearch.isLoading}
          onOpenCacheSettings={() => setIsCacheSettingsOpen(true)}
        />

        {/* Cache Storage Settings Modal */}
        <CacheSettingsModal
          isOpen={isCacheSettingsOpen}
          onClose={() => setIsCacheSettingsOpen(false)}
        />

        <main className="flex-1 space-y-4">
          {/* 0. Radio stations */}
          {isRadioTab ? (
            <RadioView />
          ) : /* 1. Live Online Search Results View */
          isSearchOpen && searchScope === 'online' ? (
            <div className="pt-2 space-y-3">
              {onlineSearch.isLoading ? (
                <div className="px-4 py-12 text-center text-label-secondary space-y-3">
                  <Loader2 className="w-7 h-7 text-accent animate-spin mx-auto" />
                  <p className="text-xs">Buscando faixas online...</p>
                </div>
              ) : onlineSearch.tracks.length > 0 ? (
                <TrackList
                  tracks={onlineSearch.tracks}
                  title="Músicas Encontradas"
                  totalCount={onlineSearch.total}
                  onTrackSelect={(track) => playTrack(track, onlineSearch.tracks)}
                  hasMore={onlineSearch.hasMore}
                  isLoadingMore={onlineSearch.isLoadingMore}
                  error={onlineSearch.error}
                  onLoadMore={onlineSearch.loadMore}
                  onRetry={onlineSearch.retry}
                />
              ) : (
                <div className="px-4 py-10 text-center text-label-secondary text-xs space-y-2">
                  <div className="w-12 h-12 rounded-card bg-fill-tertiary flex items-center justify-center mx-auto text-accent">
                    <Globe className="w-6 h-6" />
                  </div>
                  <p role={onlineSearch.error ? 'alert' : undefined}>
                    {onlineSearch.error ||
                      (submittedSearch
                        ? `Nenhuma faixa encontrada para "${submittedSearch.query}".`
                        : searchQuery.trim()
                        ? `Pressione "Buscar" para encontrar "${searchQuery}" em toda a web.`
                        : 'Digite o nome de qualquer música, artista ou banda e toque em Buscar.')}
                  </p>
                  {onlineSearch.error && (
                    <button
                      onClick={onlineSearch.retry}
                      className="px-3.5 py-1.5 rounded-full bg-fill-tertiary hover:bg-fill-secondary text-label font-medium active:scale-95"
                    >
                      Tentar de novo
                    </button>
                  )}
                </div>
              )}
            </div>
          ) : /* 2. Local Catalog Search or Category Filter / Library View */
          (searchQuery || activeFilter !== 'all' || activeTab === 'library' || activeCategoryId) ? (
            <div className="pt-2 space-y-3">
              {activeCategory && !searchQuery && activeFilter !== 'liked' && activeTab !== 'library' ? (
                /* One collection, loaded page by page */
                <>
                  <p className="px-4 text-[13px] text-label-secondary">{activeCategory.description}</p>
                  {categoryList.isLoading ? (
                    <div className="py-12 text-center text-label-secondary space-y-3">
                      <Loader2 className="w-7 h-7 text-accent animate-spin mx-auto" />
                      <p className="text-xs">Carregando {activeCategory.name}...</p>
                    </div>
                  ) : categoryList.error && categoryList.tracks.length === 0 ? (
                    <div className="px-4 py-10 text-center text-xs text-rose-300 space-y-2" role="alert">
                      <AlertCircle className="w-6 h-6 mx-auto" />
                      <p>{categoryList.error}</p>
                      <button
                        onClick={categoryList.retry}
                        className="px-3.5 py-1.5 rounded-full bg-fill-tertiary hover:bg-fill-secondary text-label font-medium active:scale-95"
                      >
                        Tentar de novo
                      </button>
                    </div>
                  ) : (
                    <TrackList
                      tracks={categoryList.tracks}
                      title={activeCategory.name}
                      totalCount={categoryList.total}
                      emptyMessage="Esta coleção está vazia no momento."
                      onTrackSelect={(track) => playTrack(track, categoryList.tracks)}
                      hasMore={categoryList.hasMore}
                      isLoadingMore={categoryList.isLoadingMore}
                      error={categoryList.error}
                      onLoadMore={categoryList.loadMore}
                      onRetry={categoryList.retry}
                    />
                  )}
                </>
              ) : (
                <TrackList
                  tracks={filteredCatalogTracks}
                  title={
                    searchQuery
                      ? `Resultados para "${searchQuery}"`
                      : activeFilter === 'liked' || activeTab === 'library'
                      ? 'Sua Biblioteca (Favoritos)'
                      : 'Faixas Selecionadas'
                  }
                  emptyMessage={
                    activeFilter === 'liked' || activeTab === 'library'
                      ? 'Nenhuma música favoritada ainda. Toque no ícone de coração em qualquer faixa para salvar!'
                      : 'Nenhuma música encontrada nesta seção.'
                  }
                  onTrackSelect={(track) => playTrack(track, filteredCatalogTracks)}
                />
              )}

              {/* Fast switch to Web Search */}
              {searchQuery && searchScope === 'catalog' && (
                <div className="px-4 pt-2">
                  <button
                    onClick={() => {
                      setSearchScope('online');
                      performOnlineSearch();
                    }}
                    className="w-full p-3 rounded-card bg-elevated hover:bg-elevated-2 flex items-center justify-between text-left transition-all active:scale-[0.98]"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-fill-tertiary text-accent flex items-center justify-center">
                        <Globe className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="text-xs font-semibold text-white">
                          Buscar "{searchQuery}" em toda a web
                        </span>
                        <p className="text-[13px] text-label-secondary">
                          Músicas, artistas e álbuns oficiais online
                        </p>
                      </div>
                    </div>
                    <span className="text-[15px] text-accent">Ir ➔</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            /* 3. Main Live Home View */
            <>
              {/* Dynamic Live Featured Highlight Banner */}
              {featuredTrack && (
                <div className="px-4 pt-3">
                  <div className="relative overflow-hidden rounded-sheet p-5 bg-elevated shadow-xl">
                    {/* Subtle background cover glow */}
                    <div className="absolute right-0 top-0 bottom-0 w-1/2 opacity-25 overflow-hidden pointer-events-none">
                      <img
                        src={featuredTrack.coverUrl}
                        alt=""
                        className="w-full h-full object-cover blur-sm scale-125"
                      />
                      <div className="absolute inset-0 bg-gradient-to-r from-elevated via-transparent to-transparent" />
                    </div>

                    <div className="relative z-10 max-w-[280px]">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-accent mb-1">
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>NO TOPO DO BRASIL AGORA</span>
                      </div>
                      <h1 className="text-[22px] font-bold text-label tracking-tight leading-tight">
                        {featuredTrack.title}
                      </h1>
                      <p className="text-xs text-label-secondary mt-0.5 truncate">
                        {featuredTrack.artist} · {featuredTrack.album || 'Single Oficial'}
                      </p>

                      <button
                        onClick={() => playTrack(featuredTrack, feed?.categories['top-hits']?.tracks ?? [featuredTrack])}
                        aria-label={`Reproduzir ${featuredTrack.title}`}
                        className="mt-3.5 flex items-center gap-2 px-5 py-2 rounded-full bg-accent text-white font-semibold text-[15px] hover:bg-accent-pressed active:scale-95 transition-all"
                      >
                        <Play className="w-3.5 h-3.5 fill-current" />
                        <span>Reproduzir Agora</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Dynamic Category Grid */}
              <CategoryGrid
                selectedCategoryId={selectedCategoryId}
                onSelectCategory={(id) => setSelectedCategoryId(id)}
                categoryCounts={categoryCounts}
              />

              {/* One carousel per collection: first page; "Ver tudo" opens the whole playlist */}
              {CATEGORIES.map((category) => {
                const page = feed?.categories[category.id];
                if (!page || page.tracks.length === 0) return null;
                return (
                  <TrackCarousel
                    key={category.id}
                    title={category.name}
                    subtitle={category.description}
                    tracks={page.tracks}
                    totalCount={page.total}
                    onSeeAll={() => setSelectedCategoryId(category.id)}
                    onTrackSelect={(track) => playTrack(track, page.tracks)}
                  />
                );
              })}

              {/* A few tracks of each collection */}
              {mixTracks.length > 0 && (
                <TrackList
                  title="Mix das coleções"
                  tracks={mixTracks}
                  onTrackSelect={(track) => playTrack(track, mixTracks)}
                />
              )}

              {isLoadingFeed && allLiveTracks.length === 0 && (
                <div className="py-20 text-center space-y-3">
                  <Loader2 className="w-8 h-8 text-accent animate-spin mx-auto" />
                  <p className="text-xs text-label-secondary">Carregando as coleções...</p>
                </div>
              )}

              {feedError && !isLoadingFeed && allLiveTracks.length === 0 && (
                <div className="px-4 py-16 text-center text-xs text-rose-300 space-y-2" role="alert">
                  <AlertCircle className="w-7 h-7 mx-auto" />
                  <p>{feedError}</p>
                  <button
                    onClick={() => setFeedAttempt((attempt) => attempt + 1)}
                    className="px-3.5 py-1.5 rounded-full bg-fill-tertiary hover:bg-fill-secondary text-label font-medium active:scale-95"
                  >
                    Tentar de novo
                  </button>
                </div>
              )}
            </>
          )}
        </main>
      </div>

      {/* Floating Mini Player (iOS Style) */}
      {currentTrack && <MiniPlayer />}

      {/* Fullscreen Expanded Player (Modal / Bottom Sheet) */}
      <ExpandedPlayer />

      {/* Spotify / Apple Music Style Bottom Navigation Bar */}
      <BottomNavBar activeTab={navTab} onSelectTab={handleSelectTab} />

      {/* Headless Player Redundant Fallback Engine */}
      <HeadlessPlayerFallback />
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <AudioProvider>
      <MusicAppContent />
    </AudioProvider>
  );
};

export default App;
