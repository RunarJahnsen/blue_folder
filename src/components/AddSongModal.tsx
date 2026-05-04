import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
import type { Favorite, Song } from '@/lib/types';
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
type FavoriteWithSong = Favorite & { songs: Song };

export function AddSongModal({
  isOpen,
  onClose,
  groupId,
  folderId,
  folderMode,
  maxPosition,
  onSongAdded,
}: AddSongModalProps) {
  const [activeTab, setActiveTab] = useState<'url' | 'favorites' | 'all'>('url');
  const [groupFavorites, setGroupFavorites] = useState<FavoriteWithSong[]>([]);
  const [isFetchingFavorites, setIsFetchingFavorites] = useState(false);
  const [favoritesSearch, setFavoritesSearch] = useState('');

  const [allSongs, setAllSongs] = useState<Song[]>([]);
  const [isFetchingAllSongs, setIsFetchingAllSongs] = useState(false);
  const [allSongsSearch, setAllSongsSearch] = useState('');

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

  useEffect(() => {
    if (activeTab !== 'favorites' || !groupId) return;
    setIsFetchingFavorites(true);
    (async () => {
      const { data } = await supabase
        .from('favorites')
        .select('id, song_id, group_id, created_at, songs(id, title, artist, url, content)')
        .eq('group_id', groupId);
      if (data) setGroupFavorites(data as unknown as FavoriteWithSong[]);
      setIsFetchingFavorites(false);
    })();
  }, [activeTab, groupId]);

  useEffect(() => {
    if (activeTab !== 'all' || !groupId) return;
    setIsFetchingAllSongs(true);
    (async () => {
      const { data } = await supabase
        .from('songs')
        .select('*')
        .eq('group_id', groupId)
        .order('title');
      if (data) setAllSongs(data as unknown as Song[]);
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
      const { data: existingData } = await supabase
        .from('songs')
        .select('*')
        .eq('group_id', groupId)
        .eq('url', url)
        .single();

      if (existingData) {
        setExistingSong(existingData as Song);
        setStep('url-match');
      } else {
        try {
          const { data: existingByTitle } = await supabase
            .from('songs')
            .select('*')
            .eq('group_id', groupId)
            .ilike('title', title)
            .limit(1)
            .maybeSingle();

          if (existingByTitle) {
            setExistingSong(existingByTitle as Song);
            setStep('title-match');
          } else {
            await createNewSongAndEntry();
          }
        } catch (err) {
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
      const { data: newSong, error: songError } = await supabase
        .from('songs')
        .insert({
          group_id: groupId,
          title,
          url: '',
          content: lyrics,
          ...(artist.trim() ? { artist: artist.trim() } : {}),
        } as any)
        .select()
        .single<Song>();

      if (songError || !newSong) {
        setError('Kunne ikke opprett sang.');
        return;
      }

      await createFolderSongEntry(newSong.id);
    } catch {
      setError('En feil oppstod.');
    } finally {
      setIsLoading(false);
    }
  };

  const createNewSongAndEntry = async () => {
    try {
      const { data: newSong, error: songError } = await supabase
        .from('songs')
        .insert({
          group_id: groupId,
          title,
          url,
          ...(artist.trim() ? { artist: artist.trim() } : {}),
        } as any)
        .select()
        .single<Song>();

      if (songError || !newSong) {
        setError('Kunne ikke opprett sang.');
        return;
      }

      let contentFetched = false;
      try {
        const res = await supabase.functions.invoke('fetch-song-content', {
          body: { url: newSong.url, song_id: newSong.id },
          headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` },
        });
        contentFetched = !!(res.data?.content);
      } catch {}

      await createFolderSongEntry(newSong.id, contentFetched);
      if (!contentFetched) setShowFetchWarning(true);
    } catch {
      setError('En feil oppstod.');
    }
  };

  const createFolderSongEntry = async (songId: string, closeAfter = true) => {
    try {
      const state = folderMode === 'suggest' ? 'suggested' : 'queued';
      const position = folderMode === 'suggest' ? undefined : maxPosition + 1;

      const { error: entryError } = await supabase
        .from('folder_song_entries')
        .insert({
          group_id: groupId,
          folder_id: folderId,
          song_id: songId,
          state,
          position,
        } as any);

      if (entryError) {
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

  const handleClose = () => {
    setShowFetchWarning(false);
    setActiveTab('url');
    setGroupFavorites([]);
    setFavoritesSearch('');
    setAllSongs([]);
    setAllSongsSearch('');
    setIsFetchingAllSongs(false);
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
    if (!q) return allSongs;
    return allSongs.filter((s) => {
      const t = s.title?.toLowerCase() ?? '';
      const a = s.artist?.toLowerCase() ?? '';
      const c = s.content?.toLowerCase() ?? '';
      return t.includes(q) || a.includes(q) || c.includes(q);
    });
  })();

  const filteredFavorites = (() => {
    const q = favoritesSearch.trim().toLowerCase();
    if (!q) return groupFavorites;
    return groupFavorites.filter((fav) => {
      const t = fav.songs?.title?.toLowerCase() ?? '';
      const a = fav.songs?.artist?.toLowerCase() ?? '';
      const c = fav.songs?.content?.toLowerCase() ?? '';
      return t.includes(q) || a.includes(q) || c.includes(q);
    });
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
            <div className="flex justify-end">
              <Button onClick={handleClose}>Lukk</Button>
            </div>
          </div>
        ) : (
        <>
        {/* Tab toggle */}
        <div className="flex gap-2 mt-4 flex-wrap">
          <Button
            type="button"
            size="sm"
            variant={activeTab === 'url' ? 'default' : 'outline'}
            onClick={() => { setActiveTab('url'); setError(''); }}
          >
            Legg til URL
          </Button>
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
                      placeholder="https://genius.com/..."
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      disabled={isLoading}
                    />
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
            {isFetchingFavorites ? (
              <p className="text-sm text-slate-500">Henter favoritter…</p>
            ) : groupFavorites.length === 0 ? (
              <p className="text-sm text-slate-500">Ingen favoritter ennå.</p>
            ) : filteredFavorites.length === 0 ? (
              <p className="text-sm text-slate-500">Ingen treff for «{favoritesSearch}».</p>
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
            {isFetchingAllSongs ? (
              <p className="text-sm text-slate-500">Henter sanger…</p>
            ) : allSongs.length === 0 ? (
              <p className="text-sm text-slate-500">Ingen sanger i biblioteket ennå.</p>
            ) : filteredAllSongs.length === 0 ? (
              <p className="text-sm text-slate-500">Ingen treff for «{allSongsSearch}».</p>
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
