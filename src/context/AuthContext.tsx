import { createContext, useContext, useEffect, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import type { GroupMember } from '@/lib/types';

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  memberships: GroupMember[];
  isAdmin: (groupId: string) => boolean;
  isLoading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function fetchMemberships(_userId: string): Promise<GroupMember[]> {
  console.log('[AuthContext] fetchMemberships step 1');
  try {
    console.log('[AuthContext] fetchMemberships step 2');
    const result = await supabase.from('group_members').select('*');
    console.log('[AuthContext] fetchMemberships step 3, result:', result);
  } catch (e) {
    console.error('[AuthContext] fetchMemberships caught:', e);
  }
  return [];
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [memberships, setMemberships] = useState<GroupMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [initError, setInitError] = useState<string | null>(null);

  useEffect(() => {
    console.log('[AuthContext] useEffect start');

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      console.log('[AuthContext] getSession resolved, session:', session?.user?.id ?? 'null');
      try {
        if (session?.user) {
          const m = await fetchMemberships(session.user.id);
          setMemberships(m);
        }
        setSession(session);
      } catch (e) {
        console.error('[AuthContext] getSession callback error:', e);
        setInitError(e instanceof Error ? e.message : String(e));
        setSession(session);
      } finally {
        console.log('[AuthContext] setIsLoading(false) via getSession');
        setIsLoading(false);
      }
    }).catch((e) => {
      console.error('[AuthContext] getSession() itself threw:', e);
      setInitError(e instanceof Error ? e.message : String(e));
      setIsLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      console.log('[AuthContext] onAuthStateChange event:', _event, 'user:', session?.user?.id ?? 'null');
      try {
        if (session?.user) {
          const m = await fetchMemberships(session.user.id);
          setMemberships(m);
        } else {
          setMemberships([]);
        }
        setSession(session);
      } catch (e) {
        console.error('[AuthContext] onAuthStateChange callback error:', e);
        setSession(session);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const isAdmin = (groupId: string) =>
    memberships.some((m) => m.group_id === groupId && m.role === 'admin');

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  if (initError) {
    return (
      <div style={{ padding: '2rem', fontFamily: 'monospace', color: 'red' }}>
        <strong>AuthContext init error:</strong>
        <pre>{initError}</pre>
      </div>
    );
  }

  return (
    <AuthContext.Provider
      value={{ session, user: session?.user ?? null, memberships, isAdmin, isLoading, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
