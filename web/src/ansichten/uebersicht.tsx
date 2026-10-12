// uebersicht.tsx
// Die zwei Hauptseiten: "Meine Belege" (eigene Belege der Periode, Aufgaben,
// Favoriten) und "Übersicht" (Kontierung, Export, alle sichtbaren Belege).
// Beide gibt es für Handy und Rechner.

import { S } from "../zustand";
import {
  istBreit, chf, chfLang, buchungsBetrag, statusVon, auftragAnzeige, MAX_KACHELN
} from "../grundlagen";
import {
  kontoName, uGefiltert, gruppiere, uTitel, eigeneErfasste, istErledigt, personName
} from "../daten";
import { Seite } from "./rahmen";
import {
  Ico, Knopf, Kachel, Farbkarte, Balken, PeriodeWahl, PeriodeKlein, ZeitraumRechner,
  FilterChips, FilterFelder, FilterKnopf, BelegZeile, BelegTabelle, KnopfFreigeben,
  VerlaufListe, belegKopf, belegeSuchen, eigenerName, kstName, zeitraumText
} from "./bausteine";

const summe = (liste: any[]) => liste.reduce((t, b) => t + buchungsBetrag(b), 0);
const anzahlText = (n: number) => n === 1 ? "1 Beleg" : `${n} Belege`;

// ---------- Aufgaben: abgelehnt, nicht freigegeben, warten auf mich ----------
const abgelehnte  = () => S.offeneEigene.filter((b) => statusVon(b) === "abgelehnt");
const unfreigegeben = () => eigeneErfasste(S.offeneEigene);

function WartetAufMich() {
  if (!S.istPruefer || !S.freigabe.length) return null;
  const vk = S.freigabe.filter((b) => b.zahlart === "vorkasse").length;
  return (
    <div className="wartet">
      <span className="nr">{S.freigabe.length}</span>
      <span style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        <b>{S.freigabe.length === 1 ? "Beleg wartet" : "Belege warten"} auf dich</b>
        <span className="kn" style={{ color: "#9ba1bb" }}>
          {vk} Vorauskasse · {S.freigabe.length - vk} Kreditkarte/Bar</span></span>
      <button className="k1 klein" data-akt="tabFreigabe" style={{ boxShadow: "none" }}>Prüfen</button>
    </div>);
}

function Aufgaben() {
  const abg = abgelehnte(), unf = unfreigegeben();
  return <>
    {abg.slice(0, 3).map((b) => (
      <div className="karte aufgabe rot" key={b.id}>
        <span className="mitte"><b>Abgelehnt: {belegKopf(b)} {chfLang(b.betrag)}</b>
          {b.entscheid_grund && <span className="kn mu">„{b.entscheid_grund}“</span>}</span>
        <button className="kd klein" data-akt="bearbeiten" data-id={b.id} data-w="liste">Ansehen</button>
      </div>))}
    {unf.length > 0 &&
      <div className="karte aufgabe">
        <span className="mitte"><span><b>{anzahlText(unf.length)}</b> noch nicht zur Prüfung freigegeben</span></span>
        <Knopf akt="freigebenAlle" data-w="offene" className="kd klein">Freigeben</Knopf>
      </div>}
  </>;
}

function FavoritenLeiste() {
  if (!S.favoriten.length)
    return <button className="link" data-akt="zuFavoriten" style={{ alignSelf: "center" }}>Favoriten einrichten</button>;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span className="kl">Favoriten</span><button className="link" data-akt="zuFavoriten">Verwalten</button></div>
      <div className="favleiste">
        {S.favoriten.slice(0, MAX_KACHELN).map((f) => (
          <button className="fav" data-akt="favAnwenden" data-id={f.id} key={f.id}>
            <b>{f.name}</b><span>{f.konto_nummer} · {auftragAnzeige(f.auftrag_nr)}</span></button>))}
      </div>
    </div>);
}

