// bausteine.tsx
// Kleine, wiederverwendete Teile: Symbole, Knöpfe, Marken, Kacheln, Zeitraum,
// Filter, Belegzeilen, Auswahl für Konto/KST, Verlauf.
// Klicks laufen über data-akt="…" an aktionen.ts — wie in der alten Fassung.

import React from "react";
import { S } from "../zustand";
import {
  istBreit, chf, chfLang, datumCH, zeitCH, langDatum, kurzDatum, statusVon, statusName, statusKlasse,
  zahlartName, auftragAnzeige, istAufgeteilt, buchungsBetrag, initialen, istPeriode, belegZeilen,
  ZAHLART, STATUS_FILTER, STATUS_FILTER_MEINE, OHNE_KST, MAX_PERIODEN, periode
} from "../grundlagen";
import {
  kontoName, eigeneErfasste, personName, aktiveKonten, kontenImZeitraum, auftraegeImZeitraum,
  verlaufEintrag, geraetName, imBereich, ohneKst
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
  karte: "M2 5h20v14H2zm2 2v2h16V7zm0 5v5h16v-5zm2 2h5v1.5H6z",
  raute: "M9.5 3 8.7 8H4v2h4.4l-.7 4H3v2h4.4L6.6 21h2l.8-5h4l-.8 5h2l.8-5H20v-2h-4.4l.7-4H21V8h-4.4l.8-5h-2l-.8 5h-4l.8-5zm.6 7h4l-.7 4h-4z",
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

// Ein Beleg heisst nach seiner KST: "Gurtenfestival 2026 2601".
// Das Konto steht klein darunter.
export function kstTitel(nr: string) {
  if (nr === OHNE_KST.id) return OHNE_KST.name;
  const a = S.auftraege.find((x) => x.id === nr);
  return a && a.name ? `${a.name} ${nr}` : `KST ${nr}`;
}
const kontoText = (nr: string) => `${nr} ${kontoName(nr)}`.trim();

export function belegKopf(b: any) {
  if (istAufgeteilt(b))
    return [...new Set(b.positionen.map((p) => kstTitel(p.auftrag_nr)))].join(", ") + anteilText(b);
  return kstTitel(b.auftrag_nr) + anteilText(b);
}

// Kurz für die Kachel links: die KST-Nummer
export const belegKurz = (b: any) => {
  const nr = istAufgeteilt(b) ? b.positionen[0].auftrag_nr : b.auftrag_nr;
  return nr === OHNE_KST.id ? "—" : String(nr || "—");
};

const kontenText = (b: any) => istAufgeteilt(b)
  ? b.positionen.map((p) => p.konto_nummer).join(" + ") : kontoText(b.konto_nummer);

// "Kreditkarte" bzw. "Kreditkarte · Gerät 1"
export const bezahltText = (b: any) =>
  zahlartName(b.zahlart) + (b.zahlgeraet_id != null ? " · " + geraetName(b.zahlgeraet_id) : "");

export function belegDetail(b: any, mitPerson?: boolean) {
  const teile = [kurzDatum(b.beleg_datum), kontenText(b), bezahltText(b)];
  if (mitPerson) teile.push(personName(b.geraet));
  return teile.join(" · ");
}

// Eine Zeile am Stück — für die Tabellen am Rechner
export function belegText(b: any) {
  if (istAufgeteilt(b)) return `Konten ${kontenText(b)}` + anteilText(b);
  return `Konto ${kontoText(b.konto_nummer)} · ${b.mwst} %` + anteilText(b);
}

const Kommentar = ({ b }: { b: any }) => b.kommentar
  ? <span className="kn kommentar">„{b.kommentar}“</span> : null;

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
      <span className="ini nr">{belegKurz(b)}</span>
      <span className="mitte"><b>{belegKopf(b)}</b>
        <span className="kn mu">{belegDetail(b, person)}</span><Kommentar b={b} /></span>
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
          <tr key={b.id} className="klickbar" data-akt="bearbeiten" data-id={b.id}
              data-w={zuPruefen(b) ? "freigabe" : woher} title={zuPruefen(b) ? "Prüfen" : "Öffnen"}>
            <td className="mono nw">{langDatum(b.beleg_datum)}</td>
            <td className="buchung"><b>{belegKopf(b)}</b><br /><span className="neben kn">{belegText(b)}</span>
              {b.kommentar && <><br /><Kommentar b={b} /></>}</td>
            {person && <td className="nw">{personName(b.geraet)}</td>}
            <td className="nw">{zahlartName(b.zahlart)}{b.zahlgeraet_id != null && <><br /><span className="kn mu">{geraetName(b.zahlgeraet_id)}</span></>}</td>
            <td><StatusMarke b={b} /></td>
            <td className="re"><BetragZelle b={b} /></td>
            <td className="re nw">
              {zuPruefen(b) ? <span className="tknopf">Prüfen ›</span> : <span className="pfeilchen">›</span>}
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
                              bezahltText(b), statusName(statusVon(b)), datumCH(b.beleg_datum),
                              b.kommentar || ""]
    .join(" ").toLowerCase().includes(q));
}

