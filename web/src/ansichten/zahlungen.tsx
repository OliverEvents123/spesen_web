// zahlungen.tsx
// Nur Admin: User-Zahlungen zurückbezahlen (alle 2 Wochen von Hand per Bank).
// Drei Reiter:
//   Zu bezahlen        — genehmigt, noch nicht bezahlt. Je Person mit Summe
//                        (das ist der Betrag für die Überweisung). Anhaken,
//                        Zahltag wählen, "Als bezahlt markieren".
//   In Prüfung         — noch nicht genehmigt: erfasst, eingereicht, zur Besprechung.
//   Bezahlt            — nach Zahltag, je Person; einzeln zurücknehmbar.
// Unabhängig vom Zeitraum der Übersicht.

import { S } from "../zustand";
import { istBreit, chfLang, kurzDatum, langDatum, buchungsBetrag, heute } from "../grundlagen";
import { personName, zuBezahlen, zahlungInPruefung, nachPerson } from "../daten";
import { Seite } from "./rahmen";
import { Knopf, Hinweis, StatusMarke, BetragZelle, Reiterleiste, belegKopf, belegText } from "./bausteine";

const anzahlText = (n: number) => n === 1 ? "1 Beleg" : `${n} Belege`;
const summe = (l: any[]) => l.reduce((t, b) => t + buchungsBetrag(b), 0);
const gewaehlt = (b: any) => S.zAuswahl.includes(String(b.id));

// Ein Beleg. wahl: mit Kästchen (Zu bezahlen) — die ganze Zeile hakt an.
// Die Kästchen sind ungesteuert (wie überall in der App) und entstehen über
// key neu, wenn sich die Auswahl von aussen ändert ("Alle anhaken").
function Zeile({ b, wahl, rechts }: { b: any; wahl?: boolean; rechts?: any }) {
  const inhalt = <>
    {wahl && <input type="checkbox" defaultChecked={gewaehlt(b)} key={gewaehlt(b) ? "ja" : "nein"}
                    data-feld="zwahl" data-id={b.id} aria-label={`${belegKopf(b)} anhaken`} />}
    <span className="mitte"><b>{belegKopf(b)}</b>
      <span className="kn mu">{kurzDatum(b.beleg_datum)} · {belegText(b)}</span>
      {b.kommentar && <span className="kn kommentar">„{b.kommentar}“</span>}</span>
    {b.datei_pfad && <button className="link kn" data-akt="belegAuf" data-p={b.datei_pfad}>Beleg</button>}
    <span className="seite"><BetragZelle b={b} /><StatusMarke b={b} kurz /></span>
    {rechts}
  </>;
  return wahl ? <label className={"zl zahlzeile" + (gewaehlt(b) ? " an" : "")}>{inhalt}</label>
              : <div className="zl zahlzeile">{inhalt}</div>;
}

// Kopf einer Person: Name, Anzahl, Summe — bei "Zu bezahlen" mit Kästchen für alle
function PersonKopf({ g, wahl }: { g: any; wahl?: boolean }) {
  const alle = g.belege.every(gewaehlt);
  const name = <b>{personName(g.person)}</b>;
  return (
    <div className="kartenkopf zahlkopf">
      {wahl
        ? <label className="zahlperson"><input type="checkbox" defaultChecked={alle} key={alle ? "ja" : "nein"}
                                               data-feld="zwahlp" data-p={g.person}
                                               aria-label={`Alle von ${personName(g.person)} anhaken`} />{name}</label>
        : <span className="zahlperson">{name}</span>}
      <span className="sub">{anzahlText(g.belege.length)} · <b className="mono">CHF {chfLang(g.summe)}</b></span>
    </div>);
}

