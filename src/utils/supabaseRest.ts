export interface RestConfig {
  url: string;
  key: string;
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

export type RestCaller = (path: string, init?: RequestInit & { prefer?: string }) => Promise<Response>;

/**
 * Calls to Supabase's REST API with the signed-in user's token: the row-level security policies
 * (supabase/migrations) are what keep each person to their own rows. No server code in between.
 */
export function createRestCaller(
  config: RestConfig,
  getUser: () => Promise<{ id: string; token: string } | null>,
  fetchImpl: typeof fetch = fetch
): RestCaller {
  const base = `${config.url}/rest/v1`;
  return async (path, init = {}) => {
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
  };
}
