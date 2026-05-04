import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import type { GroupMember } from '@/lib/types';

function redirectAfterLogin(memberships: GroupMember[], navigate: ReturnType<typeof useNavigate>) {
  if (memberships.length === 1) {
    navigate(`/${memberships[0].group_id}`, { replace: true });
  } else {
    navigate('/group-select', { replace: true });
  }
}

export function Login() {
  const navigate = useNavigate();
  const { session, memberships, isLoading } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isLoading) return;
    if (session) {
      redirectAfterLogin(memberships, navigate);
    }
  }, [isLoading, session, memberships, navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    const { error } = await supabase.auth.signInWithPassword({
      email: `${username.trim()}@intern`,
      password,
    });

    if (error) {
      setError('Feil brukernavn eller passord.');
      setIsSubmitting(false);
    }
    // On success, onAuthStateChange fires → AuthContext updates session + memberships
    // → useEffect above triggers redirect
  }

  if (isLoading || session) return null;

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="rounded-2xl bg-white p-8 shadow-sm">
          <p className="text-sm uppercase tracking-[0.24em] text-sky-600 font-semibold mb-1">Blå perm</p>
          <h1 className="text-2xl font-semibold text-slate-900 mb-6">Logg inn</h1>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-slate-700">Brukernavn</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="bg-white rounded-xl shadow-sm border border-slate-200 px-3 py-2 text-sm focus:ring-2 focus:ring-sky-500 outline-none"
                autoCapitalize="none"
                autoCorrect="off"
                autoComplete="username"
                required
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-slate-700">Passord</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-white rounded-xl shadow-sm border border-slate-200 px-3 py-2 text-sm focus:ring-2 focus:ring-sky-500 outline-none"
                autoComplete="current-password"
                required
              />
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-full bg-sky-500 text-white text-xs font-semibold px-4 py-2 hover:bg-sky-600 disabled:opacity-50 transition-colors"
            >
              {isSubmitting ? 'Logger inn…' : 'Logg inn'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
