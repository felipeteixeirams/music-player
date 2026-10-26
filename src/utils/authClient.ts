import { GoTrueClient, type Session } from '@supabase/auth-js';
import { describeRateLimit } from './loginCode';
import { readSupabaseConfig } from './supabaseConfig';

const config = readSupabaseConfig();

/** The Supabase auth client, or null when the build has no Supabase settings (login off). */
export const auth: GoTrueClient | null = config
  ? new GoTrueClient({
      url: `${config.url}/auth/v1`,
      headers: { apikey: config.key },
      storageKey: 'aurastream-auth',
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false
    })
  : null;

export const isLoginEnabled = auth !== null;

// The access token, kept in memory as the library reports it. Asking the library each time (`getSession`) takes its
// internal lock and may refresh the token over the network: on the tap that starts a track that delay is enough for
// iOS to refuse the playback, which needs to start within about a second of the tap.
let liveSession: Session | null = null;
let liveSessionKnown = false;
if (auth) {
  auth.onAuthStateChange((_event, session) => {
    liveSession = session;
    liveSessionKnown = true;
  });
}

/** The current session without waiting for anything when it is known and far from expiring; otherwise the library is asked. */
export async function getSessionFast(): Promise<Session | null> {
  const soon = Math.floor(Date.now() / 1000) + 30;
  if (liveSessionKnown && liveSession && (liveSession.expires_at ?? 0) > soon) return liveSession;
  return getSession();
}

let sessionNotice: string | null = null;

/** Leaves a message for the login screen, for when the user is sent back to it (the session ended on its own). */
export function setSessionNotice(message: string): void {
  sessionNotice = message;
}

/** The message left for the login screen, once. */
export function takeSessionNotice(): string | null {
  const message = sessionNotice;
  sessionNotice = null;
  return message;
}

/** What the browser console (Safari's inspector on the iPhone) shows about a refusal: no e-mail, code or token in it. */
function logRefusal(what: string, error: { name?: string; status?: number; code?: string; message?: string }): void {
  console.warn(`[Login] ${what}: status=${error.status ?? 'sem'} code=${error.code ?? 'sem'} (${error.name ?? 'erro'}) ${String(error.message ?? '').slice(0, 120)}`);
}

export async function getSession(): Promise<Session | null> {
  if (!auth) return null;
  const { data } = await auth.getSession();
  return data.session;
}

export interface CodeRequest {
  error: string | null;
  /** Set when the server asked to wait: how long, in seconds. */
  waitSeconds?: number;
}

/**
 * Asks for a code by e-mail. Only invited people (users that already exist) receive one, but the answer is the
 * same for an address without an invitation, so the form cannot be used to find out who is invited.
 */
export async function requestCode(email: string): Promise<CodeRequest> {
  if (!auth) return { error: 'Login indisponível' };
  const { error } = await auth.signInWithOtp({ email, options: { shouldCreateUser: false } });
  if (!error) return { error: null };

  const text = `${error.code ?? ''} ${error.message ?? ''}`.toLowerCase();
  if (text.includes('signup') || text.includes('not allowed') || text.includes('otp_disabled')) return { error: null };
  logRefusal('pedido de código recusado', error);
  if (error.status === 429 || text.includes('rate_limit') || text.includes('rate limit')) {
    return describeRateLimit(error);
  }
  return { error: describeAuthError(error) };
}

export async function confirmCode(email: string, code: string): Promise<{ error: string | null }> {
  if (!auth) return { error: 'Login indisponível' };
  const { error } = await auth.verifyOtp({ email, token: code, type: 'email' });
  if (error) logRefusal('código recusado', error);
  return { error: error ? describeAuthError(error) : null };
}

export async function signOut(): Promise<void> {
  await auth?.signOut({ scope: 'local' });
}

/** The message for an error from the sign-in service, by what the user can do about it. */
export function describeAuthError(error: { name?: string; message?: string; status?: number; code?: string }): string {
  const text = `${error.code ?? ''} ${error.message ?? ''}`.toLowerCase();
  if (error.status === 429 || text.includes('rate limit') || text.includes('rate_limit')) {
    return 'Muitas tentativas. Aguarde alguns minutos e tente de novo.';
  }
  // The library calls both "no answer" (status 0) and a server error (5xx) "retryable fetch": the status tells them apart
  const serverError = text.includes('unexpected_failure') || text.includes('sending') || (error.status !== undefined && error.status >= 500);
  if (!serverError && (error.name === 'AuthRetryableFetchError' || error.status === 0 || text.includes('failed to fetch') || text.includes('network'))) {
    return 'Sem conexão. Verifique a internet.';
  }
  if (text.includes('email_address_invalid') || text.includes('validation_failed') || text.includes('invalid format')) {
    return 'Confira o e-mail digitado.';
  }
  // The server could not send the mail (the SMTP settings are wrong or the provider refused)
  if (serverError) {
    return 'O servidor não conseguiu enviar o e-mail agora. Tente de novo em instantes ou avise quem te convidou.';
  }
  if (text.includes('expired') || text.includes('invalid')) return 'Código incorreto ou expirado.';
  return 'Não foi possível entrar agora. Tente de novo.';
}
