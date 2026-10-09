# Spesen-App — Supabase auf einem Blatt

Stand: **09.10.2026.** Gedacht zum Weitergeben an Claude Code.

Zum restlichen Stand: `claude/spesen-stand.md`
Zum geplanten Umbau: `claude/spesen-umbau-rollen-freigabe.md`

## Projekt

| | |
|---|---|
| Projektname | Spesentool |
| Plan | Free |
| Region | Central EU (Frankfurt) |
| URL | `https://ieziwunnhyoiacleyspw.supabase.co` |
| Projektkennung (ref) | `ieziwunnhyoiacleyspw` |
| Dashboard | https://supabase.com/dashboard/project/ieziwunnhyoiacleyspw |

Eigenes Projekt, getrennt vom Zeiterfassungsprojekt
(`mawgxgqhnnzjdlmwedvm`). Nicht verwechseln.

## Schlüssel

**Gehört in den öffentlichen Code** (steht in `konfig.js`, je eine für die
echte App und für `test/`):

```
SUPABASE_URL = https://ieziwunnhyoiacleyspw.supabase.co
SUPABASE_KEY = sb_publishable_vFDhfRba41suO17FZOHdAg_wa0jonFy
```

Das ist der *publishable* Key. Er darf gelesen werden, weil die
Row-Level-Security entscheidet, was damit möglich ist.

**Gehört nie in den Code und nie in einen Chat:** der
`SUPABASE_SERVICE_ROLE_KEY`. Edge Functions bekommen ihn automatisch von
Supabase über `Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")` — er muss **nicht**
als Secret angelegt werden. Weil `spesen_web` ein öffentliches Repo ist, wäre
ein versehentlich eingecheckter Service-Role-Key sofort für alle lesbar.

## Tabellen

Alles im Schema `public`, alle mit Row Level Security an.

### `spesen_beleg`

Die Haupttabelle. Ein Beleg = eine Zeile, auch wenn er auf mehrere Konten
aufgeteilt ist.

| Spalte | Typ | Bemerkung |
|---|---|---|
| `id` | `bigint identity` | Primärschlüssel |
| `geraet` | `text not null` | **E-Mail** des Kontos, nicht die Benutzerkennung — daran hängt die RLS |
| `beleg_datum` | `date not null` | |
| `betrag` | `numeric(10,2) not null` | `check (betrag > 0)`; bei aufgeteilten Belegen die **Summe** |
| `mwst` | `numeric(4,2) not null` | bei aufgeteilten Belegen der Satz der **ersten** Position |
| `konto_nummer` | `text not null` | dito erste Position |
| `auftrag_nr` | `text not null` | FileMaker-Nummer, oder der Text `ohne KST` |
| `positionen` | `jsonb` | **null im Normalfall.** Bei Aufteilung ein Array aus `{betrag, mwst, konto_nummer, auftrag_nr}` |
| `zahlart` | `text` | `karte` (Vorgabe, wenn leer) · `bar` · `vorauskasse` |
| `bemerkung` | `text` | |
| `datei_pfad` | `text` | Pfad im Bucket `belege` |
| `monat` | `text not null` | z. B. `2026-09` — Altlast aus der Monatslogik, die Übersicht filtert heute über `beleg_datum` |
| `status` | `text not null default 'offen'` | `offen` · `abgeschlossen`. Hier kommen beim Umbau die neuen Werte hinein |
| `erstellt`, `geaendert` | `timestamptz default now()` | |

Index auf `(geraet, monat)`.

### `spesen_konto`

Kontenplan, gepflegt über **Admin → Konten** in der App.

| Spalte | Typ |
|---|---|
| `id` | `bigint identity` |
| `nummer` | `text not null unique` — nach dem Anlegen fest, Belege hängen daran |
| `bezeichnung` | `text not null` |
| `mwst` | `numeric(4,2) default 8.1` |
| `sortierung` | `int default 100` — in Zehnerschritten |
| `aktiv` | `boolean default true` |
| `auftrag_modus` | `text default 'alle'` — `alle` · `liste` |
| `auftrag_liste` | `text[]` — nur bei Modus `liste` |

**Gelöscht wird nie**, nur `aktiv = false`. Sonst zeigen alte Belege und
Exporte eine Nummer ohne Bezeichnung.

### `spesen_benutzer`

Unsere eigene Benutzertabelle. **Nicht** `auth.users` — das gehört Supabase und
enthält nur E-Mail und Passwort.

