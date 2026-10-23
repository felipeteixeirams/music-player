import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { AudioEngineType, RepeatMode, Track } from '../types/music';
import { TRACKS } from '../data/musicCatalog';
import {
  fetchPipedAudioStream,
  getNextTrackIndex,
  getPreviousTrackIndex,
  resolveAudioDetails
} from '../utils/audioEngine';

interface AudioContextType {
  currentTrack: Track | null;
  queue: Track[];
  currentIndex: number;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  isShuffle: boolean;
  repeatMode: RepeatMode;
  activeEngine: AudioEngineType;
  preferredEngine: AudioEngineType;
  isBuffering: boolean;
  isExpanded: boolean;
  pipedStatus: { instanceUsed?: string; quality?: string; error?: string };
  audioStreamUrl: string;
  likedTrackIds: string[];
  audioFrequencyData: number[];
  
  // Actions
  playTrack: (track: Track, customQueue?: Track[]) => void;
  togglePlayPause: () => void;
  playNext: () => void;
  playPrevious: () => void;
  seekTo: (seconds: number) => void;
  setVolume: (val: number) => void;
  toggleMute: () => void;
  toggleShuffle: () => void;
  toggleRepeat: () => void;
  setPreferredEngine: (engine: AudioEngineType) => void;
  toggleExpanded: (open?: boolean) => void;
  toggleLike: (trackId: string) => void;
  isLiked: (trackId: string) => boolean;
  switchEngineManually: (engine: AudioEngineType) => Promise<void>;
}

const AudioContext = createContext<AudioContextType | null>(null);

const LIKED_STORAGE_KEY = 'aurastream_liked_tracks';

