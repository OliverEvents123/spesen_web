// rahmen.tsx
// Der Rahmen um jede Seite: am Handy dunkler Kopf und unten die Leiste mit
// dem Kamera-Knopf, am Rechner die dunkle Seitenleiste links.

import { S } from "../zustand";
import { istBreit, initialen } from "../grundlagen";
import { Ico, Meldung, eigenerName, eigeneRolle } from "./bausteine";
import { bereiche, freigabeIm, BEREICH_NAME } from "../daten";

// Welche Hauptseite ist gerade "an"? Unterseiten zählen zu ihrer Hauptseite.
function aktiv() {
  const a = S.ansicht;
  // Ein neuer Beleg gehört zu keiner Seite; ein geöffneter zu der, aus der er kommt
  if (a === "erfassen" || a === "kontoWahl" || a === "auftragWahl") return S.neu && !S.neu.id ? "neu" : S.zurueckZu;
  if (a === "favForm") return "favoriten";
  if (a === "benForm") return "benutzer";
  if (a === "kontoForm") return "konten";
  if (a === "geraetForm") return "geraete";
  return a;
}

// ---------- Handy ----------
function Kopf({ titel, sub, zurueck, rechts }: { titel: string; sub?: string; zurueck?: boolean; rechts?: any }) {
  return (
    <header className="kopf">
      {zurueck && <button className="zurueck" data-akt="zurueck" aria-label="Zurück">‹</button>}
      <div className="mitte">
        {!zurueck && sub && <span className="sub">{sub}</span>}
        <h1>{titel}</h1>
        {zurueck && sub && <span className="sub">{sub}</span>}
      </div>
      {rechts}
      {!zurueck && <button className="avatar" data-akt="zuProfil" aria-label="Profil">
        {initialen(eigenerName())}</button>}
    </header>);
}

function Tabbar() {
  const an = aktiv();
  const t = (k: string, akt: string, lab: string, ic: string, zahl?: number) => (
    <button className={"tab" + (an === k ? " an" : "")} data-akt={akt} aria-current={an === k ? "page" : undefined}>
      <Ico n={ic} />{lab}{zahl ? <span className="zahl">{zahl}</span> : null}</button>);
  return (
    <nav className="tabbar" aria-label="Hauptnavigation">
      {t("liste", "tabListe", "Belege", "doc")}
      {S.istPruefer && t("uebersicht", "tabUebersicht", "Übersicht", "grid")}
      <div className="tabmitte"><button data-akt="neu" aria-label="Beleg erfassen"><Ico n="kamera" /></button></div>
      {S.istPruefer && t("freigabe", "tabFreigabe", "Freigabe", "check", S.freigabe.length)}
      {t("profil", "zuProfil", "Profil", "person")}
    </nav>);
}

// ---------- Rechner ----------
// Seitenleiste mit Abschnitten: "Meine Spesen" haben alle, dazu je nach
// Zuweisung Projektleitung und Supervisor, für Admins die Administration.
// Jeder Abschnitt hat seine eigene Übersicht und Freigabe.
function Leiste() {
  const an = aktivSchluessel();
  const n = (k: string, akt: string, lab: string, ic: string, zahl?: number, b?: string) => (
    <button key={k} className={an === k ? "an" : ""} data-akt={akt} data-b={b}
            aria-current={an === k ? "page" : undefined}>
      <Ico n={ic} />{lab}{zahl ? <span className="zahl">{zahl}</span> : null}</button>);
  const abschnitt = (b: string) => <div className="abschnitt" key={b}>
    <div className="gr">{BEREICH_NAME[b].toUpperCase()}</div>
    {n("uebersicht:" + b, "tabUebersicht", "Übersicht", "grid", 0, b)}
    {n("freigabe:" + b, "tabFreigabe", "Freigabe", "check", freigabeIm(b).length, b)}
    {b === "admin" && <>
      {n("benutzer", "tabBenutzer", "Benutzer", "leute")}
      {n("konten", "tabKonten", "Konten", "liste")}
      {n("geraete", "tabGeraete", "Geräte", "karte")}
      {n("kst", "tabKst", "Kostenstellen", "raute")}
    </>}
  </div>;
  return (
    <aside className="leiste">
      <div className="marke"><b>TIT-PIT</b><span>Spesen</span></div>
      <button className="k1 klein" data-akt="neu"><Ico n="plus" s={18} /> Spesen erfassen</button>
      <nav className="nav" aria-label="Hauptnavigation">
        <div className="abschnitt">
          <div className="gr">MEINE SPESEN</div>
          {n("liste", "tabListe", "Meine Belege", "doc")}
          {n("favoriten", "zuFavoriten", "Favoriten", "stern")}
        </div>
        {bereiche().map(abschnitt)}
      </nav>
      <div style={{ flex: 1 }} />
      <div className="ich">
        <div className="wer"><span className="avatar">{initialen(eigenerName())}</span>
          <span><b>{eigenerName()}</b><small>{eigeneRolle()} · {S.session.user.email}</small></span></div>
        <div className="links">
          <button data-akt="zuPasswort">Passwort</button>
          <button data-akt="abmelden">Abmelden</button>
        </div>
      </div>
    </aside>);
}

// Welcher Eintrag der Seitenleiste ist "an"? Übersicht und Freigabe je Abschnitt.
function aktivSchluessel() {
  const a = aktiv();
  return (a === "uebersicht" || a === "freigabe") ? a + ":" + S.bereich : a;
}

// ---------- Eine Seite ----------
// tab: Hauptseite (Handy mit Leiste unten). Sonst Unterseite mit Zurück.
// fuss: Knöpfe, die am Handy unten kleben (z. B. Speichern).
// voll: am Rechner ohne Rand — der Inhalt füllt die ganze Fläche (Arbeitsplatz).
export function Seite({ titel, sub, pfad, rechts, kopfRechts, tab, fuss, voll, children }:
  { titel: string; sub?: string; pfad?: string; rechts?: any; kopfRechts?: any; tab?: boolean;
    fuss?: any; voll?: boolean; children: any }) {
  if (istBreit()) return (
    <div className="rahmen">
      <Leiste />
      <main className="haupt">
        <header className="kopfleiste">
          {!tab && <button className="pf" data-akt="zurueck" aria-label="Zurück">‹</button>}
          <h1>{titel}</h1>
          {pfad && <span className="sub">{pfad}</span>}
          <span style={{ flex: 1 }} />
          {rechts && <div className="rechts">{rechts}</div>}
        </header>
        <div className={"inhalt" + (voll ? " voll" : "")}>
          {!voll && <Meldung />}
          {children}
          {fuss && <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>{fuss}</div>}
        </div>
      </main>
    </div>);

  return <>
    <Kopf titel={titel} sub={sub} zurueck={!tab} rechts={kopfRechts} />
    <main className={"seite" + (tab ? " mit-leiste" : "")}>
      <Meldung />
      {children}
    </main>
    {fuss && <div className="fussleiste">{fuss}</div>}
    {tab && <Tabbar />}
  </>;
}
