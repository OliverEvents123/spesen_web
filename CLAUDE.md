# Spesen-App (spesen.tit-pit.ch)

Belege fotografieren, kontieren und für DocuWare exportieren. Daten in
Supabase, ausgeliefert über GitHub Pages.

**Umstieg auf React läuft (seit 12.10.2026).** Zwei Fassungen im Repo:

- `web/` — **neue Fassung**: React + TypeScript, gebaut mit Vite. Hier wird
  ab jetzt entwickelt. Läuft unter `/test/` (Testdatenbank).
- Hauptordner (`index.html`, `app.js`, …) — **alte Fassung**, läuft noch als
  echte App unter `/`. Nicht mehr weiterentwickeln, nur Notfall-Korrekturen.
- `test/` — alte Testfassung, zum Vergleich unter `/test-alt/`. Wird nicht
  mehr gepflegt.

Gebaut und veröffentlicht wird automatisch: `.github/workflows/seite.yml`
(bei jedem Push auf `main`). Letzter Stand vor dem Umstieg: Commit `85fe211`.

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
- `src/ansichten/*.tsx` — die Bildschirme (Port von `ansichten.js`).
- `src/export.ts` — PDF/CSV, unverändert aus `export.js`.
- Eingabefelder sind ungesteuert (`defaultValue`) und werden über
  `key={schluessel(obj)}` neu aufgebaut, wenn das bearbeitete Objekt wechselt.
- `web/.env.test` / `web/.env.live` — Supabase-URL und publishable Key je Fassung.
- Prüfen: `cd web && npm run pruefen`; bauen: `npm run bauen:test`.

## Regeln

- Alles auf Deutsch: Oberfläche, Namen im Code, Kommentare, Commits.
- Funktionalität muss erhalten bleiben. Grössere Änderungen erst in `test/`
  ausprobieren, dann in die Hauptdateien übernehmen.
- Neue Arbeit nur noch in `web/`. Vor jedem Push `npm run bauen:test` —
  scheitert der Bau, scheitert auch die Veröffentlichung.
- Zugangsdaten nur in `web/.env.*` (bzw. `konfig.js` der alten Fassung). Der
  `service_role`-Schlüssel gehört nie ins Repo (öffentliches Repo).
- Datenbankänderungen kann Claude nicht selbst ausführen: dafür eine fertige
  `.sql`-Datei schreiben, die Oli im Supabase SQL Editor ausführt.
- Alte Fassung: Ladereihenfolge in `index.html`: supabase-js → konfig.js →
  daten.js → ansichten.js → export.js → app.js.
