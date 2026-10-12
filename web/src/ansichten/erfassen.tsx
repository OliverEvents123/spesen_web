// erfassen.tsx
// Beleg erfassen und bearbeiten, eingereichte Belege ansehen und prüfen,
// dazu die Auswahlbildschirme für Konto und Auftrag (KST).

import { S, schluessel } from "../zustand";
import {
  st, chf, datumCH, zeitCH, betragVon, statusName, zahlartName, auftragText, istGesperrt,
  istEntschieden, positionenSumme, positionenFertig, ZAHLART, SAETZE, OHNE_KST
} from "../grundlagen";
import { aktiveKonten } from "../daten";
import { Kopf, Knopf, Plus, Stern, StatusMarke, Wahl, stempelText } from "./bausteine";

const kontoText = (k: any) => k ? k.nummer + "  " + (k.bezeichnung || "") : "—";

// Eine Position eines aufgeteilten Belegs: Betrag, Satz, Konto, Auftrag.
function Position({ p, i, anzahl }: { p: any; i: number; anzahl: number }) {
  return (
    <div className="karte" style={st("padding:12px 14px")}>
      <div style={st("display:flex;align-items:center;gap:8px;margin-bottom:10px")}>
        <span style={st("flex-grow:1;font-size:14px;font-weight:700;color:var(--blau)")}>Position {i + 1}</span>
        {anzahl > 1 &&
          <button className="stift" data-akt="posWeg" data-i={i}
                  style={st("color:var(--rot);border-color:#E9C3C0")}
                  aria-label={`Position ${i + 1} entfernen`}>✕</button>}
      </div>

      <div className="paar" style={st("margin-bottom:10px")}>
        <div>
          <label htmlFor={"pb" + i}>Betrag CHF</label>
          <input id={"pb" + i} type="text" inputMode="decimal" autoComplete="off" placeholder="0.00"
                 defaultValue={p.betragText} data-feld="posbetrag" data-i={i} />
        </div>
        <div>
          <label htmlFor={"pm" + i}>MwSt</label>
          <select id={"pm" + i} data-feld="posmwst" data-i={i} defaultValue={p.mwst}>
            {SAETZE.map((m) => <option key={m} value={m}>{m} %</option>)}
          </select>
        </div>
      </div>

      <Wahl akt="kontoWahl" i={i} titel="Konto" offen={!p.konto}
            wert={p.konto ? p.konto.nummer + "  " + p.konto.bezeichnung : "wählen"} />
      <Wahl akt="auftragWahl" i={i} titel="Auftrag" offen={!p.auftrag} wert={auftragText(p.auftrag)} />
    </div>);
}

