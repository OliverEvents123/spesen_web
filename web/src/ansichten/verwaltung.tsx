// verwaltung.tsx
// Nur Admin: Benutzer (mit Rolle, Prüfung und den zugewiesenen KST bzw.
// Konten — früher eine eigene Seite "Zuweisungen") und Konten.

import { S, schluessel } from "../zustand";
import { istBreit, kurzZeit, kurzName, rolleName, istGeschuetzt, initialen, ROLLEN, SAETZE, OHNE_KST } from "../grundlagen";
import { kontoName, aktiveKonten, belegeVon, postenAufKonto, leeresKonto, personName } from "../daten";
import { Seite } from "./rahmen";
import { Ico, Knopf, Hinweis, kstName } from "./bausteine";

const istGesperrt = (b) => b.gesperrt || !b.aktiv;

// Am Handy: Umschalter zwischen Benutzer und Konten
const Umschalter = () => istBreit() ? null : (
  <div className="seg">
    <button className={S.ansicht === "benutzer" ? "an" : ""} data-akt="tabBenutzer">Benutzer</button>
    <button className={S.ansicht === "konten" ? "an" : ""} data-akt="tabKonten">Konten</button>
  </div>);

/* ==========================================================
   Benutzer
   ========================================================== */

// Was prüft diese Person? "KST 2601, 2602" / "Konten 6200"
function prueftText(email: string) {
  const kst = S.zuweisungen.filter((z) => z.email === email).map((z) => z.auftrag_nr === OHNE_KST.id ? "ohne KST" : z.auftrag_nr);
  const kon = S.zuweisungenKonto.filter((z) => z.email === email).map((z) => z.konto_nummer);
  const per = S.zuweisungenPerson.filter((z) => z.email === email).map((z) => personName(z.person));
  const teile = [];
  if (kst.length) teile.push("KST " + kst.join(", "));
  if (kon.length) teile.push("Konten " + kon.join(", "));
  if (per.length) teile.push("User-Zahlungen von " + per.join(", "));
  return teile.join(" · ");
}

const Chip = ({ text, akt, email, wert }) => (
  <span className="chip">{text}
    <button data-akt={akt} data-e={email} data-v={wert} aria-label={`${text} entfernen`}>✕</button></span>);

// Zuweisungen direkt beim Benutzer: KST (Projektleiter) bzw. Konten (Supervisor)
// Zuweisungen direkt beim Benutzer: KST (Projektleiter), Konten (Supervisor)
// und Personen, deren User-Zahlungen der Supervisor genehmigt.
function Zuweisung({ b, art }: { b: any; art: "kst" | "konto" | "person" }) {
  const feld = `zw-${art}-${b.email.replace(/[^a-z0-9]/gi, "_")}`;
  let titel, chips, eingabe, neu;
  if (art === "kst") {
    titel = "Prüft diese Kostenstellen"; neu = "zuwNeu";
    chips = S.zuweisungen.filter((z) => z.email === b.email).map((z) =>
      <Chip key={z.auftrag_nr} text={kstName(z.auftrag_nr)} akt="zuwWeg" email={b.email} wert={z.auftrag_nr} />);
    eingabe = <input id={feld} list="kstliste" placeholder="KST-Nummer" aria-label="KST-Nummer" style={{ flex: 1, minHeight: 42 }} />;
  } else if (art === "konto") {
    titel = "Prüft diese Konten"; neu = "zuwKontoNeu";
    chips = S.zuweisungenKonto.filter((z) => z.email === b.email).map((z) =>
      <Chip key={z.konto_nummer} text={z.konto_nummer + " " + kontoName(z.konto_nummer)}
            akt="zuwKontoWeg" email={b.email} wert={z.konto_nummer} />);
    eingabe = <select id={feld} defaultValue="" aria-label="Konto" style={{ flex: 1, minHeight: 42 }}>
      <option value="">Konto wählen</option>
      {aktiveKonten().map((k) => <option key={k.nummer} value={k.nummer}>{k.nummer} {k.bezeichnung}</option>)}
    </select>;
  } else {
    titel = "Genehmigt die User-Zahlungen dieser Personen"; neu = "zuwPersonNeu";
    const schon = S.zuweisungenPerson.filter((z) => z.email === b.email);
    chips = schon.map((z) =>
      <Chip key={z.person} text={personName(z.person)} akt="zuwPersonWeg" email={b.email} wert={z.person} />);
    eingabe = <select id={feld} defaultValue="" aria-label="Person" style={{ flex: 1, minHeight: 42 }}>
      <option value="">Person wählen</option>
      {S.benutzer.filter((x) => x.email !== b.email && !schon.some((z) => z.person === x.email))
        .map((x) => <option key={x.email} value={x.email}>{x.name || kurzName(x.email)}</option>)}
    </select>;
  }
  return (
    <div className="teilbox">
      <b style={{ fontSize: 14 }}>{titel}</b>
      <div className="chips">
        {chips.length ? chips : <span className="kn mu">noch niemand bzw. nichts zugewiesen</span>}
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        {eingabe}
        <button className="k2 klein" data-akt={neu} data-e={b.email} data-f={feld}>Hinzufügen</button>
      </div>
      {art === "person" &&
        <span className="kn mu">Deren User-Zahlungen warten dann auf diesen Supervisor (oder einen Admin).</span>}
    </div>);
}

