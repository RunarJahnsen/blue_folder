# Progress

## Pågående oppgave
Slice 9a — Supabase Auth og brukerregistrering. Implementert og ferdig.

## Analyse

### 1. Filer som opprettes og endres

**Nye filer:**
| Fil | Hva |
|-----|-----|
| `src/pages/Login.tsx` | Login-side (`/login`): brukernavn + passord |
| `src/pages/GroupSelect.tsx` | Gruppevalg etter login hvis bruker tilhører flere grupper |
| `src/pages/admin/UserAdmin.tsx` | Admin-side for brukeradmin (`/:groupId/admin/users`) |
| `src/context/AuthContext.tsx` | React Context som eksponerer session, user, memberships |
| `src/hooks/useAuth.ts` | Hook som leser fra AuthContext |
| `supabase/functions/create-user/index.ts` | Edge Function for brukeroppretting |

**Endrede filer:**
| Fil | Hva endres |
|-----|------------|
| `src/App.tsx` | Legg til `/login`, `/group-select`, `/:groupId/admin/users`. Pakk beskyttede ruter i `<ProtectedRoute>` |
| `src/lib/types.ts` | Legg til `GroupMember`-interface |
| `src/pages/FolderList.tsx` | Legg til logg ut-knapp + lenke til brukeradmin (kun synlig for admin) |
| `src/main.tsx` | Wrap med `<AuthProvider>` |
| `supabase-schema.sql` | Legg til `group_members`-tabell |

**Slettede filer:**
- `src/pages/GroupAccess.tsx` — slettet (godkjent av bruker)

**Uendrede filer (eksplisitt):**
- `src/hooks/useSession.ts` — beholdes, `host_session_id`-logikk i FolderView uendret
- `src/pages/FolderView.tsx` — ingen endringer

---

### 2. Justeringer fra godkjenning

1. **GroupAccess slettes** — filen er ikke lenger i bruk
2. **Session restore**: `GroupSelect` og `Login` håndterer begge tilfellet der session
   gjenopprettes ved refresh — henter alltid memberships fra `group_members` og redirecter
   tilsvarende (1 gruppe → direkte, flere → GroupSelect)

---

### 3. Auth-state-arkitektur

`AuthContext.tsx` initialiseres i `main.tsx` (wrapper rundt `<App>`).

Sekvens for session-restore (refresh):
1. `getSession()` hentes
2. Memberships hentes (`group_members` JOIN `groups`)
3. `session` + `memberships` settes — React batcher disse til én render
4. `isLoading = false`
5. `Login.tsx` / `GroupSelect.tsx` kjører redirect-logikk i `useEffect`

`ProtectedRoute` returnerer `null` mens `isLoading` er true — ingen blink til login-siden.

---

### group_members SQL (kjøres manuelt i Supabase)
```sql
CREATE TABLE group_members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  username TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'member')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, group_id)
);
CREATE INDEX idx_group_members_user_id ON group_members(user_id);
CREATE INDEX idx_group_members_group_id ON group_members(group_id);
```

---

### Hva som IKKE er med i denne slicen
- RLS → 9b
- `host_session_id` erstattes → 9b
- Gjesteinvitasjon → 9c
- `access_code` fjernes → 9b

## Gjort
- [x] `supabase-schema.sql` — `group_members`-tabell med `username`-kolonne
- [x] `src/lib/types.ts` — `GroupMember`-interface (inkl. `username` + nested `groups`)
- [x] `src/context/AuthContext.tsx` — `AuthProvider` + `useAuth` + `fetchMemberships`
- [x] `src/hooks/useAuth.ts` — re-eksporterer `useAuth` fra AuthContext
- [x] `src/main.tsx` — wrapped med `<AuthProvider>`
- [x] `src/pages/Login.tsx` — login-skjema + redirect-logikk (fresh login + session restore)
- [x] `src/pages/GroupSelect.tsx` — gruppevalg + redirect ved 1 gruppe (session restore)
- [x] `supabase/functions/create-user/index.ts` — Edge Function med admin-sjekk
- [x] `src/pages/admin/UserAdmin.tsx` — opprett bruker + vis medlemsliste
- [x] `src/App.tsx` — `ProtectedRoute` + alle nye ruter
- [x] `src/pages/FolderList.tsx` — logg ut-knapp + Brukere-lenke for admins
- [x] `src/pages/GroupAccess.tsx` — slettet

## Gjenstår
(alt gjort)

## Neste steg
- Kjør `group_members` SQL manuelt i Supabase dashboard
- Deploy `create-user` Edge Function (`supabase functions deploy create-user`)
- Opprett første admin-bruker manuelt i Supabase Auth-panelet og legg til rad i `group_members`
- Slice 9b: RLS, `host_session_id` erstattes, `access_code` fjernes
