import { createRestCaller, RemoteError, type RestConfig } from './supabaseRest';
import { isEpisodeRef, type ProgressMap } from './podcastProgress';

export interface ProgressRemote {
  fetchAll(): Promise<ProgressMap>;
  push(entries: ProgressMap): Promise<void>;
}

interface Row {
  episode_id: string;
  show_id: string;
  position: number;
  duration: number;
  done: boolean;
  episode: unknown;
  updated_at: string;
}

const CHUNK = 100;

/** The account's podcast progress over Supabase's REST API (see supabaseRest.ts). Only the entries that carry their episode. */
export function createProgressRemote(
  config: RestConfig,
  getUser: () => Promise<{ id: string; token: string } | null>,
  fetchImpl: typeof fetch = fetch
): ProgressRemote {
  const call = createRestCaller(config, getUser, fetchImpl);
  return {
    async fetchAll() {
      const response = await call('/podcast_progress?select=episode_id,show_id,position,duration,done,episode,updated_at&order=updated_at.desc&limit=300');
      const rows = (await response.json()) as Row[];
      const map: ProgressMap = {};
      for (const row of rows) {
        const updatedAt = Date.parse(row.updated_at);
        if (!Number.isFinite(updatedAt) || !isEpisodeRef(row.episode)) continue;
        map[row.episode_id] = { position: row.position, duration: row.duration, updatedAt, ...(row.done ? { done: true } : {}), episode: row.episode };
      }
      return map;
    },

    async push(entries) {
      const user = await getUser();
      if (!user) throw new RemoteError('Sem sessão', 401);
      const rows = Object.entries(entries)
        .filter(([, entry]) => entry.episode)
        .map(([id, entry]) => ({
          user_id: user.id,
          episode_id: id,
          show_id: entry.episode!.showId,
          position: Math.max(0, Math.round(entry.position)),
          duration: Math.max(0, Math.round(entry.duration)),
          done: Boolean(entry.done),
          episode: entry.episode,
          updated_at: new Date(entry.updatedAt).toISOString()
        }));
      for (let i = 0; i < rows.length; i += CHUNK) {
        await call('/podcast_progress?on_conflict=user_id,episode_id', {
          method: 'POST',
          body: JSON.stringify(rows.slice(i, i + CHUNK)),
          prefer: 'resolution=merge-duplicates,return=minimal'
        });
      }
    }
  };
}