function BenForm() {
  const b = S.benEdit || { neu: true, email: "", name: "", rolle: "user", gesperrt: false };
  const fest = !b.neu && istGeschuetzt(b.email);   // Notfall-Administrator
  const hatKst = S.zuweisungen.some((z) => z.email === b.email);
  const hatKonto = S.zuweisungenKonto.some((z) => z.email === b.email);
  const hatPerson = S.zuweisungenPerson.some((z) => z.email === b.email);
  return (
    <div className="karte innen" key={schluessel(S.benEdit)}>
      <b style={{ fontSize: 17 }}>{b.neu ? "Neuer Benutzer" : (b.name || kurzName(b.email))}</b>

      {b.neu
        ? <div className="feld"><label htmlFor="bmail">E-Mail</label>
            <input id="bmail" type="email" inputMode="email" defaultValue={b.email} data-feld="bmail"
                   placeholder="handy3@tit-pit.ch" /></div>
        : <span className="kn mu" style={{ marginTop: -6 }}>{b.email} — bleibt fest, die Belege hängen daran.</span>}

      <div className="feld"><label htmlFor="bname">Name</label>
        <input id="bname" type="text" defaultValue={b.name} placeholder="Eventhandy 3" data-feld="bname" /></div>

      <div><span className="lab">Rolle</span>
        <div className="seg gitter">
          {Object.entries(ROLLEN).map(([w, [name]]) =>
            <button key={w} className={b.rolle === w ? "an" : ""} data-akt="benRolle" data-v={w}
                    disabled={fest} aria-pressed={b.rolle === w}>{name}</button>)}
        </div>
        <p className="kn mu" style={{ margin: "8px 0 0", lineHeight: 1.45 }}>
          {fest ? "Notfall-Administrator. Rolle und Sperre sind festgelegt, damit immer ein Weg in die Verwaltung offen bleibt."
                : (ROLLEN[b.rolle] || ROLLEN.user)[1]}</p></div>

      {!b.neu && (b.rolle === "projektleiter" || hatKst) && <Zuweisung b={b} art="kst" />}
      {!b.neu && (b.rolle === "supervisor" || hatKonto) && <Zuweisung b={b} art="konto" />}
      {!b.neu && (b.rolle === "supervisor" || hatPerson) && <Zuweisung b={b} art="person" />}
      {b.neu && (b.rolle === "projektleiter" || b.rolle === "supervisor") &&
        <span className="kn mu">Kostenstellen, Konten bzw. Personen nach dem Anlegen hier zuweisen.</span>}

      <div className="schalterzeile">
        <label htmlFor="bpruefung"><b>Prüfung einrichten</b>
          <span className="mu">Belege ohne zuständigen Projektleiter gehen nicht automatisch durch,
            sondern warten auf einen Admin oder Supervisor.</span></label>
        <input id="bpruefung" type="checkbox" className="schalter" defaultChecked={!!b.pruefung} data-feld="bpruefung" />
      </div>

      <div className="feld"><label htmlFor="bpw">{b.neu ? "Passwort" : "Neues Passwort"}</label>
        <input id="bpw" type="text" autoComplete="off" placeholder={b.neu ? "mindestens 6 Zeichen" : "leer lassen = unverändert"} />
        <span className="kn mu" style={{ paddingTop: 6 }}>Im Klartext sichtbar, damit du es weitergeben kannst.</span></div>

      <Knopf akt="benSichern" className="k1">{b.neu ? "Benutzer anlegen" : "Änderungen speichern"}</Knopf>
      {!b.neu && !fest &&
        <Knopf akt="benSperren" className="k2">{b.gesperrt ? "Wieder freischalten" : "Anmeldung sperren"}</Knopf>}
      {!b.neu && <button className="link" data-akt="benNeu" style={{ alignSelf: "center" }}>Stattdessen neuen anlegen</button>}
    </div>);
}

