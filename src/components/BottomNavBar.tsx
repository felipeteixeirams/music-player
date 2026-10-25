import React from 'react';
import { Home, Search, Library, Compass } from 'lucide-react';

interface BottomNavBarProps {
  activeTab: 'home' | 'search' | 'library' | 'explore';
  onSelectTab: (tab: 'home' | 'search' | 'library' | 'explore') => void;
}

export const BottomNavBar: React.FC<BottomNavBarProps> = ({ activeTab, onSelectTab }) => {
  const tabs = [
    { id: 'home' as const, label: 'Início', icon: Home },
    { id: 'search' as const, label: 'Buscar', icon: Search },
    { id: 'explore' as const, label: 'Navegar', icon: Compass },
    { id: 'library' as const, label: 'Biblioteca', icon: Library }
  ];

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-30 bg-[#090912]/95 backdrop-blur-2xl border-t border-white/[0.08] px-2 pt-2 pb-[calc(var(--safe-bottom)+0.5rem)] max-w-xl md:max-w-2xl mx-auto"
      aria-label="Navegação Principal"
    >
      <div className="flex items-center justify-around">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => onSelectTab(tab.id)}
              className={`flex flex-col items-center gap-1 px-4 py-1.5 rounded-2xl transition-all active:scale-90 ${
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
