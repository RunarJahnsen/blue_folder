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
- Ultimate Guitar blokkerer med 403 (bot-beskyttelse) — samme problem som Genius. Krever headless browser. Utsatt.
- Nortabs er eneste kilde som fungerer stabilt per nå
- Kan kreve manuell inntasting av innhold som fallback

---

## Slice 8 — Bedre sanginnlegging

### Slice 8a — Sangtekst-input og sangbibliotek

Mål: Brukeren kan legge til sanger ved å lime inn sangtekst direkte, og kan søke i alle tidligere sanger i gruppa.

#### Sangtekst-input
I "Legg til sang"-modalen kan brukeren velge mellom to inputmåter:
- **URL** (eksisterende flyt): URL + tittel + artist (valgfritt)
- **Sangtekst**: tittel (required) + artist (valgfritt) + stort textarea for sangtekst (required). Ingen URL nødvendig.

Ved sangtekst-valg:
- Ingen URL-deduplicering eller tittel-match — opprett alltid ny Song
- `url` settes til tom streng eller null
- `content` settes til teksten som skrives inn
- Samme `createFolderSongEntry`-logikk som ved URL-flyt

#### Sangbibliotek-fane
Ny fane i AddSongModal ("Alle sanger") ved siden av "Favoritter". Viser alle sanger i gruppa med søk på artist, tittel og innhold (`songs.content`). Klikk legger sangen til i permen — samme logikk som favoritter-fanen.

### Tasks
- [x] Legg til inputmåte-toggle i URL-fanen ("URL" / "Sangtekst")
- [x] Bygg sangtekst-flyt: tittel + artist + textarea, opprett Song med content satt
- [x] Legg til "Alle sanger"-fane i AddSongModal
- [x] Hent alle sanger for gruppa med søk på artist, tittel og content
- [x] Klikk på sang i biblioteket legger til i permen
- [x] Søk i favoritter-fanen (artist, tittel, tekst)

---

### Slice 8b — Redigering og sletting ✅

Mål: Brukeren kan redigere og slette permer og sanger, samt fjerne sanger fra køen.

#### Tasks
- [x] **Rediger perm**: vert og admin kan endre tittel og dato på en eksisterende perm
- [x] **Slett perm**: vert og admin kan slette en perm permanent. Sletter også alle tilhørende FolderSongEntries.
- [x] **Fjern sang fra kø**: vert (og alle i open-mode) kan fjerne en sang fra køen — setter state til `removed`
- [x] **Rediger sang**: fra sangoversikten kan man endre tittel, artist, URL og sangtekst

---

### Slice 8c — Tagging av sanger ✅

Mål: Brukeren kan tagge sanger med egendefinerte tagger for organisering og søk.

#### Tasks
- [x] Datamodell for tagger (tags + song_tags tabeller)
- [x] Legg til/fjern tagger på sang i sangoversikten
- [x] "+" knapp for å legge til tag uten Enter
- [x] Autocomplete på eksisterende tagger i gruppa
- [x] Vis tagger som badges i sangoversikten
- [x] Filtrer på tagger i sangoversikten
- [x] Filtrer på tagger i "Alle sanger"-fanen i AddSongModal
- [x] Filtrer på tagger i "Favoritter"-fanen i AddSongModal

---

## Slice 9 — Brukeradmin og tilgangsstyring

Mål: Appen har et skikkelig brukersystem med roller, slik at tilgang styres per bruker og ikke per session_id.

### Bakgrunn og designbeslutninger

**Tre brukertyper:**
- **Bruker med admin-rolle** — full tilgang til alt i gruppa. Kan opprette og endre alle permer, invitere gjester, og administrere andre brukere. Admin er en rolle på brukeren, ikke en egen brukertype — det kan være flere admins per gruppe.
- **Bruker med member-rolle** — kan se alle permer i gruppa og opprette egne permer. Kan ikke endre andres permer (med mindre permen er i suggest- eller open-mode). Eier av permen har vert-rolle i sin egen perm.
- **Gjest** — invitert via lenke eller kode knyttet til én spesifikk perm. Trenger ikke logge inn. Følger permens mode-regler (host_only/suggest/open). Kan ikke se andre permer i gruppa.

