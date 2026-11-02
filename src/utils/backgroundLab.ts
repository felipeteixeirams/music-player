/**
 * Background lab (administrator only): isolated cases to find out what the installed iPhone app lets keep playing
 * when it leaves the screen. Each case plays one thing (or two) and writes a timed report to paste into a bug report.
 * The cases are data, so a report names the case exactly and the tests can check the matrix.
 */

export type LabAudio = 'radio' | 'silent' | null;
export type LabFrame = 'visible' | 'hidden' | null;

export interface LabCase {
  id: string;
  label: string;
  detail: string;
  audio: LabAudio;
  frame: LabFrame;
}

/** What each case isolates. A and D are controls: their result is already measured (INV-PLAY-24/25, compatibility matrix). */
export const LAB_CASES: readonly LabCase[] = [
  { id: 'A', label: 'A · Rádio (áudio nativo)', detail: 'Controle: o iPhone já deixou tocar em segundo plano.', audio: 'radio', frame: null },
  { id: 'B', label: 'B · Só silêncio em loop', detail: 'Um elemento de áudio mudo, sozinho, sobrevive ao sair do app?', audio: 'silent', frame: null },
  { id: 'C', label: 'C · YouTube visível', detail: 'O vídeo aparece na tela (320 x 180). O iframe visível se comporta diferente do oculto?', audio: null, frame: 'visible' },
  { id: 'D', label: 'D · YouTube oculto (como o app)', detail: 'Controle: oculto como no app (quase transparente, recortado). Já pausou 0 s depois de sair.', audio: null, frame: 'hidden' },
  { id: 'F', label: 'F · Rádio + YouTube oculto', detail: 'Um áudio nativo tocando som de verdade protege o iframe, ou um pausa o outro?', audio: 'radio', frame: 'hidden' },
  { id: 'G', label: 'G · Silêncio + YouTube oculto', detail: 'A combinação que falhou no app (o elemento mudo foi pausado pelo sistema).', audio: 'silent', frame: 'hidden' }
] as const;

export interface LabOptions {
  /** Ask for `navigator.audioSession.type = 'playback'` before starting. */
  audioSessionPlayback: boolean;
  /** Publish Media Session metadata and `playbackState = 'playing'` (the lock screen controls). */
  mediaSession: boolean;
}

export const DEFAULT_LAB_OPTIONS: LabOptions = { audioSessionPlayback: false, mediaSession: false };

/** SomaFM Groove Salad (public Icecast stream); the field in the lab accepts any other address. */
export const DEFAULT_RADIO_URL = 'https://ice1.somafm.com/groovesalad-128-mp3';
/**
 * A video that allows embedding anywhere (3:32, long enough for a 30 s test). The first choice, a live stream
 * (`5qap5aO4i9A`), answered error 150 in the app on 2026-11-02: its owner does not allow embedding.
 */
export const DEFAULT_VIDEO_ID = 'dQw4w9WgXcQ';

/** Length of the silent file of case B and G: longer than any test, so the audio never wraps around and its clock stays honest. */
export const SILENT_SECONDS = 600;

export function findLabCase(id: string): LabCase | undefined {
  return LAB_CASES.find((entry) => entry.id === id);
}

/** A YouTube video id typed or pasted by hand: the 11 characters, or a watch/short address that holds them. */
export function parseVideoId(text: string): string | null {
  const value = text.trim();
  if (/^[\w-]{11}$/.test(value)) return value;
  const match = /(?:v=|youtu\.be\/|embed\/|shorts\/)([\w-]{11})(?:[?&#/]|$)/.exec(value);
  return match ? match[1] : null;
}

/** Only http(s) addresses are played: the field is for a stream, not for anything the browser can open. */
export function parseStreamUrl(text: string): string | null {
  try {
    const url = new URL(text.trim());
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : null;
  } catch {
    return null;
  }
}

export interface LabLine {
  /** Milliseconds since the case started. */
  at: number;
  text: string;
}

export function formatLabClock(milliseconds: number): string {
  const total = Math.max(0, milliseconds) / 1000;
  const minutes = Math.floor(total / 60);
  const seconds = total - minutes * 60;
  return `${String(minutes).padStart(2, '0')}:${seconds.toFixed(1).padStart(4, '0')}`;
}

/** The text to paste: environment, the case and options, then the timed lines. */
export function formatLabReport(environment: string, labCase: LabCase, options: LabOptions, extra: string[], lines: readonly LabLine[]): string {
  const header = [
    environment,
    `caso ${labCase.id}: ${labCase.label.replace(/^[A-Z] · /, '')}`,
    `opções: audioSession playback ${options.audioSessionPlayback ? 'sim' : 'não'}; mediaSession ${options.mediaSession ? 'sim' : 'não'}`,
    ...extra
  ];
  return [...header, ...lines.map((line) => `${formatLabClock(line.at)} ${line.text}`)].join('\n');
}

/** Seconds a counter moved between two readings, to one decimal; `?` when one of them is unknown. */
export function describeAdvance(before: number | null, after: number | null): string {
  if (before === null || after === null || !Number.isFinite(before) || !Number.isFinite(after)) return '?';
  return `${(after - before).toFixed(1)} s`;
}

/** One touch raises pointerup, touchend and click: one attempt to start the video per touch (as the app's own player does). */
export const NUDGE_INTERVAL_MS = 600;

export function shouldNudge(videoStarted: boolean, lastNudgeAt: number, now: number): boolean {
  return !videoStarted && now - lastNudgeAt >= NUDGE_INTERVAL_MS;
}
