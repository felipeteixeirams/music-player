type FetchLike = typeof fetch;

const MAX_AUDIO_BYTES = 4 * 1024 * 1024;
const REQUEST_TIMEOUT_MS = 8000;
const ALLOWED_HOST_SUFFIXES = ['.dzcdn.net', '.mzstatic.com', '.itunes.apple.com'];

export class AudioProxyError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

/** Only catalog preview CDNs: this route must never become an open proxy. */
export function isAllowedAudioUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:'
      && !url.username
      && !url.password
      && ALLOWED_HOST_SUFFIXES.some((suffix) => url.hostname.endsWith(suffix));
  } catch {
    return false;
  }
}

export async function fetchAllowedAudio(
  value: unknown,
  fetchImpl: FetchLike = fetch
): Promise<{ contentType: string; body: Buffer }> {
  if (!isAllowedAudioUrl(value)) throw new AudioProxyError(400, 'URL de áudio não permitida');

  const response = await fetchImpl(value, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS), redirect: 'error' });
  if (!response.ok) throw new AudioProxyError(502, `Origem respondeu HTTP ${response.status}`);

  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.startsWith('audio/')) throw new AudioProxyError(502, 'A origem não devolveu áudio');

  const declared = Number(response.headers.get('content-length') ?? 0);
  if (declared > MAX_AUDIO_BYTES) throw new AudioProxyError(413, 'Arquivo de áudio grande demais');

  const body = Buffer.from(await response.arrayBuffer());
  if (body.length > MAX_AUDIO_BYTES) throw new AudioProxyError(413, 'Arquivo de áudio grande demais');
  return { contentType, body };
}