**Autentisering:**
- Supabase Auth brukes for brukere (admin og member)
- Brukere registreres med brukernavn + passord. E-post brukes internt som `brukernavn@[gruppe].intern` — aldri synlig for brukeren
- En bruker kan tilhøre flere grupper med ulike roller
- Gjester bruker fortsatt session_id-konseptet, men eksplisitt knyttet til én perm via invitasjonskode

**Ny tabell: `group_members`**
```
group_members
  id, user_id (FK → auth.users), group_id, role: admin | member, created_at
```

**Hva erstattes:**
- `access_code` på `groups` erstattes av brukerlogin
- `host_session_id` på `folders` erstattes av eier-konsept (den som opprettet permen)
- All eksisterende data behandles som testdata og kan nullstilles

---

### Slice 9a — Supabase Auth og brukerregistrering ✅

Mål: Brukere kan registrere seg og logge inn. Admin kan opprette nye brukere i gruppa.

#### Tasks
- [x] Aktiver Supabase Auth i prosjektet
- [x] Opprett `group_members`-tabellen med `user_id`, `group_id`, `role`
- [x] Bygg login-side (`/login`): brukernavn + passord, logger inn med Supabase Auth
- [x] Bygg registreringsflyt for admin: opprett ny bruker med brukernavn + passord + rolle, knytt til gruppe
- [x] Lagre bruker-session via Supabase Auth (ikke localStorage)
- [x] Redirect til gruppevalg etter login hvis brukeren tilhører flere grupper
- [x] Redirect til gruppens perm-oversikt etter login hvis brukeren kun tilhører én gruppe
- [x] Logg ut-funksjon
- [x] Slett GroupAccess-siden (`access_code`-feltet beholdes til 9b)

#### Teknisk detalj
Supabase Auth bruker e-post som primær identifikator. Vi bruker `brukernavn@intern` internt — brukernavn er unikt globalt i hele appen. Passordet håndteres av Supabase (bcrypt, salting — ingen manuell håndtering). Brukeroppretting skjer via Edge Function `create-user` med service role key.

#### Bugfikser etter implementering
- Supabase query-builder blokkerte alle REST-kall etter auth-initialisering → erstattet med rå `fetch()` i FolderView, FolderNew og AuthContext
- `isLoading` ble aldri satt til `false` ved page refresh → fikset i `onAuthStateChange` (alle paths kaller nå `setIsLoading(false)`)
- Deadlock i `fetchMemberships`: intern `getSession()`-kall inne i auth-callback → token sendes nå inn som parameter

---

### Slice 9b — Tilgangsstyring per perm basert på brukerrolle ✅

Mål: Tilgang til permer og handlinger styres av brukerrolle, ikke session_id.

#### Tasks
- [x] Legg til `owner_user_id` (FK → auth.users) på `folders`-tabellen — settes ved opprettelse
- [x] Fjern `host_session_id` fra `folders`
- [x] Oppdater `isHost`-logikk: bruker er vert hvis `folder.owner_user_id === currentUser.id` ELLER bruker har admin-rolle i gruppa
- [x] Admin-brukere har alltid vert-tilgang i alle permer i gruppa
- [x] Member-brukere har vert-tilgang kun i sine egne permer
- [x] Oppdater `showHostControls` tilsvarende
- [x] Legg til Row Level Security (RLS) i Supabase for å håndheve tilgang på database-nivå

---

### Slice 9c — Gjesteinvitasjon

Mål: Admin og permens eier kan invitere gjester til én spesifikk perm via lenke eller kode.

