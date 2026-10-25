import React, { useEffect, useRef } from 'react';
import ReactPlayer from 'react-player';
import { useAudio } from '../context/AudioContext';

/**
 * Headless Audio Engine (YouTube & YouTube Music Official Audio Stream)
 * Renders react-player with standard dimensions in viewport under the UI layer to prevent
 * browser off-screen throttling and iframe miniaturization blocks (Error 150/151),
 * ensuring continuous and authentic audio playback behind the scenes.
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
    clearUserSeekRequest,
    handleFallbackError
  } = useAudio();

  const playerRef = useRef<any>(null);

  // Sync seek when user moves timeline slider
  useEffect(() => {
    if (userSeekRequest !== null && playerRef.current) {
      playerRef.current.currentTime = userSeekRequest;
      clearUserSeekRequest();
    }
  }, [userSeekRequest, clearUserSeekRequest]);

  const isFallbackActive = activeEngine === 'fallback' && Boolean(audioStreamUrl);
  const targetUrl = isFallbackActive ? audioStreamUrl : '';
  const originUrl = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';

  return (
    <div
      aria-hidden="true"
      style={{
        position: 'fixed',
        bottom: 0,
        right: 0,
        width: 320,
        height: 180,
        opacity: 0.001,
        pointerEvents: 'none',
        overflow: 'hidden',
        zIndex: -50,
        clipPath: 'inset(100%)'
      }}
    >
      {targetUrl ? (
        <PlayerComponent
          ref={playerRef}
          src={targetUrl}
          playing={isPlaying && isFallbackActive}
          volume={isMuted ? 0 : volume}
          width="320px"
          height="180px"
          controls={false}
          playsInline
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
          onDurationChange={(event: React.SyntheticEvent<HTMLMediaElement>) => {
            const d = event.currentTarget.duration;
            if (Number.isFinite(d) && d > 0) setDuration(Math.round(d));
          }}
          onTimeUpdate={(event: React.SyntheticEvent<HTMLMediaElement>) => {
            updatePlaybackTime(event.currentTarget.currentTime);
          }}
          onEnded={() => {
            playNext();
          }}
          onError={(err: any) => {
            console.warn('Background playback failed, switching source:', err);
            handleFallbackError();
          }}
        />
      ) : null}
    </div>
  );
};

