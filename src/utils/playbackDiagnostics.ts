export interface PlaybackLogEntry {
  at: number;
  text: string;
}

const MAX_ENTRIES = 60;
let entries: PlaybackLogEntry[] = [];
const listeners = new Set<() => void>();

/** What happened when a track was started, in the order it happened: the console and the Settings screen show it. */
export function logPlayback(text: string, now: number = Date.now()): void {
  // A new array on each change (never edited in place): what a screen reads keeps the same identity until something happens
  entries = [...entries, { at: now, text }].slice(-MAX_ENTRIES);
  console.log(`[Play] ${text}`);
  listeners.forEach((listener) => listener());
}

export const getPlaybackLog = (): PlaybackLogEntry[] => entries;

export function subscribePlaybackLog(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function formatPlaybackLog(list: PlaybackLogEntry[]): string {
  return list
    .map((entry) => `${new Date(entry.at).toLocaleTimeString('pt-BR')} ${entry.text}`)
    .join('\n');
}

export function clearPlaybackLog(): void {
  entries = [];
  listeners.forEach((listener) => listener());
}

export interface EnvironmentInfo {
  /** The build of the app (`__APP_VERSION__`). */
  version: string;
  /** Opened from the Home Screen icon (no address bar). */
  standalone: boolean;
  userAgent: string;
  /** This app session's code (`sessionId`): what finds the report's lines in the server's log. */
  session?: string;
}

/**
 * The line that opens a diagnostic report: which build, whether it runs as the installed app or in a browser tab,
 * and on what. "Is it the installed app or the browser?" decides whether a report is a regression or a known limit
 * (see the compatibility matrix), so it must never need asking.
 */
export function describeEnvironment({ version, standalone, userAgent, session }: EnvironmentInfo): string {
  const ios = /OS (\d+)[_.](\d+)/.exec(userAgent);
  const system = ios ? `iOS ${ios[1]}.${ios[2]}` : /Android (\d+)/.exec(userAgent) ? `Android ${/Android (\d+)/.exec(userAgent)![1]}` : 'sistema não identificado';
  const browser = /EdgiOS|EdgA|Edg\//.test(userAgent)
    ? 'Edge'
    : /CriOS|Chrome\//.test(userAgent)
    ? 'Chrome'
    : /FxiOS|Firefox\//.test(userAgent)
    ? 'Firefox'
    : /Version\/[\d.]+.*Safari/.test(userAgent)
    ? 'Safari'
    : 'WebKit';
  return `versão ${version} · ${standalone ? 'APP INSTALADO (PWA)' : 'NAVEGADOR'} · ${system} · ${browser}${session ? ` · sessão ${session}` : ''}`;
}
