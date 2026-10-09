# Spesen-App — Stand

**Zuletzt aktualisiert: 09.10.2026.** Zuerst lesen, bevor weitergearbeitet wird.

## Live (spesen.tit-pit.ch)

Läuft auf dem Live-Projekt `ieziwunnhyoiacleyspw`. Seit 09.10. live:

- Technische Korrekturen (Token-Erneuerung, verwaiste Uploads, gesperrtes
  Löschen erkennen, CSV-Maskierung, Datumsfeld, Service Worker)
- Filter auf Konto/KST zeigt bei aufgeteilten Belegen nur den passenden Anteil
- PDF-Kontierung mit Spalte „Bezahlt"
- supabase-js fest auf 2.117.2, Zugangsdaten in `konfig.js`
- Auftragsnummern (KST) aus laufendem **und** ganzem Vorjahr

Der Umbau auf Rollen und Freigaben ist **noch nicht live**.

## Test (spesen.tit-pit.ch/test/)

Läuft auf dem eigenen Projekt `jqegbngpuflymvpuvvvf` („Spesentool-Test",
eigene Organisation, Free-Plan). Einrichtung: `claude/testumgebung.md`.

Gebaut in `test/`, Plan und Entscheide in `claude/spesen-umbau-rollen-freigabe.md`:

- **Etappe 1** — Status am Beleg, „Zur Prüfung freigeben", Sammelfreigabe,
  eingereichte Belege nur lesbar, Statusfilter. SQL: `supabase/etappe1-status.sql`
- **Etappe 2 + 4** — Rollen User/Projektleiter/Supervisor/Admin, „Prüfung
  einrichten" je User, Zuweisungen (Projektleiter × KST, Supervisor × Konto),
  Reiter „Freigabe", Entscheide je Zahlungsart, Teilgenehmigung mit Betrag und
  Kommentar, Umkontieren, Stempel in App und PDF, Protokoll `spesen_verlauf`,
  Export mit gebuchtem Betrag. SQL: `supabase/etappe2-freigabe.sql`,
  Edge Function `supabase/functions/benutzer/index.ts` geändert.

Lokal gegen Postgres und im Browser mit Beispieldaten getestet.
**Gegen die echte Testdatenbank noch nicht geprüft.**

## Nächste Schritte

1. **Oli, im Test-Projekt:** `etappe1-status.sql` (falls noch nicht) und
   `etappe2-freigabe.sql` im SQL Editor ausführen; Edge Function `benutzer`
   mit dem neuen Code deployen.
2. **Oli testet** unter `/test/`: Testbenutzer mit allen Rollen anlegen,
   Zuweisungen setzen, Belege einreichen (mit und ohne Prüfer, mit „Prüfung
   einrichten"), entscheiden (teilweise, ablehnen, umkontieren), abgelehnten
   Beleg korrigieren und neu einreichen, Export mit Statusfiltern.
3. Gefundene Fehler beheben (Claude), bis alles passt.
4. Offen: **Etappe 3** (Karten je Kostenstelle) — vor oder nach dem Live-Gang.
5. **Live-Gang**, alles auf einmal, in dieser Reihenfolge:
   1. `etappe1-status.sql` im Live-Projekt
   2. `etappe2-freigabe.sql` im Live-Projekt
   3. Edge Function `benutzer` im Live-Projekt deployen
   4. Rollen und Zuweisungen in der echten App setzen (sonst läuft alles
      ohne Prüfung durch)
   5. Claude übernimmt `test/` in die Hauptdateien (ohne `test/index.html`
      und `test/konfig.js`) und bringt es nach `main`
   6. `supabase/schema.sql` auf den neuen Stand bringen

Die alte App läuft mit dem neuen SQL weiter — die Reihenfolge SQL vor App
ist deshalb gefahrlos.

## Arbeitsweise

- Claude baut in `test/` und bringt es nach `main` (nur `test/`, `supabase/`,
  Doku — die echte App bleibt unberührt). Oli testet. Erst auf Olis „live"
  übernimmt Claude in die Hauptdateien.
- Datenbankänderungen als `.sql`-Datei: erst Test, nach OK Live.
