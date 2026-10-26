import type { Track } from '../types/music';
import type { PlayEntry } from './playHistory';
import { createRestCaller, RemoteError, type RestConfig } from './supabaseRest';

export interface HistoryRemote {
  /** The latest plays on the account, newest first. */
  fetchRecent(limit: number): Promise<PlayEntry[]>;
  send(entries: PlayEntry[]): Promise<void>;
  clear(): Promise<void>;
}

const CHUNK = 100;

export function createHistoryRemote(
  config: RestConfig,
  getUser: () => Promise<{ id: string; token: string } | null>,
  fetchImpl: typeof fetch = fetch
): HistoryRemote {
  const call = createRestCaller(config, getUser, fetchImpl);

  return {
    async fetchRecent(limit) {
      const response = await call(`/play_history?select=track,played_at&order=played_at.desc,id.desc&limit=${limit}`);
      const rows = (await response.json()) as { track: Track; played_at: string }[];
      return rows.map((row) => ({ track: row.track, playedAt: Date.parse(row.played_at) || 0 }));
    },

    async send(entries) {
      const user = await getUser();
      if (!user) throw new RemoteError('Sem sessão', 401);
      for (let i = 0; i < entries.length; i += CHUNK) {
        await call('/play_history', {
          method: 'POST',
          body: JSON.stringify(
            entries.slice(i, i + CHUNK).map((e) => ({
              user_id: user.id,
              track_id: e.track.id,
              track: e.track,
              played_at: new Date(e.playedAt).toISOString()
            }))
          ),
          prefer: 'return=minimal'
        });
      }
    },

    async clear() {
      const user = await getUser();
      await call(`/play_history?user_id=eq.${user?.id ?? ''}`, { method: 'DELETE', prefer: 'return=minimal' });
    }
  };
}
