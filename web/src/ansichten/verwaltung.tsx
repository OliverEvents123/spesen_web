// verwaltung.tsx
// Passwort, Favoriten, Freigabeliste und die Admin-Seiten
// (Benutzer, Konten, Zuweisungen).

import { S, schluessel } from "../zustand";
import {
  st, istBreit, chf, zeitCH, kurzName, auftragAnzeige, auftragText, rolleName, istGeschuetzt,
  ROLLEN, SAETZE, OHNE_KST
} from "../grundlagen";
import { kontoName, aktiveKonten, belegeVon, postenAufKonto, leeresKonto } from "../daten";
import { Kopf, Reiter, AdminReiter, Meldung, Knopf, Stift, Info, Wahl, belegKopf, belegDetail } from "./bausteine";

// ---------- Passwort ändern ----------
export function Passwort() {
  return <>
    <Kopf titel="Passwort ändern" sub={S.session.user.email} zurueck />
    <div className="inhalt" style={st("max-width:480px")}>
      <div className="karte">
        <label htmlFor="pw1">Neues Passwort</label>
        <input id="pw1" type="password" autoComplete="new-password" style={st("margin-bottom:12px")} />
        <label htmlFor="pw2">Wiederholen</label>
        <input id="pw2" type="password" autoComplete="new-password" />
      </div>
      <Knopf akt="pwSichern" className="knopf">Passwort speichern</Knopf>
      <div style={st("font-size:13px;color:var(--grau);padding-top:12px;line-height:1.45")}>
        Mindestens sechs Zeichen. Nach dem Ändern bleibst du angemeldet.</div>
    </div>
  </>;
}

// ---------- Favoriten verwalten ----------
export function Favoriten() {
  return <>
    <Kopf titel="Favoriten" sub={`${S.favoriten.length} gespeichert`} zurueck />
    <div className="inhalt" style={st("max-width:620px")}>
      <Meldung />
      <div style={st("font-size:14px;color:var(--grau);line-height:1.45;margin-bottom:12px")}>
        Ein Favorit setzt Konto und Auftragsnummer. Der Pfeil schiebt ihn nach oben.</div>

      {S.favoriten.length === 0
        ? <div className="karte leer">Noch keine Favoriten.</div>
        : S.favoriten.map((f, i) => (
          <div className="favzeile" key={f.id}>
            <button className="pfeil" data-akt="favHoch" data-id={f.id} disabled={i === 0}
                    aria-label="Nach oben">↑</button>
            <div style={st("flex-grow:1;min-width:0")}>
              <div style={st("font-size:16px;font-weight:700")}>{f.name}</div>
              <div style={st("font-size:13px;color:var(--grau)")}>
                Konto {f.konto_nummer} · Auftrag {auftragAnzeige(f.auftrag_nr)}</div>
            </div>
            <button className="stift" data-akt="favBearbeiten" data-id={f.id}
                    aria-label="Favorit bearbeiten"><Stift /></button>
          </div>))}

      <button className="knopf" data-akt="favNeu" style={st("margin-top:4px")}>+ Neuer Favorit</button>

      <div style={st("font-size:13px;color:var(--grau);text-align:center;padding-top:14px;line-height:1.45")}>
        Schneller geht es über einen bestehenden Beleg: dort auf den Stift
        und „Als Favorit merken“.</div>
    </div>
  </>;
}

export function FavForm() {
  const f = S.favEdit;
  const fertig = f.konto && f.auftrag;
  return <>
    <Kopf titel={f.id ? "Favorit ändern" : "Neuer Favorit"} sub="Konto und Auftragsnummer festlegen" zurueck />
    <div className="inhalt" style={st("max-width:620px")} key={schluessel(f)}>
      <div className="karte">
        <label htmlFor="favname">Name</label>
        <input id="favname" type="text" data-feld="favname" defaultValue={f.name}
               placeholder={f.konto ? f.konto.bezeichnung : "z. B. Eventorganisation"} />
      </div>

      <Wahl akt="kontoWahl" titel="Konto" offen={!f.konto}
            wert={f.konto ? f.konto.nummer + "  " + f.konto.bezeichnung : "wählen"} />
      <Wahl akt="auftragWahl" titel="Auftrag" offen={!f.auftrag} wert={auftragText(f.auftrag)} />

      <Knopf akt="favSichern" className="knopf" disabled={!fertig}>
        {fertig ? "Favorit speichern" : "Konto und Auftrag nötig"}</Knopf>

      {f.id && <button className="loeschen" data-akt="favWeg">Diesen Favoriten löschen</button>}
    </div>
  </>;
}

