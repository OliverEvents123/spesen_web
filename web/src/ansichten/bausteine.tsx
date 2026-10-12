// bausteine.tsx
// Kleine, wiederverwendete Teile: Symbole, Knöpfe, Marken, Kacheln, Zeitraum,
// Filter, Belegzeilen, Auswahl für Konto/KST, Verlauf.
// Klicks laufen über data-akt="…" an aktionen.ts — wie in der alten Fassung.

import React from "react";
import { S } from "../zustand";
import {
  istBreit, chf, chfLang, datumCH, zeitCH, langDatum, kurzDatum, statusVon, statusName, statusKlasse,
  zahlartName, auftragAnzeige, istAufgeteilt, buchungsBetrag, initialen, istPeriode,
  ZAHLART, STATUS_FILTER, OHNE_KST
} from "../grundlagen";
import {
  kontoName, eigeneErfasste, personName, aktiveKonten, kontenImZeitraum, auftraegeImZeitraum,
  verlaufEintrag
} from "../daten";

// ---------- Symbole ----------
const PFADE: Record<string, string> = {
  doc: "M6 2h9l5 5v15H6zm8 1.5V8h4.5z",
  grid: "M3 13h8V3H3zm0 8h8v-6H3zm10 0h8V11h-8zm0-18v6h8V3z",
  check: "M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z",
  person: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8m0 2c-4 0-8 2-8 5v1h16v-1c0-3-4-5-8-5",
  kamera: "M9 4 7.5 6H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-3.5L15 4zm3 4.5a4.5 4.5 0 1 1 0 9 4.5 4.5 0 0 1 0-9m0 2a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5",
  stern: "M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z",
  geld: "M4 6h16v12H4zm2 2v2h12V8z",
  uhr: "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20m1 5v5.4l4 2.4-.8 1.3L11 13V7z",
  liste: "M4 5h16v2H4zm0 6h16v2H4zm0 6h16v2H4z",
  schluessel: "M7 14a3 3 0 1 1 0-6 3 3 0 0 1 0 6m5.6-4A6 6 0 1 0 12.6 14H16v3h3v-3h2v-4z",
  raus: "M10 17v-3H3v-4h7V7l5 5zm9 4h-7v-2h7V5h-7V3h7a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2",
  hoch: "M5 20h14v-2H5zm7-16-5 5h3v6h4V9h3z",
  warn: "M12 2 1 21h22zm-1 7h2v6h-2zm0 8h2v2h-2z",
  runter: "M5 20h14v-2H5zm7-2 5-5h-3V4h-4v9H7z",
  leute: "M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7m7 0a3 3 0 1 0 0-6 3 3 0 0 0 0 6M9 13c-3.3 0-7 1.6-7 4.5V20h14v-2.5C16 14.6 12.3 13 9 13m7.3.1A5 5 0 0 1 18 17.5V20h4v-2.5c0-2.4-3-4-5.7-4.4",
  stift: "M4 20h4l10-10-4-4L4 16zM15.5 4.5l4 4 1.5-1.5-4-4z",
  info: "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20m-1 8h2v7h-2zm0-4h2v2h-2z",
  plus: "M11 5h2v14h-2zM5 11h14v2H5z",
  pfeilhoch: "M12 5l-6 6h4v8h4v-8h4z"
};
export const Ico = ({ n, s }: { n: string; s?: number }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"
       style={s ? { width: s, height: s, flexShrink: 0 } : undefined}><path d={PFADE[n]} /></svg>);

// ---------- Knopf, der arbeiten kann ----------
// Läuft gerade die Aktion dieses Knopfs, zeigt er z. B. "Speichere …".
type KnopfProps = React.ButtonHTMLAttributes<HTMLButtonElement> & { akt: string; [k: string]: any };
export function Knopf({ akt, children, disabled, ...rest }: KnopfProps) {
  const arbeitet = S.laeuft && S.laeuft.akt === akt;
  return (
    <button data-akt={akt} disabled={disabled || !!arbeitet} {...rest}>
      {arbeitet ? S.laeuft.text : children}
    </button>);
}

// ---------- Meldung ("Gespeichert.") ----------
export const Meldung = () => S.meldung ? <div className="ok" role="status">{S.meldung}</div> : null;