function BenListe() {
  if (S.benutzer.length === 0) return <div className="karte leer">Keine Benutzer geladen.</div>;
  const offen = S.benEdit && S.benEdit.email;
  if (istBreit()) return (
    <div className="karte"><div className="tabelle"><table>
      <thead><tr><th>Name</th><th>Rolle</th><th>Prüft</th><th>Zuletzt</th><th className="re">Belege</th><th></th></tr></thead>
      <tbody>
        {S.benutzer.map((b) => (
          <tr key={b.email} className={offen === b.email ? "an" : ""}>
            <td><span style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <span className={"ini" + (istGesperrt(b) ? " aus" : "")} style={{ width: 34, height: 34 }}>{initialen(b.name || b.email)}</span>
              <span style={{ display: "flex", flexDirection: "column", whiteSpace: "nowrap" }}><b>{b.name || kurzName(b.email)}</b>
                <span className="kn mu">{b.email}</span></span></span></td>
            <td>{istGesperrt(b) ? <span className="pill p-abl">gesperrt</span> : <span className="pill p-rol">{rolleName(b.rolle)}</span>}</td>
            <td className="kn" style={{ color: "var(--akzent-text)" }}>{prueftText(b.email) || (b.pruefung ? "" : <span className="mu">—</span>)}
              {b.pruefung && <><br /><span className="mu">Prüfung eingerichtet</span></>}</td>
            <td className="kn mu nw">{b.angemeldet ? kurzZeit(b.angemeldet) : "nie"}</td>
            <td className="re mono">{belegeVon(b.email)}</td>
            <td className="re"><button className="tknopf" data-akt="benBearbeiten" data-e={b.email}>Ändern</button></td>
          </tr>))}
      </tbody>
    </table></div></div>);

  return (
    <section className="karte huelle">
      {S.benutzer.map((b) => {
        const pr = prueftText(b.email);
        return (
          <div className="zl" key={b.email}>
            <span className={"ini" + (istGesperrt(b) ? " aus" : "")}>{initialen(b.name || b.email)}</span>
            <span className="mitte"><b>{b.name || kurzName(b.email)}</b>
              <span className="kn mu">{b.email}</span>
              {(pr || b.pruefung) && <span className="kn" style={{ color: "var(--akzent-text)" }}>
                {[pr, b.pruefung ? "Prüfung eingerichtet" : ""].filter(Boolean).join(" · ")}</span>}</span>
            {istGesperrt(b) ? <span className="pill p-abl">gesperrt</span> : <span className="pill p-rol">{rolleName(b.rolle)}</span>}
            <button className="pf blau" data-akt="benBearbeiten" data-e={b.email} aria-label="Benutzer bearbeiten"><Ico n="stift" /></button>
          </div>);
      })}
    </section>);
}

