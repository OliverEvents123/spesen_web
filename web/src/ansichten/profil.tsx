// profil.tsx
// Profil (am Handy der Weg zu Passwort, Favoriten und Verwaltung),
// Passwort ändern, Favoriten verwalten, die Freigabeliste.

import { S, schluessel } from "../zustand";
import { istBreit, chf, chfLang, auftragAnzeige, kurzZeit, initialen } from "../grundlagen";
import { personName, freigabeGefiltert, darfFreigabeFiltern } from "../daten";
import { FreigabePlatz, FreigabeFilter } from "./erfassen";
import { Seite } from "./rahmen";
import {
  Ico, Knopf, Hinweis, Wahl, belegKopf, eigenerName, eigeneRolle, kontoWahlText, auftragWahlText
} from "./bausteine";

// ---------- Profil (Handy) ----------
function Eintrag({ akt, ic, titel, sub, rot }: { akt: string; ic: string; titel: string; sub?: string; rot?: boolean }) {
  return (
    <button className="wahl" data-akt={akt} style={rot ? { color: "var(--rot-text)" } : undefined}>
      <span style={{ color: rot ? "var(--rot-text)" : "var(--akzent)", display: "flex" }}><Ico n={ic} s={22} /></span>
      <span className="wert"><b>{titel}</b>{sub && <span className="kn mu">{sub}</span>}</span>
      {!rot && <span className="pfeil" aria-hidden="true">›</span>}
    </button>);
}

export function Profil() {
  return (
    <Seite titel="Profil" sub={eigeneRolle()} tab>
      <section className="karte" style={{ padding: 18, display: "flex", alignItems: "center", gap: 14 }}>
        <span className="avatar" style={{ width: 56, height: 56, fontSize: 20 }}>{initialen(eigenerName())}</span>
        <span style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
          <b style={{ fontSize: 18 }}>{eigenerName()}</b>
          <span className="kn mu" style={{ overflowWrap: "anywhere" }}>{S.session.user.email}</span>
          <span><span className="pill p-rol">{eigeneRolle()}</span></span></span>
      </section>
      {S.istAdmin && <>
        <span className="kl" style={{ marginBottom: -6 }}>Verwaltung</span>
        <section className="karte huelle">
          <Eintrag akt="tabBenutzer" ic="leute" titel="Benutzer" sub="Rollen, Prüfung, Kostenstellen" />
          <Eintrag akt="tabKonten" ic="liste" titel="Konten" sub={`${S.konten.length} Konten`} />
          <Eintrag akt="tabGeraete" ic="karte" titel="Geräte" sub={`${S.zahlgeraete.length} Geräte · je KST`} />
        </section>
      </>}
      <span className="kl" style={{ marginBottom: -6 }}>Persönlich</span>
      <section className="karte huelle">
        <Eintrag akt="zuFavoriten" ic="stern" titel="Favoriten" sub={`${S.favoriten.length} gespeichert`} />
        <Eintrag akt="zuPasswort" ic="schluessel" titel="Passwort ändern" />
      </section>
      <section className="karte huelle"><Eintrag akt="abmelden" ic="raus" titel="Abmelden" rot /></section>
    </Seite>);
}

// ---------- Passwort ----------
export function Passwort() {
  return (
    <Seite titel="Passwort ändern" sub={S.session.user.email} pfad={S.session.user.email}>
      <div style={{ display: "flex", flexDirection: "column", gap: 14, maxWidth: 480 }}>
        <section className="karte innen">
          <div className="feld"><label htmlFor="pw1">Neues Passwort</label>
            <input id="pw1" type="password" autoComplete="new-password" /></div>
          <div className="feld"><label htmlFor="pw2">Wiederholen</label>
            <input id="pw2" type="password" autoComplete="new-password" /></div>
        </section>
        <Knopf akt="pwSichern" className="k1">Passwort speichern</Knopf>
        <span className="kn mu">Mindestens sechs Zeichen. Nach dem Ändern bleibst du angemeldet.</span>
      </div>
    </Seite>);
}

