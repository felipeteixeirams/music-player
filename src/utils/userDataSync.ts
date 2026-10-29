import type { KeyValueStorage } from './scopedStorage';
import {
  diffSnapshots,
  isEmptyDiff,
  mergeSnapshots,
  readSnapshot,
  readSyncFlag,
  snapshotKey,
  writeSnapshot,
  writeSyncFlag,
  type UserDataSnapshot
} from './userData';
import { RemoteError, type Remote, type RemoteSnapshot } from './userDataRemote';

export interface SyncDeps {
  storage: KeyValueStorage;
  remote: Remote;
  /** Tells the contexts that the stored data was replaced, so they read it again. */
  onApplied: () => void;
  /** How long after a change the push waits, to send a burst of changes (adding 20 tracks) as one. */
  debounceMs?: number;
}

/**
 * Keeps the device and the account in step. The device always works on its own copy (instant, offline too);
 * this sends what changed and brings in what changed elsewhere.
 *
 * Who wins when they differ: the account, unless the device has changes it could not send yet (a flag kept in
 * storage, so it survives closing the app), in which case the device's state is sent. The first sign-in with
 * data from before accounts merges both. All work runs one step at a time.
 */
export class UserDataSync {
  /** What the account is believed to hold; null until the first successful exchange. */
  private synced: UserDataSnapshot | null = null;
  private chain: Promise<void> = Promise.resolve();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private disposed = false;
  /** The device's data when the sync started: until the account is reached, a difference from it is a change. */
  private startKey: string | null = null;

  constructor(private readonly deps: SyncDeps) {}

  start(): void {
    this.startKey = snapshotKey(this.read());
    this.enqueue(() => this.fullSync());
  }

  /** A context saved something. */
  notifyChanged(): void {
    if (this.disposed) return;
    // Marked at once, not after the wait: closing the app within it must not lose the change to the account's older copy
    const baseline = this.synced ? snapshotKey(this.synced) : this.startKey;
    if (baseline !== null && snapshotKey(this.read()) !== baseline && readSyncFlag(this.deps.storage) !== 'merge') {
      writeSyncFlag(this.deps.storage, 'local');
    }
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = null;
      this.enqueue(() => this.pushChanges());
    }, this.deps.debounceMs ?? 800);
  }

  /** The app came back to the foreground or the network returned: retry what is pending, or pick up news. */
  refresh(): void {
    this.enqueue(() => (this.synced && !readSyncFlag(this.deps.storage) ? this.pull() : this.fullSync()));
  }

  /** Resolves when everything queued so far has run (tests, and tidy shutdown). */
  idle(): Promise<void> {
    return this.chain;
  }

  dispose(): void {
    this.disposed = true;
    if (this.timer) clearTimeout(this.timer);
  }

  private enqueue(job: () => Promise<void>): void {
    this.chain = this.chain.then(() => (this.disposed ? undefined : job())).catch((error) => {
      console.warn('[Sync]', error instanceof Error ? error.message : error);
    });
  }

  private read(): UserDataSnapshot {
    return readSnapshot(this.deps.storage);
  }

  /** An account without the podcast tables says nothing about the podcasts: the device's list stands in, so it is neither wiped nor re-sent. */
  private normalize(remoteData: RemoteSnapshot): UserDataSnapshot {
    if (!remoteData.podcastsMissing) return remoteData;
    const { podcastsMissing: _missing, ...rest } = remoteData;
    return { ...rest, podcasts: this.read().podcasts };
  }

  private apply(snapshot: UserDataSnapshot): void {
    writeSnapshot(this.deps.storage, snapshot);
    this.deps.onApplied();
  }

  private async fullSync(): Promise<void> {
    const { storage, remote } = this.deps;
    const flag = readSyncFlag(storage);
    const before = snapshotKey(this.read());

    let remoteData: UserDataSnapshot;
    try {
      remoteData = this.normalize(await remote.fetchAll());
    } catch (error) {
      if (error instanceof RemoteError) return; // offline or refused: stay as is, try again later
      throw error;
    }

    const local = this.read();
    // The user changed something while the account was being read: that change must not be overwritten
    const changedMeanwhile = snapshotKey(local) !== before;

    if (flag === 'merge') {
      const merged = mergeSnapshots(local, remoteData);
      this.apply(merged);
      await this.send(remoteData, merged);
    } else if (flag === 'local' || changedMeanwhile) {
      await this.send(remoteData, local);
    } else {
      if (snapshotKey(remoteData) !== snapshotKey(local)) this.apply(remoteData);
      this.synced = remoteData;
    }
  }

  /** Brings the account to `target`. On failure the account's state stays the baseline and the flag stays set. */
  private async send(remoteData: UserDataSnapshot, target: UserDataSnapshot): Promise<void> {
    const { storage, remote } = this.deps;
    this.synced = remoteData;
    const diff = diffSnapshots(remoteData, target);
    if (isEmptyDiff(diff)) {
      writeSyncFlag(storage, null);
      this.synced = target;
      return;
    }
    writeSyncFlag(storage, 'local');
    try {
      await remote.push(diff);
    } catch (error) {
      if (error instanceof RemoteError && !error.retryable) await this.giveUpLocal(error);
      else if (!(error instanceof RemoteError)) throw error;
      return;
    }
    this.synced = target;
    // Changes made while sending are still pending
    if (snapshotKey(this.read()) === snapshotKey(target)) writeSyncFlag(storage, null);
    else this.notifyChanged();
  }

  private async pushChanges(): Promise<void> {
    if (!this.synced) return this.fullSync();
    const local = this.read();
    const diff = diffSnapshots(this.synced, local);
    if (isEmptyDiff(diff)) {
      writeSyncFlag(this.deps.storage, null);
      return;
    }
    await this.send(this.synced, local);
  }

  /** News from other devices, when this one has nothing pending. */
  private async pull(): Promise<void> {
    if (!this.synced) return this.fullSync();
    let remoteData: UserDataSnapshot;
    try {
      remoteData = this.normalize(await this.deps.remote.fetchAll());
    } catch (error) {
      if (error instanceof RemoteError) return;
      throw error;
    }
    const untouched = snapshotKey(this.read()) === snapshotKey(this.synced) && !readSyncFlag(this.deps.storage);
    if (!untouched) return;
    if (snapshotKey(remoteData) !== snapshotKey(this.synced)) this.apply(remoteData);
    this.synced = remoteData;
  }

  /** The account refused these changes for good (a limit, a malformed row): its state wins, and the device takes it. */
  private async giveUpLocal(error: RemoteError): Promise<void> {
    console.warn(`[Sync] A conta recusou as alterações (${error.message}); mantendo o que ela tem.`);
    writeSyncFlag(this.deps.storage, null);
    this.synced = null;
    await this.fullSync();
  }
}
