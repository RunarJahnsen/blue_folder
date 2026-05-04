import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useSession } from '@/hooks/useSession';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card';

const MODE_OPTIONS = [
  { value: 'host_only', label: 'Kun vert' },
  { value: 'suggest', label: 'Forslag' },
  { value: 'open', label: 'Åpent' },
] as const;

const COPY_STRATEGY_STATES: Record<string, string[]> = {
  all: ['queued', 'current', 'played'],
  played_only: ['played'],
  remaining_only: ['queued', 'current'],
};

type SourceFolder = { id: string; title: string; date: string };

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

export function FolderNew() {
  const { groupId } = useParams();
  const navigate = useNavigate();
  const sessionId = useSession();

  const [copyMode, setCopyMode] = useState<'new' | 'copy'>('new');
  const [sourceFolders, setSourceFolders] = useState<SourceFolder[]>([]);
  const [selectedSourceId, setSelectedSourceId] = useState('');
  const [copyStrategy, setCopyStrategy] = useState<'all' | 'played_only' | 'remaining_only'>('all');
  const [isFetchingFolders, setIsFetchingFolders] = useState(false);

  const [title, setTitle] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [mode, setMode] = useState<'host_only' | 'suggest' | 'open'>('host_only');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (copyMode !== 'copy' || !groupId) return;
    setIsFetchingFolders(true);
    (async () => {
      const headers = await pgHeaders();
      const res = await fetch(
        `${BASE()}/rest/v1/folders?group_id=eq.${groupId}&select=id,title,date&order=date.desc`,
        { headers }
      );
      const raw = await res.json();
      if (Array.isArray(raw) && raw.length > 0) {
        setSourceFolders(raw as SourceFolder[]);
        setSelectedSourceId(raw[0].id);
      }
      setIsFetchingFolders(false);
    })();
  }, [copyMode, groupId]);

  useEffect(() => {
    if (copyMode !== 'copy' || !selectedSourceId) return;
    const source = sourceFolders.find((f) => f.id === selectedSourceId);
    if (source) setTitle(source.title);
  }, [selectedSourceId, copyMode, sourceFolders]);

  const handleCopyModeToggle = (next: 'new' | 'copy') => {
    setCopyMode(next);
    if (next === 'new') {
      setTitle('');
      setSelectedSourceId('');
      setSourceFolders([]);
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');

    if (!title.trim() || !date) {
      setError('Tittel og dato må fylles ut.');
      return;
    }
    if (!groupId) {
      setError('Mangler gruppe-id.');
      return;
    }
    if (copyMode === 'copy' && !selectedSourceId) {
      setError('Velg en perm å kopiere fra.');
      return;
    }

    setIsLoading(true);

    const headers = await pgHeaders();
    const base = BASE();

    const folderData = {
      group_id: groupId,
      title: title.trim(),
      date,
      status: 'planned',
      mode,
      ...(sessionId ? { host_session_id: sessionId } : {}),
    };

    const folderRes = await fetch(`${base}/rest/v1/folders`, {
      method: 'POST',
      headers: { ...headers, Prefer: 'return=representation' },
      body: JSON.stringify(folderData),
    });

    if (!folderRes.ok) {
      console.error('[FolderNew] folder insert error:', await folderRes.text());
      setError('Kunne ikke opprette permen. Prøv igjen.');
      setIsLoading(false);
      return;
    }

    const folderRaw = await folderRes.json();
    const newFolder = Array.isArray(folderRaw) ? (folderRaw[0] as { id: string }) : null;
    if (!newFolder) {
      setError('Kunne ikke opprette permen. Prøv igjen.');
      setIsLoading(false);
      return;
    }

    if (copyMode === 'copy' && selectedSourceId) {
      const states = COPY_STRATEGY_STATES[copyStrategy];
      const entriesRes = await fetch(
        `${base}/rest/v1/folder_song_entries?folder_id=eq.${selectedSourceId}&state=in.(${states.join(',')})&select=song_id,position`,
        { headers }
      );
      const sourceEntries = await entriesRes.json();

      if (Array.isArray(sourceEntries) && sourceEntries.length > 0) {
        await fetch(`${base}/rest/v1/folder_song_entries`, {
          method: 'POST',
          headers,
          body: JSON.stringify(
            sourceEntries.map((e: { song_id: string; position: number }) => ({
              group_id: groupId,
              folder_id: newFolder.id,
              song_id: e.song_id,
              state: 'queued',
              position: e.position,
            }))
          ),
        });
      }
    }

    setIsLoading(false);
    navigate(`/${groupId}/folders/${newFolder.id}`);
  };

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-6 sm:px-6">
      <div className="mx-auto max-w-2xl space-y-6">
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle>Opprett ny perm</CardTitle>
            <CardDescription>Legg inn tittel, dato og modus for den kommende permen.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-6" onSubmit={handleSubmit}>
              <div>
                <Button type="button" variant="outline" size="sm" onClick={() => navigate(`/${groupId}`)}>
                  <ArrowLeft className="h-4 w-4" />
                  Tilbake
                </Button>
              </div>

              {/* Copy mode toggle */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-700">Utgangspunkt</label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={copyMode === 'new' ? 'default' : 'outline'}
                    onClick={() => handleCopyModeToggle('new')}
                  >
                    Ny perm
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={copyMode === 'copy' ? 'default' : 'outline'}
                    onClick={() => handleCopyModeToggle('copy')}
                  >
                    Kopier eksisterende
                  </Button>
                </div>
              </div>

              {/* Copy options */}
              {copyMode === 'copy' && (
                <>
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-slate-700">Kildeperm</label>
                    {isFetchingFolders ? (
                      <p className="text-sm text-slate-500">Henter permer…</p>
                    ) : sourceFolders.length === 0 ? (
                      <p className="text-sm text-slate-500">Ingen permer å kopiere fra.</p>
                    ) : (
                      <select
                        className="w-full rounded-xl border-0 bg-white shadow-sm px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                        value={selectedSourceId}
                        onChange={(e) => setSelectedSourceId(e.target.value)}
                      >
                        {sourceFolders.map((f) => (
                          <option key={f.id} value={f.id}>
                            {f.title} — {f.date}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-slate-700">Kopieringsstrategi</label>
                    <select
                      className="w-full rounded-xl border-0 bg-white shadow-sm px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                      value={copyStrategy}
                      onChange={(e) => setCopyStrategy(e.target.value as typeof copyStrategy)}
                    >
                      <option value="all">Alle sanger</option>
                      <option value="played_only">Kun spilte</option>
                      <option value="remaining_only">Kun ikke spilte</option>
                    </select>
                  </div>
                </>
              )}

              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-700">Tittel</label>
                <Input
                  type="text"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="Skriv permtittel"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-700">Dato</label>
                <Input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-700">Tilgangsnivå</label>
                <select
                  className="w-full rounded-xl border-0 bg-white shadow-sm px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                  value={mode}
                  onChange={(event) => setMode(event.target.value as 'host_only' | 'suggest' | 'open')}
                >
                  {MODE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              {error ? <div className="rounded-lg bg-red-50 p-4 text-sm text-red-800">{error}</div> : null}

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <Button type="submit" disabled={isLoading}>
                  {isLoading ? 'Lagrer…' : 'Opprett perm'}
                </Button>
                <Button type="button" variant="outline" onClick={() => navigate(`/${groupId}`)}>
                  Avbryt
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
