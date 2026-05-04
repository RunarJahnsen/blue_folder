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

async function fetchMemberships(userId: string): Promise<GroupMember[]> {
  console.log('[AuthContext] supabase client:', typeof supabase, supabase?.auth ? 'auth ok' : 'auth missing');
  console.log('[AuthContext] fetchMemberships start, userId:', userId);
  try {
    console.log('[AuthContext] starting group_members query...');
    console.log('[AuthContext] supabase url:', (supabase as unknown as { supabaseUrl?: string }).supabaseUrl ?? 'missing');
    const testResult = supabase.from('group_members').select('*').eq('user_id', userId);
    console.log('[AuthContext] query object:', typeof testResult, Object.keys(testResult));
    const { data, error } = await testResult;
    console.log('[AuthContext] group_members query done — data:', data, 'error:', error);

    if (error) {
      console.error('[AuthContext] group_members query error:', error);
      return [];
    }

    const memberships = (data ?? []) as GroupMember[];
    if (memberships.length === 0) return [];

    const groupIds = memberships.map((m) => m.group_id);
    console.log('[AuthContext] starting groups query for ids:', groupIds);
    const { data: groups, error: groupsError } = await supabase
      .from('groups')
      .select('id, name')
      .in('id', groupIds);
    console.log('[AuthContext] groups query done — data:', groups, 'error:', groupsError);

    if (groupsError) {
      console.error('[AuthContext] groups query error:', groupsError);
      return memberships;
    }

    const groupMap = Object.fromEntries((groups ?? []).map((g) => [g.id, g.name]));
    return memberships.map((m) => ({
      ...m,
      groups: groupMap[m.group_id] ? { id: m.group_id, name: groupMap[m.group_id] } : undefined,
    }));
  } catch (e) {
    console.error('[AuthContext] fetchMemberships threw unexpectedly:', e);
    return [];
  }
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
