# Blå folder — prosjektkontekst for Claude Code

## Hva er dette?

En mobilvennlig webapp for digital allsang. En gruppe møtes fysisk og synger sammen. Appen løser problemet med å få alle til å finne samme sang, i samme versjon, i riktig rekkefølge — uten at folk må lete hver for seg.

Kjerneverdien: gruppen samles i en felles digital folder, ser samme sang samtidig i sanntid, bygger en delt kø, og kan gjenbruke sanger og oppsett fra tidligere samlinger.

---

## Teknisk stack

- **Vite + React** (ikke Next.js — ingen server components, ingen SSR)
- **React Router v6** for klient-side routing
- **Tailwind CSS v3** (ikke v4 — inkompatibel med shadcn/ui)
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

### Folder
En konkret allsangsamling / kveld / hendelse. Har tittel, dato og status. Brukes til planlegging før, styring under, og historikk etter en samling.

Status: `planned` | `active` | `completed`

Mode (hvem kan legge til sanger):
- `host_only` — kun verten
- `suggest` — alle kan foreslå, vert godkjenner
- `open` — alle kan legge rett i kø

### Song
Den minste gjenbrukbare enheten. Har tittel og URL til en konkret versjon av sangen (f.eks. en Genius-side). Tilhører en group.

### FolderSongEntry
Representerer én sang inne i én spesifikk folder. Har en `state` som styrer flyten:

`suggested` → `queued` → `current` → `played`

(eller `removed` på et hvilket som helst tidspunkt)

### Favorite
Felles for hele gruppa (ikke personlig i MVP). Kobler en group til en song.

---

## Datamodell

```
Group
  id, name, access_code, created_at

Folder
  id, group_id, title, date
  status: planned | active | completed
  mode: host_only | suggest | open
  current_queue_item_id (FK → FolderSongEntry)
  host_session_id, join_code, created_at, updated_at

Song
  id, group_id, title, url, source_label
  created_at, updated_at

FolderSongEntry
  id, group_id, folder_id, song_id
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
- Primærfarge er `sky-500` (oklch(0.685 0.169 237.323)) — konsekvent gjennom hele appen
- Mobil først. Alle flater skal fungere på 375px bredde
- Lite fargepalett, nøytral bakgrunn (`bg-gray-50`), hvite kort

**Knapper:**
- Badge-inspirert stil — `rounded-full`, `text-xs font-semibold`, kompakt padding
- Primary = sky-500, hvit tekst
- Secondary/outline = slate-100, mørk tekst
- Ingen border på noen knapper (`border-0` i base)
- Ikonknapper (f.eks. favoritt-hjerte): kun ikonet, ingen ramme, ingen bakgrunn, ingen padding-boks

**Kort:**
- `rounded-2xl`, `shadow-sm`, ingen synlig border
- Lister med sang-rader: lett separator mellom rader, ingen Card-ramme per rad

**Inputfelt og dropdowns:**
- Native `<select>` for alle dropdowns (shadcn Select fungerer dårlig på mobil)
- Stil: `bg-white`, `rounded-xl`, `shadow-sm`, `border-0`, `px-3 py-2`, `text-sm`, `focus:ring-sky-500`

**Badges:**
- `rounded-full`, `text-xs font-semibold`
- Planned = grå, Active = sky-100/sky-700, Completed = grønn-100/grønn-700

**Seksjoner:**
- "Live nå" har `bg-sky-50` bakgrunn
- shadcn/ui-komponenter: Card, Badge, Dialog, Sheet, Button — CSS-variabler justeres i index.css, ikke komponentfilene

### Sanntid
- Sanntid er en kjernefeature, ikke pynt
- Bruk Supabase Realtime-subscriptions på `folders` og `folder_song_entries`
- Alle klienter i en folder skal automatisk oppdateres når: aktiv sang endres, ny sang legges til, forslag godkjennes, permstatus eller mode endres

### Datamodell
- Alltid `group_id` på alle records — ingen unntak
- Bruk `FolderSongEntry.state` for å skille mellom suggested/queued/current/played/removed
- Soft deduplicering: sjekk om URL finnes i group før ny Song opprettes

### Vertsstyring uten login
- Vert identifiseres med `session_id` lagret i `localStorage`
- `host_session_id` lagres på `folders`-tabellen ved opprettelse
- `isHost = folder.host_session_id === sessionId`
- `showHostControls = folder.mode === 'open' || isHost`
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
    FolderList.tsx        # Folder-oversikt for en group
    FolderNew.tsx         # Opprett perm
    FolderView.tsx        # Folder-siden (hoved-UI)
  components/
    AddSongModal.tsx      # Modal for å legge til sang
    ui/                   # shadcn-komponenter (auto-generert)
  lib/
    supabase.ts           # Supabase-klient (createClient)
    types.ts              # TypeScript-typer fra datamodellen
    utils.ts
  hooks/
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