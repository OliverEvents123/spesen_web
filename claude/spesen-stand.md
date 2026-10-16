# Spesen-App — Stand

**Zuletzt aktualisiert: 16.10.2026.** Zuerst lesen, bevor weitergearbeitet wird.

## LIVE seit 16.10.2026

Alles unten Beschriebene (neues Aussehen, Freigaben, Geräte,
Kostenstellen-Auswahl) ist live: `supabase/live-gang.sql` im Live-Projekt
ausgeführt, Edge Functions `auftragsnummern` und `benutzer` deployt,
Pull Request #10 nach `main`.

Noch offen nach dem Live-Gang:
- Rollen und Zuweisungen in der echten App setzen (Oli) — bis dahin gehen
  eingereichte Belege ohne Prüfung durch (ausser „Prüfung einrichten").
- `supabase/schema.sql` auf den neuen Stand bringen.
- Besprechen: Projektleiter und Brand aus FileMaker (Feldnamen auf dem
  Layout `api_auftragsnr`; Brand → erlaubte Konten, Variante A Filter oder
  B Kontoart).

## Darstellung nach Vorbild „PDF Master" (16.10.2026) — Arbeitsbranch, noch nicht live

Oli hat Screens aus seinem Tool „TIT-PIT PDF Master BH" geschickt; nur die
Darstellung ändert sich, die Abläufe bleiben.

- **Menü am Rechner in Abschnitten:** „Meine Spesen" (Meine Belege,
  Favoriten) haben alle. Dazu je nach Zuweisung **Projektleitung** (wer KST
  hat) und **Supervisor** (Rolle Supervisor oder Konten/Personen), für Admins
  **Alle Belege** (Übersicht, Freigabe) und darunter getrennt
  **Administration** (Benutzer, Konten, Geräte, Kostenstellen). Jeder
  Abschnitt hat seine eigene Übersicht und Freigabe mit eigener Zahl
  (`S.bereich`, `imBereich()` in `daten.ts`). Am Handy bleibt die Leiste
  unten; dort zeigen Übersicht und Freigabe alles, was man sehen darf.
- Weisse Kopfleiste mit Titel und Rahmenknöpfen, Seitenleiste bis ganz unten.
- **Keine Kacheln und farbigen Karten mehr:** Reiter mit Zahlen
  (Alle / Offene Punkte / Erledigt bzw. Alle / Offen / Erledigt), rechts die
  Summe; schmale Hinweiszeilen für abgelehnt, nicht freigegeben, Freigaben offen.
- **Meine Belege:** „Schnell erfassen" mit den Favoriten, Tabelle (ganze Zeile
  klickbar).
- **Übersicht:** links Gruppen mit Summen (KST / Konto / Person, Klick
  filtert), rechts Reiter Belege · Kontierung · Verlauf; Export oben rechts.
- **Verlauf** als Liste untereinander; fehlende Belege werden nachgeladen,
  damit nicht nur „Beleg" dasteht.
- **Arbeitsplatz am Rechner** (Freigabe und geöffnete Belege): Liste links,
  Beleg gross in der Mitte, rechts die Angaben mit fester Fussleiste.
  Freigabe mit „x von y erledigt", ‹ / Überspringen / Genehmigen bzw.
  Geprüft. Erfassen: zuerst eine grosse Ablage (ziehen oder auswählen).
- Handy: Freigabe und Erfassen unverändert.

Zweite Runde (16.10.2026):
- „Meine Belege" zeigt keine offenen Freigaben mehr — die stehen im Abschnitt.
- Freigabe filtern nach Person, KST, Konto (Supervisor und Admin; am Rechner
  in der Liste links, am Handy über der Liste).
