import React from 'react';
import type { AlbumSummary } from '../types/music';
import { historicAlbumSummary, historicCoverUrl, type HistoricEntry } from '../utils/historicCatalog';
import { CdCover } from './CdCover';

/**
 * The CDs a search names, as a row of covers like the "Álbuns" and "Playlists" rows: tapping one opens its album page.
 * A CD without artwork in the catalog shows the disc.
 */
export const HistoricCdsRow: React.FC<{ entries: HistoricEntry[]; onOpen: (album: AlbumSummary) => void }> = ({ entries, onOpen }) => {
  if (entries.length === 0) return null;
  return (
    <section aria-label="CDs históricos" className="px-4 pb-2">
      <h2 className="text-[22px] font-bold text-label tracking-tight mb-2">CDs históricos</h2>
      <div className="flex gap-4 overflow-x-auto">
        {entries.map((entry) => (
          <button
            key={entry.id}
            onClick={() => onOpen(historicAlbumSummary(entry))}
            className="flex w-32 shrink-0 flex-col gap-1.5 text-left active:opacity-60"
          >
            <CdCover url={historicCoverUrl(entry.mbid)} alt="" className="h-32 w-32 rounded-cover shadow-md" iconClassName="h-10 w-10 text-white/70" />
            <span className="w-full truncate text-[13px] font-medium text-label">{entry.title}</span>
            <span className="w-full truncate text-[11px] text-label-secondary">
              {entry.year ? `${entry.year} · Som Livre` : 'Som Livre'}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
};
