// verwaltung.tsx
// Nur Admin: Benutzer (mit Rolle, Prüfung und den zugewiesenen KST bzw.
// Konten — früher eine eigene Seite "Zuweisungen"), Konten, Geräte und
// Kostenstellen (welche Jahre und KST in der Auswahl erscheinen).

import { S, schluessel } from "../zustand";
import { istBreit, kurzZeit, kurzName, rolleName, istGeschuetzt, initialen, ROLLEN, SAETZE, OHNE_KST } from "../grundlagen";
import { kontoName, aktiveKonten, belegeVon, postenAufKonto, leeresKonto, personName, leeresGeraet, belegeAufGeraet } from "../daten";
import { Seite } from "./rahmen";
import { Ico, Knopf, Hinweis, kstName } from "./bausteine";

const istGesperrt = (b) => b.gesperrt || !b.aktiv;

// Am Handy: Umschalter zwischen Benutzer, Konten und Geräten
const Umschalter = () => istBreit() ? null : (
  <div className="seg">
    <button className={S.ansicht === "benutzer" ? "an" : ""} data-akt="tabBenutzer">Benutzer</button>
    <button className={S.ansicht === "konten" ? "an" : ""} data-akt="tabKonten">Konten</button>
    <button className={S.ansicht === "geraete" ? "an" : ""} data-akt="tabGeraete">Geräte</button>
    <button className={S.ansicht === "kst" ? "an" : ""} data-akt="tabKst">KST</button>
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
// Beim neuen Benutzer sind es Vormerkungen (b.vor), gespeichert mit "Benutzer anlegen".
function Zuweisung({ b, art }: { b: any; art: "kst" | "konto" | "person" }) {
  const feld = `zw-${art}-${b.neu ? "neu" : b.email.replace(/[^a-z0-9]/gi, "_")}`;
  const vor = b.neu ? ((b.vor || {})[art] || []) : null;
  let titel, chips, eingabe, neu;
  if (art === "kst") {
    titel = "Prüft diese Kostenstellen"; neu = "zuwNeu";
    chips = (vor ? vor.map((x) => ({ email: b.email, auftrag_nr: x }))
                 : S.zuweisungen.filter((z) => z.email === b.email)).map((z) =>
      <Chip key={z.auftrag_nr} text={kstName(z.auftrag_nr)} akt="zuwWeg" email={b.email} wert={z.auftrag_nr} />);
    eingabe = <input id={feld} list="kstliste" placeholder="KST-Nummer" aria-label="KST-Nummer" style={{ flex: 1, minHeight: 42 }} />;
  } else if (art === "konto") {
    titel = "Prüft diese Konten"; neu = "zuwKontoNeu";
    chips = (vor ? vor.map((x) => ({ email: b.email, konto_nummer: x }))
                 : S.zuweisungenKonto.filter((z) => z.email === b.email)).map((z) =>
      <Chip key={z.konto_nummer} text={z.konto_nummer + " " + kontoName(z.konto_nummer)}
            akt="zuwKontoWeg" email={b.email} wert={z.konto_nummer} />);
    eingabe = <select id={feld} defaultValue="" aria-label="Konto" style={{ flex: 1, minHeight: 42 }}>
      <option value="">Konto wählen</option>
      {aktiveKonten().map((k) => <option key={k.nummer} value={k.nummer}>{k.nummer} {k.bezeichnung}</option>)}
    </select>;
  } else {
    titel = "Genehmigt die User-Zahlungen dieser Personen"; neu = "zuwPersonNeu";
    const schon = vor ? vor.map((x) => ({ email: b.email, person: x }))
                      : S.zuweisungenPerson.filter((z) => z.email === b.email);
    chips = schon.map((z) =>
      <Chip key={z.person} text={personName(z.person)} akt="zuwPersonWeg" email={b.email} wert={z.person} />);
    eingabe = <select id={feld} defaultValue="" aria-label="Person" style={{ flex: 1, minHeight: 42 }}>
      <option value="">Person wählen</option>
      {S.benutzer.filter((x) => x.email !== b.email && !istGesperrt(x) && !schon.some((z) => z.person === x.email))
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
      {b.neu && chips.length > 0 &&
        <span className="kn mu">Vorgemerkt — wird mit „Benutzer anlegen“ gespeichert.</span>}
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

      {(b.rolle === "projektleiter" || hatKst) && <Zuweisung b={b} art="kst" />}
      {(b.rolle === "supervisor" || hatKonto) && <Zuweisung b={b} art="konto" />}
      {(b.rolle === "supervisor" || hatPerson) && <Zuweisung b={b} art="person" />}

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

// Zwei Listen: oben alle aktiven Benutzer (alle Rollen), darunter die
// gesperrten — die können sich nicht anmelden, ihre Belege bleiben erhalten.
function BenTabelle({ liste }: { liste: any[] }) {
  const offen = S.benEdit && S.benEdit.email;
  return (
    <div className="tabelle"><table>
      <thead><tr><th>Name</th><th>Rolle</th><th>Prüft</th><th>Zuletzt</th><th className="re">Belege</th><th></th></tr></thead>
      <tbody>
        {liste.map((b) => (
          <tr key={b.email} className={"klickbar" + (offen === b.email ? " an" : "")} data-akt="benBearbeiten" data-e={b.email}>
            <td><span style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <span className={"ini" + (istGesperrt(b) ? " aus" : "")} style={{ width: 34, height: 34 }}>{initialen(b.name || b.email)}</span>
              <span style={{ display: "flex", flexDirection: "column", whiteSpace: "nowrap" }}><b>{b.name || kurzName(b.email)}</b>
                <span className="kn mu">{b.email}</span></span></span></td>
            <td>{istGesperrt(b) ? <span className="pill p-abl">gesperrt</span> : <span className="pill p-rol">{rolleName(b.rolle)}</span>}</td>
            <td className="kn" style={{ color: "var(--akzent-text)" }}>{prueftText(b.email) || (b.pruefung ? "" : <span className="mu">—</span>)}
              {b.pruefung && <><br /><span className="mu">Prüfung eingerichtet</span></>}</td>
            <td className="kn mu nw">{b.angemeldet ? kurzZeit(b.angemeldet) : "nie"}</td>
            <td className="re mono">{belegeVon(b.email)}</td>
            <td className="re"><span className="tknopf">Ändern</span></td>
          </tr>))}
      </tbody>
    </table></div>);
}

function BenZeilen({ liste }: { liste: any[] }) {
  return <>{liste.map((b) => {
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
  })}</>;
}

function BenListe() {
  if (S.benutzer.length === 0) return <div className="karte leer">Keine Benutzer geladen.</div>;
  const aktive = S.benutzer.filter((b) => !istGesperrt(b));
  const gesperrte = S.benutzer.filter(istGesperrt);
  const breit = istBreit();
  const kopf = (titel: string, sub: string) => (
    <div className="kartenkopf"><span><h2>{titel}</h2><span className="sub">{sub}</span></span></div>);
  return <>
    <section className={"karte" + (breit ? "" : " huelle")}>
      {kopf("Aktive Benutzer", aktive.length === 1 ? "1 Benutzer" : `${aktive.length} Benutzer`)}
      {aktive.length === 0 ? <div className="leer">Keine aktiven Benutzer.</div>
        : breit ? <BenTabelle liste={aktive} /> : <BenZeilen liste={aktive} />}
    </section>
    {gesperrte.length > 0 &&
      <section className={"karte gesperrteliste" + (breit ? "" : " huelle")}>
        {kopf("Gesperrt / deaktiviert", "können sich nicht anmelden · Belege bleiben erhalten")}
        {breit ? <BenTabelle liste={gesperrte} /> : <BenZeilen liste={gesperrte} />}
      </section>}
  </>;
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
  const aktiv = S.benutzer.filter((b) => !istGesperrt(b));
  const admins = aktiv.filter((b) => b.rolle === "admin").length;
  const gesperrt = S.benutzer.length - aktiv.length;
  return `${aktiv.length} aktiv · ${admins} ${admins === 1 ? "Administrator" : "Administratoren"}`
       + (gesperrt ? ` · ${gesperrt} gesperrt` : "");
}

export function Benutzer() {
  if (istBreit()) return (
    <Seite titel="Benutzer" pfad={adminSub()} tab
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

// "ohne KST" — für die Kontenliste
const ohneKstText = (k: any) => k.auftrag_modus === "ohne" ? "ohne KST" : "";

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
      <div className="schalterzeile">
        <label htmlFor="kohnekst"><b>Konto ohne KST</b>
          <span className="mu">Erfasst wird normal mit KST — sie bestimmt, welche Karte zur Wahl steht. Gebucht
            wird aber auf „ohne KST“: in Übersicht, Freigabe und Export unter dem Konto, nicht unter der
            Kostenstelle (z. B. Benzin mit der Karte eines Projekts).</span></label>
        <input id="kohnekst" type="checkbox" className="schalter" defaultChecked={!!k.ohneKst} data-feld="kohnekst" />
      </div>
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
            <td className="mono fett">{k.nummer}</td>
            <td>{k.bezeichnung}{ohneKstText(k) && <><br /><span className="kn" style={{ color: "var(--akzent-text)" }}>{ohneKstText(k)}</span></>}</td>
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
            <span className="kn mu">MwSt {k.mwst} %{ohneKstText(k) && " · " + ohneKstText(k)}</span></span>
          {k.aktiv === false && <span className="pill p-erf">inaktiv</span>}
          <button className="pf blau" data-akt="kontoBearbeiten" data-nr={k.nummer} aria-label="Konto bearbeiten"><Ico n="stift" /></button>
        </div>))}
    </section>);
}

const KontoHinweis = () => (
  <div className="karte"><Hinweis>Der Pfeil schiebt ein Konto in der Auswahl nach oben. Inaktiv nimmt ein Konto aus
    der Auswahl, lässt es aber in alten Belegen und Exporten stehen. Löschen gibt es bewusst nicht — die Belege
    hängen an der Nummer. Ein Konto ohne KST bucht immer auf „ohne KST“; die KST beim Erfassen bestimmt dort
    nur die Karte.</Hinweis></div>);

export function Konten() {
  // Am Rechner steht das Formular immer da — also eines bereitlegen.
  if (!S.kontEdit && (istBreit() || S.ansicht === "kontoForm")) S.kontEdit = leeresKonto();

  if (istBreit()) return (
    <Seite titel="Konten" pfad={`${S.konten.length} Konten`} tab
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

/* ==========================================================
   Geräte
   ========================================================== */

function GeraetForm() {
  const g = S.geraetEdit;
  return (
    <div className="karte innen" key={schluessel(g)}>
      <b style={{ fontSize: 17 }}>{g.neu ? "Neues Gerät" : g.name}</b>
      <div className="feld"><label htmlFor="gname">Name</label>
        <input id="gname" type="text" defaultValue={g.name} placeholder="Kreditkarte Gurtenfestival" data-feld="gname" /></div>
      <div className="feld"><label htmlFor="gkst">KST</label>
        <input id="gkst" list="kstliste" defaultValue={g.auftrag_nr} placeholder="KST-Nummer" data-feld="gkst" />
        <span className="kn mu" style={{ paddingTop: 6 }}>Wer mit Kreditkarte auf diese KST bucht, wählt das Gerät aus.
          Gibt es auf der KST nur eines, ist es vorgewählt.</span></div>
      <div className="schalterzeile" style={{ alignItems: "center" }}>
        <label htmlFor="gaktiv"><b>Steht in der Auswahl</b></label>
        <input id="gaktiv" type="checkbox" className="schalter" defaultChecked={!!g.aktiv} data-feld="gaktiv" />
      </div>
      <Knopf akt="geraetSichern" className="k1">{g.neu ? "Gerät anlegen" : "Änderungen speichern"}</Knopf>
      {!g.neu && <Knopf akt="geraetWeg" className="kr">Gerät löschen</Knopf>}
      {!g.neu && <button className="link" data-akt="geraetNeu" style={{ alignSelf: "center" }}>Stattdessen neues anlegen</button>}
    </div>);
}

function GeraeteListe() {
  if (S.zahlgeraete.length === 0) return <div className="karte leer">Noch keine Geräte angelegt.</div>;
  const offen = S.geraetEdit && !S.geraetEdit.neu && S.geraetEdit.id;
  const status = (g) => g.aktiv === false ? <span className="pill p-erf">inaktiv</span> : null;
  if (istBreit()) return (
    <div className="karte"><div className="tabelle"><table>
      <thead><tr><th>Name</th><th>KST</th><th>Status</th><th className="re">Belege im Zeitraum</th><th></th></tr></thead>
      <tbody>
        {S.zahlgeraete.map((g) => (
          <tr key={g.id} className={offen === g.id ? "an" : ""}>
            <td className="fett">{g.name}</td>
            <td>{kstName(g.auftrag_nr)}</td>
            <td>{status(g) || <span className="kn mu">aktiv</span>}</td>
            <td className="re mono">{belegeAufGeraet(g.id)}</td>
            <td className="re"><button className="tknopf" data-akt="geraetBearbeiten" data-id={g.id}>Ändern</button></td>
          </tr>))}
      </tbody>
    </table></div></div>);

  return (
    <section className="karte huelle">
      {S.zahlgeraete.map((g) => (
        <div className="zl" key={g.id}>
          <span className="ini"><Ico n="karte" s={18} /></span>
          <span className="mitte"><b style={g.aktiv === false ? { color: "#8a90a6" } : undefined}>{g.name}</b>
            <span className="kn mu">{kstName(g.auftrag_nr)}</span></span>
          {status(g)}
          <button className="pf blau" data-akt="geraetBearbeiten" data-id={g.id} aria-label="Gerät bearbeiten"><Ico n="stift" /></button>
        </div>))}
    </section>);
}

const GeraetHinweis = () => (
  <div className="karte"><Hinweis>Ein Gerät gehört zu einer KST. Bei Kreditkarte auf diese KST wählt man es beim
    Erfassen aus — auch auf einem Konto ohne KST (gebucht wird dann „ohne KST“, das Gerät bleibt). In der
    Übersicht lässt sich danach filtern, der Export läuft dann pro Gerät. Ein Gerät, das schon
    in Belegen steckt, lässt sich nicht löschen — dann aus der Auswahl nehmen.</Hinweis></div>);

export function Geraete() {
  // Am Rechner steht das Formular immer da — also eines bereitlegen.
  if (!S.geraetEdit && (istBreit() || S.ansicht === "geraetForm")) S.geraetEdit = leeresGeraet();

  if (istBreit()) return (
    <Seite titel="Geräte" pfad={`${S.zahlgeraete.length} Geräte`} tab
           rechts={<button className="k1 klein" data-akt="geraetNeu">+ Neues Gerät</button>}>
      <KstListe />
      {!S.geraeteDa && <Hinweis>Die Datenbank kennt die Geräte noch nicht — zuerst geraete.sql ausführen.</Hinweis>}
      <div className="spalten">
        <div className="spalte"><GeraeteListe /><GeraetHinweis /></div>
        <GeraetForm />
      </div>
    </Seite>);

  if (S.ansicht === "geraetForm") {
    const g = S.geraetEdit;
    return (
      <Seite titel={g.neu ? "Neues Gerät" : "Gerät ändern"} sub={g.neu ? "Name und KST festlegen" : g.name}>
        <KstListe /><GeraetForm />
      </Seite>);
  }

  return (
    <Seite titel="Verwaltung" sub={`${S.zahlgeraete.length} Geräte`}>
      <Umschalter />
      {!S.geraeteDa && <Hinweis>Die Datenbank kennt die Geräte noch nicht — zuerst geraete.sql ausführen.</Hinweis>}
      <button className="k1" data-akt="geraetNeu">+ Neues Gerät</button>
      <GeraeteListe />
      <GeraetHinweis />
    </Seite>);
}

/* ==========================================================
   Kostenstellen: welche erscheinen in der Auswahl?
   Jahre mit Haken, dazu einzelne KST immer anzeigen oder ausblenden.
   ========================================================== */

// Name einer KST aus der geladenen Auswahl — fehlt er, steht nur die Nummer
const kstNameKurz = (nr: string) => (S.auftraege.find((a) => a.id === nr) || {}).name || "";

function RegelKarte({ sichtbar }: { sichtbar: boolean }) {
  const regeln = S.kstRegeln.filter((r) => r.sichtbar === sichtbar);
  const feld = sichtbar ? "kstimmer" : "kstaus";
  return (
    <section className="karte innen">
      <div className="kartentitel">
        <b>{sichtbar ? "Immer anzeigen" : "Ausblenden"}</b>
        <span className={"zahlmarke" + (sichtbar ? "" : " rot")}>{regeln.length}</span>
      </div>
      <span className="kn mu" style={{ marginTop: -8 }}>
        {sichtbar ? "Erscheinen immer in der Auswahl — auch wenn ihr Jahr ausgeblendet ist (z. B. 200 Tit-Pit allgemein)."
                  : "Erscheinen nicht in der Auswahl, auch wenn ihr Jahr angezeigt wird."}</span>
      <div className="chips">
        {regeln.length === 0 && <span className="kn mu">Noch keine.</span>}
        {regeln.map((r) => {
          const name = kstNameKurz(r.auftrag_nr);
          return (
            <span className={"chip" + (sichtbar ? "" : " aus")} key={r.auftrag_nr} title={name || undefined}>
              <span className="mono">{r.auftrag_nr}</span>{name && <span className="chipname">{name}</span>}
              <button data-akt="kstRegelWeg" data-v={r.auftrag_nr} aria-label={`KST ${r.auftrag_nr} entfernen`}>✕</button>
            </span>);
        })}
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <input id={feld} list="kstliste" placeholder="KST-Nummer" aria-label="KST-Nummer" style={{ flex: 1, minHeight: 42 }} />
        <Knopf akt="kstRegelNeu" className="k2 klein" data-f={feld} data-v={sichtbar ? "1" : "0"}>Hinzufügen</Knopf>
      </div>
    </section>);
}

function JahreKarte() {
  const jetzt = new Date().getFullYear();
  const anzahl = (j: number) => S.auftraege.filter((a) => String(a.jahr) === String(j) && !a.immer).length;
  return (
    <section className="karte innen">
      <div className="kartentitel">
        <b>Jahre</b><span className="zahlmarke">{S.kstJahre.filter((j) => j.sichtbar).length}</span>
      </div>
      <span className="kn mu" style={{ marginTop: -8 }}>Mit Haken erscheinen alle Aufträge dieses Jahres aus FileMaker
        in der Auswahl. Ein neues Jahr hier hinzufügen, sobald es losgeht.</span>
      {S.kstJahre.length === 0 && <span className="kn mu">Noch keine Jahre — dann erscheinen nur die KST unter „Immer anzeigen“.</span>}
      <div className="jahrliste">
        {S.kstJahre.map((j) => (
          <div className="jahrzeile" key={j.jahr}>
            <label className="jahrhaken">
              <input type="checkbox" className="schalter" checked={!!j.sichtbar} data-akt="kstJahrSchalten" data-v={j.jahr}
                     onChange={() => { /* läuft über data-akt */ }} aria-label={`Jahr ${j.jahr} anzeigen`} />
              <b className="mono">{j.jahr}</b>
            </label>
            <span className="kn mu" style={{ flex: 1 }}>
              {!j.sichtbar ? "ausgeblendet" : anzahl(j.jahr) === 1 ? "1 Auftrag in der Auswahl"
                : `${anzahl(j.jahr)} Aufträge in der Auswahl`}</span>
            <button className="pf" data-akt="kstJahrWeg" data-v={j.jahr} aria-label={`Jahr ${j.jahr} entfernen`}
                    style={{ color: "var(--rot-text)" }}>✕</button>
          </div>))}
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <input id="kstjahr" type="text" inputMode="numeric" placeholder={String(jetzt + 1)} aria-label="Jahr"
               style={{ flex: 1, minHeight: 42 }} />
        <Knopf akt="kstJahrNeu" className="k2 klein">Jahr hinzufügen</Knopf>
      </div>
    </section>);
}

export function Kostenstellen() {
  const sub = `${S.auftraege.length} KST in der Auswahl`;
  const inhalt = !S.kstDa
    ? <div className="karte"><Hinweis>Die Datenbank kennt diese Einstellung noch nicht — zuerst
        <b> kst-auswahl.sql</b> im Supabase SQL Editor ausführen. Bis dahin gilt wie bisher: laufendes Jahr
        und Vorjahr, dazu die fest eingebauten Nummern.</Hinweis></div>
    : <>
        {!S.kstFunktionNeu &&
          <div className="fehler">Die Edge Function <b>auftragsnummern</b> ist noch die alte Fassung: Jahre funktionieren,
            „Immer anzeigen“ für KST aus ausgeblendeten Jahren erst nach dem Deploy der neuen Fassung
            (supabase/functions/auftragsnummern).</div>}
        {S.laeuft && S.laeuft.akt === "kstLaden" && <div className="kn mu">{S.laeuft.text}</div>}
        <div className="spalten drei">
          <JahreKarte />
          <RegelKarte sichtbar />
          <RegelKarte sichtbar={false} />
        </div>
        <div className="karte"><Hinweis>Belege mit einer KST, die nicht mehr in der Auswahl steht, bleiben
          unverändert — sie zeigen dann nur die Nummer ohne Namen. „ohne KST“ steht immer zuoberst.</Hinweis></div>
      </>;

  if (istBreit()) return (
    <Seite titel="Kostenstellen" pfad={sub} tab>
      <KstListe />
      {inhalt}
    </Seite>);

  return (
    <Seite titel="Verwaltung" sub={sub}>
      <Umschalter />
      <KstListe />
      {inhalt}
    </Seite>);
}