function ZuBezahlen({ offen }: { offen: any[] }) {
  const auswahl = offen.filter(gewaehlt);
  if (!offen.length) return <div className="karte leer">Nichts zu bezahlen. Neu genehmigte User-Zahlungen erscheinen hier.</div>;
  return <>
    {S.zahlungenDa
      ? <section className="karte innen zahlleiste">
          <span className="zahlwahl">{auswahl.length
            ? <span><b>{anzahlText(auswahl.length)} angehakt</b> · <b className="mono">CHF {chfLang(summe(auswahl))}</b></span>
            : <span className="mu">Anhaken, was du überwiesen hast — einzeln, je Person oder alle.</span>}
            <span className="zahllinks">
              <button className="link" data-akt="zAlle" data-v="1" disabled={auswahl.length === offen.length}>Alle anhaken</button>
              {auswahl.length > 0 && <button className="link" data-akt="zAlle" data-v="0">Keine</button>}
            </span></span>
          <label className="wz-feld"><span>Bezahlt am</span>
            <input type="date" defaultValue={S.zDatum || heute()} key={S.zDatum || "heute"} data-feld="zdatum" /></label>
          <Knopf akt="zBezahlt" className="k1 klein" disabled={!auswahl.length}>Als bezahlt markieren</Knopf>
        </section>
      : <Hinweis>Zum Abhaken als bezahlt zuerst <b>supabase/user-zahlungen.sql</b> im SQL Editor ausführen.</Hinweis>}
    {nachPerson(offen).map((g) => (
      <section className="karte huelle" key={g.person}>
        <PersonKopf g={g} wahl={S.zahlungenDa} />
        {g.belege.map((b) => <Zeile b={b} wahl={S.zahlungenDa} key={b.id} />)}
      </section>))}
  </>;
}

function InPruefung({ liste }: { liste: any[] }) {
  if (!liste.length) return <div className="karte leer">Keine User-Zahlungen in Prüfung.</div>;
  return <>
    <Hinweis>Noch nicht genehmigt (erfasst, eingereicht oder zur Besprechung) — erscheinen unter
      „Zu bezahlen“, sobald sie genehmigt sind.</Hinweis>
    {nachPerson(liste).map((g) => (
      <section className="karte huelle" key={g.person}>
        <PersonKopf g={g} />
        {g.belege.map((b) => <Zeile b={b} key={b.id} />)}
      </section>))}
  </>;
}

// Bezahlt: je Zahltag eine Karte, darin je Person
function Bezahlt({ liste }: { liste: any[] }) {
  if (!liste.length) return <div className="karte leer">Noch nichts als bezahlt markiert.</div>;
  const tage = [...new Set(liste.map((b) => b.bezahlt_am))].sort().reverse();
  return <>
    {tage.map((tag) => {
      const amTag = liste.filter((b) => b.bezahlt_am === tag);
      return (
        <section className="karte huelle" key={tag}>
          <div className="kartenkopf">
            <h2>Zahlung vom {langDatum(tag)}</h2>
            <span className="sub">{anzahlText(amTag.length)} · <b className="mono">CHF {chfLang(summe(amTag))}</b></span>
          </div>
          {nachPerson(amTag).map((g) => <div key={g.person}>
            <div className="zahlunter"><b>{personName(g.person)}</b>
              <span className="mono">CHF {chfLang(g.summe)}</span></div>
            {g.belege.map((b) => <Zeile b={b} key={b.id}
              rechts={<button className="link kn" data-akt="zZurueck" data-id={b.id}
                              title={b.bezahlt_von ? "Markiert von " + personName(b.bezahlt_von) : undefined}>
                        Zurücknehmen</button>} />)}
          </div>)}
        </section>);
    })}
  </>;
}

export function Zahlungen() {
  const offen = S.zahlungen.filter(zuBezahlen);
  const pruefung = S.zahlungen.filter(zahlungInPruefung);
  const bezahlt = S.zahlungen.filter((b) => b.bezahlt_am);
  const reiter = S.zReiter || "offen";
  const reiterListe = [
    { v: "offen", lab: "Zu bezahlen", n: offen.length },
    { v: "pruefung", lab: "In Prüfung", n: pruefung.length },
    ...(S.zahlungenDa ? [{ v: "bezahlt", lab: "Bezahlt", n: bezahlt.length }] : [])
  ];
  const summeText = <><b>CHF {chfLang(summe(offen))}</b><span className="kn mu">noch zu bezahlen</span></>;
  return (
    <Seite titel="User-Zahlungen" sub="Administration" pfad="Zurückbezahlen an die Personen" tab>
      {istBreit() ? <Reiterleiste f="zReiter" reiter={reiterListe} rechts={summeText} />
        : <><Reiterleiste f="zReiter" reiter={reiterListe} /><div className="summenzeile">{summeText}</div></>}
      {reiter === "offen" && <ZuBezahlen offen={offen} />}
      {reiter === "pruefung" && <InPruefung liste={pruefung} />}
      {reiter === "bezahlt" && <Bezahlt liste={bezahlt} />}
    </Seite>);
}
