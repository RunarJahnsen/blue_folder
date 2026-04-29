import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Heart } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Favorite, Song } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export function SongList() {
  const { groupId } = useParams();
  const navigate = useNavigate();
  const [songs, setSongs] = useState<Song[]>([]);
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

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
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setConfirmDeleteId(song.id)}
                    >
                      Slett
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