// ---------- Freigabe: was ich entscheiden muss ----------
export function Freigabe() {
  const liste = S.freigabe;
  return <>
    <Kopf titel="Zur Freigabe" sub={liste.length === 1 ? "1 Beleg wartet" : `${liste.length} Belege warten`}
          zurueck={istBreit()} auchKnoepfe={istBreit()} />
    <Reiter />
    <div className="inhalt" style={st("max-width:760px")}>
      <Meldung />
      {liste.length === 0
        ? <div className="karte leer">Nichts zu prüfen.</div>
        : liste.map((b) => (
          <button className="karte zeile freigabezeile" data-akt="bearbeiten" data-id={b.id}
                  data-w="freigabe" key={b.id}>
            <div style={st("flex:1 1 auto;min-width:0;text-align:left;overflow-wrap:anywhere")}>
              <div style={st("font-weight:600")}>{belegKopf(b)}</div>
              <div style={st("font-size:13px;color:var(--grau)")}>{belegDetail(b, true)}</div>
              <div style={st("font-size:12px;color:var(--grau)")}>eingereicht {zeitCH(b.eingereicht_am)}</div>
            </div>
            <div style={st("text-align:right;flex-shrink:0")}>
              <div style={st("font-size:17px;font-weight:700")}>{chf(b.betrag)}</div>
              <div style={st("font-size:13px;color:var(--blau)")}>prüfen ›</div>
            </div>
          </button>))}
    </div>
  </>;
}

/* ==========================================================
   Admin — Benutzer
   ========================================================== */

function BenForm() {
  const b = S.benEdit || { neu: true, email: "", name: "", rolle: "user", gesperrt: false };
  const fest = !b.neu && istGeschuetzt(b.email);   // Notfall-Administrator
  return (
    <div className="karte" key={schluessel(S.benEdit)}>
      <div style={st("font-size:17px;font-weight:700;margin-bottom:14px")}>
        {b.neu ? "Neuer Benutzer" : (b.name || kurzName(b.email))}</div>

      {b.neu ? <>
          <label htmlFor="bmail">E-Mail</label>
          <input id="bmail" type="email" inputMode="email" defaultValue={b.email} data-feld="bmail"
                 placeholder="handy3@tit-pit.ch" style={st("margin-bottom:12px")} />
        </>
        : <div style={st("font-size:14px;color:var(--grau);margin-bottom:12px;line-height:1.45")}>
            {b.email} — bleibt fest, die Belege hängen daran.</div>}

      <label htmlFor="bname">Name</label>
      <input id="bname" type="text" defaultValue={b.name} placeholder="Eventhandy 3" data-feld="bname"
             style={st("margin-bottom:14px")} />

      <label>Rolle</label>
      <div className="mwst rollenwahl" style={st("margin-bottom:8px")}>
        {Object.entries(ROLLEN).map(([w, [name]]) =>
          <button key={w} className={b.rolle === w ? "an" : ""} data-akt="benRolle" data-v={w}
                  disabled={fest}>{name}</button>)}
      </div>
      <div style={st("font-size:13px;color:var(--grau);line-height:1.45;margin-bottom:14px")}>
        {fest ? "Notfall-Administrator. Rolle und Sperre sind festgelegt, damit immer ein Weg in die Verwaltung offen bleibt."
              : (ROLLEN[b.rolle] || ROLLEN.user)[1]}</div>

      <div style={st("display:flex;align-items:flex-start;gap:10px;margin-bottom:14px")}>
        <input id="bpruefung" type="checkbox" defaultChecked={!!b.pruefung} data-feld="bpruefung"
               style={st("width:20px;height:20px;margin:2px 0 0;flex-shrink:0;accent-color:var(--blau)")} />
        <label htmlFor="bpruefung" style={st("margin:0;font-size:14px;color:var(--dunkel);line-height:1.45")}>
          <b>Prüfung einrichten</b><br />
          <span style={st("color:var(--grau)")}>Belege ohne zuständigen Projektleiter gehen nicht
          automatisch durch, sondern warten auf einen Admin oder Supervisor.</span></label>
      </div>

      <label htmlFor="bpw">{b.neu ? "Passwort" : "Neues Passwort (leer lassen, wenn unverändert)"}</label>
      <input id="bpw" type="text" autoComplete="off" placeholder="mindestens 6 Zeichen" />
      <div style={st("font-size:12px;color:var(--grau);padding:8px 0 14px;line-height:1.45")}>
        Im Klartext sichtbar, damit du es weitergeben kannst.</div>

      <Knopf akt="benSichern" className="knopf">{b.neu ? "Benutzer anlegen" : "Änderungen speichern"}</Knopf>

      {!b.neu && !fest &&
        <Knopf akt="benSperren" className="zweit" style={st("margin-top:10px")}>
          {b.gesperrt ? "Wieder freischalten" : "Anmeldung sperren"}</Knopf>}
      {!b.neu &&
        <button className="zweit" data-akt="benNeu" style={st("margin-top:10px")}>Stattdessen neuen anlegen</button>}
    </div>);
}