const BenHinweis = () => (
  <div className="karte"><Hinweis>Gesperrte Benutzer können sich nicht anmelden. Ihre Belege bleiben vollständig
    erhalten und erscheinen weiter in der Übersicht und in den Exporten. Sperren ist deshalb immer besser als löschen.</Hinweis></div>);

const KstListe = () => (
  <datalist id="kstliste">
    <option value={OHNE_KST.id}>{OHNE_KST.name}</option>
    {S.auftraege.map((a) => <option key={a.id} value={a.id}>{a.name || ""}</option>)}
  </datalist>);

function adminSub() {
  const admins = S.benutzer.filter((b) => b.rolle === "admin").length;
  return `${S.benutzer.length} Benutzer · ${admins} ${admins === 1 ? "Administrator" : "Administratoren"}`;
}

export function Benutzer() {
  if (istBreit()) return (
    <Seite titel="Benutzer" pfad={"Verwaltung / Benutzer · " + adminSub()} tab
           rechts={<button className="k1 klein" data-akt="benNeu">+ Neuer Benutzer</button>}>
      <KstListe />
      <div className="spalten">
        <div className="spalte"><BenListe /><BenHinweis /></div>
        <BenForm />
      </div>
    </Seite>);

  if (S.ansicht === "benForm") {
    const b = S.benEdit;
    return (
      <Seite titel={b.neu ? "Neuer Benutzer" : "Benutzer ändern"} sub={b.neu ? "Konto anlegen" : b.email}>
        <KstListe /><BenForm />
      </Seite>);
  }

  return (
    <Seite titel="Verwaltung" sub={adminSub()}>
      <Umschalter />
      <button className="k1" data-akt="benNeu">+ Neuer Benutzer</button>
      <BenListe />
      <BenHinweis />
    </Seite>);
}

/* ==========================================================
   Konten
   ========================================================== */

function KontoForm() {
  const k = S.kontEdit;
  return (
    <div className="karte innen" key={schluessel(k)}>
      <b style={{ fontSize: 17 }}>{k.neu ? "Neues Konto" : <><span className="mono">{k.nummer}</span> {k.bezeichnung}</>}</b>
      {k.neu
        ? <div className="feld"><label htmlFor="knummer">Nummer</label>
            <input id="knummer" type="text" inputMode="numeric" defaultValue={k.nummer} placeholder="4590" data-feld="knummer" /></div>
        : <span className="kn mu" style={{ marginTop: -6 }}>Nummer bleibt fest, weil die Belege daran hängen.</span>}
      <div className="feld"><label htmlFor="kbez">Bezeichnung</label>
        <input id="kbez" type="text" defaultValue={k.bezeichnung} placeholder="Übernachtungen" data-feld="kbez" /></div>
      <div><span className="lab">MwSt-Standard</span>
        <div className="seg">
          {SAETZE.map((m) =>
            <button key={m} className={"mono" + (String(k.mwst) === m ? " an" : "")} data-akt="kontoMwst" data-v={m}
                    aria-pressed={String(k.mwst) === m}>{m} %</button>)}
        </div>
        <p className="kn mu" style={{ margin: "8px 0 0" }}>Wird beim neuen Beleg vorbelegt und lässt sich dort ändern.</p></div>
      <div className="schalterzeile" style={{ alignItems: "center" }}>
        <label htmlFor="kaktiv"><b>Steht in der Auswahl</b></label>
        <input id="kaktiv" type="checkbox" className="schalter" defaultChecked={!!k.aktiv} data-feld="kaktiv" />
      </div>
      <Knopf akt="kontoSichern" className="k1">{k.neu ? "Konto anlegen" : "Änderungen speichern"}</Knopf>
      {!k.neu && <button className="link" data-akt="kontoNeu" style={{ alignSelf: "center" }}>Stattdessen neues anlegen</button>}
    </div>);
}