export function Erfassen() {
  const n = S.neu;
  if (n.id && istGesperrt(n)) return <Gesperrt n={n} key={schluessel(n)} />;
  const bearbeiten = !!n.id;
  const geteilt = Array.isArray(n.positionen);
  const betrag = geteilt ? positionenSumme(n.positionen) : betragVon(n.betragText);
  const hatBeleg = !!(n.datei || n.altPfad);
  const fertig = hatBeleg && (geteilt ? positionenFertig(n.positionen) : (betrag > 0 && n.konto && n.auftrag));

  let belegInhalt = null;
  if (n.datei) {
    belegInhalt = n.vorschau
      ? <img className="vorschau" src={n.vorschau} alt="Belegvorschau" />
      : <div className="pdfmarke">PDF: {n.datei.name}</div>;
  } else if (n.altPfad) {
    belegInhalt = n.altUrl
      ? <img className="vorschau" src={n.altUrl} alt="Beleg" />
      : <div className="pdfmarke">PDF-Beleg hinterlegt</div>;
  }

  const belegKarte = belegInhalt
    ? <div className="karte ablage">
        {belegInhalt}
        <button className="zweit" data-akt="belegNeu" style={st("margin-top:10px")}>Anderen Beleg wählen</button>
        <div className="ziehhinweis">Datei hier ablegen, um sie zu ersetzen</div>
      </div>
    : <div className="karte ablage">
        <div style={st("font-size:13px;color:var(--grau);margin-bottom:10px")}>Beleg</div>
        <button className="knopf" data-akt="foto" style={st("margin-bottom:8px")}>Beleg fotografieren</button>
        <button className="zweit" data-akt="waehlen">PDF oder Bild wählen</button>
        <div style={st("font-size:12px;color:var(--grau);text-align:center;padding-top:8px")}>
          am Rechner auch per Ziehen und Ablegen</div>
        <div className="ziehhinweis">Datei hier ablegen</div>
      </div>;

  // Der Normalfall: ein Betrag, ein Konto, ein Auftrag, vier Sätze.
  const einfachTeil = <>
    <Wahl akt="kontoWahl" titel="Konto" offen={!n.konto}
          wert={n.konto ? n.konto.nummer + "  " + n.konto.bezeichnung : "wählen"} />
    <Wahl akt="auftragWahl" titel="Auftrag" offen={!n.auftrag} wert={auftragText(n.auftrag)} />

    <div className="karte">
      <label htmlFor="betrag">Betrag CHF</label>
      <input id="betrag" className="betrag" type="text" inputMode="decimal" autoComplete="off"
             placeholder="0.00" defaultValue={n.betragText} data-feld="betrag" />
    </div>

    <div className="mwst">
      {SAETZE.map((m) =>
        <button key={m} className={n.mwst === m ? "an" : ""} data-akt="mwst" data-v={m}>{m}{" "}%</button>)}
    </div>

    <button className="favlink" data-akt="aufteilen"
            style={st("display:flex;align-items:center;justify-content:center;gap:8px")}>
      <Plus /> Mehrere MwSt-Sätze auf diesem Beleg</button>
  </>;

  // Aufgeteilt: je Position ein vollständiges Paket.
  const geteiltTeil = geteilt && <>
    {n.positionen.map((p, i) => <Position key={schluessel(p)} p={p} i={i} anzahl={n.positionen.length} />)}

    <button className="zweit" data-akt="posNeu"
            style={st("display:flex;align-items:center;justify-content:center;gap:8px")}>
      <Plus /> Weitere Position</button>

    <div className="karte zeile" style={st("margin-top:10px")}>
      <div style={st("font-size:14px;color:var(--grau)")}>Beleg gesamt</div>
      <div style={st("font-size:22px;font-weight:700")}>CHF {chf(betrag)}</div>
    </div>

    <button className="favlink" data-akt="aufteilenWeg">Aufteilung aufheben</button>
  </>;

  return <>
    <Kopf titel={bearbeiten ? "Beleg bearbeiten" : "Beleg erfassen"}
          sub={geteilt ? `${n.positionen.length} Positionen`
                       : (bearbeiten ? "Werte ändern und speichern" : "Angaben prüfen und speichern")}
          zurueck />
    <div className="inhalt" style={st("max-width:620px")} key={schluessel(n)}>
      {n.status === "abgelehnt" &&
        <div className="fehler" style={st("line-height:1.5")}>
          <b>Abgelehnt</b>{n.entscheidVon ? " von " + n.entscheidVon : ""}
          {n.entscheidAm ? " · " + zeitCH(n.entscheidAm) : ""}<br />
          „{n.entscheidGrund}“<br />
          <span style={st("font-size:13px")}>Korrigieren und neu zur Prüfung freigeben — oder löschen.</span>
        </div>}
      {belegKarte}

      {geteilt ? geteiltTeil : einfachTeil}

      <div className="karte">
        <div className="paar">
          <div>
            <label htmlFor="datum">Belegdatum</label>
            <input id="datum" type="date" defaultValue={n.datum} data-feld="datum" />
          </div>
          <div>
            <label htmlFor="zahlart">Bezahlt mit</label>
            <select id="zahlart" data-feld="zahlart" defaultValue={n.zahlart}>
              {Object.entries(ZAHLART).map(([w, t]) => <option key={w} value={w}>{t}</option>)}
            </select>
          </div>
        </div>
      </div>

      <Knopf akt="speichern" className="knopf" disabled={!fertig}>
        {fertig ? (bearbeiten ? "Änderungen speichern" : "Speichern")
                : "Beleg, Konto, Auftrag und Betrag nötig"}</Knopf>

      <Knopf akt="speichernFrei" className="zweit" disabled={!fertig} style={st("margin-top:10px")}>
        Speichern und zur Prüfung freigeben</Knopf>

      {bearbeiten && !geteilt && n.konto && n.auftrag &&
        <button className="zweit" data-akt="favMerken"
                style={st("margin-top:10px;display:flex;align-items:center;justify-content:center;gap:9px")}>
          <Stern /> Als Favorit merken</button>}

      {bearbeiten && <Knopf akt="loeschen" className="loeschen">Diesen Beleg löschen</Knopf>}
    </div>
  </>;
}

