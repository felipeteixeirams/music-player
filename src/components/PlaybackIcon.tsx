import React from 'react';
import { Pause, Play } from 'lucide-react';
import { useAudio } from '../context/AudioContext';

export type PlaybackState = 'playing' | 'paused' | 'loading';

/**
 * What a play button shows for a track: the music is coming out (pause icon), it is stopped (play icon) or it was asked
 * for and has not started yet (a circular activity ring, as on the iPhone's own players). The icons cross-fade and
 * scale into each other, so a start, a pause and a wait read as one control changing state.
 */
export function usePlaybackState(trackId?: string): PlaybackState {
  const { currentTrack, isPlaying, isBuffering } = useAudio();
  if (trackId !== undefined && currentTrack?.id !== trackId) return 'paused';
  if (isBuffering) return 'loading';
  return isPlaying ? 'playing' : 'paused';
}

/** The label of a button that starts and stops the music (it says "loading" while the track starts). */
export const playbackLabel = (state: PlaybackState, labels: { pause: string; play: string; loading: string }): string =>
  state === 'loading' ? labels.loading : state === 'playing' ? labels.pause : labels.play;

const layer = (visible: boolean) =>
  `absolute inset-0 m-auto transition-all duration-200 ease-out ${visible ? 'opacity-100 scale-100' : 'opacity-0 scale-50'}`;

interface PlaybackIconProps {
  state: PlaybackState;
  /** Size classes, e.g. "w-6 h-6". */
  className?: string;
  /** Nudges the play triangle so it looks centered (it is not symmetrical). */
  playOffset?: string;
}

export const PlaybackIcon: React.FC<PlaybackIconProps> = ({ state, className = 'w-6 h-6', playOffset = 'ml-0.5' }) => (
  <span className={`relative inline-block ${className}`} data-state={state} aria-hidden="true">
    <Play className={`${layer(state === 'paused')} w-full h-full fill-current ${playOffset}`} />
    <Pause className={`${layer(state === 'playing')} w-full h-full fill-current`} />
    <svg viewBox="0 0 24 24" className={`${layer(state === 'loading')} w-full h-full motion-safe:animate-spin`} fill="none" role="presentation">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.5" opacity="0.25" />
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="14 60" />
    </svg>
  </span>
);

/** The icon of one track in a list: loading, playing or stopped only for the track that is current. */
export const TrackPlaybackIcon: React.FC<{ trackId: string; className?: string; playOffset?: string }> = ({ trackId, className, playOffset }) => (
  <PlaybackIcon state={usePlaybackState(trackId)} className={className} playOffset={playOffset} />
);
