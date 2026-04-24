# Backlog — Blå perm

Prioritert etter vertikale slices. Hver slice er en komplett leveranse som går gjennom UI, data, logikk og (der relevant) sanntid.

---

## Slice 1 — Fundament og group access ✅

Mål: Prosjektet er oppe på Vercel, koblet til Supabase, og en bruker kan taste inn en access code og komme inn i riktig group.

### Tasks

- [x] Sett opp Supabase-skjema med alle fem tabeller (Group, Perm, Song, PermSongEntry, Favorite)
- [x] Legg til Row Level Security (deaktivert for nå, men strukturen er på plass)
- [x] Definer TypeScript-typer manuelt i `src/lib/types.ts` basert på datamodellen
- [x] Sett opp Supabase-klient i `src/lib/supabase.ts` med `createClient`
- [x] Sett opp React Router med ruter for `/`, `/:groupId`, `/:groupId/perms/new`, `/:groupId/perms/:roomId`
- [x] Legg til `vercel.json` med SPA-fallback så direktelenker til perm fungerer
- [x] Seed én test-group med access code i Supabase
- [x] Bygg group access-side (`/`): inputfelt for access code, validering mot Supabase, redirect til `/{groupId}` ved treff
- [x] Lagre `groupId` i `localStorage` så brukeren slipper å taste koden igjen
- [x] Generer og lagre `session_id` i `localStorage` (brukes som anonym vert-identifikator)
- [x] Deploy til Vercel og verifiser at miljøvariabler fungerer

---

## Slice 2 — Perm-oversikt og opprettelse ✅

Mål: Brukeren kan se alle perm for sin group og opprette et ny perm.

### Tasks

- [x] Bygg perm-oversiktsside (`/{groupId}`): vis perm delt i tre seksjoner (Aktive, Kommende, Tidligere)
- [x] Perm-kort viser: tittel, dato, status-badge
- [x] Bygg "Opprett rom"-side (`/{groupId}/perms/new`):
  - Tittel (required)
  - Dato (required, native date input)
  - Mode: host_only | suggest | open (velges med radio/select)
  - Status settes til `planned` automatisk
- [x] Lagre nytt perm i Supabase med korrekt `group_id`
- [x] Redirect til perm-siden etter opprettelse

### Akseptansekriterier
- Tre seksjoner vises korrekt basert på `status`
- Tomt state (ingen rom) vises pent
- Skjema validerer required felter før submit
- Fungerer på mobil

---

## Slice 3 — Perm-siden (struktur og statisk data)

Mål: Perm-siden viser all relevant informasjon hentet fra Supabase, uten sanntid ennå.

### Tasks

- [ ] Bygg perm-side (`/{groupId}/perms/:roomId`):
  - Header: tittel, dato, status-badge, mode
  - Seksjon "Live nå": viser `current` PermSongEntry (sang + URL)
  - Seksjon "Kø": viser alle `queued` entries i rekkefølge
  - Seksjon "Forslag": viser alle `suggested` entries (kun synlig i suggest-mode)
  - Seksjon "Spilt": viser alle `played` entries
- [ ] Hent data med Supabase-klienten
- [ ] Vis tomt state pent for hver seksjon

### Akseptansekriterier
- Alle fire seksjoner vises med riktige data
- "Live nå" er visuelt tydelig skilt fra resten
- Lenke til sang-URL åpner i ny fane
- Fungerer på mobil

---

## Slice 4a — Legg til sanger

Mål: Brukeren kan legge til sanger i permen via URL, med soft deduplicering.

### Tasks

- [ ] Bygg "Legg til sang"-modal/sheet:
  - URL-inputfelt
  - Tittel-felt (skrives inn manuelt)
  - Sjekk om URL allerede finnes i group (soft deduplicering) — vis forslag om gjenbruk hvis ja
  - Opprett ny `Song` hvis URL ikke finnes fra før
  - Opprett `PermSongEntry` med riktig state basert på perm mode:
    - `host_only`: kun vert kan legge til → state `queued`
    - `suggest`: state `suggested`
    - `open`: state `queued`

### Akseptansekriterier
- Legg til sang fungerer i alle tre modes
- Soft deduplicering vises korrekt
- Fungerer på mobil

---

## Slice 4b — Kø-logikk og vertsstyring

Mål: Verten kan styre køen og flytte sanger mellom states.

### Tasks