| Spalte | Typ |
|---|---|
| `email` | `text` — Schlüssel, verbindet mit `auth.users` |
| `name` | `text` |
| `rolle` | `text` — heute `admin` · `user`; beim Umbau kommen `supervisor` und `projektleiter` dazu |
| `aktiv` | `boolean` |

Fehlt hier die Zeile zu einem Anmeldekonto, ist die Person eine Karteileiche:
sie kann sich anmelden und erfassen, erscheint aber in keiner Liste und gilt als
`user`. Abfrage dazu in `claude/spesen-stand.md`.

### `spesen_favorit`

| Spalte | Typ |
|---|---|
| `id` | `bigint identity` |
| `geraet` | `text not null` — E-Mail |
| `name` | `text not null` |
| `konto_nummer` | `text not null` |
| `auftrag_nr` | `text not null` |
| `auftrag_name` | `text` |
| `sortierung` | `int default 100` |
| `erstellt` | `timestamptz default now()` |

Index auf `(geraet)`.

### `spesen_periode`

Gespeicherte Zeiträume, **persönlich je Benutzer, höchstens drei**.

| Spalte | Typ |
|---|---|
| `id` | `bigint identity` |
| `geraet` | `text not null` — E-Mail |
| `name` | `text not null` |
| `von`, `bis` | `date not null` |
| `sortierung` | `int` |

Die Grenze von drei erzwingt der Trigger `periode_grenze` in der Datenbank,
nicht die Oberfläche. `MAX_PERIODEN = 3` in `daten.js` ist nur die Anzeige.
SQL dazu liegt in `perioden.sql` und `perioden-persoenlich.sql`.

### `spesen_admin`

**Altlast.** Enthielt früher die Admin-Adressen, bevor `spesen_benutzer`
existierte. `ist_admin()` liest heute aus `spesen_benutzer`. Tabelle kann nach
einer Prüfung weg.

## Funktion `ist_admin()`

```sql
create function ist_admin() returns boolean
  language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from spesen_benutzer
    where email = auth.jwt() ->> 'email' and rolle = 'admin' and aktiv
  );
$$;
```

`security definer` ist nötig, weil die Funktion sonst in die eigene RLS läuft
und sich selbst aussperrt. `set search_path = public` gehört dazu, sonst ist die
Funktion manipulierbar.

## Row Level Security — das Muster

Der gesamte Zugriffsschutz steht auf einer Zeile:

```sql
geraet = auth.jwt() ->> 'email'
```

Das heisst: **die Datenbank kennt heute nur „mein Gerät" und „Admin".** Es gibt
keine Rolle, die fremde Belege lesen darf, ohne gleich alle zu sehen. Genau das
ist die Stelle, die der Umbau auf Projektleiter und Supervisor aufbrechen muss.

```sql
create policy konto_lesen on spesen_konto
  for select to authenticated using (true);

create policy favorit_eigene on spesen_favorit
  for all to authenticated
  using      (geraet = auth.jwt() ->> 'email')
  with check (geraet = auth.jwt() ->> 'email');

create policy beleg_lesen on spesen_beleg
  for select to authenticated
  using (geraet = auth.jwt() ->> 'email' or ist_admin());

create policy beleg_anlegen on spesen_beleg
  for insert to authenticated
  with check (geraet = auth.jwt() ->> 'email' and status = 'offen');

create policy beleg_aendern on spesen_beleg
  for update to authenticated
  using      ((geraet = auth.jwt() ->> 'email' or ist_admin()) and status = 'offen')
  with check ((geraet = auth.jwt() ->> 'email' or ist_admin()) and status = 'offen');

create policy beleg_loeschen on spesen_beleg
  for delete to authenticated
  using (geraet = auth.jwt() ->> 'email' and status = 'offen');
```

Dazu die Rechte — **der Stolperstein aus dem Zeiterfassungsprojekt.** Ohne
`grant` nützt die beste Policy nichts, die Abfrage kommt leer zurück:

```sql
grant usage on schema public to authenticated;
grant select                         on spesen_konto   to authenticated;
grant select, insert, update, delete on spesen_favorit to authenticated;
grant select, insert, update, delete on spesen_beleg   to authenticated;
```

**Wichtig für den Code:** Blockiert eine Policy ein `update` oder `delete`,
meldet Supabase *keinen Fehler*, sondern ändert einfach null Zeilen. Die App
fragt darum mit `.select("id")` nach, ob wirklich eine Zeile getroffen wurde.

