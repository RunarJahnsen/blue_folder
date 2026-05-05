import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';

export function UserSettings() {
  const { groupId } = useParams<{ groupId: string }>();
  const navigate = useNavigate();
  const { session, username } = useAuth();

  const [newUsername, setNewUsername] = useState('');
  const [isSavingUsername, setIsSavingUsername] = useState(false);
  const [usernameError, setUsernameError] = useState('');
  const [usernameSuccess, setUsernameSuccess] = useState('');

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');

  async function handleChangeUsername(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = newUsername.trim();
    if (!trimmed) return;
    setUsernameError('');
    setUsernameSuccess('');
    setIsSavingUsername(true);

    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manage-user`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session?.access_token}`,
      },
      body: JSON.stringify({ action: 'update_username', groupId, newUsername: trimmed }),
    });

    if (res.ok) {
      await supabase.auth.refreshSession();
      setUsernameSuccess('Visningsnavn oppdatert.');
      setNewUsername('');
    } else {
      const json = await res.json().catch(() => ({}));
      setUsernameError(json.error ?? 'Kunne ikke oppdatere visningsnavn.');
    }
    setIsSavingUsername(false);
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setPasswordError('Passordene stemmer ikke overens.');
      return;
    }
    if (newPassword.length < 6) {
      setPasswordError('Passordet må være minst 6 tegn.');
      return;
    }
    setPasswordError('');
    setPasswordSuccess('');
    setIsSavingPassword(true);

    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      setPasswordError(error.message);
    } else {
      setPasswordSuccess('Passordet er oppdatert.');
      setNewPassword('');
      setConfirmPassword('');
    }
    setIsSavingPassword(false);
  }

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-6 sm:px-6">
      <div className="mx-auto flex max-w-4xl flex-col gap-6">
        <div className="flex flex-col gap-4 rounded-2xl bg-white p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.24em] text-sky-600 font-semibold">Blå perm</p>
            <h1 className="text-2xl font-semibold text-slate-900">Innstillinger</h1>
            {username && (
              <p className="text-sm text-slate-500 mt-0.5">Innlogget som <strong>{username}</strong></p>
            )}
          </div>
          <Button variant="outline" onClick={() => navigate(`/${groupId}`)}>
            Tilbake
          </Button>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold mb-1">Endre visningsnavn</h2>
          <p className="text-sm text-slate-500 mb-4">Vises i permer og til andre gruppemedlemmer.</p>
          <form onSubmit={handleChangeUsername} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-slate-700">Nytt visningsnavn</label>
              <input
                type="text"
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                placeholder={username ?? ''}
                className="bg-white rounded-xl shadow-sm border border-slate-200 px-3 py-2 text-sm focus:ring-2 focus:ring-sky-500 outline-none max-w-xs"
                autoCapitalize="none"
                autoCorrect="off"
              />
            </div>
            {usernameError && <p className="text-sm text-red-600">{usernameError}</p>}
            {usernameSuccess && <p className="text-sm text-green-600">{usernameSuccess}</p>}
            <button
              type="submit"
              disabled={isSavingUsername || !newUsername.trim()}
              className="self-start rounded-full bg-sky-500 text-white text-xs font-semibold px-4 py-2 hover:bg-sky-600 disabled:opacity-50 transition-colors"
            >
              {isSavingUsername ? 'Lagrer…' : 'Lagre visningsnavn'}
            </button>
          </form>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold mb-1">Endre passord</h2>
          <p className="text-sm text-slate-500 mb-4">Minimum 6 tegn.</p>
          <form onSubmit={handleChangePassword} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-slate-700">Nytt passord</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="bg-white rounded-xl shadow-sm border border-slate-200 px-3 py-2 text-sm focus:ring-2 focus:ring-sky-500 outline-none max-w-xs"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-slate-700">Bekreft passord</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="bg-white rounded-xl shadow-sm border border-slate-200 px-3 py-2 text-sm focus:ring-2 focus:ring-sky-500 outline-none max-w-xs"
              />
            </div>
            {passwordError && <p className="text-sm text-red-600">{passwordError}</p>}
            {passwordSuccess && <p className="text-sm text-green-600">{passwordSuccess}</p>}
            <button
              type="submit"
              disabled={isSavingPassword || !newPassword || !confirmPassword}
              className="self-start rounded-full bg-sky-500 text-white text-xs font-semibold px-4 py-2 hover:bg-sky-600 disabled:opacity-50 transition-colors"
            >
              {isSavingPassword ? 'Lagrer…' : 'Lagre passord'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
