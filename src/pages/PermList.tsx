import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import type { Perm } from '@/lib/types';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card';

export function PermList() {
  const { groupId } = useParams();
  const navigate = useNavigate();
  const [perms, setPerms] = useState<Perm[]>([]);
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
        .from('perms')
        .select('id, title, date, status, mode')
        .eq('group_id', groupId)
        .order('date', { ascending: true });

      if (error) {
        setError('Kunne ikke hente permer. Prøv igjen.');
        setPerms([]);
      } else if (data) {
        setPerms(data as Perm[]);
      }
      setIsLoading(false);
    })();
  }, [groupId]);

  const activePerms = useMemo(() => perms.filter((perm) => perm.status === 'active'), [perms]);
  const upcomingPerms = useMemo(() => perms.filter((perm) => perm.status === 'planned'), [perms]);
  const previousPerms = useMemo(() => perms.filter((perm) => perm.status === 'completed'), [perms]);

  const renderPermCard = (perm: Perm) => (
    <Card key={perm.id} className="border border-slate-200 p-4 shadow-sm">
      <CardHeader>
        <CardTitle>{perm.title}</CardTitle>
        <CardDescription>
          {perm.date} · {perm.mode.replace('_', ' ')}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between gap-4 text-sm text-slate-600">
          <span>Status: {perm.status}</span>
          <Button variant="secondary" size="sm" onClick={() => navigate(`/${groupId}/perms/${perm.id}`)}>
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
            <h1 className="text-2xl font-semibold text-slate-900">Permoversikt</h1>
            <p className="max-w-2xl text-sm text-slate-600">
              Se alle permer i gruppen og opprett en ny samling.
            </p>
          </div>
          <Button onClick={() => navigate(`/${groupId}/perms/new`)}>
            Opprett perm
          </Button>
        </div>

        {error ? (
          <div className="rounded-3xl bg-red-50 p-4 text-sm text-red-800">{error}</div>
        ) : null}

        {isLoading ? (
          <div className="rounded-3xl bg-white p-6 text-slate-700 shadow-sm">Henter permer…</div>
        ) : (
          <div className="grid gap-6">
            <section className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <h2 className="text-lg font-semibold">Aktive permer</h2>
                <span className="text-sm text-slate-500">{activePerms.length} funnet</span>
              </div>
              {activePerms.length > 0 ? (
                <div className="grid gap-4">{activePerms.map(renderPermCard)}</div>
              ) : (
                <Card className="border border-dashed border-slate-300 bg-slate-50 p-6 text-slate-600">
                  Ingen aktive permer ennå.
                </Card>
              )}
            </section>

            <section className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <h2 className="text-lg font-semibold">Kommende permer</h2>
                <span className="text-sm text-slate-500">{upcomingPerms.length} funnet</span>
              </div>
              {upcomingPerms.length > 0 ? (
                <div className="grid gap-4">{upcomingPerms.map(renderPermCard)}</div>
              ) : (
                <Card className="border border-dashed border-slate-300 bg-slate-50 p-6 text-slate-600">
                  Ingen kommende permer ennå.
                </Card>
              )}
            </section>

            <section className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <h2 className="text-lg font-semibold">Tidligere permer</h2>
                <span className="text-sm text-slate-500">{previousPerms.length} funnet</span>
              </div>
              {previousPerms.length > 0 ? (
                <div className="grid gap-4">{previousPerms.map(renderPermCard)}</div>
              ) : (
                <Card className="border border-dashed border-slate-300 bg-slate-50 p-6 text-slate-600">
                  Ingen tidligere permer ennå.
                </Card>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
