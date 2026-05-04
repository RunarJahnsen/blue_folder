import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Heart } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Favorite, Song } from '@/lib/types';
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
  const [songs, setSongs] = useState<Song[]>([]);
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [editingSong, setEditingSong] = useState<Song | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editArtist, setEditArtist] = useState('');
  const [editUrl, setEditUrl] = useState('');
  const [editContent, setEditContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!groupId) return;
    (async () => {
      const [songsResult, favsResult] = await Promise.all([
        supabase
          .from('songs')
          .select('id, group_id, title, artist, url, content, created_at, updated_at')
          .eq('group_id', groupId)
          .order('title', { ascending: true }),
        supabase
          .from('favorites')
          .select('id, song_id')
          .eq('group_id', groupId),
      ]);

      if (songsResult.error) setError('Kunne ikke hente sanger.');
      else if (songsResult.data) setSongs(songsResult.data as Song[]);
      if (favsResult.data) setFavorites(favsResult.data as Favorite[]);
      setIsLoading(false);
    })();
  }, [groupId]);

  const favoriteSongIds = useMemo(
    () => new Set(favorites.map((f) => f.song_id)),
    [favorites]
  );

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

  const handleOpenEdit = (song: Song) => {
    setEditingSong(song);
    setEditTitle(song.title ?? '');
    setEditArtist(song.artist ?? '');
    setEditUrl(song.url ?? '');
    setEditContent(song.content ?? '');
  };

  const handleSaveSong = async () => {
    if (!editingSong || !editTitle.trim()) return;
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
    setIsSaving(false);
    if (error) return;
    setSongs((prev) =>
      prev.map((s) =>
        s.id === editingSong.id
          ? { ...s, title: editTitle.trim(), artist: editArtist.trim() || undefined, url: editUrl.trim(), content: editContent.trim() || undefined }
          : s
      )
    );
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

        {isLoading ? (
          <div className="rounded-2xl bg-white p-6 text-slate-700 shadow-sm">Henter sanger…</div>
        ) : songs.length === 0 ? (
          <Card className="bg-slate-50 text-slate-600 text-sm">
            <CardContent>Ingen sanger ennå.</CardContent>
          </Card>
        ) : (
          <div className="divide-y divide-slate-100 rounded-2xl bg-white shadow-sm overflow-hidden">
            {songs.map((song) => (
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
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2 min-w-0">
                      <Heart
                        className={`h-4 w-4 flex-shrink-0 ${favoriteSongIds.has(song.id) ? 'fill-sky-500 text-sky-500' : 'text-slate-300'}`}
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-900 truncate">
                          {song.artist ? `${song.artist} — ${song.title}` : song.title}
                        </p>
                        <a
                          href={song.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-slate-400 hover:text-sky-500 truncate block"
                        >
                          {song.url.length > 50 ? song.url.slice(0, 47) + '…' : song.url}
                        </a>
                      </div>
                    </div>
                    <div className="flex gap-2">
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
              <Input
                value={editUrl}
                onChange={(e) => setEditUrl(e.target.value)}
                placeholder="https://..."
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-slate-700">
                Sangtekst <span className="text-slate-400 font-normal">(valgfritt)</span>
              </label>
              <textarea
                className="w-full min-w-0 rounded-xl border-0 bg-white shadow-sm px-3 py-2 text-base transition-colors outline-none placeholder:text-slate-400 focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-0 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
                rows={8}
                placeholder="Lim inn sangteksten her..."
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
              />
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
