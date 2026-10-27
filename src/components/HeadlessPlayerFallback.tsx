import React, { useEffect, useRef } from 'react';
import { useAudio } from '../context/AudioContext';
import { videoIdFromUrl, youtubeEngine } from '../utils/youtubeEngine';

/**
 * Bridge between the playback state and the hidden YouTube player (`youtubeEngine`, which owns the iframe: it is
 * created in the user's tap and keeps living, so every track after the first only loads a new video into it).
 */
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
    trialVideoUrl,
    engineLoadId
  } = useAudio();

  const isFallbackActive = activeEngine === 'fallback' && Boolean(audioStreamUrl);
  // While the preview plays, the full track's video may already load (and take over when it starts)
  const isTrial = !isFallbackActive && Boolean(trialVideoUrl);
  const videoId = videoIdFromUrl(isFallbackActive ? audioStreamUrl : isTrial ? trialVideoUrl : '');
  // The trial video is asked to start once, when it loads; after that only the full track follows the play button
  const startsOnLoad = isPlaying && (isFallbackActive || isTrial);
  const playing = isPlaying && isFallbackActive;

  // The player's events call the latest callbacks without re-subscribing on every render
  const latest = useRef({ isTrial, playNext, updatePlaybackTime, setDuration, handleFallbackError, engineStarted, engineReady });
  latest.current = { isTrial, playNext, updatePlaybackTime, setDuration, handleFallbackError, engineStarted, engineReady };

  useEffect(() => {
    youtubeEngine.setEvents({
      started: () => latest.current.engineStarted(),
      ended: () => latest.current.playNext(),
      error: (code) => {
        console.warn(`Background playback failed (YouTube error ${code}), switching source`);
        latest.current.handleFallbackError();
      },
      time: (seconds) => {
        if (!latest.current.isTrial) latest.current.updatePlaybackTime(seconds);
      },
      loaded: (seconds) => {
        if (!latest.current.isTrial) latest.current.setDuration(Math.round(seconds));
        latest.current.engineReady(seconds);
      }
    });
    return () => youtubeEngine.setEvents(null);
  }, []);

  const loadRef = useRef({ startsOnLoad, isTrial });
  loadRef.current = { startsOnLoad, isTrial };

  useEffect(() => {
    if (videoId) youtubeEngine.load(videoId, loadRef.current.startsOnLoad, !loadRef.current.isTrial);
    else youtubeEngine.stop();
  }, [videoId, engineLoadId]);

  useEffect(() => {
    if (!videoId) return;
    if (playing) youtubeEngine.play();
    else youtubeEngine.pause();
    // `videoId` is not a dependency: loading a video already starts it when it should
  }, [playing]);

  useEffect(() => {
    youtubeEngine.setVolume(isMuted ? 0 : volume);
  }, [volume, isMuted]);

  useEffect(() => {
    if (userSeekRequest !== null) {
      youtubeEngine.seekTo(userSeekRequest);
      clearUserSeekRequest();
    }
  }, [userSeekRequest, clearUserSeekRequest]);

  return null;
};
