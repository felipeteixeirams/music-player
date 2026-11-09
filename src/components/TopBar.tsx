import React from 'react';
import { ChevronLeft, Search, Globe, Library, Loader2, Settings, Mic, X } from 'lucide-react';

interface TopBarProps {
  /** Large title of the screen. */
  title: string;
  /** Present when the screen is a level below another (a collection): shows the way back. */
  onBack?: () => void;
  backLabel?: string;
  showSearch: boolean;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  searchScope: 'catalog' | 'online';
  onSearchScopeChange: (scope: 'catalog' | 'online') => void;
  onSubmitOnlineSearch: () => void;
  isSearchingOnline: boolean;
  onOpenSettings: () => void;
  recentSearches?: string[];
  onSelectRecentSearch?: (term: string) => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  title,
  onBack,
  backLabel = 'Voltar',
  showSearch,
  searchQuery,
  onSearchChange,
  searchScope,
  onSearchScopeChange,
  onSubmitOnlineSearch,
  isSearchingOnline,
  onOpenSettings,
  recentSearches,
  onSelectRecentSearch
}) => {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (searchScope === 'online') onSubmitOnlineSearch();
    }
  };

  return (
    <>
      {/* Keeps the status bar legible while the page scrolls under it */}
      <div
        className="fixed top-0 left-0 right-0 z-30 h-[var(--safe-top)] material-regular status-strip"
        aria-hidden="true"
      />

      <header className="px-4 pb-2 pt-[calc(var(--safe-top)+0.75rem)]">
        {onBack && (
          <button
            onClick={onBack}
            className="-ml-1 mb-1 flex items-center gap-0.5 text-[17px] text-accent active:opacity-60"
          >
            <ChevronLeft className="w-6 h-6" aria-hidden="true" />
            <span>{backLabel}</span>
          </button>
        )}

        <div className="flex items-center justify-between gap-3">
          <h1 className="text-[34px] leading-tight font-bold tracking-tight text-label truncate">{title}</h1>
          <button
            onClick={onOpenSettings}
            aria-label="Abrir ajustes"
            className="w-10 h-10 shrink-0 rounded-full bg-fill-tertiary text-label flex items-center justify-center active:scale-90 transition-transform"
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>

        {showSearch && (
          <div className="mt-3 space-y-3">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-label-secondary" />
                <input
                  type="search"
                  inputMode="search"
                  enterKeyHint="search"
                  value={searchQuery}
                  onChange={(e) => onSearchChange(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Artistas, Músicas, Letras e Mais"
                  aria-label="Buscar"
                  className="w-full h-11 pl-10 pr-16 rounded-xl bg-fill-tertiary text-label placeholder:text-label-secondary text-[17px] focus:outline-none focus:ring-2 focus:ring-accent/60 transition-all"
                />
                <div className="absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center gap-2 text-label-secondary">
                  <Mic className="w-4 h-4" />
                  {searchQuery && (
                    <button
                      onClick={() => onSearchChange('')}
                      className="w-5 h-5 rounded-full bg-label-secondary/30 text-white flex items-center justify-center hover:bg-label-secondary/50"
                      aria-label="Limpar busca"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>

              {searchScope === 'online' && searchQuery.trim() && (
                <button
                  onClick={onSubmitOnlineSearch}
                  disabled={isSearchingOnline}
                  className="h-11 px-4 rounded-xl bg-accent hover:bg-accent-pressed disabled:opacity-50 text-white text-[15px] font-semibold flex items-center gap-1.5 shrink-0 active:scale-95 transition-all"
                >
                  {isSearchingOnline ? <Loader2 className="w-4 h-4 animate-spin" /> : <span>Buscar</span>}
                </button>
              )}
            </div>

            {/* Apple Music style scope toggle pills */}
            <div className="grid grid-cols-2 gap-2 p-1 bg-fill-tertiary rounded-xl">
              <button
                onClick={() => onSearchScopeChange('online')}
                className={`py-2 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition-all ${
                  searchScope === 'online'
                    ? 'bg-segment text-label shadow-md'
                    : 'text-label-secondary hover:text-label'
                }`}
              >
                <span>Apple Music</span>
              </button>
              <button
                onClick={() => onSearchScopeChange('catalog')}
                className={`py-2 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition-all ${
                  searchScope === 'catalog'
                    ? 'bg-segment text-label shadow-md'
                    : 'text-label-secondary hover:text-label'
                }`}
              >
                <span>Biblioteca</span>
              </button>
            </div>
          </div>
        )}
      </header>
    </>
  );
};
