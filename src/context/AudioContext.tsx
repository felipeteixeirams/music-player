import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { AudioEngineType, RadioStation, RepeatMode, Track } from '../types/music';
import {
  fetchPipedAudioStream,
  getNextTrackIndex,
  getPreviousTrackIndex,
  resolveAudioDetails,
  resolveFullTrackVideoIds
} from '../utils/audioEngine';
import { getOfflineAudioUrl, isTrackOfflineAvailable } from '../utils/offlineManager';
import { fetchRadioTracks } from '../utils/catalogClient';
import { needsRadioRefill, pickRadioRefill } from '../utils/radioQueue';

/** A radio gives up after this many unplayable tracks in a row. */
const RADIO_MAX_CONSECUTIVE_SKIPS = 5;
import {
  LIKED_IDS_KEY,
  LIKED_TRACKS_KEY,
  hydrateLikedLibrary,
  likedIds,
  loadLikedLibrary,
  toggleLikedTrack,
  type LikedLibrary
} from '../utils/likedTracks';

export interface PlaybackStatus {
  instanceUsed?: string;
  quality?: string;
  /** The track cannot be played. */
  error?: string;
  /** The track plays, but not in the best way (for example only the 30s preview). */
  notice?: string;
}

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
  pipedStatus: PlaybackStatus;
  audioStreamUrl: string;
  likedTrackIds: string[];
  likedTracks: Track[];
  audioFrequencyData: number[];
  userSeekRequest: number | null;
  
  // Actions
  playTrack: (track: Track, customQueue?: Track[]) => void;
  togglePlayPause: () => void;
  playNext: () => void;
  playPrevious: () => void;
  seekTo: (seconds: number) => void;
  updatePlaybackTime: (seconds: number) => void;
  setDuration: (seconds: number) => void;
  clearUserSeekRequest: () => void;
  handleFallbackError: () => void;
  setVolume: (val: number) => void;
  toggleMute: () => void;
  toggleShuffle: () => void;
  toggleRepeat: () => void;
  setPreferredEngine: (engine: AudioEngineType) => void;
  toggleExpanded: (open?: boolean) => void;
  /** The station playing as a radio: the queue renews itself and never runs out. Null for ordinary lists. */
  radioStation: RadioStation | null;
  /** Starts a station; false when it could not be loaded. */
  startRadio: (station: RadioStation) => Promise<boolean>;
  toggleLike: (track: Track) => void;
  hydrateLikedTracks: (tracks: Track[]) => void;
  isLiked: (trackId: string) => boolean;
  switchEngineManually: (engine: AudioEngineType) => Promise<void>;
}

const AudioContext = createContext<AudioContextType | null>(null);


