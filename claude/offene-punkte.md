# Offene Punkte

Stand 09.10.2026. Beim Durchsehen des Codes aufgefallen, bewusst noch nicht
geändert.

## Mit dem Umbau klären

- **Aufgeteilte Belege in Belegliste, CSV und PDF-Kopfzeile** zeigen Konto,
  Auftrag und MwSt nur der *ersten* Position. Die Kontierung stimmt. Hängt an
  der Frage, wie eine Teilgenehmigung exportiert wird
  (`spesen-umbau-rollen-freigabe.md`, offene Frage 2).
- **Testumgebung teilt die Datenbank** mit der echten App. Getrennte
  Supabase-Projekte geplant; der Code ist dafür vorbereitet (`konfig.js`).

## Klären

- **Auftragsnummern nur fürs laufende Jahr.** Die App ruft
  `auftragsnummern?jahr=<laufendes Jahr>` auf. Die Function sucht in FileMaker
  `ANr_Jahr == jahr` **oder** eine der Nummern in `IMMER_DABEI`. Im Januar
  fehlen also alle Aufträge des Vorjahrs — ein Dezember-Beleg, der erst im
  Januar erfasst wird, lässt sich keinem Dezember-Event zuordnen. Lösung in der
  App möglich (Anfang Jahr zusätzlich das Vorjahr laden), Function bleibt gleich.

## Anmerken

- **Ladefehler werden verschluckt.** Scheitert das Laden (kein Netz, Sitzung
  abgelaufen), zeigt die App einfach „Keine Belege" statt eines Hinweises
  (`ladeAlles`, `ladeUebersicht` in `daten.js`).

- **Edge Function `benutzer`:** Die Aktionen `rolle` und `aktiv` prüfen die
  Antwort der Datenbank nicht — scheitert das Speichern, meldet sie trotzdem
  „ok". Kennt nur die Rollen `admin` und `user` (Umbau: erweitern).
- **Gesperrte Benutzer** können noch bis zu einer Stunde weiterarbeiten: die
  Sperre greift bei der nächsten Token-Erneuerung, und die RLS prüft
  `spesen_benutzer.aktiv` nicht.

- **Admin ersetzt die Datei eines fremden Belegs:** Die neue Datei landet im
  Ordner des Admins, die alte bleibt liegen — löschen darf jeder nur im
  eigenen Ordner (Storage-Policy `beleg_datei_loeschen`).
- **Admin kann fremde Belege nicht löschen** (Policy `beleg_loeschen`), nur
  ändern. Die App meldet das seit 09.10. korrekt. Gewollt? Beim Umbau klären.
- `spesen_konto` hat eine doppelte Lese-Policy (`konto_lesen_alle`), kann weg.
- Tabelle `spesen_admin` ist Altlast, kann nach Prüfung weg.

## Bewusst so gelassen

- „Meine Belege" zeigt den Kalendermonat, nicht die Abrechnungsperiode
  16.–15. Für andere Zeiträume gibt es die gespeicherten Perioden.
