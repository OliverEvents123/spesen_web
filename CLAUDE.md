# Spesen-App (spesen.tit-pit.ch)

Belege fotografieren, kontieren und für DocuWare exportieren. Reines HTML/JS
ohne Build, Daten in Supabase, ausgeliefert über GitHub Pages.

## Mehr Kontext

- `claude/spesen-supabase.md` — Tabellen, RLS, Edge Functions, Schlüssel
- `claude/spesen-umbau-rollen-freigabe.md` — geplanter Umbau auf Rollen und Freigaben
- `claude/offene-punkte.md` — bekannte Schwächen, die noch nicht angegangen sind

## Regeln

- Alles auf Deutsch: Oberfläche, Namen im Code, Kommentare, Commits.
- Funktionalität muss erhalten bleiben. Grössere Änderungen erst in `test/`
  ausprobieren, dann in die Hauptdateien übernehmen.
- `test/` ist eine Kopie der App. Beim Übernehmen nach oben **nicht**
  `test/index.html` und `test/konfig.js` mitkopieren — die unterscheiden sich
  absichtlich (kein Service Worker, eigenes Banner, eigene Datenbank).
- Zugangsdaten nur in `konfig.js`. Der `service_role`-Schlüssel gehört nie ins Repo
  (öffentliches Repo).
- Datenbankänderungen kann Claude nicht selbst ausführen: dafür eine fertige
  `.sql`-Datei schreiben, die Oli im Supabase SQL Editor ausführt.
- Ladereihenfolge in `index.html`: supabase-js → konfig.js → daten.js →
  ansichten.js → export.js → app.js. Alles globale Funktionen, keine Module.
- Neue Dateien der App in `sw.js` (`DATEIEN`) eintragen.
