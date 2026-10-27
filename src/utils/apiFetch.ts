import { auth, getSessionFast, setSessionNotice, signOut } from './authClient';
import { logPlayback } from './playbackDiagnostics';
import { newRequestId, sessionId } from './trace';

/** How long a request waits for the session library before going on (it can stall on iOS after the app was away). */
const SESSION_WAIT_MS = 2500;
const REFRESH_WAIT_MS = 6000;
const TIMED_OUT = Symbol('timed out');

function within<T>(promise: Promise<T>, ms: number): Promise<T | typeof TIMED_OUT> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => resolve(TIMED_OUT), ms);
    promise.then(
      (value) => { clearTimeout(timer); resolve(value); },
      (error) => { clearTimeout(timer); reject(error); }
    );
  });
}

/**
 * fetch for the app's own /api routes: sends the login with the request. A 401 means the token went stale (or the
 * invite was withdrawn): the session is refreshed once and, if the server still refuses, the user is signed out,
 * which brings the login screen back.
 */
export async function apiFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const send = async () => {
    const waited = await within(getSessionFast(), SESSION_WAIT_MS);
    if (waited === TIMED_OUT) logPlayback(`a sessão demorou mais de ${SESSION_WAIT_MS / 1000} s para responder: o pedido seguiu sem esperar`);
    const session = waited === TIMED_OUT ? null : waited;
    const headers = new Headers(init.headers);
    if (session) headers.set('Authorization', `Bearer ${session.access_token}`);
    // The ids the server writes on every log line of this request
    const requestId = newRequestId();
    headers.set('X-Request-Id', requestId);
    headers.set('X-Session-Id', sessionId);
    const where = input.split('?')[0];
    try {
      const result = await fetch(input, { ...init, headers });
      if (!result.ok) console.warn(`[Net] ${result.status} rid=${requestId} sid=${sessionId} ${where}`);
      return result;
    } catch (err) {
      if ((err as Error)?.name !== 'AbortError') console.warn(`[Net] sem resposta rid=${requestId} sid=${sessionId} ${where} (${(err as Error)?.name ?? 'erro'})`);
      throw err;
    }
  };

  const response = await send();
  if (response.status !== 401 || !auth) return response;

  const refreshed = await within(auth.refreshSession(), REFRESH_WAIT_MS);
  if (refreshed === TIMED_OUT) {
    // The session was not judged (the library stalled): never end it for that, only answer this request as refused
    logPlayback(`a renovação da sessão demorou mais de ${REFRESH_WAIT_MS / 1000} s: a sessão foi mantida`);
    return response;
  }
  const { data, error } = refreshed;
  if (data.session) {
    const retry = await send();
    if (retry.status !== 401) return retry;
  }
  // The server's answer says which 401 this was; only "your session is no good" ends the session
  const why = (await response.clone().json().catch(() => null)) as { code?: string } | null;
  console.warn(`[Auth] sessão encerrada: servidor respondeu 401 ${why?.code ?? 'sem código'} em ${input.split('?')[0]}${error ? `; renovação falhou (${error.message})` : ''}`);
  setSessionNotice('Sua sessão terminou ou o acesso foi retirado. Entre de novo.');
  await signOut();
  return response;
}