function BenListe() {
  const breit = istBreit();
  const gesperrt = (b) => b.gesperrt || !b.aktiv;
  return (
    <div className="karte">
      <div style={st("font-size:17px;font-weight:700;margin-bottom:12px")}>Alle Benutzer</div>
      {S.benutzer.length === 0 ? <div className="leer">Keine Benutzer geladen.</div>
        : breit ?
          <div className="rollen"><table>
            <thead><tr>
              <th>Name</th><th>E-Mail</th><th>Rolle</th><th>Status</th>
              <th>Zuletzt angemeldet</th><th className="re">Belege im Zeitraum</th><th></th>
            </tr></thead>
            <tbody>
              {S.benutzer.map((b) => (
                <tr key={b.email}>
                  <td style={st("font-weight:600")}>{b.name || kurzName(b.email)}</td>
                  <td style={st("color:#3f5a80")}>{b.email}</td>
                  <td><span className={`rolle ${b.rolle}`}>{rolleName(b.rolle)}</span>
                      {b.pruefung && <> <span className="rolle st-eingereicht">Prüfung</span></>}</td>
                  <td>{gesperrt(b) ? <span className="rolle aus">gesperrt</span>
                                   : <span style={st("color:#3f5a80")}>aktiv</span>}</td>
                  <td style={st("color:var(--grau)")}>{b.angemeldet ? zeitCH(b.angemeldet) : "nie"}</td>
                  <td className="re">{belegeVon(b.email)}</td>
                  <td className="re" style={st("width:52px")}>
                    <button className="stift" data-akt="benBearbeiten" data-e={b.email}
                            style={st("display:inline-flex")} aria-label="Benutzer bearbeiten"><Stift /></button>
                  </td>
                </tr>))}
            </tbody>
          </table></div>
        : S.benutzer.map((b) => (
          <div className="zeile" style={st("padding:10px 0;border-bottom:1px solid #EDEFF5")} key={b.email}>
            <div style={st("min-width:0")}>
              <div style={st("font-weight:600")}>{b.name || kurzName(b.email)}</div>
              <div style={st("font-size:13px;color:var(--grau);overflow:hidden;text-overflow:ellipsis")}>{b.email}</div>
            </div>
            <div style={st("display:flex;align-items:center;gap:8px;flex-shrink:0")}>
              <span className={`rolle ${gesperrt(b) ? "aus" : b.rolle}`}>
                {gesperrt(b) ? "gesperrt" : rolleName(b.rolle)}</span>
              <button className="stift" data-akt="benBearbeiten" data-e={b.email}
                      aria-label="Benutzer bearbeiten"><Stift /></button>
            </div>
          </div>))}
    </div>);
}

const BenHinweis = () => (
  <div className="karte" style={st("display:flex;gap:14px;align-items:flex-start")}>
    <Info />
    <span style={st("font-size:14px;color:var(--grau);line-height:1.5")}>
      Gesperrte Benutzer können sich nicht anmelden. Ihre Belege bleiben vollständig erhalten
      und erscheinen weiter in der Übersicht und in den Exporten. Ein Konto zu sperren ist
      deshalb immer besser, als es zu löschen.</span>
  </div>);

function adminSub() {
  const admins = S.benutzer.filter((b) => b.rolle === "admin").length;
  return `${S.benutzer.length} Benutzer · ${admins} ${admins === 1 ? "Administrator" : "Administratoren"}`
       + ` · ${S.konten.length} Konten`;
}