#### Tasks
- [ ] Legg til `guest_code` (TEXT, nullable, unik) på `folders`-tabellen
- [ ] Admin/eier kan generere gjestekode for en perm — vises som kopiérbar lenke (`/join/[kode]`)
- [ ] Bygg join-side (`/join/:guestCode`): validerer kode mot Supabase, gir tilgang til riktig perm
- [ ] Gjest lagres som session_id i localStorage — eksplisitt markert som gjest for denne permen
- [ ] Gjest følger permens mode-regler (host_only/suggest/open)
- [ ] Gjest kan ikke se andre permer i gruppa
- [ ] Admin/eier kan deaktivere gjestekode (setter `guest_code` til null)

---

## Slice 10 — Polering og stabilitet

Mål: Appen er stabil, ryddig og fungerer godt på mobil. Køen kan sorteres med drag-and-drop, og sanger kan legges til i bulk.

### Tasks
- [ ] Slettetilgang for sanger — kun oppretteren (matched på added_by) og admin kan slette sanger fra sangoversikten
- [ ] Rydd opp position-verdier — renumerer alle entries fra 1 etter "Spill som neste"-operasjoner for å unngå svært negative tall (se NOTATER.md)
- [ ] Drag-and-drop for å sortere køen — erstatter/supplerer "Spill som neste" og "Flytt nederst". Krever renumerering av position-verdier etter drop.
- [ ] Flervalgsmodus i AddSongModal — i "Favoritter"- og "Alle sanger"-fanene kan man velge flere sanger samtidig og legge dem alle til i køen i én operasjon
- [ ] Vis innlogget bruker i header — f.eks. "Hei Jon!" eller brukernavn synlig på perm-oversikten
- [ ] Vis eier-indikasjon på perm-kort i oversikten — tydelig markering av hvilke permer brukeren selv eier
- [ ] AddSongModal åpner Favoritter-fanen som default, ikke URL-input
- [ ] TypeScript-opprydding — fjern gjenværende `any`-caster og løse typer
- [ ] Gjennomgang av mobiloptimalisering — test alle flater på 375px, juster spacing og trykkflater der nødvendig

---

## Slice 11 — Sangstatistikk

Mål: Gruppa kan se statistikk på sangene sine — hvilke sanger som er mest populære, sist spilt og totalt antall ganger spilt.

### Tasks
- [ ] Beregn antall ganger spilt per sang (tell `FolderSongEntry` med `state = 'played'` per `song_id`)
- [ ] Vis sist spilt-dato per sang
- [ ] Vis statistikk i sangoversikten (`/:groupId/songs`) — sortérbar på antall ganger spilt
- [ ] Vis "mest spilte sanger"-seksjon på perm-oversikten (topp 5)

---

## Slice 12 — Utvidet sanginnhenting

Mål: Sangtekst og besifring kan hentes automatisk fra flere kilder.

### Tasks
- [ ] Sett opp ekstern Node.js-tjeneste (f.eks. Railway eller Fly.io) med Puppeteer for headless browser-scraping
- [ ] Legg til Genius-støtte via headless browser eller offisiell Genius API
- [ ] Legg til Ultimate Guitar-støtte via headless browser
- [ ] Auto-utfyll av tittel og artist fra URL via Open Graph / metatags når sang legges til

---

## Slice 13 — Personlige favoritter

Mål: Brukere kan lagre egne favoritter, atskilt fra gruppas felles favoritter.

Forutsetter Slice 9 (brukerlogin).

### Tasks
- [ ] Legg til `user_id` på `favorites`-tabellen (eller ny tabell `user_favorites`)
- [ ] Skille mellom gruppefavoritter og personlige favoritter i UI
- [ ] Bruker kan lagre/fjerne egne favoritter
- [ ] Personlige favoritter vises i AddSongModal

---

## Fremtidig produktisering (ikke prioritert)

- E-post-basert brukerregistrering
- Integrasjoner (Spotify, YouTube)
- Flere grupper med full isolasjon per bruker
- Bedre sangbibliotek med flere versjoner per sang