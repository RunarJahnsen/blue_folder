import { createContext, useContext, useEffect, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import type { GroupMember } from '@/lib/types';

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  username: string | null;
  memberships: GroupMember[];
  isAdmin: (groupId: string) => boolean;
  isLoading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function fetchMemberships(userId: string, token: string): Promise<GroupMember[]> {
  try {
    const headers = {
      apikey: import.meta.env.VITE_SUPABASE_ANON_KEY as string,
      Authorization: `Bearer ${token}`,
    };
    const base = import.meta.env.VITE_SUPABASE_URL as string;

    const membRes = await fetch(
      `${base}/rest/v1/group_members?user_id=eq.${userId}&select=*`,
      { headers }
    );
    const membData = await membRes.json();
    if (!Array.isArray(membData)) {
      console.error('[AuthContext] group_members fetch error:', membData);
      return [];
    }
    const memberships = membData as GroupMember[];
    if (memberships.length === 0) return [];

    const groupIds = memberships.map((m) => m.group_id);
    const groupsRes = await fetch(
      `${base}/rest/v1/groups?id=in.(${groupIds.join(',')})&select=id,name`,
      { headers }
    );
    const groupsData = await groupsRes.json();
    if (!Array.isArray(groupsData)) {
      console.error('[AuthContext] groups fetch error:', groupsData);
      return memberships;
    }

    const groupMap = Object.fromEntries(
      (groupsData as { id: string; name: string }[]).map((g) => [g.id, g.name])
    );
    return memberships.map((m) => ({
      ...m,
      groups: groupMap[m.group_id] ? { id: m.group_id, name: groupMap[m.group_id] } : undefined,
    }));
  } catch (e) {
    console.error('[AuthContext] fetchMemberships threw:', e);
    return [];
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [memberships, setMemberships] = useState<GroupMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    console.log('[Auth] state changed — isLoading:', isLoading, 'user:', session?.user?.id ?? null);
  }, [isLoading, session]);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      console.log('[Auth] getSession resolved — user:', session?.user?.id ?? null);
      try {
        if (session?.user) {
          const token = session.access_token ?? import.meta.env.VITE_SUPABASE_ANON_KEY;
          const m = await fetchMemberships(session.user.id, token);
          setMemberships(m);
        }
        setSession(session);
      } catch (e) {
        console.error('[AuthContext] getSession callback error:', e);
        setMemberships([]);
        setSession(session);
      } finally {
        setIsLoading(false);
      }
    }).catch((e) => {
      console.error('[AuthContext] getSession() threw:', e);
      setIsLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('[Auth] onAuthStateChange event:', event, 'user:', session?.user?.id ?? null);

      if (event === 'INITIAL_SESSION') {
        // Handled by getSession() above. Unblock UI immediately so ProtectedRoute
        // does not wait forever if getSession's async work takes time.
        setIsLoading(false);
        return;
      }

      try {
        if (session?.user) {
          // Use the token from the event's session directly — do NOT call
          // supabase.auth.getSession() here, it deadlocks inside onAuthStateChange.
          const token = session.access_token ?? import.meta.env.VITE_SUPABASE_ANON_KEY;
          const m = await fetchMemberships(session.user.id, token);
          setMemberships(m);
        } else {
          setMemberships([]);
        }
        setSession(session);
      } catch (e) {
        console.error('[AuthContext] onAuthStateChange callback error:', e);
        setMemberships([]);
        setSession(session);
      } finally {
        setIsLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const isAdmin = (groupId: string) =>
    memberships.some((m) => m.group_id === groupId && m.role === 'admin');

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const username = (session?.user?.user_metadata?.username as string | undefined)
    ?? session?.user?.email?.split('@')[0]
    ?? null;

  return (
    <AuthContext.Provider
      value={{ session, user: session?.user ?? null, username, memberships, isAdmin, isLoading, signOut }}
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