## Authentication

- Selbstregistrierung **aus**
- Confirm email **aus**
- Anonyme Anmeldungen **aus**
- Benutzer werden ausschliesslich über **Admin → Benutzer** angelegt, dahinter
  die Edge Function `benutzer`
- Sitzung bleibt dauerhaft bestehen (die Eventhandys sollen sich nicht täglich
  anmelden müssen)
- Admins: `oliver@`, `dani@`, `admin@eventorganisation.ch`
- `admin@eventorganisation.ch` ist geschützt: in der Oberfläche nicht sperrbar,
  Rolle nicht entziehbar. Liste steht in `GESCHUETZT` (Edge Function) und
  `GESCHUETZTE_KONTEN` (`daten.js`) und muss zusammenpassen

## Storage

Bucket `belege`:

- **privat** (keine öffentlichen URLs; die App holt signierte Links)
- Grenze 10 MB je Datei
- erlaubte Typen: Bilder inkl. HEIC, PDF
- Pfad steht in `spesen_beleg.datei_pfad`

## Edge Functions

### `auftragsnummern`

Liest die Auftragsnummern aus FileMaker über die Data API. Kopie aus dem
Zeiterfassungsprojekt, liest dieselbe Datenbank.

Secrets (Edge Functions → Secrets):

```
FM_HOST     = fmapi.eventorganisation.ch
FM_DATABASE = Zeiterfassung
FM_LAYOUT   = api_auftragsnr
FM_USER     = api_user
FM_PASSWORD = (geheim)
```

Ablauf: `POST /sessions` (Login) → `GET /records` → `DELETE /sessions`.
Felder im Layout: `ANr_ID`, `ANr_Name`, `MA_ID`.

Die App ruft sie mit `?jahr=<laufendes Jahr>` auf (`daten.js`, `ladeAlles`).

**Nach dem Ändern eines Secrets muss die Function neu deployt werden**, sonst
arbeitet sie mit dem alten Wert weiter.

### `benutzer`

Benutzerverwaltung mit `SUPABASE_SERVICE_ROLE_KEY`, weil das Anlegen von
Anmeldekonten mit dem publishable Key nicht geht.

Aktionen: `liste` · `anlegen` · `passwort` · `rolle` · `aktiv` · `name`

Beim Anlegen zwei Schritte — Anmeldekonto in `auth.users`, dann Zeile in
`spesen_benutzer`. Scheitert der zweite, wird der erste **zurückgerollt**
(Anmeldekonto wieder gelöscht). Entweder beides oder keines.

## Den echten Stand abgreifen

Dieses Blatt ist Dokumentation und kann von der Datenbank abweichen — zum
Beispiel wenn eine Spalte per SQL Editor dazukam. **Vor dem Umbau einmal den
echten Stand holen**, im Supabase SQL Editor:

```sql
-- Spalten aller spesen_-Tabellen
select table_name, ordinal_position, column_name, data_type,
       is_nullable, column_default
from information_schema.columns
where table_schema = 'public' and table_name like 'spesen%'
order by table_name, ordinal_position;

-- Policies
select tablename, policyname, cmd, roles, qual, with_check
from pg_policies
where schemaname = 'public'
order by tablename, policyname;

-- Funktionen und Trigger
select p.proname, pg_get_functiondef(p.oid)
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public';

select tgname, relname, pg_get_triggerdef(t.oid)
from pg_trigger t join pg_class c on c.oid = t.tgrelid
where not t.tgisinternal;
```

Das Ergebnis als CSV herunterladen und in die Claude-Code-Sitzung geben. Damit
arbeitet Claude Code auf dem echten Schema statt auf dieser Beschreibung.

## Was Claude Code kann und was nicht

Claude Code bekommt über die GitHub-Anbindung Schreibzugriff auf **den Code** —
nicht auf Supabase. Es kann also:

- alle Dateien lesen und ändern, auf einem eigenen Branch
- SQL-Dateien schreiben, die du dann im SQL Editor ausführst
- Edge-Function-Code schreiben, den du im Dashboard deployst

Es kann **nicht** von sich aus Tabellen anlegen, Policies setzen oder Functions
deployen. Jeder Datenbankschritt bleibt ein Schritt von dir im Browser. Darum
gehört zu jedem Umbauschritt eine fertige `.sql`-Datei zum Kopieren.
