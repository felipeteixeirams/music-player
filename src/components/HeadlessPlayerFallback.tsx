import React, { useEffect, useRef } from 'react';
import { useAudio } from '../context/AudioContext';
import { videoIdFromUrl, youtubeEngine } from '../utils/youtubeEngine';
import { plausiblePlayerLength } from '../utils/playerLength';
import { logPlayback } from '../utils/playbackDiagnostics';

/**
 * Bridge between the playback state and the hidden YouTube player (`youtubeEngine`, which owns the iframe: it is
 * created in the user's tap and keeps living, so every track after the first only loads a new video into it).
 */
export const HeadlessPlayerFallback: React.FC = () => {
  const {
    currentTrack,
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
    engineLoadId
  } = useAudio();

  const isFallbackActive = activeEngine === 'fallback' && Boolean(audioStreamUrl);
  const videoId = videoIdFromUrl(isFallbackActive ? audioStreamUrl : '');
  const playing = isPlaying && isFallbackActive;

  // The player's events call the latest callbacks without re-subscribing on every render
  const latest = useRef({ playNext, updatePlaybackTime, setDuration, handleFallbackError, engineStarted, engineReady });
  latest.current = { playNext, updatePlaybackTime, setDuration, handleFallbackError, engineStarted, engineReady };

  // The length the player reports, when it is believable next to the catalog's (see `playerLength.ts`)
  const catalogRef = useRef({ id: '', seconds: 0 });
  catalogRef.current = { id: currentTrack?.id ?? '', seconds: currentTrack?.duration ?? 0 };
  const loggedBogus = useRef('');
  const believe = (seconds: number): boolean => {
    const { id, seconds: catalog } = catalogRef.current;
    if (plausiblePlayerLength(catalog, seconds)) {
      if (Math.abs(seconds - catalog) > 5 && loggedBogus.current !== `seen-${id}`) {
        loggedBogus.current = `seen-${id}`;
        logPlayback(`duração do player: ${Math.round(seconds)} s (catálogo ${Math.round(catalog)} s)`);
      }
      return true;
    }
    if (loggedBogus.current !== id) {
      loggedBogus.current = id;
      logPlayback(`duração do player ignorada: ${Math.round(seconds)} s contra ${Math.round(catalog)} s do catálogo`);
    }
    return false;
  };

  useEffect(() => {
    youtubeEngine.setEvents({
      started: () => latest.current.engineStarted(),
      ended: () => latest.current.playNext(),
      error: (code) => {
        console.warn(`Background playback failed (YouTube error ${code}), switching source`);
        latest.current.handleFallbackError();
      },
      time: (seconds) => {
        latest.current.updatePlaybackTime(seconds);
      },
      loaded: (seconds) => {
        if (believe(seconds)) latest.current.setDuration(Math.round(seconds));
        latest.current.engineReady(seconds);
      },
      length: (seconds) => {
        if (believe(seconds)) latest.current.setDuration(Math.round(seconds));
      }
    });
    return () => youtubeEngine.setEvents(null);
  }, []);

  const playingRef = useRef(playing);
  playingRef.current = playing;

  useEffect(() => {
    if (videoId) youtubeEngine.load(videoId, playingRef.current);
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
