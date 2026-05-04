import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
import { ArrowLeft, Heart, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Favorite, SongWithTags, Tag, SongTagEntry } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';

export function SongList() {
  const { groupId } = useParams();
  const navigate = useNavigate();
  const [songs, setSongs] = useState<SongWithTags[]>([]);
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [activeFilterTags, setActiveFilterTags] = useState<string[]>([]);

  const [editingSong, setEditingSong] = useState<SongWithTags | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editArtist, setEditArtist] = useState('');
  const [editUrl, setEditUrl] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editTagNames, setEditTagNames] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isFetchingContent, setIsFetchingContent] = useState(false);

  useEffect(() => {
    if (!groupId) return;
    (async () => {
      const [songsResult, favsResult, tagsResult] = await Promise.all([
        supabase
          .from('songs')
          .select('id, group_id, title, artist, url, content, created_at, updated_at, song_tags(id, tag_id, tags(id, name))')
          .eq('group_id', groupId)
          .order('title', { ascending: true }),
        supabase
          .from('favorites')
          .select('id, song_id')
          .eq('group_id', groupId),
        supabase
          .from('tags')
          .select('id, group_id, name, created_at')
          .eq('group_id', groupId)
          .order('name'),
      ]);

      if (songsResult.error) setError('Kunne ikke hente sanger.');
      else if (songsResult.data) setSongs(songsResult.data as unknown as SongWithTags[]);
      if (favsResult.data) setFavorites(favsResult.data as Favorite[]);
      if (tagsResult.data) setAllTags(tagsResult.data as Tag[]);
      setIsLoading(false);
    })();
  }, [groupId]);

  const favoriteSongIds = useMemo(
    () => new Set(favorites.map((f) => f.song_id)),
    [favorites]
  );

  const tagsInUse = useMemo(() => {
    const tagMap = new Map<string, Tag>();
    songs.forEach(song => {
      song.song_tags?.forEach(st => {
        if (st.tags) tagMap.set(st.tags.id, st.tags);
      });
    });
    return Array.from(tagMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [songs]);

  const filteredSongs = useMemo(() => {
    if (activeFilterTags.length === 0) return songs;
    return songs.filter(song =>
      activeFilterTags.some(tagId => song.song_tags?.some(st => st.tag_id === tagId))
    );
  }, [songs, activeFilterTags]);

  const tagSuggestions = useMemo(() => {
    const q = tagInput.trim().toLowerCase();
    if (!q) return [];
    return allTags
      .filter(t => t.name.includes(q) && !editTagNames.includes(t.name))
      .slice(0, 5);
  }, [tagInput, allTags, editTagNames]);

  const handleDelete = async (songId: string) => {
    setIsDeleting(true);
    await supabase.from('favorites').delete().eq('song_id', songId);
    await supabase.from('folder_song_entries').delete().eq('song_id', songId);
    const { error } = await supabase.from('songs').delete().eq('id', songId);
    if (error) {
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
      await supabase.functions.invoke('fetch-song-content', {
        body: { url: editUrl.trim(), song_id: editingSong.id },
        headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` },
      });
      const { data } = await supabase.from('songs').select('content').eq('id', editingSong.id).single();
      if (data?.content) setEditContent(data.content);
    } catch {}
    setIsFetchingContent(false);
  };

  const handleSaveSong = async () => {
    if (!editingSong || !editTitle.trim() || !groupId) return;
    setIsSaving(true);

    const { error } = await supabase
      .from('songs')
      .update({
        title: editTitle.trim(),
        artist: editArtist.trim() || null,
        url: editUrl.trim(),
        content: editContent.trim() || null,
      })
      .eq('id', editingSong.id);
    if (error) { setIsSaving(false); return; }

    let savedTags: Tag[] = [];
    console.log('Saving tags:', editTagNames, 'for song:', editingSong.id);
    if (editTagNames.length > 0) {
      const { data: upsertedTags, error: tagsError } = await supabase
        .from('tags')
        .upsert(
          editTagNames.map(name => ({ group_id: groupId, name })),
          { onConflict: 'group_id,name' }
        )
        .select();
      console.log('Tags upsert result:', tagsError);
      if (upsertedTags) savedTags = upsertedTags as Tag[];
    }

    const { error: deleteError } = await supabase.from('song_tags').delete().eq('song_id', editingSong.id);
    console.log('song_tags delete result:', deleteError);
    if (savedTags.length > 0) {
      const { error: insertError } = await supabase.from('song_tags').insert(
        savedTags.map(tag => ({ song_id: editingSong.id, tag_id: tag.id, group_id: groupId }))
      );
      console.log('song_tags insert result:', insertError);
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
          <div>
            <p className="text-sm uppercase tracking-[0.24em] text-sky-600 font-semibold">Blå perm</p>
            <h1 className="text-2xl font-semibold text-slate-900">Sanger</h1>
            <p className="text-sm text-slate-600">Alle sanger lagret i gruppen.</p>
          </div>
        </div>

        {error && (
          <div className="rounded-2xl bg-red-50 p-4 text-sm text-red-800">{error}</div>
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
            <CardContent>{songs.length === 0 ? 'Ingen sanger ennå.' : 'Ingen sanger matcher valgte tagger.'}</CardContent>
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
                      <Heart
                        className={`h-4 w-4 flex-shrink-0 mt-0.5 ${favoriteSongIds.has(song.id) ? 'fill-sky-500 text-sky-500' : 'text-slate-300'}`}
                      />
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
                      </div>
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleOpenEdit(song)}
                      >
                        Rediger
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setConfirmDeleteId(song.id)}
                      >
                        Slett
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

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
              <div className="relative">
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