export const Hinweis = ({ children }: { children: any }) => (
  <div className="hinweis"><Ico n="info" /><span>{children}</span></div>);

// ---------- Wer bin ich ----------
export const eigenerName = () => S.ich.name || personName(S.session.user.email);
export const eigeneRolle = () => S.istAdmin ? "Admin"
  : ({ projektleiter: "Projektleiter", supervisor: "Supervisor" } as any)[S.ich.rolle]
  || (S.istPruefer ? "Prüfer" : "User");

// ---------- Belegtexte ----------
export const StatusMarke = ({ b, kurz }: { b: any; kurz?: boolean }) => {
  const s = statusVon(b);
  const t = kurz && s === "teilweise" ? "teilweise" : statusName(s);
  return <span className={`pill p-${statusKlasse(s)}`}>{t}</span>;
};

// Betrag in Listen. Gekürzt oder abgelehnt: Belegbetrag durchgestrichen,
// daneben, was gebucht wird.
export function BetragZelle({ b }: { b: any }) {
  const s = statusVon(b);
  if (s !== "teilweise" && s !== "abgelehnt") return <span className="betragz">{chfLang(b.betrag)}</span>;
  return <span className="betragz"><span className="durch">{chfLang(b.betrag)}</span> {chfLang(buchungsBetrag(b))}</span>;
}

// Nur ein Teil eines aufgeteilten Belegs passt zum Filter
const anteilText = (b: any) =>
  b.gesamtBetrag != null ? ` · Anteil von CHF ${chfLang(b.gesamtBetrag)}` : "";

export function belegKopf(b: any) {
  if (istAufgeteilt(b)) return `Aufgeteilt auf ${b.positionen.length} Positionen` + anteilText(b);
  return (kontoName(b.konto_nummer) || b.konto_nummer) + anteilText(b);
}

export function belegDetail(b: any, mitPerson?: boolean) {
  const teile = [kurzDatum(b.beleg_datum)];
  if (!istAufgeteilt(b)) teile.push(auftragAnzeige(b.auftrag_nr));
  teile.push(zahlartName(b.zahlart));
  if (mitPerson) teile.push(personName(b.geraet));
  return teile.join(" · ");
}

// Eine Zeile am Stück — für die Tabellen am Rechner
export function belegText(b: any) {
  if (istAufgeteilt(b)) {
    const kst = [...new Set(b.positionen.map((p) => auftragAnzeige(p.auftrag_nr)))].join(", ");
    return `${b.positionen.map((p) => p.konto_nummer).join(" + ")} · KST ${kst}` + anteilText(b);
  }
  return `${b.konto_nummer} · KST ${auftragAnzeige(b.auftrag_nr)} · ${b.mwst} %` + anteilText(b);
}

// Der "Stempel": wer hat wann wie entschieden
export function stempelText(n: any) {
  if (!n.entscheidVon) return "";
  if (n.entscheidVon === "automatisch")
    return `Ohne Prüfung durchgegangen (keine zuständige Person) · ${zeitCH(n.entscheidAm)}`;
  return `${statusName(n.status)} durch ${n.entscheidVon} · ${zeitCH(n.entscheidAm)}`;
}

// Knopf "erfasste Belege freigeben" — nur wenn es eigene erfasste gibt.
export function KnopfFreigeben({ liste, woher, className }: { liste: any[]; woher: string; className?: string }) {
  const n = eigeneErfasste(liste).length;
  if (!n) return null;
  return (
    <Knopf akt="freigebenAlle" className={className || "kd klein"} data-w={woher}>
      {n === 1 ? "1 Beleg" : n + " Belege"} freigeben</Knopf>);
}

// ---------- Belegzeile (Handy) und Belegtabelle (Rechner) ----------
export function BelegZeile({ b, woher, person }: { b: any; woher: string; person?: boolean }) {
  return (
    <button className="zl" data-akt="bearbeiten" data-id={b.id} data-w={woher}>
      <span className="ini">{initialen(belegKopf(b))}</span>
      <span className="mitte"><b>{belegKopf(b)}</b>
        <span className="kn mu">{belegDetail(b, person)}</span></span>
      <span className="seite"><BetragZelle b={b} /><StatusMarke b={b} kurz /></span>
    </button>);
}

