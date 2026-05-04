import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';

export function GroupSelect() {
  const navigate = useNavigate();
  const { memberships, isLoading } = useAuth();

  // Handle session restore on refresh: if only 1 group, skip the selection UI
  useEffect(() => {
    if (isLoading) return;
    if (memberships.length === 1) {
      navigate(`/${memberships[0].group_id}`, { replace: true });
    }
  }, [isLoading, memberships, navigate]);

  if (isLoading) return null;
  if (memberships.length === 1) return null;

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="rounded-2xl bg-white p-8 shadow-sm">
          <p className="text-sm uppercase tracking-[0.24em] text-sky-600 font-semibold mb-1">Blå perm</p>
          <h1 className="text-2xl font-semibold text-slate-900 mb-6">Velg gruppe</h1>

          {memberships.length === 0 ? (
            <p className="text-sm text-slate-600">Du er ikke medlem av noen gruppe.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {memberships.map((m) => (
                <button
                  key={m.group_id}
                  onClick={() => navigate(`/${m.group_id}`)}
                  className="rounded-xl bg-sky-50 hover:bg-sky-100 text-sky-900 text-sm font-medium px-4 py-3 text-left transition-colors"
                >
                  {m.groups?.name ?? m.group_id}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
