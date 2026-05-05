import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { X } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import type { GroupMember } from '@/lib/types';

export function UserAdmin() {
  const { groupId } = useParams<{ groupId: string }>();
  const navigate = useNavigate();
  const { isAdmin, session } = useAuth();
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Create user form
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<'admin' | 'member'>('member');
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [createSuccess, setCreateSuccess] = useState('');

  // Edit modal
  const [selectedMember, setSelectedMember] = useState<GroupMember | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  // Edit username section
  const [editUsername, setEditUsername] = useState('');
  const [isSavingUsername, setIsSavingUsername] = useState(false);
  const [usernameError, setUsernameError] = useState('');
  const [usernameSuccess, setUsernameSuccess] = useState('');

  // Role section
  const [isChangingRole, setIsChangingRole] = useState(false);
  const [roleError, setRoleError] = useState('');

  // Reset password section
  const [editPassword, setEditPassword] = useState('');
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');

  // Remove section
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const [removeError, setRemoveError] = useState('');

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

  function openModal(member: GroupMember) {
    setSelectedMember(member);
    setEditUsername('');
    setUsernameError('');
    setUsernameSuccess('');
    setEditPassword('');
    setPasswordError('');
    setPasswordSuccess('');
    setRoleError('');
    setConfirmRemove(false);
    setRemoveError('');
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
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
        body: JSON.stringify({ username: newUsername.trim(), password: newPassword, groupId, role: newRole }),
      }
    );

    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      setCreateError(body.error ?? 'Kunne ikke opprette bruker.');
    } else {
      setCreateSuccess(`Bruker «${newUsername.trim()}» er opprettet.`);
      setNewUsername('');
      setNewPassword('');
      fetchMembers();
    }
    setIsCreating(false);
  }

  async function handleSaveUsername() {
    if (!selectedMember || !editUsername.trim()) return;
    setIsSavingUsername(true);
    setUsernameError('');
    setUsernameSuccess('');
    const result = await callManageUser({
      action: 'admin_update_username',
      groupId,
      userId: selectedMember.user_id,
      newUsername: editUsername.trim(),
    });
    if (result.ok) {
      const trimmed = editUsername.trim();
      setMembers((prev) => prev.map((m) => m.id === selectedMember.id ? { ...m, username: trimmed } : m));
      setSelectedMember((prev) => prev ? { ...prev, username: trimmed } : prev);
      setUsernameSuccess('Visningsnavn oppdatert.');
      setEditUsername('');
    } else {
      setUsernameError(result.error ?? 'Noe gikk galt.');
    }
    setIsSavingUsername(false);
  }

  async function handleToggleRole() {
    if (!selectedMember) return;
    setIsChangingRole(true);
    setRoleError('');
    const newRole = selectedMember.role === 'admin' ? 'member' : 'admin';
    const result = await callManageUser({
      action: 'change_role',
      groupId,
      userId: selectedMember.user_id,
      newRole,
    });
    if (result.ok) {
      setMembers((prev) => prev.map((m) => m.id === selectedMember.id ? { ...m, role: newRole } : m));
      setSelectedMember((prev) => prev ? { ...prev, role: newRole } : prev);
    } else {
      setRoleError(result.error ?? 'Noe gikk galt.');
    }
    setIsChangingRole(false);
  }

  async function handleSavePassword() {
    if (!selectedMember || !editPassword.trim()) return;
    setIsSavingPassword(true);
    setPasswordError('');
    setPasswordSuccess('');
    const result = await callManageUser({
      action: 'reset_password',
      groupId,
      userId: selectedMember.user_id,
      newPassword: editPassword,
    });
    if (result.ok) {
      setPasswordSuccess('Passord oppdatert.');
      setEditPassword('');
    } else {
      setPasswordError(result.error ?? 'Noe gikk galt.');
    }
    setIsSavingPassword(false);
  }

  async function handleRemove() {
    if (!selectedMember) return;
    setIsRemoving(true);
    setRemoveError('');
    const result = await callManageUser({
      action: 'remove_member',
      groupId,
      userId: selectedMember.user_id,
    });
    if (result.ok) {
      setMembers((prev) => prev.filter((m) => m.id !== selectedMember.id));
      closeModal();
    } else {
      setRemoveError(result.error ?? 'Noe gikk galt.');
      setIsRemoving(false);
    }
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
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                className="bg-white rounded-xl shadow-sm border border-slate-200 px-3 py-2 text-sm focus:ring-2 focus:ring-sky-500 outline-none max-w-xs"
                autoCapitalize="none"
                autoCorrect="off"
                required
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-slate-700">Passord</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="bg-white rounded-xl shadow-sm border border-slate-200 px-3 py-2 text-sm focus:ring-2 focus:ring-sky-500 outline-none max-w-xs"
                required
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-slate-700">Rolle</label>
              <select
                value={newRole}
                onChange={(e) => setNewRole(e.target.value as 'admin' | 'member')}
                className="bg-white rounded-xl shadow-sm border border-slate-200 px-3 py-2 text-sm focus:ring-2 focus:ring-sky-500 outline-none max-w-xs"
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
              className="self-start rounded-full border-0 bg-sky-500 text-white text-xs font-semibold px-4 py-2 hover:bg-sky-600 disabled:opacity-50 transition-colors"
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
                <div key={m.id} className="flex items-center justify-between gap-2 py-3">
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
                  <button
                    onClick={() => openModal(m)}
                    className="flex-shrink-0 rounded-full border-0 bg-slate-100 text-slate-700 text-xs font-semibold px-3 py-1 hover:bg-slate-200 transition-colors"
                  >
                    Rediger
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {modalOpen && selectedMember && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}
        >
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[80vh] flex flex-col">
            {/* Header */}
            <div className="flex-shrink-0 flex items-center justify-between gap-2 px-6 py-4 border-b border-slate-100">
              <div className="flex items-center gap-2 min-w-0">
                <span className="font-semibold text-slate-900 truncate">{selectedMember.username}</span>
                <span
                  className={`inline-flex flex-shrink-0 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                    selectedMember.role === 'admin' ? 'bg-sky-100 text-sky-700' : 'bg-slate-100 text-slate-700'
                  }`}
                >
                  {selectedMember.role === 'admin' ? 'Admin' : 'Bruker'}
                </span>
              </div>
              <button
                onClick={closeModal}
                className="flex-shrink-0 rounded-full border-0 bg-transparent text-slate-400 hover:text-slate-600 transition-colors p-1"
              >
                <X size={18} />
              </button>
            </div>

            {/* Scrollable content */}
            <div className="overflow-y-auto flex-grow px-6 py-4 flex flex-col gap-5">
              {/* Change username */}
              <div className="flex flex-col gap-2">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Endre visningsnavn</p>
                <input
                  type="text"
                  value={editUsername}
                  onChange={(e) => setEditUsername(e.target.value)}
                  placeholder={selectedMember.username}
                  className="bg-white rounded-xl shadow-sm border border-slate-200 px-3 py-2 text-sm focus:ring-2 focus:ring-sky-500 outline-none"
                  autoCapitalize="none"
                  autoCorrect="off"
                />
                {usernameError && <p className="text-xs text-red-600">{usernameError}</p>}
                {usernameSuccess && <p className="text-xs text-green-600">{usernameSuccess}</p>}
                <div>
                  <button
                    onClick={handleSaveUsername}
                    disabled={isSavingUsername || !editUsername.trim()}
                    className="rounded-full border-0 bg-sky-500 text-white text-xs font-semibold px-3 py-1 hover:bg-sky-600 disabled:opacity-50 transition-colors"
                  >
                    {isSavingUsername ? 'Lagrer…' : 'Lagre'}
                  </button>
                </div>
              </div>

              {/* Change role */}
              <div className="flex flex-col gap-2">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Endre rolle</p>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-slate-700">
                    Nå: <strong>{selectedMember.role === 'admin' ? 'Admin' : 'Bruker'}</strong>
                  </span>
                  <button
                    onClick={handleToggleRole}
                    disabled={isChangingRole}
                    className="rounded-full border-0 bg-slate-100 text-slate-700 text-xs font-semibold px-3 py-1 hover:bg-slate-200 disabled:opacity-50 transition-colors"
                  >
                    {isChangingRole
                      ? 'Lagrer…'
                      : selectedMember.role === 'admin'
                      ? 'Gjør til bruker'
                      : 'Gjør til admin'}
                  </button>
                </div>
                {roleError && <p className="text-xs text-red-600">{roleError}</p>}
              </div>

              {/* Reset password */}
              <div className="flex flex-col gap-2">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Tilbakestill passord</p>
                <input
                  type="password"
                  value={editPassword}
                  onChange={(e) => setEditPassword(e.target.value)}
                  placeholder="Nytt passord"
                  className="bg-white rounded-xl shadow-sm border border-slate-200 px-3 py-2 text-sm focus:ring-2 focus:ring-sky-500 outline-none"
                />
                {passwordError && <p className="text-xs text-red-600">{passwordError}</p>}
                {passwordSuccess && <p className="text-xs text-green-600">{passwordSuccess}</p>}
                <div>
                  <button
                    onClick={handleSavePassword}
                    disabled={isSavingPassword || !editPassword.trim()}
                    className="rounded-full border-0 bg-sky-500 text-white text-xs font-semibold px-3 py-1 hover:bg-sky-600 disabled:opacity-50 transition-colors"
                  >
                    {isSavingPassword ? 'Lagrer…' : 'Sett passord'}
                  </button>
                </div>
              </div>

              {/* Remove */}
              <div className="flex flex-col gap-2 border-t border-slate-100 pt-4">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Fjern fra gruppa</p>
                {!confirmRemove ? (
                  <div>
                    <button
                      onClick={() => setConfirmRemove(true)}
                      className="rounded-full border-0 bg-red-500 text-white text-xs font-semibold px-3 py-1 hover:bg-red-600 transition-colors"
                    >
                      Fjern bruker
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    <p className="text-sm text-slate-700">
                      Er du sikker på at du vil fjerne <strong>{selectedMember.username}</strong>?
                    </p>
                    {removeError && <p className="text-xs text-red-600">{removeError}</p>}
                    <div className="flex gap-2">
                      <button
                        onClick={handleRemove}
                        disabled={isRemoving}
                        className="rounded-full border-0 bg-red-500 text-white text-xs font-semibold px-3 py-1 hover:bg-red-600 disabled:opacity-50 transition-colors"
                      >
                        {isRemoving ? 'Fjerner…' : 'Bekreft'}
                      </button>
                      <button
                        onClick={() => { setConfirmRemove(false); setRemoveError(''); }}
                        disabled={isRemoving}
                        className="rounded-full border-0 bg-slate-100 text-slate-700 text-xs font-semibold px-3 py-1 hover:bg-slate-200 transition-colors"
                      >
                        Avbryt
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
