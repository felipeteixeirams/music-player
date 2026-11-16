import React from 'react';
import { ListEnd, ListPlus } from 'lucide-react';
import { useAudio } from '../context/AudioContext';
import type { Track } from '../types/music';

/**
 * The actions of one track in a list (INV-PLAY-28): play it next, or add it to the end of the queue. Opened from the
 * "Mais ações" button of a row; it closes after the action.
 */
export const TrackActionsSheet: React.FC<{ track: Track; onClose: () => void }> = ({ track, onClose }) => {
  const { addNextToQueue, addToQueue } = useAudio();
  const run = (action: (track: Track) => void) => {
    action(track);
    onClose();
  };
  const ROW = 'flex w-full items-center gap-3 rounded-card bg-fill-tertiary px-4 py-3 text-left text-[16px] font-semibold text-label active:scale-[0.98] transition-transform';

  return (
    <div className="fixed inset-0 z-[60] bg-black/40 animate-in fade-in" onClick={onClose}>
      <div
        role="dialog"
        aria-label={`Ações de ${track.title}`}
        className="absolute bottom-0 inset-x-0 mx-auto max-w-xl rounded-t-sheet px-4 pt-4 pb-[calc(var(--safe-bottom)+1rem)] text-left text-label animate-in slide-in-from-bottom duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="absolute inset-0 -z-10 rounded-t-sheet material-thick" aria-hidden="true" />
        <div className="pb-3 min-w-0">
          <p className="truncate text-[15px] font-semibold text-label">{track.title}</p>
          <p className="truncate text-[13px] text-label-secondary">{track.artist}</p>
        </div>
        <div className="space-y-2">
          <button onClick={() => run(addNextToQueue)} className={ROW}>
            <ListPlus className="h-5 w-5 text-accent" aria-hidden="true" />
            <span>Tocar a seguir</span>
          </button>
          <button onClick={() => run(addToQueue)} className={ROW}>
            <ListEnd className="h-5 w-5 text-accent" aria-hidden="true" />
            <span>Adicionar à fila</span>
          </button>
          <button onClick={onClose} className="w-full rounded-card py-3 text-[16px] font-semibold text-accent">
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
};
