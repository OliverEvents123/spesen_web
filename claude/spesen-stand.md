# Spesen-App — Stand

**Zuletzt aktualisiert: 12.10.2026.** Zuerst lesen, bevor weitergearbeitet wird.

## Neues Aussehen „Dashboard" (12.10.2026) — auf dem Arbeitsbranch, noch nicht live

Oli hat aus vier Entwürfen Variante D gewählt (Design-Canvas „Spesen-App
Entwurf", Blöcke „D komplett"). Umgebaut in `web/`, alle Abläufe bleiben:

- Handy: dunkler Kopf, unten Leiste Belege · Übersicht · Kamera · Freigabe ·
  Profil. Rechner: dunkle Seitenleiste, Kacheln, farbige Karten, Tabellen.
- Zeitraum überall die Abrechnungsperiode (16.–15.) mit ‹ ›, dazu „Eigener
  Zeitraum". „Meine Belege" zeigt die Periode statt des Kalendermonats.
- **Gespeicherte Perioden entfernt** (Olis Wunsch, er prüft es in der
  Handhabung). Tabelle `spesen_periode` bleibt in der Datenbank unberührt.
- Filter hinter einem Knopf, aktive als Chips; Kacheln Erledigt/Offen filtern.
- Aufgaben auf der Startseite: abgelehnte Belege, nicht freigegebene (aus
  allen Perioden), „x warten auf dich".
- Zuweisungen keine eigene Seite mehr: beim Benutzer (Projektleiter → KST,
  Supervisor → Konten). Konten-Reihenfolge per Pfeil statt Zahlenfeld.
- Freigabe am Rechner: Liste links, Beleg mit Entscheid rechts; nach dem
  Entscheid öffnet sich der nächste.
- Erfassen am Rechner: Bild links, Formular rechts, Konto/KST klappen als
  Suchliste auf. Favorit lässt sich im Formular übernehmen (Foto bleibt).
- User behalten Kontierung und PDF-Export (Olis Entscheid).
- Verlauf: Admin alles, Projektleiter/Supervisor ihre KST bzw. Konten und
  eigene Belege. Braucht **`supabase/verlauf-pruefer.sql`** (ohne: Prüfer
  sehen keinen Verlauf, Listen zeigen E-Mail statt Name). Lokal gegen
  Postgres geprüft.

Nächste Schritte: SQL im Test-Projekt ausführen, Oli testet unter `/test/`
(Teststand = Arbeitsbranch), danach „schleifen" und live.

### Erste Runde Anpassungen (12.10.2026, nach Olis Test)

- **User** haben keine Übersicht mehr — nur Meine Belege und Favoriten
  (Handy: Belege · Kamera · Profil). Damit auch kein PDF/CSV-Export für User.
- **Meine Belege** (alle Rollen): Kacheln Belege (Summe + Anzahl),
  User-Zahlungen (gesamt / genehmigt), Offene Punkte, Erledigt — antippen
  filtert; dazu eigener Filter mit Suche. Aufgaben-Karten mit antippbaren Belegen.
- **„Vorauskasse" heisst jetzt „User-Zahlung"** (App, PDF, CSV, Fehlertexte).
  In der Datenbank bleibt `zahlart = 'vorkasse'`.
