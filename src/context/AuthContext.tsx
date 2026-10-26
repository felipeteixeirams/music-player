import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { Session } from '@supabase/auth-js';
import { auth, getSession, isLoginEnabled, signOut } from '../utils/authClient';
import { LoginScreen } from '../components/LoginScreen';
import { SyncAgent } from '../components/SyncAgent';
import { scopedStorage, type KeyValueStorage } from '../utils/scopedStorage';
import { adoptLegacyData } from '../utils/userData';

interface AuthValue {
  /** Whether this build asks for a login at all. */
  enabled: boolean;
  email: string | null;
  userId: string | null;
  /** The device's storage for this user's data: favorites, playlists and picks live here (and in the account). */
  storage: KeyValueStorage;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthValue>({ enabled: false, email: null, userId: null, storage: scopedStorage(null), signOut });

export const useAuth = () => useContext(AuthContext);

type State = { status: 'loading' } | { status: 'signedOut' } | { status: 'signedIn'; email: string | null; userId: string };

/**
 * Holds the app behind the login. Everything under it (audio, playlists, the screens) mounts only for a signed-in
 * user, so a later sign-in as someone else starts from a clean slate. Without Supabase settings it is transparent.
 */
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<State>({ status: 'loading' });

  useEffect(() => {
    if (!auth) return;
    let active = true;
    const toState = (session: Session | null): State => {
      if (!session) return { status: 'signedOut' };
      // Data from before accounts goes to whoever signs in first on this device, before anything reads the storage
      adoptLegacyData(scopedStorage(null), scopedStorage(session.user.id));
      return { status: 'signedIn', email: session.user.email ?? null, userId: session.user.id };
    };
    getSession().then((session) => {
      if (active) setState(toState(session));
    });
    const { data } = auth.onAuthStateChange((_event, session) => {
      setState(toState(session));
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  const email = state.status === 'signedIn' ? state.email : null;
  const userId = state.status === 'signedIn' ? state.userId : null;
  const storage = useMemo(() => scopedStorage(userId), [userId]);
  const value = useMemo<AuthValue>(() => ({ enabled: isLoginEnabled, email, userId, storage, signOut }), [email, userId, storage]);

  if (!isLoginEnabled) return <>{children}</>;
  if (state.status === 'loading') return <div className="min-h-screen bg-canvas" />;
  if (state.status === 'signedOut') return <LoginScreen />;
  return (
    <AuthContext.Provider value={value}>
      <SyncAgent userId={state.userId} storage={storage} />
      {children}
    </AuthContext.Provider>
  );
};
