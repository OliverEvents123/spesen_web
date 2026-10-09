# Offene Punkte

Stand 09.10.2026. Beim Durchsehen des Codes aufgefallen, bewusst noch nicht
geändert.

## Mit dem Umbau klären

- **Aufgeteilte Belege in Belegliste, CSV und PDF-Kopfzeile** zeigen Konto,
  Auftrag und MwSt nur der *ersten* Position. Die Kontierung stimmt. Hängt an
  der Frage, wie eine Teilgenehmigung exportiert wird
  (`spesen-umbau-rollen-freigabe.md`, offene Frage 2).

## Klären

- (nichts offen)

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

- Auftragsnummern: laufendes Jahr **und** ganzes Vorjahr (entschieden 09.10.,
  in test/ geprüft, `ladeAuftraege` in `daten.js`).

- „Meine Belege" zeigt den Kalendermonat, nicht die Abrechnungsperiode
  16.–15. Für andere Zeiträume gibt es die gespeicherten Perioden.
