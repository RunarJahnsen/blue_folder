import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import type { Folder } from '@/lib/types';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card';

export function FolderList() {
  const { groupId } = useParams();
  const navigate = useNavigate();
  const { signOut, isAdmin } = useAuth();
  const [folders, setFolders] = useState<Folder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!groupId) {
      setError('Mangler gruppe-id.');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError('');

    (async () => {
      const { data, error } = await supabase
        .from('folders')
        .select('id, title, date, status, mode')
        .eq('group_id', groupId)
        .order('date', { ascending: true });

      if (error) {
        setError('Kunne ikke hente permer. Prøv igjen.');
        setFolders([]);
      } else if (data) {
        setFolders(data as Folder[]);
      }
      setIsLoading(false);
    })();
  }, [groupId]);

  const activeFolders = useMemo(() => folders.filter((folder) => folder.status === 'active'), [folders]);
  const upcomingFolders = useMemo(() => folders.filter((folder) => folder.status === 'planned'), [folders]);
  const previousFolders = useMemo(() => folders.filter((folder) => folder.status === 'completed'), [folders]);

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'planned':
        return 'bg-slate-200 text-slate-800';
      case 'active':
        return 'bg-sky-100 text-sky-700';
      case 'completed':
        return 'bg-green-200 text-green-800';
      default:
        return 'bg-slate-100 text-slate-700';
    }
  };

  const renderFolderCard = (folder: Folder) => (
    <Card
      key={folder.id}
      className="cursor-pointer hover:shadow-md transition-shadow"
      onClick={() => navigate(`/${groupId}/folders/${folder.id}`)}
    >
      <CardHeader>
        <CardTitle className="font-semibold">{folder.title}</CardTitle>
        <CardDescription>
          {folder.date} · {folder.mode.replace('_', ' ')}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold ${getStatusBadgeColor(folder.status)}`}>
          {folder.status.charAt(0).toUpperCase() + folder.status.slice(1)}
        </span>
      </CardContent>
    </Card>
  );

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-6 sm:px-6">
      <div className="mx-auto flex max-w-4xl flex-col gap-6">
        <div className="flex flex-col gap-4 rounded-2xl bg-white p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.24em] text-sky-600 font-semibold">Blå perm</p>
            <h1 className="text-2xl font-semibold text-slate-900">Permoversikt</h1>
            <p className="max-w-2xl text-sm text-slate-600">
              Se alle permer i gruppen og opprett en ny samling.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {isAdmin(groupId!) && (
              <Button variant="outline" onClick={() => navigate(`/${groupId}/admin/users`)}>
                Brukere
              </Button>
            )}
            <Button variant="outline" onClick={() => navigate(`/${groupId}/songs`)}>
              Sanger
            </Button>
            <Button onClick={() => navigate(`/${groupId}/folders/new`)}>
              Opprett perm
            </Button>
            <Button
              variant="outline"
              onClick={async () => {
                await signOut();
                navigate('/login', { replace: true });
              }}
            >
              Logg ut
            </Button>
          </div>
        </div>

        {error ? (
          <div className="rounded-2xl bg-red-50 p-4 text-sm text-red-800">{error}</div>
        ) : null}

        {isLoading ? (
          <div className="rounded-2xl bg-white p-6 text-slate-700 shadow-sm">Henter permer…</div>
        ) : (
          <div className="grid gap-6">
            <section className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <h2 className="text-lg font-semibold">Aktive permer</h2>
                <span className="text-sm text-slate-500">{activeFolders.length} funnet</span>
              </div>
              {activeFolders.length > 0 ? (
                <div className="grid gap-4">{activeFolders.map(renderFolderCard)}</div>
              ) : (
                <Card className="bg-slate-50 text-slate-600">
                  <CardContent>Ingen aktive permer ennå.</CardContent>
                </Card>
              )}
            </section>

            <section className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <h2 className="text-lg font-semibold">Kommende permer</h2>
                <span className="text-sm text-slate-500">{upcomingFolders.length} funnet</span>
              </div>
              {upcomingFolders.length > 0 ? (
                <div className="grid gap-4">{upcomingFolders.map(renderFolderCard)}</div>
              ) : (
                <Card className="bg-slate-50 text-slate-600">
                  <CardContent>Ingen kommende permer ennå.</CardContent>
                </Card>
              )}
            </section>

            <section className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <h2 className="text-lg font-semibold">Tidligere permer</h2>
                <span className="text-sm text-slate-500">{previousFolders.length} funnet</span>
              </div>
              {previousFolders.length > 0 ? (
                <div className="grid gap-4">{previousFolders.map(renderFolderCard)}</div>
              ) : (
                <Card className="bg-slate-50 text-slate-600">
                  <CardContent>Ingen tidligere permer ennå.</CardContent>
                </Card>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
