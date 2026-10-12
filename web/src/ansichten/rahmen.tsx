// rahmen.tsx
// Der Rahmen um jede Seite: am Handy dunkler Kopf und unten die Leiste mit
// dem Kamera-Knopf, am Rechner die dunkle Seitenleiste links.

import { S } from "../zustand";
import { istBreit, initialen } from "../grundlagen";
import { Ico, Meldung, eigenerName, eigeneRolle } from "./bausteine";

// Welche Hauptseite ist gerade "an"? Unterseiten zählen zu ihrer Hauptseite.
function aktiv() {
  const a = S.ansicht;
  if (a === "erfassen" || a === "kontoWahl" || a === "auftragWahl") return S.zurueckZu;
  if (a === "favForm") return "favoriten";
  if (a === "benForm") return "benutzer";
  if (a === "kontoForm") return "konten";
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
      {t("uebersicht", "tabUebersicht", "Übersicht", "grid")}
      <div className="tabmitte"><button data-akt="neu" aria-label="Beleg erfassen"><Ico n="kamera" /></button></div>
      {S.istPruefer && t("freigabe", "tabFreigabe", "Freigabe", "check", S.freigabe.length)}
      {t("profil", "zuProfil", "Profil", "person")}
    </nav>);
}

// ---------- Rechner ----------
function Leiste() {
  const an = aktiv();
  const n = (k: string, akt: string, lab: string, ic: string, zahl?: number) => (
    <button className={an === k ? "an" : ""} data-akt={akt} aria-current={an === k ? "page" : undefined}>
      <Ico n={ic} />{lab}{zahl ? <span className="zahl">{zahl}</span> : null}</button>);
  return (
    <aside className="leiste">
      <div className="marke"><span className="zeichen">TP</span><b>TIT-PIT Spesen</b></div>
      <button className="k1" data-akt="neu" style={{ boxShadow: "none" }}>+ Spesen erfassen</button>
      <nav className="nav" aria-label="Hauptnavigation">
        {n("uebersicht", "tabUebersicht", "Übersicht", "grid")}
        {n("liste", "tabListe", "Meine Belege", "doc")}
        {S.istPruefer && n("freigabe", "tabFreigabe", "Freigabe", "check", S.freigabe.length)}
        {n("favoriten", "zuFavoriten", "Favoriten", "stern")}
        {S.istAdmin && <>
          <div className="gr">VERWALTUNG</div>
          {n("benutzer", "tabBenutzer", "Benutzer", "leute")}
          {n("konten", "tabKonten", "Konten", "liste")}
        </>}
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

// ---------- Eine Seite ----------
// tab: Hauptseite (Handy mit Leiste unten). Sonst Unterseite mit Zurück.
// fuss: Knöpfe, die am Handy unten kleben (z. B. Speichern).
export function Seite({ titel, sub, pfad, rechts, kopfRechts, tab, fuss, children }:
  { titel: string; sub?: string; pfad?: string; rechts?: any; kopfRechts?: any; tab?: boolean;
    fuss?: any; children: any }) {
  if (istBreit()) return (
    <div className="rahmen">
      <Leiste />
      <main className="haupt">
        <div className="titelzeile">
          <div className="links">
            {!tab && <button className="pf" data-akt="zurueck" aria-label="Zurück"
                             style={{ background: "#fff", boxShadow: "var(--schatten)" }}>‹</button>}
            <div><div className="pfad">{pfad || "Spesen"}</div><h1>{titel}</h1></div>
          </div>
          {rechts && <div className="rechts">{rechts}</div>}
        </div>
        <Meldung />
        {children}
        {fuss && <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>{fuss}</div>}
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