// Benutzer: am Rechner Liste und Formular nebeneinander, am Handy nacheinander
export function Benutzer() {
  if (istBreit()) return <>
    <Kopf titel="Admin" sub={adminSub()} zurueck auchKnoepfe />
    <AdminReiter />
    <div className="inhalt">
      <Meldung />
      <div className="zweispalt">
        <div className="breit"><BenListe /><BenHinweis /></div>
        <div className="schmal" style={st("width:380px")}><BenForm /></div>
      </div>
    </div>
  </>;

  if (S.ansicht === "benForm") {
    const b = S.benEdit;
    return <>
      <Kopf titel={b.neu ? "Neuer Benutzer" : "Benutzer ändern"} sub={b.neu ? "Konto anlegen" : b.email} zurueck />
      <div className="inhalt" style={st("max-width:620px")}><BenForm /></div>
    </>;
  }

  return <>
    <Kopf titel="Admin" sub={`${S.benutzer.length} Benutzer`} zurueck auchKnoepfe />
    <AdminReiter />
    <div className="inhalt">
      <Meldung />
      <button className="knopf" data-akt="benNeu" style={st("margin-bottom:14px")}>+ Neuer Benutzer</button>
      <BenListe />
      <BenHinweis />
    </div>
  </>;
}

/* ==========================================================
   Admin — Konten
   ========================================================== */

function KontoForm() {
  const k = S.kontEdit;
  return (
    <div className="karte" key={schluessel(k)}>
      <div style={st("font-size:17px;font-weight:700;margin-bottom:14px")}>
        {k.neu ? "Neues Konto" : k.nummer + "  " + k.bezeichnung}</div>

      {k.neu ? <>
          <label htmlFor="knummer">Nummer</label>
          <input id="knummer" type="text" inputMode="numeric" defaultValue={k.nummer}
                 placeholder="4590" data-feld="knummer" style={st("margin-bottom:12px")} />
        </>
        : <div style={st("font-size:14px;color:var(--grau);margin-bottom:12px;line-height:1.45")}>
            Nummer {k.nummer} — bleibt fest, weil die Belege daran hängen.</div>}

      <label htmlFor="kbez">Bezeichnung</label>
      <input id="kbez" type="text" defaultValue={k.bezeichnung} placeholder="Übernachtungen"
             data-feld="kbez" style={st("margin-bottom:14px")} />

      <label>MwSt-Standard</label>
      <div className="mwst" style={st("margin-bottom:8px")}>
        {SAETZE.map((m) =>
          <button key={m} className={String(k.mwst) === m ? "an" : ""} data-akt="kontoMwst" data-v={m}>
            {m}{" "}%</button>)}
      </div>
      <div style={st("font-size:13px;color:var(--grau);line-height:1.45;margin-bottom:14px")}>
        Wird beim neuen Beleg vorbelegt und lässt sich dort ändern.</div>

      <label htmlFor="ksort">Reihenfolge in der Auswahl</label>
      <input id="ksort" type="text" inputMode="numeric" defaultValue={k.sortierung}
             data-feld="ksort" style={st("margin-bottom:6px")} />
      <div style={st("font-size:13px;color:var(--grau);line-height:1.45;margin-bottom:14px")}>
        Zehnerschritte, damit später etwas dazwischen passt.</div>

      <div style={st("display:flex;align-items:center;gap:10px;min-height:44px;margin-bottom:8px")}>
        <input id="kaktiv" type="checkbox" defaultChecked={!!k.aktiv} data-feld="kaktiv"
               style={st("width:20px;height:20px;margin:0;accent-color:var(--blau)")} />
        <label htmlFor="kaktiv" style={st("margin:0;font-size:15px;color:var(--dunkel)")}>Steht in der Auswahl</label>
      </div>

      <Knopf akt="kontoSichern" className="knopf">{k.neu ? "Konto anlegen" : "Änderungen speichern"}</Knopf>

      {!k.neu && <button className="zweit" data-akt="kontoNeu" style={st("margin-top:10px")}>
        Stattdessen neues anlegen</button>}
    </div>);
}

