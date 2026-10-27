import React, { useEffect, useRef } from 'react';
import { YouTubePlayer } from './youtubePlayer';
import { useAudio } from '../context/AudioContext';

/**
 * Headless Audio Engine (YouTube & YouTube Music Official Audio Stream)
 * Renders react-player with standard dimensions in viewport under the UI layer to prevent
 * browser off-screen throttling and iframe miniaturization blocks (Error 150/151),
 * ensuring continuous and authentic audio playback behind the scenes.
 */
const PlayerComponent = YouTubePlayer as any;

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
    handleFallbackError,
    engineStarted,
    engineReady,
    trialVideoUrl
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
  // While the preview plays, the full track's player may already load (and take over when it starts)
  const isTrial = !isFallbackActive && Boolean(trialVideoUrl);
  const targetUrl = isFallbackActive ? audioStreamUrl : isTrial ? trialVideoUrl : '';
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
          playing={isPlaying && (isFallbackActive || isTrial)}
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
            if (Number.isFinite(d) && d > 0) {
              if (!isTrial) setDuration(Math.round(d));
              engineReady(d);
            }
          }}
          onTimeUpdate={(event: React.SyntheticEvent<HTMLMediaElement>) => {
            if (!isTrial) updatePlaybackTime(event.currentTarget.currentTime);
          }}
          onPlaying={() => {
            engineStarted();
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

