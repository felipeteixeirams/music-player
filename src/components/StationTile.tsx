import React from 'react';
import { stationColor, stationInitials } from '../utils/stationArt';

interface StationTileProps {
  name: string;
  /** Picks the tile color when there is no image. */
  seed: string;
  imageUrl?: string | null;
  /** Second line under the name. */
  label?: string;
  isCurrent: boolean;
  isPlaying: boolean;
  disabled?: boolean;
  ariaLabel: string;
  onClick: () => void;
}

/** A radio station as a square tile, as in Apple Music: its image, or a colored tile with its initials. */
export const StationTile: React.FC<StationTileProps> = ({
  name,
  seed,
  imageUrl,
  label,
  isCurrent,
  isPlaying,
  disabled,
  ariaLabel,
  onClick
}) => {
  const color = stationColor(seed);
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      aria-pressed={isCurrent}
      className="text-left min-w-0 active:scale-[0.97] transition-transform disabled:opacity-60"
    >
      <div
        className={`relative aspect-square w-full rounded-tile overflow-hidden shadow-lg shadow-black/30 ${
          isCurrent ? 'ring-2 ring-accent' : ''
        }`}
        style={imageUrl ? undefined : { background: `linear-gradient(145deg, ${color}, color-mix(in srgb, ${color} 55%, #000))` }}
      >
        {imageUrl ? (
          <img
            src={imageUrl}
            alt=""
            referrerPolicy="no-referrer"
            loading="lazy"
            decoding="async"
            className="w-full h-full object-cover"
          />
        ) : (
          <span
            className="absolute inset-0 flex items-center justify-center text-[34px] font-extrabold tracking-tight text-white/95"
            aria-hidden="true"
          >
            {stationInitials(name)}
          </span>
        )}
        {isCurrent && (
          <span className="absolute left-2 top-2 flex items-center gap-1 rounded-full material-ultrathin px-2 py-0.5 text-[10px] font-bold text-white">
            <span className={`w-1.5 h-1.5 rounded-full bg-accent ${isPlaying ? 'animate-pulse' : 'opacity-60'}`} aria-hidden="true" />
            {isPlaying ? 'TOCANDO' : 'PAUSADA'}
          </span>
        )}
      </div>
      <span className="mt-1.5 block text-[15px] font-medium text-label truncate">{name}</span>
      {label && <span className="block text-[13px] text-label-secondary truncate">{label}</span>}
    </button>
  );
};
