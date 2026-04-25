import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { FolderSongEntry, Song } from '@/lib/types';
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

type Step = 'input' | 'confirm';

export function AddSongModal({
  isOpen,
  onClose,
  groupId,
  folderId,
  folderMode,
  maxPosition,
  onSongAdded,
}: AddSongModalProps) {
  useEffect(() => {
    console.log('AddSongModal: isOpen changed to', isOpen);
  }, [isOpen]);

  const [step, setStep] = useState<Step>('input');
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [existingSong, setExistingSong] = useState<Song | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const validateUrl = (u: string) => {
    return u.startsWith('http://') || u.startsWith('https://');
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
        setStep('confirm');
      } else {
        await createNewSongAndEntry();
      }
    } catch {
      await createNewSongAndEntry();
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
        })
        .select()
        .single<Song>();

      if (songError || !newSong) {
        setError('Kunne ikke opprett sang.');
        return;
      }

      await createFolderSongEntry(newSong.id);
    } catch {
      setError('En feil oppstod.');
    }
  };

  const createFolderSongEntry = async (songId: string) => {
    try {
      const state =
        folderMode === 'suggest' ? 'suggested' : 'queued';
      const position =
        folderMode === 'suggest' ? undefined : maxPosition + 1;

      const { error: entryError } = await supabase
        .from('folder_song_entries')
        .insert({
          group_id: groupId,
          folder_id: folderId,
          song_id: songId,
          state,
          position,
        });

      if (entryError) {
        setError('Kunne ikke legge til sang i permen.');
        return;
      }

      onSongAdded();
      handleClose();
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
    console.log('AddSongModal: closing modal');
    setStep('input');
    setUrl('');
    setTitle('');
    setExistingSong(null);
    setError('');
    onClose();
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      handleClose();
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={handleOpenChange}>
      <SheetContent side="bottom">
        <SheetHeader>
          <SheetTitle>Legg til sang</SheetTitle>
          <SheetDescription>Legg til ny sang til permen</SheetDescription>
        </SheetHeader>

        {step === 'input' ? (
          <div className="space-y-4 mt-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                URL
              </label>
              <Input
                type="text"
                placeholder="https://genius.com/..."
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                disabled={isLoading}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Tittel
              </label>
              <Input
                type="text"
                placeholder="Sangnavn"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={isLoading}
              />
            </div>
            {error && <div className="text-sm text-red-600">{error}</div>}
            <div className="flex gap-2 justify-end pt-4">
              <Button variant="outline" onClick={handleClose} disabled={isLoading}>
                Avbryt
              </Button>
              <Button onClick={handleCheckUrl} disabled={isLoading}>
                {isLoading ? 'Sjekker...' : 'Legg til'}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4 mt-6">
            <div className="p-3 bg-sky-50 rounded-lg text-sm text-sky-900">
              Denne URL finnes allerede som <strong>{existingSong?.title}</strong>
            </div>
            {error && <div className="text-sm text-red-600">{error}</div>}
            <div className="flex gap-2 justify-end pt-4">
              <Button
                variant="outline"
                onClick={() => setStep('input')}
                disabled={isLoading}
              >
                Avbryt
              </Button>
              <Button
                variant="outline"
                onClick={handleAddNew}
                disabled={isLoading}
              >
                Legg til ny
              </Button>
              <Button onClick={handleUseExisting} disabled={isLoading}>
                Bruk denne
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
