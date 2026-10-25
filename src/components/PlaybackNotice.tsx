import React from 'react';
import { AlertTriangle, Info } from 'lucide-react';
import { useAudio } from '../context/AudioContext';

/** Tells the user why a track is silent (error) or why it plays in a reduced form (notice). */
export const PlaybackNotice: React.FC<{ className?: string }> = ({ className = '' }) => {
  const { pipedStatus, currentTrack } = useAudio();
  if (!currentTrack || (!pipedStatus.error && !pipedStatus.notice)) return null;

  const isError = Boolean(pipedStatus.error);
  return (
    <div
      role={isError ? 'alert' : 'status'}
      className={`flex items-center gap-2 rounded-2xl border px-3 py-2 text-xs backdrop-blur-md ${
        isError
          ? 'bg-rose-950/90 border-rose-500/40 text-rose-200'
          : 'bg-amber-950/90 border-amber-500/40 text-amber-200'
      } ${className}`}
    >
      {isError ? <AlertTriangle className="w-4 h-4 shrink-0" /> : <Info className="w-4 h-4 shrink-0" />}
      <span>{pipedStatus.error || pipedStatus.notice}</span>
    </div>
  );
};
