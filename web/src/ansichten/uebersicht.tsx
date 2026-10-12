// uebersicht.tsx
// Die zwei Hauptseiten: "Meine Belege" (eigene Belege der Periode, Aufgaben,
// Favoriten, eigener Filter) und "Übersicht" (nur Prüfer und Admin:
// Kontierung, Export, alle sichtbaren Belege). Beide für Handy und Rechner.

import { S } from "../zustand";
import {
  istBreit, chfLang, buchungsBetrag, statusVon, auftragAnzeige, MAX_KACHELN, OHNE_KST
} from "../grundlagen";
import {
  uGefiltert, gruppiere, uTitel, eigeneErfasste, istErledigt, personName,
  meineGefiltert, istMeinOffen, istMeinErledigt
} from "../daten";
import { Seite } from "./rahmen";
import {
  Ico, Knopf, Kachel, Farbkarte, Balken, PeriodeWahl, PeriodeKlein, ZeitraumRechner,
  FilterChips, FilterFelder, FilterKnopf, BelegZeile, BelegTabelle, KnopfFreigeben,
  VerlaufListe, belegKopf, belegeSuchen, eigenerName, kstName, zeitraumText
} from "./bausteine";

const summe = (liste: any[]) => liste.reduce((t, b) => t + buchungsBetrag(b), 0);
const anzahlText = (n: number) => n === 1 ? "1 Beleg" : `${n} Belege`;
const freigabenText = (n: number) => n === 1 ? "1 Freigabe offen" : `${n} Freigaben offen`;

// ---------- Aufgaben: abgelehnt, nicht freigegeben, Freigaben offen ----------
const abgelehnte  = () => S.offeneEigene.filter((b) => statusVon(b) === "abgelehnt");
const unfreigegeben = () => eigeneErfasste(S.offeneEigene);

function FreigabenOffen() {
  if (!S.istPruefer || !S.freigabe.length) return null;
  const uz = S.freigabe.filter((b) => b.zahlart === "vorkasse").length;
  return (
    <div className="wartet">
      <span className="nr">{S.freigabe.length}</span>
      <span style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        <b>{S.freigabe.length === 1 ? "Freigabe offen" : "Freigaben offen"}</b>
        <span className="kn" style={{ color: "#9ba1bb" }}>
          {uz} User-Zahlung{uz === 1 ? "" : "en"} · {S.freigabe.length - uz} Kreditkarte/Bar</span></span>
      <button className="k1 klein" data-akt="tabFreigabe" style={{ boxShadow: "none" }}>Prüfen</button>
    </div>);
}

// Eine kurze, antippbare Zeile für die Aufgaben-Karten
const AufgabeZeile = ({ b }: { b: any }) => (
  <button className="zl" data-akt="bearbeiten" data-id={b.id} data-w="liste" style={{ padding: "9px 0" }}>
    <span className="mitte"><b style={{ fontSize: 14 }}>{belegKopf(b)}</b>
      {b.entscheid_grund && statusVon(b) === "abgelehnt"
        ? <span className="kn mu">„{b.entscheid_grund}“</span>
        : <span className="kn mu">{b.konto_nummer} · {new Date(b.beleg_datum).toLocaleDateString("de-CH")}</span>}</span>
    <span className="seite"><span className="betragz">{chfLang(b.betrag)}</span>
      <span className="kn fett" style={{ color: "var(--akzent)" }}>öffnen ›</span></span>
  </button>);

