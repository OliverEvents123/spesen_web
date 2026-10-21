// erfassen.tsx
// Beleg erfassen und bearbeiten, eingereichte Belege ansehen und prüfen,
// dazu die Auswahlseiten für Konto und KST (am Handy).

import { S, schluessel } from "../zustand";
import {
  istBreit, chf, chfLang, langDatum, zeitCH, betragVon, statusName, zahlartName, istGesperrt,
  istEntschieden, positionenSumme, positionenFertig, ZAHLART, SAETZE,
  kurzDatum, statusVon, statusKlasse, belegZeilen, OHNE_KST
} from "../grundlagen";
import {
  personName, kannSelbstEntscheiden, geraeteFuer, geraetGewaehlt, geraetFehlt, geraetName,
  freigabeIm, freigabeGefiltert, darfFreigabeFiltern, imBereich, kontoName, BEREICH_NAME
} from "../daten";
import { apListe } from "../aktionen";
import { Seite } from "./rahmen";
import {
  Ico, Knopf, StatusMarke, Wahl, KstWahl, WahlListe, Hinweis, Meldung, stempelText, kontoWahlText, auftragWahlText, kstTitel,
  belegKopf, kstName
} from "./bausteine";

const herkunft = () => ({ uebersicht: "Übersicht", freigabe: "Freigabe" } as any)[S.zurueckZu] || "Meine Belege";
const kontoText = (k: any) => k ? k.nummer + "  " + (k.bezeichnung || "") : "—";
const auftragText = (a: any) => { const t = auftragWahlText(a); return t.neben ? t.neben + "  " + t.haupt : t.haupt; };

// ---------- Belegbild ----------
function BelegVorschau({ n, gross }: { n: any; gross?: boolean }) {
  if (n.datei) return n.vorschau
    ? <img className="papierbild" src={n.vorschau} alt="Belegvorschau" style={gross ? { maxHeight: 560 } : undefined} />
    : <div className="pdfmarke">PDF: {n.datei.name}</div>;
  if (n.altPfad) return n.altUrl
    ? <img className="papierbild" src={n.altUrl} alt="Beleg" style={gross ? { maxHeight: 560 } : undefined} />
    : <div className="pdfmarke">{n.altPdf ? "PDF-Beleg — Vorschau lädt …" : "PDF-Beleg hinterlegt"}</div>;
  return null;
}

// Karte oben: Beleg fotografieren/wählen oder die Vorschau mit "Anderen Beleg"
function BelegKarte({ n, gross }: { n: any; gross?: boolean }) {
  const hat = !!(n.datei || n.altPfad);
  if (!hat) return (
    <section className="karte innen ablage">
      <span className="kl">Beleg</span>
      <button className="k1 voll" data-akt="foto"><Ico n="kamera" s={20} /> Beleg fotografieren</button>
      <button className="k2 voll" data-akt="waehlen">PDF oder Bild wählen</button>
      <span className="kn mu" style={{ textAlign: "center" }}>am Rechner auch per Ziehen und Ablegen</span>
      <div className="ziehhinweis">Datei hier ablegen</div>
    </section>);
  if (gross) return (
    <section className="karte huelle ablage">
      <div className="belegbild"><BelegVorschau n={n} gross /></div>
      <div style={{ display: "flex", gap: 10, alignItems: "center", padding: 12 }}>
        <span className="kn mu" style={{ flex: 1 }}>{n.datei ? n.datei.name : "Beleg hinterlegt"} · Datei hierher ziehen, um sie zu ersetzen</span>
        {n.altPfad && !n.datei && <button className="k2 klein" data-akt="belegAuf" data-p={n.altPfad}>Öffnen</button>}
        <button className="k2 klein" data-akt="belegNeu">Anderen Beleg</button>
      </div>
      <div className="ziehhinweis" style={{ paddingBottom: 10 }}>Datei hier ablegen, um sie zu ersetzen</div>
    </section>);
  return (
    <section className="karte innen ablage">
      <BelegVorschau n={n} />
      <button className="k2 voll" data-akt="belegNeu">Anderen Beleg wählen</button>
      <div className="ziehhinweis">Datei hier ablegen, um sie zu ersetzen</div>
    </section>);
}

