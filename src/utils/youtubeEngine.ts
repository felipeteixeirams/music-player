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
  prime(): void {
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
    logPlayback('player do YouTube criado no toque');

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
    if (play) this.armRetry();
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
    this.cancelRetry();
    this.stopPolling();
    if (this.ready && this.api) this.api.stopVideo();
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
    logPlayback('player do YouTube pronto');
    this.api?.setVolume(Math.round(this.volume * 100));
    if (this.queued) {
      const { id, play } = this.queued;
      this.load(id, play);
    }
  }

  private onState(state: number): void {
    if (!this.videoId) return;
    if (state === STATE.PLAYING) {
      this.started = true;
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
    const length = this.api.getDuration();
    if (Number.isFinite(length) && length > 0) {
      this.reportedLength = true;
      this.events?.loaded(length);
    }
  }

  private startPolling(): void {
    if (this.poll) return;
    this.poll = setInterval(() => {
      if (this.api) this.events?.time(this.api.getCurrentTime());
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
