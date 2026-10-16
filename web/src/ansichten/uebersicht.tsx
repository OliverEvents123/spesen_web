// uebersicht.tsx
// Die zwei Hauptseiten: "Meine Belege" (eigene Belege der Periode, offene
// Punkte, Schnell erfassen) und "Übersicht" (je Abschnitt Projektleitung,
// Supervisor, Administration: Kostenstellen links, rechts Belege,
// Kontierung und Verlauf als Reiter, Export oben). Für Handy und Rechner.
//
// Statt Kacheln und farbiger Karten: Reiter mit Zahlen, eine Summe,
// schmale Hinweiszeilen nur für das, was etwas braucht.

import { S } from "../zustand";
import {
  istBreit, chfLang, buchungsBetrag, statusVon, auftragAnzeige, MAX_KACHELN, OHNE_KST
} from "../grundlagen";
import {
  uGefiltert, gruppiere, uTitel, eigeneErfasste, istErledigt, personName, kontoName,
  meineGefiltert, istMeinOffen, istMeinErledigt, freigabeIm, bereiche, BEREICH_NAME
} from "../daten";
import { Seite } from "./rahmen";
import {
  Ico, Knopf, PeriodeWahl, PeriodeKlein, ZeitraumRechner, FilterChips, FilterFelder, FilterKnopf,
  BelegZeile, BelegTabelle, KnopfFreigeben, VerlaufListe, Reiterleiste, Hinweiszeile,
  belegKopf, belegeSuchen, eigenerName, kstName, zeitraumText
} from "./bausteine";

const summe = (liste: any[]) => liste.reduce((t, b) => t + buchungsBetrag(b), 0);
const anzahlText = (n: number) => n === 1 ? "1 Beleg" : `${n} Belege`;
const freigabenText = (n: number) => n === 1 ? "1 Freigabe offen" : `${n} Freigaben offen`;

// Suchfeld für die Belegliste
const Suche = () => (
  <input type="search" placeholder="Suchen" aria-label="Belege durchsuchen" defaultValue={S.bSuche}
         key={"s" + S.bSucheNeu} data-feld="bsuche" style={{ width: 200, minHeight: 36 }} />);

// Gesetzte Filter als Chips — nur wenn es welche gibt
function Chips({ b }: { b?: "u" | "m" }) {
  const n = [S[(b || "u") + "Zahlart"], S[(b || "u") + "Status"], S[(b || "u") + "Konto"], S[(b || "u") + "Auftrag"],
             S.bSuche.trim(), ...(b === "m" ? [] : [S.uGeraet, S.uZahlgeraet])].filter(Boolean).length;
  if (!n) return null;
  return <div className="chips"><FilterChips b={b} /></div>;
}

/* ==========================================================
   Meine Belege
   ========================================================== */

const abgelehnte = () => S.offeneEigene.filter((b) => statusVon(b) === "abgelehnt");
const unfreigegeben = () => eigeneErfasste(S.offeneEigene);

// Was etwas braucht: abgelehnt, noch nicht freigegeben, Freigaben offen
function Aufgaben() {
  const abg = abgelehnte(), unf = unfreigegeben();
  // Am Rechner je Abschnitt eine Zeile, am Handy eine für alles
  const fg = istBreit()
    ? bereiche().map((b) => ({ b, n: freigabeIm(b).length })).filter((x) => x.n)
    : (S.istPruefer && S.freigabe.length ? [{ b: "", n: S.freigabe.length }] : []);
  return <>
    {abg.slice(0, 3).map((b) => (
      <Hinweiszeile farbe="rot" key={b.id}
        knopf={<button className="k2 klein" data-akt="bearbeiten" data-id={b.id} data-w="liste">Ansehen</button>}>
        <b>Abgelehnt:</b> {belegKopf(b)} · CHF {chfLang(b.betrag)}
        {b.entscheid_grund && <span className="mu"> — „{b.entscheid_grund}“</span>}
      </Hinweiszeile>))}
    {abg.length > 3 && <Hinweiszeile farbe="rot">… und {abg.length - 3} weitere abgelehnte Belege.</Hinweiszeile>}
    {unf.length > 0 &&
      <Hinweiszeile knopf={<>
          {unf.length === 1
            ? <button className="k2 klein" data-akt="bearbeiten" data-id={unf[0].id} data-w="liste">Ansehen</button>
            : <button className="k2 klein" data-akt="setze" data-f="mStatus" data-v="offen">Anzeigen</button>}
          <Knopf akt="freigebenAlle" data-w="offene" className="k1 klein">
            {unf.length === 1 ? "Freigeben" : "Alle freigeben"}</Knopf></>}>
        <b>{anzahlText(unf.length)}</b> noch nicht zur Prüfung freigegeben
      </Hinweiszeile>}
    {fg.map(({ b, n }) => (
      <Hinweiszeile farbe="blau" key={b || "alle"}
        knopf={<button className="k1 klein" data-akt="tabFreigabe" data-b={b || undefined}>Prüfen</button>}>
        <b>{freigabenText(n)}</b>{b ? " · " + BEREICH_NAME[b] : ""}
      </Hinweiszeile>))}
  </>;
}