// ---------- Zeitraum ----------
// Abrechnungsperiode = 16. bis 15. des Folgemonats. Benannt wird sie relativ
// zu heute ("Laufende Periode", "Letzte Periode"), damit klar ist, was gilt.
export const zeitraumText = () => `${langDatum(S.uVon).slice(0, 6)}–${langDatum(S.uBis)}`;
const gespeichert = () => S.perioden.find((p) => p.von === S.uVon && p.bis === S.uBis);

// Wie viele Perioden liegt der gewählte Zeitraum zurück? null = keine Periode
function periodenAbstand(): number | null {
  if (!istPeriode(S.uVon, S.uBis)) return null;
  for (let i = 0; i > -36; i--) if (periode(i).von === S.uVon) return i;
  for (let i = 1; i < 12; i++) if (periode(i).von === S.uVon) return i;
  return null;
}
const PERIODE_NAME: Record<string, string> = { "0": "Laufende Periode", "-1": "Letzte Periode", "1": "Nächste Periode" };
export const zeitraumLabel = () => {
  if (gespeichert()) return gespeichert().name;
  const i = periodenAbstand();
  if (i == null) return "Eigener Zeitraum";
  return PERIODE_NAME[String(i)] || `Periode vor ${-i} Monaten`;
};
export const istLaufendePeriode = () => periodenAbstand() === 0;

// Gespeicherte Zeiträume als Schnellwahl (höchstens drei je Person) — Handy
export function Schnellwahl() {
  if (!S.perioden.length) return null;
  return (
    <div className="chips">
      {S.perioden.map((p) => {
        const an = p.von === S.uVon && p.bis === S.uBis;
        return (
          <span className={"chip" + (an ? " an" : "")} key={p.id}>
            <button className="chipwahl" data-akt="periodeWahl" data-id={p.id} aria-pressed={an}>
              {p.name} <span className="mono kn">{kurzDatum(p.von)}–{kurzDatum(p.bis)}</span></button>
            <button data-akt="periodeWeg" data-id={p.id} aria-label={`Zeitraum ${p.name} löschen`}>✕</button>
          </span>);
      })}
    </div>);
}

const ZeitraumKnoepfe = () => (
  <div style={{ padding: "0 6px 8px", display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center" }}>
    <button className="link" data-akt="periodeNeu" disabled={S.perioden.length >= MAX_PERIODEN}>
      + Zeitraum speichern</button>
    <button className="link" data-akt="periodeJetzt">Zur laufenden Periode</button>
    {S.perioden.length >= MAX_PERIODEN && <span className="kn mu">3 von 3 gespeichert — zuerst einen über ✕ löschen.</span>}
  </div>);

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
      {S.eigenerZeitraum && <><ZeitraumFelder /><ZeitraumKnoepfe /></>}
      {S.perioden.length > 0 && <div style={{ padding: "0 8px 8px" }}><Schnellwahl /></div>}
    </div>);
}

// Rechner: eine Auswahl mit den letzten Perioden, den gespeicherten Zeiträumen
// und "Eigener Zeitraum …", dazu ‹ › für die Nachbarperiode.
function ZeitraumAuswahl() {
  const i = periodenAbstand();
  const g = gespeichert();
  const eigen = S.eigenerZeitraum || (i == null && !g);
  const wert = eigen ? "eigen" : g ? "g:" + g.id : "p:" + i;
  const perioden = Array.from({ length: 13 }, (_, k) => -k);
  if (i != null && !perioden.includes(i)) perioden.unshift(i);
  return (
    <div className="wz-zeitraum">
      <button className="pf" data-akt="periode" data-v="-1" aria-label="Vorherige Periode" title="Vorherige Periode">‹</button>
      <select data-feld="zeitraum" defaultValue={wert} key={wert + S.uVon + S.uBis} aria-label="Zeitraum">
        <optgroup label="Abrechnungsperioden (16. bis 15.)">
          {perioden.map((k) => {
            const p = periode(k);
            const name = PERIODE_NAME[String(k)];
            return <option key={k} value={"p:" + k}>
              {name ? `${name} · ` : ""}{langDatum(p.von).slice(0, 6)}–{langDatum(p.bis)}</option>;
          })}
        </optgroup>
        {S.perioden.length > 0 &&
          <optgroup label="Gespeichert">
            {S.perioden.map((p) => <option key={p.id} value={"g:" + p.id}>
              {p.name} · {kurzDatum(p.von)}–{kurzDatum(p.bis)}</option>)}
          </optgroup>}
        <option value="eigen">{eigen ? `Eigener Zeitraum · ${zeitraumText()}` : "Eigener Zeitraum …"}</option>
      </select>
      <button className="pf" data-akt="periode" data-v="1" aria-label="Nächste Periode" title="Nächste Periode">›</button>
    </div>);
}

