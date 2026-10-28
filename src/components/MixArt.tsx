import React from 'react';
import { Heart, History, Radio } from 'lucide-react';
import type { MixKind } from '../utils/personalMixes';

/** The four-pointed star of "made for you" cards, drawn as an outline like the Apple Music ones. */
const Star: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="1.6" className={className} aria-hidden="true">
    <path d="M50 4C54 32 68 46 96 50C68 54 54 68 50 96C46 68 32 54 4 50C32 46 46 32 50 4Z" strokeLinejoin="round" />
  </svg>
);

/** The large outline drawing of a mix (its card and its page). */
export const MixArt: React.FC<{ kind: MixKind; className?: string }> = ({ kind, className = 'h-36 w-36' }) => {
  const cls = `${className} text-white/45`;
  if (kind === 'discovery') return <Radio className={cls} strokeWidth={1.2} aria-hidden="true" />;
  if (kind === 'favorites') return <Heart className={cls} strokeWidth={1.2} aria-hidden="true" />;
  if (kind === 'rediscover') return <History className={cls} strokeWidth={1.2} aria-hidden="true" />;
  return <Star className={cls} />;
};

export const mixBackground = (colors: [string, string]): string => `linear-gradient(160deg, ${colors[0]} 0%, ${colors[1]} 100%)`;