// Favoriten als kleine Zeile: ein Klick öffnet das Erfassen mit Konto und KST
function SchnellErfassen() {
  if (!S.favoriten.length)
    return <div className="schnell"><span className="kl">Schnell erfassen</span>
      <button className="link" data-akt="zuFavoriten">Favoriten einrichten</button></div>;
  if (!istBreit()) return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span className="kl">Schnell erfassen</span><button className="link" data-akt="zuFavoriten">Verwalten</button></div>
      <div className="favleiste">
        {S.favoriten.slice(0, MAX_KACHELN).map((f) => (
          <button className="fav" data-akt="favAnwenden" data-id={f.id} key={f.id}>
            <b>{f.name}</b><span>{f.konto_nummer} · {auftragAnzeige(f.auftrag_nr)}</span></button>))}
      </div>
    </div>);
  return (
    <div className="schnell">
      <span className="kl">Schnell erfassen</span>
      {S.favoriten.slice(0, MAX_KACHELN).map((f) => (
        <button key={f.id} className="k2 klein rund" data-akt="favAnwenden" data-id={f.id}
                title={`Konto ${f.konto_nummer} · KST ${auftragAnzeige(f.auftrag_nr)}`}>
          <Ico n="stern" s={14} /> {f.name}</button>))}
      <button className="link" data-akt="zuFavoriten">Verwalten</button>
    </div>);
}

// Reiter Alle / Offene Punkte / Erledigt mit Zahlen, rechts die Summe
function MeineReiter() {
  const basis = meineGefiltert("status");
  const liste = meineGefiltert();
  const uz = basis.filter((b) => b.zahlart === "vorkasse");
  const uzGesamt = uz.reduce((t, b) => t + parseFloat(b.betrag), 0);
  const uzGenehmigt = uz.filter((b) => ["genehmigt", "teilweise"].includes(statusVon(b)))
                        .reduce((t, b) => t + buchungsBetrag(b), 0);
  const reiter = [
    { v: "", lab: "Alle", n: basis.length },
    { v: "offenePunkte", lab: "Offene Punkte", n: basis.filter(istMeinOffen).length },
    { v: "erledigt", lab: "Erledigt", n: basis.filter(istMeinErledigt).length }
  ];
  const summeText = <>
    <b>CHF {chfLang(summe(liste))}</b>
    <span className="kn mu">{anzahlText(liste.length)}
      {uz.length > 0 && <> · User-Zahlungen {chfLang(uzGesamt)}, genehmigt {chfLang(uzGenehmigt)}</>}</span>
  </>;
  if (istBreit()) return <Reiterleiste f="mStatus" reiter={reiter} rechts={summeText} />;
  return <>
    <Reiterleiste f="mStatus" reiter={reiter} />
    <div className="summenzeile">{summeText}</div>
  </>;
}

// Überschrift der Liste — sagt, was gerade gefiltert ist
function listenTitel() {
  if (S.mStatus === "offenePunkte") return "Offene Punkte";
  if (S.mStatus === "erledigt") return "Erledigte Belege";
  if (S.mStatus === "offen") return "Erfasst, nicht freigegeben";
  if (S.mZahlart === "vorkasse") return "User-Zahlungen";
  return "Belege der Periode";
}

export function MeineBelege() {
  const liste = belegeSuchen(meineGefiltert());

  if (istBreit()) return (
    <Seite titel="Meine Belege" pfad={eigenerName()} tab
           rechts={<><PeriodeKlein /><FilterKnopf b="m" />
             <button className="k1 klein" data-akt="neu"><Ico n="plus" s={16} /> Beleg erfassen</button></>}>
      <ZeitraumRechner />
      <FilterFelder b="m" />
      <Chips b="m" />
      <MeineReiter />
      <SchnellErfassen />
      <Aufgaben />
      <section className="karte" id="belegliste">
        <div className="kartenkopf">
          <span><h2>{listenTitel()}</h2><span className="sub">{zeitraumText()} · {anzahlText(liste.length)}</span></span>
          <span style={{ display: "flex", gap: 8 }}><Suche /><KnopfFreigeben liste={liste} woher="liste" /></span>
        </div>
        <BelegTabelle liste={liste} woher="liste" />
      </section>
    </Seite>);

  return (
    <Seite titel="Meine Belege" sub={eigenerName()} tab>
      <PeriodeWahl />
      <div className="filterleiste"><FilterKnopf b="m" /><FilterChips b="m" /></div>
      <FilterFelder b="m" />
      <MeineReiter />
      <Aufgaben />
      <SchnellErfassen />
      <section className="karte huelle" id="belegliste">
        <div className="kartenkopf"><h2 style={{ fontSize: 16 }}>{listenTitel()}</h2>
          <span className="sub">{anzahlText(liste.length)}</span></div>
        {liste.length === 0 ? <div className="leer">Keine Belege für diese Auswahl.</div>
          : liste.map((b) => <BelegZeile b={b} woher="liste" key={b.id} />)}
      </section>
    </Seite>);
}

