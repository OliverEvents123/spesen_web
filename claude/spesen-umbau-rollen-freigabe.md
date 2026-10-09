# Spesen-App — Umbau auf Rollen und Freigaben

Stand: **09.10.2026 — besprochen, noch nichts gebaut.**

Gehört zu `claude/spesen-stand.md`. Schaubild im Entwurf-Canvas:
https://claude.ai/artifact/56HzQkrwPfNkdS2YaL3Gmy (Artboard „Statusfluss")

Dieses Dokument hält fest, was Oli am 08./09.10. diktiert und in zwei Runden
nachgeschärft hat. Es ist die Vorlage für den Umbau in `claude.ai/code`.

## Warum überhaupt

Heute kann jeder angemeldete Benutzer jeden Beleg sehen und ändern, und ein
Beleg ist ab dem Speichern fertig. Es fehlt die Zwischenstufe: jemand muss
bestätigen, dass die Kontierung stimmt und — bei eigenem Geld — dass das Geld
zurückgezahlt wird. Dafür braucht es Rollen und einen Status am Beleg.

## Die vier Rollen

| Rolle | Sieht | Darf |
|---|---|---|
| **Admin** | alles | alles: Benutzer, Konten, Zuweisungen, Export, jeden Beleg |
| **Supervisor** | alle Belege **seiner Konten** | prüfen und genehmigen auf Konto-Ebene, über alle Aufträge hinweg |
| **Projektleiter** | alle Belege **seiner Auftragsnummern** | prüfen und genehmigen, Auftragsnummer und Kontierung korrigieren |
| **User** | nur seine eigenen Belege | erfassen, ändern **solange nicht eingereicht**, einreichen |

Supervisor und Projektleiter unterscheiden sich nur in der Achse, auf der sie
zuständig sind: der Supervisor über das **Konto** (also sachlich — „alle
Bewirtungen"), der Projektleiter über die **Auftragsnummer** (also nach
Veranstaltung).

Beide Zuweisungen sind Listen, nicht Einzelwerte: ein Projektleiter kann mehrere
Auftragsnummern haben, eine Auftragsnummer mehrere Projektleiter. Dasselbe für
Konten und Supervisoren.

## Der Weg eines Belegs

Gemeinsamer Anfang für alle Belege:

1. **Erfasst** — der User kann noch alles ändern und löschen.
2. Er tippt **„Zur Prüfung freigeben"**.
3. **Eingereicht** — für den User gesperrt, nur noch lesbar. Liegt beim
   Projektleiter der Auftragsnummer. Gibt es zu dieser Auftragsnummer keinen
   Projektleiter, läuft der Beleg ohne Prüfung durch.

Dann gabelt sich der Weg, und die Weggabelung ist die **Zahlungsart**. Der
Grundsatz dahinter, in Olis Worten: Firmengeld ist schon ausgegeben, eigenes
Geld noch nicht.

### Kreditkarte oder Bar — Firmengeld

Das Geld ist weg. Es geht nur noch um die Richtigkeit, nicht mehr um die Frage
ob. Darum gibt es hier **kein Ablehnen**, sondern:

- **Geprüft** — Kontierung stimmt, Beleg ist erledigt.
- **Zur Besprechung vermerkt** — mit Notiz. Fällt auf, wird im Gespräch
  geklärt, blockiert aber nichts und hält den Export nicht auf.

### Vorauskasse — eigenes Geld

Der Projektleiter entscheidet über die Rückerstattung:

- **Genehmigt** — voller Betrag wird zurückerstattet.
- **Teilweise genehmigt** — mit Betrag und Begründung. Olis Beispiel: Beleg
  80.00, davon 40.00 genehmigt. Der Rest zahlt der Mitarbeitende selbst.
- **Abgelehnt** — mit Grund. Der User sieht den Grund, kann korrigieren und neu
  einreichen.

## Weitere Festlegungen

**Auftragsnummer ändern beim Prüfen.** Der Projektleiter darf sie korrigieren.
Der Beleg verschwindet dann aus seiner Liste und taucht beim Projektleiter der
neuen Auftragsnummer auf — wieder ungeprüft. Niemand gibt also ungeprüft etwas
weiter, was danach bei ihm selbst erledigt aussieht.

**Protokoll.** Jeder Schritt wird mit Person und Zeitpunkt festgehalten, damit
später nachvollziehbar bleibt, wer was entschieden hat. Das ist derselbe
Punkt, der in `spesen-stand.md` schon als „Protokoll für Änderungen an Belegen"
offen stand — hier wird er zur Pflicht, nicht zur Zugabe.

**Auftragsnummer gehört zu einem Konto.** Oli: „Dann gehört immer eine
Auftragsnummer fest zu einem Konto." Wenn das so ist, muss der User beim
Erfassen das Konto nicht mehr wählen — es ergibt sich aus der Auftragsnummer.
Das würde die Erfassung deutlich kürzer machen. **Davon hängt ab, wie das
Formular aussieht**, darum ist es die erste der offenen Fragen unten.

**Karten je Kostenstelle lösen das Gerätethema.** Heute hängen Belege und
Favoriten am **Gerät** (`geraet = auth.jwt() ->> 'email'`), weil mehrere Leute
dasselbe Eventhandy benutzen. Wenn jede Kostenstelle ihre eigene Kreditkarte
hat, lässt sich ein Beleg über die Karte zuordnen statt über das Gerät — und
die Frage „wer war das eigentlich" löst sich von selbst. Das ist Etappe 3.