// Eine Zeile "Titel ……… Wert" in der Leseansicht
const Zeile = ({ titel, children }: { titel: string; children?: any }) => (
  <div className="zeile" style={st("padding:7px 0;border-bottom:1px solid #EDEFF5;gap:12px")}>
    <span style={st("color:var(--grau);font-size:14px")}>{titel}</span>
    <span style={st("font-weight:600;text-align:right;overflow-wrap:anywhere")}>{children}</span>
  </div>);

// Eingereichter oder entschiedener Beleg: nur noch lesen. Mit Stempel.
// Aus der Freigabeliste geöffnet (n.pruefen) kommt das Entscheid-Feld dazu.
// Admins haben den Rückweg.
function Gesperrt({ n }: { n: any }) {
  const geteilt = Array.isArray(n.positionen);
  const betrag  = geteilt ? positionenSumme(n.positionen) : betragVon(n.betragText);

  const beleg = n.altPfad
    ? <>
        {n.altUrl ? <img className="vorschau" src={n.altUrl} alt="Beleg" />
                  : <div className="pdfmarke">PDF-Beleg hinterlegt</div>}
        <button className="zweit" data-akt="belegAuf" data-p={n.altPfad} style={st("margin-top:10px")}>
          Beleg öffnen</button>
      </>
    : <div className="leer">Kein Beleg hinterlegt.</div>;

  // Kontierung: beim Prüfen eines einfachen Belegs anklickbar (umkontieren)
  const umkont = n.pruefen && !geteilt;
  const geaendert = umkont && n.konto && n.auftrag &&
    (n.konto.nummer !== n.kontoAlt || n.auftrag.id !== n.auftragAlt);
  const kontierung = geteilt
    ? n.positionen.map((p, i) => (
        <Zeile key={i} titel={`Position ${i + 1}`}>
          CHF {chf(betragVon(p.betragText))} · {p.mwst} %<br />
          {kontoText(p.konto)}<br />{auftragText(p.auftrag)}
        </Zeile>))
    : umkont ? <>
        <Wahl akt="kontoWahl" titel="Konto" wert={kontoText(n.konto)} style={st("margin:0 0 8px")} />
        <Wahl akt="auftragWahl" titel="KST" wert={auftragText(n.auftrag)} style={st("margin:0 0 8px")} />
        {geaendert && <>
          <Knopf akt="umkontieren" className="knopf" style={st("margin-bottom:10px")}>Kontierung ändern</Knopf>
          <div style={st("font-size:13px;color:var(--grau);line-height:1.45;margin-bottom:10px")}>
            Bei einer anderen KST geht der Beleg an deren Projektleiter — wieder ungeprüft.</div>
        </>}
        <Zeile titel="MwSt">{n.mwst} %</Zeile>
      </>
    : <>
        <Zeile titel="Konto">{kontoText(n.konto)}</Zeile>
        <Zeile titel="KST">{auftragText(n.auftrag)}</Zeile>
        <Zeile titel="MwSt">{n.mwst} %</Zeile>
      </>;

  const s = n.status;
  const stempel = stempelText(n);

  return <>
    <Kopf titel={n.pruefen ? "Beleg prüfen" : "Beleg ansehen"} sub={statusName(s)} zurueck />
    <div className="inhalt" style={st("max-width:620px")}>
      <div className="ok" style={st("background:#EEF3FA;border-color:#C9D8EE;color:var(--dunkel);line-height:1.5")}>
        <StatusMarke b={n} />
        {n.eingereichtAm &&
          <span style={st("font-size:13px")}> · eingereicht am {zeitCH(n.eingereichtAm)}</span>}
        {stempel && <div className="stempel">{stempel}</div>}
        {s === "teilweise" &&
          <div style={st("font-weight:700")}>Genehmigt: CHF {chf(n.genehmigtBetrag)} von {chf(betrag)}</div>}
        {n.entscheidGrund && <div>„{n.entscheidGrund}“</div>}
      </div>

      {n.pruefen && <Entscheid n={n} betrag={betrag} />}

      <div className="karte ablage">{beleg}</div>

      <div className="karte">
        {kontierung}
        <Zeile titel="Betrag">CHF {chf(betrag)}</Zeile>
        <Zeile titel="Belegdatum">{datumCH(n.datum)}</Zeile>
        <Zeile titel="Bezahlt mit">{zahlartName(n.zahlart)}</Zeile>
        {n.geraet && n.geraet !== S.session.user.email && <Zeile titel="Erfasst von">{n.geraet}</Zeile>}
      </div>

      {S.istAdmin && s !== "offen" && s !== "abgelehnt" &&
        <div className="karte">
          <div style={st("font-size:14px;font-weight:700;margin-bottom:8px")}>Admin: Rückweg</div>
          {istEntschieden(n) &&
            <Knopf akt="zuruecksetzen" className="zweit" data-v="eingereicht" style={st("margin-bottom:8px")}>
              Entscheid zurücknehmen — neu prüfen</Knopf>}
          <Knopf akt="zuruecksetzen" className="zweit" data-v="offen">
            Zurück auf „erfasst“ — Erfasser kann ändern</Knopf>
        </div>}
    </div>
  </>;
}

