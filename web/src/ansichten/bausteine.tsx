// bausteine.tsx
// Kleine, wiederverwendete Teile: Kopf, Reiter, Symbole, Marken, Belegtexte.
// Klicks laufen über data-akt="…" an aktionen.ts — wie in der alten Fassung.

import React from "react";
import { S } from "../zustand";
import {
  st, istBreit, chf, datumCH, zeitCH, kurzName, statusVon, statusName, zahlartName,
  auftragAnzeige, istAufgeteilt, buchungsBetrag
} from "../grundlagen";
import { kontoName, eigeneErfasste } from "../daten";

// ---------- Symbole ----------
export const Stift = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#215aa8" strokeWidth="2"
       strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M4 20h4l10-10-4-4L4 16z" /><path d="M14 6l4 4" /></svg>);
export const Stern = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#215aa8" strokeWidth="2"
       strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 4l2.4 5 5.6.8-4 3.9 1 5.5-5-2.6-5 2.6 1-5.5-4-3.9 5.6-.8z" /></svg>);
export const Hoch = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#8B9AB4" strokeWidth="1.8"
       strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 16V5" /><path d="M7 10l5-5 5 5" /><path d="M5 19h14" /></svg>);
export const Plus = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#215aa8" strokeWidth="2.2"
       strokeLinecap="round" aria-hidden="true">
    <path d="M12 5v14" /><path d="M5 12h14" /></svg>);
export const Info = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#5A6478" strokeWidth="2"
       strokeLinecap="round" style={st("flex-shrink:0;margin-top:2px")} aria-hidden="true">
    <circle cx="12" cy="12" r="9" /><path d="M12 11v5" /><path d="M12 8v.01" /></svg>);

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
export const Meldung = () => S.meldung ? <div className="ok">{S.meldung}</div> : null;

// ---------- Kopf ----------
// zurueck = Pfeil links. auchKnoepfe = Pfeil UND die Knöpfe rechts.
export function Kopf({ titel, sub, zurueck, auchKnoepfe }:
                     { titel: string; sub?: string; zurueck?: boolean; auchKnoepfe?: boolean }) {
  const adminAn = ["benutzer", "benForm", "konten", "kontoForm", "zuweisungen"]
                  .includes(S.ansicht) ? "an" : "";
  // Am Rechner gibt es keine Reiter — die Freigabe steht oben rechts.
  const knoepfe = (
    <div className="kopfknoepfe">
      {S.istPruefer && istBreit() &&
        <button className={S.ansicht === "freigabe" ? "an" : ""} data-akt="tabFreigabe">
          Freigabe{S.freigabe.length ? ` (${S.freigabe.length})` : ""}</button>}
      {S.istAdmin && <button className={adminAn} data-akt="tabBenutzer">Admin</button>}
      <button data-akt="zuPasswort">Passwort</button>
      <button data-akt="abmelden">Abmelden</button>
    </div>);
  return (
    <div className="kopf">
      {zurueck && <button className="rund" data-akt="zurueck" aria-label="Zurück">‹</button>}
      <div className="wachs"><h1>{titel}</h1><div className="sub">{sub}</div></div>
      {(!zurueck || auchKnoepfe) && knoepfe}
    </div>);
}

// Reiter nur am Handy — am Rechner steht ohnehin alles nebeneinander
export function Reiter() {
  if (istBreit()) return null;
  return (
    <div className="reiter">
      <button className={S.ansicht === "liste" ? "an" : ""} data-akt="tabListe">Meine Belege</button>
      <button className={S.ansicht === "uebersicht" ? "an" : ""} data-akt="tabUebersicht">Übersicht</button>
      {S.istPruefer &&
        <button className={S.ansicht === "freigabe" ? "an" : ""} data-akt="tabFreigabe">
          Freigabe{S.freigabe.length ? ` (${S.freigabe.length})` : ""}</button>}
    </div>);
}

