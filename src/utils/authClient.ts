import { GoTrueClient, type Session } from '@supabase/auth-js';
import { parseWaitSeconds } from './loginCode';
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
  if (error.status === 429 || text.includes('rate_limit') || text.includes('rate limit')) {
    const waitSeconds = parseWaitSeconds(error.message);
    return waitSeconds
      ? { error: `Aguarde ${waitSeconds} s para pedir outro código.`, waitSeconds }
      : { error: 'Muitos pedidos de código. Aguarde alguns minutos e tente de novo.' };
  }
  return { error: describeAuthError(error) };
}

export async function confirmCode(email: string, code: string): Promise<{ error: string | null }> {
  if (!auth) return { error: 'Login indisponível' };
  const { error } = await auth.verifyOtp({ email, token: code, type: 'email' });
  return { error: error ? describeAuthError(error) : null };
}

export async function signOut(): Promise<void> {
  await auth?.signOut({ scope: 'local' });
}

function describeAuthError(error: { message?: string; status?: number; code?: string }): string {
  const text = `${error.code ?? ''} ${error.message ?? ''}`.toLowerCase();
  if (error.status === 429 || text.includes('rate limit') || text.includes('rate_limit')) {
    return 'Muitas tentativas. Aguarde alguns minutos e tente de novo.';
  }
  if (text.includes('expired') || text.includes('invalid')) return 'Código incorreto ou expirado.';
  if (text.includes('fetch') || text.includes('network')) return 'Sem conexão. Verifique a internet.';
  return 'Não foi possível entrar agora. Tente de novo.';
}
