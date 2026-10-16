# Spesen-App (spesen.tit-pit.ch)

Belege fotografieren, kontieren und für DocuWare exportieren. Daten in
Supabase, ausgeliefert über GitHub Pages.

Die App ist in `web/` gebaut: React + TypeScript + Vite (seit 12.10.2026).
Ein Code, zwei Fassungen — automatisch gebaut und veröffentlicht von
`.github/workflows/seite.yml` bei jedem Push auf `main`:

- `spesen.tit-pit.ch/` — echte App, immer aus `main`, `web/.env.live` (Live-Datenbank)
- `spesen.tit-pit.ch/test/` — Testfassung, `web/.env.test` (Testdatenbank).
  Kommt aus `main` — oder aus einem Arbeitsbranch: Workflow von Hand starten
  (Run workflow, Branch `main`) und bei „Teststand" den Branch eintragen.

Die alte Fassung in reinem JavaScript ist entfernt. Rückweg: Commit `85fe211`.

## Mehr Kontext

- **`claude/spesen-stand.md` — aktueller Stand und nächste Schritte. Zuerst lesen.**
- `claude/spesen-supabase.md` — Tabellen, RLS, Edge Functions, Schlüssel
- `claude/spesen-umbau-rollen-freigabe.md` — geplanter Umbau auf Rollen und Freigaben
- `claude/offene-punkte.md` — bekannte Schwächen, die noch nicht angegangen sind
- `claude/testumgebung.md` — Testprojekt einrichten, Ablauf Test → Live
- `supabase/schema.sql` — vollständiger Aufbau der Datenbank (Stand Live)
- `supabase/functions/` — Code der Edge Functions. Abschrift dessen, was in
  Supabase deployt ist; Änderungen hier deployt Oli im Dashboard.

## Begriffe

- **Auftragsnummer = Kostenstelle = KST** — dasselbe. Kommt aus FileMaker,
  im Code `auftrag_nr` / `S.auftraege`. In der Oberfläche heisst es teils
  „Auftrag". Sonderwert `ohne KST`.
- **Konto** — Sachkonto aus dem Kontenplan (`spesen_konto`), wählt der User
  beim Erfassen frei.

## Aufbau der React-Fassung (`web/`)

- `src/zustand.ts` — zentraler Zustand `S` und `render()` (wie in der alten
  Fassung), dazu der Supabase-Client `sb`.
- `src/grundlagen.ts` — feste Werte und Helfer ohne Zustand.
- `src/daten.ts` — alle Datenzugriffe (Port von `daten.js`).
- `src/aktionen.ts` — alle Klicks/Eingaben über `data-akt` / `data-feld`
  (Port von `app.js`). Knöpfe, die arbeiten: `laeuft(akt, text)` und
  `<Knopf akt="…">`.
- `src/ansichten/rahmen.tsx` — Rahmen jeder Seite (`<Seite>`): Handy mit
  dunklem Kopf und Leiste unten, Rechner (ab 900 px) mit Seitenleiste links
  (Abschnitte Meine Spesen / Projektleitung / Supervisor / Administration)
  und weisser Kopfleiste. `voll` = Arbeitsplatz ohne Rand.
- `src/ansichten/bausteine.tsx` — Symbole, Kacheln, Zeitraum, Filter,
  Belegzeilen, Auswahl Konto/KST (am Rechner klappt sie unter dem Feld auf).
- `src/ansichten/*.tsx` — die Bildschirme: `uebersicht` (Meine Belege,
  Übersicht), `erfassen` (Erfassen, Ansehen/Prüfen, am Rechner der
  Arbeitsplatz Liste | Beleg | Angaben inkl. Freigabe), `profil` (Profil,
  Passwort, Favoriten, Freigabe), `verwaltung` (Benutzer inkl. Zuweisungen,
  Konten, Geräte, Kostenstellen-Auswahl), `login`.
- `src/stil.css` — Aussehen nach Vorbild „PDF Master" (16.10.2026), Basis Variante D.
- `public/sw.js` — Service Worker, nur in der echten App angemeldet.
- `src/export.ts` — PDF/CSV, unverändert aus `export.js`.
- Eingabefelder sind ungesteuert (`defaultValue`) und werden über
  `key={schluessel(obj)}` neu aufgebaut, wenn das bearbeitete Objekt wechselt.
- `web/.env.test` / `web/.env.live` — Supabase-URL und publishable Key je Fassung.
- Prüfen: `cd web && npm run pruefen`; bauen: `npm run bauen:test`.

## Regeln

- Alles auf Deutsch: Oberfläche, Namen im Code, Kommentare, Commits.
- Funktionalität muss erhalten bleiben. Jede Änderung auf `main` geht in
  beide Fassungen. Grössere Änderungen darum zuerst auf dem Arbeitsbranch
  bauen und lokal prüfen; Datenbankänderungen erst im Test-Projekt.
- Vor jedem Push `cd web && npm run bauen:live && npm run bauen:test` —
  scheitert der Bau, scheitert auch die Veröffentlichung.
- Neues erst unter `/test/` zeigen (Teststand = Arbeitsbranch), nach Olis
  „live" per Pull Request nach `main`.
- Zugangsdaten nur in `web/.env.*`. Der `service_role`-Schlüssel gehört nie
  ins Repo (öffentliches Repo).
- Datenbankänderungen kann Claude nicht selbst ausführen: dafür eine fertige
  `.sql`-Datei schreiben, die Oli im Supabase SQL Editor ausführt.
