import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { useGuestSession } from '@/hooks/useGuestSession';
import type { Favorite, Song, SongWithTags, Tag } from '@/lib/types';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
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
  const { memberships } = useAuth();
  const { guestCode } = useGuestSession();
  const addedBy = memberships.find(m => m.group_id === groupId)?.username ?? guestCode ?? null;
  const [activeTab, setActiveTab] = useState<'url' | 'favorites' | 'all'>('favorites');
  const [groupFavorites, setGroupFavorites] = useState<FavoriteWithSong[]>([]);
  const [isFetchingFavorites, setIsFetchingFavorites] = useState(false);
  const [favoritesSearch, setFavoritesSearch] = useState('');
  const [activeFavFilterTags, setActiveFavFilterTags] = useState<string[]>([]);

  const [allSongs, setAllSongs] = useState<SongWithTags[]>([]);
  const [isFetchingAllSongs, setIsFetchingAllSongs] = useState(false);
  const [allSongsSearch, setAllSongsSearch] = useState('');
  const [allModalTags, setAllModalTags] = useState<Tag[]>([]);
  const [activeModalFilterTags, setActiveModalFilterTags] = useState<string[]>([]);

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

  useEffect(() => {
    if (activeTab !== 'favorites' || !groupId) return;
    setIsFetchingFavorites(true);
    (async () => {
      const headers = await pgHeaders();
      const res = await fetch(
        `${BASE()}/rest/v1/favorites?group_id=eq.${groupId}&select=id,song_id,group_id,created_at,songs(id,title,artist,url,content,added_by,song_tags(id,tag_id,tags(id,name)))`,
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
          ...(addedBy ? { added_by: addedBy } : {}),
        }),
      });
      if (!res.ok) { setError('Kunne ikke opprett sang.'); return; }
      const raw = await res.json();
      const newSong = Array.isArray(raw) ? (raw[0] as Song) : null;
      if (!newSong) { setError('Kunne ikke opprett sang.'); return; }
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

  const handleClose = () => {
    setShowFetchWarning(false);
    setWarningSongId(null);
    setManualContent('');
    setIsSavingManual(false);
    setActiveTab('favorites');
    setGroupFavorites([]);
    setFavoritesSearch('');
    setActiveFavFilterTags([]);
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
    setExistingSong(null);
    setError('');
    onClose();
  };

  const filteredAllSongs = (() => {
    const q = allSongsSearch.trim().toLowerCase();
    let result = allSongs;
    if (q) {
      result = result.filter((s) => {
        const t = s.title?.toLowerCase() ?? '';
        const a = s.artist?.toLowerCase() ?? '';
        const c = s.content?.toLowerCase() ?? '';
        const ab = s.added_by?.toLowerCase() ?? '';
        return t.includes(q) || a.includes(q) || c.includes(q) || ab.includes(q);
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
        return t.includes(q) || a.includes(q) || c.includes(q) || ab.includes(q);
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

  const handleOpenChange = (open: boolean) => {
    if (!open) handleClose();
  };

  return (
    <Sheet open={isOpen} onOpenChange={handleOpenChange}>
      <SheetContent side="bottom">
        <SheetHeader>
          <SheetTitle>Legg til sang</SheetTitle>
          <SheetDescription>Legg til ny sang til permen</SheetDescription>
        </SheetHeader>

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
        <div className="flex gap-2 mt-4 flex-wrap">
          <Button
            type="button"
            size="sm"
            variant={activeTab === 'favorites' ? 'default' : 'outline'}
            onClick={() => { setActiveTab('favorites'); setError(''); }}
          >
            Favoritter
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
              <div className="space-y-4 mt-6">
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
                      onChange={(e) => setUrl(e.target.value)}
                      disabled={isLoading}
                    />
                    <p className="text-xs text-slate-400 mt-1">Sanger fra Nortabs hentes automatisk med tekst.</p>
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
                  <Input
                    type="text"
                    placeholder="Artistnavn"
                    value={artist}
                    onChange={(e) => setArtist(e.target.value)}
                    disabled={isLoading}
                  />
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
              <div className="space-y-4 mt-6">
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
              <div className="space-y-4 mt-6">
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

        {/* Favorites tab */}
        {activeTab === 'favorites' && (
          <div className="mt-6 space-y-4">
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
              <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto">
                {filteredFavorites.map((fav) => (
                  <button
                    key={fav.id}
                    type="button"
                    onClick={() => createFolderSongEntry(fav.songs.id)}
                    className="w-full text-left border-0 bg-transparent px-0 py-3 hover:opacity-70 transition-opacity"
                  >
                    <p className="text-sm font-medium text-slate-900">
                      {fav.songs.artist ? `${fav.songs.artist} — ${fav.songs.title}` : fav.songs.title}
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">{truncateUrl(fav.songs.url)}</p>
                  </button>
                ))}
              </div>
            )}
            {error && <div className="text-sm text-red-600">{error}</div>}
          </div>
        )}

        {/* All songs tab */}
        {activeTab === 'all' && (
          <div className="mt-6 space-y-4">
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
              <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto">
                {filteredAllSongs.map((song) => (
                  <button
                    key={song.id}
                    type="button"
                    onClick={() => createFolderSongEntry(song.id)}
                    className="w-full text-left border-0 bg-transparent px-0 py-3 hover:opacity-70 transition-opacity"
                  >
                    <p className="text-sm font-medium text-slate-900">
                      {song.artist ? `${song.artist} — ${song.title}` : song.title}
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {song.url ? truncateUrl(song.url) : 'Sangtekst'}
                    </p>
                    {(song as SongWithTags).song_tags && (song as SongWithTags).song_tags!.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {(song as SongWithTags).song_tags!.map(st => st.tags && (
                          <span key={st.tag_id} className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold bg-slate-100 text-slate-600">
                            {st.tags.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </button>
                ))}
              </div>
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
