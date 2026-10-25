import React from 'react';
import { Home, Search, Library, Radio } from 'lucide-react';

export type AppTab = 'home' | 'radio' | 'library' | 'search';

interface BottomNavBarProps {
  activeTab: AppTab;
  onSelectTab: (tab: AppTab) => void;
  /** Collapsed while the page scrolls down. */
  compact?: boolean;
  /** Called when a tap should bring the full bar back. */
  onExpand?: () => void;
  /** The mini player: floats above the bar, or sits between two round buttons when the bar is collapsed. */
  miniPlayer?: React.ReactNode;
  /** Playback notice shown above the mini player. */
  notice?: React.ReactNode;
}

const TABS = [
  { id: 'home' as const, label: 'Início', icon: Home },
  { id: 'radio' as const, label: 'Rádio', icon: Radio },
  { id: 'library' as const, label: 'Biblioteca', icon: Library },
  { id: 'search' as const, label: 'Buscar', icon: Search }
];

const GLASS = 'material-regular ring-[0.5px] ring-separator shadow-xl shadow-black/30';

export const BottomNavBar: React.FC<BottomNavBarProps> = ({
  activeTab,
  onSelectTab,
  compact = false,
  onExpand,
  miniPlayer,
  notice
}) => {
  const select = (tab: AppTab) => {
    onSelectTab(tab);
    onExpand?.();
  };

  // Collapsed with something playing: the current tab, the mini player and search share one row, as in Apple Music
  if (compact && miniPlayer) {
    const Current = TABS.find((tab) => tab.id === activeTab)?.icon ?? Home;
    return (
      <div className="fixed inset-x-0 bottom-[max(0.5rem,calc(var(--safe-bottom)-0.8rem))] z-40 mx-auto max-w-xl md:max-w-2xl px-[21px] pointer-events-none">
        <div className="flex items-center gap-2 pointer-events-auto animate-in fade-in duration-200 motion-reduce:animate-none">
          <button
            onClick={() => onExpand?.()}
            aria-label="Mostrar a navegação"
            className={`w-12 h-12 shrink-0 rounded-full flex items-center justify-center text-accent active:scale-90 transition-transform ${GLASS}`}
          >
            <Current className="w-6 h-6 fill-current" />
          </button>
          <div className="flex-1 min-w-0">{miniPlayer}</div>
          <button
            onClick={() => select('search')}
            aria-label="Buscar"
            aria-current={activeTab === 'search' ? 'page' : undefined}
            className={`w-12 h-12 shrink-0 rounded-full flex items-center justify-center active:scale-90 transition-transform ${GLASS} ${
              activeTab === 'search' ? 'text-accent' : 'text-label'
            }`}
          >
            <Search className="w-6 h-6" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-x-0 bottom-[max(0.5rem,calc(var(--safe-bottom)-0.8rem))] z-40 mx-auto max-w-xl md:max-w-2xl px-[21px] pointer-events-none">
      <div className="flex flex-col gap-2 pointer-events-auto">
        {notice}
        {miniPlayer}
        <nav
          className={`rounded-full px-1.5 flex items-center transition-[height] duration-300 motion-reduce:transition-none ${GLASS} ${
            compact ? 'h-14' : 'h-[3.875rem]'
          }`}
          aria-label="Navegação Principal"
        >
          <div className="relative grid grid-cols-4 items-center w-full">
            {/*
              One pill behind the active tab that slides to the next one instead of each tab painting its own:
              the four columns are equal, so moving by whole widths of itself lands on the chosen tab. A spring-like
              curve with a slight overshoot, as the selection does in Apple Music; none for people who ask for less motion.
            */}
            <span
              aria-hidden="true"
              className="absolute inset-y-0 left-0 w-1/4 px-0.5 flex items-center pointer-events-none transition-transform duration-[450ms] ease-[cubic-bezier(0.3,1.25,0.5,1)] motion-reduce:transition-none"
              style={{ transform: `translateX(${Math.max(0, TABS.findIndex((tab) => tab.id === activeTab)) * 100}%)` }}
            >
              <span
                className={`w-full rounded-full bg-tab-active transition-[height] duration-300 motion-reduce:transition-none ${
                  compact ? 'h-11' : 'h-[3.25rem]'
                }`}
              />
            </span>
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;

              return (
                <button
                  key={tab.id}
                  onClick={() => select(tab.id)}
                  aria-current={isActive ? 'page' : undefined}
                  aria-label={tab.label}
                  className={`relative flex flex-col items-center justify-center rounded-full active:scale-90 transition-[color,transform,height] duration-300 motion-reduce:transition-none ${
                    compact ? 'h-11' : 'h-[3.25rem]'
                  } ${isActive ? 'text-accent font-semibold' : 'text-label hover:text-label-secondary'}`}
                >
                  <Icon className={`w-6 h-6 transition-transform duration-300 motion-reduce:transition-none ${isActive ? 'fill-current scale-110' : ''}`} />
                  <span
                    className={`text-[10px] tracking-tight overflow-hidden transition-all duration-300 motion-reduce:transition-none ${
                      compact ? 'max-h-0 opacity-0' : 'max-h-4 opacity-100 mt-0.5'
                    }`}
                  >
                    {tab.label}
                  </span>
                </button>
              );
            })}
          </div>
        </nav>
      </div>
    </div>
  );
};
