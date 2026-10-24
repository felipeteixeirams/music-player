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
import { TRACKS, getTracksByStyle } from './data/musicCatalog';
import { Play, Sparkles, Globe, ShieldCheck, Loader2 } from 'lucide-react';
import { Track } from './types/music';
import { logPipedSearchResults } from './utils/audioLogger';

const MusicAppContent: React.FC = () => {
  const { playTrack, likedTrackIds } = useAudio();

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

  // Perform live online music search via Piped API backend proxy
  const performOnlineSearch = useCallback(async () => {
    if (!searchQuery.trim()) return;
    setIsSearchingOnline(true);
    setOnlineSearchError(null);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(searchQuery.trim())}`);
      if (!res.ok) throw new Error('Instâncias Piped indisponíveis');
      const data = await res.json();
      if (Array.isArray(data.tracks) && data.tracks.length > 0) {
        logPipedSearchResults(searchQuery.trim(), data.tracks, data.source);
        setOnlineSearchResults(data.tracks);
      } else {
        setOnlineSearchResults([]);
        setOnlineSearchError('Nenhuma faixa encontrada na rede online para esta busca.');
      }
    } catch {
      setOnlineSearchError('Instâncias do Piped temporariamente congestionadas. Tente novamente em instantes.');
    } finally {
      setIsSearchingOnline(false);
    }
  }, [searchQuery]);

  // Filtered catalog tracks based on search or category
  const filteredCatalogTracks = useMemo(() => {
    let result = [...TRACKS];

    // Filter by search query
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

    // Filter by topbar category
    if (activeFilter === 'liked' || activeTab === 'library') {
      return result.filter((t) => likedTrackIds.includes(t.id));
    }

    if (activeFilter !== 'all') {
      return result.filter((t) => t.categoryId === activeFilter);
    }

    // Filter by Category Grid selection if active
    if (selectedCategoryId && selectedCategoryId !== 'all') {
      return result.filter((t) => t.categoryId === selectedCategoryId);
    }

    return result;
  }, [searchQuery, searchScope, activeFilter, selectedCategoryId, likedTrackIds, activeTab]);

  const classicRockTracks = useMemo(() => getTracksByStyle('Classic Rock'), []);
  const altPopTracks = useMemo(() => getTracksByStyle('Alternative Pop'), []);
  const chillTracks = useMemo(() => TRACKS.filter((t) => t.categoryId === 'lofi-chill' || t.categoryId === 'synthwave'), []);

  const featuredTrack = TRACKS[0]; // Queen - Bohemian Rhapsody

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
          onSearchChange={(q) => {
            setSearchQuery(q);
            if (searchScope === 'online') {
              setOnlineSearchResults([]);
            }
          }}
          isSearchOpen={isSearchOpen}
          onToggleSearch={() => {
            setIsSearchOpen((prev) => !prev);
            if (!isSearchOpen) {
              setSearchScope('catalog');
            }
          }}
          searchScope={searchScope}
          onSearchScopeChange={(scope) => {
            setSearchScope(scope);
            if (scope === 'online' && searchQuery.trim() && onlineSearchResults.length === 0) {
              performOnlineSearch();
            }
          }}
          onSubmitOnlineSearch={performOnlineSearch}
          isSearchingOnline={isSearchingOnline}
          onOpenCacheSettings={() => setIsCacheSettingsOpen(true)}
        />

        {/* Cache Settings Modal */}
        <CacheSettingsModal
          isOpen={isCacheSettingsOpen}
          onClose={() => setIsCacheSettingsOpen(false)}
        />

        <main className="flex-1 space-y-4">
          {/* 1. Live Online Piped Search Results View */}
          {isSearchOpen && searchScope === 'online' ? (
            <div className="pt-2">
              {isSearchingOnline ? (
                <div className="px-4 py-12 text-center text-white/50 space-y-3">
                  <Loader2 className="w-7 h-7 text-purple-400 animate-spin mx-auto" />
                  <p className="text-xs">Buscando músicas puras no Piped Web...</p>
                </div>
              ) : onlineSearchResults.length > 0 ? (
                <TrackList
                  tracks={onlineSearchResults}
                  title={`Resultados Online no Piped (${onlineSearchResults.length})`}
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
                    ? `Catálogo Local para "${searchQuery}"`
                    : activeFilter === 'liked' || activeTab === 'library'
                    ? 'Sua Biblioteca (Favoritos)'
                    : 'Faixas Selecionadas'
                }
                emptyMessage={
                  activeFilter === 'liked' || activeTab === 'library'
                    ? 'Nenhuma música favoritada ainda. Toque no ícone de coração em qualquer faixa para salvar!'
                    : 'Nenhuma música encontrada no catálogo local.'
                }
                onTrackSelect={(track) => playTrack(track, filteredCatalogTracks)}
              />

              {/* Quick Prompt to Search Online via Piped */}
              {searchQuery && (
                <div className="px-4 pt-1">
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
                          Milhões de faixas via Piped Pure Audio
                        </p>
                      </div>
                    </div>
                    <span className="text-xs font-semibold text-purple-400">Ir ➔</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            /* 3. Main Home View */
            <>
              {/* Featured Highlight Banner */}
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
                    <p className="text-xs text-white/60 mt-0.5">
                      {featuredTrack.artist} · {featuredTrack.album}
                    </p>

                    <button
                      onClick={() => playTrack(featuredTrack, TRACKS)}
                      aria-label={`Reproduzir ${featuredTrack.title}`}
                      className="mt-3.5 flex items-center gap-2 px-4 py-2 rounded-2xl bg-white text-black font-bold text-xs hover:bg-white/90 active:scale-95 transition-all shadow-lg"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>Reproduzir Hino</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Category Grid */}
              <CategoryGrid
                selectedCategoryId={selectedCategoryId}
                onSelectCategory={(id) => setSelectedCategoryId(id)}
              />

              {/* Classic Rock Legends Carousel (Queen) */}
              <TrackCarousel
                title="Clássicos do Rock Atemporal"
                subtitle="Obras-primas com vocais e guitarras inesquecíveis"
                tracks={classicRockTracks}
                onTrackSelect={(track) => playTrack(track, classicRockTracks)}
              />

              {/* Alternative Rock & Pop Carousel (Imagine Dragons) */}
              <TrackCarousel
                title="Alternative Rock & Pop"
                subtitle="Batidas eletrizantes de Imagine Dragons e além"
                tracks={altPopTracks}
                onTrackSelect={(track) => playTrack(track, altPopTracks)}
              />

              {/* Lofi Chill & Beats Carousel */}
              <TrackCarousel
                title="Foco & Relaxamento Sonoro"
                subtitle="Sintetizadores retrô, vinil e melodias imersivas"
                tracks={chillTracks}
                onTrackSelect={(track) => playTrack(track, chillTracks)}
              />

              {/* All Tracks Catalog */}
              <TrackList
                title="Todas as Músicas do Catálogo"
                tracks={TRACKS}
                onTrackSelect={(track) => playTrack(track, TRACKS)}
              />

              {/* Mobile PWA & Hybrid Audio Architecture Card */}
              <div className="px-4 py-2">
                <div className="p-4 rounded-3xl bg-white/[0.02] border border-white/[0.07] space-y-2 text-left">
                  <div className="flex items-center gap-2 text-xs font-semibold text-purple-400">
                    <ShieldCheck className="w-4 h-4" />
                    <span>Engenharia de Streaming & PWA Nativo</span>
                  </div>
                  <p className="text-[11px] text-white/60 leading-relaxed">
                    Aplicativo configurado com <strong>Media Session API</strong> para controles de hardware e tela de bloqueio, 
                    <strong>Service Worker</strong> em memória para carregamento instantâneo offline, e arquitetura de áudio 
                    híbrida (Nativo + Piped API Pure Audio + Fallback Headless redundante).
                  </p>
                </div>
              </div>
            </>
          )}
        </main>
      </div>

      {/* Floating Mini Player (iOS Style) */}
      <MiniPlayer />

      {/* Fullscreen Expanded Player (Modal / Bottom Sheet) */}
      <ExpandedPlayer />

      {/* Spotify / Apple Music Style Bottom Navigation Bar */}
      <BottomNavBar activeTab={activeTab} onSelectTab={handleSelectTab} />

      {/* Headless Player Redundant Fallback Engine (1px by 1px opacity 0) */}
      <HeadlessPlayerFallback />
    </div>
  );
};

export default function App() {
  return (
    <AudioProvider>
      <MusicAppContent />
    </AudioProvider>
  );
}