- Rechner: **Werkzeugleiste** oben auf Meine Belege und Übersicht, immer
  sichtbar: Zeitraum-Auswahl (Laufende Periode, Letzte Periode, ältere,
  gespeicherte, „Eigener Zeitraum …" mit Von/Bis), Suche, Filter.
- Rechner: Beleg im Arbeitsplatz **zoomen** (Regler, − / +, Einpassen).
  PDF-Vorschau dafür schärfer gerendert (1600 px).
- Übersicht: Reiter Belege · Kontierung · Verlauf (Oli hat es kurz
  umgedreht und dann wieder so gewünscht).
- Handy: Übersicht oben mit Abschnitt („Projektleiter-Übersicht" usw.), bei
  mehreren Abschnitten umschaltbar; Suchfeld immer unter der Periode,
  daneben der Filterknopf.
- Leere laufende Periode: Hinweis mit Knopf „‹ Letzte Periode".

### Kostenstellen-Auswahl (16.10.2026)

Verwaltung → **Kostenstellen** (nur Admin): welche Auftragsnummern in der
Auswahl erscheinen.
- **Jahre** mit Haken: alle Aufträge dieses Jahres aus FileMaker. Neues Jahr
  hinzufügen, altes ausblenden oder entfernen.
- **Immer anzeigen**: einzelne KST, auch aus ausgeblendeten Jahren (ersetzt
  die bisher fest eingebaute Liste IMMER_DABEI; die SQL-Datei übernimmt sie).
- **Ausblenden**: einzelne KST, obwohl ihr Jahr angezeigt wird.
- SQL: **`supabase/kst-auswahl.sql`** (Tabellen `spesen_kst_jahr`,
  `spesen_kst_regel`; Startwerte laufendes Jahr + Vorjahr + bisherige feste Liste).
- **Edge Function `auftragsnummern` neu deployen**: neuer Aufruf
  `?jahre=…&nummern=…`. Der alte Aufruf `?jahr=` bleibt — die echte App läuft
  also mit der neuen Function weiter. Ohne Deploy: Jahre gehen, „Immer
  anzeigen" aus ausgeblendeten Jahren nicht (die Seite sagt das).

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

### Geräte (13.10.2026)

- Verwaltung → **Geräte** (nur Admin): Gerät anlegen, benennen, einer KST
  zuweisen; „Steht in der Auswahl" aus = nicht mehr wählbar. Löschen geht
  nur, solange kein Beleg daran hängt.
- Erfassen: bei **Kreditkarte** auf eine KST mit Geräten erscheint „Gerät".
  Eines → vorgewählt; mehrere → muss gewählt werden. Bar/User-Zahlung: kein Gerät.
- Übersicht: Filter „Gerät" (PL, Supervisor, Admin) — Export (PDF/CSV) folgt
  dem Filter, Titel und Dateiname nennen das Gerät. CSV hat die neue Spalte
  „Gerät Kreditkarte" (die alte Spalte „Gerät" ist weiterhin die E-Mail).
- In der Datenbank heisst es `spesen_zahlgeraet` / `spesen_beleg.zahlgeraet_id`,
  weil `spesen_beleg.geraet` schon die E-Mail der erfassenden Person ist.
- SQL: **`supabase/geraete.sql`** (nach `kommentar-korrektur-personen.sql`).
  Ohne die Datei läuft die App weiter, nur ohne Geräte.

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
3. `verlauf-pruefer.sql`, `kommentar-korrektur-personen.sql`, `geraete.sql` und `kst-auswahl.sql` im Test-Projekt ausführen, Edge Function `auftragsnummern` im Test-Projekt deployen (Oli).
4. Offen: **Etappe 3** (Karten je Kostenstelle) — vor oder nach dem Live-Gang.
5. **Live-Gang**, alles auf einmal, in dieser Reihenfolge:
   1. **`supabase/live-gang.sql`** im Live-Projekt ausführen — enthält
      etappe1, etappe2, verlauf-pruefer, kommentar-korrektur-personen,
      geraete und kst-auswahl in einer Transaktion (lokal gegen schema.sql
      zweimal hintereinander geprüft)
   2. Edge Functions `auftragsnummern` und `benutzer` im Live-Projekt deployen
   3. Claude merged den Pull Request (Arbeitsbranch → `main`)
   4. Rollen und Zuweisungen in der echten App setzen (sonst läuft alles
      ohne Prüfung durch)
   5. `supabase/schema.sql` auf den neuen Stand bringen

Die App läuft mit dem neuen SQL weiter — die Reihenfolge SQL vor App
ist deshalb gefahrlos.

## Arbeitsweise

- Claude baut auf dem Arbeitsbranch und zeigt ihn unter `/test/` (Workflow
  von Hand starten, „Teststand" = Branch). `/` bleibt dabei aus `main`.
  Oli testet. Erst auf Olis „live" geht es per Pull Request nach `main`.
- Datenbankänderungen als `.sql`-Datei: erst Test, nach OK Live.
