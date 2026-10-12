# Spesen-App — Stand

**Zuletzt aktualisiert: 12.10.2026.** Zuerst lesen, bevor weitergearbeitet wird.

## Umstieg auf React (12.10.2026)

Die App war noch nicht im produktiven Einsatz — darum jetzt umgestellt statt
später. Die Oberfläche ist in `web/` mit React + TypeScript neu gebaut, die
Abläufe 1:1 aus der alten Fassung übernommen. Datenbank, SQL und Edge
Functions bleiben unverändert.

Geprüft: derselbe Ablauf (anmelden, Listen, erfassen mit Foto, prüfen und
teilweise genehmigen, Zuweisung anlegen) in alter und neuer Fassung gegen
eine nachgebildete Supabase — gleiche Bildschirme, gleiche Datenbank-Aufrufe.

Stand der Auslieferung:
- `/` — weiterhin die alte Fassung
- `/test/` — neue React-Fassung (Testdatenbank)
- `/test-alt/` — alte Testfassung zum Vergleich

**Oli muss einmalig:** Repo → Settings → Pages → Build and deployment →
Source auf **„GitHub Actions"** stellen. Erst dann baut und veröffentlicht
`.github/workflows/seite.yml`.

Zurück zur alten Fassung jederzeit möglich: Commit `85fe211`.

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

Lokal gegen Postgres und im Browser mit Beispieldaten getestet, danach von
Oli in der Testdatenbank durchgeklickt (12.10.: „sieht schon ganz gut aus").

## Nächste Schritte

0. **React-Fassung unter `/test/` durchtesten** (wie bisher). Passt alles,
   wird die echte App auf React umgestellt: Workflow baut dann zusätzlich
   `npm run bauen:live` nach `/`, die alten Dateien im Hauptordner fallen weg.

1. ~~SQL Etappe 1+2 und Function `benutzer` im Test-Projekt~~ — erledigt.
2. ~~Freigaben in `/test/` testen~~ — erledigt (alte Fassung, 12.10.).
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
