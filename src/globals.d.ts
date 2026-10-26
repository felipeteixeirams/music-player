/** Build id injected by Vite (see vite.config.ts); 'dev' outside production builds. */
declare const __APP_VERSION__: string;

/** Public Supabase settings, set at build time (see src/utils/supabaseConfig.ts). */
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string;
  readonly DATABASE_VITE_SUPABASE_URL?: string;
  readonly DATABASE_VITE_SUPABASE_ANON_KEY?: string;
  readonly DATABASE_VITE_SUPABASE_PUBLISHABLE_KEY?: string;
}