// Rechner: Zeile für einen eigenen Zeitraum (Von, Bis, speichern) bzw.
// zum Löschen eines gespeicherten
function ZeitraumZusatz() {
  const g = gespeichert();
  const eigen = S.eigenerZeitraum || (periodenAbstand() == null && !g);
  if (!eigen && !g) return null;
  return (
    <div className="wz-zeile">
      {eigen && <>
        <label className="wz-feld"><span>Von</span>
          <input type="date" defaultValue={S.uVon} key={"v" + S.uVon} data-feld="uvon" /></label>
        <label className="wz-feld"><span>Bis</span>
          <input type="date" defaultValue={S.uBis} key={"b" + S.uBis} data-feld="ubis" /></label>
        <button className="link" data-akt="periodeNeu" disabled={S.perioden.length >= MAX_PERIODEN}
                title={S.perioden.length >= MAX_PERIODEN ? "Es gehen höchstens drei — zuerst einen löschen." : undefined}>
          + Diesen Zeitraum speichern</button>
      </>}
      {g && <button className="link" data-akt="periodeWeg" data-id={g.id}>Gespeicherten Zeitraum „{g.name}“ löschen</button>}
      <button className="link" data-akt="periodeJetzt">Zur laufenden Periode</button>
    </div>);
}

// ---------- Filter ----------
// Auswahlfeld, das sich neu aufbaut, wenn sich der Wert von aussen ändert
function Auswahl({ id, feld, wert, children }: { id?: string; feld: string; wert: string; children: any }) {
  return <select id={id} data-feld={feld} defaultValue={wert} key={wert}>{children}</select>;
}

const darfPerson = () => S.istAdmin || S.istPruefer;

// Zwei Filter-Bereiche: "u" = Übersicht, "m" = Meine Belege. Felder heissen
// S.uZahlart / S.mZahlart usw.
type Bereich = "u" | "m";

const filterAnzahl = (b: Bereich) => [S[b + "Zahlart"], S[b + "Status"], S[b + "Konto"], S[b + "Auftrag"],
  ...(b === "u" ? [S.uGeraet, S.uZahlgeraet] : [])].filter(Boolean).length;

export function FilterChips({ b = "u" }: { b?: Bereich }) {
  const statusNamen = b === "m" ? STATUS_FILTER_MEINE : STATUS_FILTER;
  const chips: [string, string][] = [];
  if (b === "u" && S.uGeraet) chips.push(["uGeraet", "Person: " + personName(S.uGeraet)]);
  if (S[b + "Zahlart"]) chips.push([b + "Zahlart", ZAHLART[S[b + "Zahlart"]]]);
  if (b === "u" && S.uZahlgeraet) chips.push(["uZahlgeraet", "Gerät: " + geraetName(S.uZahlgeraet)]);
  if (S[b + "Status"])  chips.push([b + "Status", "Status: " + (statusNamen[S[b + "Status"]] || S[b + "Status"])]);
  if (S[b + "Konto"])   chips.push([b + "Konto", "Konto " + S[b + "Konto"]]);
  if (S[b + "Auftrag"]) chips.push([b + "Auftrag", "KST " + auftragAnzeige(S[b + "Auftrag"])]);
  return <>
    {chips.map(([f, t]) => (
      <span className="chip" key={f}>{t}<button data-akt="filterWeg" data-f={f} aria-label={`${t} entfernen`}>✕</button></span>))}
  </>;
}

// Was kommt in einer Liste an Konten und KST vor? Füllt die Auswahlfelder.
function vorkommen(liste: any[], feld: string) {
  const s = new Set<string>();
  for (const x of liste) for (const p of belegZeilen(x)) s.add(p[feld]);
  return [...s].sort((a, c) => String(a).localeCompare(String(c), "de", { numeric: true }));
}