function KontenListe() {
  const breit = istBreit();
  return (
    <div className="karte">
      <div style={st("font-size:17px;font-weight:700;margin-bottom:12px")}>Alle Konten</div>
      {S.konten.length === 0 ? <div className="leer">Noch keine Konten angelegt.</div>
        : breit ?
          <div className="rollen"><table>
            <thead><tr>
              <th>Nummer</th><th>Bezeichnung</th><th>MwSt-Standard</th><th>Reihenfolge</th>
              <th>Status</th><th className="re">Posten im Zeitraum</th><th></th>
            </tr></thead>
            <tbody>
              {S.konten.map((k) => (
                <tr key={k.nummer}>
                  <td className="gross">{k.nummer}</td>
                  <td style={st("color:#3f5a80")}>{k.bezeichnung}</td>
                  <td style={st("color:#3f5a80")}>{k.mwst} %</td>
                  <td style={st("color:var(--grau)")}>{k.sortierung ?? ""}</td>
                  <td>{k.aktiv === false ? <span className="rolle aus">inaktiv</span>
                                         : <span style={st("color:#3f5a80")}>aktiv</span>}</td>
                  <td className="re">{postenAufKonto(k.nummer)}</td>
                  <td className="re" style={st("width:52px")}>
                    <button className="stift" data-akt="kontoBearbeiten" data-nr={k.nummer}
                            style={st("display:inline-flex")} aria-label="Konto bearbeiten"><Stift /></button>
                  </td>
                </tr>))}
            </tbody>
          </table></div>
        : S.konten.map((k) => (
          <div className="zeile" style={st("padding:10px 0;border-bottom:1px solid #EDEFF5")} key={k.nummer}>
            <div style={st("min-width:0")}>
              <div style={st("font-weight:600")}>{k.nummer} {k.bezeichnung}</div>
              <div style={st("font-size:13px;color:var(--grau)")}>
                MwSt {k.mwst} % · Reihenfolge {k.sortierung ?? ""}</div>
            </div>
            <div style={st("display:flex;align-items:center;gap:8px;flex-shrink:0")}>
              {k.aktiv === false && <span className="rolle aus">inaktiv</span>}
              <button className="stift" data-akt="kontoBearbeiten" data-nr={k.nummer}
                      aria-label="Konto bearbeiten"><Stift /></button>
            </div>
          </div>))}
    </div>);
}

const KontoHinweis = () => (
  <div className="karte" style={st("display:flex;gap:14px;align-items:flex-start")}>
    <Info />
    <span style={st("font-size:14px;color:var(--grau);line-height:1.5")}>
      Ein Konto auf inaktiv zu stellen nimmt es aus der Auswahl, lässt es aber in alten
      Belegen und Exporten stehen. Löschen gibt es bewusst nicht — die Belege hängen an
      der Nummer.</span>
  </div>);

export function Konten() {
  // Am Rechner steht das Formular immer da — also eines bereitlegen.
  if (!S.kontEdit && (istBreit() || S.ansicht === "kontoForm")) S.kontEdit = leeresKonto();

  if (istBreit()) return <>
    <Kopf titel="Admin" sub={adminSub()} zurueck auchKnoepfe />
    <AdminReiter />
    <div className="inhalt">
      <Meldung />
      <div className="zweispalt">
        <div className="breit"><KontenListe /><KontoHinweis /></div>
        <div className="schmal" style={st("width:380px")}><KontoForm /></div>
      </div>
    </div>
  </>;

  if (S.ansicht === "kontoForm") {
    const k = S.kontEdit;
    return <>
      <Kopf titel={k.neu ? "Neues Konto" : "Konto ändern"}
            sub={k.neu ? "Nummer und Bezeichnung festlegen" : k.nummer + "  " + k.bezeichnung} zurueck />
      <div className="inhalt" style={st("max-width:620px")}><KontoForm /></div>
    </>;
  }

  return <>
    <Kopf titel="Admin" sub={`${S.konten.length} Konten`} zurueck auchKnoepfe />
    <AdminReiter />
    <div className="inhalt">
      <Meldung />
      <button className="knopf" data-akt="kontoNeu" style={st("margin-bottom:14px")}>+ Neues Konto</button>
      <KontenListe />
      <KontoHinweis />
    </div>
  </>;
}

/* ==========================================================
   Admin — Zuweisungen: wer prüft welche KST, welche Konten
   ========================================================== */

// Name einer KST für die Anzeige: "2601 Gurtenfestival"
function kstName(nr) {
  if (nr === OHNE_KST.id) return OHNE_KST.name;
  const a = S.auftraege.find((x) => x.id === nr);
  return a && a.name ? nr + " " + a.name : nr;
}

