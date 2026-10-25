import React from 'react';
import { Search, Sparkles, Globe, Library, Loader2, Database } from 'lucide-react';
import { PWAInstallButton } from './PWAInstallButton';
import { CATEGORIES } from '../data/musicCatalog';

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
    <header className="sticky top-0 z-30 w-full material-regular hairline-bottom px-4 pb-2.5 pt-[calc(var(--safe-top)+0.625rem)]">
      {/* Top Row: Wordmark Brand and Quick Actions */}
      <div className="flex items-center justify-between gap-2 max-w-5xl mx-auto">
        {/* Brand */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <span className="text-[17px] font-bold tracking-tight text-label whitespace-nowrap">
            AuraStream
          </span>
        </div>

        {/* Right Actions: Cache Settings + Search + PWA Install */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={onOpenCacheSettings}
            aria-label="Gerenciar cota de cache local"
            className="p-2 rounded-full bg-fill-tertiary text-label-secondary hover:text-label transition-all active:scale-95"
            title="Configurar Cache"
          >
            <Database className="w-3.5 h-3.5 text-accent" />
          </button>
          <button
            onClick={onToggleSearch}
            aria-label="Buscar faixas ou artistas"
            className={`p-2 rounded-full transition-all active:scale-95 ${
              isSearchOpen
                ? 'bg-accent text-white'
                : 'bg-fill-tertiary text-label-secondary hover:text-label'
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
            ...CATEGORIES.map((category) => ({ id: category.id, label: category.name })),
            { id: 'liked', label: 'Favoritos' }
          ].map((item) => {
            const isActive = activeFilter === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onSelectFilter(item.id)}
                className={`px-3.5 py-1.5 rounded-full text-[13px] font-medium whitespace-nowrap shrink-0 transition-all active:scale-95 ${
                  isActive
                    ? 'bg-accent text-white font-semibold'
                    : 'text-label-secondary hover:text-label bg-fill-tertiary'
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
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-label-tertiary" />
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
                className="w-full pl-10 pr-14 py-2 rounded-card bg-fill-tertiary text-label placeholder:text-label-tertiary text-[15px] focus:outline-none focus:ring-2 focus:ring-accent/60 transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => onSearchChange('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-label-secondary hover:text-label"
                >
                  Limpar
                </button>
              )}
            </div>

            {searchScope === 'online' && (
              <button
                onClick={onSubmitOnlineSearch}
                disabled={isSearchingOnline || !searchQuery.trim()}
                className="px-3.5 py-2 rounded-card bg-accent hover:bg-accent-pressed disabled:opacity-50 text-white text-[15px] font-semibold flex items-center gap-1.5 shrink-0 active:scale-95 transition-all"
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
          <div className="flex items-center gap-0.5 p-0.5 bg-fill-tertiary rounded-lg w-fit">
            <button
              onClick={() => onSearchScopeChange('catalog')}
              className={`px-3 py-1 rounded-md text-xs font-medium flex items-center gap-1.5 transition-all ${
                searchScope === 'catalog'
                  ? 'bg-elevated-2 text-label font-semibold shadow-sm'
                  : 'text-label-secondary hover:text-label'
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
              className={`px-3 py-1 rounded-md text-xs font-medium flex items-center gap-1.5 transition-all ${
                searchScope === 'online'
                  ? 'bg-elevated-2 text-label font-semibold shadow-sm'
                  : 'text-label-secondary hover:text-label'
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
