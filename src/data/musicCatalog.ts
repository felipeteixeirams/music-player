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
    id: 'sertanejo',
    name: 'Sertanejo',
    description: 'Os maiores sucessos do sertanejo agora',
    gradient: 'from-amber-600/30 to-orange-900/30',
    accentColor: '#f59e0b'
  },
  {
    id: 'pagode',
    name: 'Pagode e Samba',
    description: 'Essenciais do pagode e do samba para a roda',
    gradient: 'from-emerald-600/30 to-teal-900/30',
    accentColor: '#10b981'
  },
  {
    id: 'funk',
    name: 'Funk',
    description: 'O funk que está tocando nos bailes e no paredão',
    gradient: 'from-fuchsia-600/30 to-purple-900/30',
    accentColor: '#d946ef'
  },
  {
    id: 'forro',
    name: 'Forró',
    description: 'Forró e piseiro para dançar agarradinho',
    gradient: 'from-yellow-600/30 to-red-900/30',
    accentColor: '#eab308'
  },
  {
    id: 'mpb',
    name: 'MPB',
    description: 'Clássicos da música popular brasileira',
    gradient: 'from-green-600/30 to-emerald-900/30',
    accentColor: '#22c55e'
  },
  {
    id: 'gospel',
    name: 'Gospel',
    description: 'Os louvores mais ouvidos do momento',
    gradient: 'from-sky-600/30 to-blue-900/30',
    accentColor: '#0ea5e9'
  },
  {
    id: 'pop-internacional',
    name: 'Pop Internacional',
    description: 'Os hits internacionais que todo mundo canta',
    gradient: 'from-rose-600/30 to-pink-900/30',
    accentColor: '#f43f5e'
  },
  {
    id: 'hip-hop',
    name: 'Rap e Hip Hop',
    description: 'Essenciais do rap brasileiro',
    gradient: 'from-slate-600/30 to-zinc-900/30',
    accentColor: '#94a3b8'
  },
  {
    id: 'eletronica',
    name: 'Eletrônica',
    description: 'Dance, house e batidas para animar',
    gradient: 'from-cyan-600/30 to-blue-900/30',
    accentColor: '#06b6d4'
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