// Eine Position eines aufgeteilten Belegs: Betrag, Satz, Konto, KST.
function Position({ p, i, anzahl }: { p: any; i: number; anzahl: number }) {
  const kt = kontoWahlText(p.konto);
  return (
    <section className="karte huelle">
      <div className="kartenkopf">
        <b style={{ color: "var(--akzent-text)" }}>Position {i + 1}</b>
        {anzahl > 1 && <button className="pf" data-akt="posWeg" data-i={i} style={{ color: "var(--rot-text)" }}
                               aria-label={`Position ${i + 1} entfernen`}>✕</button>}
      </div>
      <div className="zwei" style={{ padding: "0 14px 12px" }}>
        <div className="feld"><label htmlFor={"pb" + i}>Betrag CHF</label>
          <input id={"pb" + i} type="text" inputMode="decimal" autoComplete="off" placeholder="0.00"
                 defaultValue={p.betragText} data-feld="posbetrag" data-i={i} className="mono"
                 style={{ textAlign: "right", fontWeight: 700 }} /></div>
        <div className="feld"><label htmlFor={"pm" + i}>MwSt</label>
          <select id={"pm" + i} data-feld="posmwst" data-i={i} defaultValue={p.mwst}>
            {SAETZE.map((m) => <option key={m} value={m}>{m} %</option>)}
          </select></div>
      </div>
      <div style={{ borderTop: "1px solid var(--linie)" }}>
        <Wahl akt="kontoWahl" i={i} titel="Konto" offen={!p.konto} haupt={kt.haupt} neben={kt.neben} />
        <KstWahl konto={p.konto} auftrag={p.auftrag} i={i} />
      </div>
    </section>);
}

// Kreditkarte auf einer KST mit Geräten: welches Gerät? Eines ist vorgewählt.
function GeraetWahl({ n }: { n: any }) {
  const liste = geraeteFuer(n);
  if (!liste.length) return null;
  const gewaehlt = geraetGewaehlt(n);
  return (
    <div><span className="lab">Gerät</span>
      <div className={"seg" + (liste.length > 3 ? " gitter" : "")}>
        {liste.map((g) => {
          const an = String(gewaehlt) === String(g.id);
          return <button key={g.id} className={an ? "an" : ""} data-akt="zahlgeraet" data-v={g.id}
                         aria-pressed={an}>{g.name}</button>;
        })}
      </div>
      {gewaehlt == null && <span className="kn" style={{ color: "var(--rot-text)" }}>Bitte das Gerät wählen.</span>}
    </div>);
}

