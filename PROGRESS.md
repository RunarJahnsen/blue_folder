# Progress

## Pågående oppgave
Slice 8b del 2 — Fjern sang fra kø og rediger sang i sanglisten.

## Analyse

### Del 1 — Fjern sang fra kø (FolderView.tsx)

Kø-kortene har i dag host-knappene "Flytt nederst", "Spill som neste", "Spill nå" i en rad.
En "Fjern"-knapp legges til i samme rad med rød stil (`bg-red-600`).

Handler:
```ts
const handleRemoveFromQueue = async (entryId: string) => {
  await supabase.from('folder_song_entries').update({ state: 'removed' }).eq('id', entryId);
  setEntries((prev) => prev.map((e) => e.id === entryId ? { ...e, state: 'removed' } : e));
};
```

Ingen bekreftelsesdialog — oppgaven beskriver direkte klikk. Rød knappfarge er det visuelle signalet.
Tilgangsstyring: samme `showHostControls`-betingelse som øvrige køknapper.

**Fil som endres:** `src/pages/FolderView.tsx`

---

### Del 2 — Rediger sang (SongList.tsx)

SongList har i dag tittel, artist, URL og slett-knapp per sang. Content (sangtekst) vises ikke.

**UI-valg: Bottom Sheet** — konsistent med redigeringsmønsteret fra FolderView.
Grunner: 4 felter (tittel, artist, URL, sangtekst), særlig content-feltet krever textarea og plass.
Inline expand blir for trangt på 375px.

State som legges til:
- `editingSong: Song | null` — hvilken sang som redigeres
- `editFields: { title, artist, url, content }` — aktive feltverdier
- `isSaving: boolean`

Handler `handleSaveSong`:
```ts
supabase.from('songs').update({ title, artist, url, content }).eq('id', editingSong.id)
```
Etter lagring: oppdater lokal `songs`-state optimistisk.

"Rediger"-knapp (outline) legges til ved siden av eksisterende "Slett"-knapp i sang-raden.
Sheet lukkes via `onOpenChange` som nuller ut `editingSong`.

**Fil som endres:** `src/pages/SongList.tsx`

---

### Ingen nye filer
Sheet-komponenten (`src/components/ui/sheet.tsx`) og Input (`src/components/ui/input.tsx`) finnes allerede.

## Gjort
- Del 1: handleRemoveFromQueue + rød Fjern-knapp i kø-kortene (FolderView.tsx)

- Del 2: imports + state + handleOpenEdit + handleSaveSong + Rediger-knapp + Sheet i SongList.tsx

## Gjenstår
(ingenting)
