/** True when the deployed version is known and differs from the one this session is running. */
export function isNewVersionAvailable(running: string, deployed: string | null): boolean {
  return Boolean(deployed) && deployed !== running;
}

/** Reads the build id of the current deploy from `version.json`; null when it cannot be read. */
export async function fetchDeployedVersion(fetchImpl: typeof fetch = fetch): Promise<string | null> {
  try {
    const response = await fetchImpl('/version.json', { cache: 'no-store' });
    if (!response.ok) return null;
    const payload: unknown = await response.json();
    const version = payload && typeof payload === 'object' ? (payload as { version?: unknown }).version : null;
    return typeof version === 'string' && version ? version : null;
  } catch {
    // Offline, or the host answered with the HTML fallback instead of JSON
    return null;
  }
}
