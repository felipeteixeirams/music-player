import { apiFetch } from './apiFetch';

export interface DailyUsage {
  used: number;
  limit: number;
}

/** How many tracks nobody had played before the user brought in today, against the daily limit; null when there is no limit. */
export async function fetchDailyUsage(signal?: AbortSignal): Promise<DailyUsage | null> {
  try {
    const response = await apiFetch('/api/resolve?usage=1', { signal });
    if (!response.ok) return null;
    const data = (await response.json()) as { enabled?: unknown; used?: unknown; limit?: unknown } | null;
    return data?.enabled === true && typeof data.used === 'number' && typeof data.limit === 'number'
      ? { used: data.used, limit: data.limit }
      : null;
  } catch {
    return null;
  }
}