// Liegt der Beleg in meiner Freigabeliste? Dann führt der Knopf zum Prüfen.
const zuPruefen = (b) => S.freigabe.some((x) => String(x.id) === String(b.id));

export function BelegTabelle({ liste, woher, person }: { liste: any[]; woher: string; person?: boolean }) {
  if (!liste.length) return <div className="leer">Keine Belege für diese Auswahl.</div>;
  return (
    <div className="tabelle"><table>
      <thead><tr>
        <th>Datum</th><th>Buchung</th>{person && <th>Person</th>}<th>Bezahlt</th><th>Status</th>
        <th className="re">Betrag CHF</th><th></th>
      </tr></thead>
      <tbody>
        {liste.map((b) => (
          <tr key={b.id}>
            <td className="mono nw">{langDatum(b.beleg_datum)}</td>
            <td><b>{belegKopf(b)}</b><br /><span className="neben kn">{belegText(b)}</span></td>
            {person && <td className="nw">{personName(b.geraet)}</td>}
            <td className="nw">{zahlartName(b.zahlart)}</td>
            <td><StatusMarke b={b} /></td>
            <td className="re"><BetragZelle b={b} /></td>
            <td className="re nw">
              {b.datei_pfad && <button className="tknopf" data-akt="belegAuf" data-p={b.datei_pfad}>Beleg</button>}
              {zuPruefen(b)
                ? <button className="tknopf" data-akt="bearbeiten" data-id={b.id} data-w="freigabe">Prüfen</button>
                : <button className="tknopf" data-akt="bearbeiten" data-id={b.id} data-w={woher}>Öffnen</button>}
            </td>
          </tr>))}
      </tbody>
    </table></div>);
}

// Suchen in einer Belegliste (Konto, KST, Betrag, Person)
export function belegeSuchen(liste: any[]) {
  const q = S.bSuche.trim().toLowerCase();
  if (!q) return liste;
  return liste.filter((b) => [belegKopf(b), belegText(b), chf(b.betrag), chfLang(b.betrag), personName(b.geraet),
                              zahlartName(b.zahlart), statusName(statusVon(b)), datumCH(b.beleg_datum)]
    .join(" ").toLowerCase().includes(q));
}

// ---------- Kacheln und farbige Karten ----------
const FARBE: Record<string, string> = { blau: "#4c5fd5", dunkel: "#1c1f2e", gruen: "#2e9d4a",
                                        orange: "#e8590c", rot: "#d64545" };
export function Kachel({ lab, wert, fuss, farbe, icon, akt, v, an }:
  { lab: string; wert: any; fuss: any; farbe: string; icon: string; akt?: string; v?: string; an?: boolean }) {
  const f = FARBE[farbe];
  const innen = <>
    <div className="oben">
      <span className="ic" style={{ background: f, boxShadow: `0 4px 10px ${f}66` }}><Ico n={icon} /></span>
      <span className="wert"><span className="kl">{lab}</span><br /><span className="zahlwert">{wert}</span></span>
    </div>
    <div className="fuss">{fuss}</div>
  </>;
  if (!akt) return <div className="karte kachel">{innen}</div>;
  return <button className={"karte kachel" + (an ? " an" : "")} data-akt={akt} data-v={v}
                 aria-pressed={!!an}>{innen}</button>;
}

export function Farbkarte({ farbe, titel, sub, unten, children }:
  { farbe: string; titel: string; sub: string; unten?: any; children: any }) {
  return (
    <div className="karte farbkarte">
      <div className={"farbe f-" + farbe}>{children}</div>
      <div className="unten"><span><b>{titel}</b><span className="kn mu">{sub}</span></span>{unten}</div>
    </div>);
}

// Balken je Gruppe (KST oder Konto) für die dunkle Karte
export function Balken({ zeilen }: { zeilen: { name: string; wert: number }[] }) {
  if (!zeilen.length) return <span className="kn" style={{ opacity: .8 }}>Keine Beträge im Zeitraum.</span>;
  const max = Math.max(...zeilen.map((z) => z.wert)) || 1;
  return <>{zeilen.map((z) => (
    <div className="balken" key={z.name}>
      <div className="txt"><span>{z.name}</span><span className="mono">{chfLang(z.wert)}</span></div>
      <div className="spur"><div style={{ width: Math.max(2, Math.round(z.wert / max * 100)) + "%" }} /></div>
    </div>))}</>;
}

