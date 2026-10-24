import React, { useEffect, useRef } from 'react';
import ReactPlayer from 'react-player';
import { useAudio } from '../context/AudioContext';

/**
 * Headless Audio Engine (YouTube & YouTube Music Official Audio Stream)
 * Renders react-player off-screen with standard dimensions to prevent YouTube iframe
 * miniaturization blocks (Error 150/151), delivering the authentic original song.
 */
const PlayerComponent = ReactPlayer as any;

export const HeadlessPlayerFallback: React.FC = () => {
  const {
    activeEngine,
    audioStreamUrl,
    isPlaying,
    volume,
    isMuted,
    playNext,
    updatePlaybackTime,
    setDuration,
    userSeekRequest,
    clearUserSeekRequest
  } = useAudio();

  const playerRef = useRef<any>(null);

  // Sync seek when user moves timeline slider
  useEffect(() => {
    if (userSeekRequest !== null && playerRef.current && typeof playerRef.current.seekTo === 'function') {
      playerRef.current.seekTo(userSeekRequest, 'seconds');
      clearUserSeekRequest();
    }
  }, [userSeekRequest, clearUserSeekRequest]);

  if (activeEngine !== 'fallback' || !audioStreamUrl) {
    return null;
  }

  const originUrl = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';

  return (
    <div
      aria-hidden="true"
      style={{
        position: 'fixed',
        left: -9999,
        top: -9999,
        width: 320,
        height: 180,
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
        width="320px"
        height="180px"
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
              rel: 0,
              origin: originUrl,
              enablejsapi: 1
            }
          } as any
        }}
        onReady={(player: any) => {
          if (player && typeof player.getDuration === 'function') {
            const d = player.getDuration();
            if (d && d > 0) setDuration(Math.round(d));
          }
        }}
        onProgress={(state: any) => {
          if (state && typeof state.playedSeconds === 'number') {
            updatePlaybackTime(state.playedSeconds);
          }
        }}
        onEnded={() => {
          playNext();
        }}
        onError={(err: any) => {
          console.warn('YouTube Engine playback notice:', err);
        }}
      />
    </div>
  );
};
