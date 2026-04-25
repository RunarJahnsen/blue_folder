import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import type { Folder, FolderSongEntry, Song } from '@/lib/types';
import {
  Card,
  CardContent,
} from '@/components/ui/card';

interface SongWithEntry extends FolderSongEntry {
  songs?: Song;
}

export function FolderView() {
  const { groupId, folderId } = useParams();
  const [folder, setFolder] = useState<Folder | null>(null);
  const [entries, setEntries] = useState<SongWithEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!groupId || !folderId) {
      setError('Mangler gruppe-id eller folder-id.');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError('');

    (async () => {
      try {
        // Fetch folder
        const { data: folderData, error: folderError } = await supabase
          .from('folders')
          .select('id, group_id, title, date, status, mode, current_queue_item_id')
          .eq('id', folderId)
          .eq('group_id', groupId)
          .single<Folder>();

        if (folderError || !folderData) {
          setError('Kunne ikke hente permen. Sjekk at den finnes.');
          setIsLoading(false);
          return;
        }

        setFolder(folderData);

        // Fetch folder song entries with song data
        const { data: entriesData, error: entriesError } = await supabase
          .from('folder_song_entries')
          .select('id, folder_id, song_id, state, position, played_at, songs(id, title, url)')
          .eq('folder_id', folderId)
          .order('state', { ascending: true })
          .order('position', { ascending: true });

        if (entriesError) {
          setError('Kunne ikke hente sanger.');
          setEntries([]);
        } else if (entriesData) {
          setEntries(entriesData as SongWithEntry[]);
        }
      } catch (err) {
        setError('En feil oppstod. Prøv igjen.');
      } finally {
        setIsLoading(false);
      }
    })();
  }, [groupId, folderId]);

  // Separate entries by state
  const currentEntry = useMemo(
    () => entries.find((e) => e.state === 'current' && e.songs),
    [entries]
  );
  const queuedEntries = useMemo(
    () => entries.filter((e) => e.state === 'queued' && e.songs),
    [entries]
  );
  const suggestedEntries = useMemo(
    () => entries.filter((e) => e.state === 'suggested' && e.songs),
    [entries]
  );
  const playedEntries = useMemo(
    () => [...entries.filter((e) => e.state === 'played' && e.songs)].reverse(),
    [entries]
  );

  const renderSongLink = (entry: SongWithEntry) => {
    const song = entry.songs as any;
    if (!song || !song.url) return song?.title || 'Ukjent sang';

    return (
      <a
        href={song.url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-sky-700 hover:underline font-medium break-words"
      >
        {song.title || 'Ukjent sang'}
      </a>
    );
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'planned':
        return 'bg-slate-200 text-slate-800';
      case 'active':
        return 'bg-green-200 text-green-800';
      case 'completed':
        return 'bg-slate-300 text-slate-800';
      default:
        return 'bg-slate-100 text-slate-700';
    }
  };

  const renderBadge = (text: string, color: string = 'bg-slate-100 text-slate-700') => (
    <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold ${color}`}>
      {text}
    </span>
  );

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 px-4 py-6 sm:px-6">
        <div className="mx-auto max-w-4xl">
          <div className="rounded-3xl bg-white p-6 text-slate-700 shadow-sm">Henter perm…</div>
        </div>
      </div>
    );
  }

  if (error || !folder) {
    return (
      <div className="min-h-screen bg-gray-50 px-4 py-6 sm:px-6">
        <div className="mx-auto max-w-4xl rounded-3xl bg-red-50 p-4 text-sm text-red-800">
          {error || 'Permen finnes ikke.'}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-6 sm:px-6">
      <div className="mx-auto flex max-w-4xl flex-col gap-6">
        {/* Header */}
        <div className="flex flex-col gap-4 rounded-3xl bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-3xl font-semibold text-slate-900">{folder.title}</h1>
              <p className="text-sm text-slate-600">{folder.date}</p>
            </div>
            <div className="flex gap-2 flex-wrap items-center">
              {renderBadge(
                folder.status.charAt(0).toUpperCase() + folder.status.slice(1),
                getStatusBadgeColor(folder.status)
              )}
              <span className="text-slate-400"> · </span>
              {renderBadge(folder.mode.replace('_', ' '))}
            </div>
          </div>
        </div>

        {/* Live nå */}
        <div className="rounded-3xl border-2 border-sky-700 bg-sky-50 p-6 shadow-sm">
          <p className="text-sm uppercase tracking-[0.24em] text-sky-700 font-semibold">Live nå</p>
          {currentEntry && currentEntry.songs ? (
            <div className="mt-4 space-y-3">
              <h2 className="text-2xl font-bold text-slate-900">{(currentEntry.songs as any).title}</h2>
              <div>
                {renderSongLink(currentEntry)}
              </div>
            </div>
          ) : (
            <div className="mt-4 text-sm text-sky-700">
              Ingen sang spilles nå.
            </div>
          )}
        </div>

        {/* Kø */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Kø</h2>
            <span className="text-sm text-slate-500">{queuedEntries.length} sanger</span>
          </div>
          {queuedEntries.length > 0 ? (
            <div className="grid gap-3">
              {queuedEntries.map((entry) => (
                <Card key={entry.id} className="border border-slate-200 p-4 shadow-sm">
                  <CardContent className="p-0">
                    <div className="flex items-start justify-between gap-4">
                      <span className="flex-shrink-0 text-slate-400 font-semibold">
                        #{entry.position || '–'}
                      </span>
                      <div className="flex-1 min-w-0">{renderSongLink(entry)}</div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="border border-dashed border-slate-300 bg-slate-50 p-6 text-slate-600 text-sm">
              Ingen sanger i køen ennå.
            </Card>
          )}
        </div>

        {/* Forslag (kun synlig hvis mode === 'suggest') */}
        {folder.mode === 'suggest' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">Forslag</h2>
              <span className="text-sm text-slate-500">{suggestedEntries.length} forslag</span>
            </div>
            {suggestedEntries.length > 0 ? (
              <div className="grid gap-3">
                {suggestedEntries.map((entry) => (
                  <Card key={entry.id} className="border border-slate-200 p-4 shadow-sm bg-slate-50">
                    <CardContent className="p-0">
                      <div className="flex items-start justify-between gap-4">
                        {renderBadge('Forslag', 'bg-slate-300 text-slate-800')}
                        <div className="flex-1 min-w-0">{renderSongLink(entry)}</div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="border border-dashed border-slate-300 bg-slate-50 p-6 text-slate-600 text-sm">
                Ingen forslag ennå.
              </Card>
            )}
          </div>
        )}

        {/* Spilt */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Spilt</h2>
            <span className="text-sm text-slate-500">{playedEntries.length} sanger</span>
          </div>
          {playedEntries.length > 0 ? (
            <div className="grid gap-3">
              {playedEntries.map((entry, idx) => (
                <Card key={entry.id} className="border border-slate-200 p-4 shadow-sm opacity-75">
                  <CardContent className="p-0">
                    <div className="flex items-start justify-between gap-4">
                      <span className="flex-shrink-0 text-slate-400 font-semibold">
                        {idx + 1}.
                      </span>
                      <div className="flex-1 min-w-0">{renderSongLink(entry)}</div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="border border-dashed border-slate-300 bg-slate-50 p-6 text-slate-600 text-sm">
              Ingen sanger spilt ennå.
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
