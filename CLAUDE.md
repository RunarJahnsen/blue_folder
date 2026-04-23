# Blå perm — prosjektkontekst for Claude Code

## Hva er dette?

En mobilvennlig webapp for digital allsang. En gruppe møtes fysisk og synger sammen. Appen løser problemet med å få alle til å finne samme sang, i samme versjon, i riktig rekkefølge — uten at folk må lete hver for seg.

Kjerneverdien: gruppen samles i et felles digitalt rom, ser samme sang samtidig i sanntid, bygger en delt kø, og kan gjenbruke sanger og oppsett fra tidligere samlinger.

---

## Teknisk stack

- **Vite + React** (ikke Next.js — ingen server components, ingen SSR)
- **React Router v6** for klient-side routing
- **Tailwind CSS**
- **shadcn/ui** — bruk eksisterende komponenter, ikke bygg egne fra bunnen
- **Supabase** — database, Realtime og auth (ingen auth i MVP)
- **Vercel** — hosting (via `vercel.json` med SPA-fallback)

Supabase-klient:
- Kun klient-side: `@supabase/supabase-js` med `createClient`
- Ingen server-klient — all datauthenting skjer i nettleseren

---

## Produktmodell og begreper

Disse begrepene brukes konsekvent i kode, kommentarer og filnavn:

### Group
Øverste nivå. Representerer én vennegjeng eller fast gruppe. Tilgang styres med en enkel `access_code`. All data tilhører en group. Ingen brukerlogin i MVP.

### Room
En konkret allsangsamling / kveld / hendelse. Har tittel, dato og status. Brukes til planlegging før, styring under, og historikk etter en samling.

Status: `planned` | `active` | `completed`

Mode (hvem kan legge til sanger):
- `host_only` — kun verten
- `suggest` — alle kan foreslå, vert godkjenner
- `open` — alle kan legge rett i kø

### Song
Den minste gjenbrukbare enheten. Har tittel og URL til en konkret versjon av sangen (f.eks. en Genius-side). Tilhører en group.

### RoomSongEntry
Representerer én sang inne i ett spesifikt rom. Har en `state` som styrer flyten:

`suggested` → `queued` → `current` → `played`

(eller `removed` på et hvilket som helst tidspunkt)

### Favorite
Felles for hele gruppa (ikke personlig i MVP). Kobler en group til en song.

---

## Datamodell

```
Group
  id, name, access_code, created_at

Room
  id, group_id, title, date
  status: planned | active | completed
  mode: host_only | suggest | open
  current_queue_item_id (FK → RoomSongEntry)
  join_code, created_at, updated_at

Song
  id, group_id, title, url, source_label
  created_at, updated_at

RoomSongEntry
  id, group_id, room_id, song_id
  state: suggested | queued | current | played | removed
  position, added_by_session_id
  added_at, started_at, played_at, removed_at

Favorite
  id, group_id, song_id, created_at
```

Alle tabeller har `group_id`. Dette er bevisst — gjør fremtidig multi-group-støtte mulig uten omskriving.

---

## Viktige regler

### Generelt
- Spør alltid om avklaring hvis oppgaven er uklar — ikke gjett
- Gjør én ting om gangen. Ikke kombiner flere features i én implementering
- Commit jevnlig med beskrivende meldinger

### Design
- **Ikke redesign uten eksplisitt instruksjon.** Designkonsistens er viktigere enn å være fancy
- Appen heter **Blå perm** og har en blå designprofil
- Primary-farge er blå — bruk én blå hovedfarge konsekvent gjennom hele appen
- Mobil først. Alle flater skal fungere på 375px bredde
- Bruk shadcn/ui-komponenter: Card, Badge, Dialog, Sheet, Tabs, Button
- Lite fargepalett, nøytral bakgrunn
- Store trykkflater, tydelig typografi

### Sanntid
- Sanntid er en kjernefeature, ikke pynt
- Bruk Supabase Realtime-subscriptions på `rooms` og `room_song_entries`
- Alle klienter i et rom skal automatisk oppdateres når: aktiv sang endres, ny sang legges til, forslag godkjennes, romstatus endres

### Datamodell
- Alltid `group_id` på alle records — ingen unntak
- Bruk `RoomSongEntry.state` for å skille mellom suggested/queued/current/played/removed
- Soft deduplicering: sjekk om URL finnes i group før ny Song opprettes

### Vertsstyring uten login
- Vert identifiseres med `session_id` lagret i `localStorage`
- `session_id` genereres én gang og gjenbrukes
- Det er en kjent begrensning at vertskapet kan gå tapt ved lukking av nettleser — dette er akseptabelt i MVP

---

## Arbeidsmåte

Når du får en ny oppgave:

1. **Analyser først** — beskriv hva du planlegger å gjøre, hvilke filer du vil endre, og eventuelle avveininger. Ikke implementer ennå.
2. **Vent på godkjenning** — avslutt analysen med `WAITING FOR APPROVAL`
3. **Implementer** — først etter eksplisitt godkjenning

Implementer aldri uten godkjent plan, med mindre vi eksplisitt sier at du kan gå rett til implementering.

---

## Mappestruktur (anbefalt)

```
src/
  main.tsx                # Entry point
  App.tsx                 # Router-oppsett
  pages/
    GroupAccess.tsx       # Group access / innlogging med kode
    RoomList.tsx          # Room-oversikt for en group
    RoomNew.tsx           # Opprett rom
    RoomView.tsx          # Room-siden (hoved-UI)
  components/
    room/                 # Room-spesifikke komponenter
    song/                 # Song/legg-til-komponenter
    ui/                   # shadcn-komponenter (auto-generert)
  lib/
    supabase.ts           # Supabase-klient (createClient)
    types.ts              # TypeScript-typer fra datamodellen
    utils.ts
  hooks/
    useRoom.ts            # Realtime-hook for room-data
    useSession.ts         # session_id fra localStorage
```

---

## Hva som ikke er med i MVP

- Ingen brukerlogin
- Ingen personlige favoritter
- Ingen innebygget nettleser / iframe for å vise sanger
- Ingen avansert "kanonisk sang med flere versjoner"
- Ingen cross-group-funksjonalitet
- Ingen full produktisering

MVP skal være enkel, fungerende og testbar for én gruppe.