import React, { useEffect, useRef } from 'react';
import ReactPlayer from 'react-player';
import { useAudio } from '../context/AudioContext';

/**
 * Headless Audio Engine Fallback
 * Renders react-player at 1px by 1px with opacity 0, strictly as a redundant audio engine
 * when native stream and Piped API are unreachable or restricted.
 */
const PlayerComponent = ReactPlayer as any;

export const HeadlessPlayerFallback: React.FC = () => {
  const {
    activeEngine,
    audioStreamUrl,
    isPlaying,
    volume,
    isMuted,
    seekTo,
    playNext,
    currentTime
  } = useAudio();

  const playerRef = useRef<any>(null);

  // Sync seek if needed when active in fallback mode
  useEffect(() => {
    if (activeEngine === 'fallback' && playerRef.current && typeof playerRef.current.getCurrentTime === 'function') {
      const internalCurrent = playerRef.current.getCurrentTime();
      if (Math.abs(internalCurrent - currentTime) > 2.5) {
        playerRef.current.seekTo(currentTime, 'seconds');
      }
    }
  }, [activeEngine, currentTime]);

  if (activeEngine !== 'fallback' || !audioStreamUrl) {
    return null;
  }

  return (
    <div
      aria-hidden="true"
      style={{
        position: 'fixed',
        bottom: 0,
        right: 0,
        width: 1,
        height: 1,
        opacity: 0,
        pointerEvents: 'none',
        overflow: 'hidden',
        zIndex: -9999
      }}
    >
      <PlayerComponent
        ref={playerRef}
        url={audioStreamUrl}
        playing={isPlaying}
        volume={isMuted ? 0 : volume}
        width="1px"
        height="1px"
        controls={false}
        playsinline
        config={{
          youtube: {
            playerVars: {
              autoplay: 1,
              controls: 0,
              disablekb: 1,
              fs: 0,
              modestbranding: 1,
              playsinline: 1,
              rel: 0
            }
          } as any
        }}
        onProgress={(state: any) => {
          if (activeEngine === 'fallback' && state && typeof state.playedSeconds === 'number') {
            seekTo(state.playedSeconds);
          }
        }}
        onEnded={() => {
          if (activeEngine === 'fallback') {
            playNext();
          }
        }}
        onError={(err: any) => {
          console.warn('Headless audio fallback player event:', err);
        }}
      />
    </div>
  );
};