// ---------- Zeitraum ----------
export const zeitraumText = () => `${langDatum(S.uVon).slice(0, 6)}–${langDatum(S.uBis)}`;
const zeitraumLabel = () => istPeriode(S.uVon, S.uBis) ? "Abrechnungsperiode" : "Eigener Zeitraum";

const ZeitraumFelder = () => (
  <div className="zeitraumfelder">
    <div className="feld"><label htmlFor="uvon">Von</label>
      <input id="uvon" type="date" defaultValue={S.uVon} key={"v" + S.uVon} data-feld="uvon" /></div>
    <div className="feld"><label htmlFor="ubis">Bis</label>
      <input id="ubis" type="date" defaultValue={S.uBis} key={"b" + S.uBis} data-feld="ubis" /></div>
  </div>);

// Handy: Karte mit ‹ Periode ›. Antippen der Mitte öffnet "eigener Zeitraum".
export function PeriodeWahl() {
  return (
    <div className="karte">
      <div className="periode">
        <button className="pf" data-akt="periode" data-v="-1" aria-label="Vorherige Periode">‹</button>
        <button className="mitte" data-akt="eigenerZeitraum" aria-expanded={S.eigenerZeitraum}>
          <span className="kl">{zeitraumLabel()}</span><b>{zeitraumText()}</b></button>
        <button className="pf" data-akt="periode" data-v="1" aria-label="Nächste Periode">›</button>
      </div>
      {S.eigenerZeitraum && <>
        <ZeitraumFelder />
        <div style={{ padding: "0 6px 8px" }}>
          <button className="link" data-akt="periodeJetzt">Zur laufenden Periode</button></div>
      </>}
    </div>);
}

// Rechner: kompakt in der Titelzeile
export function PeriodeKlein() {
  return <>
    <span className="periodeklein">
      <button className="pf" data-akt="periode" data-v="-1" aria-label="Vorherige Periode">‹</button>
      <b>{zeitraumText()}</b>
      <button className="pf" data-akt="periode" data-v="1" aria-label="Nächste Periode">›</button>
    </span>
    <button className={"k2 klein" + (S.eigenerZeitraum ? " fett" : "")} data-akt="eigenerZeitraum">
      Eigener Zeitraum</button>
  </>;
}
export const ZeitraumRechner = () => S.eigenerZeitraum
  ? <div className="karte" style={{ maxWidth: 520 }}><ZeitraumFelder />
      <div style={{ padding: "0 6px 8px" }}><button className="link" data-akt="periodeJetzt">Zur laufenden Periode</button></div>
    </div>
  : null;

// ---------- Filter ----------
// Auswahlfeld, das sich neu aufbaut, wenn sich der Wert von aussen ändert
function Auswahl({ id, feld, wert, children }: { id: string; feld: string; wert: string; children: any }) {
  return <select id={id} data-feld={feld} defaultValue={wert} key={wert}>{children}</select>;
}

const darfPerson = () => S.istAdmin || S.istPruefer;

export function FilterChips() {
  const chips: [string, string][] = [];
  if (S.uGeraet)  chips.push(["uGeraet", "Person: " + personName(S.uGeraet)]);
  if (S.uZahlart) chips.push(["uZahlart", ZAHLART[S.uZahlart]]);
  if (S.uStatus)  chips.push(["uStatus", "Status: " + (STATUS_FILTER[S.uStatus] || S.uStatus)]);
  if (S.uKonto)   chips.push(["uKonto", "Konto " + S.uKonto]);
  if (S.uAuftrag) chips.push(["uAuftrag", "KST " + auftragAnzeige(S.uAuftrag)]);
  return <>
    {chips.map(([f, t]) => (
      <span className="chip" key={f}>{t}<button data-akt="filterWeg" data-f={f} aria-label={`${t} entfernen`}>✕</button></span>))}
  </>;
}

