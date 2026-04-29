# Backlog — Blå perm

Prioritert etter vertikale slices. Hver slice er en komplett leveranse som går gjennom UI, data, logikk og (der relevant) sanntid.

---

## Slice 1 — Fundament og group access ✅

Mål: Prosjektet er oppe på Vercel, koblet til Supabase, og en bruker kan taste inn en access code og komme inn i riktig group.

### Tasks

- [x] Sett opp Supabase-skjema med alle fem tabeller (Group, Folder, Song, FolderSongEntry, Favorite)
- [x] Legg til Row Level Security (deaktivert for nå, men strukturen er på plass)
- [x] Definer TypeScript-typer manuelt i `src/lib/types.ts` basert på datamodellen
- [x] Sett opp Supabase-klient i `src/lib/supabase.ts` med `createClient`
- [x] Sett opp React Router med ruter for `/`, `/:groupId`, `/:groupId/folders/new`, `/:groupId/folders/:folderId`
- [x] Legg til `vercel.json` med SPA-fallback så direktelenker til permer fungerer
- [x] Seed én test-group med access code i Supabase
- [x] Bygg group access-side (`/`): inputfelt for access code, validering mot Supabase, redirect til `/{groupId}` ved treff
- [x] Lagre `groupId` i `localStorage` så brukeren slipper å taste koden igjen
- [x] Generer og lagre `session_id` i `localStorage` (brukes som anonym vert-identifikator)
- [x] Deploy til Vercel og verifiser at miljøvariabler fungerer

---

## Slice 2 — Perm-oversikt og opprettelse ✅

Mål: Brukeren kan se alle permer for sin group og opprette en ny perm.

### Tasks

- [x] Bygg perm-oversiktsside (`/{groupId}`): vis permer delt i tre seksjoner (Aktive, Kommende, Tidligere)
- [x] Perm-kort viser: tittel, dato, status-badge
- [x] Bygg "Opprett perm"-side (`/{groupId}/folders/new`):
  - Tittel (required)
  - Dato (required, native date input)
  - Mode: host_only | suggest | open (velges med radio/select)
  - Status settes til `planned` automatisk
- [x] Lagre ny perm i Supabase med korrekt `group_id`
- [x] Redirect til perm-siden etter opprettelse

---

## Slice 3 — Perm-siden (struktur og statisk data) ✅

Mål: Perm-siden viser all relevant informasjon hentet fra Supabase, uten sanntid ennå.

### Tasks

- [x] Bygg perm-side (`/{groupId}/folders/:folderId`):
  - Header: tittel, dato, status-badge, mode
  - Seksjon "Live nå": viser `current` FolderSongEntry (sang + URL)
  - Seksjon "Kø": viser alle `queued` entries i rekkefølge
  - Seksjon "Forslag": viser alle `suggested` entries (kun synlig i suggest-mode)
  - Seksjon "Spilt": viser alle `played` entries
- [x] Hent data med Supabase-klienten
- [x] Vis tomt state pent for hver seksjon

---

## Slice 3.5 — Design ✅

Mål: Appen har en konsistent designprofil før vi bygger videre på funksjonalitet.

### Designbeslutninger
- **Primærfarge**: `sky-500` (oklch(0.685 0.169 237.323)) — satt som `--primary` i index.css
- **Stil**: Minimalistisk og nordisk — lys bakgrunn, mye whitespace, ingen unødvendige borders
- **Knapper**: Badge-inspirert stil — `rounded-full`, `text-xs font-semibold`, kompakt padding. Primary = sky-500 hvit tekst. Secondary = slate-100 mørk tekst. Ingen border på noen knapper (`border-0` i base)
- **Badges**: `rounded-full`, `text-xs font-semibold`. Planned=grå, Active=sky-100/sky-700, Completed=grønn-100/grønn-700
- **Inputfelt**: `bg-white`, `rounded-xl`, `shadow-sm`, `border-0`, blå focus-ring (`ring-sky-500`)
- **Kort**: `rounded-2xl`, `shadow-sm`, ingen synlig border
- **Lukkeknapp (Sheet)**: `rounded-full`, `p-2`, slate-100 hover
- **Komponenter**: shadcn/ui gjennomgående — CSS-variabler justeres i index.css, ikke komponentfilene

### Tasks

