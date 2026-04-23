import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card';

const MODE_OPTIONS = [
  { value: 'host_only', label: 'Vert kun' },
  { value: 'suggest', label: 'Forslag' },
  { value: 'open', label: 'Åpent' },
] as const;

export function RoomNew() {
  const { groupId } = useParams();
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [mode, setMode] = useState<'host_only' | 'suggest' | 'open'>('host_only');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');

    if (!title.trim() || !date) {
      setError('Tittel og dato må fylles ut.');
      return;
    }

    if (!groupId) {
      setError('Mangler gruppe-id.');
      return;
    }

    setIsLoading(true);

    const roomData: {
      group_id: string;
      title: string;
      date: string;
      status: 'planned' | 'active' | 'completed';
      mode: 'host_only' | 'suggest' | 'open';
    } = {
      group_id: groupId,
      title: title.trim(),
      date,
      status: 'planned',
      mode,
    };

    const { data, error: insertError } = await supabase
      .from('rooms')
      .insert(roomData)
      .select('id')
      .single<{ id: string }>();

    setIsLoading(false);

    if (insertError || !data) {
      setError('Kunne ikke opprette rommet. Prøv igjen.');
      return;
    }

    navigate(`/${groupId}/rooms/${data.id}`);
  };

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-6 sm:px-6">
      <div className="mx-auto max-w-2xl space-y-6">
        <Card className="rounded-3xl">
          <CardHeader>
            <CardTitle>Opprett nytt rom</CardTitle>
            <CardDescription>Legg inn tittel, dato og modus for det kommende rommet.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-6" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-700">Tittel</label>
                <Input
                  type="text"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="Skriv romtittel"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-700">Dato</label>
                <Input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-700">Mode</label>
                <select
                  className="block w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-base outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                  value={mode}
                  onChange={(event) => setMode(event.target.value as 'host_only' | 'suggest' | 'open')}
                >
                  {MODE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              {error ? <div className="rounded-2xl bg-red-50 p-4 text-sm text-red-800">{error}</div> : null}

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <Button type="submit" disabled={isLoading}>
                  {isLoading ? 'Lagrer…' : 'Opprett rom'}
                </Button>
                <Button type="button" variant="secondary" onClick={() => navigate(`/${groupId}`)}>
                  Avbryt
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
