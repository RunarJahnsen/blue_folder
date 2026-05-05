import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Heart, Plus, Star, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Favorite, SongWithTags, Tag, SongTagEntry, UserFavorite } from '@/lib/types';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';

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

export function SongList() {
  const { groupId } = useParams();
  const navigate = useNavigate();
  const { isAdmin, username, user } = useAuth();
  const [songs, setSongs] = useState<SongWithTags[]>([]);
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [userFavorites, setUserFavorites] = useState<UserFavorite[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [activeFilterTags, setActiveFilterTags] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [activeAddedByFilter, setActiveAddedByFilter] = useState<string[]>([]);
  const [filterMyFavorites, setFilterMyFavorites] = useState(false);
  const [filterGroupFavorites, setFilterGroupFavorites] = useState(false);
  const [sortBy, setSortBy] = useState<'alpha' | 'plays' | 'recent'>('alpha');
  const [playedEntries, setPlayedEntries] = useState<Array<{ song_id: string; played_at: string | null }>>([]);

  const [editingSong, setEditingSong] = useState<SongWithTags | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editArtist, setEditArtist] = useState('');
  const [editUrl, setEditUrl] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editTagNames, setEditTagNames] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isFetchingContent, setIsFetchingContent] = useState(false);

  const [isAddingSong, setIsAddingSong] = useState(false);
  const [newInputMode, setNewInputMode] = useState<'url' | 'lyrics'>('url');
  const [newTitle, setNewTitle] = useState('');
  const [newArtist, setNewArtist] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [newLyrics, setNewLyrics] = useState('');
  const [newError, setNewError] = useState('');
  const [isCreatingSong, setIsCreatingSong] = useState(false);

  useEffect(() => {
    if (!groupId) return;
    (async () => {
      const headers = await pgHeaders();
      const base = BASE();
      const [songsRes, favsRes, tagsRes, userFavsRes, playedRes] = await Promise.all([
        fetch(`${base}/rest/v1/songs?group_id=eq.${groupId}&select=id,group_id,title,artist,url,content,added_by,created_at,updated_at,song_tags(id,tag_id,tags(id,name))&order=title.asc`, { headers }),
        fetch(`${base}/rest/v1/favorites?group_id=eq.${groupId}&select=id,song_id`, { headers }),
        fetch(`${base}/rest/v1/tags?group_id=eq.${groupId}&select=id,group_id,name,created_at&order=name.asc`, { headers }),
        fetch(`${base}/rest/v1/user_favorites?group_id=eq.${groupId}&select=id,song_id`, { headers }),
        fetch(`${base}/rest/v1/folder_song_entries?group_id=eq.${groupId}&state=eq.played&select=song_id,played_at`, { headers }),
      ]);
      const [songsData, favsData, tagsData, userFavsData, playedData] = await Promise.all([
        songsRes.json(), favsRes.json(), tagsRes.json(), userFavsRes.json(), playedRes.json(),
      ]);
      if (!Array.isArray(songsData)) setError('Kunne ikke hente sanger.');
      else setSongs(songsData as unknown as SongWithTags[]);
      if (Array.isArray(favsData)) setFavorites(favsData as Favorite[]);
      if (Array.isArray(tagsData)) setAllTags(tagsData as Tag[]);
      if (Array.isArray(userFavsData)) setUserFavorites(userFavsData as UserFavorite[]);
      if (Array.isArray(playedData)) setPlayedEntries(playedData as Array<{ song_id: string; played_at: string | null }>);
      setIsLoading(false);
    })();
  }, [groupId]);

  const favoriteSongIds = useMemo(
    () => new Set(favorites.map((f) => f.song_id)),
    [favorites]
  );

  const userFavoriteSongIds = useMemo(
    () => new Set(userFavorites.map((f) => f.song_id)),
    [userFavorites]
  );

  const playStats = useMemo(() => {
    const map = new Map<string, { count: number; lastPlayedAt: string | null }>();
    for (const e of playedEntries) {
      const existing = map.get(e.song_id);
      if (!existing) {
        map.set(e.song_id, { count: 1, lastPlayedAt: e.played_at });
      } else {
        const newer = e.played_at && (!existing.lastPlayedAt || e.played_at > existing.lastPlayedAt)
          ? e.played_at
          : existing.lastPlayedAt;
        map.set(e.song_id, { count: existing.count + 1, lastPlayedAt: newer });
      }
    }
    return map;
  }, [playedEntries]);

  const handleToggleFavorite = async (songId: string) => {
    if (!groupId) return;
    const headers = await pgHeaders();
    const base = BASE();
    if (favoriteSongIds.has(songId)) {
      const existing = favorites.find((f) => f.song_id === songId);
      if (!existing) return;
      setFavorites((prev) => prev.filter((f) => f.song_id !== songId));
      await fetch(`${base}/rest/v1/favorites?id=eq.${existing.id}`, { method: 'DELETE', headers });
    } else {
      const res = await fetch(`${base}/rest/v1/favorites`, {
        method: 'POST',
        headers: { ...headers, Prefer: 'return=representation' },
        body: JSON.stringify({ group_id: groupId, song_id: songId }),
      });
      if (res.ok) {
        const raw = await res.json();
        const data = Array.isArray(raw) ? raw[0] : raw;
        if (data) setFavorites((prev) => [...prev, data as Favorite]);
      }
    }
  };

  const handleToggleUserFavorite = async (songId: string) => {
    if (!groupId || !user) return;
    const headers = await pgHeaders();
    const base = BASE();
    if (userFavoriteSongIds.has(songId)) {
      const existing = userFavorites.find((f) => f.song_id === songId);
      if (!existing) return;
      const res = await fetch(`${base}/rest/v1/user_favorites?id=eq.${existing.id}`, { method: 'DELETE', headers });
      if (!res.ok) return;
      setUserFavorites((prev) => prev.filter((f) => f.song_id !== songId));
    } else {
      const res = await fetch(`${base}/rest/v1/user_favorites`, {
        method: 'POST',
        headers: { ...headers, Prefer: 'return=representation' },
        body: JSON.stringify({ user_id: user.id, song_id: songId, group_id: groupId }),
      });
      if (!res.ok) return;
      const raw = await res.json();
      const data = Array.isArray(raw) ? raw[0] : raw;
      if (data) setUserFavorites((prev) => [...prev, data as UserFavorite]);
    }
  };

  const tagsInUse = useMemo(() => {
    const tagMap = new Map<string, Tag>();
    songs.forEach(song => {
      song.song_tags?.forEach(st => {
        if (st.tags) tagMap.set(st.tags.id, st.tags);
      });
    });
    return Array.from(tagMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [songs]);

  const uniqueAddedBy = useMemo(() => {
    const set = new Set<string>();
    songs.forEach(s => { if (s.added_by) set.add(s.added_by); });
    return Array.from(set).sort();
  }, [songs]);

  const filteredSongs = useMemo(() => {
    let result = songs;
    const q = search.trim().toLowerCase();
    if (q) {
      result = result.filter(s =>
        (s.title?.toLowerCase() ?? '').includes(q) ||
        (s.artist?.toLowerCase() ?? '').includes(q) ||
        (s.content?.toLowerCase() ?? '').includes(q)
      );
    }
    if (activeAddedByFilter.length > 0) {
      result = result.filter(s => s.added_by && activeAddedByFilter.includes(s.added_by));
    }
    if (activeFilterTags.length > 0) {
      result = result.filter(song =>
        activeFilterTags.some(tagId => song.song_tags?.some(st => st.tag_id === tagId))
      );
    }
    if (filterMyFavorites) {
      result = result.filter(s => userFavoriteSongIds.has(s.id));
    }
    if (filterGroupFavorites) {
      result = result.filter(s => favoriteSongIds.has(s.id));
    }
    if (sortBy === 'plays') {
      result = [...result].sort((a, b) => (playStats.get(b.id)?.count ?? 0) - (playStats.get(a.id)?.count ?? 0));
    } else if (sortBy === 'recent') {
      result = [...result].sort((a, b) => {
        const aDate = playStats.get(a.id)?.lastPlayedAt ?? '';
        const bDate = playStats.get(b.id)?.lastPlayedAt ?? '';
        return bDate.localeCompare(aDate);
      });
    }
    return result;
  }, [songs, search, activeAddedByFilter, activeFilterTags, filterMyFavorites, filterGroupFavorites, userFavoriteSongIds, favoriteSongIds, sortBy, playStats]);

  const tagSuggestions = useMemo(() => {
    const q = tagInput.trim().toLowerCase();
    if (!q) return [];
    return allTags
      .filter(t => t.name.includes(q) && !editTagNames.includes(t.name))
      .slice(0, 5);
  }, [tagInput, allTags, editTagNames]);

  const handleDelete = async (songId: string) => {
    setIsDeleting(true);
    const headers = await pgHeaders();
    const base = BASE();
    await fetch(`${base}/rest/v1/favorites?song_id=eq.${songId}`, { method: 'DELETE', headers });
    await fetch(`${base}/rest/v1/folder_song_entries?song_id=eq.${songId}`, { method: 'DELETE', headers });
    const res = await fetch(`${base}/rest/v1/songs?id=eq.${songId}`, { method: 'DELETE', headers });
    if (!res.ok) {
      setError('Kunne ikke slette sangen. Prøv igjen.');
    } else {
      setSongs((prev) => prev.filter((s) => s.id !== songId));
    }
    setConfirmDeleteId(null);
    setIsDeleting(false);
  };

  const handleOpenEdit = (song: SongWithTags) => {
    setEditingSong(song);
    setEditTitle(song.title ?? '');
    setEditArtist(song.artist ?? '');
    setEditUrl(song.url ?? '');
    setEditContent(song.content ?? '');
    setEditTagNames(
      (song.song_tags?.map(st => st.tags?.name).filter(Boolean) as string[]) ?? []
    );
    setTagInput('');
  };

  const handleAddTagToEdit = (name: string) => {
    const normalized = name.trim().toLowerCase();
    if (!normalized || editTagNames.includes(normalized)) { setTagInput(''); return; }
    setEditTagNames(prev => [...prev, normalized]);
    setTagInput('');
  };

  const handleRemoveTagFromEdit = (name: string) => {
    setEditTagNames(prev => prev.filter(t => t !== name));
  };

  const handleTagInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const q = tagInput.trim().toLowerCase();
      if (!q) return;
      const exactMatch = tagSuggestions.find(t => t.name === q);
      handleAddTagToEdit(exactMatch ? exactMatch.name : q);
    }
  };

  const handleFetchContent = async () => {
    if (!editingSong || !editUrl.trim()) return;
    setIsFetchingContent(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token ?? import.meta.env.VITE_SUPABASE_ANON_KEY;
      await supabase.functions.invoke('fetch-song-content', {
        body: { url: editUrl.trim(), song_id: editingSong.id },
        headers: {
          apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
          Authorization: `Bearer ${token}`,
        },
      });
      const headers = await pgHeaders();
      const res = await fetch(
        `${BASE()}/rest/v1/songs?id=eq.${editingSong.id}&select=content`,
        { headers }
      );
      const raw = await res.json();
      const content = Array.isArray(raw) ? raw[0]?.content : null;
      if (content) setEditContent(content);
    } catch {}
    setIsFetchingContent(false);
  };

  const handleCreateSong = async () => {
    if (!newTitle.trim() || !groupId) return;
    if (newInputMode === 'url' && !newUrl.trim()) { setNewError('URL er påkrevd.'); return; }
    setNewError('');
    setIsCreatingSong(true);
    const headers = await pgHeaders();
    const res = await fetch(`${BASE()}/rest/v1/songs`, {
      method: 'POST',
      headers: { ...headers, Prefer: 'return=representation' },
      body: JSON.stringify({
        group_id: groupId,
        title: newTitle.trim(),
        url: newInputMode === 'url' ? newUrl.trim() : '',
        ...(newArtist.trim() ? { artist: newArtist.trim() } : {}),
        ...(newInputMode === 'lyrics' && newLyrics.trim() ? { content: newLyrics.trim() } : {}),
        ...(username ? { added_by: username } : {}),
      }),
    });
    if (!res.ok) { setNewError('Kunne ikke opprette sang.'); setIsCreatingSong(false); return; }
    const raw = await res.json();
    const created = Array.isArray(raw) ? (raw[0] as SongWithTags) : null;
    if (created && newInputMode === 'url' && newUrl.trim()) {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token ?? import.meta.env.VITE_SUPABASE_ANON_KEY;
        await supabase.functions.invoke('fetch-song-content', {
          body: { url: created.url, song_id: created.id },
          headers: { apikey: import.meta.env.VITE_SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` },
        });
      } catch {}
    }
    if (created) setSongs(prev => [...prev, created].sort((a, b) => a.title.localeCompare(b.title)));
    setNewTitle(''); setNewArtist(''); setNewUrl(''); setNewLyrics('');
    setIsAddingSong(false);
    setIsCreatingSong(false);
  };

  const handleSaveSong = async () => {
    if (!editingSong || !editTitle.trim() || !groupId) return;
    setIsSaving(true);
    const headers = await pgHeaders();
    const base = BASE();
    const updatedBy = username ?? null;

    const updateRes = await fetch(`${base}/rest/v1/songs?id=eq.${editingSong.id}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({
        title: editTitle.trim(),
        artist: editArtist.trim() || null,
        url: editUrl.trim(),
        content: editContent.trim() || null,
        ...(updatedBy ? { updated_by: updatedBy } : {}),
      }),
    });
    if (!updateRes.ok) { setIsSaving(false); return; }

    let savedTags: Tag[] = [];
    if (editTagNames.length > 0) {
      const upsertRes = await fetch(`${base}/rest/v1/tags?on_conflict=group_id,name`, {
        method: 'POST',
        headers: { ...headers, Prefer: 'resolution=merge-duplicates,return=representation' },
        body: JSON.stringify(editTagNames.map(name => ({ group_id: groupId, name }))),
      });
      if (upsertRes.ok) {
        const raw = await upsertRes.json();
        if (Array.isArray(raw)) savedTags = raw as Tag[];
      }
    }

    await fetch(`${base}/rest/v1/song_tags?song_id=eq.${editingSong.id}`, {
      method: 'DELETE',
      headers,
    });

    if (savedTags.length > 0) {
      await fetch(`${base}/rest/v1/song_tags`, {
        method: 'POST',
        headers,
        body: JSON.stringify(
          savedTags.map(tag => ({ song_id: editingSong.id, tag_id: tag.id, group_id: groupId }))
        ),
      });
    }

    const newSongTags: SongTagEntry[] = savedTags.map(tag => ({
      id: '',
      song_id: editingSong.id,
      tag_id: tag.id,
      group_id: groupId,
      tags: tag,
    }));

    setSongs(prev => prev.map(s =>
      s.id === editingSong.id
        ? { ...s, title: editTitle.trim(), artist: editArtist.trim() || undefined, url: editUrl.trim(), content: editContent.trim() || undefined, song_tags: newSongTags }
        : s
    ));

    setAllTags(prev => {
      const existingIds = new Set(prev.map(t => t.id));
      const newTags = savedTags.filter(t => !existingIds.has(t.id));
      return newTags.length > 0
        ? [...prev, ...newTags].sort((a, b) => a.name.localeCompare(b.name))
        : prev;
    });

    setIsSaving(false);
    setEditingSong(null);
  };

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-6 sm:px-6">
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="flex flex-col gap-4 rounded-2xl bg-white p-6 shadow-sm">
          <div>
            <Button variant="outline" size="sm" onClick={() => navigate(`/${groupId}`)}>
              <ArrowLeft className="h-4 w-4" />
              Tilbake
            </Button>
          </div>
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm uppercase tracking-[0.24em] text-sky-600 font-semibold">Blå perm</p>
              <h1 className="text-2xl font-semibold text-slate-900">Sanger</h1>
              <p className="text-sm text-slate-600">Alle sanger lagret i gruppen.</p>
            </div>
            <Button size="sm" onClick={() => setIsAddingSong(true)}>
              <Plus className="h-4 w-4" />
              Ny sang
            </Button>
          </div>
        </div>

        {error && (
          <div className="rounded-2xl bg-red-50 p-4 text-sm text-red-800">{error}</div>
        )}

        <div className="flex gap-2">
          <Input
            type="search"
            placeholder="Søk på tittel, artist eller tekst…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1"
          />
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'alpha' | 'plays' | 'recent')}
            className="rounded-xl border-0 bg-white shadow-sm px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
          >
            <option value="alpha">A–Å</option>
            <option value="plays">Mest spilt</option>
            <option value="recent">Sist spilt</option>
          </select>
        </div>

        {/* Favorite filters — only for logged-in users */}
        {user && (
          <div className="flex flex-wrap gap-2 px-1">
            <button
              type="button"
              onClick={() => setFilterMyFavorites(prev => !prev)}
              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors border-0 ${
                filterMyFavorites ? 'bg-amber-400 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              Mine favoritter
            </button>
            <button
              type="button"
              onClick={() => setFilterGroupFavorites(prev => !prev)}
              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors border-0 ${
                filterGroupFavorites ? 'bg-sky-500 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              Felles favoritter
            </button>
          </div>
        )}

        {/* Added-by filter */}
        {uniqueAddedBy.length > 1 && (
          <div className="flex flex-wrap gap-2 px-1">
            {uniqueAddedBy.map(name => (
              <button
                key={name}
                type="button"
                onClick={() =>
                  setActiveAddedByFilter(prev =>
                    prev.includes(name)
                      ? prev.filter(n => n !== name)
                      : [...prev, name]
                  )
                }
                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors border-0 ${
                  activeAddedByFilter.includes(name)
                    ? 'bg-sky-500 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {name}
              </button>
            ))}
            {activeAddedByFilter.length > 0 && (
              <button
                type="button"
                onClick={() => setActiveAddedByFilter([])}
                className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold bg-slate-100 text-slate-500 hover:bg-slate-200 border-0"
              >
                Nullstill
              </button>
            )}
          </div>
        )}

        {/* Tag filter */}
        {tagsInUse.length > 0 && (
          <div className="flex flex-wrap gap-2 px-1">
            {tagsInUse.map(tag => (
              <button
                key={tag.id}
                type="button"
                onClick={() =>
                  setActiveFilterTags(prev =>
                    prev.includes(tag.id)
                      ? prev.filter(id => id !== tag.id)
                      : [...prev, tag.id]
                  )
                }
                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors border-0 ${
                  activeFilterTags.includes(tag.id)
                    ? 'bg-sky-500 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {tag.name}
              </button>
            ))}
            {activeFilterTags.length > 0 && (
              <button
                type="button"
                onClick={() => setActiveFilterTags([])}
                className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold bg-slate-100 text-slate-500 hover:bg-slate-200 border-0"
              >
                Nullstill
              </button>
            )}
          </div>
        )}

        {isLoading ? (
          <div className="rounded-2xl bg-white p-6 text-slate-700 shadow-sm">Henter sanger…</div>
        ) : filteredSongs.length === 0 ? (
          <Card className="bg-slate-50 text-slate-600 text-sm">
            <CardContent>{songs.length === 0 ? 'Ingen sanger ennå.' : 'Ingen sanger matcher søket eller valgte filtre.'}</CardContent>
          </Card>
        ) : (
          <div className="divide-y divide-slate-100 rounded-2xl bg-white shadow-sm overflow-hidden">
            {filteredSongs.map((song) => (
              <div key={song.id} className="px-5 py-4">
                {confirmDeleteId === song.id ? (
                  <div className="flex flex-col gap-2">
                    <p className="text-sm text-slate-700">
                      Slette <strong>{song.artist ? `${song.artist} — ${song.title}` : song.title}</strong> permanent? Dette kan ikke angres.
                    </p>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setConfirmDeleteId(null)}
                        disabled={isDeleting}
                      >
                        Avbryt
                      </Button>
                      <Button
                        size="sm"
                        className="bg-red-500 hover:bg-red-600 text-white"
                        onClick={() => handleDelete(song.id)}
                        disabled={isDeleting}
                      >
                        {isDeleting ? 'Sletter…' : 'Slett permanent'}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-2 min-w-0">
                      <button
                        type="button"
                        onClick={() => handleToggleFavorite(song.id)}
                        className="flex-shrink-0 border-0 bg-transparent p-0 mt-0.5 transition-colors"
                        aria-label={favoriteSongIds.has(song.id) ? 'Fjern fra gruppefavoritter' : 'Legg til gruppefavoritter'}
                      >
                        <Heart className={`h-4 w-4 ${favoriteSongIds.has(song.id) ? 'fill-sky-500 text-sky-500' : 'text-slate-300 hover:text-sky-400'}`} />
                      </button>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-900 truncate">
                          {song.artist ? `${song.artist} — ${song.title}` : song.title}
                        </p>
                        {song.url && (
                          <a
                            href={song.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-slate-400 hover:text-sky-500 truncate block"
                          >
                            {song.url.length > 50 ? song.url.slice(0, 47) + '…' : song.url}
                          </a>
                        )}
                        {song.added_by && (
                          <span className="text-xs text-slate-400">Lagt til av {song.added_by}</span>
                        )}
                        {song.song_tags && song.song_tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {song.song_tags.map(st => st.tags && (
                              <span
                                key={st.tag_id}
                                className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold bg-slate-100 text-slate-600"
                              >
                                {st.tags.name}
                              </span>
                            ))}
                          </div>
                        )}
                        {(() => {
                          const stat = playStats.get(song.id);
                          if (!stat || stat.count === 0) return null;
                          const lastPlayed = stat.lastPlayedAt
                            ? new Date(stat.lastPlayedAt).toLocaleDateString('nb-NO', { day: '2-digit', month: '2-digit', year: 'numeric' })
                            : null;
                          return (
                            <p className="text-xs text-slate-400 mt-1">
                              Spilt {stat.count} {stat.count === 1 ? 'gang' : 'ganger'}{lastPlayed ? ` · Sist: ${lastPlayed}` : ''}
                            </p>
                          );
                        })()}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {user && (
                        <button
                          type="button"
                          onClick={() => handleToggleUserFavorite(song.id)}
                          className="border-0 bg-transparent p-1.5 transition-colors"
                          aria-label={userFavoriteSongIds.has(song.id) ? 'Fjern personlig favoritt' : 'Legg til personlig favoritt'}
                        >
                          <Star
                            className={`h-4 w-4 ${userFavoriteSongIds.has(song.id) ? 'fill-amber-400 text-amber-400' : 'text-slate-300 hover:text-amber-400'}`}
                          />
                        </button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleOpenEdit(song)}
                      >
                        Rediger
                      </Button>
                      {(isAdmin(groupId!) || (username && song.added_by === username)) && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setConfirmDeleteId(song.id)}
                        >
                          Slett
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <Sheet open={isAddingSong} onOpenChange={(open) => { if (!open) { setIsAddingSong(false); setNewTitle(''); setNewArtist(''); setNewUrl(''); setNewLyrics(''); setNewError(''); } }}>
        <SheetContent side="bottom" className="max-h-[85vh] data-[state=open]:flex data-[state=open]:flex-col">
          <SheetHeader className="flex-shrink-0">
            <SheetTitle>Ny sang</SheetTitle>
          </SheetHeader>
          <div className="flex flex-col gap-4 mt-4 overflow-y-auto">
            <div className="flex gap-2">
              <Button type="button" size="sm" variant={newInputMode === 'url' ? 'default' : 'outline'} onClick={() => setNewInputMode('url')} disabled={isCreatingSong}>URL</Button>
              <Button type="button" size="sm" variant={newInputMode === 'lyrics' ? 'default' : 'outline'} onClick={() => setNewInputMode('lyrics')} disabled={isCreatingSong}>Sangtekst</Button>
            </div>
            {newInputMode === 'url' && (
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-slate-700">URL</label>
                <Input placeholder="https://www.nortabs.net/..." value={newUrl} onChange={(e) => setNewUrl(e.target.value)} disabled={isCreatingSong} />
                <p className="text-xs text-slate-400">Sanger fra Nortabs hentes automatisk med tekst.</p>
              </div>
            )}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-slate-700">Tittel</label>
              <Input placeholder="Sangnavn" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} disabled={isCreatingSong} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-slate-700">Artist <span className="text-slate-400 font-normal">(valgfritt)</span></label>
              <Input placeholder="Artistnavn" value={newArtist} onChange={(e) => setNewArtist(e.target.value)} disabled={isCreatingSong} />
            </div>
            {newInputMode === 'lyrics' && (
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-slate-700">Sangtekst</label>
                <textarea
                  className="w-full min-w-0 rounded-xl border-0 bg-white shadow-sm px-3 py-2 text-base outline-none placeholder:text-slate-400 focus-visible:ring-2 focus-visible:ring-sky-500 md:text-sm"
                  rows={8}
                  placeholder="Lim inn sangteksten her..."
                  value={newLyrics}
                  onChange={(e) => setNewLyrics(e.target.value)}
                  disabled={isCreatingSong}
                />
              </div>
            )}
            {newError && <p className="text-sm text-red-600">{newError}</p>}
            <div className="flex gap-3 justify-end pt-2">
              <Button variant="outline" onClick={() => setIsAddingSong(false)} disabled={isCreatingSong}>Avbryt</Button>
              <Button onClick={handleCreateSong} disabled={isCreatingSong || !newTitle.trim() || (newInputMode === 'url' && !newUrl.trim())}>
                {isCreatingSong ? 'Lagrer…' : 'Lagre sang'}
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={!!editingSong} onOpenChange={(open) => { if (!open) setEditingSong(null); }}>
        <SheetContent
          side="bottom"
          className="max-h-[85vh] data-[state=open]:flex data-[state=open]:flex-col"
        >
          <SheetHeader className="flex-shrink-0">
            <SheetTitle>Rediger sang</SheetTitle>
          </SheetHeader>
          <div className="flex flex-col gap-4 mt-4 overflow-y-auto">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-slate-700">Tittel</label>
              <Input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                placeholder="Sangnavn"
                onFocus={(e) => setTimeout(() => e.target.scrollIntoView({ behavior: 'smooth', block: 'center' }), 300)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-slate-700">
                Artist <span className="text-slate-400 font-normal">(valgfritt)</span>
              </label>
              <Input
                value={editArtist}
                onChange={(e) => setEditArtist(e.target.value)}
                placeholder="Artistnavn"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-slate-700">
                URL <span className="text-slate-400 font-normal">(valgfritt)</span>
              </label>
              <div className="flex gap-2">
                <Input
                  value={editUrl}
                  onChange={(e) => setEditUrl(e.target.value)}
                  placeholder="https://..."
                />
                {editUrl.trim() && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleFetchContent}
                    disabled={isFetchingContent}
                    className="flex-shrink-0"
                  >
                    {isFetchingContent ? 'Henter…' : 'Hent tekst'}
                  </Button>
                )}
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-slate-700">
                Sangtekst <span className="text-slate-400 font-normal">(valgfritt)</span>
              </label>
              <textarea
                className="w-full min-w-0 rounded-xl border-0 bg-white shadow-sm px-3 py-2 text-base transition-colors outline-none placeholder:text-slate-400 focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-0 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
                rows={6}
                placeholder="Lim inn sangteksten her..."
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
              />
            </div>

            {/* Tag editor */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-slate-700">
                Tagger <span className="text-slate-400 font-normal">(valgfritt)</span>
              </label>
              {editTagNames.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {editTagNames.map(name => (
                    <span
                      key={name}
                      className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold bg-sky-100 text-sky-700"
                    >
                      {name}
                      <button
                        type="button"
                        onClick={() => handleRemoveTagFromEdit(name)}
                        className="border-0 bg-transparent p-0 leading-none text-sky-500 hover:text-sky-700"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={handleTagInputKeyDown}
                  placeholder="Legg til tagg…"
                />
                {tagSuggestions.length > 0 && (
                  <div className="absolute top-full left-0 right-0 z-10 mt-1 rounded-xl bg-white shadow-md overflow-hidden">
                    {tagSuggestions.map(tag => (
                      <button
                        key={tag.id}
                        type="button"
                        onMouseDown={(e) => { e.preventDefault(); handleAddTagToEdit(tag.name); }}
                        className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 border-0 bg-transparent"
                      >
                        {tag.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {tagInput.trim() && (
                <button
                  type="button"
                  onMouseDown={(e) => { e.preventDefault(); handleAddTagToEdit(tagInput); }}
                  className="flex-shrink-0 self-start inline-flex items-center rounded-full border-0 bg-slate-100 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200"
                >
                  +
                </button>
              )}
              </div>
            </div>

            <div className="flex gap-3 justify-end pt-2">
              <Button
                variant="outline"
                onClick={() => setEditingSong(null)}
                disabled={isSaving}
              >
                Avbryt
              </Button>
              <Button
                onClick={handleSaveSong}
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
