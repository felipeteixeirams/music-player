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
        return <Disc3 className="w-5 h-5 text-accent" />;
      case 'alternative-pop':
        return <Flame className="w-5 h-5 text-accent" />;
      case 'lofi-chill':
        return <Moon className="w-5 h-5 text-accent" />;
      case 'synthwave':
        return <Radio className="w-5 h-5 text-accent" />;
      default:
        return <Disc3 className="w-5 h-5 text-accent" />;
    }
  };

  return (
    <section className="px-4 py-3" aria-labelledby="categories-heading">
      <div className="flex items-center justify-between mb-3">
        <h2 id="categories-heading" className="text-[22px] font-bold text-label tracking-tight">
          Explorar Categorias
        </h2>
        <span className="text-[13px] text-label-secondary">
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
              className={`relative overflow-hidden p-4 rounded-card text-left transition-all active:scale-[0.97] group ${
                isSelected
                  ? 'bg-elevated-2 ring-2 ring-accent'
                  : 'bg-elevated hover:bg-elevated-2'
              }`}
            >
              {/* Subtle ambient background glow */}
              <div
                className={`absolute -right-4 -bottom-4 w-20 h-20 rounded-full blur-2xl opacity-25 bg-gradient-to-br ${category.gradient}`}
              />

              <div className="relative z-10 flex flex-col justify-between h-20">
                <div className="flex items-center justify-between">
                  <div className="w-8 h-8 rounded-lg bg-fill-tertiary flex items-center justify-center group-hover:scale-105 transition-transform">
                    {getCategoryIcon(category.id)}
                  </div>
                  <span className="text-[13px] text-label-secondary tabular-nums">
                    {trackCount ? `${trackCount} faixas` : 'Em alta'}
                  </span>
                </div>

                <div>
                  <h3 className="text-[15px] font-semibold text-label tracking-tight">
                    {category.name}
                  </h3>
                  <p className="text-[13px] text-label-secondary line-clamp-1 mt-0.5">
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
