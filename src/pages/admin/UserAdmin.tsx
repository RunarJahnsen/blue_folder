import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import type { GroupMember } from '@/lib/types';

export function UserAdmin() {
  const { groupId } = useParams<{ groupId: string }>();
  const navigate = useNavigate();
  const { isAdmin, session } = useAuth();
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'admin' | 'member'>('member');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (!groupId || !isAdmin(groupId)) {
      navigate(`/${groupId}`, { replace: true });
      return;
    }
    fetchMembers();
  }, [groupId]);

  async function fetchMembers() {
    setIsLoading(true);
    const token = session?.access_token ?? import.meta.env.VITE_SUPABASE_ANON_KEY;
    const res = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/group_members?group_id=eq.${groupId}&select=*&order=created_at.asc`,
      {
        headers: {
          apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
          Authorization: `Bearer ${token}`,
        },
      }
    );
    const data = await res.json();
    setMembers(Array.isArray(data) ? (data as GroupMember[]) : []);
    setIsLoading(false);
  }

  async function handleCreateUser(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSuccess('');
    setIsCreating(true);

    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-user`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ username: username.trim(), password, groupId, role }),
      }
    );

    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(body.error ?? 'Kunne ikke opprette bruker.');
    } else {
      setSuccess(`Bruker «${username.trim()}» er opprettet.`);
      setUsername('');
      setPassword('');
      fetchMembers();
    }
    setIsCreating(false);
  }

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-6 sm:px-6">
      <div className="mx-auto flex max-w-4xl flex-col gap-6">
        <div className="flex flex-col gap-4 rounded-2xl bg-white p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.24em] text-sky-600 font-semibold">Blå perm</p>
            <h1 className="text-2xl font-semibold text-slate-900">Brukeradmin</h1>
          </div>
          <Button variant="outline" onClick={() => navigate(`/${groupId}`)}>
            Tilbake
          </Button>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold mb-4">Opprett bruker</h2>
          <form onSubmit={handleCreateUser} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-slate-700">Brukernavn</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="bg-white rounded-xl shadow-sm border border-slate-200 px-3 py-2 text-sm focus:ring-2 focus:ring-sky-500 outline-none"
                autoCapitalize="none"
                autoCorrect="off"
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
                required
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-slate-700">Rolle</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as 'admin' | 'member')}
                className="bg-white rounded-xl shadow-sm border border-slate-200 px-3 py-2 text-sm focus:ring-2 focus:ring-sky-500 outline-none"
              >
                <option value="member">Bruker</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            {success && <p className="text-sm text-green-600">{success}</p>}
            <button
              type="submit"
              disabled={isCreating}
              className="self-start rounded-full bg-sky-500 text-white text-xs font-semibold px-4 py-2 hover:bg-sky-600 disabled:opacity-50 transition-colors"
            >
              {isCreating ? 'Oppretter…' : 'Opprett bruker'}
            </button>
          </form>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold mb-4">Medlemmer</h2>
          {isLoading ? (
            <p className="text-sm text-slate-600">Henter medlemmer…</p>
          ) : members.length === 0 ? (
            <p className="text-sm text-slate-600">Ingen medlemmer ennå.</p>
          ) : (
            <div className="flex flex-col divide-y divide-slate-100">
              {members.map((m) => (
                <div key={m.id} className="flex items-center justify-between py-3">
                  <span className="text-sm text-slate-800">{m.username}</span>
                  <span
                    className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                      m.role === 'admin' ? 'bg-sky-100 text-sky-700' : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    {m.role === 'admin' ? 'Admin' : 'Bruker'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