export const AudioProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [queue, setQueue] = useState<Track[]>(TRACKS);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [currentTrack, setCurrentTrack] = useState<Track | null>(TRACKS[0] || null);

  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(TRACKS[0]?.duration || 180);
  const [volume, setVolumeState] = useState<number>(0.85);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isShuffle, setIsShuffle] = useState<boolean>(false);
  const [repeatMode, setRepeatMode] = useState<RepeatMode>('all');
  
  const [activeEngine, setActiveEngine] = useState<AudioEngineType>('native');
  const [preferredEngine, setPreferredEngineState] = useState<AudioEngineType>('native');
  const [isBuffering, setIsBuffering] = useState<boolean>(false);
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [pipedStatus, setPipedStatus] = useState<{ instanceUsed?: string; quality?: string; error?: string }>({});
  const [audioStreamUrl, setAudioStreamUrl] = useState<string>(TRACKS[0]?.sources.localUrl || '');
  
  const [likedTrackIds, setLikedTrackIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(LIKED_STORAGE_KEY);
      return saved ? JSON.parse(saved) : ['queen-bohemian-rhapsody', 'imagine-dragons-believer'];
    } catch {
      return ['queen-bohemian-rhapsody'];
    }
  });

  const [audioFrequencyData, setAudioFrequencyData] = useState<number[]>(new Array(24).fill(12));

  // Native HTML5 Audio ref
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Initialize Audio element once
  useEffect(() => {
    const audio = new Audio();
    audio.preload = 'auto';
    audio.volume = 0.85;
    audioRef.current = audio;

    const onTimeUpdate = () => {
      if (audio.currentTime !== undefined) {
        setCurrentTime(audio.currentTime);
      }
    };

    const onDurationChange = () => {
      if (audio.duration && !isNaN(audio.duration) && audio.duration > 0) {
        setDuration(audio.duration);
      }
    };

    const onWaiting = () => setIsBuffering(true);
    const onPlaying = () => {
      setIsBuffering(false);
      setIsPlaying(true);
    };
    const onPause = () => setIsPlaying(false);

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('durationchange', onDurationChange);
    audio.addEventListener('waiting', onWaiting);
    audio.addEventListener('playing', onPlaying);
    audio.addEventListener('pause', onPause);

    return () => {
      audio.pause();
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('durationchange', onDurationChange);
      audio.removeEventListener('waiting', onWaiting);
      audio.removeEventListener('playing', onPlaying);
      audio.removeEventListener('pause', onPause);
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, []);

  // Save liked tracks to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(LIKED_STORAGE_KEY, JSON.stringify(likedTrackIds));
    } catch {
      // quota or private mode fallback
    }
  }, [likedTrackIds]);

  // Audio Visualizer data generator (simulates smooth FFT analyzer frequency bands synchronized with playing state)
  useEffect(() => {
    let phase = 0;
    const updateSpectrum = () => {
      if (isPlaying) {
        phase += 0.08;
        const bands = 24;
        const nextData = new Array(bands).fill(0).map((_, i) => {
          // Dynamic harmonic curve + random jitter
          const base = Math.sin(phase + i * 0.4) * 0.35 + 0.55;
          const noise = (Math.random() - 0.5) * 0.2;
          const intensity = Math.max(0.1, Math.min(1.0, base + noise));
          return Math.round(intensity * 100);
        });
        setAudioFrequencyData(nextData);
      } else {
        // Idle calm bars
        setAudioFrequencyData((prev) => prev.map((v) => Math.max(8, v * 0.92)));
      }
      animationFrameRef.current = requestAnimationFrame(updateSpectrum);
    };

    animationFrameRef.current = requestAnimationFrame(updateSpectrum);
    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [isPlaying]);

  // Handle track source resolution (Hybrid Engine logic)
  const loadAndPlayTrack = useCallback(async (track: Track, engineChoice: AudioEngineType, shouldPlay = true) => {
    setIsBuffering(true);
    setCurrentTrack(track);
    setDuration(track.duration);
    setCurrentTime(0);

    // 1. If preferred is PIPED API: extract pure audio stream
    if (engineChoice === 'piped' && track.sources.youtubeId) {
      setPipedStatus({ quality: 'Connecting...', instanceUsed: 'Piped Public Network' });
      const pipedResult = await fetchPipedAudioStream(track.sources.youtubeId);
      if (pipedResult.audioUrl) {
        setActiveEngine('piped');
        setAudioStreamUrl(pipedResult.audioUrl);
        setPipedStatus({
          instanceUsed: pipedResult.instanceUsed,
          quality: pipedResult.quality || '160kbps Opus'
        });

        if (audioRef.current) {
          audioRef.current.src = pipedResult.audioUrl;
          if (shouldPlay) {
            audioRef.current.play().catch(() => {
              // Browser autoplay policy or format issue -> fallback
              triggerFallbackEngine(track, shouldPlay);
            });
          }
        }
        setIsBuffering(false);
        return;
      }
      // Piped failed -> fall back
      setPipedStatus({ error: pipedResult.error || 'Piped unreachable' });
    }

    // 2. If NATIVE direct stream
    if (engineChoice === 'native' || (!engineChoice && track.sources.localUrl)) {
      setActiveEngine('native');
      const streamUrl = track.sources.localUrl;
      setAudioStreamUrl(streamUrl);
      setPipedStatus({ quality: 'High Fidelity MP3 Stream' });

      if (audioRef.current) {
        audioRef.current.src = streamUrl;
        if (shouldPlay) {
          audioRef.current.play().catch((err) => {
            console.warn('Native stream autoplay prevented or failed, trying fallback:', err);
            triggerFallbackEngine(track, shouldPlay);
          });
        }
      }
      setIsBuffering(false);
      return;
    }

    // 3. Fallback engine
    triggerFallbackEngine(track, shouldPlay);
  }, []);

  const triggerFallbackEngine = useCallback((track: Track, shouldPlay = true) => {
    setActiveEngine('fallback');
    setPipedStatus({ quality: 'Redundant Headless Engine', instanceUsed: 'Headless Fallback' });
    const fallbackUrl = `https://www.youtube.com/watch?v=${track.sources.youtubeId}`;
    setAudioStreamUrl(fallbackUrl);
    setIsBuffering(false);
    if (audioRef.current) {
      audioRef.current.pause();
    }
    if (shouldPlay) {
      setIsPlaying(true);
    }
  }, []);

  // When track finishes (Native audio listener)
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onEnded = () => {
      if (repeatMode === 'one') {
        audio.currentTime = 0;
        audio.play().catch(() => {});
        return;
      }
      playNext();
    };

    audio.addEventListener('ended', onEnded);
    return () => audio.removeEventListener('ended', onEnded);
  }, [queue, currentIndex, isShuffle, repeatMode]);

  // Predictive Pre-Buffering & Cache Priming for Next Track in Queue
  useEffect(() => {
    if (!isPlaying || !queue.length) return;

    const nextIdx = getNextTrackIndex(currentIndex, queue.length, isShuffle, repeatMode);
    if (nextIdx >= 0 && nextIdx < queue.length && nextIdx !== currentIndex) {
      const nextTrack = queue[nextIdx];
      // Prime the server-side Piped stream resolution cache in background
      if (nextTrack.sources.youtubeId) {
        fetchPipedAudioStream(nextTrack.sources.youtubeId).catch(() => {});
      }
      // Warm up browser audio stream cache if native
      if (nextTrack.sources.localUrl) {
        const preloader = new Audio();
        preloader.preload = 'metadata';
        preloader.src = nextTrack.sources.localUrl;
      }
    }
  }, [currentIndex, queue, isShuffle, repeatMode, isPlaying]);

  // Hardware / Lock Screen: Media Session API Integration
  useEffect(() => {
    if (!('mediaSession' in navigator) || !currentTrack) return;

    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: currentTrack.title,
        artist: currentTrack.artist,
        album: currentTrack.album,
        artwork: [
          { src: currentTrack.coverUrl, sizes: '192x192', type: 'image/jpeg' },
          { src: currentTrack.coverUrl, sizes: '512x512', type: 'image/jpeg' }
        ]
      });

      navigator.mediaSession.setActionHandler('play', () => {
        togglePlayPause();
      });

      navigator.mediaSession.setActionHandler('pause', () => {
        togglePlayPause();
      });

      navigator.mediaSession.setActionHandler('previoustrack', () => {
        playPrevious();
      });

      navigator.mediaSession.setActionHandler('nexttrack', () => {
        playNext();
      });

      navigator.mediaSession.setActionHandler('seekto', (details) => {
        if (details.seekTime !== undefined && details.seekTime !== null) {
          seekTo(details.seekTime);
        }
      });

      navigator.mediaSession.setActionHandler('seekbackward', (details) => {
        const offset = details.seekOffset || 10;
        seekTo(Math.max(0, currentTime - offset));
      });

      navigator.mediaSession.setActionHandler('seekforward', (details) => {
        const offset = details.seekOffset || 10;
        seekTo(Math.min(duration, currentTime + offset));
      });
    } catch (e) {
      console.warn('MediaSession handler registration notice:', e);
    }
  }, [currentTrack, currentTime, duration]);

  // Update Media Session Position State
  useEffect(() => {
    if (!('mediaSession' in navigator) || !('setPositionState' in navigator.mediaSession) || !currentTrack) return;

    try {
      if (duration > 0 && currentTime >= 0) {
        navigator.mediaSession.setPositionState({
          duration: duration,
          playbackRate: isPlaying ? 1.0 : 0.0,
          position: Math.min(currentTime, duration)
        });
      }
    } catch {}
  }, [currentTime, duration, isPlaying, currentTrack]);

  // Main playback controls
  const playTrack = useCallback((track: Track, customQueue?: Track[]) => {
    if (customQueue) {
      setQueue(customQueue);
      const foundIdx = customQueue.findIndex((t) => t.id === track.id);
      setCurrentIndex(foundIdx >= 0 ? foundIdx : 0);
    } else {
      const foundIdx = queue.findIndex((t) => t.id === track.id);
      if (foundIdx >= 0) {
        setCurrentIndex(foundIdx);
      }
    }
    loadAndPlayTrack(track, preferredEngine, true);
  }, [queue, preferredEngine, loadAndPlayTrack]);

  const togglePlayPause = useCallback(() => {
    if (!currentTrack) {
      if (queue.length > 0) {
        playTrack(queue[0]);
      }
      return;
    }

    if (activeEngine === 'fallback') {
      setIsPlaying((prev) => !prev);
      return;
    }

    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        if (!audioRef.current.src && currentTrack.sources.localUrl) {
          audioRef.current.src = currentTrack.sources.localUrl;
        }
        audioRef.current.play().then(() => {
          setIsPlaying(true);
        }).catch((err) => {
          console.warn('Autoplay handled, activating playback state:', err);
          setIsPlaying(true);
        });
      }
    }
  }, [currentTrack, activeEngine, isPlaying, queue, playTrack]);

  const playNext = useCallback(() => {
    const nextIdx = getNextTrackIndex(currentIndex, queue.length, isShuffle, repeatMode);
    if (nextIdx >= 0 && nextIdx < queue.length) {
      setCurrentIndex(nextIdx);
      loadAndPlayTrack(queue[nextIdx], preferredEngine, true);
    } else {
      setIsPlaying(false);
    }
  }, [currentIndex, queue, isShuffle, repeatMode, preferredEngine, loadAndPlayTrack]);

  const playPrevious = useCallback(() => {
    if (currentTime > 4) {
      seekTo(0);
      return;
    }
    const prevIdx = getPreviousTrackIndex(currentIndex, queue.length);
    if (prevIdx >= 0 && prevIdx < queue.length) {
      setCurrentIndex(prevIdx);
      loadAndPlayTrack(queue[prevIdx], preferredEngine, true);
    }
  }, [currentTime, currentIndex, queue, preferredEngine, loadAndPlayTrack]);

  const seekTo = useCallback((seconds: number) => {
    const target = Math.max(0, Math.min(seconds, duration));
    setCurrentTime(target);
    if (audioRef.current && activeEngine !== 'fallback') {
      audioRef.current.currentTime = target;
    }
  }, [duration, activeEngine]);

  const setVolume = useCallback((val: number) => {
    const clamped = Math.max(0, Math.min(1, val));
    setVolumeState(clamped);
    if (audioRef.current) {
      audioRef.current.volume = clamped;
    }
    if (clamped === 0) {
      setIsMuted(true);
    } else {
      setIsMuted(false);
    }
  }, []);

  const toggleMute = useCallback(() => {
    if (isMuted) {
      setIsMuted(false);
      if (audioRef.current) audioRef.current.volume = volume || 0.85;
    } else {
      setIsMuted(true);
      if (audioRef.current) audioRef.current.volume = 0;
    }
  }, [isMuted, volume]);

  const toggleShuffle = useCallback(() => {
    setIsShuffle((prev) => !prev);
  }, []);

  const toggleRepeat = useCallback(() => {
    setRepeatMode((prev) => {
      if (prev === 'off') return 'all';
      if (prev === 'all') return 'one';
      return 'off';
    });
  }, []);

  const setPreferredEngine = useCallback((engine: AudioEngineType) => {
    setPreferredEngineState(engine);
    if (currentTrack) {
      loadAndPlayTrack(currentTrack, engine, isPlaying);
    }
  }, [currentTrack, isPlaying, loadAndPlayTrack]);

  const switchEngineManually = useCallback(async (engine: AudioEngineType) => {
    setPreferredEngineState(engine);
    if (currentTrack) {
      await loadAndPlayTrack(currentTrack, engine, isPlaying);
    }
  }, [currentTrack, isPlaying, loadAndPlayTrack]);

  const toggleExpanded = useCallback((open?: boolean) => {
    setIsExpanded((prev) => (open !== undefined ? open : !prev));
  }, []);

  const toggleLike = useCallback((trackId: string) => {
    setLikedTrackIds((prev) =>
      prev.includes(trackId) ? prev.filter((id) => id !== trackId) : [...prev, trackId]
    );
  }, []);

  const isLiked = useCallback((trackId: string) => {
    return likedTrackIds.includes(trackId);
  }, [likedTrackIds]);

  return (
    <AudioContext.Provider
      value={{
        currentTrack,
        queue,
        currentIndex,
        isPlaying,
        currentTime,
        duration,
        volume,
        isMuted,
        isShuffle,
        repeatMode,
        activeEngine,
        preferredEngine,
        isBuffering,
        isExpanded,
        pipedStatus,
        audioStreamUrl,
        likedTrackIds,
        audioFrequencyData,
        playTrack,
        togglePlayPause,
        playNext,
        playPrevious,
        seekTo,
        setVolume,
        toggleMute,
        toggleShuffle,
        toggleRepeat,
        setPreferredEngine,
        toggleExpanded,
        toggleLike,
        isLiked,
        switchEngineManually
      }}
    >
      {children}
    </AudioContext.Provider>
  );
};

export const useAudio = () => {
  const context = useContext(AudioContext);
  if (!context) {
    throw new Error('useAudio must be used within an AudioProvider');
  }
  return context;
};
