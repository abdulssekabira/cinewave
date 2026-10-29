import type { Session } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { removeAllDownloads, setDownloadOwner, verifyDownloads } from './downloads';
import { supabase } from './supabase';

type AuthCtx = { session: Session | null; ready: boolean };
const Ctx = createContext<AuthCtx>({ session: null, ready: false });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    const { data } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      if (event === 'SIGNED_OUT') {
        // Signing out (or this phone being removed from the account) wipes downloads.
        removeAllDownloads().then(() => setDownloadOwner(null));
      } else if (s) {
        setDownloadOwner(s.user.id);
      }
    });
    return () => data.subscription.unsubscribe();
  }, []);

  // Whenever the app is open and online, renew downloads (or remove revoked ones).
  const uid = session?.user.id;
  useEffect(() => {
    if (!uid) return;
    const check = () => setTimeout(() => verifyDownloads(uid), 0);
    check();
    const sub = AppState.addEventListener('change', (st) => { if (st === 'active') check(); });
    return () => sub.remove();
  }, [uid]);

  return <Ctx.Provider value={{ session, ready }}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