- [x] Definer `sky-500` som primærfarge i CSS-variabler (`--primary` i index.css)
- [x] Oppdater alle knapper til badge-inspirert stil med sky-500 primærfarge
- [x] Oppdater badges med meningsfulle farger (planned=grå, active=sky, completed=grønn)
- [x] "Live nå"-seksjonen har sky-50 bakgrunn
- [x] Konsistent typografi og spacing på tvers av alle sider
- [x] Gjennomgå og rydd opp GroupAccess, FolderList, FolderNew og FolderView
- [x] Inputfelt oppdatert til hvit bakgrunn, rounded-xl, shadow-sm, ingen border
- [x] Lukkeknapp i Sheet oppdatert til rounded-full badge-stil

---

## Slice 4a — Legg til sanger ✅

Mål: Brukeren kan legge til sanger i permen via URL, med soft deduplicering på både URL og tittel.

### Tasks

- [x] Bygg "Legg til sang"-modal/sheet med URL og tittel-inputfelt
- [x] Soft deduplicering på URL — vis forslag om gjenbruk hvis URL finnes fra før
- [x] Soft deduplicering på tittel (case-insensitive) — vis forslag hvis tittel finnes med annen URL
- [x] Opprett ny `Song` hvis URL ikke finnes fra før
- [x] Opprett `FolderSongEntry` med riktig state basert på folder mode:
  - `host_only`: kun vert kan legge til → state `queued`
  - `suggest`: state `suggested`
  - `open`: state `queued`

---

## Slice 4b — Kø-logikk og vertsstyring ✅

Mål: Verten kan styre køen og flytte sanger mellom states.

### Tasks

- [x] Vert kan godkjenne forslag (suggested → queued)
- [x] Vert kan fjerne forslag (suggested → removed)
- [x] Vert kan trykke "Spill neste":
  - Nåværende `current` → `played`
  - Neste `queued` (lavest position) → `current`
  - `folder.current_queue_item_id` oppdateres
- [x] Vert kan sette perm til `active` (fra `planned`)
- [x] Vert kan sette perm til `completed` (fra `active`)
- [x] Vert-sjekk basert på `session_id` i `localStorage`
- [x] Vert-handlinger er ikke synlige for ikke-verter (i host_only og suggest)
- [x] Tilbakeknapp i header (navigerer til perm-oversikten)
- [x] Tilbakeknapp i "Opprett perm"-siden (navigerer til perm-oversikten)
- [x] Fri statusvelger — vert kan sette status fritt (planned, active, completed)
- [x] Modus-velger — vert kan endre folder mode fritt (host_only, suggest, open)
- [x] Badges fjernes fra header for vert — erstattes av statusvelger og modus-velger
- [x] Hele perm-kortet i oversikten er klikkbart (ikke bare "Åpne"-knappen)
- [x] "Spill nå"-knapp på sanger i kø og historikk — flytter valgt sang til `current`, nåværende `current` → `played`
- [x] "Spill som neste"-knapp på sanger i kø og historikk — flytter valgt sang til posisjon 0 i køen
- [x] "Flytt nederst"-knapp på sanger i kø og historikk — flytter valgt sang til bunnen av køen
- [x] FAB-knappen ("+") skjult for ikke-verter i host_only mode

### Tilgangsstyring per mode
- `host_only`: kun vert kan legge til sanger, godkjenne, og styre avspilling
- `suggest`: andre kan foreslå sanger; vert styrer "Spill neste", "Spill nå" og køstyring
- `open`: alle har tilgang til alle handlinger inkl. avspillingsstyring

---

## Slice 4c — Sanntid ✅

Mål: Alle i permen ser samme sang samtidig uten å måtte refreshe.

Sanntid bygges inn her fordi kø-logikk og sanntid er to sider av samme sak — det gir ingen mening å teste kø-logikk uten å verifisere at endringer synkroniseres mellom klienter.

### Tasks

- [x] Sett opp Supabase Realtime-subscription på `folders` (filtrer på `folder_id`)
- [x] Sett opp Realtime-subscription på `folder_song_entries` (filtrer på `folder_id`)
- [x] Oppdater UI automatisk når:
  - `current_queue_item_id` endres (ny aktiv sang)
  - Ny entry legges til i kø
  - Entry endrer state (f.eks. forslag godkjennes)
  - Folder status eller mode endres
- [x] Håndter subscription cleanup ved unmount

### Akseptansekriterier
- To nettlesere åpne i samme perm: endring i én vises i den andre innen ~1 sekund
- Ingen full-page reload nødvendig
- Fungerer på mobil med dårlig nett (graceful degradation)

