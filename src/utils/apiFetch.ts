import { auth, getSession, signOut } from './authClient';

/**
 * fetch for the app's own /api routes: sends the login with the request. A 401 means the token went stale (or the
 * invite was withdrawn): the session is refreshed once and, if the server still refuses, the user is signed out,
 * which brings the login screen back.
 */
export async function apiFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const send = async () => {
    const session = await getSession();
    const headers = new Headers(init.headers);
    if (session) headers.set('Authorization', `Bearer ${session.access_token}`);
    return fetch(input, { ...init, headers });
  };

  const response = await send();
  if (response.status !== 401 || !auth) return response;

  const { data } = await auth.refreshSession();
  if (data.session) {
    const retry = await send();
    if (retry.status !== 401) return retry;
  }
  await signOut();
  return response;
}
