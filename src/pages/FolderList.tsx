import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';

async function pgHeaders() {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token ?? import.meta.env.VITE_SUPABASE_ANON_KEY;
  return {
    apikey: import.meta.env.VITE_SUPABASE_ANON_KEY as string,
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

const BASE = () => import.meta.env.VITE_SUPABASE_URL as string;
import { Button } from '@/components/ui/button';
import type { Folder } from '@/lib/types';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card';

interface PlayedEntry {
  song_id: string;
  played_at: string | null;
  songs: { id: string; title: string; artist?: string } | null;
}

export function FolderList() {
  const { groupId } = useParams();
  const navigate = useNavigate();
  const { signOut, isAdmin, user, username } = useAuth();
  const [folders, setFolders] = useState<Folder[]>([]);
  const [playedEntries, setPlayedEntries] = useState<PlayedEntry[]>([]);
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
      try {
        const headers = await pgHeaders();
        const base = BASE();
        const [foldersRes, playedRes] = await Promise.all([
          fetch(`${base}/rest/v1/folders?group_id=eq.${groupId}&select=id,title,date,status,mode,owner_user_id,owner_username&order=date.asc`, { headers }),
          fetch(`${base}/rest/v1/folder_song_entries?group_id=eq.${groupId}&state=eq.played&select=song_id,played_at,songs(id,title,artist)`, { headers }),
        ]);
        const [foldersData, playedData] = await Promise.all([foldersRes.json(), playedRes.json()]);
        if (!foldersRes.ok) {
          setError('Kunne ikke hente permer. Prøv igjen.');
          setFolders([]);
        } else if (Array.isArray(foldersData)) {
          setFolders(foldersData as Folder[]);
        }
        if (Array.isArray(playedData)) {
          setPlayedEntries(playedData as PlayedEntry[]);
        }
      } catch {
        setError('Kunne ikke hente permer. Prøv igjen.');
        setFolders([]);
      } finally {
        setIsLoading(false);
      }
    })();
  }, [groupId]);

  const activeFolders = useMemo(() => folders.filter((folder) => folder.status === 'active'), [folders]);
  const upcomingFolders = useMemo(() => folders.filter((folder) => folder.status === 'planned'), [folders]);
  const previousFolders = useMemo(() => folders.filter((folder) => folder.status === 'completed'), [folders]);

  const topSongs = useMemo(() => {
    const map = new Map<string, { title: string; artist?: string; count: number }>();
    for (const e of playedEntries) {
      if (!e.songs) continue;
      const existing = map.get(e.song_id);
      if (existing) {
        existing.count += 1;
      } else {
        map.set(e.song_id, { title: e.songs.title, artist: e.songs.artist, count: 1 });
      }
    }
    return Array.from(map.entries())
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 5)
      .map(([, v]) => v);
  }, [playedEntries]);

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
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="font-semibold">{folder.title}</CardTitle>
          {folder.owner_user_id === user?.id && (
            <span className="inline-flex flex-shrink-0 px-2 py-0.5 rounded-full text-xs font-semibold bg-sky-100 text-sky-700">
              Din perm
            </span>
          )}
        </div>
        <CardDescription>
          {folder.date} · {folder.mode.replace('_', ' ')}
          {folder.owner_username && (
            <span className="block text-xs text-slate-400 mt-0.5">Eier: {folder.owner_username}</span>
          )}
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
            <h1 className="text-2xl font-semibold text-slate-900">
              {username ? `Hei, ${username}` : 'Permoversikt'}
            </h1>
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
            {topSongs.length > 0 && (
              <section className="rounded-2xl bg-white p-6 shadow-sm space-y-3">
                <h2 className="text-lg font-semibold text-slate-900">Mest spilte sanger</h2>
                <ol className="divide-y divide-slate-100">
                  {topSongs.map((song, idx) => (
                    <li key={idx} className="flex items-center gap-3 py-2.5">
                      <span className="flex-shrink-0 w-5 text-sm font-semibold text-slate-400 text-right">{idx + 1}.</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-900 truncate">
                          {song.artist ? `${song.artist} — ${song.title}` : song.title}
                        </p>
                      </div>
                      <span className="flex-shrink-0 text-xs text-slate-400 font-medium">
                        {song.count} {song.count === 1 ? 'gang' : 'ganger'}
                      </span>
                    </li>
                  ))}
                </ol>
              </section>
            )}

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
