import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useGuestSession } from '@/hooks/useGuestSession';
import type { Folder } from '@/lib/types';

export function JoinFolder() {
  const { guestCode } = useParams<{ guestCode: string }>();
  const navigate = useNavigate();
  const { setGuest } = useGuestSession();
  const [error, setError] = useState('');

  useEffect(() => {
    if (!guestCode) { setError('Ugyldig lenke.'); return; }

    (async () => {
      try {
        const res = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/folders?guest_code=eq.${guestCode}&select=id,group_id,title,mode`,
          {
            headers: {
              apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
              Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            },
          }
        );
        const data = await res.json();
        const folder = Array.isArray(data) ? (data[0] as Folder | undefined) : undefined;
        if (!folder) {
          setError('Gjestekoden er ugyldig eller deaktivert.');
          return;
        }
        setGuest({ guestFolderId: folder.id, guestGroupId: folder.group_id, guestCode });
        navigate(`/${folder.group_id}/folders/${folder.id}`, { replace: true });
      } catch {
        setError('En feil oppstod. Prøv igjen.');
      }
    })();
  }, [guestCode]);

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 px-4 py-6 sm:px-6">
        <div className="mx-auto max-w-md rounded-2xl bg-red-50 p-6 text-sm text-red-800">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-6 sm:px-6">
      <div className="mx-auto max-w-md rounded-2xl bg-white p-6 shadow-sm text-sm text-slate-600">
        Kobler til…
      </div>
    </div>
  );
}
