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
import { useAuth } from '@/hooks/useAuth';

interface SongWithEntry extends FolderSongEntry {
  songs?: Song;
}

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

export function FolderView() {
  const { groupId, folderId } = useParams();
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();
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
  const [isSavingGuestCode, setIsSavingGuestCode] = useState(false);

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
        const headers = await pgHeaders();
        const base = BASE();

        const folderRes = await fetch(`${base}/rest/v1/folders?id=eq.${folderId}`, { headers });
        const folderRaw = await folderRes.json();
        const folderData = Array.isArray(folderRaw) ? (folderRaw[0] as Folder) : null;
        if (!folderData) {
          setError('Kunne ikke hente permen. Sjekk at den finnes.');
          setIsLoading(false);
          return;
        }
        setFolder(folderData);

        const entriesRes = await fetch(
          `${base}/rest/v1/folder_song_entries?folder_id=eq.${folderId}&select=id,folder_id,song_id,state,position,played_at,songs(id,title,url,content)&order=state.asc,position.asc`,
          { headers }
        );
        const entriesRaw = await entriesRes.json();
        if (Array.isArray(entriesRaw)) {
          setEntries(entriesRaw as unknown as SongWithEntry[]);
        } else {
          console.error('[FolderView] folder_song_entries fetch error:', entriesRaw);
          setEntries([]);
        }

        const favRes = await fetch(
          `${base}/rest/v1/favorites?group_id=eq.${groupId}&select=id,song_id,group_id,created_at`,
          { headers }
        );
        const favRaw = await favRes.json();
        if (Array.isArray(favRaw)) {
          setFavorites(favRaw as Favorite[]);
        }
      } catch (err) {
        console.error('[FolderView] unexpected error:', err);
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
          const headers = await pgHeaders();
          const res = await fetch(
            `${BASE()}/rest/v1/folder_song_entries?id=eq.${newRow.id}&select=id,folder_id,song_id,state,position,played_at,songs(id,title,url,content)`,
            { headers }
          );
          const raw = await res.json();
          const data = Array.isArray(raw) ? raw[0] : null;
          if (data) {
            setEntries((prev) => {
              if (prev.some((e) => e.id === (data as SongWithEntry).id)) return prev;
              return [...prev, data as SongWithEntry];
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

  const isHost = folder?.owner_user_id === user?.id || isAdmin(groupId!);
  const showQueueControls = folder?.mode === 'open' || isHost;

  const handleToggleFavorite = async (songId: string) => {
    if (!groupId) return;
    const headers = await pgHeaders();
    const base = BASE();
    if (favoriteSongIds.has(songId)) {
      const res = await fetch(
        `${base}/rest/v1/favorites?group_id=eq.${groupId}&song_id=eq.${songId}`,
        { method: 'DELETE', headers }
      );
      if (!res.ok) return;
      setFavorites((prev) => prev.filter((f) => f.song_id !== songId));
    } else {
      const res = await fetch(`${base}/rest/v1/favorites`, {
        method: 'POST',
        headers: { ...headers, Prefer: 'return=representation' },
        body: JSON.stringify({ group_id: groupId, song_id: songId }),
      });
      if (!res.ok) return;
      const raw = await res.json();
      const data = Array.isArray(raw) ? raw[0] : raw;
      if (data) setFavorites((prev) => [...prev, data as Favorite]);
    }
  };

  const handlePlayNext = async () => {
    if (!folderId) return;
    const nextQueued = queuedEntries[0];
    const headers = await pgHeaders();
    const base = BASE();

    if (currentEntry) {
      const res = await fetch(`${base}/rest/v1/folder_song_entries?id=eq.${currentEntry.id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ state: 'played', played_at: new Date().toISOString() }),
      });
      if (!res.ok) return;
    }

    if (nextQueued) {
      const res = await fetch(`${base}/rest/v1/folder_song_entries?id=eq.${nextQueued.id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ state: 'current' }),
      });
      if (!res.ok) return;
    }

    await fetch(`${base}/rest/v1/folders?id=eq.${folderId}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ current_queue_item_id: nextQueued?.id ?? null }),
    });

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
    const headers = await pgHeaders();
    const res = await fetch(`${BASE()}/rest/v1/folder_song_entries?id=eq.${entry.id}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ state: 'queued', position: newPosition }),
    });
    if (!res.ok) return;
    setEntries((prev) =>
      prev.map((e) =>
        e.id === entry.id ? { ...e, state: 'queued' as const, position: newPosition } : e
      )
    );
  };

  const handleRejectSuggestion = async (entryId: string) => {
    const headers = await pgHeaders();
    const res = await fetch(`${BASE()}/rest/v1/folder_song_entries?id=eq.${entryId}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ state: 'removed' }),
    });
    if (!res.ok) return;
    setEntries((prev) =>
      prev.map((e) => (e.id === entryId ? { ...e, state: 'removed' as const } : e))
    );
  };

  const handleSetStatus = async (status: Folder['status']) => {
    if (!folderId) return;
    const headers = await pgHeaders();
    const res = await fetch(`${BASE()}/rest/v1/folders?id=eq.${folderId}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ status }),
    });
    if (!res.ok) return;
    setFolder((prev) => (prev ? { ...prev, status } : prev));
  };

  const handlePlayNow = async (entry: SongWithEntry) => {
    if (!folderId) return;
    const headers = await pgHeaders();
    const base = BASE();

    if (currentEntry) {
      const res = await fetch(`${base}/rest/v1/folder_song_entries?id=eq.${currentEntry.id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ state: 'played', played_at: new Date().toISOString() }),
      });
      if (!res.ok) return;
    }

    const res = await fetch(`${base}/rest/v1/folder_song_entries?id=eq.${entry.id}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ state: 'current' }),
    });
    if (!res.ok) return;

    await fetch(`${base}/rest/v1/folders?id=eq.${folderId}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ current_queue_item_id: entry.id }),
    });

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
    const headers = await pgHeaders();
    const res = await fetch(`${BASE()}/rest/v1/folder_song_entries?id=eq.${entry.id}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ state: 'queued', position: newPosition }),
    });
    if (!res.ok) return;
    setEntries((prev) =>
      prev.map((e) => (e.id === entry.id ? { ...e, state: 'queued' as const, position: newPosition } : e))
    );
  };

  const handlePlayAsNext = async (entry: SongWithEntry) => {
    const minPosition = queuedEntries.length > 0
      ? Math.min(...queuedEntries.map((e) => e.position || 0))
      : 0;
    const newPosition = minPosition - 1;
    const headers = await pgHeaders();
    const res = await fetch(`${BASE()}/rest/v1/folder_song_entries?id=eq.${entry.id}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ state: 'queued', position: newPosition }),
    });
    if (!res.ok) return;
    setEntries((prev) =>
      prev.map((e) => (e.id === entry.id ? { ...e, state: 'queued' as const, position: newPosition } : e))
    );
  };

  const handleSetMode = async (mode: Folder['mode']) => {
    if (!folderId) return;
    const headers = await pgHeaders();
    const res = await fetch(`${BASE()}/rest/v1/folders?id=eq.${folderId}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ mode }),
    });
    if (!res.ok) return;
    setFolder((prev) => (prev ? { ...prev, mode } : prev));
  };

  const handleRemoveFromQueue = async (entryId: string) => {
    const headers = await pgHeaders();
    const res = await fetch(`${BASE()}/rest/v1/folder_song_entries?id=eq.${entryId}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ state: 'removed' }),
    });
    if (!res.ok) return;
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
    const headers = await pgHeaders();
    const res = await fetch(`${BASE()}/rest/v1/folders?id=eq.${folderId}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ title: editTitle.trim(), date: editDate }),
    });
    setIsSaving(false);
    if (!res.ok) return;
    setFolder((prev) => prev ? { ...prev, title: editTitle.trim(), date: editDate } : prev);
    setIsEditSheetOpen(false);
  };

  const handleDeleteFolder = async () => {
    if (!folderId || !groupId) return;
    setIsDeleting(true);
    const headers = await pgHeaders();
    const base = BASE();
    await fetch(`${base}/rest/v1/folder_song_entries?folder_id=eq.${folderId}`, {
      method: 'DELETE',
      headers,
    });
    const res = await fetch(`${base}/rest/v1/folders?id=eq.${folderId}`, {
      method: 'DELETE',
      headers,
    });
    setIsDeleting(false);
    if (!res.ok) return;
    navigate(`/${groupId}`);
  };

  const handleGenerateGuestCode = async () => {
    if (!folderId) return;
    setIsSavingGuestCode(true);
    const guestCode = crypto.randomUUID();
    const headers = await pgHeaders();
    const res = await fetch(`${BASE()}/rest/v1/folders?id=eq.${folderId}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ guest_code: guestCode }),
    });
    if (res.ok) setFolder((prev) => (prev ? { ...prev, guest_code: guestCode } : prev));
    setIsSavingGuestCode(false);
  };

  const handleDeactivateGuestCode = async () => {
    if (!folderId) return;
    setIsSavingGuestCode(true);
    const headers = await pgHeaders();
    const res = await fetch(`${BASE()}/rest/v1/folders?id=eq.${folderId}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ guest_code: null }),
    });
    if (res.ok) setFolder((prev) => (prev ? { ...prev, guest_code: undefined } : prev));
    setIsSavingGuestCode(false);
  };

  const handleSongAdded = () => {
    if (!groupId || !folderId) return;
    (async () => {
      try {
        const headers = await pgHeaders();
        const res = await fetch(
          `${BASE()}/rest/v1/folder_song_entries?folder_id=eq.${folderId}&select=id,folder_id,song_id,state,position,played_at,songs(id,title,url,content)&order=state.asc,position.asc`,
          { headers }
        );
        const raw = await res.json();
        if (Array.isArray(raw)) {
          setEntries(raw as unknown as SongWithEntry[]);
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
            {!isHost && (
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
          {isHost && (
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
              <div className="flex flex-col gap-2 pt-2 border-t border-slate-100">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Gjesteinvitasjon</p>
                {folder.guest_code ? (
                  <>
                    <div className="flex gap-2 items-center">
                      <input
                        type="text"
                        readOnly
                        value={`${window.location.origin}/join/${folder.guest_code}`}
                        className="flex-1 rounded-xl bg-slate-50 border-0 px-3 py-2 text-xs text-slate-600 shadow-sm"
                        onClick={(e) => (e.target as HTMLInputElement).select()}
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => navigator.clipboard.writeText(`${window.location.origin}/join/${folder.guest_code!}`)}
                      >
                        Kopier
                      </Button>
                    </div>
                    <Button size="sm" variant="outline" onClick={handleDeactivateGuestCode} disabled={isSavingGuestCode}>
                      {isSavingGuestCode ? 'Deaktiverer…' : 'Deaktiver gjestekode'}
                    </Button>
                  </>
                ) : (
                  <Button size="sm" onClick={handleGenerateGuestCode} disabled={isSavingGuestCode}>
                    {isSavingGuestCode ? 'Genererer…' : 'Generer gjestekode'}
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
            {showQueueControls && (
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
                      {showQueueControls && (
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

        {/* Forslag — vises uansett mode hvis det finnes forslag */}
        {suggestedEntries.length > 0 && (
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
                          {isHost && (
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
                      {showQueueControls && (
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
