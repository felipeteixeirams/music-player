import type { PodcastShowSummary, Track } from '../types/music';
import type { Playlist } from './playlists';
import type { SnapshotDiff, UserDataSnapshot } from './userData';

import { createRestCaller, RemoteError, type RestConfig } from './supabaseRest';

export { RemoteError };
export type RemoteConfig = RestConfig;

/** What the account holds. `podcastsMissing`: its podcast tables are not there (the migration was not applied yet), so `podcasts` says nothing. */
export type RemoteSnapshot = UserDataSnapshot & { podcastsMissing?: true };

export interface Remote {
  fetchAll(): Promise<RemoteSnapshot>;
  push(diff: SnapshotDiff): Promise<void>;
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

/** The account's favorites, playlists and picks over Supabase's REST API (see supabaseRest.ts). */
export function createRemote(
  config: RemoteConfig,
  getUser: () => Promise<{ id: string; token: string } | null>,
  fetchImpl: typeof fetch = fetch
): Remote {
  const call = createRestCaller(config, getUser, fetchImpl);

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

  // The podcast tables come with a migration the owner applies by hand: until it is there, everything else keeps syncing
  let podcastsMissing = false;
  const ifPodcastsExist = async (job: () => Promise<void>) => {
    if (podcastsMissing) return;
    try {
      await job();
    } catch (error) {
      if (error instanceof RemoteError && error.status === 404) podcastsMissing = true;
      else throw error;
    }
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
      let follows: { show: PodcastShowSummary }[] = [];
      await ifPodcastsExist(async () => {
        follows = await selectAll<{ show: PodcastShowSummary }>('podcast_follows', 'select=show&order=created_at.asc,show_id.asc');
      });

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
        choices: Object.fromEntries(choices.map((row) => [row.track_id, row.video_id])),
        podcasts: follows.map((row) => row.show),
        ...(podcastsMissing ? { podcastsMissing: true as const } : {})
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

      await ifPodcastsExist(() =>
        upsert(
          'podcast_follows',
          'user_id,show_id',
          diff.podcastUpserts.map((show, index) => ({ user_id: userId, show_id: show.id, show, created_at: new Date(now + index).toISOString() }))
        )
      );

      for (const { playlistId, trackIds } of diff.playlistTrackRemovals) {
        for (const part of chunks(trackIds)) await remove(`/playlist_tracks?playlist_id=eq.${playlistId}&track_id=in.${inList(part)}`);
      }
      for (const part of chunks(diff.favoriteRemovals)) await remove(`/favorites?track_id=in.${inList(part)}`);
      for (const part of chunks(diff.choiceRemovals)) await remove(`/video_choices?track_id=in.${inList(part)}`);
      await ifPodcastsExist(async () => {
        for (const part of chunks(diff.podcastRemovals)) await remove(`/podcast_follows?show_id=in.${inList(part)}`);
      });
      for (const part of chunks(diff.playlistRemovals)) await remove(`/playlists?id=in.${inList(part)}`);
    }
  };
}
