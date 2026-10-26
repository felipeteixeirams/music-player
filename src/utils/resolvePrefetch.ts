export interface PrefetchTrack {
  id: string;
  artist: string;
  title: string;
  duration: number;
}

export interface LookupQueueOptions {
  /** Asks the server which of these tracks already have a video in the shared cache: id -> videos (found ones only). */
  send: (items: PrefetchTrack[]) => Promise<Record<string, string[]>>;
  onFound: (trackId: string, videoIds: string[]) => void;
  /** Tracks whose videos are already known on the device: not asked again. */
  isKnown: (trackId: string) => boolean;
  delayMs?: number;
  maxBatch?: number;
  schedule?: (callback: () => void, ms: number) => unknown;
  cancel?: (handle: unknown) => void;
}

/**
 * Collects the tracks that appear on the screen (several lists at once on the Home) and asks the server about them in
 * a single request after a short pause. Each track is asked about once per session. The answer only ever comes from
 * the cache: no search, no quota, so it costs nothing on YouTube's side.
 */
export function createLookupQueue(options: LookupQueueOptions) {
  const { send, onFound, isKnown } = options;
  const delayMs = options.delayMs ?? 300;
  const maxBatch = options.maxBatch ?? 40;
  const schedule = options.schedule ?? ((callback, ms) => setTimeout(callback, ms));
  const cancel = options.cancel ?? ((handle) => clearTimeout(handle as ReturnType<typeof setTimeout>));

  const pending = new Map<string, PrefetchTrack>();
  const asked = new Set<string>();
  let timer: unknown = null;
  let sending = false;

  const flush = async (): Promise<void> => {
    timer = null;
    if (sending) {
      timer = schedule(flush, delayMs);
      return;
    }
    const batch = [...pending.values()].slice(0, maxBatch);
    batch.forEach((track) => pending.delete(track.id));
    if (batch.length === 0) return;

    sending = true;
    try {
      const found = await send(batch);
      for (const [id, ids] of Object.entries(found)) if (ids.length > 0) onFound(id, ids);
    } catch {
      // No network or the server said no: these are asked about again the next time they show up
      batch.forEach((track) => asked.delete(track.id));
    } finally {
      sending = false;
      if (pending.size > 0 && timer === null) timer = schedule(flush, delayMs);
    }
  };

  return {
    enqueue(tracks: PrefetchTrack[]): void {
      let added = false;
      for (const track of tracks) {
        if (asked.has(track.id) || pending.has(track.id) || isKnown(track.id)) continue;
        asked.add(track.id);
        pending.set(track.id, track);
        added = true;
      }
      if (added && timer === null) timer = schedule(flush, delayMs);
    },
    /** For tests and shutdown. */
    stop(): void {
      if (timer !== null) cancel(timer);
      timer = null;
      pending.clear();
    }
  };
}
