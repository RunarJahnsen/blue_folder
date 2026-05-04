import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Heart, Plus } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Favorite, Folder, FolderSongEntry, Song } from '@/lib/types';
import {
  Card,
  CardContent,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { AddSongModal } from '@/components/AddSongModal';
import { SongContentSheet } from '@/components/SongContentSheet';
import { useSession } from '@/hooks/useSession';

interface SongWithEntry extends FolderSongEntry {
  songs?: Song;
}

export function FolderView() {
  const { groupId, folderId } = useParams();
  const navigate = useNavigate();
  const sessionId = useSession();
  const [folder, setFolder] = useState<Folder | null>(null);
  const [entries, setEntries] = useState<SongWithEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [isAddSongModalOpen, setIsAddSongModalOpen] = useState(false);
  const [selectedSong, setSelectedSong] = useState<Song | null>(null);
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [isEditSheetOpen, setIsEditSheetOpen] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDate, setEditDate] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

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
        const { data: folderData, error: folderError } = await supabase
          .from('folders')
          .select('id, group_id, title, date, status, mode, current_queue_item_id, host_session_id')
          .eq('id', folderId)
          .eq('group_id', groupId)
          .single<Folder>();

        if (folderError || !folderData) {
          setError('Kunne ikke hente permen. Sjekk at den finnes.');
          setIsLoading(false);
          return;
        }

        setFolder(folderData);

        const { data: entriesData, error: entriesError } = await supabase
          .from('folder_song_entries')
          .select('id, folder_id, song_id, state, position, played_at, songs(id, title, url, content)')
          .eq('folder_id', folderId)
          .order('state', { ascending: true })
          .order('position', { ascending: true });

        if (entriesError) {
          setError('Kunne ikke hente sanger.');
          setEntries([]);
        } else if (entriesData) {
          setEntries(entriesData as unknown as SongWithEntry[]);
        }

        const { data: favoritesData } = await supabase
          .from('favorites')
          .select('id, song_id, group_id, created_at')
          .eq('group_id', groupId);
        if (favoritesData) setFavorites(favoritesData as Favorite[]);
      } catch (err) {
        setError('En feil oppstod. Prøv igjen.');
      } finally {
        setIsLoading(false);
      }
    })();
  }, [groupId, folderId]);

  useEffect(() => {
    if (!folderId) return;

    const channel = supabase
      .channel(`folder-view-${folderId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'folders', filter: `id=eq.${folderId}` },
        (payload) => {
          const updated = payload.new as Partial<Folder>;
          setFolder((prev) => (prev ? { ...prev, ...updated } : prev));
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'folder_song_entries', filter: `folder_id=eq.${folderId}` },
        async (payload) => {
          const newRow = payload.new as FolderSongEntry;
          const { data } = await supabase
            .from('folder_song_entries')
            .select('id, folder_id, song_id, state, position, played_at, songs(id, title, url, content)')
            .eq('id', newRow.id)
            .single();
          if (data) {
            setEntries((prev) => {
              if (prev.some((e) => e.id === (data as unknown as SongWithEntry).id)) return prev;
              return [...prev, data as unknown as SongWithEntry];
            });
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'folder_song_entries', filter: `folder_id=eq.${folderId}` },
        (payload) => {
          const updated = payload.new as FolderSongEntry;
          setEntries((prev) =>
            prev.map((e) =>
              e.id === updated.id
                ? { ...e, state: updated.state, position: updated.position, played_at: updated.played_at }
                : e
            )
          );
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'favorites' },
        (payload) => {
          const newFav = payload.new as Favorite;
          if (newFav.group_id !== groupId) return;
          setFavorites((prev) => {
            if (prev.some((f) => f.id === newFav.id)) return prev;
            return [...prev, newFav];
          });
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'favorites' },
        (payload) => {
          const deleted = payload.old as Favorite;
          setFavorites((prev) => prev.filter((f) => f.id !== deleted.id));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [folderId]);

  const currentEntry = useMemo(
    () => entries.find((e) => e.state === 'current' && e.songs),
    [entries]
  );
  const queuedEntries = useMemo(
    () =>
      entries
        .filter((e) => e.state === 'queued' && e.songs)
        .sort((a, b) => (a.position || 0) - (b.position || 0)),
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

  const maxPosition = useMemo(() => {
    const positions = queuedEntries.map((e) => e.position || 0);
    return positions.length > 0 ? Math.max(...positions) : 0;
  }, [queuedEntries]);

  const favoriteSongIds = useMemo(
    () => new Set(favorites.map((f) => f.song_id)),
    [favorites]
  );

  const isHost = folder?.host_session_id === sessionId;
  const showHostControls = folder?.mode === 'open' || isHost;

  const handleToggleFavorite = async (songId: string) => {
    if (!groupId) return;
    if (favoriteSongIds.has(songId)) {
      const { error } = await supabase
        .from('favorites')
        .delete()
        .eq('group_id', groupId)
        .eq('song_id', songId);
      if (error) return;
      setFavorites((prev) => prev.filter((f) => f.song_id !== songId));
    } else {
      const { data, error } = await supabase
        .from('favorites')
        .insert({ group_id: groupId, song_id: songId })
        .select()
        .single<Favorite>();
      if (error || !data) return;
      setFavorites((prev) => [...prev, data]);
    }
  };

  const handlePlayNext = async () => {
    if (!folderId) return;
    const nextQueued = queuedEntries[0];

    if (currentEntry) {
      const { error } = await supabase
        .from('folder_song_entries')
        .update({ state: 'played', played_at: new Date().toISOString() })
        .eq('id', currentEntry.id);
      if (error) return;
    }

    if (nextQueued) {
      const { error } = await supabase
        .from('folder_song_entries')
        .update({ state: 'current' })
        .eq('id', nextQueued.id);
      if (error) return;
    }

    await supabase
      .from('folders')
      .update({ current_queue_item_id: nextQueued?.id ?? null })
      .eq('id', folderId);

    setEntries((prev) =>
      prev.map((e) => {
        if (currentEntry && e.id === currentEntry.id)
          return { ...e, state: 'played' as const, played_at: new Date().toISOString() };
        if (nextQueued && e.id === nextQueued.id)
          return { ...e, state: 'current' as const };
        return e;
      })
    );
    setFolder((prev) =>
      prev ? { ...prev, current_queue_item_id: nextQueued?.id ?? undefined } : prev
    );
  };

  const handleApproveSuggestion = async (entry: SongWithEntry) => {
    const newPosition = maxPosition + 1;
    const { error } = await supabase
      .from('folder_song_entries')
      .update({ state: 'queued', position: newPosition })
      .eq('id', entry.id);
    if (error) return;

    setEntries((prev) =>
      prev.map((e) =>
        e.id === entry.id ? { ...e, state: 'queued' as const, position: newPosition } : e
      )
    );
  };

  const handleRejectSuggestion = async (entryId: string) => {
    const { error } = await supabase
      .from('folder_song_entries')
      .update({ state: 'removed' })
      .eq('id', entryId);
    if (error) return;

    setEntries((prev) =>
      prev.map((e) => (e.id === entryId ? { ...e, state: 'removed' as const } : e))
    );
  };

  const handleSetStatus = async (status: Folder['status']) => {
    if (!folderId) return;
    const { error } = await supabase
      .from('folders')
      .update({ status })
      .eq('id', folderId);
    if (error) return;

    setFolder((prev) => (prev ? { ...prev, status } : prev));
  };

  const handlePlayNow = async (entry: SongWithEntry) => {
    if (!folderId) return;

    if (currentEntry) {
      const { error } = await supabase
        .from('folder_song_entries')
        .update({ state: 'played', played_at: new Date().toISOString() })
        .eq('id', currentEntry.id);
      if (error) return;
    }

    const { error } = await supabase
      .from('folder_song_entries')
      .update({ state: 'current' })
      .eq('id', entry.id);
    if (error) return;

    await supabase
      .from('folders')
      .update({ current_queue_item_id: entry.id })
      .eq('id', folderId);

    setEntries((prev) =>
      prev.map((e) => {
        if (currentEntry && e.id === currentEntry.id)
          return { ...e, state: 'played' as const, played_at: new Date().toISOString() };
        if (e.id === entry.id)
          return { ...e, state: 'current' as const };
        return e;
      })
    );
    setFolder((prev) => (prev ? { ...prev, current_queue_item_id: entry.id } : prev));
  };

  const handleMoveToBottom = async (entry: SongWithEntry) => {
    const newPosition = maxPosition + 1;

    const { error } = await supabase
      .from('folder_song_entries')
      .update({ state: 'queued', position: newPosition })
      .eq('id', entry.id);
    if (error) return;

    setEntries((prev) =>
      prev.map((e) => (e.id === entry.id ? { ...e, state: 'queued' as const, position: newPosition } : e))
    );
  };

  const handlePlayAsNext = async (entry: SongWithEntry) => {
    const minPosition = queuedEntries.length > 0
      ? Math.min(...queuedEntries.map((e) => e.position || 0))
      : 0;
    const newPosition = minPosition - 1;

    const { error } = await supabase
      .from('folder_song_entries')
      .update({ state: 'queued', position: newPosition })
      .eq('id', entry.id);
    if (error) return;

    setEntries((prev) =>
      prev.map((e) => (e.id === entry.id ? { ...e, state: 'queued' as const, position: newPosition } : e))
    );
  };

  const handleSetMode = async (mode: Folder['mode']) => {
    if (!folderId) return;
    const { error } = await supabase
      .from('folders')
      .update({ mode })
      .eq('id', folderId);
    if (error) return;

    setFolder((prev) => (prev ? { ...prev, mode } : prev));
  };

  const handleRemoveFromQueue = async (entryId: string) => {
    const { error } = await supabase
      .from('folder_song_entries')
      .update({ state: 'removed' })
      .eq('id', entryId);
    if (error) return;
    setEntries((prev) => prev.map((e) => e.id === entryId ? { ...e, state: 'removed' as const } : e));
  };

  const handleOpenEdit = () => {
    setEditTitle(folder?.title ?? '');
    setEditDate(folder?.date ?? '');
    setIsEditSheetOpen(true);
  };

  const handleSaveFolder = async () => {
    if (!folderId || !editTitle.trim()) return;
    setIsSaving(true);
    const { error } = await supabase
      .from('folders')
      .update({ title: editTitle.trim(), date: editDate })
      .eq('id', folderId);
    setIsSaving(false);
    if (error) return;
    setFolder((prev) => prev ? { ...prev, title: editTitle.trim(), date: editDate } : prev);
    setIsEditSheetOpen(false);
  };

  const handleDeleteFolder = async () => {
    if (!folderId || !groupId) return;
    setIsDeleting(true);
    await supabase.from('folder_song_entries').delete().eq('folder_id', folderId);
    const { error } = await supabase.from('folders').delete().eq('id', folderId);
    setIsDeleting(false);
    if (error) return;
    navigate(`/${groupId}`);
  };

  const handleSongAdded = () => {
    if (!groupId || !folderId) return;
    (async () => {
      try {
        const { data: entriesData } = await supabase
          .from('folder_song_entries')
          .select('id, folder_id, song_id, state, position, played_at, songs(id, title, url, content)')
          .eq('folder_id', folderId)
          .order('state', { ascending: true })
          .order('position', { ascending: true });

        if (entriesData) {
          setEntries(entriesData as unknown as SongWithEntry[]);
        }
      } catch (err) {
        console.error('Failed to refresh entries:', err);
      }
    })();
  };

  const formatSongTitle = (song: Song) =>
    song.artist ? `${song.artist} — ${song.title}` : (song.title || 'Ukjent sang');

  const renderSongLink = (entry: SongWithEntry) => {
    const song = entry.songs as Song | undefined;
    if (!song) return 'Ukjent sang';

    if (song.content) {
      return (
        <button
          type="button"
          onClick={() => setSelectedSong(song)}
          className="text-sky-600 hover:underline font-medium break-words text-left border-0 bg-transparent p-0"
        >
          {formatSongTitle(song)}
        </button>
      );
    }

    return (
      <a
        href={song.url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-sky-600 hover:underline font-medium break-words"
      >
        {formatSongTitle(song)}
      </a>
    );
  };

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

  const renderBadge = (text: string, color: string = 'bg-slate-100 text-slate-700') => (
    <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold ${color}`}>
      {text}
    </span>
  );

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 px-4 py-6 sm:px-6">
        <div className="mx-auto max-w-4xl">
          <div className="rounded-2xl bg-white p-6 text-slate-700 shadow-sm">Henter perm…</div>
        </div>
      </div>
    );
  }

  if (error || !folder) {
    return (
      <div className="min-h-screen bg-gray-50 px-4 py-6 sm:px-6">
        <div className="mx-auto max-w-4xl rounded-2xl bg-red-50 p-4 text-sm text-red-800">
          {error || 'Permen finnes ikke.'}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-6 sm:px-6">
      <div className="mx-auto flex max-w-4xl flex-col gap-6">
        {/* Header */}
        <div className="flex flex-col gap-4 rounded-2xl bg-white p-6 shadow-sm">
          <div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate(`/${groupId}`)}
            >
              <ArrowLeft className="h-4 w-4" />
              Tilbake
            </Button>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-3xl font-semibold text-slate-900">{folder.title}</h1>
              <p className="text-sm text-slate-600">{folder.date}</p>
            </div>
            {!showHostControls && (
              <div className="flex gap-2 flex-wrap items-center">
                <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold ${getStatusBadgeColor(folder.status)}`}>
                  {folder.status.charAt(0).toUpperCase() + folder.status.slice(1)}
                </span>
                <span className="text-slate-400 mx-1">{' · '}</span>
                <span className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">
                  {folder.mode.replace('_', ' ')}
                </span>
              </div>
            )}
          </div>
          {showHostControls && (
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap justify-end gap-3">
                <select
                  className="rounded-xl border-0 bg-white shadow-sm px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                  value={folder.status}
                  onChange={(e) => handleSetStatus(e.target.value as Folder['status'])}
                >
                  <option value="planned">Planlagt</option>
                  <option value="active">Aktiv</option>
                  <option value="completed">Fullført</option>
                </select>
                <select
                  className="rounded-xl border-0 bg-white shadow-sm px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                  value={folder.mode}
                  onChange={(e) => handleSetMode(e.target.value as Folder['mode'])}
                >
                  <option value="host_only">Kun vert</option>
                  <option value="suggest">Forslag</option>
                  <option value="open">Åpen</option>
                </select>
              </div>
              <div className="flex justify-end gap-2">
                <Button size="sm" variant="outline" onClick={handleOpenEdit}>
                  Rediger
                </Button>
                {isConfirmingDelete ? (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-slate-600">Er du sikker?</span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setIsConfirmingDelete(false)}
                      disabled={isDeleting}
                    >
                      Avbryt
                    </Button>
                    <Button
                      size="sm"
                      className="bg-red-600 hover:bg-red-700 text-white"
                      onClick={handleDeleteFolder}
                      disabled={isDeleting}
                    >
                      {isDeleting ? 'Sletter…' : 'Ja, slett'}
                    </Button>
                  </div>
                ) : (
                  <Button
                    size="sm"
                    className="bg-red-600 hover:bg-red-700 text-white"
                    onClick={() => setIsConfirmingDelete(true)}
                  >
                    Slett
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Live nå */}
        <div className="rounded-2xl bg-sky-50 p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-sm uppercase tracking-[0.24em] text-sky-600 font-semibold">Live nå</p>
            {showHostControls && (
              <Button
                size="sm"
                onClick={handlePlayNext}
                disabled={!currentEntry && queuedEntries.length === 0}
              >
                Spill neste
              </Button>
            )}
          </div>
          {currentEntry && currentEntry.songs ? (
            <div className="mt-4 space-y-3">
              <h2 className="text-2xl font-bold text-slate-900">{formatSongTitle(currentEntry.songs as Song)}</h2>
              {(currentEntry.songs as Song).content ? (
                <div className="max-h-[60vh] overflow-y-auto rounded-xl bg-white p-4">
                  <pre className="whitespace-pre-wrap font-mono text-sm leading-relaxed text-slate-800">
                    {(currentEntry.songs as Song).content}
                  </pre>
                </div>
              ) : (
                <div>{renderSongLink(currentEntry)}</div>
              )}
            </div>
          ) : (
            <div className="mt-4 text-sm text-sky-600">
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
                <Card key={entry.id}>
                  <CardContent>
                    <div className="flex flex-col gap-2">
                      <div className="flex items-start justify-between gap-4">
                        <span className="flex-shrink-0 text-slate-400 font-semibold">
                          #{entry.position || '–'}
                        </span>
                        <div className="flex-1 min-w-0">{renderSongLink(entry)}</div>
                        <button
                          type="button"
                          onClick={() => handleToggleFavorite((entry.songs as any)?.id)}
                          className="flex-shrink-0 border-0 bg-transparent p-0 transition-colors"
                        >
                          <Heart
                            className={`h-4 w-4 ${favoriteSongIds.has((entry.songs as any)?.id) ? 'fill-sky-500 text-sky-500' : 'text-slate-300 hover:text-sky-400'}`}
                          />
                        </button>
                      </div>
                      {showHostControls && (
                        <div className="flex gap-2 justify-end flex-wrap">
                          <Button size="sm" variant="outline" onClick={() => handleMoveToBottom(entry)}>
                            Flytt nederst
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => handlePlayAsNext(entry)}>
                            Spill som neste
                          </Button>
                          <Button size="sm" onClick={() => handlePlayNow(entry)}>
                            Spill nå
                          </Button>
                          <Button
                            size="sm"
                            className="bg-red-600 hover:bg-red-700 text-white"
                            onClick={() => handleRemoveFromQueue(entry.id)}
                          >
                            Fjern
                          </Button>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="bg-slate-50 text-slate-600 text-sm">
              <CardContent>Ingen sanger i køen ennå.</CardContent>
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
                  <Card key={entry.id} className="bg-slate-50">
                    <CardContent>
                      <div className="flex flex-col gap-3">
                        <div className="flex items-center justify-between gap-4">
                          {renderBadge('Forslag', 'bg-slate-200 text-slate-800')}
                          {showHostControls && (
                            <div className="flex gap-2">
                              <Button size="sm" onClick={() => handleApproveSuggestion(entry)}>
                                Godkjenn
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => handleRejectSuggestion(entry.id)}>
                                Fjern
                              </Button>
                            </div>
                          )}
                        </div>
                        <div>{renderSongLink(entry)}</div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="bg-slate-50 text-slate-600 text-sm">
                <CardContent>Ingen forslag ennå.</CardContent>
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
                <Card key={entry.id} className="opacity-75">
                  <CardContent>
                    <div className="flex flex-col gap-2">
                      <div className="flex items-start justify-between gap-4">
                        <span className="flex-shrink-0 text-slate-400 font-semibold">
                          {idx + 1}.
                        </span>
                        <div className="flex-1 min-w-0">{renderSongLink(entry)}</div>
                        <button
                          type="button"
                          onClick={() => handleToggleFavorite((entry.songs as any)?.id)}
                          className="flex-shrink-0 border-0 bg-transparent p-0 transition-colors"
                        >
                          <Heart
                            className={`h-4 w-4 ${favoriteSongIds.has((entry.songs as any)?.id) ? 'fill-sky-500 text-sky-500' : 'text-slate-300 hover:text-sky-400'}`}
                          />
                        </button>
                      </div>
                      {showHostControls && (
                        <div className="flex gap-2 justify-end">
                          <Button size="sm" variant="outline" onClick={() => handleMoveToBottom(entry)}>
                            Flytt nederst
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => handlePlayAsNext(entry)}>
                            Spill som neste
                          </Button>
                          <Button size="sm" onClick={() => handlePlayNow(entry)}>
                            Spill nå
                          </Button>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="bg-slate-50 text-slate-600 text-sm">
              <CardContent>Ingen sanger spilt ennå.</CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Floating Action Button */}
      {(folder.mode !== 'host_only' || isHost) && (
        <Button
          onClick={() => setIsAddSongModalOpen(true)}
          className="fixed bottom-6 right-6 rounded-full h-14 w-14 p-0 shadow-lg"
        >
          <Plus className="h-6 w-6" />
        </Button>
      )}

      <AddSongModal
        isOpen={isAddSongModalOpen}
        onClose={() => setIsAddSongModalOpen(false)}
        groupId={groupId || ''}
        folderId={folderId || ''}
        folderMode={folder?.mode || 'open'}
        maxPosition={maxPosition}
        onSongAdded={handleSongAdded}
      />

      <SongContentSheet
        isOpen={!!selectedSong}
        onClose={() => setSelectedSong(null)}
        song={selectedSong}
      />

      <Sheet open={isEditSheetOpen} onOpenChange={(open) => { if (!open) setIsEditSheetOpen(false); }}>
        <SheetContent
          side="bottom"
          className="max-h-[85vh] data-[state=open]:flex data-[state=open]:flex-col"
        >
          <SheetHeader className="flex-shrink-0">
            <SheetTitle>Rediger perm</SheetTitle>
          </SheetHeader>
          <div className="flex flex-col gap-4 mt-4 overflow-y-auto">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-slate-700">Tittel</label>
              <Input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                placeholder="Permens tittel"
                onFocus={(e) => setTimeout(() => e.target.scrollIntoView({ behavior: 'smooth', block: 'center' }), 300)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-slate-700">Dato</label>
              <Input
                type="date"
                value={editDate}
                onChange={(e) => setEditDate(e.target.value)}
              />
            </div>
            <div className="flex gap-3 justify-end pt-2">
              <Button
                variant="outline"
                onClick={() => setIsEditSheetOpen(false)}
                disabled={isSaving}
              >
                Avbryt
              </Button>
              <Button
                onClick={handleSaveFolder}
                disabled={isSaving || !editTitle.trim()}
              >
                {isSaving ? 'Lagrer…' : 'Lagre'}
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
