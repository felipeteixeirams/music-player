import { logPlayback } from './playbackDiagnostics';

/**
 * The hidden YouTube player. One iframe lives for the whole session: it is created inside the user's tap (the only
 * moment the iPhone lets a frame start sound by itself) and every track is loaded into it with the player API, so
 * the next tracks (a queue running with the screen locked) never need a new frame or a new tap.
 */

const API_URL = 'https://www.youtube.com/iframe_api';
/** Any embeddable video: the frame needs one to exist before the real video is known. It is only cued, never played. */
const PLACEHOLDER_VIDEO = 'jNQXAC9IVRw';
const POLL_MS = 250;
const RETRY_EVERY_MS = 1500;
const MAX_RETRIES = 8;

const STATE = { UNSTARTED: -1, ENDED: 0, PLAYING: 1, PAUSED: 2, BUFFERING: 3, CUED: 5 } as const;

interface YouTubeApi {
  loadVideoById(videoId: string): void;
  cueVideoById(videoId: string): void;
  playVideo(): void;
  mute(): void;
  unMute(): void;
  isMuted(): boolean;
  getVideoData?(): { video_id?: string };
  pauseVideo(): void;
  stopVideo(): void;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  setVolume(volume: number): void;
  getCurrentTime(): number;
  getDuration(): number;
  getPlayerState(): number;
}

interface YouTubeGlobal {
  Player: new (
    element: HTMLIFrameElement,
    options: { events: { onReady: () => void; onStateChange: (event: { data: number }) => void; onError: (event: { data: number }) => void } }
  ) => YouTubeApi;
}

declare global {
  interface Window {
    YT?: YouTubeGlobal;
    onYouTubeIframeAPIReady?: () => void;
  }
}

export interface YouTubeEvents {
  /** Sound is coming out. */
  started(): void;
  ended(): void;
  /** The video cannot be played (blocked, removed) or the player cannot be loaded (code -1). */
  error(code: number): void;
  time(seconds: number): void;
  /** The video is loaded and its length is known. */
  loaded(durationSeconds: number): void;
  /** The player's length changed after `loaded` (a stale one corrected). */
  length?(durationSeconds: number): void;
}

let apiPromise: Promise<YouTubeGlobal> | null = null;

/** Loads the player API script once. A failure is forgotten, so the next call tries again. */
function loadApi(): Promise<YouTubeGlobal> {
  if (typeof window === 'undefined') return new Promise(() => undefined);
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (apiPromise) return apiPromise;

  apiPromise = new Promise<YouTubeGlobal>((resolve, reject) => {
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      if (window.YT?.Player) resolve(window.YT);
    };
    const script = document.createElement('script');
    script.src = API_URL;
    script.async = true;
    script.onerror = () => {
      apiPromise = null;
      script.remove();
      reject(new Error('YouTube player API failed to load'));
    };
    document.head.appendChild(script);
  });
  return apiPromise;
}

class YouTubeEngine {
  private events: YouTubeEvents | null = null;
  private iframe: HTMLIFrameElement | null = null;
  private api: YouTubeApi | null = null;
  private ready = false;
  private queued: { id: string; play: boolean } | null = null;
  private videoId = '';
  private wantPlay = false;
  private volume = 1;
  private reportedLength = false;
  private poll: ReturnType<typeof setInterval> | null = null;
  private retry: ReturnType<typeof setTimeout> | null = null;
  private retries = 0;
  private started = false;
  private createdAt = 0;
  /** The frame is playing a video right now (the real one or the reserve): then it needs no release for the next load. */
  private playing = false;
  /** The reserve video was started by a tap and has not been replaced by the real video yet: its events are not the track's. */
  private unlockPending = false;
  /** The last length told to the screen, to notice when the player's own answer changes (the old video's length can linger). */
  private lastLength = 0;
  /** The sound is off only because of the reserve video; it goes back on with the real one. */
  private mutedByUs = false;

  setEvents(events: YouTubeEvents | null): void {
    this.events = events;
  }

  /** Starts downloading the player API (no frame yet). */
  preload(): void {
    loadApi().catch(() => undefined);
  }

