import { GoTrueClient, type Session } from '@supabase/auth-js';
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

/** Asks for a code by e-mail. Only invited people (users that already exist) receive one. */
export async function requestCode(email: string): Promise<{ error: string | null }> {
  if (!auth) return { error: 'Login indisponível' };
  const { error } = await auth.signInWithOtp({ email, options: { shouldCreateUser: false } });
  return { error: error ? describeAuthError(error) : null };
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
  if (text.includes('signup') || text.includes('not allowed') || text.includes('otp_disabled')) {
    return 'Este e-mail não tem convite. Peça acesso a quem te enviou o link.';
  }
  if (error.status === 429 || text.includes('rate limit') || text.includes('over_email_send_rate_limit')) {
    return 'Muitos pedidos de código. Aguarde alguns minutos e tente de novo.';
  }
  if (text.includes('expired') || text.includes('invalid')) return 'Código inválido ou expirado.';
  if (text.includes('fetch') || text.includes('network')) return 'Sem conexão. Verifique a internet.';
  return 'Não foi possível entrar agora. Tente de novo.';
}
