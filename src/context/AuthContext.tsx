import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { auth, getSession, isLoginEnabled, signOut } from '../utils/authClient';
import { LoginScreen } from '../components/LoginScreen';

interface AuthValue {
  /** Whether this build asks for a login at all. */
  enabled: boolean;
  email: string | null;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthValue>({ enabled: false, email: null, signOut });

export const useAuth = () => useContext(AuthContext);

type State = { status: 'loading' } | { status: 'signedOut' } | { status: 'signedIn'; email: string | null };

/**
 * Holds the app behind the login. Everything under it (audio, playlists, the screens) mounts only for a signed-in
 * user, so a later sign-in as someone else starts from a clean slate. Without Supabase settings it is transparent.
 */
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<State>({ status: 'loading' });

  useEffect(() => {
    if (!auth) return;
    let active = true;
    getSession().then((session) => {
      if (active) setState(session ? { status: 'signedIn', email: session.user.email ?? null } : { status: 'signedOut' });
    });
    const { data } = auth.onAuthStateChange((_event, session) => {
      setState(session ? { status: 'signedIn', email: session.user.email ?? null } : { status: 'signedOut' });
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  const email = state.status === 'signedIn' ? state.email : null;
  const value = useMemo<AuthValue>(() => ({ enabled: isLoginEnabled, email, signOut }), [email]);

  if (!isLoginEnabled) return <>{children}</>;
  if (state.status === 'loading') return <div className="min-h-screen bg-canvas" />;
  if (state.status === 'signedOut') return <LoginScreen />;
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