// ---------- Erfassen / Bearbeiten ----------
export function Erfassen() {
  const n = S.neu;
  if (n.id && istGesperrt(n)) return <BelegAnsehen n={n} key={schluessel(n)} />;
  const bearbeiten = !!n.id;
  const geteilt = Array.isArray(n.positionen);
  const betrag = geteilt ? positionenSumme(n.positionen) : betragVon(n.betragText);
  const hatBeleg = !!(n.datei || n.altPfad);
  const angabenFertig = hatBeleg && (geteilt ? positionenFertig(n.positionen) : (betrag > 0 && n.konto && n.auftrag));
  const fertig = angabenFertig && !geraetFehlt(n);
  const fehltText = angabenFertig ? "Bitte das Gerät wählen" : "Beleg, Konto, KST und Betrag nötig";
  const breit = istBreit();
  const kt = kontoWahlText(n.konto);

  const abgelehnt = n.status === "abgelehnt" &&
    <div className="fehler">
      <b>Abgelehnt</b>{n.entscheidVon ? " von " + n.entscheidVon : ""}
      {n.entscheidAm ? " · " + zeitCH(n.entscheidAm) : ""}<br />
      „{n.entscheidGrund}“<br />
      <span className="kn">Korrigieren und neu zur Prüfung freigeben — oder löschen.</span>
    </div>;

  const favoriten = !geteilt && S.favoriten.length > 0 &&
    <div><span className="lab">Favorit übernehmen</span>
      <div className={breit ? "chips" : "favleiste"}>
        {S.favoriten.slice(0, 8).map((f) => (
          <button key={f.id} className="k2 klein" style={{ borderRadius: 999, flex: "0 0 auto" }}
                  data-akt="favUebernehmen" data-id={f.id}>{f.name}</button>))}
      </div></div>;

  // Der Normalfall: ein Betrag, ein Konto, eine KST, vier Sätze.
  const einfachTeil = <>
    <div className="feld"><label htmlFor="betrag">Betrag CHF</label>
      <input id="betrag" className="betragfeld" type="text" inputMode="decimal" autoComplete="off"
             placeholder="0.00" defaultValue={n.betragText} data-feld="betrag" /></div>
    <section className="karte huelle">
      <Wahl akt="kontoWahl" titel="Konto" offen={!n.konto} haupt={kt.haupt} neben={kt.neben} />
      <KstWahl konto={n.konto} auftrag={n.auftrag} />
    </section>
    <div><span className="lab">MwSt</span>
      <div className="seg">
        {SAETZE.map((m) =>
          <button key={m} className={"mono" + (n.mwst === m ? " an" : "")} data-akt="mwst" data-v={m}
                  aria-pressed={n.mwst === m}>{m} %</button>)}
      </div>
      <button className="link" data-akt="aufteilen">+ Mehrere MwSt-Sätze auf diesem Beleg</button></div>
  </>;

  // Aufgeteilt: je Position ein vollständiges Paket.
  const geteiltTeil = geteilt && <>
    {n.positionen.map((p, i) => <Position key={schluessel(p)} p={p} i={i} anzahl={n.positionen.length} />)}
    <button className="k2" data-akt="posNeu"><Ico n="plus" s={18} /> Weitere Position</button>
    <div className="karte" style={{ padding: "12px 14px", display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
      <span className="kl">Beleg gesamt</span><b className="mono" style={{ fontSize: 22 }}>CHF {chfLang(betrag)}</b></div>
    <button className="link" data-akt="aufteilenWeg" style={{ alignSelf: "center" }}>Aufteilung aufheben</button>
  </>;

  const rest = <>
    <div><span className="lab">Bezahlt mit</span>
      <div className="seg">
        {Object.entries(ZAHLART).map(([w, t]) =>
          <button key={w} className={n.zahlart === w ? "an" : ""} data-akt="zahlart" data-v={w}
                  aria-pressed={n.zahlart === w}>{t}</button>)}
      </div></div>
    <GeraetWahl n={n} />
    <div className="feld"><label htmlFor="datum">Belegdatum</label>
      <input id="datum" type="date" defaultValue={n.datum} data-feld="datum" /></div>
    <div className="feld"><label htmlFor="kommentar">Kommentar (freiwillig)</label>
      <textarea id="kommentar" rows={2} defaultValue={n.kommentar} data-feld="kommentar"
                placeholder="z. B. Znacht mit Kunde Muster" /></div>
  </>;

  // Bin ich selbst für den Beleg zuständig (eigene KST/Konten, Admin)?
  // Dann gleich genehmigen statt zweimal anfassen.
  const selbst = n.konto && n.auftrag || geteilt ? kannSelbstEntscheiden(n) : false;
  const hauptKnopf = selbst
    ? <Knopf akt="speichernGenehmigen" className="k1" disabled={!fertig}>
        {fertig ? "Speichern und genehmigen" : fehltText}</Knopf>
    : <Knopf akt="speichernFrei" className="k1" disabled={!fertig}>
        {fertig ? "Speichern und zur Prüfung freigeben" : fehltText}</Knopf>;
  const nurKnopf = <Knopf akt="speichern" className="k2" disabled={!fertig}>
    {bearbeiten ? "Nur Änderungen speichern" : "Nur speichern"}</Knopf>;
  const knoepfe = <>{hauptKnopf}{nurKnopf}</>;
  // Am Rechner unten in der Fussleiste: kürzer, damit beide in eine Zeile passen
  const hauptKurz = <Knopf akt={selbst ? "speichernGenehmigen" : "speichernFrei"} className="k1" disabled={!fertig}
                           title={fertig ? undefined : fehltText}>
    {!fertig ? (angabenFertig ? "Gerät wählen" : "Angaben fehlen")
      : selbst ? "Speichern und genehmigen" : "Speichern und freigeben"}</Knopf>;
  const nurKurz = <Knopf akt="speichern" className="k2" disabled={!fertig}>Nur speichern</Knopf>;

  const extra = bearbeiten && <>
    {!geteilt && n.konto && n.auftrag &&
      <button className="k2" data-akt="favMerken"><Ico n="stern" s={18} /> Als Favorit merken</button>}
    <Knopf akt="loeschen" className="kr">Diesen Beleg löschen</Knopf>
  </>;

  const titel = bearbeiten ? "Beleg bearbeiten" : "Beleg erfassen";
  const sub = geteilt ? `${n.positionen.length} Positionen`
            : (bearbeiten ? "Werte ändern und speichern" : "Angaben prüfen und speichern");

  // Rechner, neuer Beleg ohne Datei: zuerst nur die grosse Ablage
  if (breit && !hatBeleg && !bearbeiten) return <Ablage n={n} />;

  // Rechner: Arbeitsplatz — Liste (beim Bearbeiten), Beleg gross, rechts die Felder
  if (breit) return (
    <Seite titel={titel} pfad={bearbeiten ? herkunft() : undefined} voll
           rechts={<button className="k2 klein" data-akt="zurueck">{bearbeiten ? "Schliessen" : "Abbrechen"}</button>}>
      <Arbeitsplatz woher={bearbeiten ? S.zurueckZu : null} n={n}
        fuss={<>{bearbeiten ? <NavKnoepfe /> : <span className="ap-nav" />}{nurKurz}{hauptKurz}</>}>
        {abgelehnt}
        {favoriten}
        {geteilt ? geteiltTeil : einfachTeil}
        {rest}
        {extra}
      </Arbeitsplatz>
    </Seite>);

  return (
    <Seite titel={titel} sub={sub} fuss={knoepfe}>
      <div key={schluessel(n)} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {abgelehnt}
        <BelegKarte n={n} />
        {favoriten}
        {geteilt ? geteiltTeil : einfachTeil}
        {rest}
        {extra}
      </div>
    </Seite>);
}

// ---------- Ansehen / Prüfen ----------
const Zeile = ({ titel, children }: { titel: string; children?: any }) => (
  <div className="zeilewert"><span>{titel}</span><span>{children}</span></div>);

// Der Inhalt eines eingereichten oder entschiedenen Belegs. Aus der Freigabe
// geöffnet (n.pruefen) kommt das Entscheid-Feld dazu. Admins haben den Rückweg.
// breit: zweispaltig (Bild links) — am Rechner.
// panel: rechts im Arbeitsplatz — ohne Bild (steht in der Mitte) und ohne
// Hauptknopf im Entscheid (steht unten in der Fussleiste).
export function BelegInhalt({ n, breit, panel }: { n: any; breit?: boolean; panel?: boolean }) {
  const geteilt = Array.isArray(n.positionen);
  const betrag  = geteilt ? positionenSumme(n.positionen) : betragVon(n.betragText);
  const s = n.status;
  const stempel = stempelText(n);

  // Kontierung: beim Prüfen eines einfachen Belegs anklickbar (umkontieren).
  // Bei Kreditkarte/Bar lassen sich auch Betrag, MwSt und Datum korrigieren.
  const umkont = n.pruefen && !geteilt;
  const korr = umkont && n.zahlartDb !== "vorkasse";
  const kontGeaendert = umkont && n.konto && n.auftrag &&
    (n.konto.nummer !== n.kontoAlt || n.auftrag.id !== n.auftragAlt);
  const werteGeaendert = korr && (Math.abs(betragVon(n.korrBetrag) - parseFloat(n.betragDb)) > 0.004
    || parseFloat(n.korrMwst) !== parseFloat(n.mwst) || n.korrDatum !== n.datum);
  const geaendert = kontGeaendert || werteGeaendert;
  const kt = kontoWahlText(n.konto);

  const kopf = (
    <section className="karte innen" style={{ gap: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
        <span style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
          <b style={{ fontSize: 17 }}>{geteilt ? `Aufgeteilt auf ${n.positionen.length} Positionen` : n.auftrag ? kstTitel(n.auftrag.id) : "Beleg"}</b>
          <span className="kn mu">{n.geraet && n.geraet !== S.session.user.email ? personName(n.geraet) + " · " : ""}
            {n.eingereichtAm ? "eingereicht " + zeitCH(n.eingereichtAm) : "Beleg vom " + langDatum(n.datum)}</span>
        </span>
        <StatusMarke b={n} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", borderTop: "1px solid var(--linie)", paddingTop: 10 }}>
        <span className="kl">{s === "teilweise" || s === "abgelehnt" ? "Gebucht" : "Betrag"}</span>
        <span className="mono" style={{ fontSize: 26, fontWeight: 700 }}>
          {s === "teilweise" || s === "abgelehnt"
            ? <><span className="durch" style={{ fontSize: 14 }}>{chfLang(betrag)}</span> {chfLang(s === "abgelehnt" ? 0 : n.genehmigtBetrag)}</>
            : "CHF " + chfLang(betrag)}</span>
      </div>
      {(stempel || n.entscheidGrund) &&
        <div className="stempel">{n.entscheidGrund && <>„{n.entscheidGrund}“<br /></>}
          <span className="kn mu">{stempel}</span></div>}
    </section>);

  const bild = n.altPfad
    ? (breit
        ? <div className="belegbild" style={{ borderRadius: 12 }}>
            {n.altUrl ? <img src={n.altUrl} alt="Beleg" />
              : <div className="pdfmarke" style={{ width: "100%" }}>{n.altPdf ? "PDF-Beleg — Vorschau lädt …" : "PDF-Beleg hinterlegt"}</div>}
            <button className="link" data-akt="belegAuf" data-p={n.altPfad}>Beleg gross öffnen</button></div>
        : <div className="belegkarte" style={{ padding: "12px 14px" }}>
            {n.altUrl ? <img className="daumen" src={n.altUrl} alt="Beleg" /> : <span className="daumen">PDF</span>}
            <span style={{ flex: 1 }}>Beleg vom {langDatum(n.datum)}</span>
            <button className="k2 klein" data-akt="belegAuf" data-p={n.altPfad}>Öffnen</button></div>)
    : <div className="leer">Kein Beleg hinterlegt.</div>;

  const angaben = (
    <section className="karte huelle">
      {!breit && !panel && bild}
      <div style={!breit && !panel ? { borderTop: "1px solid var(--linie)" } : undefined}>
        {geteilt
          ? n.positionen.map((p, i) => (
              <Zeile key={i} titel={`Position ${i + 1}`}>
                CHF {chfLang(betragVon(p.betragText))} · {p.mwst} %<br />{kontoText(p.konto)}<br />{auftragText(p.auftrag)}
              </Zeile>))
          : umkont ? <>
              <Wahl akt="kontoWahl" titel="Konto" haupt={kt.haupt} neben={kt.neben} />
              <KstWahl konto={n.konto} auftrag={n.auftrag} />
            </>
          : <>
              <Zeile titel="Konto"><span className="mono">{n.konto && n.konto.nummer}</span> {n.konto && n.konto.bezeichnung}</Zeile>
              <Zeile titel="KST">{auftragText(n.auftrag)}</Zeile>
            </>}
        {korr ? <div style={{ padding: "10px 14px", borderTop: "1px solid var(--linie)", display: "flex", flexDirection: "column", gap: 10 }}>
            <div className="zwei">
              <div className="feld"><label htmlFor="korrBetrag">Betrag CHF</label>
                <input id="korrBetrag" type="text" inputMode="decimal" defaultValue={n.korrBetrag} data-feld="korrBetrag"
                       className="mono" style={{ textAlign: "right", fontWeight: 700 }} /></div>
              <div className="feld"><label htmlFor="korrDatum">Belegdatum</label>
                <input id="korrDatum" type="date" defaultValue={n.korrDatum} data-feld="korrDatum" /></div>
            </div>
            <div><span className="lab">MwSt</span>
              <div className="seg">
                {SAETZE.map((m) => <button key={m} className={"mono" + (parseFloat(n.korrMwst) === parseFloat(m) ? " an" : "")}
                                           data-akt="korrMwst" data-v={m}>{m} %</button>)}
              </div></div>
          </div>
          : <>
            {!geteilt && <Zeile titel="MwSt"><span className="mono">{n.mwst} %</span></Zeile>}
            <Zeile titel="Belegdatum"><span className="mono">{langDatum(n.datum)}</span></Zeile>
          </>}
        <Zeile titel="Bezahlt mit">{zahlartName(n.zahlart)}</Zeile>
        {n.zahlgeraet != null && <Zeile titel="Gerät">{geraetName(n.zahlgeraet)}</Zeile>}
        {n.kommentar && <Zeile titel="Kommentar">{n.kommentar}</Zeile>}
        {n.geraet && n.geraet !== S.session.user.email && <Zeile titel="Erfasst von">{personName(n.geraet)}</Zeile>}
      </div>
      {umkont && !geaendert &&
        <div className="kn mu" style={{ padding: "8px 14px 12px", borderTop: "1px solid var(--linie)" }}>
          {korr ? "Betrag, MwSt, Datum, Konto oder KST anpassen — dann speichern und entscheiden."
                : "Konto oder KST antippen, um umzukontieren."}</div>}
      {geaendert &&
        <div style={{ padding: "12px 14px", borderTop: "1px solid var(--linie)", display: "flex", flexDirection: "column", gap: 8 }}>
          {korr ? <Knopf akt="korrigieren" className="k1">Korrektur speichern</Knopf>
                : <Knopf akt="umkontieren" className="k1">Kontierung ändern</Knopf>}
          {kontGeaendert && <span className="kn mu">Bei einer anderen KST geht der Beleg an deren Projektleiter — wieder ungeprüft.</span>}
        </div>}
    </section>);

  const rueckweg = S.istAdmin && s !== "offen" && s !== "abgelehnt" &&
    <section className="karte innen" style={{ gap: 8 }}>
      <b>Admin: Rückweg</b>
      {istEntschieden(n) &&
        <Knopf akt="zuruecksetzen" className="k2" data-v="eingereicht">Entscheid zurücknehmen — neu prüfen</Knopf>}
      <Knopf akt="zuruecksetzen" className="k2" data-v="offen">Zurück auf „erfasst“ — Erfasser kann ändern</Knopf>
    </section>;

  const rechts = <>
    {kopf}
    {n.pruefen && <Entscheid n={n} betrag={betrag} ohneHaupt={panel} />}
    {angaben}
    {n.pruefen
      ? <span className="kn mu">Dein Entscheid wird mit E-Mail und Uhrzeit auf dem Beleg und im PDF vermerkt.</span>
      : !S.istAdmin && <Hinweis>Eingereichte und entschiedene Belege lassen sich nicht mehr ändern. Bei Fragen: Admin.</Hinweis>}
    {rueckweg}
  </>;

  if (breit) return (
    <div className="spalten bild">
      <div className="karte huelle">{bild}</div>
      <div className="spalte" style={{ gap: 14 }}>{rechts}</div>
    </div>);
  return <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>{rechts}</div>;
}

function BelegAnsehen({ n }: { n: any }) {
  const titel = n.pruefen ? "Beleg prüfen" : "Beleg ansehen";
  if (istBreit()) return (
    <Seite titel={titel} pfad={herkunft()} voll
           rechts={<button className="k2 klein" data-akt="zurueck">Schliessen</button>}>
      <Arbeitsplatz woher={S.zurueckZu} n={n} fuss={<NavKnoepfe />}>
        <BelegInhalt n={n} panel />
      </Arbeitsplatz>
    </Seite>);
  return (
    <Seite titel={titel} sub={statusName(n.status)}>
      <BelegInhalt n={n} />
    </Seite>);
}

// Das Entscheid-Feld. Kreditkarte/Bar: Geld ist weg, nur prüfen oder
// vermerken. User-Zahlung (vorkasse): genehmigen, teilweise, ablehnen.
function Entscheid({ n, betrag, ohneHaupt }: { n: any; betrag: number; ohneHaupt?: boolean }) {
  const vorkasse = n.zahlartDb === "vorkasse";
  return (
    <section className="karte innen entscheid" style={{ gap: 12 }}>
      <span style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <b style={{ fontSize: 17 }}>Entscheid</b>
        <span className="kn mu">{vorkasse ? "User-Zahlung — eigenes Geld. Du entscheidest über die Rückerstattung."
                                         : "Firmengeld ist schon ausgegeben — es geht nur um die Richtigkeit."}</span></span>
      {vorkasse ? <>
          {!ohneHaupt && <Knopf akt="entscheid" className="k1 gruen" data-v="genehmigt">Genehmigen · CHF {chfLang(betrag)}</Knopf>}
          <div className="teilbox">
            <span className="kl">Teilweise genehmigen oder ablehnen</span>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input id="egbetrag" type="text" inputMode="decimal" placeholder="45.00" aria-label="Genehmigter Betrag CHF"
                     className="mono" style={{ width: 130, textAlign: "right", fontWeight: 700 }} />
              <span className="mu">von {chfLang(betrag)}</span></div>
            <label htmlFor="egrund" style={{ margin: 0 }}>Kommentar (nötig für teilweise und ablehnen)</label>
            <textarea id="egrund" rows={2} placeholder="z. B. weniger, da Alkohol" />
            <div className="zwei eng">
              <Knopf akt="entscheid" className="k2 fett" data-v="teilweise">Teilweise</Knopf>
              <Knopf akt="entscheid" className="kr" data-v="abgelehnt">Ablehnen</Knopf>
            </div>
          </div>
        </>
        : <>
          {!ohneHaupt && <Knopf akt="entscheid" className="k1 gruen" data-v="geprueft">Geprüft — stimmt</Knopf>}
          <div className="teilbox">
            <label htmlFor="egrund" style={{ margin: 0 }}>Kommentar (nötig für Besprechung)</label>
            <textarea id="egrund" rows={2} placeholder="z. B. Quittung fehlt" />
            <Knopf akt="entscheid" className="k2 fett" data-v="besprechung">Zur Besprechung vermerken</Knopf>
          </div>
        </>}
    </section>);
}

// ---------- Auswahlseiten (Handy) ----------
export function KontoWahl() {
  const sub = S.posIndex != null ? `Position ${S.posIndex + 1}` : `${S.konten.filter((k) => k.aktiv !== false).length} Konten`;
  return <Seite titel="Konto wählen" sub={sub}><WahlListe art="konto" seite /></Seite>;
}

export function AuftragWahl() {
  const sub = S.posIndex != null ? `Position ${S.posIndex + 1}` : `aus FileMaker · ${S.auftraege.length} Nummern`;
  return <Seite titel="Kostenstelle wählen" sub={sub}><WahlListe art="auftrag" seite /></Seite>;
}

/* ==========================================================
   Arbeitsplatz am Rechner
   Links die Liste (Freigabe, Meine Belege oder Übersicht), in der Mitte der
   Beleg gross, rechts die Angaben mit fester Fussleiste.
   ========================================================== */

const STATUS_FARBE: Record<string, string> = { erf: "#9ba1bb", ein: "#e8590c", gep: "#4c5fd5",
  bes: "#7a3aa8", gen: "#2e9d4a", abl: "#d64545" };

function ApEintrag({ b, woher, an }: { b: any; woher: string; an: boolean }) {
  const unten = woher === "liste"
    ? `${kurzDatum(b.beleg_datum)} · ${zahlartName(b.zahlart)}`
    : `${personName(b.geraet)} · ${kurzDatum(b.beleg_datum)}`;
  return (
    <button className={"ap-eintrag" + (an ? " an" : "")} data-akt="bearbeiten" data-id={b.id} data-w={woher}
            aria-current={an || undefined}>
      <span className="punkt" style={{ background: STATUS_FARBE[statusKlasse(statusVon(b))] }} />
      <span className="mitte"><b>{belegKopf(b)}</b><span className="kn mu">{unten}</span></span>
      <span className="betragz kn">{chfLang(b.betrag)}</span>
    </button>);
}

function ApListe({ woher }: { woher: string }) {
  const liste = apListe(woher);
  const offenId = S.neu && S.neu.id;
  const an = (b) => String(b.id) === String(offenId);
  if (woher === "freigabe") {
    const fertig = S.erledigtJetzt.filter((b) => imBereich(b));
    const gesamt = fertig.length + liste.length;
    const vk = liste.filter((b) => b.zahlart === "vorkasse"), kb = liste.filter((b) => b.zahlart !== "vorkasse");
    return (
      <div className="ap-liste">
        <div className="ap-listekopf">
          <span className="kn">{fertig.length} von {gesamt} erledigt</span>
          <div className="fortschritt"><div style={{ width: (gesamt ? fertig.length / gesamt * 100 : 0) + "%" }} /></div>
          {darfFreigabeFiltern() && <FreigabeFilter />}
        </div>
        <div className="ap-eintraege">
          {vk.length > 0 && <div className="ap-gruppe">User-Zahlungen</div>}
          {vk.map((b) => <ApEintrag b={b} woher={woher} an={an(b)} key={b.id} />)}
          {kb.length > 0 && <div className="ap-gruppe">Kreditkarte / Bar</div>}
          {kb.map((b) => <ApEintrag b={b} woher={woher} an={an(b)} key={b.id} />)}
          {fertig.length > 0 && <div className="ap-gruppe">Erledigt</div>}
          {fertig.map((b) => (
            <div className="ap-eintrag fertig" key={"f" + b.id}>
              <span className="haken"><Ico n="check" s={16} /></span>
              <span className="mitte"><b>{belegKopf(b)}</b>
                <span className="kn mu">{personName(b.geraet)} · {statusName(b.status)}</span></span>
              <span className="betragz kn">{chfLang(b.betrag)}</span>
            </div>))}
          {!liste.length && !fertig.length &&
            <div className="leer">{freigabeIm().length ? "Nichts für diesen Filter." : "Nichts zu prüfen."}</div>}
        </div>
      </div>);
  }
  return (
    <div className="ap-liste">
      <div className="ap-listekopf">
        <span className="kn"><b>{woher === "uebersicht" ? "Übersicht" : "Meine Belege"}</b> · {liste.length === 1 ? "1 Beleg" : liste.length + " Belege"}</span>
      </div>
      <div className="ap-eintraege">
        {liste.map((b) => <ApEintrag b={b} woher={woher} an={an(b)} key={b.id} />)}
        {!liste.length && <div className="leer">Keine Belege.</div>}
      </div>
    </div>);
}

// Der Beleg in der Mitte — gross, wie ein Blatt Papier
function ApBeleg({ n }: { n: any }) {
  // Prüfer ändern keine fremden Belegdateien
  const aenderbar = !n.pruefen && (!n.id || !istGesperrt(n));
  const bild = n.datei ? n.vorschau : n.altUrl;
  const hat = !!(n.datei || n.altPfad);
  return (
    <div className="ap-beleg ablage">
      {!hat && !aenderbar
        ? <div className="ablagegross klein ruhig"><b>Kein Beleg hinterlegt</b>
            <span className="mu">Zu diesem Beleg gibt es keine Datei.</span></div>
        : !hat
        ? <div className="ablagegross klein">
            <span className="symbol"><Ico n="doc" s={26} /></span>
            <b>Kein Beleg hinterlegt</b>
            <span className="mu">Ziehe ein PDF oder Bild hierher oder wähle eine Datei aus.</span>
            <button className="k1 klein" data-akt="waehlen">Beleg auswählen …</button>
          </div>
        : bild ? <img className="papier" src={bild} alt="Beleg"
                      style={{ width: `calc(min(820px, 100%) * ${S.zoom / 100})` }} />
        : <div className="pdfmarke papierleer">{n.datei ? "PDF: " + n.datei.name
            : n.altPdf ? "PDF-Beleg — Vorschau lädt …" : "PDF-Beleg hinterlegt"}</div>}
      {/* Leiste unten: Zoom mit Regler, öffnen, ersetzen */}
      {hat &&
        <div className="ap-zoom" role="group" aria-label="Beleg">
          {bild && <>
            <button className="pf" data-akt="zoom" data-v="-" aria-label="Verkleinern" disabled={S.zoom <= 50}>−</button>
            <input type="range" min={50} max={400} step={10} value={S.zoom} data-feld="zoom" aria-label="Zoom"
                   onChange={() => { /* läuft über data-feld */ }} />
            <button className="pf" data-akt="zoom" data-v="+" aria-label="Vergrössern" disabled={S.zoom >= 400}>+</button>
            <span className="mono kn">{S.zoom} %</span>
            <button className="link" data-akt="zoom" data-v="fit" disabled={S.zoom === 100}>Einpassen</button>
          </>}
          {n.altPfad && !n.datei && <>
            <button className="link" data-akt="belegAuf" data-p={n.altPfad} title="In neuem Fenster öffnen">Öffnen</button></>}
          {aenderbar && <><button className="link" data-akt="belegNeu">Ersetzen</button></>}
        </div>}
      <div className="ziehhinweis">Datei hier ablegen</div>
    </div>);
}

// ‹ › durch die Liste links
export const NavKnoepfe = () => <span className="ap-nav">
  <button className="pf" data-akt="apNav" data-v="-1" aria-label="Vorheriger Beleg">‹</button>
  <button className="pf" data-akt="apNav" data-v="1" aria-label="Nächster Beleg">›</button>
</span>;

export function Arbeitsplatz({ woher, n, fuss, children }: { woher: string | null; n: any; fuss?: any; children: any }) {
  return (
    <div className={"arbeitsplatz" + (woher ? "" : " ohneliste")}>
      {woher && <ApListe woher={woher} />}
      {n ? <ApBeleg n={n} /> : <div className="ap-beleg"><div className="leer">Links einen Beleg wählen.</div></div>}
      <div className="ap-panel">
        <div className="ap-panelinhalt" key={n ? schluessel(n) : "leer"}><Meldung />{children}</div>
        {fuss && <div className="ap-fuss">{fuss}</div>}
      </div>
    </div>);
}

// Freigabe am Rechner: Liste mit Fortschritt, Beleg, Entscheid.
// Unten: zurück, überspringen und der Hauptentscheid.
export function FreigabePlatz() {
  const n = S.neu && S.neu.id && S.neu.pruefen ? S.neu : null;
  const liste = freigabeGefiltert();
  const titel = "Freigabe" + (S.bereich ? " · " + BEREICH_NAME[S.bereich] : "");
  const sub = liste.length === 1 ? "1 Freigabe offen" : `${liste.length} Freigaben offen`;
  if (!freigabeIm().length && !n) {
    const fertig = S.erledigtJetzt.filter((b) => imBereich(b)).length;
    return (
      <Seite titel={titel} pfad={sub} tab>
        <div className="ablageflaeche">
          <div className="ablagegross ruhig">
            <span className="symbol gruen"><Ico n="check" s={26} /></span>
            <h2>Alles erledigt</h2>
            <span className="mu">{fertig ? `${fertig} von ${fertig} entschieden. ` : ""}Hier wartet nichts mehr auf dich.</span>
            <button className="k2 klein" data-akt="tabUebersicht" data-b={S.bereich || undefined}>Zur Übersicht</button>
          </div>
        </div>
      </Seite>);
  }
  const vorkasse = n && n.zahlartDb === "vorkasse";
  const betrag = n ? (Array.isArray(n.positionen) ? positionenSumme(n.positionen) : betragVon(n.betragText)) : 0;
  const i = n ? liste.findIndex((b) => String(b.id) === String(n.id)) : -1;
  return (
    <Seite titel={titel} pfad={sub} tab voll>
      <Arbeitsplatz woher="freigabe" n={n}
        fuss={n && <>
          <span className="ap-nav">
            <button className="pf" data-akt="apNav" data-v="-1" aria-label="Vorheriger Beleg" disabled={i <= 0}>‹</button>
          </span>
          <button className="k2 klein" data-akt="apNav" data-v="1" disabled={liste.length < 2}>Überspringen ›</button>
          <Knopf akt="entscheid" className="k1 klein gruen" data-v={vorkasse ? "genehmigt" : "geprueft"}>
            <Ico n="check" s={16} /> {vorkasse ? `Genehmigen · CHF ${chfLang(betrag)}` : "Geprüft — stimmt"}</Knopf>
        </>}>
        {n ? <>
          <span className="kl">Beleg {i + 1} von {liste.length}</span>
          <BelegInhalt n={n} panel />
        </> : <div className="leer">Links einen Beleg wählen.</div>}
      </Arbeitsplatz>
    </Seite>);
}

// Neuer Beleg am Rechner: zuerst nur die grosse Ablage
function Ablage({ n }: { n: any }) {
  return (
    <Seite titel="Beleg erfassen"
           rechts={<button className="k2 klein" data-akt="zurueck">Abbrechen</button>}>
      <div className="ablageflaeche">
        <div className="ablagegross ablage">
          <span className="symbol"><Ico n="doc" s={26} /></span>
          <h2>Beleg erfassen</h2>
          <span className="mu">Ziehe ein PDF oder Bild hierher oder wähle eine Datei aus.</span>
          <button className="k1 klein" data-akt="waehlen">Beleg auswählen …</button>
          {n.konto && n.auftrag &&
            <span className="kn mu" style={{ marginTop: 6 }}>Konto {n.konto.nummer} {n.konto.bezeichnung} und
              KST {n.auftrag.id === OHNE_KST.id ? OHNE_KST.name : n.auftrag.id} sind schon gesetzt.</span>}
        </div>
      </div>
    </Seite>);
}

// Freigabe filtern nach Person, KST, Konto (Supervisor und Admin).
// Die Auswahl zeigt nur, was in der offenen Freigabe vorkommt.
export function FreigabeFilter() {
  const alle = istBreit() ? freigabeIm() : freigabeIm("");
  const werte = (f: (b: any) => string[]) =>
    ([...new Set(alle.flatMap(f))] as string[]).sort((a, c) => String(a).localeCompare(String(c), "de", { numeric: true }));
  const personen = werte((b) => [b.geraet]);
  const kst = werte((b) => belegZeilen(b).map((p) => p.auftrag_nr));
  const konten = werte((b) => belegZeilen(b).map((p) => p.konto_nummer));
  const feld = (f: string, wert: string, alleText: string, liste: string[], name: (x: string) => string) => (
    <select data-feld={f} defaultValue={wert} key={f + wert} aria-label={alleText}>
      <option value="">{alleText}</option>
      {liste.map((x) => <option key={x} value={x}>{name(x)}</option>)}
    </select>);
  const aktiv = S.fPerson || S.fKst || S.fKonto;
  return (
    <div className="freigabefilter">
      {feld("fperson", S.fPerson, "Alle Personen", personen, personName)}
      {feld("fkst", S.fKst, "Alle KST", kst, kstName)}
      {feld("fkonto", S.fKonto, "Alle Konten", konten, (k) => `${k} ${kontoName(k)}`.trim())}
      {aktiv && <button className="link" data-akt="freigabeFilterWeg">Filter zurücksetzen</button>}
    </div>);
}
