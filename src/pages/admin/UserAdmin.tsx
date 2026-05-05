import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import type { GroupMember } from '@/lib/types';

type ActionState =
  | { type: 'confirm_role'; memberId: string; newRole: 'admin' | 'member' }
  | { type: 'confirm_remove'; memberId: string }
  | { type: 'reset_password'; memberId: string }
  | null;

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
  const [createError, setCreateError] = useState('');
  const [createSuccess, setCreateSuccess] = useState('');

  const [actionState, setActionState] = useState<ActionState>(null);
  const [resetPasswordInput, setResetPasswordInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [actionError, setActionError] = useState('');

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

  async function callManageUser(body: object): Promise<{ ok: boolean; error?: string }> {
    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manage-user`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session?.access_token}`,
      },
      body: JSON.stringify(body),
    });
    if (res.ok) return { ok: true };
    const json = await res.json().catch(() => ({}));
    return { ok: false, error: json.error ?? 'Noe gikk galt.' };
  }

  async function handleCreateUser(e: React.FormEvent) {
    e.preventDefault();
    setCreateError('');
    setCreateSuccess('');
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
      setCreateError(body.error ?? 'Kunne ikke opprette bruker.');
    } else {
      setCreateSuccess(`Bruker «${username.trim()}» er opprettet.`);
      setUsername('');
      setPassword('');
      fetchMembers();
    }
    setIsCreating(false);
  }

  async function handleConfirmRole() {
    if (actionState?.type !== 'confirm_role') return;
    setIsProcessing(true);
    setActionError('');
    const { memberId, newRole } = actionState;
    const member = members.find((m) => m.id === memberId);
    if (!member) { setIsProcessing(false); return; }
    const result = await callManageUser({ action: 'change_role', groupId, userId: member.user_id, newRole });
    if (result.ok) {
      setMembers((prev) => prev.map((m) => m.id === memberId ? { ...m, role: newRole } : m));
      setActionState(null);
    } else {
      setActionError(result.error ?? 'Noe gikk galt.');
    }
    setIsProcessing(false);
  }

  async function handleConfirmRemove() {
    if (actionState?.type !== 'confirm_remove') return;
    setIsProcessing(true);
    setActionError('');
    const { memberId } = actionState;
    const member = members.find((m) => m.id === memberId);
    if (!member) { setIsProcessing(false); return; }
    const result = await callManageUser({ action: 'remove_member', groupId, userId: member.user_id });
    if (result.ok) {
      setMembers((prev) => prev.filter((m) => m.id !== memberId));
      setActionState(null);
    } else {
      setActionError(result.error ?? 'Noe gikk galt.');
    }
    setIsProcessing(false);
  }

  async function handleResetPassword(memberId: string) {
    if (!resetPasswordInput.trim()) return;
    setIsProcessing(true);
    setActionError('');
    const member = members.find((m) => m.id === memberId);
    if (!member) { setIsProcessing(false); return; }
    const result = await callManageUser({ action: 'reset_password', groupId, userId: member.user_id, newPassword: resetPasswordInput });
    if (result.ok) {
      setActionState(null);
      setResetPasswordInput('');
    } else {
      setActionError(result.error ?? 'Noe gikk galt.');
    }
    setIsProcessing(false);
  }

  function cancelAction() {
    setActionState(null);
    setResetPasswordInput('');
    setActionError('');
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
            {createError && <p className="text-sm text-red-600">{createError}</p>}
            {createSuccess && <p className="text-sm text-green-600">{createSuccess}</p>}
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
              {members.map((m) => {
                const isActive = actionState?.memberId === m.id;
                const newRole = m.role === 'admin' ? 'member' : 'admin';
                return (
                  <div key={m.id} className="flex flex-col gap-2 py-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-sm font-medium text-slate-800 truncate">{m.username}</span>
                        <span
                          className={`inline-flex flex-shrink-0 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                            m.role === 'admin' ? 'bg-sky-100 text-sky-700' : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {m.role === 'admin' ? 'Admin' : 'Bruker'}
                        </span>
                      </div>
                      {!isActive && (
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <button
                            onClick={() => { cancelAction(); setActionState({ type: 'confirm_role', memberId: m.id, newRole }); }}
                            className="rounded-full bg-slate-100 text-slate-700 text-xs font-semibold px-3 py-1 hover:bg-slate-200 transition-colors"
                          >
                            {newRole === 'admin' ? 'Gjør admin' : 'Gjør bruker'}
                          </button>
                          <button
                            onClick={() => { cancelAction(); setActionState({ type: 'confirm_remove', memberId: m.id }); }}
                            className="rounded-full bg-red-50 text-red-600 text-xs font-semibold px-3 py-1 hover:bg-red-100 transition-colors"
                          >
                            Fjern
                          </button>
                          <button
                            onClick={() => { cancelAction(); setActionState({ type: 'reset_password', memberId: m.id }); }}
                            className="rounded-full bg-slate-100 text-slate-700 text-xs font-semibold px-3 py-1 hover:bg-slate-200 transition-colors"
                          >
                            Passord
                          </button>
                        </div>
                      )}
                    </div>

                    {isActive && actionState?.type === 'confirm_role' && (
                      <div className="flex flex-col gap-2 pl-2">
                        <p className="text-sm text-slate-700">
                          Endre rolle til <strong>{newRole === 'admin' ? 'Admin' : 'Bruker'}</strong>?
                        </p>
                        {actionError && <p className="text-xs text-red-600">{actionError}</p>}
                        <div className="flex gap-2">
                          <button
                            onClick={handleConfirmRole}
                            disabled={isProcessing}
                            className="rounded-full bg-sky-500 text-white text-xs font-semibold px-3 py-1 hover:bg-sky-600 disabled:opacity-50 transition-colors"
                          >
                            {isProcessing ? 'Lagrer…' : 'Bekreft'}
                          </button>
                          <button
                            onClick={cancelAction}
                            disabled={isProcessing}
                            className="rounded-full bg-slate-100 text-slate-700 text-xs font-semibold px-3 py-1 hover:bg-slate-200 transition-colors"
                          >
                            Avbryt
                          </button>
                        </div>
                      </div>
                    )}

                    {isActive && actionState?.type === 'confirm_remove' && (
                      <div className="flex flex-col gap-2 pl-2">
                        <p className="text-sm text-slate-700">Er du sikker på at du vil fjerne <strong>{m.username}</strong>?</p>
                        {actionError && <p className="text-xs text-red-600">{actionError}</p>}
                        <div className="flex gap-2">
                          <button
                            onClick={handleConfirmRemove}
                            disabled={isProcessing}
                            className="rounded-full bg-red-500 text-white text-xs font-semibold px-3 py-1 hover:bg-red-600 disabled:opacity-50 transition-colors"
                          >
                            {isProcessing ? 'Fjerner…' : 'Bekreft'}
                          </button>
                          <button
                            onClick={cancelAction}
                            disabled={isProcessing}
                            className="rounded-full bg-slate-100 text-slate-700 text-xs font-semibold px-3 py-1 hover:bg-slate-200 transition-colors"
                          >
                            Avbryt
                          </button>
                        </div>
                      </div>
                    )}

                    {isActive && actionState?.type === 'reset_password' && (
                      <div className="flex flex-col gap-2 pl-2">
                        <p className="text-sm text-slate-700">Nytt passord for <strong>{m.username}</strong></p>
                        <input
                          type="password"
                          value={resetPasswordInput}
                          onChange={(e) => setResetPasswordInput(e.target.value)}
                          placeholder="Nytt passord"
                          className="bg-white rounded-xl shadow-sm border border-slate-200 px-3 py-2 text-sm focus:ring-2 focus:ring-sky-500 outline-none max-w-xs"
                        />
                        {actionError && <p className="text-xs text-red-600">{actionError}</p>}
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleResetPassword(m.id)}
                            disabled={isProcessing || !resetPasswordInput.trim()}
                            className="rounded-full bg-sky-500 text-white text-xs font-semibold px-3 py-1 hover:bg-sky-600 disabled:opacity-50 transition-colors"
                          >
                            {isProcessing ? 'Lagrer…' : 'Sett passord'}
                          </button>
                          <button
                            onClick={cancelAction}
                            disabled={isProcessing}
                            className="rounded-full bg-slate-100 text-slate-700 text-xs font-semibold px-3 py-1 hover:bg-slate-200 transition-colors"
                          >
                            Avbryt
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