function KontenListe() {
  if (S.konten.length === 0) return <div className="karte leer">Noch keine Konten angelegt.</div>;
  const offen = S.kontEdit && !S.kontEdit.neu && S.kontEdit.nummer;
  const hoch = (k, i) => <button className="pf" data-akt="kontoHoch" data-nr={k.nummer} disabled={i === 0}
                                 aria-label={`${k.nummer} nach oben`} style={{ width: 34, height: 34, fontSize: 16 }}>↑</button>;
  if (istBreit()) return (
    <div className="karte"><div className="tabelle"><table>
      <thead><tr><th style={{ width: 50 }}></th><th>Nummer</th><th>Bezeichnung</th><th>MwSt-Standard</th><th>Status</th>
        <th className="re">Posten im Zeitraum</th><th></th></tr></thead>
      <tbody>
        {S.konten.map((k, i) => (
          <tr key={k.nummer} className={offen === k.nummer ? "an" : ""}>
            <td>{hoch(k, i)}</td>
            <td className="mono fett">{k.nummer}</td><td>{k.bezeichnung}</td>
            <td className="mono">{k.mwst} %</td>
            <td>{k.aktiv === false ? <span className="pill p-erf">inaktiv</span> : <span className="kn mu">aktiv</span>}</td>
            <td className="re mono">{postenAufKonto(k.nummer)}</td>
            <td className="re"><button className="tknopf" data-akt="kontoBearbeiten" data-nr={k.nummer}>Ändern</button></td>
          </tr>))}
      </tbody>
    </table></div></div>);

  return (
    <section className="karte huelle">
      {S.konten.map((k, i) => (
        <div className="zl" key={k.nummer}>
          {hoch(k, i)}
          <span className="mono fett" style={{ width: 44 }}>{k.nummer}</span>
          <span className="mitte"><b style={k.aktiv === false ? { color: "#8a90a6" } : undefined}>{k.bezeichnung}</b>
            <span className="kn mu">MwSt {k.mwst} %</span></span>
          {k.aktiv === false && <span className="pill p-erf">inaktiv</span>}
          <button className="pf blau" data-akt="kontoBearbeiten" data-nr={k.nummer} aria-label="Konto bearbeiten"><Ico n="stift" /></button>
        </div>))}
    </section>);
}

const KontoHinweis = () => (
  <div className="karte"><Hinweis>Der Pfeil schiebt ein Konto in der Auswahl nach oben. Inaktiv nimmt ein Konto aus
    der Auswahl, lässt es aber in alten Belegen und Exporten stehen. Löschen gibt es bewusst nicht — die Belege
    hängen an der Nummer.</Hinweis></div>);

export function Konten() {
  // Am Rechner steht das Formular immer da — also eines bereitlegen.
  if (!S.kontEdit && (istBreit() || S.ansicht === "kontoForm")) S.kontEdit = leeresKonto();

  if (istBreit()) return (
    <Seite titel="Konten" pfad={`Verwaltung / Konten · ${S.konten.length} Konten`} tab
           rechts={<button className="k1 klein" data-akt="kontoNeu">+ Neues Konto</button>}>
      <div className="spalten">
        <div className="spalte"><KontenListe /><KontoHinweis /></div>
        <KontoForm />
      </div>
    </Seite>);

  if (S.ansicht === "kontoForm") {
    const k = S.kontEdit;
    return (
      <Seite titel={k.neu ? "Neues Konto" : "Konto ändern"}
             sub={k.neu ? "Nummer und Bezeichnung festlegen" : k.nummer + "  " + k.bezeichnung}>
        <KontoForm />
      </Seite>);
  }

  return (
    <Seite titel="Verwaltung" sub={`${S.konten.length} Konten`}>
      <Umschalter />
      <button className="k1" data-akt="kontoNeu">+ Neues Konto</button>
      <KontenListe />
      <KontoHinweis />
    </Seite>);
}