export function FilterFelder() {
  if (!S.uFilterOffen) return null;
  const personen = [...new Set(S.uBelege.map((b) => b.geraet))].sort() as string[];
  return (
    <div className="karte innen"><div className="filterfeld">
      {darfPerson() &&
        <div className="feld"><label htmlFor="ugeraet">Person</label>
          <Auswahl id="ugeraet" feld="ugeraet" wert={S.uGeraet}>
            <option value="">Alle Personen</option>
            {personen.map((g) => <option key={g} value={g}>{personName(g)}</option>)}
          </Auswahl></div>}
      <div className="feld"><label htmlFor="uzahlart">Zahlungsart</label>
        <Auswahl id="uzahlart" feld="uzahlart" wert={S.uZahlart}>
          <option value="">Alle</option>
          {Object.entries(ZAHLART).map(([w, n]) => <option key={w} value={w}>{n}</option>)}
        </Auswahl></div>
      <div className="feld"><label htmlFor="ustatus">Status</label>
        <Auswahl id="ustatus" feld="ustatus" wert={S.uStatus}>
          <option value="">Alle</option>
          {Object.entries(STATUS_FILTER).map(([w, n]) => <option key={w} value={w}>{n}</option>)}
        </Auswahl></div>
      <div className="feld"><label htmlFor="ukonto">Konto</label>
        <Auswahl id="ukonto" feld="ukonto" wert={S.uKonto}>
          <option value="">Alle Konten</option>
          {kontenImZeitraum().map((k) => <option key={k} value={k}>{k}{kontoName(k) ? " " + kontoName(k) : ""}</option>)}
        </Auswahl></div>
      <div className="feld"><label htmlFor="uauftrag">KST</label>
        <Auswahl id="uauftrag" feld="uauftrag" wert={S.uAuftrag}>
          <option value="">Alle Kostenstellen</option>
          {auftraegeImZeitraum().map((a) => <option key={a} value={a}>{kstName(a)}</option>)}
        </Auswahl></div>
    </div></div>);
}

export const FilterKnopf = () => {
  const n = [S.uGeraet, S.uZahlart, S.uStatus, S.uKonto, S.uAuftrag].filter(Boolean).length;
  return <button className={"k2 klein" + (S.uFilterOffen ? " fett" : "")} data-akt="filterAuf"
                 aria-expanded={S.uFilterOffen}>Filter{n ? ` · ${n}` : ""}</button>;
};

// Name einer KST für die Anzeige: "2601 Gurtenfestival"
export function kstName(nr: string) {
  if (nr === OHNE_KST.id) return OHNE_KST.name;
  const a = S.auftraege.find((x) => x.id === nr);
  return a && a.name ? nr + " " + a.name : nr;
}

// ---------- Auswahl Konto / KST ----------
// Zeile "KONTO  Verpflegung ›". Am Rechner klappt darunter die Liste auf.
export function Wahl({ akt, titel, haupt, neben, offen, i }:
  { akt: string; titel: string; haupt: string; neben?: string; offen?: boolean; i?: number }) {
  const art = akt === "kontoWahl" ? "konto" : "auftrag";
  const auf = istBreit() && S.wahlOffen && S.wahlOffen.art === art && S.wahlOffen.i === (i ?? null);
  return <>
    <button className={"wahl" + (offen ? " offen" : "") + (auf ? " auf" : "")} data-akt={akt}
            data-i={i != null ? String(i) : undefined} aria-expanded={auf || undefined}>
      <span className="kl titel">{titel}</span>
      <span className="wert"><b>{haupt}</b>{neben && <span className="mono kn mu">{neben}</span>}</span>
      <span className="pfeil" aria-hidden="true">{auf ? "⌄" : "›"}</span>
    </button>
    {auf && <WahlListe art={art} />}
  </>;
}

// Werte für die Wahl-Zeilen
export const kontoWahlText = (k: any) => k ? { haupt: k.bezeichnung || k.nummer, neben: k.nummer }
                                           : { haupt: "wählen", neben: "" };
export const auftragWahlText = (a: any) => !a ? { haupt: "wählen", neben: "" }
  : a.id === OHNE_KST.id ? { haupt: OHNE_KST.name, neben: "" }
  : { haupt: a.name || a.id, neben: a.id };

