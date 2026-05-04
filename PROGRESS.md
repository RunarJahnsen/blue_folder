# Progress

## Pågående oppgave
Slice 8c — Tagging av sanger. Egendefinerte tagger per gruppe for organisering og søk.

## Analyse

### 1. Datamodell — separate tabeller (ikke JSONB)

**Valg: `tags`-tabell + `song_tags`-koblingstabell.**

JSONB/TEXT[]-array på `songs` er enklere å implementere, men har to kritiske svakheter:
- Autocomplete-kravet krever en liste over alle tagger i gruppa. Med JSONB må man aggregere på tvers av alle sanger med `UNNEST` + `DISTINCT` — ineffektivt og klønete.
- Omdøping eller sletting av en tag globalt er ikke mulig uten å løpe gjennom alle sanger.

Med egne tabeller er det enkelt:
- `SELECT * FROM tags WHERE group_id = ?` gir alle tagger i gruppa — perfekt for autocomplete.
- `UNIQUE(group_id, name)` sikrer ingen duplikater.
- `group_id` på begge tabeller følger prosjektkonvensjonen.

**SQL (kjøres i Supabase SQL-editor):**
```sql
CREATE TABLE tags (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(group_id, name)
);

CREATE TABLE song_tags (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  song_id UUID NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  UNIQUE(song_id, tag_id)
);

CREATE INDEX idx_tags_group_id ON tags(group_id);
CREATE INDEX idx_song_tags_song_id ON song_tags(song_id);
CREATE INDEX idx_song_tags_tag_id ON song_tags(tag_id);
CREATE INDEX idx_song_tags_group_id ON song_tags(group_id);
```

**Datahenting:** Supabase-join i sangspørringen:
```ts
supabase.from('songs').select('*, song_tags(id, tag_id, tags(id, name))')
```

Ved lagring av tags:
1. Finn/opprett tagger i `tags`-tabellen (upsert med `onConflict: 'group_id,name'`)
2. Slett eksisterende `song_tags` for sangen
3. Sett inn nye `song_tags`-rader

---

### 2. UI-plassering — i rediger-sheeten i SongList

Tagging legges inn **i rediger-sheeten** (SongList.tsx), under de eksisterende feltene. Dette er det naturlige stedet siden det er der alle sangegenskaper redigeres.

I sanglisten vises tags som små badges/chips per sang-rad for oversikt.

Over sanglisten legges det til et tag-filter: klikk på en tag → vis bare sanger med den taggen. Flere tagger = union (ELLER), ikke intersection — enklere og mer nyttig i praksis.

I "Alle sanger"-fanen i AddSongModal: samme tag-filter-chips over listen for å begrense utvalget.

---

### 3. Autocomplete uten tunge biblioteker

**Enkel egenlaget løsning med React-state:**

1. Last alle gruppens tagger ved mount: `allTags: Tag[]`
2. I edit-sheeten: ett tekst-input-felt for ny tag
3. Mens brukeren skriver → `useMemo` filtrerer `allTags` på input-tekst, ekskluderer allerede valgte tagger
4. Forslag vises som klikkbare chips rett under inputfeltet (betinget rendering)
5. Klikk på forslag → legg til tag, tøm input
6. Enter → opprett ny tag hvis ingen eksakt match finnes, ellers velg første treff
7. Valgte tagger vises som chips med ×-knapp over inputfeltet

Ingen bibliotek nødvendig. Maks ~30 linjer logikk.

---

### Filer som endres/opprettes

| Fil | Endring |
|-----|---------|
| `supabase-schema.sql` | Legg til `tags`- og `song_tags`-tabeller med indekser |
| `src/lib/types.ts` | Legg til `Tag`, `SongTag`-interfaces og Database-mapping |
| `src/pages/SongList.tsx` | Tag-henting, badge-visning per sang, tag-filter, tag-editor i sheet |
| `src/components/AddSongModal.tsx` | Tag-filter i "Alle sanger"-fanen |

Ingen nye React-filer.

---

### Avveininger
- Tag-filter bruker ELLER-logikk (ikke OG) — enklere for MVP, dekker de fleste brukstilfeller
- Tags er ikke case-sensitive (normaliseres til lowercase ved lagring)
- Ingen global tag-administrasjon (omdøp/slett alle) i MVP — kan legges til senere
- `song_tags` slettes og settes inn på nytt ved lagring (ikke diff) — enklere kode, akseptabel ytelse for MVP-skala

## Gjort
- types.ts: lagt til Tag, SongTagEntry, SongWithTags
- SongList.tsx: tags-henting, filter-chips, badges, tag-editor med autocomplete i sheet
- AddSongModal.tsx: tag-filter chips i "Alle sanger"-fanen, tags vises på sangene
- supabase-schema.sql: tags og song_tags tabeller med indekser dokumentert

## Gjenstår
(ingenting)
