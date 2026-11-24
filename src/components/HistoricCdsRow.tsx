import React from 'react';
import type { AlbumSummary } from '../types/music';
import { HISTORIC_ALBUM_PREFIX, historicCoverUrl, type HistoricEntry } from '../utils/historicCatalog';
import { CdCover } from './CdCover';

interface HistoricCdsRowProps {
  entries: HistoricEntry[];
  onOpen: (album: AlbumSummary) => void;
}

/**
 * Horizontal row of historic CD compilations shown in the search view when
 * the search query matches a known collection or compilation series.
 */
export const HistoricCdsRow: React.FC<HistoricCdsRowProps> = ({ entries, onOpen }) => {
  if (!entries || entries.length === 0) return null;

  return (
    <section role="region" aria-label="CDs históricos" className="px-4 pb-4">
      <h2 className="text-[22px] font-bold text-label tracking-tight mb-2">CDs Históricos</h2>
      <div className="flex gap-4 overflow-x-auto pb-1 scrollbar-none">
        {entries.map((entry) => {
          // The index keeps the MusicBrainz release, not the image address: the same address the album page uses
          const coverUrl = entry.coverUrl || historicCoverUrl(entry.mbid);
          const album: AlbumSummary = {
            id: `${HISTORIC_ALBUM_PREFIX}${entry.id}`,
            covers: entry.covers,
            title: entry.title,
            coverUrl,
            year: entry.year || 0,
            artist: entry.label || 'Som Livre',
            kind: 'album',
            trackCount: entry.tracks
          };

          return (
            <button
              key={entry.id}
              onClick={() => onOpen(album)}
              aria-label={entry.title}
              className="flex w-32 shrink-0 flex-col gap-1.5 text-left active:scale-[0.98] transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-2xl"
            >
              <div className="relative">
                <CdCover
                  url={coverUrl}
                  covers={entry.covers}
                  alt={`Capa de ${entry.title}`}
                  className="h-32 w-32 rounded-2xl object-cover bg-fill-tertiary shadow-md ring-1 ring-white/10"
                  iconClassName="h-12 w-12 text-white/70"
                />
              </div>
              <span className="w-full truncate text-[13px] font-medium text-label leading-tight">
                {entry.title}
              </span>
              <span className="w-full truncate text-[11px] text-label-secondary">
                {[entry.label || 'Coletânea', entry.year > 0 ? String(entry.year) : ''].filter(Boolean).join(' · ')}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
};
