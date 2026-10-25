import React from 'react';
import { Home, Search, Library, Radio } from 'lucide-react';

export type AppTab = 'home' | 'radio' | 'library' | 'search';

interface BottomNavBarProps {
  activeTab: AppTab;
  onSelectTab: (tab: AppTab) => void;
  /** Collapsed to icons while the page scrolls down. */
  compact?: boolean;
  /** Called when a tap should bring the full bar back. */
  onExpand?: () => void;
}

export const BottomNavBar: React.FC<BottomNavBarProps> = ({ activeTab, onSelectTab, compact = false, onExpand }) => {
  const tabs = [
    { id: 'home' as const, label: 'Início', icon: Home },
    { id: 'radio' as const, label: 'Rádio', icon: Radio },
    { id: 'library' as const, label: 'Biblioteca', icon: Library },
    { id: 'search' as const, label: 'Buscar', icon: Search }
  ];

  return (
    <nav
      className={`fixed bottom-0 left-0 right-0 z-30 material-thick hairline-top px-2 pt-1 max-w-xl md:max-w-2xl mx-auto transition-[height] duration-300 motion-reduce:transition-none ${compact ? 'h-[calc(3rem+var(--safe-bottom))]' : 'h-[calc(4.25rem+var(--safe-bottom))]'}`}
      aria-label="Navegação Principal"
    >
      <div className="grid grid-cols-4 items-center">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => {
                onSelectTab(tab.id);
                onExpand?.();
              }}
              aria-current={isActive ? 'page' : undefined}
              className={`flex flex-col items-center px-1 py-1.5 rounded-2xl transition-all active:scale-90 ${
                isActive ? 'text-accent font-semibold' : 'text-label-secondary hover:text-label'
              }`}
            >
              <Icon className={`w-6 h-6 ${isActive ? 'scale-105' : ''}`} />
              <span
                className={`text-[10px] tracking-tight overflow-hidden transition-all duration-300 motion-reduce:transition-none ${
                  compact ? 'max-h-0 opacity-0' : 'max-h-4 opacity-100 mt-1'
                }`}
              >
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