// Reiter der Admin-Seite — auf Handy und Rechner gleichermassen
export function AdminReiter() {
  const ben = (S.ansicht === "benutzer" || S.ansicht === "benForm") ? "an" : "";
  const kon = (S.ansicht === "konten" || S.ansicht === "kontoForm") ? "an" : "";
  const zuw = S.ansicht === "zuweisungen" ? "an" : "";
  return (
    <div className="reiter">
      <button className={ben} data-akt="tabBenutzer">Benutzer</button>
      <button className={kon} data-akt="tabKonten">Konten</button>
      <button className={zuw} data-akt="tabZuweisungen">Zuweisungen</button>
    </div>);
}

// ---------- Belegtexte ----------
// Farbige Marke für den Status eines Belegs
export const StatusMarke = ({ b }: { b: any }) =>
  <span className={`rolle st-${statusVon(b)}`}>{statusName(statusVon(b))}</span>;

// Betrag in Listen. Gekürzt oder abgelehnt: Belegbetrag durchgestrichen,
// darunter, was gebucht wird.
export function BetragZelle({ b }: { b: any }) {
  const s = statusVon(b);
  if (s !== "teilweise" && s !== "abgelehnt") return <>{chf(b.betrag)}</>;
  return <><s style={st("color:var(--grau);font-weight:400;font-size:13px")}>{chf(b.betrag)}</s><br />
           {chf(buchungsBetrag(b))}</>;
}

// Nur ein Teil eines aufgeteilten Belegs passt zum Filter
const anteilText = (b: any) =>
  b.gesamtBetrag != null ? ` · Anteil von CHF ${chf(b.gesamtBetrag)}` : "";

// Am Handy oben das Konto, darunter der Rest
export function belegKopf(b: any) {
  if (istAufgeteilt(b)) return `Aufgeteilt auf ${b.positionen.length} Positionen` + anteilText(b);
  return `${b.konto_nummer} ${kontoName(b.konto_nummer)}` + anteilText(b);
}

export function belegDetail(b: any, mitGeraet?: boolean) {
  const teile = [];
  if (!istAufgeteilt(b)) teile.push(auftragAnzeige(b.auftrag_nr), b.mwst + " %");
  teile.push(datumCH(b.beleg_datum), zahlartName(b.zahlart));
  if (mitGeraet) teile.push(kurzName(b.geraet));
  return teile.join(" · ");
}

// Eine Zeile am Stück — für das Rechner-Layout
export function belegText(b: any) {
  if (istAufgeteilt(b)) return `Aufgeteilt auf ${b.positionen.length} Positionen` + anteilText(b);
  return `${b.konto_nummer} ${kontoName(b.konto_nummer)} · ${auftragAnzeige(b.auftrag_nr)} · ${b.mwst} %`
       + anteilText(b);
}

// Der "Stempel": wer hat wann wie entschieden
export function stempelText(n: any) {
  if (!n.entscheidVon) return "";
  if (n.entscheidVon === "automatisch")
    return `Ohne Prüfung durchgegangen (keine zuständige Person) · ${zeitCH(n.entscheidAm)}`;
  return `${statusName(n.status)} durch ${n.entscheidVon} · ${zeitCH(n.entscheidAm)}`;
}

// Knopf "erfasste Belege freigeben" — nur wenn es eigene erfasste gibt.
export function KnopfFreigeben({ liste, woher }: { liste: any[]; woher: string }) {
  const n = eigeneErfasste(liste).length;
  if (!n) return null;
  return (
    <Knopf akt="freigebenAlle" className="zweit" data-w={woher} style={st("margin-bottom:12px")}>
      {n === 1 ? "1 erfassten Beleg" : n + " erfasste Belege"} zur Prüfung freigeben</Knopf>);
}

// Auswahlfeld wie "Konto ›" / "Auftrag ›"
export function Wahl({ akt, titel, wert, offen, i, style }:
                     { akt: string; titel: string; wert: string; offen?: boolean; i?: number; style?: any }) {
  return (
    <button className={"wahl" + (offen ? " offen" : "")} data-akt={akt}
            data-i={i != null ? String(i) : undefined} style={style}>
      <span className="titel">{titel}</span>
      <span className="wert" style={offen === undefined ? undefined
                                    : { color: offen ? "var(--warn)" : "var(--dunkel)" }}>{wert}</span>
      <span className="pfeil">›</span>
    </button>);
}