function Aufgaben() {
  const abg = abgelehnte(), unf = unfreigegeben();
  return <>
    {abg.length > 0 &&
      <div className="karte aufgabe rot" style={{ flexDirection: "column", alignItems: "stretch", gap: 4 }}>
        <b>{abg.length === 1 ? "1 Beleg abgelehnt" : `${abg.length} Belege abgelehnt`}</b>
        <span className="kn mu">Korrigieren und neu freigeben — oder löschen.</span>
        {abg.slice(0, 5).map((b) => <AufgabeZeile b={b} key={b.id} />)}
      </div>}
    {unf.length > 0 &&
      <div className="karte aufgabe" style={{ flexDirection: "column", alignItems: "stretch", gap: 4 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ flex: 1 }}><b>{anzahlText(unf.length)}</b> noch nicht zur Prüfung freigegeben</span>
          <Knopf akt="freigebenAlle" data-w="offene" className="kd klein">
            {unf.length === 1 ? "Freigeben" : "Alle freigeben"}</Knopf>
        </div>
        <span className="kn mu">Antippen, um einen Beleg anzusehen und einzeln freizugeben.</span>
        {unf.slice(0, 5).map((b) => <AufgabeZeile b={b} key={b.id} />)}
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
// Kacheln: Belege (Summe), User-Zahlungen (gesamt / genehmigt), offene
// Punkte, erledigt. Antippen filtert die Liste darunter.
function MeineKacheln() {
  const basis = meineGefiltert("alles");    // nur Konto/KST-Filter, nicht Status/Zahlart
  const uz = basis.filter((b) => b.zahlart === "vorkasse");
  const uzGesamt = uz.reduce((t, b) => t + parseFloat(b.betrag), 0);
  const uzGenehmigt = uz.filter((b) => ["genehmigt", "teilweise"].includes(statusVon(b)))
                        .reduce((t, b) => t + buchungsBetrag(b), 0);
  const breit = istBreit();
  return <>
    <Kachel lab="Belege" wert={(breit ? "CHF " : "") + chfLang(summe(basis))} farbe="dunkel" icon="doc"
            fuss={(breit ? "" : "CHF · ") + anzahlText(basis.length) + ", wie gebucht"} f="alle-m" />
    <Kachel lab="User-Zahlungen" wert={(breit ? "CHF " : "") + chfLang(uzGesamt)} farbe="blau" icon="geld"
            fuss={<>genehmigt <b>{chfLang(uzGenehmigt)}</b></>} f="mZahlart" v="vorkasse" an={S.mZahlart === "vorkasse"} />
    <Kachel lab="Offene Punkte" wert={basis.filter(istMeinOffen).length} farbe="orange" icon="uhr"
            fuss="erfasst, eingereicht, abgelehnt" f="mStatus" v="offenePunkte" an={S.mStatus === "offenePunkte"} />
    <Kachel lab="Erledigt" wert={basis.filter(istMeinErledigt).length} farbe="gruen" icon="check"
            fuss="geprüft oder genehmigt" f="mStatus" v="erledigt" an={S.mStatus === "erledigt"} />
  </>;
}

// Überschrift der Liste — sagt, was gerade gefiltert ist
function listenTitel() {
  if (S.mStatus === "offenePunkte") return "Offene Punkte";
  if (S.mStatus === "erledigt") return "Erledigte Belege";
  if (S.mZahlart === "vorkasse") return "User-Zahlungen";
  return "Belege der Periode";
}

export function MeineBelege() {
  const liste = belegeSuchen(meineGefiltert());
  const unf = unfreigegeben(), abg = abgelehnte();

  if (istBreit()) return (
    <Seite titel="Meine Belege" pfad="Spesen / Meine Belege" tab
           rechts={<><PeriodeKlein /><FilterKnopf b="m" /></>}>
      <ZeitraumRechner />
      <FilterFelder b="m" />
      <div className="chips" style={{ marginTop: -8 }}><FilterChips b="m" />
        <span className="kn mu">Die Kacheln filtern per Klick.</span></div>
      <section className="kacheln"><MeineKacheln /></section>
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
            {unf.slice(0, 3).map((b) => (
              <button className="farbzeile" key={b.id} data-akt="bearbeiten" data-id={b.id} data-w="liste">
                <span>Nicht freigegeben: {belegKopf(b)}</span><span className="mono">{chfLang(b.betrag)}</span></button>))}
            {unf.length > 0 &&
              <Knopf akt="freigebenAlle" data-w="offene" className="k2 klein fett"
                     style={{ color: "#a3400a", border: 0, alignSelf: "flex-start" }}>
                {unf.length === 1 ? "Freigeben" : `Alle ${unf.length} freigeben`}</Knopf>}
            {S.istPruefer && S.freigabe.length > 0 &&
              <button className="farbzeile" data-akt="tabFreigabe">
                <span>{freigabenText(S.freigabe.length)}</span><span>›</span></button>}
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
      <section className="karte" id="belegliste">
        <div className="kartenkopf">
          <span><h2>{listenTitel()}</h2><span className="sub">{zeitraumText()} · {anzahlText(liste.length)}</span></span>
          <span style={{ display: "flex", gap: 8 }}>
            <input type="search" placeholder="Suchen" aria-label="Belege durchsuchen" defaultValue={S.bSuche}
                   key={"s" + S.bSucheNeu} data-feld="bsuche" style={{ width: 200, minHeight: 40 }} />
            <KnopfFreigeben liste={liste} woher="liste" />
          </span>
        </div>
        <BelegTabelle liste={liste} woher="liste" />
      </section>
    </Seite>);

  return (
    <Seite titel="Meine Belege" sub={eigenerName()} tab>
      <FreigabenOffen />
      <PeriodeWahl />
      <div className="filterleiste"><FilterKnopf b="m" /><FilterChips b="m" /></div>
      <FilterFelder b="m" />
      <div className="kacheln"><MeineKacheln /></div>
      <Aufgaben />
      <FavoritenLeiste />
      <section className="karte huelle" id="belegliste">
        <div className="kartenkopf"><h2 style={{ fontSize: 16 }}>{listenTitel()}</h2>
          <span className="sub">{anzahlText(liste.length)}</span></div>
        {liste.length === 0 ? <div className="leer">Keine Belege für diese Auswahl.</div>
          : liste.map((b) => <BelegZeile b={b} woher="liste" key={b.id} />)}
      </section>
    </Seite>);
}

// ---------- Übersicht (Prüfer und Admin) ----------
// Summen je KST oder je Person für die Balken
function summeJe(gruppen: any[]) {
  const m = new Map<string, number>();
  for (const g of gruppen) m.set(g.auftrag, (m.get(g.auftrag) || 0) + g.brutto);
  return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4)
    .map(([k, w]) => ({ name: kstName(k), wert: w }));
}
function summeJePerson(belege: any[]) {
  const m = new Map<string, number>();
  for (const b of belege) if (statusVon(b) !== "abgelehnt")
    m.set(b.geraet, (m.get(b.geraet) || 0) + buchungsBetrag(b));
  return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4)
    .map(([k, w]) => ({ name: personName(k), wert: w }));
}

