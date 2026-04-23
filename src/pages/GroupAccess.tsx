import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export function GroupAccess() {
  const [accessCode, setAccessCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const { data, error } = await supabase
        .from('groups')
        .select('id')
        .eq('access_code', accessCode.toLowerCase())
        .single();

      if (error || !data) {
        setError('Ugyldig tilgangskode. Prøv igjen.');
        return;
      }

      // Store group ID and navigate
      localStorage.setItem('allsang_group_id', data.id);
      navigate(`/${data.id}`);
    } catch (err) {
      setError('Noe gikk galt. Prøv igjen.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Allsang-appen</CardTitle>
          <CardDescription>
            Skriv inn tilgangskoden for å komme inn i gruppen din
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Input
                type="text"
                placeholder="Tilgangskode"
                value={accessCode}
                onChange={(e) => setAccessCode(e.target.value)}
                disabled={isLoading}
                className="text-center text-lg"
              />
            </div>
            {error && (
              <p className="text-sm text-red-600 text-center">{error}</p>
            )}
            <Button
              type="submit"
              className="w-full"
              disabled={isLoading || !accessCode.trim()}
            >
              {isLoading ? 'Sjekker...' : 'Kom inn'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}