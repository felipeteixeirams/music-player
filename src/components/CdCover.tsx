import React, { useEffect, useState } from 'react';
import { Disc } from 'lucide-react';
import { RemoteImage } from './RemoteImage';

interface CdCoverProps {
  url?: string;
  alt?: string;
  className?: string;
  iconClassName?: string;
}

/**
 * Renders the CD artwork or an authentic retro CD disc fallback when there is no cover image.
 */
export const CdCover: React.FC<CdCoverProps> = ({
  url,
  alt = 'Capa do CD',
  className = 'h-32 w-32 rounded-2xl',
  iconClassName = 'h-12 w-12 text-white/70'
}) => {
  const [imgFailed, setImgFailed] = useState(false);
  // Another CD's cover starts over (the list reuses this component)
  useEffect(() => setImgFailed(false), [url]);

  if (url && !imgFailed) {
    return (
      <RemoteImage
        src={url}
        alt={alt}
        referrerPolicy="no-referrer"
        placeholder={null}
        onError={() => setImgFailed(true)}
        className={`object-cover bg-fill-tertiary ${className}`}
      />
    );
  }

  return (
    <div
      role="img"
      aria-label={alt}
      className={`relative flex items-center justify-center overflow-hidden bg-gradient-to-tr from-zinc-900 via-zinc-800 to-zinc-950 shadow-inner select-none ${className}`}
    >
      {/* Vinyl/CD Groove Rings */}
      <div className="absolute inset-2 rounded-full border border-white/[0.07] pointer-events-none" />
      <div className="absolute inset-4 rounded-full border border-white/[0.06] pointer-events-none" />
      <div className="absolute inset-7 rounded-full border border-white/[0.05] pointer-events-none" />

      {/* Holographic Refraction Sheen */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/[0.12] via-transparent to-white/[0.04] pointer-events-none" />

      {/* Clear Hub Ring */}
      <div className="absolute inset-[30%] rounded-full border border-white/20 bg-zinc-800/40 backdrop-blur-xs flex items-center justify-center pointer-events-none">
        {/* Center Spindle Hole */}
        <div className="h-6 w-6 rounded-full bg-zinc-950/90 ring-1 ring-white/20 shadow-inner flex items-center justify-center" />
      </div>

      {/* Retro Disc Icon */}
      <Disc className={`relative z-10 animate-[spin_16s_linear_infinite] opacity-60 ${iconClassName}`} aria-hidden="true" />
    </div>
  );
};