// Das Entscheid-Feld. Kreditkarte/Bar: Geld ist weg, nur prüfen oder
// vermerken. Vorauskasse: genehmigen, teilweise, ablehnen.
function Entscheid({ n, betrag }: { n: any; betrag: number }) {
  const vorkasse = n.zahlartDb === "vorkasse";
  return (
    <div className="karte" style={st("border:2px solid var(--blau)")}>
      <div style={st("font-size:16px;font-weight:700;margin-bottom:4px")}>Entscheid</div>
      <div style={st("font-size:13px;color:var(--grau);line-height:1.45;margin-bottom:12px")}>
        {vorkasse ? "Vorauskasse — eigenes Geld. Du entscheidest über die Rückerstattung."
                  : "Firmengeld ist schon ausgegeben — es geht nur um die Richtigkeit."}</div>

      {vorkasse ? <>
          <Knopf akt="entscheid" className="knopf" data-v="genehmigt" style={st("margin-bottom:8px")}>
            Genehmigen — CHF {chf(betrag)}</Knopf>
          <label htmlFor="egbetrag" style={st("margin-top:6px")}>Teilweise: genehmigter Betrag CHF</label>
          <input id="egbetrag" type="text" inputMode="decimal" placeholder="z. B. 45.00"
                 style={st("margin-bottom:8px")} />
        </>
        : <Knopf akt="entscheid" className="knopf" data-v="geprueft" style={st("margin-bottom:8px")}>
            Geprüft — stimmt</Knopf>}

      <label htmlFor="egrund" style={st("margin-top:6px")}>
        Kommentar {vorkasse ? "(nötig für teilweise und ablehnen)" : "(nötig für Besprechung)"}</label>
      <textarea id="egrund" rows={2}
                style={st("width:100%;margin-bottom:10px;font:inherit;padding:10px;border:1px solid var(--rand);border-radius:10px")}
                placeholder={vorkasse ? "z. B. weniger, da Alkohol" : "z. B. Quittung fehlt"} />

      {vorkasse ? <>
          <Knopf akt="entscheid" className="zweit" data-v="teilweise" style={st("margin-bottom:8px")}>
            Teilweise genehmigen</Knopf>
          <Knopf akt="entscheid" className="loeschen" data-v="abgelehnt" style={st("margin-top:0")}>
            Ablehnen</Knopf>
        </>
        : <Knopf akt="entscheid" className="zweit" data-v="besprechung">Zur Besprechung vermerken</Knopf>}
    </div>);
}

