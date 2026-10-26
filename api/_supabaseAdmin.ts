type Env = Record<string, string | undefined>;

/** Server-only access to the database with the service role, which bypasses the row-level security. Never sent to the browser. */
export interface AdminConfig {
  url: string;
  serviceKey: string;
}

export function adminConfigFromEnv(env: Env = process.env): AdminConfig | null {
  const url = env.DATABASE_SUPABASE_URL || env.SUPABASE_URL;
  const serviceKey = env.DATABASE_SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
  return url && serviceKey ? { url: url.replace(/\/+$/, ''), serviceKey } : null;
}

export interface CachedVideos {
  videoIds: string[];
  resolvedAt: number;
}

/** What the resolve route needs from the database. */
export interface Admin {
  getCached(key: string): Promise<CachedVideos | null>;
  /** Several keys in one round trip; the keys with nothing cached are missing from the answer. */
  getCachedMany(keys: string[]): Promise<Record<string, CachedVideos>>;
  putCached(key: string, videoIds: string[], now: number): Promise<void>;
  deleteCached(key: string): Promise<void>;
  /** The user's count for today including this one, or -1 when the daily limit was already reached. */
  consume(userId: string, limit: number): Promise<number>;
  refund(userId: string): Promise<void>;
  usedToday(userId: string, now: number): Promise<number>;
}

/** Today's date in São Paulo, the day the quota counts in (same as the SQL function). */
export function saoPauloDay(now: number): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(now);
}

export function createAdmin(config: AdminConfig, fetchImpl: typeof fetch = fetch): Admin {
  const base = `${config.url}/rest/v1`;

  async function call(path: string, init: RequestInit & { prefer?: string } = {}): Promise<Response> {
    const response = await fetchImpl(`${base}${path}`, {
      ...init,
      headers: {
        apikey: config.serviceKey,
        Authorization: `Bearer ${config.serviceKey}`,
        'Content-Type': 'application/json',
        ...(init.prefer ? { Prefer: init.prefer } : {})
      },
      signal: AbortSignal.timeout(5000)
    });
    if (!response.ok) throw new Error(`Supabase HTTP ${response.status} em ${path.split('?')[0]}`);
    return response;
  }

  const eq = (value: string) => encodeURIComponent(`eq.${value}`);

  return {
    async getCached(key) {
      const rows = (await (await call(`/video_cache?select=video_ids,resolved_at&track_id=${eq(key)}`)).json()) as {
        video_ids: string[];
        resolved_at: string;
      }[];
      return rows[0] ? { videoIds: rows[0].video_ids, resolvedAt: Date.parse(rows[0].resolved_at) } : null;
    },
    async getCachedMany(keys) {
      if (keys.length === 0) return {};
      const list = encodeURIComponent(`(${keys.map((k) => `"${k.replace(/"/g, '')}"`).join(',')})`);
      const rows = (await (await call(`/video_cache?select=track_id,video_ids,resolved_at&track_id=in.${list}`)).json()) as {
        track_id: string;
        video_ids: string[];
        resolved_at: string;
      }[];
      return Object.fromEntries(rows.map((row) => [row.track_id, { videoIds: row.video_ids, resolvedAt: Date.parse(row.resolved_at) }]));
    },
    async putCached(key, videoIds, now) {
      await call('/video_cache?on_conflict=track_id', {
        method: 'POST',
        body: JSON.stringify({ track_id: key, video_ids: videoIds, resolved_at: new Date(now).toISOString() }),
        prefer: 'resolution=merge-duplicates,return=minimal'
      });
    },
    async deleteCached(key) {
      await call(`/video_cache?track_id=${eq(key)}`, { method: 'DELETE', prefer: 'return=minimal' });
    },
    async consume(userId, limit) {
      const response = await call('/rpc/consume_resolve', { method: 'POST', body: JSON.stringify({ p_user: userId, p_limit: limit }) });
      return Number(await response.json());
    },
    async refund(userId) {
      await call('/rpc/refund_resolve', { method: 'POST', body: JSON.stringify({ p_user: userId }) });
    },
    async usedToday(userId, now) {
      const rows = (await (
        await call(`/usage_daily?select=resolves&user_id=${eq(userId)}&day=${eq(saoPauloDay(now))}`)
      ).json()) as { resolves: number }[];
      return rows[0]?.resolves ?? 0;
    }
  };
}
