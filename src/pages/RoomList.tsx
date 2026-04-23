import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import type { Room } from '@/lib/types';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card';

export function RoomList() {
  const { groupId } = useParams();
  const navigate = useNavigate();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!groupId) {
      setError('Mangler gruppe-id.');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError('');

    (async () => {
      const { data, error } = await supabase
        .from('rooms')
        .select('id, title, date, status, mode')
        .eq('group_id', groupId)
        .order('date', { ascending: true });

      if (error) {
        setError('Kunne ikke hente rom. Prøv igjen.');
        setRooms([]);
      } else if (data) {
        setRooms(data as Room[]);
      }
      setIsLoading(false);
    })();
  }, [groupId]);

  const activeRooms = useMemo(() => rooms.filter((room) => room.status === 'active'), [rooms]);
  const upcomingRooms = useMemo(() => rooms.filter((room) => room.status === 'planned'), [rooms]);
  const previousRooms = useMemo(() => rooms.filter((room) => room.status === 'completed'), [rooms]);

  const renderRoomCard = (room: Room) => (
    <Card key={room.id} className="border border-slate-200 p-4 shadow-sm">
      <CardHeader>
        <CardTitle>{room.title}</CardTitle>
        <CardDescription>
          {room.date} · {room.mode.replace('_', ' ')}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between gap-4 text-sm text-slate-600">
          <span>Status: {room.status}</span>
          <Button variant="secondary" size="sm" onClick={() => navigate(`/${groupId}/rooms/${room.id}`)}>
            Åpne
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-6 sm:px-6">
      <div className="mx-auto flex max-w-4xl flex-col gap-6">
        <div className="flex flex-col gap-4 rounded-3xl bg-white p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.24em] text-sky-700">Blå perm</p>
            <h1 className="text-2xl font-semibold text-slate-900">Romoversikt</h1>
            <p className="max-w-2xl text-sm text-slate-600">
              Se alle rom i gruppen og opprett et nytt arrangement.
            </p>
          </div>
          <Button onClick={() => navigate(`/${groupId}/rooms/new`)}>
            Opprett rom
          </Button>
        </div>

        {error ? (
          <div className="rounded-3xl bg-red-50 p-4 text-sm text-red-800">{error}</div>
        ) : null}

        {isLoading ? (
          <div className="rounded-3xl bg-white p-6 text-slate-700 shadow-sm">Henter rom…</div>
        ) : (
          <div className="grid gap-6">
            <section className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <h2 className="text-lg font-semibold">Aktive rom</h2>
                <span className="text-sm text-slate-500">{activeRooms.length} funnet</span>
              </div>
              {activeRooms.length > 0 ? (
                <div className="grid gap-4">{activeRooms.map(renderRoomCard)}</div>
              ) : (
                <Card className="border border-dashed border-slate-300 bg-slate-50 p-6 text-slate-600">
                  Ingen aktive rom ennå.
                </Card>
              )}
            </section>

            <section className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <h2 className="text-lg font-semibold">Kommende rom</h2>
                <span className="text-sm text-slate-500">{upcomingRooms.length} funnet</span>
              </div>
              {upcomingRooms.length > 0 ? (
                <div className="grid gap-4">{upcomingRooms.map(renderRoomCard)}</div>
              ) : (
                <Card className="border border-dashed border-slate-300 bg-slate-50 p-6 text-slate-600">
                  Ingen kommende rom ennå.
                </Card>
              )}
            </section>

            <section className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <h2 className="text-lg font-semibold">Tidligere rom</h2>
                <span className="text-sm text-slate-500">{previousRooms.length} funnet</span>
              </div>
              {previousRooms.length > 0 ? (
                <div className="grid gap-4">{previousRooms.map(renderRoomCard)}</div>
              ) : (
                <Card className="border border-dashed border-slate-300 bg-slate-50 p-6 text-slate-600">
                  Ingen tidligere rom ennå.
                </Card>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
