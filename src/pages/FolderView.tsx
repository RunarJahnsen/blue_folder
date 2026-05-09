import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, GripVertical, Heart, PlayCircle, Plus, Star } from 'lucide-react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { supabase } from '@/lib/supabase';
import type { Favorite, Folder, FolderSongEntry, Song, UserFavorite } from '@/lib/types';
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

interface SortableQueueItemProps {
  entry: SongWithEntry;
  showQueueControls: boolean;
  isFavorite: boolean;
  onToggleFavorite: (songId: string) => void;
  showUserFavorite: boolean;
  isUserFavorite: boolean;
  onToggleUserFavorite: (songId: string) => void;
  onSongClick: (song: Song) => void;
  onMoveToBottom: (entry: SongWithEntry) => void;
  onPlayAsNext: (entry: SongWithEntry) => void;
  onPlayNow: (entry: SongWithEntry) => void;
  onRemove: (entryId: string) => void;
}

function SortableQueueItem({
  entry, showQueueControls, isFavorite, onToggleFavorite,
  showUserFavorite, isUserFavorite, onToggleUserFavorite,
  onSongClick, onMoveToBottom, onPlayAsNext, onPlayNow, onRemove,
}: SortableQueueItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: entry.id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : undefined,
  };

  const song = entry.songs as Song | undefined;
  const songTitle = song?.title || 'Ukjent sang';

  const titleEl = song?.content ? (
    <button
      type="button"
      onClick={() => onSongClick(song)}
      className="text-sky-600 hover:underline font-medium break-words text-left border-0 bg-transparent p-0"
    >
      {songTitle}
    </button>
  ) : song?.url ? (
    <a href={song.url} target="_blank" rel="noopener noreferrer"
      className="text-sky-600 hover:underline font-medium break-words">
      {songTitle}
    </a>
  ) : (
    <span className="font-medium text-slate-900">{songTitle}</span>
  );

  return (
    <div ref={setNodeRef} style={style}>
      <Card>
        <CardContent>
          <div className="flex flex-col gap-2">
            <div className="flex items-start justify-between gap-4">
              {showQueueControls && (
                <button
                  type="button"
                  {...attributes}
                  {...listeners}
                  className="flex-shrink-0 border-0 bg-transparent p-1.5 -ml-1.5 cursor-grab active:cursor-grabbing text-slate-300 hover:text-slate-500 touch-none"
                  aria-label="Dra for å sortere"
                >
                  <GripVertical className="h-4 w-4" />
                </button>
              )}
              <span className="flex-shrink-0 text-slate-400 font-semibold">
                #{entry.position || '–'}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-1.5">
                  {song?.song_number && (
                    <span className="flex-shrink-0 text-xs text-slate-400 font-medium">#{song.song_number}</span>
                  )}
                  {titleEl}
                </div>
                {song?.artist && <p className="text-xs text-slate-400 mt-0.5">{song.artist}</p>}
                {song?.listen_url && (
                  <a
                    href={song.listen_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="inline-flex items-center gap-1 text-xs text-sky-600 hover:underline mt-0.5"
                  >
                    <PlayCircle className="h-3.5 w-3.5" />
                    Lytt til sangen
                  </a>
                )}
              </div>
              <div className="flex-shrink-0 flex items-center -mr-2">
                <button
                  type="button"
                  onClick={() => song?.id && onToggleFavorite(song.id)}
                  className="border-0 bg-transparent p-2 transition-colors"
                >
                  <Heart className={`h-4 w-4 ${isFavorite ? 'fill-sky-500 text-sky-500' : 'text-slate-300 hover:text-sky-400'}`} />
                </button>
                {showUserFavorite && (
                  <button
                    type="button"
                    onClick={() => song?.id && onToggleUserFavorite(song.id)}
                    className="border-0 bg-transparent p-2 transition-colors"
                  >
                    <Star className={`h-4 w-4 ${isUserFavorite ? 'fill-amber-400 text-amber-400' : 'text-slate-300 hover:text-amber-400'}`} />
                  </button>
                )}
              </div>
            </div>
            {showQueueControls && (
              <div className="flex gap-2 justify-end flex-wrap">
                <Button size="sm" variant="outline" onClick={() => onMoveToBottom(entry)}>
                  Flytt nederst
                </Button>
                <Button size="sm" variant="outline" onClick={() => onPlayAsNext(entry)}>
                  Spill som neste
                </Button>
                <Button size="sm" onClick={() => onPlayNow(entry)}>
                  Spill nå
                </Button>
                <Button size="sm" className="bg-red-600 hover:bg-red-700 text-white" onClick={() => onRemove(entry.id)}>
                  Fjern
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
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
  const [userFavorites, setUserFavorites] = useState<UserFavorite[]>([]);
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
          `${base}/rest/v1/folder_song_entries?folder_id=eq.${folderId}&select=id,folder_id,song_id,state,position,played_at,songs(id,title,artist,url,listen_url,content,song_number)&order=state.asc,position.asc`,
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
            `${BASE()}/rest/v1/folder_song_entries?id=eq.${newRow.id}&select=id,folder_id,song_id,state,position,played_at,songs(id,title,artist,url,listen_url,content,song_number)`,
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
                ? { ...e, state: updated.state, played_at: updated.played_at }
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

  useEffect(() => {
    if (!user || !groupId) return;
    (async () => {
      const headers = await pgHeaders();
      const res = await fetch(
        `${BASE()}/rest/v1/user_favorites?group_id=eq.${groupId}&select=id,song_id`,
        { headers }
      );
      const data = await res.json();
      if (Array.isArray(data)) setUserFavorites(data as UserFavorite[]);
    })();
  }, [user, groupId]);

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

  const userFavoriteSongIds = useMemo(
    () => new Set(userFavorites.map((f) => f.song_id)),
    [userFavorites]
  );

  const handleToggleUserFavorite = async (songId: string) => {
    if (!groupId || !user) return;
    const headers = await pgHeaders();
    const base = BASE();
    if (userFavoriteSongIds.has(songId)) {
      const existing = userFavorites.find((f) => f.song_id === songId);
      if (!existing) return;
      setUserFavorites((prev) => prev.filter((f) => f.song_id !== songId));
      await fetch(`${base}/rest/v1/user_favorites?id=eq.${existing.id}`, { method: 'DELETE', headers });
    } else {
      setUserFavorites((prev) => [...prev, { id: '', user_id: user.id, song_id: songId, group_id: groupId, created_at: '' }]);
      const res = await fetch(`${base}/rest/v1/user_favorites`, {
        method: 'POST',
        headers: { ...headers, Prefer: 'return=representation' },
        body: JSON.stringify({ user_id: user.id, song_id: songId, group_id: groupId }),
      });
      if (res.ok) {
        const raw = await res.json();
        const data = Array.isArray(raw) ? raw[0] : raw;
        if (data) setUserFavorites((prev) => prev.map((f) => f.song_id === songId && f.id === '' ? data as UserFavorite : f));
      } else {
        setUserFavorites((prev) => prev.filter((f) => f.song_id !== songId));
      }
    }
  };

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
    const remainingAfterNext = queuedEntries.slice(1);
    await normalizePositions(remainingAfterNext.map((e) => e.id));
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
    const remainingAfterNow = queuedEntries.filter((e) => e.id !== entry.id);
    await normalizePositions(remainingAfterNow.map((e) => e.id));
  };

  const normalizePositions = async (orderedIds: string[]) => {
    if (orderedIds.length === 0) return;
    const headers = await pgHeaders();
    await fetch(`${BASE()}/rest/v1/folder_song_entries?on_conflict=id`, {
      method: 'POST',
      headers: { ...headers, Prefer: 'resolution=merge-duplicates' },
      body: JSON.stringify(orderedIds.map((id, i) => ({ id, position: i + 1 }))),
    });
  };

  const handleMoveToBottom = async (entry: SongWithEntry) => {
    const reordered = [
      ...queuedEntries.filter((e) => e.id !== entry.id),
      { ...entry, state: 'queued' as const },
    ];
    // Optimistic update first — prevents Realtime event from overwriting
    setEntries((prev) =>
      prev.map((e) => {
        const idx = reordered.findIndex((r) => r.id === e.id);
        return idx !== -1 ? { ...e, state: 'queued' as const, position: idx + 1 } : e;
      })
    );
    // Only PATCH if state needs to change (entry comes from played/suggested)
    if (entry.state !== 'queued') {
      const headers = await pgHeaders();
      await fetch(`${BASE()}/rest/v1/folder_song_entries?id=eq.${entry.id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ state: 'queued', position: reordered.length }),
      });
    }
    await normalizePositions(reordered.map((e) => e.id));
  };

  const handlePlayAsNext = async (entry: SongWithEntry) => {
    const reordered = [
      { ...entry, state: 'queued' as const },
      ...queuedEntries.filter((e) => e.id !== entry.id),
    ];
    // Optimistic update first — prevents Realtime event from overwriting
    setEntries((prev) =>
      prev.map((e) => {
        const idx = reordered.findIndex((r) => r.id === e.id);
        return idx !== -1 ? { ...e, state: 'queued' as const, position: idx + 1 } : e;
      })
    );
    // Only PATCH if state needs to change (entry comes from played/suggested)
    if (entry.state !== 'queued') {
      const headers = await pgHeaders();
      await fetch(`${BASE()}/rest/v1/folder_song_entries?id=eq.${entry.id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ state: 'queued', position: 1 }),
      });
    }
    await normalizePositions(reordered.map((e) => e.id));
  };

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } })
  );

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = queuedEntries.findIndex((e) => e.id === active.id);
    const newIndex = queuedEntries.findIndex((e) => e.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = [...queuedEntries];
    const [moved] = reordered.splice(oldIndex, 1);
    reordered.splice(newIndex, 0, moved);

    const snapshot = [...entries];
    setEntries((prev) =>
      prev.map((e) => {
        const idx = reordered.findIndex((r) => r.id === e.id);
        return idx !== -1 ? { ...e, position: idx + 1 } : e;
      })
    );

    const ok = await normalizePositions(reordered.map((e) => e.id)).then(() => true).catch(() => false);
    if (!ok) setEntries(snapshot);
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
          `${BASE()}/rest/v1/folder_song_entries?folder_id=eq.${folderId}&select=id,folder_id,song_id,state,position,played_at,songs(id,title,artist,url,listen_url,content,song_number)&order=state.asc,position.asc`,
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

  const renderSongLink = (entry: SongWithEntry) => {
    const song = entry.songs as Song | undefined;
    if (!song) return 'Ukjent sang';

    const titleEl = song.content ? (
      <button
        type="button"
        onClick={() => setSelectedSong(song)}
        className="text-sky-600 hover:underline font-medium break-words text-left border-0 bg-transparent p-0"
      >
        {song.title || 'Ukjent sang'}
      </button>
    ) : (
      <a
        href={song.url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-sky-600 hover:underline font-medium break-words"
      >
        {song.title || 'Ukjent sang'}
      </a>
    );

    return (
      <div>
        <div className="flex items-baseline gap-1.5">
          {song.song_number && (
            <span className="flex-shrink-0 text-xs text-slate-400 font-medium">#{song.song_number}</span>
          )}
          {titleEl}
        </div>
        {song.artist && <p className="text-xs text-slate-400 mt-0.5">{song.artist}</p>}
        {song.listen_url && (
          <a
            href={song.listen_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-sky-600 hover:underline mt-0.5"
          >
            <PlayCircle className="h-3.5 w-3.5" />
            Lytt til sangen
          </a>
        )}
      </div>
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
              <div>
                <h2 className="text-2xl font-bold text-slate-900">{(currentEntry.songs as Song).title || 'Ukjent sang'}</h2>
                {(currentEntry.songs as Song).artist && (
                  <p className="text-sm text-slate-500 mt-0.5">{(currentEntry.songs as Song).artist}</p>
                )}
                {(currentEntry.songs as Song).listen_url && (
                  <a
                    href={(currentEntry.songs as Song).listen_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-sky-600 hover:underline mt-1"
                  >
                    <PlayCircle className="h-3.5 w-3.5" />
                    Lytt til sangen
                  </a>
                )}
              </div>
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
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={queuedEntries.map((e) => e.id)} strategy={verticalListSortingStrategy}>
                <div className="grid gap-3">
                  {queuedEntries.map((entry) => (
                    <SortableQueueItem
                      key={entry.id}
                      entry={entry}
                      showQueueControls={showQueueControls}
                      isFavorite={favoriteSongIds.has((entry.songs as Song | undefined)?.id ?? '')}
                      onToggleFavorite={handleToggleFavorite}
                      showUserFavorite={!!user}
                      isUserFavorite={userFavoriteSongIds.has((entry.songs as Song | undefined)?.id ?? '')}
                      onToggleUserFavorite={handleToggleUserFavorite}
                      onSongClick={setSelectedSong}
                      onMoveToBottom={handleMoveToBottom}
                      onPlayAsNext={handlePlayAsNext}
                      onPlayNow={handlePlayNow}
                      onRemove={handleRemoveFromQueue}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
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
                        <div className="flex items-start gap-2">
                          <div className="flex-1 min-w-0">{renderSongLink(entry)}</div>
                          {user && (
                            <button
                              type="button"
                              onClick={() => entry.songs?.id && handleToggleUserFavorite(entry.songs.id)}
                              className="flex-shrink-0 border-0 bg-transparent p-1.5 transition-colors"
                            >
                              <Star className={`h-4 w-4 ${userFavoriteSongIds.has(entry.songs?.id ?? '') ? 'fill-amber-400 text-amber-400' : 'text-slate-300 hover:text-amber-400'}`} />
                            </button>
                          )}
                        </div>
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
                        <div className="flex-shrink-0 flex items-center -mr-2">
                          <button
                            type="button"
                            onClick={() => entry.songs?.id && handleToggleFavorite(entry.songs.id)}
                            className="border-0 bg-transparent p-2 transition-colors"
                          >
                            <Heart className={`h-4 w-4 ${favoriteSongIds.has(entry.songs?.id ?? '') ? 'fill-sky-500 text-sky-500' : 'text-slate-300 hover:text-sky-400'}`} />
                          </button>
                          {user && (
                            <button
                              type="button"
                              onClick={() => entry.songs?.id && handleToggleUserFavorite(entry.songs.id)}
                              className="border-0 bg-transparent p-2 transition-colors"
                            >
                              <Star className={`h-4 w-4 ${userFavoriteSongIds.has(entry.songs?.id ?? '') ? 'fill-amber-400 text-amber-400' : 'text-slate-300 hover:text-amber-400'}`} />
                            </button>
                          )}
                        </div>
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