// ---------- Favoriten ----------
export function Favoriten() {
  return (
    <Seite titel="Favoriten" sub={`${S.favoriten.length} gespeichert`} pfad={`${S.favoriten.length} gespeichert`}
           tab={istBreit()} rechts={<button className="k1 klein" data-akt="favNeu">+ Neuer Favorit</button>}>
      <div style={{ display: "flex", flexDirection: "column", gap: 14, maxWidth: 640 }}>
        <span className="mu" style={{ lineHeight: 1.45 }}>Ein Favorit setzt Konto und KST mit einem Tipp.
          Die ersten sechs erscheinen auf der Startseite. Der Pfeil schiebt einen nach oben.</span>
        <section className="karte huelle">
          {S.favoriten.length === 0 ? <div className="leer">Noch keine Favoriten.</div>
            : S.favoriten.map((f, i) => (
              <div className="zl" key={f.id}>
                <button className="pf" data-akt="favHoch" data-id={f.id} disabled={i === 0} aria-label="Nach oben">↑</button>
                <span className="mitte"><b>{f.name}</b>
                  <span className="kn mu">Konto <span className="mono">{f.konto_nummer}</span> · KST {auftragAnzeige(f.auftrag_nr)}</span></span>
                <button className="pf blau" data-akt="favBearbeiten" data-id={f.id} aria-label="Favorit bearbeiten"><Ico n="stift" /></button>
              </div>))}
        </section>
        {!istBreit() && <button className="k1" data-akt="favNeu">+ Neuer Favorit</button>}
        <span className="kn mu" style={{ textAlign: "center" }}>Schneller: bei einem bestehenden Beleg „Als Favorit merken“.</span>
      </div>
    </Seite>);
}

export function FavForm() {
  const f = S.favEdit;
  const fertig = f.konto && f.auftrag;
  const kt = kontoWahlText(f.konto), at = auftragWahlText(f.auftrag);
  return (
    <Seite titel={f.id ? "Favorit ändern" : "Neuer Favorit"} sub="Konto und KST festlegen" pfad="Favoriten">
      <div style={{ display: "flex", flexDirection: "column", gap: 14, maxWidth: 560 }} key={schluessel(f)}>
        <div className="feld"><label htmlFor="favname">Name</label>
          <input id="favname" type="text" data-feld="favname" defaultValue={f.name}
                 placeholder={f.konto ? f.konto.bezeichnung : "z. B. Verpflegung Event"} /></div>
        <section className="karte huelle">
          <Wahl akt="kontoWahl" titel="Konto" offen={!f.konto} haupt={kt.haupt} neben={kt.neben} />
          <Wahl akt="auftragWahl" titel="KST" offen={!f.auftrag} haupt={at.haupt} neben={at.neben} />
        </section>
        <Knopf akt="favSichern" className="k1" disabled={!fertig}>
          {fertig ? "Favorit speichern" : "Konto und KST nötig"}</Knopf>
        {f.id && <button className="kr" data-akt="favWeg">Favorit löschen</button>}
      </div>
    </Seite>);
}

// ---------- Freigabe: was ich entscheiden muss ----------
function FreigabeZeile({ b, an }: { b: any; an?: boolean }) {
  return (
    <button className={"zl" + (an ? " an" : "")} data-akt="bearbeiten" data-id={b.id} data-w="freigabe">
      <span className="ini">{initialen(personName(b.geraet))}</span>
      <span className="mitte"><b>{belegKopf(b)}</b>
        <span className="kn mu">{personName(b.geraet)} · Konto {b.konto_nummer} · eingereicht {kurzZeit(b.eingereicht_am)}</span>
        {b.kommentar && <span className="kn kommentar">„{b.kommentar}“</span>}</span>
      <span className="seite"><span className="betragz">{chfLang(b.betrag)}</span>
        {!an && !istBreit() && <span className="kn fett" style={{ color: "var(--akzent)" }}>prüfen ›</span>}</span>
    </button>);
}

export function Freigabe() {
  // Am Handy: alles, was auf mich wartet (ohne Abschnitt), gefiltert
  const liste = freigabeGefiltert("");
  const vk = liste.filter((b) => b.zahlart === "vorkasse");
  const kb = liste.filter((b) => b.zahlart !== "vorkasse");
  const offenId = S.neu && S.neu.id;
  const gruppe = (titel: string, l: any[]) => l.length > 0 && <>
    <span className="kl" style={{ marginBottom: -6 }}>{titel}</span>
    <section className="karte huelle">{l.map((b) => <FreigabeZeile b={b} key={b.id} an={istBreit() && b.id === offenId} />)}</section>
  </>;
  const filter = darfFreigabeFiltern() && S.freigabe.length > 1 &&
    <div className="karte innen"><FreigabeFilter /></div>;
  const listeTeil = liste.length === 0
    ? <>{filter}<div className="karte leer">{S.freigabe.length ? "Nichts für diesen Filter." : "Nichts zu prüfen."}</div></>
    : <>
        {filter}
        {gruppe("User-Zahlungen · Rückerstattung", vk)}
        {gruppe("Kreditkarte / Bar · nur prüfen", kb)}
        <Hinweis>Du siehst hier die Belege deiner Kostenstellen und Konten.</Hinweis>
      </>;
  const sub = liste.length === 1 ? "1 Freigabe offen" : `${liste.length} Freigaben offen`;

  // Am Rechner: Arbeitsplatz mit Liste, Beleg und Entscheid
  if (istBreit()) return <FreigabePlatz />;

  return <Seite titel="Freigabe" sub={sub} tab>{listeTeil}</Seite>;
}