/* ==========================================================
   Übersicht (je Abschnitt)
   ========================================================== */

const ZAHLART_KURZ: Record<string, string> = { karte: "Kreditkarte", bar: "Bar", vorkasse: "User-Zahlung" };
// Bezeichnung einer Kontierungszeile: Name der KST, dazu die Kommentare der Belege
const kstNurName = (nr: string) => nr === OHNE_KST.id ? OHNE_KST.name
  : ((S.auftraege.find((x) => x.id === nr) || {}).name || "");
const bezeichnung = (g: any) =>
  [kstNurName(g.auftrag), g.kommentare.length ? g.kommentare.join("; ") : ""].filter(Boolean).join(" · ");

function KontierungTabelle({ gruppen }: { gruppen: any[] }) {
  if (!gruppen.length) return <div className="leer">Keine Beträge für diese Auswahl.</div>;
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

// Am Handy: Zeilen statt einer Tabelle mit neun Spalten
function KontierungKarten({ gruppen }: { gruppen: any[] }) {
  if (!gruppen.length) return <div className="leer">Keine Beträge für diese Auswahl.</div>;
  const t = (f: string) => gruppen.reduce((s, g) => s + g[f], 0);
  return <>
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
  </>;
}

const ExportKnoepfe = () => <>
  <Knopf akt="expPdf" className="k2 klein fett"><Ico n="runter" s={16} /> PDF für DocuWare</Knopf>
  <button className="k2 klein" data-akt="expCsv">CSV</button>
</>;

// Links: Kostenstellen (oder Konten, Personen) mit ihren Summen.
// Ein Klick filtert die Übersicht darauf, nochmals hebt es auf.
const GRUPPEN = { kst: ["KST", "uAuftrag"], konto: ["Konto", "uKonto"], person: ["Person", "uGeraet"] };
function Gruppen() {
  const art = S.uGruppe || (S.bereich === "sup" ? "konto" : "kst");
  const feld = GRUPPEN[art][1];
  // Summen ohne den eigenen Gruppenfilter — sonst bliebe nur die gewählte Zeile
  const merk = S[feld]; S[feld] = "";
  const belege = uGefiltert();
  S[feld] = merk;
  const m = new Map<string, number>();
  if (art === "person") {
    for (const b of belege) if (statusVon(b) !== "abgelehnt")
      m.set(b.geraet, (m.get(b.geraet) || 0) + buchungsBetrag(b));
  } else {
    for (const g of gruppiere(belege)) {
      const k = art === "kst" ? g.auftrag : g.konto;
      m.set(k, (m.get(k) || 0) + g.brutto);
    }
  }
  const zeilen = [...m.entries()].sort((a, b) => b[1] - a[1]);
  const total = zeilen.reduce((t, [, w]) => t + w, 0);
  const name = (k: string) => art === "kst" ? kstName(k)
    : art === "konto" ? `${k} ${kontoName(k)}`.trim() : personName(k);
  return (
    <section className="karte huelle gruppenliste">
      <div className="reiterleiste flach">
        {Object.entries(GRUPPEN).map(([k, [lab]]) => (
          <button key={k} className={"reiter" + (art === k ? " an" : "")} data-akt="setze" data-f="uGruppe" data-v={k}>{lab}</button>))}
      </div>
      <button className={"zeile" + (!S[feld] ? " an" : "")} data-akt="gruppeWahl" data-g={art} data-v="">
        <span className="nm">Alle</span><span className="betr">{chfLang(total)}</span></button>
      {zeilen.map(([k, w]) => (
        <button key={k} className={"zeile" + (S[feld] === k ? " an" : "")} data-akt="gruppeWahl" data-g={art} data-v={k}
                title={name(k)}>
          <span className="nm">{name(k)}</span><span className="betr">{chfLang(w)}</span></button>))}
      {!zeilen.length && <div className="leer">Keine Beträge.</div>}
    </section>);
}

export function Uebersicht() {
  const gefiltert = uGefiltert();
  const ohneStatus = uGefiltert(true);
  const gruppen = gruppiere(gefiltert);
  const liste = belegeSuchen(gefiltert);
  const brutto = gruppen.reduce((s, g) => s + g.brutto, 0);
  const erledigt = ohneStatus.filter(istErledigt).length;
  const fg = freigabeIm();
  const reiter = S.uReiter || "belege";
  const breit = istBreit();

  const statusReiter = [
    { v: "", lab: "Alle", n: ohneStatus.length },
    { v: "unerledigt", lab: "Offen", n: ohneStatus.length - erledigt },
    { v: "erledigt", lab: "Erledigt", n: erledigt }
  ];
  const summeText = <><b>CHF {chfLang(brutto)}</b><span className="kn mu">{anzahlText(gefiltert.length)}, wie gebucht</span></>;
  const inhaltReiter = [
    { v: "belege", lab: "Belege", n: liste.length },
    { v: "kontierung", lab: "Kontierung", n: gruppen.length },
    { v: "verlauf", lab: "Verlauf", n: null }
  ];
  const ReiterInhalt = () => (
    <div className="reiterleiste flach">
      {inhaltReiter.map((r) => (
        <button key={r.v} className={"reiter" + (reiter === r.v ? " an" : "")} data-akt="setze" data-f="uReiter" data-v={r.v}>
          {r.lab}{r.n != null && <b>{r.n}</b>}</button>))}
    </div>);

  const freigabeHinweis = fg.length > 0 &&
    <Hinweiszeile farbe="blau"
      knopf={<button className="k1 klein" data-akt="tabFreigabe" data-b={S.bereich || undefined}>Prüfen</button>}>
      <b>{freigabenText(fg.length)}</b> — warten auf deinen Entscheid</Hinweiszeile>;

  const laedt = S.uLaedt && <div className="karte leer">Lade …</div>;
  const titel = "Übersicht" + (breit && S.bereich ? " · " + BEREICH_NAME[S.bereich] : "");

  if (breit) return (
    <Seite titel={titel} pfad={zeitraumText()} tab
           rechts={<><PeriodeKlein /><FilterKnopf />{gefiltert.length > 0 && <ExportKnoepfe />}</>}>
      <ZeitraumRechner />
      <FilterFelder />
      <Chips />
      <Reiterleiste f="uStatus" reiter={statusReiter} rechts={summeText} />
      {freigabeHinweis}
      {laedt || (
        <div className="spalten gruppen">
          <Gruppen />
          <section className="karte huelle">
            <div className="kartenkopf">
              <ReiterInhalt />
              {reiter === "belege" &&
                <span style={{ display: "flex", gap: 8 }}><Suche /><KnopfFreigeben liste={gefiltert} woher="uebersicht" /></span>}
              {reiter === "kontierung" && <span className="sub">{uTitel()}</span>}
            </div>
            {reiter === "belege" && <BelegTabelle liste={liste} woher="uebersicht" person />}
            {reiter === "kontierung" && <KontierungTabelle gruppen={gruppen} />}
            {reiter === "verlauf" && <VerlaufListe anzahl={60} />}
          </section>
        </div>)}
    </Seite>);

  // Handy: Reiter mit Zahlen, Summe, Export, dann Belege / Kontierung / Verlauf
  return (
    <Seite titel="Übersicht" sub={zeitraumText()} tab>
      <PeriodeWahl />
      <div className="filterleiste"><FilterKnopf /><FilterChips /></div>
      <FilterFelder />
      <Reiterleiste f="uStatus" reiter={statusReiter} />
      <div className="summenzeile">{summeText}</div>
      {freigabeHinweis}
      {gefiltert.length > 0 &&
        <div className="schnell"><span className="kl">Export</span><ExportKnoepfe /></div>}
      {laedt || (
        <section className="karte huelle" id="belegliste">
          <div className="kartenkopf"><ReiterInhalt /></div>
          {reiter === "belege" && (liste.length === 0 ? <div className="leer">Keine Belege für diese Auswahl.</div>
            : <>{liste.map((b) => <BelegZeile b={b} woher="uebersicht" person key={b.id} />)}
                <div style={{ padding: "8px 14px 12px" }}><KnopfFreigeben liste={gefiltert} woher="uebersicht" /></div></>)}
          {reiter === "kontierung" && <KontierungKarten gruppen={gruppen} />}
          {reiter === "verlauf" && <VerlaufListe anzahl={30} />}
        </section>)}
    </Seite>);
}
