import type { Track } from '../types/music';
import type { Playlist } from './playlists';
import type { SnapshotDiff, UserDataSnapshot } from './userData';

export interface RemoteConfig {
  url: string;
  key: string;
}

export interface Remote {
  fetchAll(): Promise<UserDataSnapshot>;
  push(diff: SnapshotDiff): Promise<void>;
}

/** A refused call. `retryable` is false for answers that will not change by trying again (a limit, a bad row). */
export class RemoteError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }

  get retryable(): boolean {
    return this.status === 0 || this.status === 401 || this.status === 408 || this.status === 429 || this.status >= 500;
  }
}

const PAGE = 1000;
const CHUNK = 100;

const chunks = <T,>(items: T[]): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += CHUNK) out.push(items.slice(i, i + CHUNK));
  return out;
};

/** A PostgREST `in` filter value: `("a","b")`. */
const inList = (values: string[]) => encodeURIComponent(`(${values.map((v) => `"${v.replace(/"/g, '')}"`).join(',')})`);

/**
 * The account's data over Supabase's REST API, with the signed-in user's token: the row-level security policies
 * (supabase/migrations) are what keep each person to their own rows. No server code in between.
 */
export function createRemote(
  config: RemoteConfig,
  getUser: () => Promise<{ id: string; token: string } | null>,
  fetchImpl: typeof fetch = fetch
): Remote {
  const base = `${config.url}/rest/v1`;

  async function call(path: string, init: RequestInit & { prefer?: string } = {}): Promise<Response> {
    const user = await getUser();
    if (!user) throw new RemoteError('Sem sessão', 401);
    let response: Response;
    try {
      response = await fetchImpl(`${base}${path}`, {
        ...init,
        headers: {
          apikey: config.key,
          Authorization: `Bearer ${user.token}`,
          'Content-Type': 'application/json',
          ...(init.prefer ? { Prefer: init.prefer } : {})
        },
        signal: AbortSignal.timeout(20_000)
      });
    } catch {
      throw new RemoteError('Sem conexão', 0);
    }
    if (!response.ok) throw new RemoteError(`Falha ${response.status} em ${path.split('?')[0]}`, response.status);
    return response;
  }

  async function selectAll<T>(table: string, query: string): Promise<T[]> {
    const rows: T[] = [];
    for (let offset = 0; ; offset += PAGE) {
      const response = await call(`/${table}?${query}&limit=${PAGE}&offset=${offset}`);
      const page = (await response.json()) as T[];
      rows.push(...page);
      if (page.length < PAGE) return rows;
    }
  }

  const upsert = async (table: string, conflict: string, rows: object[]) => {
    for (const part of chunks(rows)) {
      await call(`/${table}?on_conflict=${conflict}`, {
        method: 'POST',
        body: JSON.stringify(part),
        prefer: 'resolution=merge-duplicates,return=minimal'
      });
    }
  };

  const remove = async (path: string) => {
    await call(path, { method: 'DELETE', prefer: 'return=minimal' });
  };

  return {
    async fetchAll() {
      const [favorites, playlists, playlistTracks, choices] = await Promise.all([
        selectAll<{ track: Track }>('favorites', 'select=track&order=created_at.asc,track_id.asc'),
        selectAll<{ id: string; name: string; created_at: string }>('playlists', 'select=id,name,created_at&order=created_at.asc,id.asc'),
        selectAll<{ playlist_id: string; track: Track; position: number }>(
          'playlist_tracks',
          'select=playlist_id,track,position&order=playlist_id.asc,position.asc,track_id.asc'
        ),
        selectAll<{ track_id: string; video_id: string }>('video_choices', 'select=track_id,video_id')
      ]);

      const byPlaylist = new Map<string, Track[]>();
      for (const row of playlistTracks) byPlaylist.set(row.playlist_id, [...(byPlaylist.get(row.playlist_id) ?? []), row.track]);
      return {
        favorites: favorites.map((row) => row.track),
        playlists: playlists.map<Playlist>((p) => ({
          id: p.id,
          name: p.name,
          createdAt: Date.parse(p.created_at) || 0,
          tracks: byPlaylist.get(p.id) ?? []
        })),
        choices: Object.fromEntries(choices.map((row) => [row.track_id, row.video_id]))
      };
    },

    async push(diff) {
      const user = await getUser();
      if (!user) throw new RemoteError('Sem sessão', 401);
      const userId = user.id;

      await upsert(
        'playlists',
        'id',
        diff.playlistUpserts.map((p) => ({ id: p.id, user_id: userId, name: p.name, created_at: new Date(p.createdAt).toISOString() }))
      );
      await upsert(
        'playlist_tracks',
        'playlist_id,track_id',
        diff.playlistTrackUpserts.map((t) => ({ playlist_id: t.playlistId, track_id: t.track.id, track: t.track, position: t.position }))
      );
      // The account orders favorites by when they were added: a batch keeps its local order
      const now = Date.now();
      await upsert(
        'favorites',
        'user_id,track_id',
        diff.favoriteUpserts.map((track, index) => ({
          user_id: userId,
          track_id: track.id,
          track,
          created_at: new Date(now + index).toISOString()
        }))
      );
      await upsert(
        'video_choices',
        'user_id,track_id',
        diff.choiceUpserts.map((c) => ({ user_id: userId, track_id: c.trackId, video_id: c.videoId }))
      );

      for (const { playlistId, trackIds } of diff.playlistTrackRemovals) {
        for (const part of chunks(trackIds)) await remove(`/playlist_tracks?playlist_id=eq.${playlistId}&track_id=in.${inList(part)}`);
      }
      for (const part of chunks(diff.favoriteRemovals)) await remove(`/favorites?track_id=in.${inList(part)}`);
      for (const part of chunks(diff.choiceRemovals)) await remove(`/video_choices?track_id=in.${inList(part)}`);
      for (const part of chunks(diff.playlistRemovals)) await remove(`/playlists?id=in.${inList(part)}`);
    }
  };
}
