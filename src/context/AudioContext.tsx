import React, { createContext, useContext, useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { AudioEngineType, LiveStation, RadioStation, RepeatMode, Track } from '../types/music';
import {
  getNextTrackIndex,
  getPreviousTrackIndex,
  resolveAudioDetails,
  resolveFullTrack,
  reportBrokenVideo,
  prefetchResolved
} from '../utils/audioEngine';
import { getOfflineAudioUrl, isTrackOfflineAvailable } from '../utils/offlineManager';
import { fetchRadioTracks } from '../utils/catalogClient';
import { needsRadioRefill, pickRadioRefill } from '../utils/radioQueue';
import { MAX_EMPTY_PAGES, needsMoreTracks, newTracks, type QueueSource } from '../utils/queueSource';
import { useAuth } from './AuthContext';
import { emitHistoryChanged, emitUserDataChanged, onUserDataApplied } from '../utils/userDataEvents';
import { PlayedCounter } from '../utils/playedCounter';
import { isUnlockClip, unlockAudioElement } from '../utils/audioUnlock';
import { logPlayback } from '../utils/playbackDiagnostics';
import { recordPlay } from '../utils/playHistory';
import { loadChoices, nextVersionIndex, orderVersions, rememberChoice } from '../utils/videoChoice';
import { isLiveTrack, liveStationToTrack } from '../utils/liveRadio';

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
  volume: number;
  isMuted: boolean;
  isShuffle: boolean;
  repeatMode: RepeatMode;
  activeEngine: AudioEngineType;
  preferredEngine: AudioEngineType;
  isBuffering: boolean;
  isExpanded: boolean;
  playbackStatus: PlaybackStatus;
  audioStreamUrl: string;
  likedTrackIds: string[];
  likedTracks: Track[];
  audioFrequencyData: number[];
  userSeekRequest: number | null;
  
  // Actions
  /** `source` says where more of `customQueue` comes from, so playback goes past what is loaded. */
  playTrack: (track: Track, customQueue?: Track[], source?: QueueSource) => void;
  togglePlayPause: () => void;
  playNext: () => void;
  playPrevious: () => void;
  seekTo: (seconds: number) => void;
  updatePlaybackTime: (seconds: number) => void;
  setDuration: (seconds: number) => void;
  clearUserSeekRequest: () => void;
  handleFallbackError: () => void;
  /** The hidden YouTube player reports sound coming out. */
  engineStarted: () => void;
  /** The hidden YouTube player reports that the video is loaded. */
  engineReady: () => void;
  setVolume: (val: number) => void;
  toggleMute: () => void;
  toggleShuffle: () => void;
  toggleRepeat: () => void;
  setPreferredEngine: (engine: AudioEngineType) => void;
  /** How many YouTube versions of the playing track are known; "Outra versão" is offered above one. */
  versionCount: number;
  /** Plays the next version of the playing track (wrapping around) and remembers the choice. */
  switchVersion: () => void;
  toggleExpanded: (open?: boolean) => void;
  /** The station playing as a radio: the queue renews itself and never runs out. Null for ordinary lists. */
  radioStation: RadioStation | null;
  /** Starts a station; false when it could not be loaded. */
  startRadio: (station: RadioStation) => Promise<boolean>;
  /** The current track is a live broadcast: no length, no seeking, no previous or next. */
  isLive: boolean;
  startLiveRadio: (station: LiveStation) => void;
  toggleLike: (track: Track) => void;
  hydrateLikedTracks: (tracks: Track[]) => void;
  isLiked: (trackId: string) => boolean;
  switchEngineManually: (engine: AudioEngineType) => Promise<void>;
}

const AudioContext = createContext<AudioContextType | null>(null);
const PlaybackTimeContext = createContext<{ currentTime: number; duration: number }>({ currentTime: 0, duration: 0 });


/**
 * How long a track that was told to play may stay silent before the screen admits it is not playing: long enough for
 * a slow network to load the YouTube player, and short once the player says it is loaded and still does not play.
 */
const START_WATCH_MS = 6000;
const READY_WATCH_MS = 1500;
const TAP_NOTICE = 'O iPhone não deixou a música começar sozinha. Toque em ▶ para ouvir.';
const BACKGROUND_NOTICE = 'O iPhone pausou a faixa completa ao sair do app. Toque em ▶ para continuar.';