// ---------- Auswahlbildschirme ----------
// Zielt die Auswahl auf eine Position, auf den ganzen Beleg oder auf einen Favoriten?
function wahlZiel() {
  if (S.favEdit) return S.favEdit;
  if (S.neu && S.posIndex != null && Array.isArray(S.neu.positionen)) return S.neu.positionen[S.posIndex];
  return S.neu;
}

export function KontoWahl() {
  const liste = aktiveKonten();
  const ziel = wahlZiel();
  const gewaehlt = ziel ? ziel.konto : null;
  const sub = S.posIndex != null ? `Position ${S.posIndex + 1}` : `${liste.length} Konten`;
  return <>
    <Kopf titel="Konto wählen" sub={sub} zurueck />
    <div className="inhalt" style={st("max-width:620px")}>
      {liste.length === 0
        ? <div className="karte leer">Keine aktiven Konten. Unter Admin → Konten anlegen.</div>
        : liste.map((k) => (
          <button key={k.nummer} className={"eintrag" + (gewaehlt && gewaehlt.nummer === k.nummer ? " an" : "")}
                  data-akt="kontoSet" data-nr={k.nummer}>
            <span className="nr">{k.nummer}</span>
            <span className="nm">{k.bezeichnung}</span>
            <span className="marke">{k.mwst} %</span>
          </button>))}
    </div>
  </>;
}

export function AuftragWahl() {
  const sub = S.posIndex != null ? `Position ${S.posIndex + 1}` : `${S.auftraege.length} Nummern`;
  const q = S.suche.trim().toLowerCase();
  const ziel = wahlZiel();
  const gewaehlt = ziel ? ziel.auftrag : null;
  const passt = (a) => !q || String(a.id).toLowerCase().includes(q)
                          || String(a.name || "").toLowerCase().includes(q);
  // "ohne KST" steht immer zuoberst — auch wenn FileMaker nichts geliefert hat.
  const liste = [...(passt(OHNE_KST) ? [OHNE_KST] : []), ...S.auftraege.filter(passt).slice(0, 60)];

  return <>
    <Kopf titel="Auftrag wählen" sub={sub} zurueck />
    <div className="inhalt" style={st("max-width:620px")}>
      <input id="suche" type="search" placeholder="Nummer oder Name suchen" defaultValue={S.suche}
             data-feld="suche" style={st("margin-bottom:12px")} />
      {!S.auftraege.length &&
        <div className="fehler">Die Auftragsnummern konnten nicht aus FileMaker geladen
          werden. Seite neu laden oder später nochmal versuchen.</div>}
      {liste.length === 0
        ? <div className="karte leer">Nichts gefunden.</div>
        : liste.map((a: any) => (
          <button key={a.id} className={"eintrag" + (gewaehlt && gewaehlt.id === a.id ? " an" : "")}
                  data-akt="auftragSet" data-id={a.id}>
            <span className="nr">{a.id === OHNE_KST.id ? "—" : a.id}</span>
            <span className="nm">{a.name}</span>
            {a.fix ? <span className="marke">fest</span> : (a.immer ? <span className="marke">fix</span> : null)}
          </button>))}
    </div>
  </>;
}
