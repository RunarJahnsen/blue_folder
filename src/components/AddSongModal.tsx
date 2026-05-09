import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { useGuestSession } from '@/hooks/useGuestSession';
import type { Favorite, Song, SongWithTags, Tag, UserFavorite } from '@/lib/types';
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface AddSongModalProps {
  isOpen: boolean;
  onClose: () => void;
  groupId: string;
  folderId: string;
  folderMode: 'host_only' | 'suggest' | 'open';
  maxPosition: number;
  onSongAdded: () => void;
}

type Step = 'input' | 'url-match' | 'title-match';
type InputMode = 'url' | 'lyrics';
type FavoriteWithSong = Favorite & { songs: SongWithTags };

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

export function AddSongModal({
  isOpen,
  onClose,
  groupId,
  folderId,
  folderMode,
  maxPosition,
  onSongAdded,
}: AddSongModalProps) {
  const { memberships, user } = useAuth();
  const { guestCode } = useGuestSession();
  const addedBy = memberships.find(m => m.group_id === groupId)?.username ?? guestCode ?? null;
  const [activeTab, setActiveTab] = useState<'mine' | 'url' | 'favorites' | 'all'>(user ? 'mine' : 'favorites');
  const [isFetchingUserFavs, setIsFetchingUserFavs] = useState(false);
  const [userFavsSearch, setUserFavsSearch] = useState('');
  const [mineSongs, setMineSongs] = useState<SongWithTags[]>([]);
  const [groupFavorites, setGroupFavorites] = useState<FavoriteWithSong[]>([]);
  const [isFetchingFavorites, setIsFetchingFavorites] = useState(false);
  const [favoritesSearch, setFavoritesSearch] = useState('');
  const [activeFavFilterTags, setActiveFavFilterTags] = useState<string[]>([]);
  const [activeMineFilterTags, setActiveMineFilterTags] = useState<string[]>([]);
  const [urlTagNames, setUrlTagNames] = useState<string[]>([]);
  const [urlTagInput, setUrlTagInput] = useState('');
  const [urlTabTags, setUrlTabTags] = useState<Tag[]>([]);
  const [urlTabArtists, setUrlTabArtists] = useState<string[]>([]);

  const [allSongs, setAllSongs] = useState<SongWithTags[]>([]);
  const [isFetchingAllSongs, setIsFetchingAllSongs] = useState(false);
  const [allSongsSearch, setAllSongsSearch] = useState('');
  const [allModalTags, setAllModalTags] = useState<Tag[]>([]);
  const [activeModalFilterTags, setActiveModalFilterTags] = useState<string[]>([]);

  const [selectedSongIds, setSelectedSongIds] = useState<Set<string>>(new Set());

  const toggleSong = (songId: string) => {
    setSelectedSongIds(prev => {
      const next = new Set(prev);
      if (next.has(songId)) next.delete(songId); else next.add(songId);
      return next;
    });
  };

  const [inputMode, setInputMode] = useState<InputMode>('url');
  const [step, setStep] = useState<Step>('input');
  const [url, setUrl] = useState('');
  const [artist, setArtist] = useState('');
  const [title, setTitle] = useState('');
  const [lyrics, setLyrics] = useState('');
  const [existingSong, setExistingSong] = useState<Song | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [showFetchWarning, setShowFetchWarning] = useState(false);
  const [warningSongId, setWarningSongId] = useState<string | null>(null);
  const [manualContent, setManualContent] = useState('');
  const [isSavingManual, setIsSavingManual] = useState(false);
  const [isAutoFilling, setIsAutoFilling] = useState(false);
  const [autoFillHint, setAutoFillHint] = useState('');
  const [songNumber, setSongNumber] = useState('');

  useEffect(() => {
    if (activeTab !== 'mine' || !groupId || !user) return;
    setIsFetchingUserFavs(true);
    (async () => {
      const headers = await pgHeaders();
      const res = await fetch(
        `${BASE()}/rest/v1/user_favorites?group_id=eq.${groupId}&select=id,song_id,songs(id,title,artist,url,content,song_number,added_by,song_tags(id,tag_id,tags(id,name)))`,
        { headers }
      );
      const data = await res.json();
      if (Array.isArray(data)) {
        setMineSongs(
          (data as unknown as Array<UserFavorite & { songs: SongWithTags }>)
            .map((r) => r.songs)
            .filter(Boolean)
            .sort((a, b) => a.title.localeCompare(b.title))
        );
      }
      setIsFetchingUserFavs(false);
    })();
  }, [activeTab, groupId, user]);

  useEffect(() => {
    if (activeTab !== 'favorites' || !groupId) return;
    setIsFetchingFavorites(true);
    (async () => {
      const headers = await pgHeaders();
      const res = await fetch(
        `${BASE()}/rest/v1/favorites?group_id=eq.${groupId}&select=id,song_id,group_id,created_at,songs(id,title,artist,url,content,song_number,added_by,song_tags(id,tag_id,tags(id,name)))`,
        { headers }
      );
      const data = await res.json();
      if (Array.isArray(data)) setGroupFavorites(data as unknown as FavoriteWithSong[]);
      setIsFetchingFavorites(false);
    })();
  }, [activeTab, groupId]);

  useEffect(() => {
    if (activeTab !== 'all' || !groupId) return;
    setIsFetchingAllSongs(true);
    (async () => {
      const headers = await pgHeaders();
      const base = BASE();
      const [songsRes, tagsRes] = await Promise.all([
        fetch(`${base}/rest/v1/songs?group_id=eq.${groupId}&select=*,song_tags(id,tag_id,tags(id,name))&order=title.asc`, { headers }),
        fetch(`${base}/rest/v1/tags?group_id=eq.${groupId}&select=id,group_id,name,created_at&order=name.asc`, { headers }),
      ]);
      const [songsData, tagsData] = await Promise.all([songsRes.json(), tagsRes.json()]);
      if (Array.isArray(songsData)) setAllSongs(songsData as unknown as SongWithTags[]);
      if (Array.isArray(tagsData)) setAllModalTags(tagsData as Tag[]);
      setIsFetchingAllSongs(false);
    })();
  }, [activeTab, groupId]);

  useEffect(() => {
    if (activeTab !== 'url' || !groupId) return;
    (async () => {
      const headers = await pgHeaders();
      const [tagsRes, artistsRes] = await Promise.all([
        fetch(`${BASE()}/rest/v1/tags?group_id=eq.${groupId}&select=id,group_id,name,created_at&order=name.asc`, { headers }),
        fetch(`${BASE()}/rest/v1/songs?group_id=eq.${groupId}&select=artist&artist=not.is.null`, { headers }),
      ]);
      const [tagsData, artistsData] = await Promise.all([tagsRes.json(), artistsRes.json()]);
      if (Array.isArray(tagsData)) setUrlTabTags(tagsData as Tag[]);
      if (Array.isArray(artistsData)) {
        const unique = Array.from(new Set(
          (artistsData as { artist: string | null }[]).map(r => r.artist).filter(Boolean) as string[]
        )).sort((a, b) => a.localeCompare(b, 'nb'));
        setUrlTabArtists(unique);
      }
    })();
  }, [activeTab, groupId]);

  const saveTagsForSong = async (songId: string, tagNames: string[]) => {
    const headers = await pgHeaders();
    for (const name of tagNames) {
      const fetchRes = await fetch(
        `${BASE()}/rest/v1/tags?group_id=eq.${groupId}&name=eq.${encodeURIComponent(name)}&select=id,group_id,name,created_at&limit=1`,
        { headers }
      );
      let tagId: string | null = null;
      if (fetchRes.ok) {
        const data = await fetchRes.json();
        if (Array.isArray(data) && data.length > 0) tagId = (data[0] as Tag).id;
      }
      if (!tagId) {
        const createRes = await fetch(`${BASE()}/rest/v1/tags`, {
          method: 'POST',
          headers: { ...headers, Prefer: 'return=representation' },
          body: JSON.stringify({ group_id: groupId, name }),
        });
        if (createRes.ok) {
          const raw = await createRes.json();
          tagId = Array.isArray(raw) && raw[0] ? (raw[0] as Tag).id : null;
        }
      }
      if (tagId) {
        await fetch(`${BASE()}/rest/v1/song_tags`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ song_id: songId, tag_id: tagId, group_id: groupId }),
        });
      }
    }
  };

  const handleAddTagToUrl = (name: string) => {
    const normalized = name.trim().toLowerCase();
    if (!normalized || urlTagNames.includes(normalized)) { setUrlTagInput(''); return; }
    setUrlTagNames(prev => [...prev, normalized]);
    setUrlTagInput('');
  };

  const handleRemoveTagFromUrl = (name: string) => {
    setUrlTagNames(prev => prev.filter(t => t !== name));
  };

  const handleUrlTagInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const q = urlTagInput.trim().toLowerCase();
      if (!q) return;
      const exact = urlTagSuggestions.find(t => t.name === q);
      handleAddTagToUrl(exact ? exact.name : q);
    }
  };

  const validateUrl = (u: string) => {
    return u.startsWith('http://') || u.startsWith('https://');
  };

  const truncateUrl = (u: string, maxLength: number = 50) => {
    return u.length > maxLength ? u.slice(0, 47) + '...' : u;
  };

  const handleCheckUrl = async () => {
    if (!url.trim() || !title.trim()) {
      setError('Både URL og tittel er påkrevd.');
      return;
    }
    if (!validateUrl(url)) {
      setError('URL må starte med http:// eller https://');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const headers = await pgHeaders();
      const base = BASE();

      const urlRes = await fetch(
        `${base}/rest/v1/songs?group_id=eq.${groupId}&url=eq.${encodeURIComponent(url)}&select=*&limit=1`,
        { headers }
      );
      const urlData = await urlRes.json();
      const byUrl = Array.isArray(urlData) ? (urlData[0] as Song | undefined) : undefined;

      if (byUrl) {
        setExistingSong(byUrl);
        setStep('url-match');
      } else {
        const titleRes = await fetch(
          `${base}/rest/v1/songs?group_id=eq.${groupId}&title=ilike.${encodeURIComponent(title)}&select=*&limit=1`,
          { headers }
        );
        const titleData = await titleRes.json();
        const byTitle = Array.isArray(titleData) ? (titleData[0] as Song | undefined) : undefined;

        if (byTitle) {
          setExistingSong(byTitle);
          setStep('title-match');
        } else {
          await createNewSongAndEntry();
        }
      }
    } catch {
      await createNewSongAndEntry();
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddLyrics = async () => {
    if (!title.trim() || !lyrics.trim()) {
      setError('Både tittel og sangtekst er påkrevd.');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const headers = await pgHeaders();
      const res = await fetch(`${BASE()}/rest/v1/songs`, {
        method: 'POST',
        headers: { ...headers, Prefer: 'return=representation' },
        body: JSON.stringify({
          group_id: groupId,
          title,
          url: '',
          content: lyrics,
          ...(artist.trim() ? { artist: artist.trim() } : {}),
          ...(songNumber.trim() ? { song_number: songNumber.trim() } : {}),
          ...(addedBy ? { added_by: addedBy } : {}),
        }),
      });
      if (!res.ok) { setError('Kunne ikke opprett sang.'); return; }
      const raw = await res.json();
      const newSong = Array.isArray(raw) ? (raw[0] as Song) : null;
      if (!newSong) { setError('Kunne ikke opprett sang.'); return; }
      if (urlTagNames.length > 0) await saveTagsForSong(newSong.id, urlTagNames);
      await createFolderSongEntry(newSong.id);
    } catch {
      setError('En feil oppstod.');
    } finally {
      setIsLoading(false);
    }
  };

  const createNewSongAndEntry = async () => {
    try {
      const headers = await pgHeaders();
      const songRes = await fetch(`${BASE()}/rest/v1/songs`, {
        method: 'POST',
        headers: { ...headers, Prefer: 'return=representation' },
        body: JSON.stringify({
          group_id: groupId,
          title,
          url,
          ...(artist.trim() ? { artist: artist.trim() } : {}),
          ...(songNumber.trim() ? { song_number: songNumber.trim() } : {}),
          ...(addedBy ? { added_by: addedBy } : {}),
        }),
      });
      if (!songRes.ok) { setError('Kunne ikke opprett sang.'); return; }
      const raw = await songRes.json();
      const newSong = Array.isArray(raw) ? (raw[0] as Song) : null;
      if (!newSong) { setError('Kunne ikke opprett sang.'); return; }

      let contentFetched = false;
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token ?? import.meta.env.VITE_SUPABASE_ANON_KEY;
        const res = await supabase.functions.invoke('fetch-song-content', {
          body: { url: newSong.url, song_id: newSong.id },
          headers: {
            apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
            Authorization: `Bearer ${token}`,
          },
        });
        contentFetched = !!(res.data?.content);
      } catch {}

      if (urlTagNames.length > 0) await saveTagsForSong(newSong.id, urlTagNames);
      await createFolderSongEntry(newSong.id, contentFetched);
      if (!contentFetched) {
        setWarningSongId(newSong.id);
        setShowFetchWarning(true);
      }
    } catch {
      setError('En feil oppstod.');
    }
  };

  const createFolderSongEntry = async (songId: string, closeAfter = true) => {
    try {
      const state = folderMode === 'suggest' ? 'suggested' : 'queued';
      const position = folderMode === 'suggest' ? undefined : maxPosition + 1;

      const headers = await pgHeaders();
      const res = await fetch(`${BASE()}/rest/v1/folder_song_entries`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          group_id: groupId,
          folder_id: folderId,
          song_id: songId,
          state,
          ...(position !== undefined ? { position } : {}),
        }),
      });

      if (!res.ok) {
        setError('Kunne ikke legge til sang i permen.');
        return;
      }

      onSongAdded();
      if (closeAfter) handleClose();
    } catch {
      setError('En feil oppstod.');
    }
  };

  const handleUseExisting = async () => {
    if (!existingSong) return;
    setIsLoading(true);
    await createFolderSongEntry(existingSong.id);
    setIsLoading(false);
  };

  const handleAddNew = async () => {
    setIsLoading(true);
    await createNewSongAndEntry();
    setIsLoading(false);
  };

  const handleSaveManualContent = async () => {
    if (!warningSongId || !manualContent.trim()) return;
    setIsSavingManual(true);
    const headers = await pgHeaders();
    await fetch(`${BASE()}/rest/v1/songs?id=eq.${warningSongId}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ content: manualContent.trim() }),
    });
    setIsSavingManual(false);
    handleClose();
  };

  const handleAddSelected = async () => {
    const ids = Array.from(selectedSongIds);
    if (ids.length === 0) return;
    setIsLoading(true);
    const state = folderMode === 'suggest' ? 'suggested' : 'queued';
    const headers = await pgHeaders();
    const entries = ids.map((songId, i) => ({
      group_id: groupId,
      folder_id: folderId,
      song_id: songId,
      state,
      ...(folderMode !== 'suggest' ? { position: maxPosition + 1 + i } : {}),
    }));
    const res = await fetch(`${BASE()}/rest/v1/folder_song_entries`, {
      method: 'POST',
      headers,
      body: JSON.stringify(entries),
    });
    setIsLoading(false);
    if (!res.ok) {
      setError('Kunne ikke legge til sanger i permen.');
      return;
    }
    onSongAdded();
    handleClose();
  };

  const handleClose = () => {
    setShowFetchWarning(false);
    setWarningSongId(null);
    setManualContent('');
    setIsSavingManual(false);
    setSelectedSongIds(new Set());
    setActiveTab(user ? 'mine' : 'favorites');
    setMineSongs([]);
    setUserFavsSearch('');
    setIsFetchingUserFavs(false);
    setGroupFavorites([]);
    setFavoritesSearch('');
    setActiveFavFilterTags([]);
    setActiveMineFilterTags([]);
    setUrlTagNames([]);
    setUrlTagInput('');
    setUrlTabArtists([]);
    setAllSongs([]);
    setAllSongsSearch('');
    setIsFetchingAllSongs(false);
    setAllModalTags([]);
    setActiveModalFilterTags([]);
    setInputMode('url');
    setStep('input');
    setUrl('');
    setArtist('');
    setTitle('');
    setLyrics('');
    setSongNumber('');
    setExistingSong(null);
    setError('');
    setAutoFillHint('');
    setIsAutoFilling(false);
    onClose();
  };

  const handleUrlBlur = async () => {
    if (!url.trim() || isLoading) return;
    setIsAutoFilling(true);
    setAutoFillHint('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token ?? import.meta.env.VITE_SUPABASE_ANON_KEY;
      const result = await supabase.functions.invoke('fetch-song-content', {
        body: { url: url.trim() },
        headers: {
          apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
          Authorization: `Bearer ${token}`,
        },
      });
      const meta = result.data as { title?: string | null; artist?: string | null } | null;
      if (meta?.title) {
        if (!title.trim()) setTitle(meta.title);
      }
      if (meta?.artist) {
        if (!artist.trim()) setArtist(meta.artist);
      }
      if (!meta?.title && !meta?.artist) {
        setAutoFillHint('Fyll inn tittel og artist manuelt');
      }
    } catch {
      setAutoFillHint('Fyll inn tittel og artist manuelt');
    }
    setIsAutoFilling(false);
  };

  const filteredMineSongs = (() => {
    const q = userFavsSearch.trim().toLowerCase();
    let result = mineSongs;
    if (q) {
      result = result.filter((s) => {
        const t = s.title?.toLowerCase() ?? '';
        const a = s.artist?.toLowerCase() ?? '';
        const c = s.content?.toLowerCase() ?? '';
        const n = s.song_number?.toLowerCase() ?? '';
        return t.includes(q) || a.includes(q) || c.includes(q) || n.includes(q);
      });
    }
    if (activeMineFilterTags.length > 0) {
      result = result.filter(s =>
        activeMineFilterTags.some(tagId => s.song_tags?.some(st => st.tag_id === tagId))
      );
    }
    return result;
  })();

  const filteredAllSongs = (() => {
    const q = allSongsSearch.trim().toLowerCase();
    let result = allSongs;
    if (q) {
      result = result.filter((s) => {
        const t = s.title?.toLowerCase() ?? '';
        const a = s.artist?.toLowerCase() ?? '';
        const c = s.content?.toLowerCase() ?? '';
        const ab = s.added_by?.toLowerCase() ?? '';
        const n = s.song_number?.toLowerCase() ?? '';
        return t.includes(q) || a.includes(q) || c.includes(q) || ab.includes(q) || n.includes(q);
      });
    }
    if (activeModalFilterTags.length > 0) {
      result = result.filter(s =>
        activeModalFilterTags.some(tagId =>
          (s as SongWithTags).song_tags?.some(st => st.tag_id === tagId)
        )
      );
    }
    return result;
  })();

  const favTags = (() => {
    const tagMap = new Map<string, { id: string; name: string }>();
    groupFavorites.forEach(fav => {
      fav.songs?.song_tags?.forEach(st => {
        if (st.tags) tagMap.set(st.tags.id, st.tags);
      });
    });
    return Array.from(tagMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  })();

  const filteredFavorites = (() => {
    const q = favoritesSearch.trim().toLowerCase();
    let result = groupFavorites;
    if (q) {
      result = result.filter((fav) => {
        const t = fav.songs?.title?.toLowerCase() ?? '';
        const a = fav.songs?.artist?.toLowerCase() ?? '';
        const c = fav.songs?.content?.toLowerCase() ?? '';
        const ab = (fav.songs as unknown as { added_by?: string })?.added_by?.toLowerCase() ?? '';
        const n = fav.songs?.song_number?.toLowerCase() ?? '';
        return t.includes(q) || a.includes(q) || c.includes(q) || ab.includes(q) || n.includes(q);
      });
    }
    if (activeFavFilterTags.length > 0) {
      result = result.filter(fav =>
        activeFavFilterTags.some(tagId =>
          fav.songs?.song_tags?.some(st => st.tag_id === tagId)
        )
      );
    }
    return result;
  })();

  const urlTagSuggestions = (() => {
    const q = urlTagInput.trim().toLowerCase();
    if (!q) return [];
    return urlTabTags.filter(t => t.name.includes(q) && !urlTagNames.includes(t.name)).slice(0, 5);
  })();

  const artistSuggestions = (() => {
    const q = artist.trim().toLowerCase();
    if (!q) return [];
    return urlTabArtists.filter(a => a.toLowerCase().includes(q) && a.toLowerCase() !== q).slice(0, 5);
  })();

  const mineTags = (() => {
    const tagMap = new Map<string, { id: string; name: string }>();
    mineSongs.forEach(song => {
      song.song_tags?.forEach(st => { if (st.tags) tagMap.set(st.tags.id, st.tags); });
    });
    return Array.from(tagMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  })();

  const handleOpenChange = (open: boolean) => {
    if (!open) handleClose();
  };

  return (
    <Sheet open={isOpen} onOpenChange={handleOpenChange}>
      <SheetContent side="bottom" className="!h-[100dvh]" showCloseButton={false}>
        <div className="flex items-center justify-between pt-4 pb-1">
          <SheetTitle>Legg til sang</SheetTitle>
          <SheetClose className="rounded-full p-1.5 border-0 bg-transparent text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors">
            <X className="h-5 w-5" />
            <span className="sr-only">Lukk</span>
          </SheetClose>
        </div>

        {showFetchWarning ? (
          <div className="mt-4 space-y-4">
            <div className="rounded-xl bg-amber-50 p-4 text-sm text-amber-800">
              Kunne ikke hente sangtekst automatisk. Du kan legge inn teksten manuelt eller prøve igjen fra sangoversikten.
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-slate-700">Sangtekst <span className="text-slate-400 font-normal">(valgfritt)</span></label>
              <textarea
                className="w-full min-w-0 rounded-xl border-0 bg-white shadow-sm px-3 py-2 text-base transition-colors outline-none placeholder:text-slate-400 focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-0 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
                rows={8}
                placeholder="Lim inn sangteksten her..."
                value={manualContent}
                onChange={(e) => setManualContent(e.target.value)}
                disabled={isSavingManual}
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={handleClose} disabled={isSavingManual}>
                Lukk
              </Button>
              <Button
                onClick={handleSaveManualContent}
                disabled={isSavingManual || !manualContent.trim()}
              >
                {isSavingManual ? 'Lagrer…' : 'Lagre tekst'}
              </Button>
            </div>
          </div>
        ) : (
        <>
        {/* Tab toggle */}
        <div className="flex gap-1.5 flex-wrap">
          {user && (
            <Button
              type="button"
              size="sm"
              variant={activeTab === 'mine' ? 'default' : 'outline'}
              onClick={() => { setActiveTab('mine'); setError(''); }}
            >
              Mine favoritter
            </Button>
          )}
          <Button
            type="button"
            size="sm"
            variant={activeTab === 'favorites' ? 'default' : 'outline'}
            onClick={() => { setActiveTab('favorites'); setError(''); }}
          >
            Felles favoritter
          </Button>
          <Button
            type="button"
            size="sm"
            variant={activeTab === 'all' ? 'default' : 'outline'}
            onClick={() => { setActiveTab('all'); setError(''); }}
          >
            Alle sanger
          </Button>
          <Button
            type="button"
            size="sm"
            variant={activeTab === 'url' ? 'default' : 'outline'}
            onClick={() => { setActiveTab('url'); setError(''); }}
          >
            Legg til URL
          </Button>
        </div>

        {/* URL tab */}
        {activeTab === 'url' && (
          <>
            {step === 'input' ? (
              <div className="space-y-3">
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={inputMode === 'url' ? 'default' : 'outline'}
                    onClick={() => { setInputMode('url'); setError(''); }}
                    disabled={isLoading}
                  >
                    URL
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={inputMode === 'lyrics' ? 'default' : 'outline'}
                    onClick={() => { setInputMode('lyrics'); setError(''); }}
                    disabled={isLoading}
                  >
                    Sangtekst
                  </Button>
                </div>

                {inputMode === 'url' && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">URL</label>
                    <Input
                      type="text"
                      placeholder="https://www.nortabs.net/..."
                      value={url}
                      onChange={(e) => { setUrl(e.target.value); setAutoFillHint(''); }}
                      onBlur={handleUrlBlur}
                      disabled={isLoading || isAutoFilling}
                    />
                    <p className="text-xs text-slate-400 mt-1">
                      {isAutoFilling
                        ? 'Henter info…'
                        : autoFillHint || 'Sanger fra Nortabs hentes automatisk med tekst.'}
                    </p>
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Tittel</label>
                  <Input
                    type="text"
                    placeholder="Sangnavn"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    disabled={isLoading}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Artist <span className="text-slate-400 font-normal">(valgfritt)</span></label>
                  <div className="relative">
                    <Input
                      type="text"
                      placeholder="Artistnavn"
                      value={artist}
                      onChange={(e) => setArtist(e.target.value)}
                      disabled={isLoading}
                    />
                    {artistSuggestions.length > 0 && (
                      <div className="absolute top-full left-0 right-0 z-10 mt-1 rounded-xl bg-white shadow-md overflow-hidden">
                        {artistSuggestions.map(a => (
                          <button
                            key={a}
                            type="button"
                            onMouseDown={(e) => { e.preventDefault(); setArtist(a); }}
                            className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 border-0 bg-transparent"
                          >
                            {a}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Sangnummer <span className="text-slate-400 font-normal">(valgfritt)</span></label>
                  <Input
                    type="text"
                    placeholder="f.eks. 42"
                    value={songNumber}
                    onChange={(e) => setSongNumber(e.target.value)}
                    disabled={isLoading}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Tagger <span className="text-slate-400 font-normal">(valgfritt)</span>
                  </label>
                  {urlTagNames.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {urlTagNames.map(name => (
                        <span key={name} className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold bg-sky-100 text-sky-700">
                          {name}
                          <button type="button" onClick={() => handleRemoveTagFromUrl(name)} className="border-0 bg-transparent p-0 leading-none text-sky-500 hover:text-sky-700">
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Input
                        value={urlTagInput}
                        onChange={(e) => setUrlTagInput(e.target.value)}
                        onKeyDown={handleUrlTagInputKeyDown}
                        placeholder="Legg til tagg…"
                        disabled={isLoading}
                      />
                      {urlTagSuggestions.length > 0 && (
                        <div className="absolute top-full left-0 right-0 z-10 mt-1 rounded-xl bg-white shadow-md overflow-hidden">
                          {urlTagSuggestions.map(tag => (
                            <button
                              key={tag.id}
                              type="button"
                              onMouseDown={(e) => { e.preventDefault(); handleAddTagToUrl(tag.name); }}
                              className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 border-0 bg-transparent"
                            >
                              {tag.name}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    {urlTagInput.trim() && (
                      <button
                        type="button"
                        onMouseDown={(e) => { e.preventDefault(); handleAddTagToUrl(urlTagInput); }}
                        className="flex-shrink-0 self-start inline-flex items-center rounded-full border-0 bg-slate-100 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200"
                      >
                        +
                      </button>
                    )}
                  </div>
                </div>
                {inputMode === 'lyrics' && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Sangtekst</label>
                    <textarea
                      className="w-full min-w-0 rounded-xl border-0 bg-white shadow-sm px-3 py-2 text-base transition-colors outline-none placeholder:text-slate-400 focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-0 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
                      rows={10}
                      placeholder="Lim inn sangteksten her..."
                      value={lyrics}
                      onChange={(e) => setLyrics(e.target.value)}
                      disabled={isLoading}
                    />
                  </div>
                )}
                {error && <div className="text-sm text-red-600">{error}</div>}
                <div className="flex gap-2 justify-end pt-4">
                  <Button variant="outline" onClick={handleClose} disabled={isLoading}>
                    Avbryt
                  </Button>
                  <Button
                    onClick={inputMode === 'lyrics' ? handleAddLyrics : handleCheckUrl}
                    disabled={isLoading}
                  >
                    {isLoading ? 'Legger til...' : 'Legg til'}
                  </Button>
                </div>
              </div>
            ) : step === 'url-match' ? (
              <div className="space-y-3">
                <div className="p-3 bg-blue-50 rounded-lg text-sm text-blue-900">
                  Denne URL finnes allerede som <strong>{existingSong?.title}</strong>
                </div>
                {error && <div className="text-sm text-red-600">{error}</div>}
                <div className="flex gap-2 justify-end pt-4">
                  <Button variant="outline" onClick={() => setStep('input')} disabled={isLoading}>
                    Avbryt
                  </Button>
                  <Button variant="outline" onClick={handleAddNew} disabled={isLoading}>
                    Legg til ny
                  </Button>
                  <Button onClick={handleUseExisting} disabled={isLoading}>
                    Bruk denne
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="p-3 bg-blue-50 rounded-lg text-sm text-blue-900">
                  Vi fant en sang med samme tittel: <strong>{existingSong?.title}</strong> ({truncateUrl(existingSong?.url || '')})
                </div>
                {error && <div className="text-sm text-red-600">{error}</div>}
                <div className="flex gap-2 justify-end pt-4">
                  <Button variant="outline" onClick={() => setStep('input')} disabled={isLoading}>
                    Avbryt
                  </Button>
                  <Button variant="outline" onClick={handleAddNew} disabled={isLoading}>
                    Legg til ny
                  </Button>
                  <Button onClick={handleUseExisting} disabled={isLoading}>
                    Bruk denne
                  </Button>
                </div>
              </div>
            )}
          </>
        )}

        {/* Mine tab */}
        {activeTab === 'mine' && (
          <div className="space-y-2">
            <Input
              type="text"
              placeholder="Søk på artist, tittel eller tekst…"
              value={userFavsSearch}
              onChange={(e) => setUserFavsSearch(e.target.value)}
              disabled={isFetchingUserFavs}
            />
            {mineTags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {mineTags.map(tag => (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() =>
                      setActiveMineFilterTags(prev =>
                        prev.includes(tag.id) ? prev.filter(id => id !== tag.id) : [...prev, tag.id]
                      )
                    }
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors border-0 ${
                      activeMineFilterTags.includes(tag.id)
                        ? 'bg-sky-500 text-white'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {tag.name}
                  </button>
                ))}
              </div>
            )}
            {isFetchingUserFavs ? (
              <p className="text-sm text-slate-500">Henter favoritter…</p>
            ) : mineSongs.length === 0 ? (
              <p className="text-sm text-slate-500">Du har ingen personlige favoritter ennå. Stjernemerk sanger i sangoversikten for å finne dem her.</p>
            ) : filteredMineSongs.length === 0 ? (
              <p className="text-sm text-slate-500">Ingen treff.</p>
            ) : (
              <>
              <div className="divide-y divide-slate-100">
                {filteredMineSongs.map((song) => (
                  <div key={song.id} className="flex items-center gap-2 py-1.5">
                    <input
                      type="checkbox"
                      checked={selectedSongIds.has(song.id)}
                      onChange={() => toggleSong(song.id)}
                      className="h-4 w-4 flex-shrink-0 cursor-pointer accent-sky-500"
                    />
                    <button
                      type="button"
                      onClick={() => createFolderSongEntry(song.id)}
                      className="flex-1 min-w-0 text-left border-0 bg-transparent p-0 hover:opacity-70 transition-opacity"
                    >
                      <div className="flex items-baseline gap-1.5">
                        {song.song_number && (
                          <span className="flex-shrink-0 text-xs text-slate-400 font-medium">#{song.song_number}</span>
                        )}
                        <p className="text-sm font-medium text-slate-900 truncate">
                          {song.artist ? `${song.artist} — ${song.title}` : song.title}
                        </p>
                      </div>
                      {(song as SongWithTags).song_tags && (song as SongWithTags).song_tags!.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-0.5">
                          {(song as SongWithTags).song_tags!.map(st => st.tags && (
                            <span key={st.tag_id} className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold bg-slate-100 text-slate-600">
                              {st.tags.name}
                            </span>
                          ))}
                        </div>
                      )}
                    </button>
                  </div>
                ))}
              </div>
              {selectedSongIds.size > 0 && (
                <Button className="w-full" onClick={handleAddSelected} disabled={isLoading}>
                  {isLoading ? 'Legger til…' : `Legg til ${selectedSongIds.size} ${selectedSongIds.size === 1 ? 'sang' : 'sanger'}`}
                </Button>
              )}
              </>
            )}
            {error && <div className="text-sm text-red-600">{error}</div>}
          </div>
        )}

        {/* Favorites tab */}
        {activeTab === 'favorites' && (
          <div className="space-y-2">
            <Input
              type="text"
              placeholder="Søk på artist, tittel eller tekst…"
              value={favoritesSearch}
              onChange={(e) => setFavoritesSearch(e.target.value)}
              disabled={isFetchingFavorites}
            />
            {favTags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {favTags.map(tag => (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() =>
                      setActiveFavFilterTags(prev =>
                        prev.includes(tag.id)
                          ? prev.filter(id => id !== tag.id)
                          : [...prev, tag.id]
                      )
                    }
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors border-0 ${
                      activeFavFilterTags.includes(tag.id)
                        ? 'bg-sky-500 text-white'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {tag.name}
                  </button>
                ))}
              </div>
            )}
            {isFetchingFavorites ? (
              <p className="text-sm text-slate-500">Henter favoritter…</p>
            ) : groupFavorites.length === 0 ? (
              <p className="text-sm text-slate-500">Ingen favoritter ennå.</p>
            ) : filteredFavorites.length === 0 ? (
              <p className="text-sm text-slate-500">Ingen treff.</p>
            ) : (
              <>
              <div className="divide-y divide-slate-100">
                {filteredFavorites.map((fav) => (
                  <div key={fav.id} className="flex items-center gap-2 py-1.5">
                    <input
                      type="checkbox"
                      checked={selectedSongIds.has(fav.songs.id)}
                      onChange={() => toggleSong(fav.songs.id)}
                      className="h-4 w-4 flex-shrink-0 cursor-pointer accent-sky-500"
                    />
                    <button
                      type="button"
                      onClick={() => createFolderSongEntry(fav.songs.id)}
                      className="flex-1 min-w-0 text-left border-0 bg-transparent p-0 hover:opacity-70 transition-opacity"
                    >
                      <div className="flex items-baseline gap-1.5">
                        {fav.songs.song_number && (
                          <span className="flex-shrink-0 text-xs text-slate-400 font-medium">#{fav.songs.song_number}</span>
                        )}
                        <p className="text-sm font-medium text-slate-900 truncate">
                          {fav.songs.artist ? `${fav.songs.artist} — ${fav.songs.title}` : fav.songs.title}
                        </p>
                      </div>
                      {fav.songs.song_tags && fav.songs.song_tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-0.5">
                          {fav.songs.song_tags.map(st => st.tags && (
                            <span key={st.tag_id} className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold bg-slate-100 text-slate-600">
                              {st.tags.name}
                            </span>
                          ))}
                        </div>
                      )}
                    </button>
                  </div>
                ))}
              </div>
              {selectedSongIds.size > 0 && (
                <Button className="w-full" onClick={handleAddSelected} disabled={isLoading}>
                  {isLoading ? 'Legger til…' : `Legg til ${selectedSongIds.size} ${selectedSongIds.size === 1 ? 'sang' : 'sanger'}`}
                </Button>
              )}
              </>
            )}
            {error && <div className="text-sm text-red-600">{error}</div>}
          </div>
        )}

        {/* All songs tab */}
        {activeTab === 'all' && (
          <div className="space-y-2">
            <Input
              type="text"
              placeholder="Søk på artist, tittel eller tekst…"
              value={allSongsSearch}
              onChange={(e) => setAllSongsSearch(e.target.value)}
              disabled={isFetchingAllSongs}
            />
            {allModalTags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {allModalTags.map(tag => (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() =>
                      setActiveModalFilterTags(prev =>
                        prev.includes(tag.id)
                          ? prev.filter(id => id !== tag.id)
                          : [...prev, tag.id]
                      )
                    }
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors border-0 ${
                      activeModalFilterTags.includes(tag.id)
                        ? 'bg-sky-500 text-white'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {tag.name}
                  </button>
                ))}
              </div>
            )}
            {isFetchingAllSongs ? (
              <p className="text-sm text-slate-500">Henter sanger…</p>
            ) : allSongs.length === 0 ? (
              <p className="text-sm text-slate-500">Ingen sanger i biblioteket ennå.</p>
            ) : filteredAllSongs.length === 0 ? (
              <p className="text-sm text-slate-500">Ingen treff.</p>
            ) : (
              <>
              <div className="divide-y divide-slate-100">
                {filteredAllSongs.map((song) => (
                  <div key={song.id} className="flex items-center gap-2 py-1.5">
                    <input
                      type="checkbox"
                      checked={selectedSongIds.has(song.id)}
                      onChange={() => toggleSong(song.id)}
                      className="h-4 w-4 flex-shrink-0 cursor-pointer accent-sky-500"
                    />
                    <button
                      type="button"
                      onClick={() => createFolderSongEntry(song.id)}
                      className="flex-1 min-w-0 text-left border-0 bg-transparent p-0 hover:opacity-70 transition-opacity"
                    >
                      <div className="flex items-baseline gap-1.5">
                        {song.song_number && (
                          <span className="flex-shrink-0 text-xs text-slate-400 font-medium">#{song.song_number}</span>
                        )}
                        <p className="text-sm font-medium text-slate-900 truncate">
                          {song.artist ? `${song.artist} — ${song.title}` : song.title}
                        </p>
                      </div>
                      {(song as SongWithTags).song_tags && (song as SongWithTags).song_tags!.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-0.5">
                          {(song as SongWithTags).song_tags!.map(st => st.tags && (
                            <span key={st.tag_id} className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold bg-slate-100 text-slate-600">
                              {st.tags.name}
                            </span>
                          ))}
                        </div>
                      )}
                    </button>
                  </div>
                ))}
              </div>
              {selectedSongIds.size > 0 && (
                <Button className="w-full" onClick={handleAddSelected} disabled={isLoading}>
                  {isLoading ? 'Legger til…' : `Legg til ${selectedSongIds.size} ${selectedSongIds.size === 1 ? 'sang' : 'sanger'}`}
                </Button>
              )}
              </>
            )}
            {error && <div className="text-sm text-red-600">{error}</div>}
          </div>
        )}
        </>
        )}
      </SheetContent>
    </Sheet>
  );
}