// Die einzelnen Filter als Auswahlfelder — am Handy aufklappbar, am Rechner
// immer sichtbar in der Werkzeugleiste. ohneGruppen: Person, KST und Konto
// weglassen (in der Übersicht stehen die links in der Gruppenliste).
function filterAuswahl(b: Bereich, ohneGruppen?: boolean) {
  const imAbschnitt = S.uBelege.filter((x) => imBereich(x));
  const liste = b === "m" ? S.belege : imAbschnitt;
  const personen = [...new Set(imAbschnitt.map((x) => x.geraet))].sort() as string[];
  const statusNamen = b === "m" ? STATUS_FILTER_MEINE : STATUS_FILTER;
  const f: [string, any][] = [];
  if (b === "u" && darfPerson() && !ohneGruppen)
    f.push(["Person", <Auswahl feld="ugeraet" wert={S.uGeraet}>
      <option value="">Alle Personen</option>
      {personen.map((g) => <option key={g} value={g}>{personName(g)}</option>)}</Auswahl>]);
  f.push(["Zahlungsart", <Auswahl feld={b + "zahlart"} wert={S[b + "Zahlart"]}>
    <option value="">Alle</option>
    {Object.entries(ZAHLART).map(([w, n]) => <option key={w} value={w}>{n}</option>)}</Auswahl>]);
  if (b === "u" && S.zahlgeraete.length > 0)
    f.push(["Gerät", <Auswahl feld="uzahlgeraet" wert={S.uZahlgeraet}>
      <option value="">Alle Geräte</option>
      {S.zahlgeraete.map((g) => <option key={g.id} value={String(g.id)}>{g.name} · {kstName(g.auftrag_nr)}</option>)}
    </Auswahl>]);
  f.push(["Status", <Auswahl feld={b + "status"} wert={S[b + "Status"]}>
    <option value="">Alle</option>
    {Object.entries(statusNamen).map(([w, n]) => <option key={w} value={w}>{n}</option>)}</Auswahl>]);
  if (!ohneGruppen) {
    f.push(["Konto", <Auswahl feld={b + "konto"} wert={S[b + "Konto"]}>
      <option value="">Alle Konten</option>
      {vorkommen(liste, "konto_nummer").map((k) => <option key={k} value={k}>{k}{kontoName(k) ? " " + kontoName(k) : ""}</option>)}
    </Auswahl>]);
    f.push(["KST", <Auswahl feld={b + "auftrag"} wert={S[b + "Auftrag"]}>
      <option value="">Alle Kostenstellen</option>
      {vorkommen(liste, "auftrag_nr").map((a) => <option key={a} value={a}>{kstName(a)}</option>)}
    </Auswahl>]);
  }
  return f;
}

// Handy: aufklappbare Filterfelder unter dem Suchfeld
export function FilterFelder({ b = "u" }: { b?: Bereich }) {
  if (!S[b + "FilterOffen"]) return null;
  return (
    <div className="karte innen"><div className="filterfeld">
      {filterAuswahl(b).map(([lab, feld]) => (
        <label className="feld" key={lab}><span className="lab">{lab}</span>{feld}</label>))}
    </div></div>);
}

export const FilterKnopf = ({ b = "u" }: { b?: Bereich }) => {
  const n = filterAnzahl(b);
  const offen = S[b + "FilterOffen"];
  return <button className={"k2 klein" + (offen ? " fett" : "")} data-akt="filterAuf" data-b={b}
                 aria-expanded={offen}>Filter{n ? ` · ${n}` : ""}</button>;
};

// Suchfeld — am Handy immer direkt unter der Periode, daneben der Filterknopf
export const SuchFeld = ({ breit }: { breit?: number }) => (
  <input type="search" placeholder="Suchen: KST, Konto, Kommentar, Betrag …" aria-label="Belege durchsuchen"
         defaultValue={S.bSuche} key={"s" + S.bSucheNeu} data-feld="bsuche"
         style={breit ? { width: breit } : undefined} />);

export const Suchzeile = ({ b = "u" }: { b?: Bereich }) => (
  <div className="suchzeile"><SuchFeld /><FilterKnopf b={b} /></div>);

