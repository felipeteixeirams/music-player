import React from 'react';
import { MixArt, mixBackground } from './MixArt';
import { PlayShuffleButtons } from './PlayShuffleButtons';
import { TrackList } from './TrackList';
import { useAudio } from '../context/AudioContext';
import type { PersonalMix } from '../utils/personalMixes';

/** One personal mix opened: its colored header, Reproduzir and Aleatório, and the tracks. */
export const MixScreen: React.FC<{ mix: PersonalMix }> = ({ mix }) => {
  const { playTrack } = useAudio();
  return (
    <div className="space-y-4" data-testid="mix-page">
      <div className="mx-4 flex items-center gap-4 overflow-hidden rounded-sheet p-4 text-white" style={{ background: mixBackground(mix.colors) }}>
        <MixArt kind={mix.id} className="h-20 w-20 shrink-0" />
        <div className="min-w-0">
          <p className="text-[13px] text-white/70">{mix.label}</p>
          <p className="text-[15px] leading-snug text-white/95">{mix.description}</p>
        </div>
      </div>
      <PlayShuffleButtons tracks={mix.tracks} />
      <TrackList tracks={mix.tracks} emptyMessage="Esta lista está vazia." onTrackSelect={(track) => playTrack(track, mix.tracks)} />
    </div>
  );
};
