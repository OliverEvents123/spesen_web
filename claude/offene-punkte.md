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

- **Auftragsnummern nur fürs laufende Jahr.** Die App ruft die Edge Function
  `auftragsnummern` mit `?jahr=<laufendes Jahr>` auf. Was die Function damit
  filtert, steht in ihrem Code (liegt nicht im Repo). Im Januar fehlen
  womöglich die Aufträge vom Dezember.

## Anmerken

- **Ladefehler werden verschluckt.** Scheitert das Laden (kein Netz, Sitzung
  abgelaufen), zeigt die App einfach „Keine Belege" statt eines Hinweises
  (`ladeAlles`, `ladeUebersicht` in `daten.js`).

## Bewusst so gelassen

- „Meine Belege" zeigt den Kalendermonat, nicht die Abrechnungsperiode
  16.–15. Für andere Zeiträume gibt es die gespeicherten Perioden.
