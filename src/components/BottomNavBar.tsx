import React from 'react';
import { Home, Search, Library, Radio } from 'lucide-react';

export type AppTab = 'home' | 'radio' | 'library' | 'search';

interface BottomNavBarProps {
  activeTab: AppTab;
  onSelectTab: (tab: AppTab) => void;
}

export const BottomNavBar: React.FC<BottomNavBarProps> = ({ activeTab, onSelectTab }) => {
  const tabs = [
    { id: 'home' as const, label: 'Início', icon: Home },
    { id: 'radio' as const, label: 'Rádio', icon: Radio },
    { id: 'library' as const, label: 'Biblioteca', icon: Library },
    { id: 'search' as const, label: 'Buscar', icon: Search }
  ];

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-30 bg-[#090912]/95 backdrop-blur-2xl border-t border-white/[0.08] px-2 pt-2 pb-[calc(var(--safe-bottom)+0.5rem)] max-w-xl md:max-w-2xl mx-auto"
      aria-label="Navegação Principal"
    >
      <div className="grid grid-cols-4 items-center">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => onSelectTab(tab.id)}
              aria-current={isActive ? 'page' : undefined}
              className={`flex flex-col items-center gap-1 px-1 py-1.5 rounded-2xl transition-all active:scale-90 ${
                isActive ? 'text-purple-400 font-semibold' : 'text-white/50 hover:text-white/80'
              }`}
            >
              <Icon className={`w-5 h-5 ${isActive ? 'scale-110 text-purple-400' : ''}`} />
              <span className="text-[10px] tracking-tight">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