// Wohin trifft die Auswahl: Favorit, Position oder ganzer Beleg?
export function wahlZiel() {
  if (S.favEdit) return S.favEdit;
  if (S.neu && S.posIndex != null && Array.isArray(S.neu.positionen)) return S.neu.positionen[S.posIndex];
  return S.neu;
}

// Die Liste selbst — als eigene Seite am Handy, aufgeklappt am Rechner
export function WahlListe({ art, seite }: { art: string; seite?: boolean }) {
  const ziel = wahlZiel();
  const q = S.suche.trim().toLowerCase();
  let inhalt;
  if (art === "konto") {
    const gewaehlt = ziel ? ziel.konto : null;
    const liste = aktiveKonten().filter((k) => !q || String(k.nummer).includes(q)
                                         || String(k.bezeichnung || "").toLowerCase().includes(q));
    inhalt = liste.length === 0 ? <div className="leer">Nichts gefunden.</div>
      : liste.map((k) => (
        <button key={k.nummer} className={"eintrag" + (gewaehlt && gewaehlt.nummer === k.nummer ? " an" : "")}
                data-akt="kontoSet" data-nr={k.nummer}>
          <span className="nr">{k.nummer}</span><span className="nm">{k.bezeichnung}</span>
          <span className="pill p-rol">{k.mwst} %</span>
        </button>));
  } else {
    const gewaehlt = ziel ? ziel.auftrag : null;
    const passt = (a) => !q || String(a.id).toLowerCase().includes(q) || String(a.name || "").toLowerCase().includes(q);
    // "ohne KST" steht immer zuoberst — auch wenn FileMaker nichts geliefert hat.
    const liste = [...(passt(OHNE_KST) ? [OHNE_KST] : []), ...S.auftraege.filter(passt).slice(0, 60)];
    inhalt = <>
      {!S.auftraege.length &&
        <div className="fehler" style={{ margin: 10 }}>Die Auftragsnummern konnten nicht aus FileMaker geladen
          werden. Seite neu laden oder später nochmal versuchen.</div>}
      {liste.length === 0 ? <div className="leer">Nichts gefunden.</div>
        : liste.map((a: any) => (
          <button key={a.id} className={"eintrag" + (gewaehlt && gewaehlt.id === a.id ? " an" : "")}
                  data-akt="auftragSet" data-id={a.id}>
            <span className="nr">{a.id === OHNE_KST.id ? "—" : a.id}</span>
            <span className="nm">{a.name}</span>
            {a.fix ? <span className="pill p-rol">fest</span> : (a.immer ? <span className="pill p-rol">fix</span> : null)}
          </button>))}
    </>;
  }
  const suche = (
    <input id="suche" type="search" placeholder={art === "konto" ? "Nummer oder Bezeichnung suchen" : "Nummer oder Name suchen"}
           defaultValue={S.suche} data-feld="suche" autoFocus={!seite} aria-label="Suchen" />);
  if (seite) return <>{suche}<div className="karte huelle">{inhalt}</div></>;
  return <div className="wahlliste">{suche}<div className="liste">{inhalt}</div></div>;
}

// ---------- Verlauf ----------
const VERLAUF_FARBE: Record<string, string> = { erf: "#9ba1bb", ein: "#e8590c", gep: "#4c5fd5",
  bes: "#7a3aa8", gen: "#2e9d4a", abl: "#d64545" };
export function VerlaufListe({ anzahl }: { anzahl?: number }) {
  const liste = S.verlauf.slice(0, anzahl || 8);
  if (!liste.length) return <div className="kn mu">Noch keine Einträge.</div>;
  return <>{liste.map((v) => {
    const e = verlaufEintrag(v);
    return (
      <div key={v.id} style={{ display: "flex", gap: 12 }}>
        <span style={{ width: 22, height: 22, borderRadius: 999, background: VERLAUF_FARBE[e.farbe] || "#1c1f2e",
                       flexShrink: 0, marginTop: 1 }} />
        <span style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
          <b style={{ fontSize: 14 }}>{e.titel}</b><span className="kn mu">{e.sub}</span></span>
      </div>);
  })}</>;
}
