export interface SupabaseConfig {
  url: string;
  key: string;
}

/**
 * The public Supabase URL and key baked into the build. Without them login is off and the app opens straight
 * away (local runs, AI Studio). Both the plain VITE_ names and the DATABASE_VITE_ ones that the Vercel
 * integration creates are accepted.
 */
export function readSupabaseConfig(env: Partial<ImportMetaEnv> = import.meta.env ?? {}): SupabaseConfig | null {
  const url = env.DATABASE_VITE_SUPABASE_URL || env.VITE_SUPABASE_URL;
  const key =
    env.DATABASE_VITE_SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY
    || env.DATABASE_VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_PUBLISHABLE_KEY;
  return url && key ? { url: url.replace(/\/+$/, ''), key } : null;
}
