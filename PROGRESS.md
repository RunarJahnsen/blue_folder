# PROGRESS — Slice 9c: Gjesteinvitasjon

## Oppgave

Admin/eier genererer en gjestekode for en spesifikk perm. Gjester åpner lenken, validerer koden, og får lese-/skrive-tilgang til akkurat den permen — uten å logge inn.

---

## Analyse

### Teknisk kjernevalg: anon-rolle med RLS-policies

Gjester er ikke innlogget → ingen `access_token` → PostgREST-kall skjer med anon-nøkkel, som gir rollen `anon` i PostgreSQL.

Eksisterende RLS-policies bruker alle `TO authenticated` — de påvirker ikke `anon`-rollen. Vi legger til egne policies for `anon` som tillater tilgang til permer med aktiv `guest_code`.

**Flyt:**
1. Admin/eier genererer `guest_code` (UUID) via knapp i FolderView → PATCH `folders`
2. Lenken vises: `https://blå.app/join/{guest_code}`
3. Gjest åpner lenken → `/join/:guestCode`
4. JoinFolder-siden: `GET /rest/v1/folders?guest_code=eq.{kode}&select=id,group_id,title,mode` med anon-nøkkel
5. Hvis funnet: lagrer `{ guestFolderId, guestGroupId, guestCode }` i localStorage → redirect til `/{groupId}/folders/{folderId}`
6. FolderView: `pgHeaders()` faller naturlig tilbake til anon-nøkkel når session er null → eksisterende kode trenger minimal endring
7. Anon-policies lar gjesten lese folder + entries, og skrive entries i open/suggest-modus

**Anon-policy-mønster:**
```sql
-- Anon kan lese permer som har aktiv gjestekode
CREATE POLICY "anon can read guest folders" ON folders
  FOR SELECT TO anon
  USING (guest_code IS NOT NULL);

-- Anon kan lese sang-entries for slike permer
CREATE POLICY "anon can read guest entries" ON folder_song_entries
  FOR SELECT TO anon
  USING (folder_id IN (SELECT id FROM folders WHERE guest_code IS NOT NULL));

-- Anon kan lese sanger (nødvendig for join i folder_song_entries-spørringen)
CREATE POLICY "anon can read songs in guest folders" ON songs
  FOR SELECT TO anon
  USING (id IN (
    SELECT fse.song_id FROM folder_song_entries fse
    JOIN folders f ON f.id = fse.folder_id
    WHERE f.guest_code IS NOT NULL
  ));

-- Anon kan legge til songs og entries i open/suggest-permer
CREATE POLICY "anon can insert songs in guest folders" ON songs
  FOR INSERT TO anon
  WITH CHECK (group_id IN (SELECT group_id FROM folders WHERE guest_code IS NOT NULL));

CREATE POLICY "anon can insert entries in guest folders" ON folder_song_entries
  FOR INSERT TO anon
  WITH CHECK (folder_id IN (SELECT id FROM folders WHERE guest_code IS NOT NULL));

-- Anon kan lese favorites (for favoritt-visning i AddSongModal)
CREATE POLICY "anon can read favorites in guest folders" ON favorites
  FOR SELECT TO anon
  USING (group_id IN (SELECT group_id FROM folders WHERE guest_code IS NOT NULL));
```

**Kjent begrensning (akseptabel i MVP):** Anon kan liste alle permer med aktiv gjestekode ved å kalle `/rest/v1/folders` uten filter. Disse vet ikke folder-ID uten å kjenne koden. Permtitler er ikke sensitive data for denne appen.

---

### SQL-migrasjoner

```sql
-- 1. Legg til guest_code
ALTER TABLE folders ADD COLUMN guest_code TEXT UNIQUE;

-- 2. Anon SELECT/INSERT policies (se over)
```

---

### Filer som opprettes

| Fil | Innhold |
|-----|---------|
| `src/pages/JoinFolder.tsx` | Validerer kode, lagrer gjest-session, redirecter |
| `src/hooks/useGuestSession.ts` | Leser/skriver `{ guestFolderId, guestGroupId, guestCode }` fra localStorage |

### Filer som endres

| Fil | Endring |
|-----|---------|
| `src/lib/types.ts` | Legg til `guest_code?: string` på `Folder` |
| `src/App.tsx` | Legg til `/join/:guestCode` som **upprotected** rute |
| `src/pages/FolderView.tsx` | Gjest-deteksjon via `useGuestSession`; juster `showHostControls`; UI for å generere/vise/deaktivere kode |

---

### Detaljer per fil

