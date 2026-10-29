import React from 'react';
import { useAudio } from '../context/AudioContext';

/** What plays after the current track, in the queue's order; a tap plays that track. */
export const QueueList: React.FC = () => {
  const { queue, currentIndex, playTrack, radioStation } = useAudio();
  const upcoming = queue.slice(currentIndex + 1, currentIndex + 51);

  return (
    <div role="region" aria-label="Fila de reprodução" className="absolute inset-0 overflow-y-auto text-left no-scrollbar">
      <h3 className="pb-2 text-[17px] font-bold text-label">{radioStation ? `Rádio ${radioStation.name}` : 'Continue tocando'}</h3>
      {upcoming.length === 0 ? (
        <p className="text-[15px] text-label-secondary">Não há mais faixas a seguir.</p>
      ) : (
        <ul>
          {upcoming.map((track, idx) => (
            <li key={`${track.id}-${idx}`}>
              <button onClick={() => playTrack(track)} className="flex w-full items-center gap-3 py-2 text-left active:opacity-60">
                <img
                  src={track.coverUrl}
                  alt=""
                  referrerPolicy="no-referrer"
                  className="h-12 w-12 shrink-0 rounded-md bg-elevated-2 object-cover"
                  onError={(e) => {
                    (e.currentTarget as HTMLElement).style.visibility = 'hidden';
                  }}
                />
                <span className="min-w-0">
                  <span className="block truncate text-[16px] text-label">{track.title}</span>
                  <span className="block truncate text-[14px] text-label-secondary">{track.artist}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