// ---------- Meine Belege ----------
export function MeineBelege() {
  const liste = S.belege;
  const total = summe(liste);
  const unf = unfreigegeben(), abg = abgelehnte();

  if (istBreit()) {
    const gesucht = belegeSuchen(liste);
    return (
      <Seite titel="Meine Belege" pfad="Spesen / Meine Belege" tab rechts={<PeriodeKlein />}>
        <ZeitraumRechner />
        <section className="kacheln">
          <Kachel lab="Belege" wert={liste.length} fuss="in dieser Periode" farbe="blau" icon="doc" />
          <Kachel lab="Total" wert={"CHF " + chfLang(total)} fuss="wie gebucht" farbe="dunkel" icon="geld" />
          <Kachel lab="Nicht freigegeben" wert={unf.length} fuss="erst bei dir" farbe="orange" icon="uhr" />
          <Kachel lab="Abgelehnt" wert={abg.length} fuss="korrigieren oder löschen" farbe="rot" icon="warn" />
        </section>
        <section className="farbkarten">
          <Farbkarte farbe="blau" titel="Neuer Beleg" sub="Datei ablegen öffnet direkt das Erfassen">
            <button className="ablagefeld ablage" data-akt="waehlen">
              <Ico n="hoch" /><b style={{ fontSize: 16 }}>Beleg hierher ziehen</b>
              <span className="kn" style={{ opacity: .85 }}>oder klicken: PDF oder Bild wählen</span></button>
          </Farbkarte>
          <Farbkarte farbe="orange" titel="Zu erledigen" sub="deine offenen Punkte">
            {!abg.length && !unf.length && !(S.istPruefer && S.freigabe.length)
              ? <span>Alles erledigt.</span> : <>
              {abg.slice(0, 2).map((b) => (
                <button className="farbzeile" key={b.id} data-akt="bearbeiten" data-id={b.id} data-w="liste">
                  <span>Abgelehnt: {belegKopf(b)}</span><span className="mono">{chfLang(b.betrag)}</span></button>))}
              {unf.length > 0 &&
                <div className="farbzeile"><span>{anzahlText(unf.length)} nicht freigegeben</span>
                  <Knopf akt="freigebenAlle" data-w="offene" className="k2 klein fett"
                         style={{ color: "#a3400a", border: 0 }}>Freigeben</Knopf></div>}
              {S.istPruefer && S.freigabe.length > 0 &&
                <button className="farbzeile" data-akt="tabFreigabe">
                  <span>{S.freigabe.length} warten auf deine Freigabe</span><span>›</span></button>}
            </>}
          </Farbkarte>
          <Farbkarte farbe="dunkel" titel="Favoriten" sub="ein Klick setzt Konto und KST"
                     unten={<button className="link" data-akt="zuFavoriten">Verwalten</button>}>
            {S.favoriten.length
              ? S.favoriten.slice(0, 4).map((f) => (
                <button className="farbzeile" key={f.id} data-akt="favAnwenden" data-id={f.id}
                        style={{ background: "rgba(255,255,255,.08)" }}>
                  <span>{f.name}</span><span className="mono kn" style={{ color: "#c9cde0" }}>
                    {f.konto_nummer} · {auftragAnzeige(f.auftrag_nr)}</span></button>))
              : <span>Noch keine Favoriten.</span>}
          </Farbkarte>
        </section>
        <section className="karte">
          <div className="kartenkopf">
            <span><h2>Belege der Periode</h2><span className="sub">{zeitraumText()} · {anzahlText(liste.length)}</span></span>
            <span style={{ display: "flex", gap: 8 }}>
              <input type="search" placeholder="Suchen" aria-label="Belege durchsuchen" defaultValue={S.bSuche}
                     data-feld="bsuche" style={{ width: 200, minHeight: 40 }} />
              <KnopfFreigeben liste={liste} woher="liste" />
            </span>
          </div>
          <BelegTabelle liste={gesucht} woher="liste" />
        </section>
      </Seite>);
  }

  return (
    <Seite titel="Meine Belege" sub={eigenerName()} tab>
      <WartetAufMich />
      <PeriodeWahl />
      <div className="kacheln">
        <Kachel lab="Belege" wert={liste.length} fuss="in dieser Periode" farbe="blau" icon="doc" />
        <Kachel lab="Total" wert={chfLang(total)} fuss="CHF, wie gebucht" farbe="gruen" icon="geld" />
      </div>
      <Aufgaben />
      <FavoritenLeiste />
      <section className="karte huelle">
        <div className="kartenkopf"><h2 style={{ fontSize: 16 }}>Belege der Periode</h2>
          <span className="sub">antippen zum Öffnen</span></div>
        {liste.length === 0 ? <div className="leer">Noch keine Belege in dieser Periode.</div>
          : liste.map((b) => <BelegZeile b={b} woher="liste" key={b.id} />)}
      </section>
    </Seite>);
}

