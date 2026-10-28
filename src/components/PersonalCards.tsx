import React, { useEffect } from 'react';
import { Music2 } from 'lucide-react';
import { MixArt, mixBackground } from './MixArt';
import { prefetchResolved, warmResolve } from '../utils/audioEngine';
import type { PersonalMix } from '../utils/personalMixes';

/** "Escolhidos para você": large cards of playlists made from what this person plays, the next one peeking in. */
export const PersonalCards: React.FC<{ mixes: PersonalMix[]; onOpen: (mix: PersonalMix) => void }> = ({ mixes, onOpen }) => {
  // The first tracks of each card are asked about in the shared cache, so tapping one starts without a wait
  useEffect(() => {
    prefetchResolved(mixes.flatMap((mix) => mix.tracks.slice(0, 5)));
    // The first two of each card are the ones most likely tapped: their videos are looked up ahead, in idle time
    warmResolve(mixes.flatMap((mix) => mix.tracks.slice(0, 2)));
  }, [mixes]);

  if (mixes.length === 0) return null;
  return (
    <section aria-label="Escolhidos para você" className="pt-3">
      <h2 className="px-4 pb-2 text-[22px] font-bold tracking-tight text-label">Escolhidos para você</h2>
      <div className="flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {mixes.map((mix) => (
          <button
            key={mix.id}
            onClick={() => onOpen(mix)}
            aria-label={`${mix.title}: ${mix.description}`}
            data-mix={mix.id}
            className="relative aspect-[3/4] w-[72vw] max-w-[272px] shrink-0 snap-start overflow-hidden rounded-[20px] text-left text-white shadow-xl shadow-black/25 transition-transform active:scale-[0.97]"
            style={{ background: mixBackground(mix.colors) }}
          >
            <span className="absolute right-4 top-4 flex items-center gap-1 text-[15px] font-semibold text-white/90">
              <Music2 className="h-4 w-4" aria-hidden="true" />
              AuraStream
            </span>
            <span className="absolute inset-x-0 top-[18%] flex justify-center">
              <MixArt kind={mix.id} />
            </span>
            <span className="absolute inset-x-4 bottom-4 block">
              <span className="block text-[15px] text-white/70">{mix.label}</span>
              <span className="mt-0.5 block text-[22px] font-bold leading-tight">{mix.title}</span>
              <span className="mt-1 line-clamp-3 block text-[15px] leading-snug text-white/90">{mix.description}</span>
            </span>
          </button>
        ))}
      </div>
    </section>
  );
};
