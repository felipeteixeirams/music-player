/** Which YouTube videos play a track, kept on the device so playing it again waits for no network at all. */
export const RESOLVED_KEY = 'aurastream_resolved_videos_v2';
/** Before the identity gate (INV-PLAY-18) the list could hold another artist's song; it is dropped, not read. */
const OLD_KEY = 'aurastream_resolved_videos';

/** Short next to the server's (180 days): a video that goes bad is reported and dropped, and this only saves a round trip. */
const TTL_MS = 30 * 24 * 3600 * 1000;
const MAX_ENTRIES = 500;
const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;

type Stored = { ids: string[]; at: number };
type Storage = Pick<globalThis.Storage, 'getItem' | 'setItem'> & Partial<Pick<globalThis.Storage, 'removeItem'>>;

/**
 * Track id -> videos, newest last, loaded from storage and written back on every change. It is public catalog data
 * (no user in it), so it is kept under a plain key, shared by whoever uses the device.
 */
export class ResolvedStore {
  private readonly entries = new Map<string, Stored>();

  constructor(private readonly storage: Storage | null, private readonly now: () => number = Date.now) {
    this.load();
  }

  private load(): void {
    try {
      this.storage?.removeItem?.(OLD_KEY);
      const parsed: unknown = JSON.parse(this.storage?.getItem(RESOLVED_KEY) ?? '{}');
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return;
      for (const [id, value] of Object.entries(parsed as Record<string, Partial<Stored>>)) {
        const ids = Array.isArray(value?.ids) ? value.ids.filter((v): v is string => typeof v === 'string' && VIDEO_ID.test(v)) : [];
        if (ids.length > 0 && typeof value?.at === 'number' && this.now() - value.at < TTL_MS) this.entries.set(id, { ids, at: value.at });
      }
    } catch {
      // unreadable: start empty
    }
  }

  private save(): void {
    try {
      this.storage?.setItem(RESOLVED_KEY, JSON.stringify(Object.fromEntries(this.entries)));
    } catch {
      // storage that refuses (private mode, full): it lasts for this session
    }
  }

  get(trackId: string): string[] | undefined {
    const entry = this.entries.get(trackId);
    if (!entry) return undefined;
    if (this.now() - entry.at >= TTL_MS) {
      this.entries.delete(trackId);
      return undefined;
    }
    return entry.ids;
  }

  /** Only lists with videos are kept: "nothing found" is the server's to remember (for a day), not the device's. */
  set(trackId: string, ids: string[]): void {
    const valid = ids.filter((id) => VIDEO_ID.test(id));
    if (valid.length === 0) return;
    this.entries.delete(trackId);
    this.entries.set(trackId, { ids: valid, at: this.now() });
    while (this.entries.size > MAX_ENTRIES) this.entries.delete(this.entries.keys().next().value as string);
    this.save();
  }

  delete(trackId: string): void {
    if (this.entries.delete(trackId)) this.save();
  }

  get size(): number {
    return this.entries.size;
  }
}
