import { Category } from '../types/music';

export const CATEGORIES: Category[] = [
  {
    id: 'top-hits',
    name: 'Top Hits',
    description: 'As faixas mais tocadas e tendências do momento',
    gradient: 'from-purple-600/30 to-pink-900/30',
    accentColor: '#ec4899',
    searchQuery: 'Top Hits Brasil'
  },
  {
    id: 'classic-rock',
    name: 'Classic Rock',
    description: 'Hinos atemporais que moldaram a história do rock mundial',
    gradient: 'from-amber-600/30 to-red-900/30',
    accentColor: '#f59e0b',
    searchQuery: 'Classic Rock Hits'
  },
  {
    id: 'alternative-pop',
    name: 'Alternative Pop',
    description: 'Batidas épicas, guitarras modernas e refrões poderosos',
    gradient: 'from-pink-600/30 to-indigo-900/30',
    accentColor: '#a855f7',
    searchQuery: 'Alternative Pop Hits'
  },
  {
    id: 'lofi-chill',
    name: 'Lofi Chill',
    description: 'Texturas sonoras suaves, vinil e batidas relaxantes para foco',
    gradient: 'from-blue-600/30 to-indigo-900/30',
    accentColor: '#3b82f6',
    searchQuery: 'Lofi Chill Beats Study'
  },
  {
    id: 'synthwave',
    name: 'Synthwave & Retrowave',
    description: 'Sintetizadores analógicos dos anos 80 e estética futurista',
    gradient: 'from-fuchsia-600/30 to-cyan-900/30',
    accentColor: '#06b6d4',
    searchQuery: 'Synthwave 80s Retrowave'
  }
];

export function getCategoryById(id: string): Category | undefined {
  return CATEGORIES.find((cat) => cat.id === id);
}
