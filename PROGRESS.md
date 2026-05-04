# Progress

## Pågående oppgave
Slice 8b del 1 — Rediger og slett perm. Vert kan endre tittel/dato via Dialog, og slette perm med inline bekreftelse.

## Gjort
- Lagt til imports: Input, Sheet, SheetContent, SheetHeader, SheetTitle
- Lagt til state: isEditSheetOpen, editTitle, editDate, isSaving, isConfirmingDelete, isDeleting
- Lagt til handleOpenEdit, handleSaveFolder, handleDeleteFolder

- Lagt til Rediger-knapp og Slett-knapp (med inline bekreftelse) i host-kontrollraden
- Lagt til Sheet-markup for redigering av tittel og dato

## Gjenstår
(ingenting)

## Avveininger
- Sletting bruker inline bekreftelse (ikke Dialog) for enklere mobil-UX
- Rediger bruker Dialog siden to felter trenger mer plass
- Sletting sletter folder_song_entries først, deretter folders (rekkefølge for FK-hensyn)
