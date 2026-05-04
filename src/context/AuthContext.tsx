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
  const { data, error } = await supabase
    .from('group_members')
    .select('*')
    .eq('user_id', userId);

  if (error) {
    console.error('fetchMemberships error:', error);
    return [];
  }

  const memberships = (data ?? []) as GroupMember[];
  if (memberships.length === 0) return [];

  const groupIds = memberships.map((m) => m.group_id);
  const { data: groups, error: groupsError } = await supabase
    .from('groups')
    .select('id, name')
    .in('id', groupIds);

  if (groupsError) {
    console.error('fetchMemberships groups error:', groupsError);
    return memberships;
  }

  const groupMap = Object.fromEntries((groups ?? []).map((g) => [g.id, g.name]));
  return memberships.map((m) => ({
    ...m,
    groups: groupMap[m.group_id] ? { id: m.group_id, name: groupMap[m.group_id] } : undefined,
  }));
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [memberships, setMemberships] = useState<GroupMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      try {
        if (session?.user) {
          const m = await fetchMemberships(session.user.id);
          setMemberships(m);
        }
        setSession(session);
      } finally {
        setIsLoading(false);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      try {
        if (session?.user) {
          const m = await fetchMemberships(session.user.id);
          setMemberships(m);
        } else {
          setMemberships([]);
        }
        setSession(session);
      } catch (e) {
        console.error('onAuthStateChange error:', e);
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
