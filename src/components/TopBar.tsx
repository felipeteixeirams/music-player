import React from 'react';
import { Search, Sparkles, Globe, Library, Loader2, Database } from 'lucide-react';
import { PWAInstallButton } from './PWAInstallButton';

interface TopBarProps {
  activeFilter: string;
  onSelectFilter: (filterId: string) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  isSearchOpen: boolean;
  onToggleSearch: () => void;
  searchScope: 'catalog' | 'online';
  onSearchScopeChange: (scope: 'catalog' | 'online') => void;
  onSubmitOnlineSearch: () => void;
  isSearchingOnline: boolean;
  onOpenCacheSettings: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  activeFilter,
  onSelectFilter,
  searchQuery,
  onSearchChange,
  isSearchOpen,
  onToggleSearch,
  searchScope,
  onSearchScopeChange,
  onSubmitOnlineSearch,
  isSearchingOnline,
  onOpenCacheSettings
}) => {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (searchScope === 'online') {
        onSubmitOnlineSearch();
      }
    }
  };

  return (
    <header className="sticky top-0 z-30 w-full bg-[#090910]/90 backdrop-blur-2xl border-b border-white/[0.06] px-4 py-2.5">
      {/* Top Row: Wordmark Brand and Quick Actions */}
      <div className="flex items-center justify-between gap-2 max-w-5xl mx-auto">
        {/* Brand */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-purple-600 via-pink-600 to-amber-500 flex items-center justify-center shadow-lg shadow-purple-600/30">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <span className="text-base font-extrabold tracking-tight text-white whitespace-nowrap">
            AuraStream
          </span>
        </div>

        {/* Right Actions: Cache Settings + Search + PWA Install */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={onOpenCacheSettings}
            aria-label="Gerenciar cota de cache local"
            className="p-2 rounded-full border bg-white/5 border-white/10 text-white/70 hover:text-white transition-all active:scale-95"
            title="Configurar Cache"
          >
            <Database className="w-3.5 h-3.5 text-purple-400" />
          </button>
          <button
            onClick={onToggleSearch}
            aria-label="Buscar faixas ou artistas"
            className={`p-2 rounded-full border transition-all active:scale-95 ${
              isSearchOpen
                ? 'bg-purple-600/30 border-purple-500 text-white'
                : 'bg-white/5 border-white/10 text-white/70 hover:text-white'
            }`}
          >
            <Search className="w-3.5 h-3.5" />
          </button>
          <PWAInstallButton />
        </div>
      </div>

      {/* Row 2: Horizontal Filter Tabs */}
      {!isSearchOpen && (
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-2.5 pb-0.5 max-w-5xl mx-auto" aria-label="Filtrar faixas">
          {[
            { id: 'all', label: 'Tudo' },
            { id: 'classic-rock', label: 'Classic Rock' },
            { id: 'alternative-pop', label: 'Alternative Pop' },
            { id: 'lofi-chill', label: 'Lofi Chill' },
            { id: 'liked', label: 'Favoritos' }
          ].map((item) => {
            const isActive = activeFilter === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onSelectFilter(item.id)}
                className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap shrink-0 transition-all active:scale-95 ${
                  isActive
                    ? 'bg-white text-black shadow-md font-semibold'
                    : 'text-white/70 hover:text-white hover:bg-white/10 bg-white/[0.03]'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      )}

      {/* Expandable Search Input & Scope Switcher */}
      {isSearchOpen && (
        <div className="mt-2.5 max-w-5xl mx-auto space-y-2 animate-in slide-in-from-top-2 duration-150">
          <div className="relative flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  searchScope === 'online'
                    ? 'Buscar músicas, artistas ou álbuns...'
                    : 'Buscar no catálogo local...'
                }
                autoFocus
                className="w-full pl-10 pr-14 py-2 rounded-2xl bg-white/[0.06] border border-white/15 text-white placeholder-white/40 text-xs focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => onSearchChange('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-white/50 hover:text-white"
                >
                  Limpar
                </button>
              )}
            </div>

            {searchScope === 'online' && (
              <button
                onClick={onSubmitOnlineSearch}
                disabled={isSearchingOnline || !searchQuery.trim()}
                className="px-3.5 py-2 rounded-2xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-1.5 shrink-0 active:scale-95 transition-all shadow-md shadow-purple-900/30"
              >
                {isSearchingOnline ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <span>Buscar</span>
                )}
              </button>
            )}
          </div>

          {/* Search Scope Switcher Segmented Tabs */}
          <div className="flex items-center gap-1 p-1 bg-white/[0.04] rounded-2xl border border-white/10 w-fit">
            <button
              onClick={() => onSearchScopeChange('catalog')}
              className={`px-3 py-1 rounded-xl text-[11px] font-medium flex items-center gap-1.5 transition-all ${
                searchScope === 'catalog'
                  ? 'bg-white text-black font-semibold shadow-sm'
                  : 'text-white/60 hover:text-white'
              }`}
            >
              <Library className="w-3 h-3" />
              <span>Catálogo</span>
            </button>
            <button
              onClick={() => {
                onSearchScopeChange('online');
                if (searchQuery.trim()) onSubmitOnlineSearch();
              }}
              className={`px-3 py-1 rounded-xl text-[11px] font-medium flex items-center gap-1.5 transition-all ${
                searchScope === 'online'
                  ? 'bg-purple-600 text-white font-semibold shadow-sm'
                  : 'text-white/60 hover:text-white'
              }`}
            >
              <Globe className="w-3 h-3" />
              <span>Músicas Online</span>
            </button>
          </div>
        </div>
      )}
    </header>
  );
};
