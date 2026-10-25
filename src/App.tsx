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
import { BottomNavBar } from './components/BottomNavBar';
import { CATEGORIES } from './data/musicCatalog';
import { Play, Sparkles, Globe, Loader2 } from 'lucide-react';
import { Track } from './types/music';
import { logPipedSearchResults } from './utils/audioLogger';

interface LiveFeedState {
  trending: Track[];
  rock: Track[];
  pop: Track[];
  lofi: Track[];
  featured: Track | null;
}

const MusicAppContent: React.FC = () => {
  const { playTrack, likedTracks, hydrateLikedTracks, currentTrack } = useAudio();

  const [feed, setFeed] = useState<LiveFeedState>({
    trending: [],
    rock: [],
    pop: [],
    lofi: [],
    featured: null
  });
  const [isLoadingFeed, setIsLoadingFeed] = useState<boolean>(true);

  const [activeTab, setActiveTab] = useState<'home' | 'search' | 'library' | 'explore'>('home');
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isSearchOpen, setIsSearchOpen] = useState<boolean>(false);
  const [searchScope, setSearchScope] = useState<'catalog' | 'online'>('catalog');
  const [onlineSearchResults, setOnlineSearchResults] = useState<Track[]>([]);
  const [isSearchingOnline, setIsSearchingOnline] = useState<boolean>(false);
  const [onlineSearchError, setOnlineSearchError] = useState<string | null>(null);
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

  // Fetch 100% live tracks from backend integrations on boot
  useEffect(() => {
    let isMounted = true;
    setIsLoadingFeed(true);

    fetch('/api/feed')
      .then((res) => res.json())
      .then((data) => {
        if (isMounted && data) {
          const liveData: LiveFeedState = {
            trending: data.trending || [],
            rock: data.rock || [],
            pop: data.pop || [],
            lofi: data.lofi || [],
            featured: data.featured || data.trending?.[0] || null
          };
          setFeed(liveData);
          setIsLoadingFeed(false);
        }
      })
      .catch((err) => {
        console.warn('Erro ao carregar feed ao vivo:', err);
        if (isMounted) setIsLoadingFeed(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // Sync BottomNavBar tabs with TopBar search states
  const handleSelectTab = (tab: 'home' | 'search' | 'library' | 'explore') => {
    setActiveTab(tab);
    if (tab === 'search') {
      setIsSearchOpen(true);
      setSearchScope('online');
    } else if (tab === 'library') {
      setIsSearchOpen(false);
      setActiveFilter('liked');
    } else if (tab === 'explore') {
      setIsSearchOpen(false);
      setActiveFilter('all');
    } else {
      setIsSearchOpen(false);
      setActiveFilter('all');
      setSelectedCategoryId(null);
    }
  };

  // Perform live online music search via Piped/YouTube API backend proxy
  const performOnlineSearch = useCallback(async () => {
    if (!searchQuery.trim()) return;
    setIsSearchingOnline(true);
    setOnlineSearchError(null);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(searchQuery.trim())}`);
      if (!res.ok) throw new Error('Falha na conexão de busca');
      const data = await res.json();
      if (Array.isArray(data.tracks) && data.tracks.length > 0) {
        logPipedSearchResults(searchQuery.trim(), data.tracks, data.source);
        setOnlineSearchResults(data.tracks);
      } else {
        setOnlineSearchResults([]);
        setOnlineSearchError('Nenhuma faixa encontrada na rede online para esta busca.');
      }
    } catch {
      setOnlineSearchError('Instâncias de streaming temporariamente congestionadas. Tente novamente.');
    } finally {
      setIsSearchingOnline(false);
    }
  }, [searchQuery]);

  // Aggregate all live tracks deduplicated by video ID
  const allLiveTracks = useMemo(() => {
    const map = new Map<string, Track>();
    [...feed.trending, ...feed.rock, ...feed.pop, ...feed.lofi].forEach((t) => {
      if (t && t.id) map.set(t.id, t);
    });
    return Array.from(map.values());
  }, [feed]);

  // Favorites saved before their metadata was stored regain it when the track shows up again
  useEffect(() => {
    hydrateLikedTracks([...allLiveTracks, ...onlineSearchResults]);
  }, [allLiveTracks, onlineSearchResults, hydrateLikedTracks]);

  // Stable identity: a fresh array every render would re-run effects that depend on `tracks`
  const recommendedTracks = useMemo(() => allLiveTracks.slice(0, 20), [allLiveTracks]);

  // Dynamic Category counts
  const categoryCounts = useMemo(() => {
    return {
      'top-hits': feed.trending.length,
      'classic-rock': feed.rock.length,
      'alternative-pop': feed.pop.length,
      'lofi-chill': feed.lofi.length,
      'synthwave': feed.lofi.length
    };
  }, [feed]);

  // Filtered live catalog tracks based on search or category
  const filteredCatalogTracks = useMemo(() => {
    let result = [...allLiveTracks];

    // Filter by search query in catalog
    if (searchQuery.trim() && searchScope === 'catalog') {
      const q = searchQuery.toLowerCase().trim();
      return result.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          t.artist.toLowerCase().includes(q) ||
          t.album.toLowerCase().includes(q) ||
          t.style.toLowerCase().includes(q)
      );
    }

    // Filter by favorites / library
    if (activeFilter === 'liked' || activeTab === 'library') {
      return likedTracks;
    }

    // Filter by top chips
    if (activeFilter === 'classic-rock') return feed.rock;
    if (activeFilter === 'alternative-pop') return feed.pop;
    if (activeFilter === 'lofi-chill') return feed.lofi;

    // Filter by Category Grid selection if active
    if (selectedCategoryId) {
      if (selectedCategoryId === 'classic-rock') return feed.rock;
      if (selectedCategoryId === 'alternative-pop') return feed.pop;
      if (selectedCategoryId === 'lofi-chill') return feed.lofi;
      if (selectedCategoryId === 'top-hits') return feed.trending;
    }

    return result;
  }, [allLiveTracks, searchQuery, searchScope, activeFilter, selectedCategoryId, likedTracks, activeTab, feed]);

  const featuredTrack = feed.featured;

  return (
    <div className="min-h-screen bg-[#07070d] text-white flex flex-col font-sans selection:bg-purple-500 selection:text-white">
      {/* Offline Status Banner */}
      <OfflineIndicator />

      {/* Main Mobile/Tablet Wrapper */}
      <div className="w-full max-w-xl md:max-w-2xl mx-auto flex flex-col flex-1 pb-36">
        {/* Top App Bar with live search */}
        <TopBar
          activeFilter={activeFilter}
          onSelectFilter={(filter) => {
            setActiveFilter(filter);
            setSelectedCategoryId(null);
          }}
          searchQuery={searchQuery}
          onSearchChange={(q) => setSearchQuery(q)}
          isSearchOpen={isSearchOpen}
          onToggleSearch={() => {
            setIsSearchOpen((prev) => !prev);
            if (!isSearchOpen) setSearchScope('online');
          }}
          searchScope={searchScope}
          onSearchScopeChange={(scope) => setSearchScope(scope)}
          onSubmitOnlineSearch={performOnlineSearch}
          isSearchingOnline={isSearchingOnline}
          onOpenCacheSettings={() => setIsCacheSettingsOpen(true)}
        />

        {/* Cache Storage Settings Modal */}
        <CacheSettingsModal
          isOpen={isCacheSettingsOpen}
          onClose={() => setIsCacheSettingsOpen(false)}
        />

        <main className="flex-1 space-y-4">
          {/* 1. Live Online Search Results View */}
          {isSearchOpen && searchScope === 'online' ? (
            <div className="pt-2 space-y-3">
              {isSearchingOnline ? (
                <div className="px-4 py-12 text-center text-white/50 space-y-3">
                  <Loader2 className="w-7 h-7 text-purple-400 animate-spin mx-auto" />
                  <p className="text-xs">Buscando faixas online...</p>
                </div>
              ) : onlineSearchResults.length > 0 ? (
                <TrackList
                  tracks={onlineSearchResults}
                  title={`Músicas Encontradas (${onlineSearchResults.length})`}
                  onTrackSelect={(track) => playTrack(track, onlineSearchResults)}
                />
              ) : (
                <div className="px-4 py-10 text-center text-white/50 text-xs space-y-2">
                  <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto text-purple-400">
                    <Globe className="w-6 h-6" />
                  </div>
                  <p>
                    {onlineSearchError ||
                      (searchQuery.trim()
                        ? `Pressione "Buscar" para encontrar "${searchQuery}" em toda a web.`
                        : 'Digite o nome de qualquer música, artista ou banda e toque em Buscar.')}
                  </p>
                </div>
              )}
            </div>
          ) : /* 2. Local Catalog Search or Category Filter / Library View */
          (searchQuery || activeFilter !== 'all' || activeTab === 'library' || (selectedCategoryId && selectedCategoryId !== 'all')) ? (
            <div className="pt-2 space-y-3">
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

              {/* Fast switch to Web Search */}
              {searchQuery && searchScope === 'catalog' && (
                <div className="px-4 pt-2">
                  <button
                    onClick={() => {
                      setSearchScope('online');
                      performOnlineSearch();
                    }}
                    className="w-full p-3 rounded-2xl bg-purple-950/30 hover:bg-purple-900/40 border border-purple-500/30 flex items-center justify-between text-left transition-all active:scale-[0.98]"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center">
                        <Globe className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="text-xs font-semibold text-white">
                          Buscar "{searchQuery}" em toda a web
                        </span>
                        <p className="text-[10px] text-white/50">
                          Músicas, artistas e álbuns oficiais online
                        </p>
                      </div>
                    </div>
                    <span className="text-xs font-semibold text-purple-400">Ir ➔</span>
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
                  <div className="relative overflow-hidden rounded-3xl p-5 border border-white/10 bg-gradient-to-br from-purple-900/40 via-purple-950/20 to-[#0d0d17] shadow-xl">
                    {/* Subtle background cover glow */}
                    <div className="absolute right-0 top-0 bottom-0 w-1/2 opacity-25 overflow-hidden pointer-events-none">
                      <img
                        src={featuredTrack.coverUrl}
                        alt=""
                        className="w-full h-full object-cover blur-sm scale-125"
                      />
                      <div className="absolute inset-0 bg-gradient-to-r from-[#0d0d17] via-transparent to-transparent" />
                    </div>

                    <div className="relative z-10 max-w-[280px]">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-purple-400 mb-1">
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>DESTAQUE DA SEMANA</span>
                      </div>
                      <h1 className="text-xl font-black text-white tracking-tight leading-tight">
                        {featuredTrack.title}
                      </h1>
                      <p className="text-xs text-white/60 mt-0.5 truncate">
                        {featuredTrack.artist} · {featuredTrack.album || 'Single Oficial'}
                      </p>

                      <button
                        onClick={() => playTrack(featuredTrack, feed.trending)}
                        aria-label={`Reproduzir ${featuredTrack.title}`}
                        className="mt-3.5 flex items-center gap-2 px-4 py-2 rounded-2xl bg-white text-black font-bold text-xs hover:bg-white/90 active:scale-95 transition-all shadow-lg"
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

              {/* Live Trending Carousel */}
              {feed.trending.length > 0 && (
                <TrackCarousel
                  title="Top Tendências Globais"
                  subtitle="As faixas mais tocadas e virais da atualidade"
                  tracks={feed.trending}
                  onTrackSelect={(track) => playTrack(track, feed.trending)}
                />
              )}

              {/* Live Classic Rock Carousel */}
              {feed.rock.length > 0 && (
                <TrackCarousel
                  title="Clássicos do Rock Atemporal"
                  subtitle="Grandes lendas do rock internacional"
                  tracks={feed.rock}
                  onTrackSelect={(track) => playTrack(track, feed.rock)}
                />
              )}

              {/* Live Pop Carousel */}
              {feed.pop.length > 0 && (
                <TrackCarousel
                  title="Alternative Rock & Pop"
                  subtitle="Grandes sucessos do pop e indie internacional"
                  tracks={feed.pop}
                  onTrackSelect={(track) => playTrack(track, feed.pop)}
                />
              )}

              {/* Live Chill Beats Carousel */}
              {feed.lofi.length > 0 && (
                <TrackCarousel
                  title="Foco & Relaxamento Sonoro"
                  subtitle="Batidas suaves, lofi e melodias envolventes"
                  tracks={feed.lofi}
                  onTrackSelect={(track) => playTrack(track, feed.lofi)}
                />
              )}

              {/* All Live Tracks Feed */}
              {allLiveTracks.length > 0 && (
                <TrackList
                  title="Músicas Recomendadas"
                  tracks={recommendedTracks}
                  onTrackSelect={(track) => playTrack(track, allLiveTracks)}
                />
              )}

              {isLoadingFeed && allLiveTracks.length === 0 && (
                <div className="py-20 text-center space-y-3">
                  <Loader2 className="w-8 h-8 text-purple-400 animate-spin mx-auto" />
                  <p className="text-xs text-white/50">Carregando músicas ao vivo das integrações...</p>
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
      <BottomNavBar activeTab={activeTab} onSelectTab={handleSelectTab} />

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
