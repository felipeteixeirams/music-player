import React, { useState } from 'react';
import { Disc3 } from 'lucide-react';
import { RemoteImage } from './RemoteImage';

/**
 * The cover of a historic CD: the artwork when the catalog has it and it loads, otherwise the disc in the same frame.
 * Images load lazily, only where the row or the page shows them, so the catalog costs nothing until it is opened.
 */
export const CdCover: React.FC<{ url: string; className: string; iconClassName: string; alt: string }> = ({
  url,
  className,
  iconClassName,
  alt
}) => {
  const [failed, setFailed] = useState(false);
  if (!url || failed) {
    return (
      <div className={`${className} flex items-center justify-center bg-gradient-to-br from-accent/40 via-elevated-2 to-canvas`}>
        <Disc3 className={iconClassName} aria-hidden="true" />
      </div>
    );
  }
  return (
    <RemoteImage
      src={url}
      alt={alt}
      referrerPolicy="no-referrer"
      loading="lazy"
      decoding="async"
      className={`${className} object-cover bg-fill-tertiary`}
      onError={() => setFailed(true)}
    />
  );
};