- [ ] Vert kan godkjenne forslag (suggested → queued)
- [ ] Vert kan fjerne forslag (suggested → removed)
- [ ] Vert kan trykke "Spill neste":
  - Nåværende `current` → `played`
  - Neste `queued` (lavest position) → `current`
  - `perm.current_queue_item_id` oppdateres
- [ ] Vert kan sette perm til `active` (fra `planned`)
- [ ] Vert kan sette perm til `completed` (fra `active`)
- [ ] Vert-sjekk basert på `session_id` i `localStorage`
- [ ] Vert-handlinger er ikke synlige for ikke-verter (i host_only og suggest)

### Akseptansekriterier
- "Spill neste" oppdaterer state korrekt i Supabase
- Vert-handlinger er skjult for ikke-verter
- Fungerer på mobil

---

## Slice 4c — Sanntid

Mål: Alle i permen ser samme sang samtidig uten å måtte refreshe.

Sanntid bygges inn her fordi kø-logikk og sanntid er to sider av samme sak — det gir ingen mening å teste kø-logikk uten å verifisere at endringer synkroniseres mellom klienter.

### Tasks

- [ ] Sett opp Supabase Realtime-subscription på `perms` (filtrer på `perm_id`)
- [ ] Sett opp Realtime-subscription på `perm_song_entries` (filtrer på `perm_id`)
- [ ] Oppdater UI automatisk når:
  - `current_queue_item_id` endres (ny aktiv sang)
  - Ny entry legges til i kø
  - Entry endrer state (f.eks. forslag godkjennes)
  - Perm status endres
- [ ] Håndter subscription cleanup ved unmount

### Akseptansekriterier
- To nettlesere åpne i samme rom: endring i én vises i den andre innen ~1 sekund
- Ingen full-page reload nødvendig
- Fungerer på mobil med dårlig nett (graceful degradation)

---

## Slice 5 — Historikk og kopiering av perm

Mål: Brukeren kan se historikk fra avsluttede perm og bruke dem som utgangspunkt for nye.

### Tasks

- [ ] Vis fullstendige "Spilt"-lister på completed perms
- [ ] Bygg "Kopier rom"-flyt i opprett-rom-siden:
  - Valg: Lag nytt fra scratch ELLER kopier eksisterende
  - Hvis kopiering: vis liste over tidligere perm å velge fra
  - Velg kopieringsstrategi:
    - `all` — kopier alle sanger (spilte + ikke spilte)
    - `played_only` — kopier kun spilte sanger
    - `remaining_only` — kopier kun sanger som ikke ble spilt
- [ ] Implementer kopieringslogikk:
  - Opprett nytt Perm med `planned`, ny dato, kopiert tittel som utgangspunkt
  - Kopier valgte RoomSongEntries som `queued` med bevart `position`
  - Ikke kopier: gammel status, current, suggestions, timestamps

### Akseptansekriterier
- Alle tre kopieringsstrategier fungerer korrekt
- Nytt perm starter alltid som `planned`
- Kopiering tar ikke med live-tilstand fra kildepermen

---

## Slice 6 — Favoritter

Mål: Gruppa kan lagre favoritter og bruke dem når de legger til sanger.

### Tasks

- [ ] Vis "Legg til favoritt"-knapp på sanger i kø og historikk
- [ ] Lagre/fjern favoritter i Supabase (toggle)
- [ ] Vis favoritt-tab/seksjon i "Legg til sang"-modalen
- [ ] Fra favoritter: legg rett i kø eller forslag (avhengig av perm mode)
- [ ] Vis visuell indikasjon på sanger som allerede er favoritter

### Akseptansekriterier
- Favoritter er felles for hele gruppa
- En sang kan ikke legges til som favoritt to ganger
- Favoritt-listen vises i "Legg til sang"-flyten

---

## Senere forbedringer (ikke i MVP)

- Nylig brukte sanger i "Legg til sang"-modal
- Auto-utfyll av tittel fra URL (Open Graph / metatags)
- Drag-and-drop for å sortere køen
- Visningsnavn ("lagt til av X") uten full login
- Bedre mobiloptimalisering og PWA-støtte

## Fremtidig produktisering (ikke nå)

- Brukerlogin
- Personlige favoritter
- Flere grupper med full isolasjon
- Bedre sangbibliotek med flere versjoner per sang
- Lagre sangtekst og besifring i Supabase (gjør sanger uavhengige av ekstern URL)
- Integrasjoner (Spotify, YouTube, Genius)