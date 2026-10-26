import type { KeyValueStorage } from './scopedStorage';
import {
  applyRemoteHistory,
  clearDone,
  isClearPending,
  loadOutbox,
  markSent,
  MAX_HISTORY
} from './playHistory';
import type { HistoryRemote } from './playHistoryRemote';
import { RemoteError } from './supabaseRest';

export interface HistorySyncDeps {
  storage: KeyValueStorage;
  remote: HistoryRemote;
  /** Tells the screens that the stored list changed. */
  onApplied: () => void;
  debounceMs?: number;
}

/**
 * Sends the plays recorded on this device to the account and brings back the account's list (so another device's
 * plays show up too). Plays wait in an outbox in storage until sent, so none is lost offline or when the app closes.
 * Unlike the favorites, the history only grows: nothing here can overwrite what the account has.
 */
export class PlayHistorySync {
  private chain: Promise<void> = Promise.resolve();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private disposed = false;

  constructor(private readonly deps: HistorySyncDeps) {}

  /** On opening, and when the network or the app comes back: send what is pending, then read the account's list. */
  start(): void {
    this.enqueue(() => this.run(true));
  }
  refresh(): void {
    this.start();
  }

  /** A play was recorded (or the history cleared). */
  notifyChanged(): void {
    if (this.disposed) return;
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = null;
      this.enqueue(() => this.run(false));
    }, this.deps.debounceMs ?? 2000);
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
      console.warn('[History]', error instanceof Error ? error.message : error);
    });
  }

  private async run(pull: boolean): Promise<void> {
    const { storage, remote } = this.deps;
    try {
      if (isClearPending(storage)) {
        await remote.clear();
        clearDone(storage);
      }
      const pending = loadOutbox(storage);
      if (pending.length > 0) {
        try {
          await remote.send(pending);
        } catch (error) {
          // Rows the account refuses for good would block the rest forever: drop them
          if (error instanceof RemoteError && !error.retryable) {
            console.warn(`[History] A conta recusou ${pending.length} reprodução(ões) (${error.message}); descartadas.`);
          } else {
            throw error;
          }
        }
        markSent(storage, pending);
      }
      if (pull) {
        applyRemoteHistory(storage, await remote.fetchRecent(MAX_HISTORY));
        this.deps.onApplied();
      }
    } catch (error) {
      if (error instanceof RemoteError) return; // offline or refused for now: the outbox stays for the next try
      throw error;
    }
  }
}