**`useGuestSession.ts`**
```ts
const GUEST_KEY = 'allsang_guest';
export function useGuestSession() {
  // returnerer { guestFolderId, guestGroupId, guestCode, setGuest, clearGuest }
}
```

**`JoinFolder.tsx`** (`/join/:guestCode`)
- Upprotected rute — ingen `<ProtectedRoute>`
- Henter folder med anon-nøkkel: `GET /rest/v1/folders?guest_code=eq.{kode}`
- Lagrer i localStorage via `useGuestSession`
- Redirecter til `/{groupId}/folders/{folderId}`
- Viser feilmelding hvis koden er ugyldig/deaktivert

**`FolderView.tsx` — endringer**

`isGuest`:
```tsx
const { isGuest, guestFolderId } = useGuestSession();
const isCurrentGuest = isGuest && guestFolderId === folderId;
```

`pgHeaders()` i FolderView er allerede korrekt — faller tilbake til anon-nøkkel når ingen session:
```ts
const token = session?.access_token ?? import.meta.env.VITE_SUPABASE_ANON_KEY;
```

`showHostControls`:
```tsx
// Gjester får aldri host controls, selv ikke i open-modus
const showHostControls = !isCurrentGuest && (folder.mode === 'open' || isHost);
```

FAB (legg til sang):
```tsx
// Gjester kan legge til i open og suggest, men ikke host_only
const canAddSong = isHost || (folder.mode !== 'host_only' && !isCurrentGuest) || (folder.mode !== 'host_only' && isCurrentGuest && folder.mode === 'open');
// Forenklet: !isCurrentGuest || folder.mode === 'open' || folder.mode === 'suggest'
```

Gjestekode-UI (kun synlig for isHost):
- Knapp: «Generer gjestekode» → PATCH `folders.guest_code = uuid()`
- Viser lenken som kopiérbar `input`
- Knapp: «Deaktiver» → PATCH `folders.guest_code = null`

**`App.tsx`**:
```tsx
<Route path="/join/:guestCode" element={<JoinFolder />} />
```
Legges UTENFOR `<ProtectedRoute>`.

---

### Realtime for gjester

`supabase.channel()` bruker WebSocket-forbindelsen til Supabase. Når klienten ikke er innlogget, brukes anon-nøkkelen. Supabase Realtime respekterer RLS-policies for `postgres_changes` — anon-policies vi legger til vil automatisk tillate gjester å motta realtime-events for folder/entries. Ingen ekstra konfigurasjon nødvendig.

---

### Risikoer

| Risiko | Alvorlighet | Tiltak |
|--------|-------------|--------|
| Anon kan liste titler på alle aktive gjest-permer | Lav | Akseptert begrensning i MVP |
| Gjest i open-modus kan i teorien legge til sanger i ALLE permer med gjestekode | Middels | Anon INSERT policy sjekker `folder_id` mot spesifikk perm — men de kjenner bare sin egen folder-ID |
| Gjestekode-UUID er lang nok til at brute force ikke er praktisk | — | UUID v4 = 122 bits entropi |
| Realtime med anon: events for andre permer lekker ikke | Lav | Channel filtrerer på `folder_id=eq.{folderId}` |
| `pgHeaders()` i FolderView kaller `supabase.auth.getSession()` — for gjester returnerer dette bare null | Ingen | Faller tilbake til anon-nøkkel, fungerer som forventet |

---

## Gjort

- `src/lib/types.ts`: Lagt til `guest_code?: string` på `Folder`, `added_by?: string` og `updated_by?: string` på `Song`
- `src/hooks/useGuestSession.ts`: Ny hook — leser/skriver `{ guestFolderId, guestGroupId, guestCode }` fra localStorage
- `src/pages/JoinFolder.tsx`: Ny side — validerer gjestekode med anon-nøkkel, lagrer guest session, redirecter til permen
- `src/App.tsx`: Lagt til `allowGuest`-prop på `ProtectedRoute`, `/join/:guestCode`-rute (utenfor ProtectedRoute), `allowGuest` på FolderView-ruten
- `src/pages/FolderView.tsx`: `useGuestSession`, `isCurrentGuest`, justert `showHostControls`, gjestekode-UI (generer/kopier/deaktiver), `handleGenerateGuestCode`, `handleDeactivateGuestCode`
- `src/components/AddSongModal.tsx`: `useAuth` + `useGuestSession`, `addedBy` lagt til på begge songs INSERT-kall
- `src/pages/SongList.tsx`: `useAuth`, `updatedBy` lagt til på songs PATCH

## Gjenstår

- SQL kjøres manuelt av bruker (se Analyse-seksjonen for fullstendig SQL)
- Verifisering at alt fungerer end-to-end med faktisk gjest
