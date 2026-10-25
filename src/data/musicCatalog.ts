import { Category } from '../types/music';

/**
 * Home categories. Each one is backed by a curated Deezer playlist chosen to match its name and
 * description (see api/_categories.ts): change a description only together with the playlist behind it.
 */
export const CATEGORIES: Category[] = [
  {
    id: 'top-hits',
    name: 'Top Hits',
    description: 'As músicas mais tocadas no Brasil agora',
    gradient: 'from-purple-600/30 to-pink-900/30',
    accentColor: '#ec4899'
  },
  {
    id: 'classic-rock',
    name: 'Classic Rock',
    description: 'Hinos atemporais que moldaram a história do rock mundial',
    gradient: 'from-amber-600/30 to-red-900/30',
    accentColor: '#f59e0b'
  },
  {
    id: 'alternative-pop',
    name: 'Alternative & Indie',
    description: 'Indie e alternativo de hoje: guitarras modernas e refrões marcantes',
    gradient: 'from-pink-600/30 to-indigo-900/30',
    accentColor: '#a855f7'
  },
  {
    id: 'lofi-chill',
    name: 'Lofi Chill',
    description: 'Batidas lo-fi suaves e relaxantes para estudar e focar',
    gradient: 'from-blue-600/30 to-indigo-900/30',
    accentColor: '#3b82f6'
  },
  {
    id: 'synthwave',
    name: 'Synthwave & Retrowave',
    description: 'Sintetizadores analógicos dos anos 80 e estética futurista',
    gradient: 'from-fuchsia-600/30 to-cyan-900/30',
    accentColor: '#06b6d4'
  }
];

export function getCategoryById(id: string): Category | undefined {
  return CATEGORIES.find((cat) => cat.id === id);
}
