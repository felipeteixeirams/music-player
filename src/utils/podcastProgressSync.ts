import type { KeyValueStorage } from './scopedStorage';
import { applyRemoteProgress, markDirty, readProgress, takeDirty, type ProgressMap } from './podcastProgress';
import type { ProgressRemote } from './podcastProgressRemote';
import { RemoteError } from './supabaseRest';

export interface ProgressSyncDeps {
  storage: KeyValueStorage;
  remote: ProgressRemote;
  /** How long after a save the send waits: progress is saved every few seconds, and one send covers many. */
  debounceMs?: number;
}

/**
 * Keeps where the person stopped in each episode in step with the account: what was saved here goes up (a little after
 * the saving, when the app is hidden, and when it opens), and what another device saved comes down when it is newer
 * (the newest save of each episode wins). A failure keeps the episodes marked, to try again; an account without the
 * podcast tables (the migration not applied yet) turns this off for the session.
 */
export class PodcastProgressSync {
  private chain: Promise<void> = Promise.resolve();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private disposed = false;
  private unavailable = false;

  constructor(private readonly deps: ProgressSyncDeps) {}

  /** On opening, and when the app or the network comes back: bring in the account's news and send what is ahead of it. */
  start(): void {
    this.enqueue(() => this.run(true));
  }
  refresh(): void {
    this.start();
  }

  /** Something was saved. */
  notifyChanged(): void {
    if (this.disposed || this.unavailable) return;
    if (this.timer) return; // already waiting: this save rides along
    this.timer = setTimeout(() => {
      this.timer = null;
      this.enqueue(() => this.run(false));
    }, this.deps.debounceMs ?? 20_000);
  }

  /** The app is going away: send now. */
  flush(): void {
    if (this.disposed || this.unavailable) return;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.enqueue(() => this.run(false));
  }

  idle(): Promise<void> {
    return this.chain;
  }

  dispose(): void {
    this.disposed = true;
    if (this.timer) clearTimeout(this.timer);
  }

  private enqueue(job: () => Promise<void>): void {
    this.chain = this.chain.then(() => (this.disposed ? undefined : job())).catch((error) => {
      console.warn('[Podcast]', error instanceof Error ? error.message : error);
    });
  }

  private async run(pull: boolean): Promise<void> {
    if (this.unavailable) return;
    const { storage, remote } = this.deps;
    let account: ProgressMap | null = null;
    try {
      if (pull) {
        account = await remote.fetchAll();
        applyRemoteProgress(storage, account);
      }
      const local = readProgress(storage);
      const ids = new Set(takeDirty());
      // On opening, what this device saved while the app was closed or offline is ahead of the account too
      if (account) for (const [id, entry] of Object.entries(local)) if (!account[id] || entry.updatedAt > account[id].updatedAt) ids.add(id);
      if (ids.size === 0) return;
      const entries: ProgressMap = {};
      for (const id of ids) if (local[id]) entries[id] = local[id];
      try {
        await remote.push(entries);
      } catch (error) {
        markDirty([...ids]);
        throw error;
      }
    } catch (error) {
      if (error instanceof RemoteError) {
        if (error.status === 404) this.unavailable = true;
        return; // offline or refused: the entries stay marked, the next run tries again
      }
      throw error;
    }
  }
}