const Chip = ({ text, akt, email, wert }) => (
  <span className="chip">{text}
    <button data-akt={akt} data-e={email} data-v={wert} aria-label={`${text} entfernen`}>✕</button></span>);

// Eine Person mit ihren KST (art "kst") bzw. Konten (art "konto")
function ZuweisungKarte({ b, art }) {
  const eigene = art === "kst"
    ? S.zuweisungen.filter((z) => z.email === b.email)
    : S.zuweisungenKonto.filter((z) => z.email === b.email);
  const feld = `zw-${art}-${b.email.replace(/[^a-z0-9]/gi, "_")}`;
  return (
    <div className="karte">
      <div className="zeile" style={st("margin-bottom:8px")}>
        <div><div style={st("font-weight:700")}>{b.name || kurzName(b.email)}</div>
             <div style={st("font-size:13px;color:var(--grau)")}>{b.email}</div></div>
        <span className={`rolle ${b.rolle}`}>{rolleName(b.rolle)}</span>
      </div>
      <div style={st("display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px")}>
        {eigene.length ? eigene.map((z) => art === "kst"
            ? <Chip key={z.auftrag_nr} text={kstName(z.auftrag_nr)} akt="zuwWeg" email={b.email} wert={z.auftrag_nr} />
            : <Chip key={z.konto_nummer} text={z.konto_nummer + " " + kontoName(z.konto_nummer)}
                    akt="zuwKontoWeg" email={b.email} wert={z.konto_nummer} />)
          : <span style={st("font-size:13px;color:var(--grau)")}>noch {art === "kst" ? "keine KST" : "keine Konten"}</span>}
      </div>
      <div style={st("display:flex;gap:8px")}>
        {art === "kst"
          ? <input id={feld} list="kstliste" placeholder="KST-Nummer eingeben" style={st("flex:1")} />
          : <select id={feld} style={st("flex:1")} defaultValue="">
              <option value="">Konto wählen</option>
              {aktiveKonten().map((k) => <option key={k.nummer} value={k.nummer}>{k.nummer} {k.bezeichnung}</option>)}
            </select>}
        <button className="zweit" style={st("width:auto;padding:0 16px")}
                data-akt={art === "kst" ? "zuwNeu" : "zuwKontoNeu"} data-e={b.email} data-f={feld}>Hinzufügen</button>
      </div>
    </div>);
}

export function Zuweisungen() {
  const pls  = S.benutzer.filter((b) => b.rolle === "projektleiter"
                 || S.zuweisungen.some((z) => z.email === b.email));
  const sups = S.benutzer.filter((b) => b.rolle === "supervisor"
                 || S.zuweisungenKonto.some((z) => z.email === b.email));

  return <>
    <Kopf titel="Admin" sub="Zuweisungen" zurueck auchKnoepfe />
    <AdminReiter />
    <div className="inhalt" style={st("max-width:760px")}>
      <Meldung />
      <datalist id="kstliste">
        <option value={OHNE_KST.id}>{OHNE_KST.name}</option>
        {S.auftraege.map((a) => <option key={a.id} value={a.id}>{a.name || ""}</option>)}
      </datalist>

      <span className="abschnitt">PROJEKTLEITER × KOSTENSTELLEN</span>
      <div style={st("height:8px")} />
      {pls.length ? pls.map((b) => <ZuweisungKarte key={b.email} b={b} art="kst" />)
        : <div className="karte leer">Noch niemand mit der Rolle Projektleiter. Unter Benutzer die Rolle setzen.</div>}

      <span className="abschnitt" style={st("padding-top:10px")}>SUPERVISOREN × KONTEN</span>
      <div style={st("height:8px")} />
      {sups.length ? sups.map((b) => <ZuweisungKarte key={b.email} b={b} art="konto" />)
        : <div className="karte leer">Noch niemand mit der Rolle Supervisor. Unter Benutzer die Rolle setzen.</div>}

      <div style={st("font-size:13px;color:var(--grau);line-height:1.5;padding-top:6px")}>
        Ein Beleg geht an alle, denen seine KST oder sein Konto zugewiesen ist — wer zuerst
        entscheidet, gilt. Hat er niemanden, läuft er ohne Prüfung durch, ausser beim
        Erfasser ist „Prüfung einrichten“ angehakt.</div>
    </div>
  </>;
}