export const AudioProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [queue, setQueue] = useState<Track[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [radioStation, setRadioStation] = useState<RadioStation | null>(null);
  const queueRef = useRef<Track[]>([]);
  const radioRefillingRef = useRef(false);
  const radioStationRef = useRef<RadioStation | null>(null);
  const radioSkipsRef = useRef(0);
  const playNextRef = useRef<() => void>(() => {});
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);

  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [volume, setVolumeState] = useState<number>(0.85);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isShuffle, setIsShuffle] = useState<boolean>(false);
  const [repeatMode, setRepeatMode] = useState<RepeatMode>('all');
  
  const [activeEngine, setActiveEngine] = useState<AudioEngineType>('fallback');
  const [preferredEngine, setPreferredEngineState] = useState<AudioEngineType>('fallback');
  const [isBuffering, setIsBuffering] = useState<boolean>(false);
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [pipedStatus, setPipedStatus] = useState<PlaybackStatus>({
    quality: 'Áudio Original',
    instanceUsed: 'YouTube / Piped'
  });
  const [audioStreamUrl, setAudioStreamUrl] = useState<string>('');
  const [userSeekRequest, setUserSeekRequest] = useState<number | null>(null);
  
  const [likedLibrary, setLikedLibrary] = useState<LikedLibrary>(() => {
    try {
      return loadLikedLibrary(localStorage);
    } catch {
      return { tracks: [], pendingIds: [] };
    }
  });
  const likedTrackIds = likedIds(likedLibrary);

  const [audioFrequencyData, setAudioFrequencyData] = useState<number[]>(new Array(24).fill(12));

  // Native HTML5 Audio ref
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const currentTrackRef = useRef<Track | null>(null);
  const loadTokenRef = useRef(0);
  // Remaining YouTube videos to try for the current track when the embed of one of them fails
  const alternateVideosRef = useRef<{ trackId: string; videoIds: string[] }>({ trackId: '', videoIds: [] });

  useEffect(() => {
    currentTrackRef.current = currentTrack;
  }, [currentTrack]);

  useEffect(() => {
    queueRef.current = queue;
  }, [queue]);

  useEffect(() => {
    radioStationRef.current = radioStation;
  }, [radioStation]);

  const triggerFallbackEngine = useCallback((track: Track, shouldPlay = true) => {
    setActiveEngine('fallback');
    const fallbackUrl = `https://www.youtube.com/watch?v=${track.sources.youtubeId}`;
    setAudioStreamUrl(fallbackUrl);
    setPipedStatus({
      quality: 'Áudio Original',
      instanceUsed: 'YouTube Engine (Fallback)'
    });
    setIsBuffering(false);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
    }
    if (shouldPlay) {
      setIsPlaying(true);
    }
  }, []);

  /**
   * A radio is listened to without touching the screen, so a track that cannot be played (no video, no preview)
   * is passed over instead of stopping the music. After a few in a row it gives up, so a dead network does
   * not make it skip forever. Returns true when it moved on.
   */
  const skipUnplayableTrack = useCallback((): boolean => {
    if (!radioStationRef.current) return false;
    if (radioSkipsRef.current >= RADIO_MAX_CONSECUTIVE_SKIPS) {
      radioSkipsRef.current = 0;
      return false;
    }
    radioSkipsRef.current += 1;
    playNextRef.current();
    return true;
  }, []);

  // Plays the 30s catalog preview; returns false when the track has none.
  const playPreview = useCallback(async (track: Track, shouldPlay: boolean): Promise<boolean> => {
    const previewUrl = track.sources.previewUrl;
    if (!previewUrl || !audioRef.current) return false;

    setActiveEngine('native');
    setAudioStreamUrl(previewUrl);
    setPipedStatus({
      quality: 'Prévia de 30s',
      instanceUsed: 'Catálogo',
      notice: 'Faixa completa indisponível, tocando a prévia de 30s.'
    });
    audioRef.current.src = previewUrl;
    if (shouldPlay) {
      try {
        await audioRef.current.play();
        setIsPlaying(true);
      } catch (err) {
        console.warn('Preview playback notice:', err);
      }
    }
    setIsBuffering(false);
    return true;
  }, []);

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
      radioSkipsRef.current = 0;
      setIsBuffering(false);
      setIsPlaying(true);
    };
    const onPause = () => setIsPlaying(false);
    const onError = () => {
      // Clearing the source (switching to the YouTube engine) also raises an error event
      if (!audio.getAttribute('src')) return;
      console.warn('Native AudioElement playback error, failing over to YouTube fallback engine');
      setIsBuffering(false);
      if (currentTrackRef.current && currentTrackRef.current.sources.youtubeId) {
        triggerFallbackEngine(currentTrackRef.current, true);
      } else if (!skipUnplayableTrack()) {
        setIsPlaying(false);
        setPipedStatus({ error: 'Não foi possível reproduzir o áudio desta faixa.' });
      }
    };

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('durationchange', onDurationChange);
    audio.addEventListener('waiting', onWaiting);
    audio.addEventListener('playing', onPlaying);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('error', onError);

    return () => {
      audio.pause();
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('durationchange', onDurationChange);
      audio.removeEventListener('waiting', onWaiting);
      audio.removeEventListener('playing', onPlaying);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('error', onError);
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [triggerFallbackEngine]);

  // Save liked tracks (with metadata) to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(LIKED_TRACKS_KEY, JSON.stringify(likedLibrary.tracks));
      localStorage.setItem(LIKED_IDS_KEY, JSON.stringify(likedLibrary.pendingIds));
    } catch {
      // quota or private mode fallback
    }
  }, [likedLibrary]);

  // Audio Visualizer data generator. Only the expanded player draws it, and each update re-renders every
  // consumer of this context, so it runs only while that panel is open and playing, at about 20 frames/s.
  useEffect(() => {
    const flat = (prev: number[]) => (prev.every((v) => v === 0) ? prev : new Array(24).fill(0));
    if (!isPlaying || !isExpanded) {
      setAudioFrequencyData(flat);
      return;
    }

    let phase = 0;
    let lastFrame = 0;
    const updateSpectrum = (now: number) => {
      animationFrameRef.current = requestAnimationFrame(updateSpectrum);
      if (now - lastFrame < 50) return;
      lastFrame = now;

      phase += 0.08;
      const bands = 24;
      setAudioFrequencyData(
        new Array(bands).fill(0).map((_, i) => {
          const base = Math.sin(phase + i * 0.4) * 0.35 + 0.55;
          const noise = (Math.random() - 0.5) * 0.2;
          return Math.round(Math.max(0.1, Math.min(1.0, base + noise)) * 100);
        })
      );
    };

    animationFrameRef.current = requestAnimationFrame(updateSpectrum);
    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [isPlaying, isExpanded]);

  // Handle track source resolution (Hybrid Engine logic - with Offline Cache priority)
  const loadAndPlayTrack = useCallback(async (track: Track, engineChoice: AudioEngineType, shouldPlay = true) => {
    const token = ++loadTokenRef.current;
    setPipedStatus((prev) => (prev.error || prev.notice ? { ...prev, error: undefined, notice: undefined } : prev));
    setIsBuffering(true);
    setCurrentTrack(track);
    setDuration(track.duration);
    setCurrentTime(0);

    // 1. First priority: Check if track is cached for offline playback
    if (isTrackOfflineAvailable(track.id)) {
      const offlineBlobUrl = await getOfflineAudioUrl(track.id);
      if (offlineBlobUrl && audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = offlineBlobUrl;
        setActiveEngine('native');
        setAudioStreamUrl(offlineBlobUrl);
        setPipedStatus({ quality: 'Offline Cache', instanceUsed: 'Local Cache Storage' });
        if (shouldPlay) {
          try {
            await audioRef.current.play();
            setIsPlaying(true);
          } catch (err) {
            console.warn('Offline stream playback notice:', err);
          }
        }
        setIsBuffering(false);
        return;
      }
    }

    // 2. Full recording of a catalog track: find its YouTube video and play it in the headless engine
    if (!track.sources.youtubeId && !track.sources.localUrl) {
      audioRef.current?.pause();
      const [videoId, ...alternates] = await resolveFullTrackVideoIds(track);
      if (loadTokenRef.current !== token) return;
      if (videoId) {
        alternateVideosRef.current = { trackId: track.id, videoIds: alternates };
        triggerFallbackEngine({ ...track, sources: { ...track.sources, youtubeId: videoId } }, shouldPlay);
        return;
      }
    }

    // 3. Catalog preview (Deezer): direct audio URL, used when the full recording is unavailable
    if (await playPreview(track, shouldPlay)) return;

    // 4. Online stream resolution (YouTube / Piped)
    if (track.sources.youtubeId) {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
      }

      // Try fetching direct audio stream from Piped instances first with a quick 1.5s timeout
      try {
        const pipedResult = await fetchPipedAudioStream(track.sources.youtubeId, 1500);
        if (pipedResult.audioUrl && audioRef.current) {
          setActiveEngine('piped');
          setAudioStreamUrl(pipedResult.audioUrl);
          setPipedStatus({
            quality: pipedResult.quality || '128kbps',
            instanceUsed: pipedResult.instanceUsed || 'Piped Direct Stream'
          });
          audioRef.current.src = pipedResult.audioUrl;
          if (shouldPlay) {
            await audioRef.current.play();
            setIsPlaying(true);
          }
          setIsBuffering(false);
          return;
        }
      } catch (err) {
        console.warn('Direct stream playback failed, using fallback engine:', err);
      }

      // Fallback to official YouTube headless engine player
      triggerFallbackEngine(track, shouldPlay);
      return;
    }

    // Direct localUrl fallback if explicitly configured
    if (track.sources.localUrl) {
      setActiveEngine('native');
      const streamUrl = track.sources.localUrl;
      setAudioStreamUrl(streamUrl);

      if (audioRef.current) {
        audioRef.current.src = streamUrl;
        if (shouldPlay) {
          audioRef.current.play().catch((err) => {
            console.warn('Native stream autoplay notice:', err);
          });
        }
      }
      setIsBuffering(false);
      return;
    }

    if (skipUnplayableTrack()) return;
    setPipedStatus({ error: 'Esta faixa não tem prévia disponível.' });
    setIsPlaying(false);
    setIsBuffering(false);
  }, [triggerFallbackEngine, playPreview, skipUnplayableTrack]);

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
  }, [queue, currentIndex, isShuffle, repeatMode, radioStation]);

  // Predictive Pre-Buffering & Cache Priming for Next Track in Queue
  useEffect(() => {
    if (!isPlaying || !queue.length) return;

    const nextIdx = getNextTrackIndex(currentIndex, queue.length, isShuffle, repeatMode);
    if (nextIdx >= 0 && nextIdx < queue.length && nextIdx !== currentIndex) {
      const nextTrack = queue[nextIdx];
      // Prime the server-side Piped stream resolution cache in background
      if (nextTrack.sources.youtubeId && !isTrackOfflineAvailable(nextTrack.id)) {
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
    // Synchronously prime audio gesture permission
    if (audioRef.current) {
      audioRef.current.play().then(() => {
        audioRef.current?.pause();
      }).catch(() => {});
    }

    if (customQueue) {
      setRadioStation(null);
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

    if (activeEngine === 'fallback' || (currentTrack && currentTrack.sources.youtubeId && !audioStreamUrl.startsWith('http') && !audioStreamUrl.startsWith('blob'))) {
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
  }, [currentTrack, activeEngine, audioStreamUrl, isPlaying, queue, playTrack]);

  // Asks the station for another shuffle and adds what was not heard recently; resolves with what was added
  const refillRadio = useCallback(async (): Promise<Track[]> => {
    if (!radioStation || radioRefillingRef.current) return [];
    radioRefillingRef.current = true;
    try {
      const incoming = await fetchRadioTracks(radioStation.id);
      const added = pickRadioRefill(queueRef.current, incoming);
      if (added.length > 0) {
        queueRef.current = [...queueRef.current, ...added];
        setQueue(queueRef.current);
      }
      return added;
    } catch (err) {
      console.warn('Radio refill notice:', err);
      return [];
    } finally {
      radioRefillingRef.current = false;
    }
  }, [radioStation]);

  // Keeps the radio ahead of the listener
  useEffect(() => {
    if (radioStation && needsRadioRefill(queue.length, currentIndex)) void refillRadio();
  }, [radioStation, queue.length, currentIndex, refillRadio]);

  const startRadio = useCallback(async (station: RadioStation): Promise<boolean> => {
    // Synchronously prime audio gesture permission, before the network wait
    if (audioRef.current) {
      audioRef.current.play().then(() => {
        audioRef.current?.pause();
      }).catch(() => {});
    }

    try {
      const batch = await fetchRadioTracks(station.id);
      if (batch.length === 0) return false;
      radioRefillingRef.current = false;
      queueRef.current = batch;
      setRadioStation(station);
      setQueue(batch);
      setCurrentIndex(0);
      loadAndPlayTrack(batch[0], preferredEngine, true);
      return true;
    } catch (err) {
      console.warn('Radio start notice:', err);
      return false;
    }
  }, [preferredEngine, loadAndPlayTrack]);

  const playNext = useCallback(() => {
    if (radioStation) {
      // A radio has no shuffle or end: it moves on, asking for more when the queue runs dry
      const nextIdx = repeatMode === 'one' ? currentIndex : currentIndex + 1;
      if (nextIdx < queue.length) {
        setCurrentIndex(nextIdx);
        loadAndPlayTrack(queue[nextIdx], preferredEngine, true);
      } else {
        void refillRadio().then((added) => {
          if (added.length === 0) {
            setIsPlaying(false);
            return;
          }
          setCurrentIndex(nextIdx);
          loadAndPlayTrack(added[0], preferredEngine, true);
        });
      }
      return;
    }

    const nextIdx = getNextTrackIndex(currentIndex, queue.length, isShuffle, repeatMode);
    if (nextIdx >= 0 && nextIdx < queue.length) {
      setCurrentIndex(nextIdx);
      loadAndPlayTrack(queue[nextIdx], preferredEngine, true);
    } else {
      setIsPlaying(false);
    }
  }, [radioStation, refillRadio, currentIndex, queue, isShuffle, repeatMode, preferredEngine, loadAndPlayTrack]);

  playNextRef.current = playNext;

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
    if (activeEngine === 'fallback') {
      setUserSeekRequest(target);
    }
  }, [duration, activeEngine]);

  const updatePlaybackTime = useCallback((seconds: number) => {
    if (seconds > 0.5) radioSkipsRef.current = 0;
    setCurrentTime(seconds);
  }, []);

  // The headless YouTube player failed (embedding blocked, unavailable video): use the preview if any
  const handleFallbackError = useCallback(() => {
    const track = currentTrackRef.current;
    const alternates = alternateVideosRef.current;
    if (track && alternates.trackId === track.id && alternates.videoIds.length > 0) {
      const [nextVideoId, ...rest] = alternates.videoIds;
      alternateVideosRef.current = { trackId: track.id, videoIds: rest };
      triggerFallbackEngine({ ...track, sources: { ...track.sources, youtubeId: nextVideoId } }, true);
      return;
    }
    if (track?.sources.previewUrl) {
      void playPreview(track, true);
      return;
    }
    if (skipUnplayableTrack()) return;
    setIsPlaying(false);
    setIsBuffering(false);
    setPipedStatus({ error: 'Não foi possível reproduzir esta faixa.' });
  }, [playPreview, triggerFallbackEngine, skipUnplayableTrack]);

  const clearUserSeekRequest = useCallback(() => {
    setUserSeekRequest(null);
  }, []);

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

  const toggleLike = useCallback((track: Track) => {
    setLikedLibrary((prev) => toggleLikedTrack(prev, track));
  }, []);

  const hydrateLikedTracks = useCallback((tracks: Track[]) => {
    setLikedLibrary((prev) => hydrateLikedLibrary(prev, tracks));
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
        likedTracks: likedLibrary.tracks,
        audioFrequencyData,
        userSeekRequest,
        playTrack,
        togglePlayPause,
        playNext,
        playPrevious,
        seekTo,
        updatePlaybackTime,
        setDuration,
        clearUserSeekRequest,
        handleFallbackError,
        setVolume,
        toggleMute,
        toggleShuffle,
        toggleRepeat,
        setPreferredEngine,
        toggleExpanded,
        radioStation,
        startRadio,
        toggleLike,
        hydrateLikedTracks,
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
