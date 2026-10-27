import React from 'react';
import { Play, Shuffle } from 'lucide-react';
import { useAudio } from '../context/AudioContext';
import type { Track } from '../types/music';

const BUTTON = 'flex items-center justify-center gap-2 rounded-card bg-fill-tertiary py-2.5 text-[17px] font-semibold text-accent active:scale-[0.97] transition-transform disabled:opacity-40';

/** Reproduzir and Aleatório of an artist or an album: the same two buttons under the Apple Music header. */
export const PlayShuffleButtons: React.FC<{ tracks: Track[] }> = ({ tracks }) => {
  const { playTrack, isShuffle, toggleShuffle } = useAudio();
  return (
    <div className="grid grid-cols-2 gap-3 px-4">
      <button onClick={() => tracks[0] && playTrack(tracks[0], tracks)} disabled={tracks.length === 0} className={BUTTON}>
        <Play className="h-4 w-4 fill-current" aria-hidden="true" />
        <span>Reproduzir</span>
      </button>
      <button
        onClick={() => {
          if (tracks.length === 0) return;
          if (!isShuffle) toggleShuffle();
          playTrack(tracks[Math.floor(Math.random() * tracks.length)], tracks);
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