const QUOTA_NOTICE = 'Você chegou ao limite de faixas novas de hoje. Tocando a prévia de 30s; as faixas que já ouviu seguem completas.';

export const AudioProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { storage } = useAuth();
  const [queue, setQueue] = useState<Track[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [radioStation, setRadioStation] = useState<RadioStation | null>(null);
  const queueRef = useRef<Track[]>([]);
  const queueSourceRef = useRef<QueueSource | null>(null);
  const queueMoreBusyRef = useRef(false);
  const radioRefillingRef = useRef(false);
  const radioStationRef = useRef<RadioStation | null>(null);
  const radioSkipsRef = useRef(0);
  const playNextRef = useRef<() => void>(() => {});
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);

  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  // Read by callbacks that must not change on every time update (that would re-render every consumer)
  const currentTimeRef = useRef(0);
  const durationRef = useRef(0);
  currentTimeRef.current = currentTime;
  durationRef.current = duration;
  const isPlayingRef = useRef(false);
  const activeEngineRef = useRef<AudioEngineType>('fallback');
  const mediaActionsRef = useRef<{ togglePlayPause: () => void; playNext: () => void; playPrevious: () => void; seekTo: (seconds: number) => void } | null>(null);
  const [volume, setVolumeState] = useState<number>(0.85);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isShuffle, setIsShuffle] = useState<boolean>(false);
  const [repeatMode, setRepeatMode] = useState<RepeatMode>('all');
  
  const [activeEngine, setActiveEngine] = useState<AudioEngineType>('fallback');
  const [preferredEngine, setPreferredEngineState] = useState<AudioEngineType>('fallback');
  const [isBuffering, setIsBuffering] = useState<boolean>(false);
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [playbackStatus, setPlaybackStatus] = useState<PlaybackStatus>({
    quality: 'Áudio Original',
    instanceUsed: 'YouTube'
  });
  const [audioStreamUrl, setAudioStreamUrl] = useState<string>('');
  const [userSeekRequest, setUserSeekRequest] = useState<number | null>(null);
  
  const [likedLibrary, setLikedLibrary] = useState<LikedLibrary>(() => {
    try {
      return loadLikedLibrary(storage);
    } catch {
      return { tracks: [], pendingIds: [] };
    }
  });
  // Memoized: a new array on every render would make `isLiked` and the whole context value change on each clock tick
  const likedTrackIds = useMemo(() => likedIds(likedLibrary), [likedLibrary]);

  const [audioFrequencyData, setAudioFrequencyData] = useState<number[]>(new Array(24).fill(12));

  // Native HTML5 Audio ref
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const currentTrackRef = useRef<Track | null>(null);
  // A track counts as played after enough listening (see playedCounter.ts): it goes to the play history
  const playedCounterRef = useRef<PlayedCounter | null>(null);
  if (!playedCounterRef.current) {
    playedCounterRef.current = new PlayedCounter((track) => {
      recordPlay(storage, track, Date.now());
      emitHistoryChanged();
    });
  }
  const loadTokenRef = useRef(0);
  // Remaining YouTube videos to try for the current track when the embed of one of them fails
  // The YouTube videos found for the track playing, best first, and which one is on: "Outra versão" moves along them
  const versionsRef = useRef<{ trackId: string; ids: string[]; index: number }>({ trackId: '', ids: [], index: 0 });
  const [versionCount, setVersionCount] = useState(0);

  const isLive = isLiveTrack(currentTrack);

  useEffect(() => {
    currentTrackRef.current = currentTrack;
  }, [currentTrack]);

  useEffect(() => {
    queueRef.current = queue;
  }, [queue]);

  // The next tracks of the queue: their videos are asked for now (from the shared cache only), so when the current one
  // ends, even with the screen locked, the next starts without waiting on the network
  useEffect(() => {
    if (queue.length > 0) prefetchResolved(queue.slice(currentIndex + 1, currentIndex + 4));
  }, [queue, currentIndex]);

  useEffect(() => {
    radioStationRef.current = radioStation;
  }, [radioStation]);

  // A track told to play that stays silent (the browser refused to start it without a tap) must not look like it is
  // playing: after START_WATCH_MS the screen says so and the next tap on play, which the browser allows, starts it.
  const startWatchRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tapAtRef = useRef(0);

  const clearStartWatch = useCallback(() => {
    if (startWatchRef.current) clearTimeout(startWatchRef.current);
    startWatchRef.current = null;
  }, []);

  const watchReasonRef = useRef('o toque');

  const expectPlayback = useCallback((why: string, waitMs = START_WATCH_MS) => {
    clearStartWatch();
    if (waitMs === START_WATCH_MS) tapAtRef.current = performance.now();
    watchReasonRef.current = why;
    startWatchRef.current = setTimeout(() => {
      startWatchRef.current = null;
      logPlayback(`sem som ${Math.round((performance.now() - tapAtRef.current) / 1000)} s depois de ${why}: o navegador bloqueou o início automático`);
      setIsPlaying(false);
      setIsBuffering(false);
      setPlaybackStatus((prev) => ({ ...prev, notice: TAP_NOTICE }));
    }, START_WATCH_MS);
  }, [clearStartWatch]);

  /** The YouTube player has loaded the video: if it does not play now, it is not going to without a tap. */
  const engineReady = useCallback(() => {
    if (startWatchRef.current) {
      logPlayback(`player do YouTube carregado ${Math.round(performance.now() - tapAtRef.current)} ms depois do toque`);
      expectPlayback(watchReasonRef.current, READY_WATCH_MS);
    }
  }, [expectPlayback]);

  /** Sound is really coming out: the wait is over, and a slow start that was already given up on is taken back. */
  const playbackStarted = useCallback((source: string) => {
    const waiting = startWatchRef.current !== null;
    clearStartWatch();
    if (waiting) logPlayback(`começou a tocar (${source}) ${Math.round(performance.now() - tapAtRef.current)} ms depois do toque`);
    setIsPlaying(true);
    setIsBuffering(false);
    setPlaybackStatus((prev) => (prev.notice === TAP_NOTICE || prev.notice === BACKGROUND_NOTICE ? { ...prev, notice: undefined } : prev));
  }, [clearStartWatch]);

  const triggerFallbackEngine = useCallback((track: Track, shouldPlay = true) => {
    setActiveEngine('fallback');
    const fallbackUrl = `https://www.youtube.com/watch?v=${track.sources.youtubeId}`;
    setAudioStreamUrl(fallbackUrl);
    setPlaybackStatus({
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
  const playPreview = useCallback(async (track: Track, shouldPlay: boolean, notice?: string): Promise<boolean> => {
    const previewUrl = track.sources.previewUrl;
    if (!previewUrl || !audioRef.current) return false;

    setActiveEngine('native');
    setAudioStreamUrl(previewUrl);
    setPlaybackStatus({
      quality: 'Prévia de 30s',
      instanceUsed: 'Catálogo',
      notice: notice ?? 'Faixa completa indisponível, tocando a prévia de 30s.'
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
      if (isUnlockClip(audio)) return;
      if (audio.currentTime !== undefined) {
        setCurrentTime(audio.currentTime);
        playedCounterRef.current?.tick(currentTrackRef.current, audio.currentTime);
      }
    };

    const onDurationChange = () => {
      if (isUnlockClip(audio)) return;
      if (Number.isFinite(audio.duration) && audio.duration > 0) {
        setDuration(audio.duration);
      }
    };

    const onWaiting = () => {
      if (!isUnlockClip(audio)) setIsBuffering(true);
    };
    const onPlaying = () => {
      if (isUnlockClip(audio)) return;
      radioSkipsRef.current = 0;
      playbackStarted('áudio do navegador');
    };
    const onPause = () => {
      if (!isUnlockClip(audio)) setIsPlaying(false);
    };
    const onError = () => {
      // Clearing the source (switching to the YouTube engine) also raises an error event
      if (!audio.getAttribute('src') || isUnlockClip(audio)) return;
      console.warn('Native AudioElement playback error, failing over to YouTube fallback engine');
      setIsBuffering(false);
      if (currentTrackRef.current && currentTrackRef.current.sources.youtubeId) {
        triggerFallbackEngine(currentTrackRef.current, true);
      } else if (!skipUnplayableTrack()) {
        setIsPlaying(false);
        setPlaybackStatus({ error: 'Não foi possível reproduzir o áudio desta faixa.' });
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
  }, [triggerFallbackEngine, playbackStarted]);

  isPlayingRef.current = isPlaying;
  activeEngineRef.current = activeEngine;
  useEffect(() => clearStartWatch, [clearStartWatch]);

  // Leaving the app: the iPhone stops the hidden YouTube player. Say so, instead of leaving a screen that "plays".
  useEffect(() => {
    let hiddenAt = 0;
    let timeAtHide = 0;
    let wasPlaying = false;
    let recheck: ReturnType<typeof setTimeout> | null = null;

    const onChange = () => {
      if (document.visibilityState === 'hidden') {
        wasPlaying = isPlayingRef.current;
        timeAtHide = currentTimeRef.current;
        hiddenAt = Date.now();
        logPlayback(`app em segundo plano (${wasPlaying ? 'tocando' : 'parado'}, motor ${activeEngineRef.current === 'fallback' ? 'YouTube' : 'áudio do navegador'})`);
        return;
      }
      if (!hiddenAt) return;
      const away = Math.round((Date.now() - hiddenAt) / 1000);
      const timeAtShow = currentTimeRef.current;
      hiddenAt = 0;
      if (!wasPlaying) return;
      logPlayback(`voltou ao app depois de ${away} s; a faixa avançou ${Math.round(timeAtShow - timeAtHide)} s enquanto estava fora`);
      // The player may take a moment to wake up: if the clock is still where it was, it was stopped
      if (recheck) clearTimeout(recheck);
      recheck = setTimeout(() => {
        if (isPlayingRef.current && Math.abs(currentTimeRef.current - timeAtShow) < 0.5) {
          logPlayback('a faixa parou enquanto o app estava fora: o sistema pausou o áudio');
          setIsPlaying(false);
          setPlaybackStatus((prev) => ({ ...prev, notice: BACKGROUND_NOTICE }));
        }
      }, 1500);
    };

    document.addEventListener('visibilitychange', onChange);
    return () => {
      document.removeEventListener('visibilitychange', onChange);
      if (recheck) clearTimeout(recheck);
    };
  }, []);

  // Save liked tracks (with metadata) to localStorage
  useEffect(() => {
    try {
      storage.setItem(LIKED_TRACKS_KEY, JSON.stringify(likedLibrary.tracks));
      storage.setItem(LIKED_IDS_KEY, JSON.stringify(likedLibrary.pendingIds));
    } catch {
      // quota or private mode fallback
    }
    emitUserDataChanged();
  }, [likedLibrary, storage]);

  // The account's favorites arrived (or changed on another device)
  useEffect(() => onUserDataApplied(() => setLikedLibrary(loadLikedLibrary(storage))), [storage]);

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
    if (shouldPlay) {
      logPlayback(`toque em "${track.title}"`);
      expectPlayback('o toque');
    }
    setPlaybackStatus((prev) => (prev.error || prev.notice ? { ...prev, error: undefined, notice: undefined } : prev));
    setIsBuffering(true);
    setVersionCount(0);
    setCurrentTrack(track);
    setDuration(track.duration);
    setCurrentTime(0);

    // 1. First priority: Check if track is cached for offline playback
    if (isTrackOfflineAvailable(track.id, storage)) {
      const offlineBlobUrl = await getOfflineAudioUrl(track.id);
      if (offlineBlobUrl && audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = offlineBlobUrl;
        setActiveEngine('native');
        setAudioStreamUrl(offlineBlobUrl);
        setPlaybackStatus({ quality: 'Offline Cache', instanceUsed: 'Local Cache Storage' });
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
    let quotaExceeded = false;
    if (!track.sources.youtubeId && !track.sources.localUrl) {
      audioRef.current?.pause();
      const resolveStart = performance.now();
      const resolution = await resolveFullTrack(track);
      const found = resolution.videoIds;
      logPlayback(`vídeo resolvido em ${Math.round(performance.now() - resolveStart)} ms (${found.length} versão(ões)${resolution.quotaExceeded ? ', cota do dia acabada' : ''})`);
      quotaExceeded = resolution.quotaExceeded;
      if (loadTokenRef.current !== token) return;
      // The version the user picked before comes first, even when the search no longer returns it
      const ids = orderVersions(found, loadChoices(storage)[track.id]);
      if (ids.length > 0) {
        versionsRef.current = { trackId: track.id, ids, index: 0 };
        setVersionCount(ids.length);
        triggerFallbackEngine({ ...track, sources: { ...track.sources, youtubeId: ids[0] } }, shouldPlay);
        return;
      }
    }

    // 3. Catalog preview (Deezer): direct audio URL, used when the full recording is unavailable
    if (await playPreview(track, shouldPlay, quotaExceeded ? QUOTA_NOTICE : undefined)) return;

    // 4. A track that already carries its YouTube video goes straight to the headless player
    if (track.sources.youtubeId) {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
      }
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
    setPlaybackStatus({ error: 'Esta faixa não tem prévia disponível.' });
    setIsPlaying(false);
    setIsBuffering(false);
  }, [triggerFallbackEngine, playPreview, skipUnplayableTrack, storage, expectPlayback]);

  // When track finishes (Native audio listener)
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onEnded = () => {
      if (isLiveTrack(currentTrackRef.current)) {
        setIsPlaying(false);
        setPlaybackStatus({ error: 'A transmissão foi interrompida. Toque em reproduzir para sintonizar de novo.' });
        return;
      }
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
        mediaActionsRef.current?.togglePlayPause();
      });

      navigator.mediaSession.setActionHandler('pause', () => {
        mediaActionsRef.current?.togglePlayPause();
      });

      const live = isLiveTrack(currentTrack);

      navigator.mediaSession.setActionHandler('previoustrack', live ? null : () => {
        mediaActionsRef.current?.playPrevious();
      });

      navigator.mediaSession.setActionHandler('nexttrack', live ? null : () => {
        mediaActionsRef.current?.playNext();
      });

      navigator.mediaSession.setActionHandler('seekto', live ? null : (details) => {
        if (details.seekTime !== undefined && details.seekTime !== null) {
          mediaActionsRef.current?.seekTo(details.seekTime);
        }
      });

      navigator.mediaSession.setActionHandler('seekbackward', live ? null : (details) => {
        const offset = details.seekOffset || 10;
        mediaActionsRef.current?.seekTo(Math.max(0, currentTimeRef.current - offset));
      });

      navigator.mediaSession.setActionHandler('seekforward', live ? null : (details) => {
        const offset = details.seekOffset || 10;
        mediaActionsRef.current?.seekTo(Math.min(durationRef.current, currentTimeRef.current + offset));
      });
    } catch (e) {
      console.warn('MediaSession handler registration notice:', e);
    }
  }, [currentTrack]);

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
  const playTrack = useCallback((track: Track, customQueue?: Track[], source?: QueueSource) => {
    // Inside the tap: let the audio element play (a silent clip), so the track that arrives later may start on its own
    unlockAudioElement(audioRef.current);

    if (customQueue) {
      setRadioStation(null);
      queueSourceRef.current = source ?? null;
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
      // This tap is what lets the hidden YouTube player start: the notice that asked for it goes away
      if (isPlaying) clearStartWatch();
      else {
        setPlaybackStatus((prev) => (prev.notice === TAP_NOTICE || prev.notice === BACKGROUND_NOTICE ? { ...prev, notice: undefined } : prev));
        logPlayback('toque em ▶ (retomar)');
        expectPlayback('retomar');
      }
      setIsPlaying((prev) => !prev);
      return;
    }

    if (audioRef.current) {
      if (isPlaying) {
        clearStartWatch();
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        logPlayback('toque em ▶ (retomar)');
        expectPlayback('retomar');
        // Live: whatever was buffered while paused is old, so tune in again
        if (currentTrack.sources.localUrl && (isLiveTrack(currentTrack) || !audioRef.current.src)) {
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
  }, [currentTrack, activeEngine, audioStreamUrl, isPlaying, queue, playTrack, clearStartWatch, expectPlayback]);

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

  // Fetches the next page of the list the queue came from; resolves with the tracks that were added
  const loadMoreQueue = useCallback(async (): Promise<Track[]> => {
    if (queueMoreBusyRef.current) return [];
    queueMoreBusyRef.current = true;
    const source = queueSourceRef.current;
    try {
      for (let attempt = 0; source && source.nextIndex !== null && attempt < MAX_EMPTY_PAGES; attempt++) {
        const page = await source.load(source.nextIndex);
        // The user may have started something else meanwhile
        if (queueSourceRef.current !== source) return [];
        source.nextIndex = page.nextIndex;
        const added = newTracks(queueRef.current, page.tracks);
        if (added.length > 0) {
          queueRef.current = [...queueRef.current, ...added];
          setQueue(queueRef.current);
          return added;
        }
      }
      return [];
    } catch (err) {
      console.warn('Queue extension notice:', err);
      return [];
    } finally {
      queueMoreBusyRef.current = false;
    }
  }, []);

  // Keeps an ordinary list ahead of the listener, so playback does not stop at the end of what was loaded
  useEffect(() => {
    if (!radioStation && needsMoreTracks(queue.length, currentIndex, queueSourceRef.current?.nextIndex ?? null)) {
      void loadMoreQueue();
    }
  }, [radioStation, queue.length, currentIndex, loadMoreQueue]);

  const startLiveRadio = useCallback((station: LiveStation) => {
    const track = liveStationToTrack(station);
    // A live broadcast is not a queue: no radio mode, no list around it
    setRadioStation(null);
    queueRef.current = [track];
    setQueue([track]);
    setCurrentIndex(0);
    loadAndPlayTrack(track, preferredEngine, true);
  }, [preferredEngine, loadAndPlayTrack]);

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
    if (isLiveTrack(currentTrackRef.current)) return;
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

    const advance = () => {
      const nextIdx = getNextTrackIndex(currentIndex, queue.length, isShuffle, repeatMode);
      if (nextIdx >= 0 && nextIdx < queue.length) {
        setCurrentIndex(nextIdx);
        loadAndPlayTrack(queue[nextIdx], preferredEngine, true);
      } else {
        setIsPlaying(false);
      }
    };

    // At the end of what is loaded, but the list has more: fetch it instead of stopping or looping back
    const atLoadedEnd = currentIndex >= queue.length - 1 && !isShuffle && repeatMode !== 'one';
    if (atLoadedEnd && queueSourceRef.current?.nextIndex != null) {
      void loadMoreQueue().then((added) => {
        if (added.length === 0) {
          advance();
          return;
        }
        setCurrentIndex(currentIndex + 1);
        loadAndPlayTrack(added[0], preferredEngine, true);
      });
      return;
    }
    advance();
  }, [radioStation, refillRadio, loadMoreQueue, currentIndex, queue, isShuffle, repeatMode, preferredEngine, loadAndPlayTrack]);

  playNextRef.current = playNext;

  const playPrevious = useCallback(() => {
    if (isLiveTrack(currentTrackRef.current)) return;
    if (currentTimeRef.current > 4) {
      // Through the ref: this callback does not change with `activeEngine`, whose latest value seekTo needs
      mediaActionsRef.current?.seekTo(0);
      return;
    }
    const prevIdx = getPreviousTrackIndex(currentIndex, queue.length);
    if (prevIdx >= 0 && prevIdx < queue.length) {
      setCurrentIndex(prevIdx);
      loadAndPlayTrack(queue[prevIdx], preferredEngine, true);
    }
  }, [currentIndex, queue, preferredEngine, loadAndPlayTrack]);

  const seekTo = useCallback((seconds: number) => {
    if (isLiveTrack(currentTrackRef.current)) return;
    const target = Math.max(0, Math.min(seconds, durationRef.current));
    setCurrentTime(target);
    if (audioRef.current && activeEngine !== 'fallback') {
      audioRef.current.currentTime = target;
    }
    if (activeEngine === 'fallback') {
      setUserSeekRequest(target);
    }
  }, [activeEngine]);

  mediaActionsRef.current = { togglePlayPause, playNext, playPrevious, seekTo };

  const updatePlaybackTime = useCallback((seconds: number) => {
    if (seconds > 0.5) radioSkipsRef.current = 0;
    setCurrentTime(seconds);
    playedCounterRef.current?.tick(currentTrackRef.current, seconds);
    // The YouTube player's clock moving is the proof that it plays
    if (seconds > 0.3 && startWatchRef.current) playbackStarted('player do YouTube');
  }, [playbackStarted]);

  // The headless YouTube player failed (embedding blocked, unavailable video): use the preview if any
  const handleFallbackError = useCallback(() => {
    const track = currentTrackRef.current;
    const versions = versionsRef.current;
    if (track && versions.trackId === track.id && versions.index + 1 < versions.ids.length) {
      // This video would not play (embedding blocked, removed): the next candidate, until they run out
      reportBrokenVideo(track, versions.ids[versions.index]);
      const index = versions.index + 1;
      versionsRef.current = { ...versions, index };
      triggerFallbackEngine({ ...track, sources: { ...track.sources, youtubeId: versions.ids[index] } }, true);
      return;
    }
    if (track && versions.trackId === track.id && versions.ids[versions.index]) reportBrokenVideo(track, versions.ids[versions.index]);
    if (track?.sources.previewUrl) {
      void playPreview(track, true);
      return;
    }
    if (skipUnplayableTrack()) return;
    setIsPlaying(false);
    setIsBuffering(false);
    setPlaybackStatus({ error: 'Não foi possível reproduzir esta faixa.' });
  }, [playPreview, triggerFallbackEngine, skipUnplayableTrack]);

  // "Outra versão": the next video found for this track (wrapping around), remembered as the user's choice
  const switchVersion = useCallback(() => {
    const track = currentTrackRef.current;
    const versions = versionsRef.current;
    if (!track || versions.trackId !== track.id || versions.ids.length < 2) return;

    const index = nextVersionIndex(versions.index, versions.ids.length);
    versionsRef.current = { ...versions, index };
    triggerFallbackEngine({ ...track, sources: { ...track.sources, youtubeId: versions.ids[index] } }, true);
    rememberChoice(storage, track.id, versions.ids[index]);
    emitUserDataChanged();
    setPlaybackStatus((prev) => ({ ...prev, notice: `Tocando outra versão (${index + 1} de ${versions.ids.length}).` }));
  }, [triggerFallbackEngine, storage]);

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

  // The playback clock ticks several times a second: it lives in its own context so that only the components
  // showing it (the full-screen player) render on every tick, and not every list that reads `useAudio()`.
  const playbackTime = useMemo(() => ({ currentTime, duration }), [currentTime, duration]);

  const engineStarted = useCallback(() => playbackStarted('player do YouTube'), [playbackStarted]);

  const audioValue = useMemo(
    () => ({
      currentTrack,
      queue,
      currentIndex,
      isPlaying,
      volume,
      isMuted,
      isShuffle,
      repeatMode,
      activeEngine,
      preferredEngine,
      isBuffering,
      isExpanded,
      playbackStatus,
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
      engineStarted,
      engineReady,
      setVolume,
      toggleMute,
      toggleShuffle,
      toggleRepeat,
      setPreferredEngine,
      versionCount,
      switchVersion,
      toggleExpanded,
      radioStation,
      startRadio,
      isLive,
      startLiveRadio,
      toggleLike,
      hydrateLikedTracks,
      isLiked,
      switchEngineManually,
    }),
    [
      currentTrack,
      queue,
      currentIndex,
      isPlaying,
      volume,
      isMuted,
      isShuffle,
      repeatMode,
      activeEngine,
      preferredEngine,
      isBuffering,
      isExpanded,
      playbackStatus,
      audioStreamUrl,
      likedTrackIds,
      likedLibrary.tracks,
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
      engineStarted,
      engineReady,
      setVolume,
      toggleMute,
      toggleShuffle,
      toggleRepeat,
      setPreferredEngine,
      versionCount,
      switchVersion,
      toggleExpanded,
      radioStation,
      startRadio,
      isLive,
      startLiveRadio,
      toggleLike,
      hydrateLikedTracks,
      isLiked,
      switchEngineManually
    ]
  );

  return (
    <PlaybackTimeContext.Provider value={playbackTime}>
      <AudioContext.Provider value={audioValue}>{children}</AudioContext.Provider>
    </PlaybackTimeContext.Provider>
  );
};

export const useAudio = () => {
  const context = useContext(AudioContext);
  if (!context) {
    throw new Error('useAudio must be used within an AudioProvider');
  }
  return context;
};

/** The playback clock (position and length, in seconds). Changes several times a second: use it only where it is shown. */
export const usePlaybackTime = () => useContext(PlaybackTimeContext);