// Rechner: Werkzeugleiste mit Zeitraum, Suche und den Filtern — immer sichtbar
export function Werkzeugleiste({ b, ohneGruppen }: { b: Bereich; ohneGruppen?: boolean }) {
  const aktiv = filterAnzahl(b) > 0 || !!S.bSuche.trim();
  return (
    <div className="karte werkzeugleiste">
      <div className="wz-zeile">
        <div className="wz-feld"><span>Zeitraum</span><ZeitraumAuswahl /></div>
        <label className="wz-feld wz-suche"><span>Suchen</span><SuchFeld /></label>
        {filterAuswahl(b, ohneGruppen).map(([lab, feld]) => (
          <label className="wz-feld" key={lab}><span>{lab}</span>{feld}</label>))}
        {aktiv && <button className="link wz-weg" data-akt="filterAlleWeg" data-b={b}>Filter zurücksetzen</button>}
      </div>
      <ZeitraumZusatz />
    </div>);
}

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

// KST-Zeile zu einem Konto. Bei einem Konto ohne KST wählt man die KST wie
// immer (sie bestimmt die Karte) — gebucht wird aber auf „ohne KST“, das sagt
// die Zeile darunter. Beim Prüfen ist die Karte schon gewählt: dort steht
// nur noch „ohne KST“.
export function KstWahl({ konto, auftrag, i, pruefen }: { konto: any; auftrag: any; i?: number; pruefen?: boolean }) {
  const ohne = konto && ohneKst(konto.nummer);
  if (ohne && pruefen) return (
    <div className="wahl fest">
      <span className="kl titel">KST</span>
      <span className="wert"><b>{OHNE_KST.name}</b><span className="kn mu">Konto ohne KST</span></span>
    </div>);
  const at = auftragWahlText(auftrag);
  return <>
    <Wahl akt="auftragWahl" i={i} titel="KST" offen={!auftrag} haupt={at.haupt} neben={at.neben} />
    {ohne && <div className="wahlhinweis">Konto ohne KST: gebucht wird auf „ohne KST“ — die KST bestimmt nur die Karte.</div>}
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
// Eine Liste untereinander: Punkt, was geschah und an welchem Beleg, wer und wann.
// Im Abschnitt (Projektleitung, Supervisor) nur die Schritte seiner Belege.
const VERLAUF_FARBE: Record<string, string> = { erf: "#9ba1bb", ein: "#e8590c", gep: "#4c5fd5",
  bes: "#7a3aa8", gen: "#2e9d4a", abl: "#d64545" };
export function VerlaufListe({ anzahl }: { anzahl?: number }) {
  const liste = S.verlauf.map((v) => ({ v, e: verlaufEintrag(v) }))
    .filter(({ e }) => e.beleg ? imBereich(e.beleg) : (!S.bereich || S.bereich === "admin"))
    .slice(0, anzahl || 8);
  if (!liste.length) return <div className="leer">Noch keine Einträge.</div>;
  return (
    <div className="verlauf">
      {liste.map(({ v, e }) => {
        const was = [e.beleg ? belegKopf(e.beleg) : "Beleg", e.betrag != null ? "CHF " + chfLang(e.betrag) : ""]
          .filter(Boolean).join(" · ");
        const innen = <>
          <span className="punkt" style={{ background: VERLAUF_FARBE[e.farbe] || "#1c1f2e" }} />
          <span className="v-was"><b>{e.titel}</b><span>{was}</span></span>
          <span className="v-wer"><span>{e.wer}</span><span className="mono kn mu">{e.wann}</span></span>
        </>;
        return e.belegId
          ? <button key={v.id} className="vzeile" data-akt="bearbeiten" data-id={e.belegId} data-w="uebersicht">{innen}</button>
          : <div key={v.id} className="vzeile">{innen}</div>;
      })}
    </div>);
}

// ---------- Reiter mit Zahlen (statt Kacheln) ----------
// f: Feld im Zustand, das der Reiter setzt; v: Wert. Rechts optional eine Summe.
export function Reiterleiste({ f, reiter, rechts }:
  { f: string; reiter: { v: string; lab: string; n: number }[]; rechts?: any }) {
  return (
    <div className="reiterleiste" role="tablist">
      {reiter.map((r) => {
        const an = (S[f] || "") === r.v;
        return <button key={r.v || "alle"} role="tab" aria-selected={an} className={"reiter" + (an ? " an" : "")}
                       data-akt="setze" data-f={f} data-v={r.v}>{r.lab} <b>{r.n}</b></button>;
      })}
      {rechts && <span className="summe">{rechts}</span>}
    </div>);
}

// Eine schmale Zeile für das, was etwas braucht (statt grosser Karten)
export const Hinweiszeile = ({ farbe, children, knopf }: { farbe?: string; children: any; knopf?: any }) => (
  <div className={"hinweiszeile" + (farbe ? " " + farbe : "")}>
    <span className="txt">{children}</span>{knopf}</div>);
