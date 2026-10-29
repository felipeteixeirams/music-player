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
  /** The shared state of a third-party service (the YouTube search breaker): null when none or already over. */
  getServiceState(key: string): Promise<{ until: number; reason: string } | null>;
  setServiceState(key: string, until: number, reason: string): Promise<void>;
  /** For the administrator panel: every person's count of new tracks on a São Paulo day (user id -> count). */
  usageByDay(day: string): Promise<Record<string, number>>;
  /** How many tracks the shared video cache holds. */
  cacheCount(): Promise<number>;
  /** The accounts (id -> e-mail), from the auth admin API. */
  listUsers(): Promise<Record<string, string>>;
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
    async getServiceState(key) {
      const rows = (await (await call(`/service_state?select=until,reason&key=${eq(key)}`)).json()) as { until: string; reason: string }[];
      return rows[0] ? { until: Date.parse(rows[0].until), reason: rows[0].reason } : null;
    },
    async setServiceState(key, until, reason) {
      await call('/service_state?on_conflict=key', {
        method: 'POST',
        body: JSON.stringify({ key, until: new Date(until).toISOString(), reason, updated_at: new Date().toISOString() }),
        prefer: 'resolution=merge-duplicates,return=minimal'
      });
    },
    async usageByDay(day) {
      const rows = (await (await call(`/usage_daily?select=user_id,resolves&day=${eq(day)}`)).json()) as { user_id: string; resolves: number }[];
      return Object.fromEntries(rows.map((row) => [row.user_id, row.resolves]));
    },
    async cacheCount() {
      const response = await call('/video_cache?select=track_id&limit=1', { prefer: 'count=exact' });
      return Number(/\/(\d+)$/.exec(response.headers.get('content-range') ?? '')?.[1] ?? 0);
    },
    async listUsers() {
      const response = await fetchImpl(`${config.url}/auth/v1/admin/users?per_page=200`, {
        headers: { apikey: config.serviceKey, Authorization: `Bearer ${config.serviceKey}` },
        signal: AbortSignal.timeout(5000)
      });
      if (!response.ok) throw new Error(`Supabase HTTP ${response.status} em /auth/v1/admin/users`);
      const data = (await response.json()) as { users?: { id: string; email?: string | null }[] };
      return Object.fromEntries((data.users ?? []).map((user) => [user.id, user.email ?? '']));
    },
    async usedToday(userId, now) {
      const rows = (await (
        await call(`/usage_daily?select=resolves&user_id=${eq(userId)}&day=${eq(saoPauloDay(now))}`)
      ).json()) as { resolves: number }[];
      return rows[0]?.resolves ?? 0;
    }
  };
}
