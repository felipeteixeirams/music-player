import React from 'react';
import { Play, Shuffle } from 'lucide-react';
import { useAudio } from '../context/AudioContext';
import type { Track } from '../types/music';
import type { QueueSource } from '../utils/queueSource';

const BUTTON = 'flex items-center justify-center gap-2 rounded-card bg-fill-tertiary py-2.5 text-[17px] font-semibold text-accent active:scale-[0.97] transition-transform disabled:opacity-40';

/**
 * Reproduzir and Aleatório of an artist, an album or a collection: the same two buttons under the header.
 * A collection passes its `source` so the queue keeps loading the pages after the ones already shown.
 */
export const PlayShuffleButtons: React.FC<{ tracks: Track[]; source?: QueueSource }> = ({ tracks, source }) => {
  const { playTrack, isShuffle, toggleShuffle } = useAudio();
  return (
    <div className="grid grid-cols-2 gap-3 px-4">
      <button onClick={() => tracks[0] && playTrack(tracks[0], tracks, source)} disabled={tracks.length === 0} className={BUTTON}>
        <Play className="h-4 w-4 fill-current" aria-hidden="true" />
        <span>Reproduzir</span>
      </button>
      <button
        onClick={() => {
          if (tracks.length === 0) return;
          if (!isShuffle) toggleShuffle();
          playTrack(tracks[Math.floor(Math.random() * tracks.length)], tracks, source);
        }}
        disabled={tracks.length === 0}
        className={BUTTON}
      >
        <Shuffle className="h-4 w-4" aria-hidden="true" />
        <span>Aleatório</span>
      </button>
    </div>
  );
};