  /**
   * Creates the frame now. Called inside the user's tap: a frame made at that moment may start sound by itself later,
   * a frame made seconds afterwards (once the network answered) is refused by the iPhone.
   */
  prime(origin: 'toque' | 'abertura' = 'toque'): void {
    if (this.iframe || typeof document === 'undefined') return;
    const params = new URLSearchParams({
      enablejsapi: '1',
      origin: window.location.origin,
      playsinline: '1',
      controls: '0',
      disablekb: '1',
      fs: '0',
      modestbranding: '1',
      rel: '0',
      autoplay: '0'
    });
    const iframe = document.createElement('iframe');
    iframe.src = `https://www.youtube.com/embed/${PLACEHOLDER_VIDEO}?${params}`;
    iframe.allow = 'autoplay; encrypted-media; picture-in-picture';
    iframe.title = 'Player de áudio';
    iframe.setAttribute('aria-hidden', 'true');
    iframe.width = '320';
    iframe.height = '180';
    // In the viewport, under the interface: a frame moved off screen is throttled and refused by the embed rules
    Object.assign(iframe.style, {
      position: 'fixed',
      bottom: '0',
      right: '0',
      opacity: '0.001',
      pointerEvents: 'none',
      zIndex: '-50',
      clipPath: 'inset(100%)',
      border: '0'
    });
    document.body.appendChild(iframe);
    this.iframe = iframe;
    this.createdAt = performance.now();
    // How long the app had been open tells whether a tap beat the opening one (the report keeps the order of events)
    logPlayback(`player do YouTube criado ${origin === 'abertura' ? 'ao abrir o app' : 'no toque'} (${Math.round(this.createdAt)} ms depois de a página abrir)`);

    // Touches the iPhone accepts as a user gesture for media: touchend and click (pointerup is not certain to count)
    for (const type of ['pointerup', 'touchend', 'click']) document.addEventListener(type, this.nudge, true);

    loadApi()
      .then((YT) => {
        if (this.iframe !== iframe) return;
        this.api = new YT.Player(iframe, {
          events: {
            onReady: () => this.onReady(),
            onStateChange: (event) => this.onState(event.data),
            onError: (event) => this.onError(event.data)
          }
        });
      })
      .catch(() => {
        logPlayback('o player do YouTube não carregou (script bloqueado ou sem rede)');
        this.events?.error(-1);
      });
  }

  /** Plays this video (or only cues it, when `play` is false). Creates the frame if the tap had not. */
  load(videoId: string, play: boolean): void {
    this.prime();

    this.videoId = videoId;
    this.wantPlay = play;
    this.unlockPending = false;
    this.lastLength = 0;
    this.reportedLength = false;
    this.started = false;
    this.cancelRetry();
    if (!this.ready || !this.api) {
      this.queued = { id: videoId, play };
      return;
    }
    this.queued = null;
    if (play) this.api.loadVideoById(videoId);
    else this.api.cueVideoById(videoId);
    // The reserve video (if one was playing) was only muted to be unheard: the real one has sound
    this.restoreSound();
    if (play) this.armRetry();
  }

  /**
   * Called inside the tap that starts a track whose video is not known yet. The iPhone lets a video load and play only
   * when a tap started playing in that frame: the search for the video ends after the tap, and a video loaded then is
   * not even buffered (reports of 2026-10-28: no "loaded" event, six silent seconds). So the tap starts the frame's own
   * reserve video, muted and unheard, and the real video is loaded into the same frame when it is found. Once any play
   * was started by a tap this is not needed again in the session.
   */
  unlockPlayback(): boolean {
    // A frame that is playing needs nothing: it takes the next video by itself. One that is idle, paused or was taken
    // away by the system (a call, the app in the background) must be released again by this tap: the permission of an
    // earlier tap does not last (report of 2026-10-28: the second new track of a session failed again)
    if (this.playing || this.unlockPending) return false;
    if (!this.ready || !this.api) {
      logPlayback('o player do YouTube ainda não estava pronto no toque: a faixa nova pode precisar de outro toque');
      return false;
    }
    this.mutedByUs = true;
    this.unlockPending = true;
    this.api.mute();
    this.api.playVideo();
    logPlayback('player do YouTube liberado no toque (vídeo-reserva mudo, até a busca do vídeo terminar)');
    return true;
  }

  private restoreSound(): void {
    if (!this.mutedByUs || !this.api) return;
    this.mutedByUs = false;
    this.api.unMute();
  }

  play(): void {
    this.wantPlay = true;
    if (!this.videoId) return;
    if (this.queued) this.queued.play = true;
    if (!this.ready || !this.api) return;
    this.api.playVideo();
    if (!this.started) this.armRetry();
  }

  pause(): void {
    this.wantPlay = false;
    // The tap that releases the frame starts the reserve video, and the track change pauses what played before: that
    // pause must not undo the release
    if (this.unlockPending) return;
    this.cancelRetry();
    if (this.queued) this.queued.play = false;
    if (this.ready && this.api && this.videoId) this.api.pauseVideo();
  }

  /** Nothing to play any more (the preview or another engine took over). */
  stop(): void {
    this.wantPlay = false;
    this.videoId = '';
    this.queued = null;
    this.started = false;
    this.unlockPending = false;
    this.playing = false;
    this.cancelRetry();
    this.stopPolling();
    if (this.ready && this.api) {
      this.api.stopVideo();
      this.restoreSound();
    }
  }