// ---------- Übersicht ----------
// Summen je KST oder Konto für die Balken
function summeJe(gruppen: any[], feld: "auftrag" | "konto") {
  const m = new Map<string, number>();
  for (const g of gruppen) m.set(g[feld], (m.get(g[feld]) || 0) + g.brutto);
  return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4)
    .map(([k, w]) => ({ name: feld === "auftrag" ? kstName(k) : `${k} ${kontoName(k)}`, wert: w }));
}

function KontierungTabelle({ gruppen }: { gruppen: any[] }) {
  const t = (f: string) => gruppen.reduce((s, g) => s + g[f], 0);
  return (
    <div className="tabelle"><table>
      <thead><tr>
        <th>Konto</th><th>Bezeichnung</th><th>KST</th><th>MwSt</th><th>Bezahlt</th>
        <th className="re">Posten</th><th className="re">Brutto</th><th className="re">MwSt</th><th className="re">Netto</th>
      </tr></thead>
      <tbody>
        {gruppen.map((g, i) => (
          <tr key={i}>
            <td className="mono fett">{g.konto}</td><td>{g.bezeichnung}</td>
            <td className="mono nw">{auftragAnzeige(g.auftrag)}</td><td className="mono nw">{g.satz} %</td>
            <td className="nw">{({ karte: "Kreditkarte", bar: "Bar", vorkasse: "Vorauskasse" } as any)[g.zahlart] || g.zahlart}</td>
            <td className="re mono">{g.anzahl}</td><td className="re mono fett">{chfLang(g.brutto)}</td>
            <td className="re mono">{chfLang(g.steuer)}</td><td className="re mono">{chfLang(g.netto)}</td>
          </tr>))}
        <tr className="summe">
          <td colSpan={5}>Total</td><td className="re mono">{t("anzahl")}</td><td className="re mono">{chfLang(t("brutto"))}</td>
          <td className="re mono">{chfLang(t("steuer"))}</td><td className="re mono">{chfLang(t("netto"))}</td>
        </tr>
      </tbody>
    </table></div>);
}

// Am Handy: Karten statt einer Tabelle mit neun Spalten
function KontierungKarten({ gruppen }: { gruppen: any[] }) {
  const t = (f: string) => gruppen.reduce((s, g) => s + g[f], 0);
  return (
    <section className="karte huelle">
      <div className="kartenkopf"><h2 style={{ fontSize: 16 }}>Kontierung</h2><span className="sub">wie im PDF</span></div>
      {gruppen.map((g, i) => (
        <div className="zl" key={i} style={{ alignItems: "flex-start" }}>
          <span className="mitte"><b><span className="mono">{g.konto}</span> {g.bezeichnung}</b>
            <span className="kn mu">KST {auftragAnzeige(g.auftrag)} · {g.satz} % · {({ karte: "Kreditkarte", bar: "Bar", vorkasse: "Vorauskasse" } as any)[g.zahlart] || g.zahlart} · {g.anzahl} Posten</span></span>
          <span className="seite"><span className="betragz">{chfLang(g.brutto)}</span>
            <span className="mono kn mu">MwSt {chfLang(g.steuer)}</span></span>
        </div>))}
      <div className="zl" style={{ background: "var(--flaeche)" }}>
        <b style={{ flex: 1 }}>Total · {t("anzahl")} Posten</b>
        <span className="seite"><span className="betragz">{chfLang(t("brutto"))}</span>
          <span className="mono kn mu">MwSt {chfLang(t("steuer"))} · netto {chfLang(t("netto"))}</span></span>
      </div>
    </section>);
}

