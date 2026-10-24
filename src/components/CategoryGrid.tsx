import React from 'react';
import { Disc3, Flame, Moon, Radio } from 'lucide-react';
import { CATEGORIES } from '../data/musicCatalog';
import { Category } from '../types/music';

interface CategoryGridProps {
  selectedCategoryId: string | null;
  onSelectCategory: (categoryId: string) => void;
  categoryCounts?: Record<string, number>;
}

export const CategoryGrid: React.FC<CategoryGridProps> = ({
  selectedCategoryId,
  onSelectCategory,
  categoryCounts
}) => {
  const getCategoryIcon = (id: string) => {
    switch (id) {
      case 'classic-rock':
        return <Disc3 className="w-5 h-5 text-amber-400" />;
      case 'alternative-pop':
        return <Flame className="w-5 h-5 text-pink-400" />;
      case 'lofi-chill':
        return <Moon className="w-5 h-5 text-blue-400" />;
      case 'synthwave':
        return <Radio className="w-5 h-5 text-cyan-400" />;
      default:
        return <Disc3 className="w-5 h-5 text-purple-400" />;
    }
  };

  return (
    <section className="px-4 py-3" aria-labelledby="categories-heading">
      <div className="flex items-center justify-between mb-3">
        <h2 id="categories-heading" className="text-sm font-bold text-white tracking-tight">
          Explorar Categorias
        </h2>
        <span className="text-xs text-white/40">
          {CATEGORIES.length} coleções
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {CATEGORIES.map((category: Category) => {
          const trackCount = categoryCounts?.[category.id];
          const isSelected = selectedCategoryId === category.id;

          return (
            <button
              key={category.id}
              onClick={() => onSelectCategory(isSelected ? 'all' : category.id)}
              className={`relative overflow-hidden p-4 rounded-3xl text-left border transition-all active:scale-[0.97] group ${
                isSelected
                  ? 'bg-gradient-to-br from-purple-600/40 via-pink-600/20 to-purple-900/40 border-purple-400/60 shadow-lg shadow-purple-950/40 ring-1 ring-purple-400/50'
                  : 'bg-white/[0.03] hover:bg-white/[0.06] border-white/[0.08]'
              }`}
            >
              {/* Subtle ambient background glow */}
              <div
                className={`absolute -right-4 -bottom-4 w-20 h-20 rounded-full blur-2xl opacity-40 bg-gradient-to-br ${category.gradient}`}
              />

              <div className="relative z-10 flex flex-col justify-between h-20">
                <div className="flex items-center justify-between">
                  <div className="w-8 h-8 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/10 group-hover:scale-105 transition-transform">
                    {getCategoryIcon(category.id)}
                  </div>
                  <span className="text-[11px] text-white/50 tabular-nums">
                    {trackCount ? `${trackCount} faixas` : 'Em alta'}
                  </span>
                </div>

                <div>
                  <h3 className="text-xs font-bold text-white tracking-tight">
                    {category.name}
                  </h3>
                  <p className="text-[10px] text-white/50 line-clamp-1 mt-0.5">
                    {category.description}
                  </p>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
};
