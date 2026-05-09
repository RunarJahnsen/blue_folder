import { PlayCircle } from 'lucide-react';
import type { Song } from '@/lib/types';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';

interface SongContentSheetProps {
  isOpen: boolean;
  onClose: () => void;
  song: Song | null;
  noContentMessage?: string;
}

export function SongContentSheet({ isOpen, onClose, song, noContentMessage = 'Ingen tekst tilgjengelig.' }: SongContentSheetProps) {
  if (!song) return null;

  return (
    <Sheet open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent
        side="bottom"
        className="max-h-[85vh] data-[state=open]:flex data-[state=open]:flex-col"
      >
        <SheetHeader className="flex-shrink-0">
          <SheetTitle>
            {song.artist ? `${song.artist} — ${song.title}` : song.title}
          </SheetTitle>
          <div className="flex flex-wrap gap-3">
            {song.url && (
              <a
                href={song.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-sky-600 hover:underline"
              >
                Åpne ekstern lenke
              </a>
            )}
            {song.listen_url && (
              <a
                href={song.listen_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-sky-600 hover:underline"
              >
                <PlayCircle className="h-3.5 w-3.5" />
                Lytt til sangen
              </a>
            )}
          </div>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto mt-4">
          {song.content ? (
            <pre className="whitespace-pre-wrap font-mono text-sm leading-relaxed text-slate-800">
              {song.content}
            </pre>
          ) : (
            <p className="text-sm text-slate-400">{noContentMessage}</p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
