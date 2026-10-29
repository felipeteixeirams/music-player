import { apiFetch } from './apiFetch';

export interface AdminOverview {
  day: string;
  youtube: { search: 'normal' | 'suspended'; reason?: string; until?: number; searchesToday: number; unitsUpperBound: number };
  limits: { dailyNewTracks: number };
  people: { counted: number; accounts: number | null; perPerson: { email: string; used: number }[] };
  cache: { tracks: number | null };
  config: { id: string; level: 'ok' | 'warn' | 'error'; message: string }[];
  database: 'ok' | 'off';
}

/** Whether the server considers the signed-in person an administrator (it decides; this only shows or hides the entry). */
export async function fetchIsAdmin(signal?: AbortSignal): Promise<boolean> {
  try {
    const response = await apiFetch('/api/admin?me=1', { signal });
    if (!response.ok) return false;
    return ((await response.json()) as { admin?: unknown } | null)?.admin === true;
  } catch {
    return false;
  }
}

export async function fetchAdminOverview(signal?: AbortSignal): Promise<AdminOverview | null> {
  try {
    const response = await apiFetch('/api/admin', { signal });
    return response.ok ? ((await response.json()) as AdminOverview) : null;
  } catch {
    return null;
  }
}