  seekTo(seconds: number): void {
    if (this.ready && this.api && this.videoId) this.api.seekTo(seconds, true);
  }

  setVolume(volume: number): void {
    this.volume = volume;
    if (this.ready && this.api) this.api.setVolume(Math.round(volume * 100));
  }

  private onReady(): void {
    this.ready = true;
    logPlayback(`player do YouTube pronto (${Math.round(performance.now() - this.createdAt)} ms depois de criado)`);
    this.api?.setVolume(Math.round(this.volume * 100));
    if (this.queued) {
      const { id, play } = this.queued;
      this.load(id, play);
    }
  }

  private onState(state: number): void {
    this.playing = state === STATE.PLAYING;
    if (!this.videoId) return;
    if (state === STATE.PLAYING) {
      // The reserve video playing under the tap is not the track starting
      if (this.unlockPending) return;
      // A late "playing" of the reserve video is not the track's
      const playing = this.api?.getVideoData?.().video_id;
      if (playing && playing !== this.videoId) return;
      this.started = true;
      // The sound must be on now: a track that "plays" muted would look right and be silent
      if (this.api?.isMuted?.() && !this.mutedByUs) {
        logPlayback('o player do YouTube começou com o som desligado: religando');
        this.api.unMute();
      }
      this.cancelRetry();
      this.reportLength();
      this.startPolling();
      this.events?.started();
    } else if (state === STATE.BUFFERING || state === STATE.CUED) {
      this.reportLength();
    } else if (state === STATE.ENDED) {
      this.stopPolling();
      this.events?.ended();
    } else if (state === STATE.PAUSED) {
      this.stopPolling();
    }
  }

  private onError(code: number): void {
    // The placeholder is not the user's music: its failure means nothing
    if (!this.videoId) return;
    this.cancelRetry();
    this.stopPolling();
    this.events?.error(code);
  }

  private reportLength(): void {
    if (this.reportedLength || !this.api) return;
    // Right after a video is loaded the player may still answer with the length of the one before it (the reserve video
    // is 19 s: the bar then ended at 0:19 of a six-minute track)
    const loadedId = this.api.getVideoData?.().video_id;
    if (loadedId && this.videoId && loadedId !== this.videoId) return;
    const length = this.api.getDuration();
    if (Number.isFinite(length) && length > 0) {
      this.reportedLength = true;
      this.lastLength = length;
      this.events?.loaded(length);
    }
  }

  private startPolling(): void {
    if (this.poll) return;
    this.poll = setInterval(() => {
      if (!this.api) return;
      this.events?.time(this.api.getCurrentTime());
      // The player's own length can change after it was first told (see `reportLength`): the screen follows it
      const length = this.api.getDuration();
      if (this.lastLength > 0 && Number.isFinite(length) && length > 0 && Math.abs(length - this.lastLength) > 1) {
        this.lastLength = length;
        this.events?.length?.(length);
      }
    }, POLL_MS);
  }

  private stopPolling(): void {
    if (this.poll) clearInterval(this.poll);
    this.poll = null;
  }

  /**
   * The browser may refuse the automatic start. Asking again is free: it is tried a few times without any screen
   * change, and the next touch anywhere in the app (a tap the browser accepts) tries once more.
   */
  private armRetry(): void {
    this.cancelRetry();
    this.retries = 0;
    const attempt = () => {
      this.retry = null;
      if (!this.wantPlay || this.started || !this.api || !this.ready || !this.videoId) return;
      if (this.retries >= MAX_RETRIES) {
        logPlayback('o player do YouTube não começou depois de várias tentativas; o próximo toque tenta de novo');
        return;
      }
      this.retries += 1;
      logPlayback(`nova tentativa de iniciar o player do YouTube (${this.retries})`);
      this.api.playVideo();
      this.retry = setTimeout(attempt, RETRY_EVERY_MS);
    };
    this.retry = setTimeout(attempt, RETRY_EVERY_MS);
  }

  private cancelRetry(): void {
    if (this.retry) clearTimeout(this.retry);
    this.retry = null;
  }

  private lastNudgeAt = 0;

  private nudge = (): void => {
    if (!this.wantPlay || this.started || !this.api || !this.ready || !this.videoId) return;
    // One touch raises pointerup, touchend and click: one attempt per touch
    const now = performance.now();
    if (now - this.lastNudgeAt < 600) return;
    this.lastNudgeAt = now;
    logPlayback('toque na tela: tentando iniciar o player do YouTube');
    this.api.playVideo();
  };
}

export const youtubeEngine = new YouTubeEngine();

/** The video id inside a YouTube watch address (empty when there is none). */
export function videoIdFromUrl(url: string): string {
  const match = /[?&]v=([A-Za-z0-9_-]{11})/.exec(url);
  return match ? match[1] : '';
}
