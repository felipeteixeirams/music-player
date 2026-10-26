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