const ZAHLART_KURZ: Record<string, string> = { karte: "Kreditkarte", bar: "Bar", vorkasse: "User-Zahlung" };
// Bezeichnung einer Kontierungszeile: Name der KST, dazu die Kommentare der Belege
const kstNurName = (nr: string) => nr === OHNE_KST.id ? OHNE_KST.name
  : ((S.auftraege.find((x) => x.id === nr) || {}).name || "");
const bezeichnung = (g: any) =>
  [kstNurName(g.auftrag), g.kommentare.length ? g.kommentare.join("; ") : ""].filter(Boolean).join(" · ");

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
            <td className="mono fett">{g.konto}</td><td>{bezeichnung(g)}</td>
            <td className="mono nw">{auftragAnzeige(g.auftrag)}</td><td className="mono nw">{g.satz} %</td>
            <td className="nw">{ZAHLART_KURZ[g.zahlart] || g.zahlart}</td>
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
          <span className="mitte"><b><span className="mono">{g.konto}</span> · {kstNurName(g.auftrag) || "KST " + g.auftrag}</b>
            <span className="kn mu">KST {auftragAnzeige(g.auftrag)} · {g.satz} % · {ZAHLART_KURZ[g.zahlart] || g.zahlart} · {g.anzahl} Posten</span>
            {g.kommentare.length > 0 && <span className="kn kommentar">{g.kommentare.join("; ")}</span>}</span>
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
  const liste = belegeSuchen(gefiltert);
  const brutto = gruppen.reduce((s, g) => s + g.brutto, 0);
  const erledigt = ohneStatus.filter(istErledigt).length;
  const offen = ohneStatus.length - erledigt;
  const wer = S.istAdmin ? "alle Personen" : "deine Kostenstellen und Konten";
  const nurOffen = S.uStatus === "unerledigt";

  const kacheln = <>
    <Kachel lab="Brutto" wert={(istBreit() ? "CHF " : "") + chfLang(brutto)} farbe="dunkel" icon="geld"
            fuss={anzahlText(gefiltert.length) + (S.uStatus ? " · gefiltert" : "")} f="alle-u" />
    <Kachel lab="Erledigt" wert={erledigt} fuss="geprüft oder entschieden" farbe="gruen" icon="check"
            f="uStatus" v="erledigt" an={S.uStatus === "erledigt"} />
    <Kachel lab="Offen" wert={offen} farbe="orange" icon="uhr"
            fuss={<><b style={{ color: "#c2410c" }}>{S.freigabe.length}</b> {S.freigabe.length === 1 ? "Freigabe" : "Freigaben"} offen bei dir</>}
            f="uStatus" v="unerledigt" an={nurOffen} />
  </>;

  const leerOderLaedt = S.uLaedt ? <div className="karte leer">Lade …</div>
    : gefiltert.length === 0 ? <div className="karte leer">Keine Belege für diese Auswahl.</div> : null;

  const verlauf = (
    <section className="karte innen">
      <span><h2 style={{ fontSize: 17 }}>Verlauf</h2>
        <span className="kn mu">{S.istAdmin ? "letzte Schritte, alle Belege" : "letzte Schritte deiner Kostenstellen, Konten und eigenen Belege"}</span></span>
      <div className="verlaufgitter"><VerlaufListe anzahl={istBreit() ? 12 : 8} /></div>
    </section>);

  if (istBreit()) return (
    <Seite titel={"Übersicht · " + wer} pfad="Spesen / Übersicht" tab
           rechts={<><PeriodeKlein /><FilterKnopf /></>}>
      <ZeitraumRechner />
      <FilterFelder />
      <div className="chips" style={{ marginTop: -8 }}><FilterChips />
        <span className="kn mu">Die Kacheln Erledigt und Offen filtern per Klick.</span></div>
      <section className="kacheln drei">{kacheln}</section>
      <section className="farbkarten">
        <Farbkarte farbe="dunkel" titel="Nach Kostenstelle" sub="Brutto im Zeitraum, wie gebucht">
          <Balken zeilen={summeJe(gruppen)} /></Farbkarte>
        <Farbkarte farbe="gruen" titel="Nach Person" sub={S.uAuftrag ? `auf KST ${auftragAnzeige(S.uAuftrag)}` : "Brutto im Zeitraum, wie gebucht"}>
          <Balken zeilen={summeJePerson(gefiltert)} /></Farbkarte>
        <Farbkarte farbe="orange" titel="Freigaben offen" sub={anzahlText(S.freigabe.length)}
                   unten={<button className="kd klein" data-akt="tabFreigabe">Prüfen</button>}>
          {S.freigabe.length ? S.freigabe.slice(0, 3).map((b) => (
            <button className="farbzeile" key={b.id} data-akt="bearbeiten" data-id={b.id} data-w="freigabe">
              <span>{personName(b.geraet)} · {belegKopf(b)}</span><span className="mono">{chfLang(b.betrag)}</span></button>))
            : <span>Nichts zu prüfen.</span>}
        </Farbkarte>
        <Farbkarte farbe="blau" titel="Export" sub="folgt Zeitraum und Filter">
          <span style={{ display: "flex", flexDirection: "column" }}>
            <span className="kn" style={{ opacity: .85 }}>{zeitraumText()}</span>
            <b className="mono" style={{ fontSize: 19 }}>{anzahlText(gefiltert.length)} · {chfLang(brutto)}</b></span>
          {gefiltert.length > 0 && <ExportKnoepfe />}
        </Farbkarte>
      </section>
      {leerOderLaedt || <>
        {!nurOffen &&
          <section className="karte">
            <div className="kartenkopf"><span><h2>Kontierung</h2><span className="sub">{uTitel()}</span></span></div>
            <KontierungTabelle gruppen={gruppen} />
          </section>}
        <section className="karte" id="belegliste">
          <div className="kartenkopf">
            <span><h2>{nurOffen ? "Offene Belege" : "Belege"}</h2><span className="sub">{anzahlText(liste.length)} · ältester zuerst</span></span>
            <span style={{ display: "flex", gap: 8 }}>
              <input type="search" placeholder="Suchen" aria-label="Belege durchsuchen" defaultValue={S.bSuche}
                     key={"s" + S.bSucheNeu} data-feld="bsuche" style={{ width: 200, minHeight: 40 }} />
              <KnopfFreigeben liste={gefiltert} woher="uebersicht" />
            </span>
          </div>
          <BelegTabelle liste={liste} woher="uebersicht" person />
        </section>
      </>}
      {verlauf}
    </Seite>);

  // Handy: Kacheln, dann Export, dann Kontierung — bei "Offen" nur die Liste
  return (
    <Seite titel="Übersicht" sub={wer} tab>
      <PeriodeWahl />
      <div className="filterleiste"><FilterKnopf /><FilterChips /></div>
      <FilterFelder />
      <div className="kacheln">{kacheln}</div>
      {leerOderLaedt || <>
        {!nurOffen && <>
          <section className="karte f-blau" style={{ padding: 16, color: "#fff", display: "flex", flexDirection: "column", gap: 10 }}>
            <b style={{ fontSize: 17 }}>Export für DocuWare</b>
            <span style={{ fontSize: 14, opacity: .9 }}>PDF mit Kontierung vorn und allen {anzahlText(gefiltert.length)} dahinter.</span>
            <ExportKnoepfe />
          </section>
          <KontierungKarten gruppen={gruppen} />
        </>}
        <section className="karte huelle" id="belegliste">
          <div className="kartenkopf"><h2 style={{ fontSize: 16 }}>{nurOffen ? "Offene Belege" : "Einzelne Belege"}</h2>
            <KnopfFreigeben liste={gefiltert} woher="uebersicht" /></div>
          {liste.map((b) => <BelegZeile b={b} woher="uebersicht" person key={b.id} />)}
        </section>
      </>}
      {verlauf}
    </Seite>);
}