---

## Slice 5 — Historikk og kopiering av perm ✅

Mål: Brukeren kan se historikk fra avsluttede permer og bruke dem som utgangspunkt for nye.

### Tasks

- [x] Vis fullstendige "Spilt"-lister på completed permer
- [x] Bygg "Kopier perm"-flyt i opprett-perm-siden:
  - Valg: Lag ny fra scratch ELLER kopier eksisterende
  - Hvis kopiering: vis liste over tidligere permer å velge fra
  - Velg kopieringsstrategi:
    - `all` — kopier alle sanger (spilte + ikke spilte)
    - `played_only` — kopier kun spilte sanger
    - `remaining_only` — kopier kun sanger som ikke ble spilt
- [x] Implementer kopieringslogikk:
  - Opprett ny perm med `planned`, ny dato, kopiert tittel som utgangspunkt
  - Kopier valgte FolderSongEntries som `queued` med bevart `position`
  - Ikke kopier: gammel status, current, suggestions, timestamps

---

## Slice 6 — Favoritter ✅

Mål: Gruppa kan lagre favoritter og bruke dem når de legger til sanger.

### Tasks

- [x] Vis "Legg til favoritt"-knapp på sanger i kø og historikk
- [x] Lagre/fjern favoritter i Supabase (toggle)
- [x] Vis favoritt-tab/seksjon i "Legg til sang"-modalen
- [x] Fra favoritter: legg rett i kø eller forslag (avhengig av folder mode)
- [x] Vis visuell indikasjon på sanger som allerede er favoritter
- [x] Favoritt-oppdateringer synkroniseres i sanntid (Realtime på favorites-tabellen)

---

## Slice 7 — Sangvisning

Mål: Sanger vises direkte i appen i stedet for å åpne en ekstern lenke. Dette er kjernen i produktverdien — alle ser samme sang samtidig uten å forlate appen.

### Teknisk tilnærming

Når en sang legges til via URL, henter en Supabase Edge Function sangtekst og besifring fra kildesiden og lagrer det i Supabase. "Live nå"-seksjonen viser deretter innholdet direkte i appen.

### Tasks

- [x] Legg til `content`-felt (tekst) på `songs`-tabellen i Supabase
- [x] Bygg Supabase Edge Function som henter innhold fra URL (Nortabs + Ultimate Guitar)
- [x] Kall Edge Function automatisk når en ny sang legges til
- [x] Vis innhold fra `songs.content` i "Live nå"-seksjonen i stedet for ekstern lenke
- [x] Klikk på en sang i kø eller historikk åpner sangteksten/innholdet i appen (SongContentSheet)
- [x] Håndter fallback: hvis innhold ikke kunne hentes, vis lenke som før
- [x] Vis innhold på en lesbar måte: stor tekst, god linjehøyde, mobilvennlig
- [x] Legg til `artist`-felt på `songs`-tabellen — vises som "Artist — Tittel" i hele appen
- [x] Sangoversikt (`/:groupId/songs`) — vis alle sanger for gruppa med artist, tittel, URL og favoritt-indikasjon
- [x] Slett sang permanent fra sangoversikten (favorites → folder_song_entries → songs)


### Kjente utfordringer
- Nettsider har ulik struktur — scraping er ikke 100% pålitelig
- Ultimate Guitar har bot-beskyttelse — kan feile
- Kan kreve manuell inntasting av innhold som fallback

---

## Senere forbedringer (ikke i MVP)

- Genius-støtte for sangvisning — krever headless browser (f.eks. Puppeteer på Railway/Fly.io) eller Genius API med nøkkel. Genius blokkerer scraping fra Edge Functions med 403.
- Sangstatistikk (antall ganger spilt, sist spilt, mest populære) — vises i sangoversikten
- Nylig brukte sanger i "Legg til sang"-modal
- Auto-utfyll av tittel/artist fra URL (Open Graph / metatags)
- Drag-and-drop for å sortere køen
- Visningsnavn ("lagt til av X") uten full login
- Bedre mobiloptimalisering og PWA-støtte

## Fremtidig produktisering (ikke nå)

- Brukerlogin
- Personlige favoritter
- Flere grupper med full isolasjon
- Bedre sangbibliotek med flere versjoner per sang
- Integrasjoner (Spotify, YouTube, Genius)