- Belege heissen nach der **KST** („Gurtenfestival 2026 2601"), das Konto
  steht klein darunter. Kontierung: Konto nur Nummer, Bezeichnung = KST-Name
  und die Kommentare der Belege (nur in der App — PDF/CSV unverändert).
- **Kommentar** je Beleg (freiwillig), durchsuchbar, im CSV als letzte Spalte.
- **PDF-Belege** zeigen die erste Seite als Vorschau (pdf.js, wie im Export).
- **Übersicht** (PL/Supervisor/Admin): ohne MwSt-Kachel; Karten Nach KST,
  Nach Person, Freigaben offen, Export. Handy: Export vor der Kontierung,
  „Offen" blendet Export/Kontierung aus und springt zur Liste.
- **Prüfen** bei Kreditkarte/Bar: Betrag, MwSt, Datum korrigierbar
  (`beleg_korrigieren`); eine offene Korrektur wird vor dem Entscheid gespeichert.
- **Eigene KST**: Wer selbst zuständig ist (PL/Supervisor, Admin immer),
  bekommt „Speichern und genehmigen".
- **Supervisor × Personen**: deren User-Zahlungen warten auf den Supervisor
  (Tabelle `spesen_zuweisung_person`, beim Benutzer zuweisen).
- **Zeitraum speichern** (bis drei je Person) als Schnellwahl — nutzt wieder
  `spesen_periode`.
- PDF: rechts oben je Beleg „genehmigt: Name / Datum".
- Texte: „x Freigaben offen" statt „x warten auf dich".

SQL dafür: **`supabase/kommentar-korrektur-personen.sql`** (nach
`verlauf-pruefer.sql`). Lokal gegen Postgres geprüft.

## Umstieg auf React (12.10.2026)

Die App war noch nicht im produktiven Einsatz — darum jetzt umgestellt statt
später. Die Oberfläche ist in `web/` mit React + TypeScript neu gebaut, die
Abläufe 1:1 aus der alten Fassung übernommen. Datenbank, SQL und Edge
Functions bleiben unverändert.

Geprüft: derselbe Ablauf (anmelden, Listen, erfassen mit Foto, prüfen und
teilweise genehmigen, Zuweisung anlegen) in alter und neuer Fassung gegen
eine nachgebildete Supabase — gleiche Bildschirme, gleiche Datenbank-Aufrufe.

Seit 12.10. ist React auch die echte App (`/`, Live-Datenbank); `/test/`
läuft mit der Testdatenbank. Die alte Fassung ist aus dem Repo entfernt.
GitHub Pages steht auf „GitHub Actions" (von Oli umgestellt).

Zurück zur alten Fassung jederzeit möglich: Commit `85fe211`.

**Offen für die Live-Datenbank:** `etappe1-status.sql`, `etappe2-freigabe.sql`
und die Edge Function `benutzer` sind dort noch nicht eingespielt. Bis dahin
funktioniert in der echten App das Freigeben nicht (Fehlermeldung), alles
andere schon. Bestehende Belege erscheinen danach als „erfasst".

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

0. **Aussehen** — umgebaut (siehe oben), Oli testet unter `/test/`, dann
   weiter schleifen.

1. ~~SQL Etappe 1+2 und Function `benutzer` im Test-Projekt~~ — erledigt.
2. ~~Freigaben in `/test/` testen~~ — erledigt (alte Fassung, 12.10.).
3. `verlauf-pruefer.sql` und `kommentar-korrektur-personen.sql` im Test-Projekt ausführen (Oli).
4. Offen: **Etappe 3** (Karten je Kostenstelle) — vor oder nach dem Live-Gang.
5. **Live-Gang**, alles auf einmal, in dieser Reihenfolge:
   1. `etappe1-status.sql` im Live-Projekt
   2. `etappe2-freigabe.sql` im Live-Projekt
   3. `verlauf-pruefer.sql` und `kommentar-korrektur-personen.sql` im Live-Projekt
   4. Edge Function `benutzer` im Live-Projekt deployen
   5. Rollen und Zuweisungen in der echten App setzen (sonst läuft alles
      ohne Prüfung durch)
   6. Claude bringt den Arbeitsbranch per Pull Request nach `main`
   7. `supabase/schema.sql` auf den neuen Stand bringen

Die App läuft mit dem neuen SQL weiter — die Reihenfolge SQL vor App
ist deshalb gefahrlos.

## Arbeitsweise

- Claude baut auf dem Arbeitsbranch und zeigt ihn unter `/test/` (Workflow
  von Hand starten, „Teststand" = Branch). `/` bleibt dabei aus `main`.
  Oli testet. Erst auf Olis „live" geht es per Pull Request nach `main`.
- Datenbankänderungen als `.sql`-Datei: erst Test, nach OK Live.
