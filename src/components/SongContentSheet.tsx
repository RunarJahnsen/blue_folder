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
}

export function SongContentSheet({ isOpen, onClose, song }: SongContentSheetProps) {
  if (!song) return null;

  return (
    <Sheet open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent side="bottom" className="h-[85vh] flex flex-col">
        <SheetHeader className="flex-shrink-0">
          <SheetTitle>
            {song.artist ? `${song.artist} — ${song.title}` : song.title}
          </SheetTitle>
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
        </SheetHeader>
        <div className="flex-1 overflow-y-auto mt-4">
          <pre className="whitespace-pre-wrap font-mono text-sm leading-relaxed text-slate-800">
            {song.content}
          </pre>
        </div>
      </SheetContent>
    </Sheet>
  );
}
