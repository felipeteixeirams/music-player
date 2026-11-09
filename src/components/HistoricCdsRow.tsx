import React from 'react';
import { Disc3 } from 'lucide-react';
import type { AlbumSummary } from '../types/music';
import { historicAlbumSummary, type HistoricEntry } from '../utils/historicCatalog';

/**
 * The CDs a search names, as a row of covers like the "Álbuns" and "Playlists" rows: tapping one opens its album page.
 * The CDs of the historic catalog have no artwork, so each shows the disc.
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
            <div className="flex h-32 w-32 items-center justify-center rounded-cover bg-gradient-to-br from-amber-600/30 via-red-950/40 to-black shadow-md">
              <Disc3 className="h-10 w-10 text-white/70" aria-hidden="true" />
            </div>
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