function ExportKnoepfe({ hell }: { hell?: boolean }) {
  return (
    <div style={{ display: "flex", gap: 8 }}>
      <Knopf akt="expPdf" className="k2 fett" style={{ flex: 1, border: 0, color: "#3a49b0" }}>
        <Ico n="runter" s={18} /> PDF für DocuWare</Knopf>
      <button className="k2" data-akt="expCsv"
              style={hell ? undefined : { background: "transparent", color: "#fff", borderColor: "rgba(255,255,255,.6)" }}>CSV</button>
    </div>);
}

export function Uebersicht() {
  const gefiltert = uGefiltert();
  const ohneStatus = uGefiltert(true);
  const gruppen = gruppiere(gefiltert);
  const brutto = gruppen.reduce((s, g) => s + g.brutto, 0);
  const mwst = gruppen.reduce((s, g) => s + g.steuer, 0);
  const erledigt = ohneStatus.filter(istErledigt).length;
  const offen = ohneStatus.length - erledigt;
  const wer = S.istAdmin ? "alle Personen" : S.istPruefer ? "deine und zugewiesene Belege" : "deine Belege";
  const offenFuss = S.istPruefer
    ? <><b style={{ color: "#c2410c" }}>{S.freigabe.length}</b> warten auf dich</>
    : <>{eigeneErfasste(ohneStatus).length} noch nicht freigegeben</>;

  const kacheln = <>
    <Kachel lab="Brutto" wert={(istBreit() ? "CHF " : "") + chfLang(brutto)} farbe="dunkel" icon="geld"
            fuss={anzahlText(gefiltert.length) + (S.uStatus ? " · gefiltert" : "")} akt="kachel" v="" an={false} />
    <Kachel lab="MwSt" wert={(istBreit() ? "CHF " : "") + chfLang(mwst)} fuss="auf Gruppensumme gerechnet"
            farbe="blau" icon="grid" />
    <Kachel lab="Erledigt" wert={erledigt} fuss="geprüft oder entschieden" farbe="gruen" icon="check"
            akt="kachel" v="erledigt" an={S.uStatus === "erledigt"} />
    <Kachel lab="Offen" wert={offen} fuss={offenFuss} farbe="orange" icon="uhr"
            akt="kachel" v="unerledigt" an={S.uStatus === "unerledigt"} />
  </>;

  const leerOderLaedt = S.uLaedt ? <div className="karte leer">Lade …</div>
    : gefiltert.length === 0 ? <div className="karte leer">Keine Belege für diese Auswahl.</div> : null;

  if (istBreit()) {
    const gesucht = belegeSuchen(gefiltert);
    return (
      <Seite titel={"Übersicht · " + wer} pfad="Spesen / Übersicht" tab
             rechts={<><PeriodeKlein /><FilterKnopf /></>}>
        <ZeitraumRechner />
        <FilterFelder />
        <div className="chips" style={{ marginTop: -8 }}><FilterChips />
          <span className="kn mu">Die Kacheln Erledigt und Offen filtern per Klick.</span></div>
        <section className="kacheln">{kacheln}</section>
        <section className="farbkarten">
          <Farbkarte farbe="dunkel" titel="Nach Kostenstelle" sub="Brutto im Zeitraum, wie gebucht">
            <Balken zeilen={summeJe(gruppen, "auftrag")} /></Farbkarte>
          {S.istPruefer
            ? <Farbkarte farbe="orange" titel="Wartet auf Freigabe" sub={anzahlText(S.freigabe.length)}
                         unten={<button className="kd klein" data-akt="tabFreigabe">Prüfen</button>}>
                {S.freigabe.length ? S.freigabe.slice(0, 3).map((b) => (
                  <button className="farbzeile" key={b.id} data-akt="bearbeiten" data-id={b.id} data-w="freigabe">
                    <span>{personName(b.geraet)} · {belegKopf(b)}</span><span className="mono">{chfLang(b.betrag)}</span></button>))
                  : <span>Nichts zu prüfen.</span>}
              </Farbkarte>
            : <Farbkarte farbe="orange" titel="Nach Konto" sub="Brutto im Zeitraum, wie gebucht">
                <Balken zeilen={summeJe(gruppen, "konto")} /></Farbkarte>}
          <Farbkarte farbe="blau" titel="Export" sub="folgt Zeitraum und Filter">
            <span style={{ display: "flex", flexDirection: "column" }}>
              <span className="kn" style={{ opacity: .85 }}>{zeitraumText()}</span>
              <b className="mono" style={{ fontSize: 21 }}>{anzahlText(gefiltert.length)} · {chfLang(brutto)}</b></span>
            {gefiltert.length > 0 && <ExportKnoepfe />}
          </Farbkarte>
        </section>
        {leerOderLaedt || <>
          <section className="karte">
            <div className="kartenkopf"><span><h2>Kontierung</h2><span className="sub">{uTitel()}</span></span></div>
            <KontierungTabelle gruppen={gruppen} />
          </section>
          <section className="karte">
              <div className="kartenkopf">
                <span><h2>Belege</h2><span className="sub">{anzahlText(gefiltert.length)} · ältester zuerst</span></span>
                <span style={{ display: "flex", gap: 8 }}>
                  <input type="search" placeholder="Suchen" aria-label="Belege durchsuchen" defaultValue={S.bSuche}
                         data-feld="bsuche" style={{ width: 200, minHeight: 40 }} />
                  <KnopfFreigeben liste={gefiltert} woher="uebersicht" />
                </span>
              </div>
              <BelegTabelle liste={gesucht} woher="uebersicht" person={S.istAdmin || S.istPruefer} />
          </section>
          {S.istPruefer &&
            <section className="karte innen">
              <span><h2 style={{ fontSize: 17 }}>Verlauf</h2>
                <span className="kn mu">{S.istAdmin ? "letzte Schritte, alle Belege" : "letzte Schritte deiner Kostenstellen und eigenen Belege"}</span></span>
              <div className="verlaufgitter"><VerlaufListe anzahl={12} /></div>
            </section>}
        </>}
      </Seite>);
  }

  return (
    <Seite titel="Übersicht" sub={wer} tab>
      <PeriodeWahl />
      <div className="filterleiste"><FilterKnopf /><FilterChips /></div>
      <FilterFelder />
      <div className="kacheln">{kacheln}</div>
      {leerOderLaedt || <>
        <KontierungKarten gruppen={gruppen} />
        <section className="karte f-blau" style={{ padding: 16, color: "#fff", display: "flex", flexDirection: "column", gap: 10 }}>
          <b style={{ fontSize: 17 }}>Export für DocuWare</b>
          <span style={{ fontSize: 14, opacity: .9 }}>PDF mit Kontierung vorn und allen {anzahlText(gefiltert.length)} dahinter.</span>
          <ExportKnoepfe />
        </section>
        <section className="karte huelle">
          <div className="kartenkopf"><h2 style={{ fontSize: 16 }}>Einzelne Belege</h2>
            <KnopfFreigeben liste={gefiltert} woher="uebersicht" /></div>
          {gefiltert.map((b) => <BelegZeile b={b} woher="uebersicht" person={S.istAdmin || S.istPruefer} key={b.id} />)}
        </section>
      </>}
      {S.istPruefer &&
        <section className="karte innen">
          <span><h2 style={{ fontSize: 16 }}>Verlauf</h2><span className="kn mu">letzte Schritte</span></span>
          <VerlaufListe anzahl={8} />
        </section>}
    </Seite>);
}
