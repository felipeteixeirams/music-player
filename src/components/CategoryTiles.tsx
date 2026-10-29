import React from 'react';
import { Podcast, Radio } from 'lucide-react';
import { CATEGORIES } from '../data/musicCatalog';
import type { TrackPage } from '../types/music';
import { RemoteImage } from './RemoteImage';

/** Tile color of each collection; the collection's first cover is laid over it as a duotone. */
const TILE_COLORS: Record<string, string> = {
  'top-hits': '#e8344b',
  sertanejo: '#d98b2b',
  pagode: '#2fa36b',
  funk: '#c43fd0',
  forro: '#d4a017',
  mpb: '#3f9b4f',
  gospel: '#3a8fd6',
  'pop-internacional': '#e0507a',
  'hip-hop': '#6b7a8f',
  eletronica: '#1fa3c4',
  'classic-rock': '#d98b2b',
  'alternative-pop': '#e0507a',
  'lofi-chill': '#5b7fe8',
  synthwave: '#8b4fd8'
};
const FALLBACK_COLOR = '#636366';

interface CategoryTilesProps {
  /** First page of each collection, from the home feed: the cover of its first track decorates the tile. */
  pages?: Record<string, TrackPage>;
  onSelectCategory: (categoryId: string) => void;
  onSelectRadio: () => void;
  onSelectPodcasts: () => void;
}

/** Browse grid of the Search tab: one tile per collection plus the radio, as in Apple Music. */
export const CategoryTiles: React.FC<CategoryTilesProps> = ({ pages, onSelectCategory, onSelectRadio, onSelectPodcasts }) => (
  <section className="px-4 py-2" aria-label="Explorar">
    <h2 className="text-[22px] font-bold text-label tracking-tight mb-3">Explorar tudo</h2>
    <div className="grid grid-cols-2 gap-3">
      <button
        onClick={onSelectPodcasts}
        className="relative overflow-hidden rounded-card aspect-[16/9] text-left bg-gradient-to-br from-[#b3182c] to-[#5a0f1c] active:scale-[0.97] transition-transform"
      >
        <Podcast className="absolute right-3 top-3 w-9 h-9 text-white/40" aria-hidden="true" />
        <span className="absolute left-3 bottom-2.5 text-[17px] font-semibold text-white">Podcasts</span>
      </button>

      <button
        onClick={onSelectRadio}
        className="relative overflow-hidden rounded-card aspect-[16/9] text-left bg-accent active:scale-[0.97] transition-transform"
      >
        <Radio className="absolute right-3 top-3 w-9 h-9 text-white/40" aria-hidden="true" />
        <span className="absolute left-3 bottom-2.5 text-[17px] font-semibold text-white">Rádio</span>
      </button>

      {CATEGORIES.map((category) => {
        const cover = pages?.[category.id]?.tracks[0]?.coverUrl;
        return (
          <button
            key={category.id}
            onClick={() => onSelectCategory(category.id)}
            className="relative overflow-hidden rounded-card aspect-[16/9] text-left active:scale-[0.97] transition-transform"
            style={{ backgroundColor: TILE_COLORS[category.id] ?? FALLBACK_COLOR }}
          >
            {cover && (
              <RemoteImage
                src={cover}
                alt=""
                referrerPolicy="no-referrer"
                loading="lazy"
                className="absolute inset-y-0 right-0 w-3/5 h-full object-cover grayscale contrast-125 mix-blend-multiply opacity-80"
              />
            )}
            <span className="absolute left-3 bottom-2.5 right-3 text-[17px] font-semibold leading-tight text-white drop-shadow">
              {category.name}
            </span>
          </button>
        );
      })}
    </div>
  </section>
);