## Umbau in vier Etappen

Bewusst in dieser Reihenfolge, damit nach jeder Etappe eine lauffähige App
steht und nicht ein halber Umbau.

### Etappe 1 — Status am Beleg

Spalte `status` in `spesen_beleg` mit Vorgabe `erfasst`, dazu `eingereicht_am`.
Knopf „Zur Prüfung freigeben". RLS so erweitern, dass der User einen
eingereichten Beleg nicht mehr ändern kann. Status in der Belegliste als farbige
Marke. Noch keine Prüfer — alles wird eingereicht und bleibt dort liegen.

Kleinste Etappe, grösster Nutzen: ab hier ist klar, welche Belege fertig sind.

### Etappe 2 — Projektleiter

Tabelle `spesen_zuweisung` (E-Mail × Auftragsnummer). Neue Rolle
`projektleiter`. Neue Ansicht „Zur Freigabe" mit der Liste der eigenen
Auftragsnummern. Die Entscheidungen: geprüft / zur Besprechung vermerkt /
genehmigt / teilweise genehmigt / abgelehnt, je nach Zahlungsart. Felder
`genehmigt_betrag`, `entscheid_grund`, `entscheid_von`, `entscheid_am`.
Protokolltabelle `spesen_verlauf`.

Grösste Etappe. Hier entsteht der eigentliche Mehrwert.

### Etappe 3 — Karten je Kostenstelle

Tabelle `spesen_karte` (Bezeichnung, letzte vier Stellen, Konto bzw.
Kostenstelle). Auswahlfeld beim Erfassen, wenn die Zahlungsart Kreditkarte ist.
Danach lässt sich die Zuordnung über die Karte statt über das Gerät machen, und
der Abgleich mit der Kartenabrechnung wird überhaupt erst möglich.

### Etappe 4 — Supervisor

Tabelle `spesen_zuweisung_konto` (E-Mail × Kontonummer), Rolle `supervisor`,
dieselbe Freigabeansicht wie beim Projektleiter, nur über die andere Achse
gefiltert. Technisch die kleinste Etappe, weil Etappe 2 die Maschinerie schon
gebaut hat — darum zuletzt.

## Entscheide vom 09.10.2026

- **Frage 1 — Konto aus der KST?** Nein. FileMaker liefert kein Konto, und es
  braucht keines: die Kostenstelle (Auftragsnummer) ist die Referenz, das Konto
  wählt der User beim Erfassen weiterhin selbst. Die Kontoauswahl bleibt.
- **Frage 2 — Teilgenehmigung.** Der Projektleiter tippt „Teilweise
  genehmigen", gibt den genehmigten Betrag ein (z. B. 45.00 von 60.00) und
  einen Kommentar (z. B. „weniger, da Alkohol"). Betrag und Kommentar sind
  Pflicht. Noch offen: was davon im Export/DocuWare gebucht wird.

## Offene Fragen, vor dem Bauen zu klären

1. **Liefert FileMaker zu einer Auftragsnummer das Konto mit?** Wenn ja, fällt
   die Kontoauswahl beim Erfassen weg. Wenn nein, braucht es eine eigene
   Zuordnungstabelle in Supabase — oder das Konto bleibt frei wählbar. Zu
   prüfen an der Edge Function `auftragsnummern`: welche Felder gibt das
   FileMaker-Layout überhaupt her.

   *Stand 09.10. nach Blick in `supabase/functions/auftragsnummern`:* Die
   Function liest `ANr_ID`, `ANr_Name`, `ANr_Jahr`, `d_VorgabeKategorie_t`
   (Kategorien Admin/Event/Lager) und `Veranstaltungen` — **kein Konto**. Ob
   FileMaker ein Kontofeld hat, das man aufs Layout `api_auftragsnr` legen
   könnte, ist in FileMaker zu prüfen.
2. **Welcher Betrag wird bei einer Teilgenehmigung gebucht?** Beispiel 80.00
   Beleg, 40.00 genehmigt. Drei denkbare Antworten, und sie führen zu
   verschiedenen Exporten:
   - nur die 40.00 kommen in die Buchhaltung, die anderen 40.00 sind privat;
   - die 80.00 werden gebucht und die 40.00 als Lohnabzug gegengebucht;
   - der Beleg wird in zwei Positionen aufgeteilt — dafür gibt es in
     `spesen_beleg.positionen` schon die Technik.

   **Diese Frage entscheidet mehr als sie aussieht**, weil sie bestimmt, was
   `export.js` ausgibt. Ohne Antwort keine Etappe 2.

3. Dürfen Admins einen eingereichten Beleg zurück auf „erfasst" setzen? Ein
   Rückweg für Versehen wäre wohl nötig.
4. Soll der User beim Entscheid eine Nachricht bekommen (Mail), oder sieht er
   es nur in der App?

## Arbeitsweise für diesen Umbau

Oli: „Dann probiert es mal zu bauen, oder?" — aber gebaut wird erst, wenn
Frage 1 und 2 beantwortet sind, sonst wird zweimal gebaut.

Weil der Umbau quer durch alle Dateien geht und dazu SQL braucht, gehört er
nach `claude.ai/code` mit Schreibzugriff aufs Repo. Jede Etappe als eigener
Branch, in `test/` ausprobieren, dann nach `main`.
