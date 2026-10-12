// uebersicht.tsx
// Startseiten: am Handy "Meine Belege" und "Übersicht", am Rechner alles auf
// einer Seite. Dazu die Bausteine Filter, Kontierung, Export, Belegliste.

import { S } from "../zustand";
import {
  st, istBreit, chf, datumCH, kurzName, kurzDatum, monatName, zahlartName, auftragAnzeige,
  ZAHLART, STATUS, MAX_PERIODEN, MAX_KACHELN
} from "../grundlagen";
import {
  kontoName, kontenImZeitraum, auftraegeImZeitraum, uGefiltert, gruppiere, uTitel, uZeitraumText
} from "../daten";
import {
  Kopf, Reiter, Meldung, Knopf, Stift, Hoch, StatusMarke, BetragZelle, KnopfFreigeben,
  belegKopf, belegDetail, belegText
} from "./bausteine";

// Eine gespeicherte Periode als Kachel. Das ✕ muss ein eigener Knopf sein —
// ein Knopf innerhalb eines Knopfes ist in HTML nicht erlaubt.
function PeriodeKachel({ p }: { p: any }) {
  const an = S.uVon === p.von && S.uBis === p.bis;
  return (
    <span style={st("position:relative;flex:1 1 150px;display:flex")}>
      <button data-akt="periodeWahl" data-id={p.id}
        style={{ ...st(`flex:1 1 auto;min-width:0;min-height:54px;border-radius:9px;cursor:pointer;
                 font-family:inherit;font-size:14px;line-height:1.3;text-align:left;
                 padding:6px 30px 6px 12px`),
                 border: `1px solid ${an ? "var(--blau)" : "var(--rand)"}`,
                 background: an ? "var(--blau)" : "#fff", color: an ? "#fff" : "var(--blau)",
                 fontWeight: an ? 700 : 400 }}>
        {p.name}<br />
        <span style={st("font-size:12px;opacity:.85")}>{kurzDatum(p.von)}–{kurzDatum(p.bis)}</span>
      </button>
      <button data-akt="periodeWeg" data-id={p.id} aria-label={`Periode ${p.name} löschen`}
        style={{ ...st(`position:absolute;top:4px;right:4px;width:24px;height:24px;padding:0;
                 border-radius:6px;font-size:13px;line-height:1;font-family:inherit;cursor:pointer`),
                 border: `1px solid ${an ? "rgba(255,255,255,.55)" : "var(--rand)"}`,
                 background: an ? "transparent" : "#fff", color: an ? "#fff" : "var(--grau)" }}>✕</button>
    </span>);
}

// Auswahlfeld, das sich neu aufbaut, wenn sich der Wert von aussen ändert
function Auswahl({ id, feld, wert, children }: { id: string; feld: string; wert: string; children: any }) {
  return <select id={id} data-feld={feld} defaultValue={wert} key={wert}>{children}</select>;
}

function Filter() {
  const geraete   = [...new Set(S.uBelege.map((b) => b.geraet))].sort() as string[];
  const konten    = kontenImZeitraum();
  const auftraege = auftraegeImZeitraum();
  const voll = S.perioden.length >= MAX_PERIODEN;

  return (
    <div className="karte">
      <div className="paar">
        <div style={st("flex:1 1 130px")}>
          <label htmlFor="uvon">Von</label>
          <input id="uvon" type="date" defaultValue={S.uVon} key={"v" + S.uVon} data-feld="uvon" />
        </div>
        <div style={st("flex:1 1 130px")}>
          <label htmlFor="ubis">Bis</label>
          <input id="ubis" type="date" defaultValue={S.uBis} key={"b" + S.uBis} data-feld="ubis" />
        </div>
        <div style={st("flex:0 0 auto;display:flex;flex-direction:column;justify-content:flex-end")}>
          <button data-akt="periodeNeu" title="Diesen Zeitraum als Periode merken"
            aria-label="Diesen Zeitraum als Periode merken" disabled={voll}
            style={{ ...st(`min-height:46px;min-width:46px;border:1px solid var(--blau);
                     border-radius:10px;background:#fff;color:var(--blau);
                     font-size:20px;line-height:1;font-family:inherit;cursor:pointer`),
                     opacity: voll ? .4 : 1 }}>+</button>
        </div>
      </div>

      {S.perioden.length ? <>
        <div style={st("display:flex;gap:8px;flex-wrap:wrap;margin-top:10px")}>
          {S.perioden.map((p) => <PeriodeKachel key={p.id} p={p} />)}
        </div>
        {voll &&
          <div style={st("font-size:12px;color:var(--grau);line-height:1.45;margin-top:6px")}>
            {MAX_PERIODEN} von {MAX_PERIODEN} belegt — zum Merken zuerst eine über das ✕ löschen.</div>}
      </> :
        <div style={st("font-size:13px;color:var(--grau);line-height:1.45;margin-top:8px")}>
          Noch keine Perioden gemerkt — Zeitraum eintragen und auf + tippen.
          Höchstens {MAX_PERIODEN}, und nur du siehst sie.</div>}

      <div className="paar" style={st("margin-top:10px")}>
        <div>
          <label htmlFor="uzahlart">Zahlungsart</label>
          <Auswahl id="uzahlart" feld="uzahlart" wert={S.uZahlart}>
            <option value="">Alle</option>
            {Object.entries(ZAHLART).map(([w, n]) => <option key={w} value={w}>{n}</option>)}
          </Auswahl>
        </div>
        <div>
          <label htmlFor="ustatus">Status</label>
          <Auswahl id="ustatus" feld="ustatus" wert={S.uStatus}>
            <option value="">Alle</option>
            {Object.entries(STATUS).map(([w, n]) => <option key={w} value={w}>{n}</option>)}
          </Auswahl>
        </div>
        <div>
          <label htmlFor="ukonto">Konto</label>
          <Auswahl id="ukonto" feld="ukonto" wert={S.uKonto}>
            <option value="">Alle Konten</option>
            {konten.map((k) => <option key={k} value={k}>{k}{kontoName(k) ? " " + kontoName(k) : ""}</option>)}
          </Auswahl>
        </div>
        <div>
          <label htmlFor="uauftrag">Auftrag</label>
          <Auswahl id="uauftrag" feld="uauftrag" wert={S.uAuftrag}>
            <option value="">Alle Aufträge</option>
            {auftraege.map((a) => <option key={a} value={a}>{auftragAnzeige(a)}</option>)}
          </Auswahl>
        </div>
        {(S.istAdmin || S.istPruefer) &&
          <div>
            <label htmlFor="ugeraet">Gerät / Karte</label>
            <Auswahl id="ugeraet" feld="ugeraet" wert={S.uGeraet}>
              <option value="">Alle Geräte</option>
              {geraete.map((g) => <option key={g} value={g}>{g}</option>)}
            </Auswahl>
          </div>}
      </div>
    </div>);
}

function Kontierung({ gruppen }: { gruppen: any[] }) {
  const tB = gruppen.reduce((t, g) => t + g.brutto, 0);
  const tS = gruppen.reduce((t, g) => t + g.steuer, 0);
  const tN = gruppen.reduce((t, g) => t + g.netto, 0);
  const tA = gruppen.reduce((t, g) => t + g.anzahl, 0);

  return (
    <div className="karte">
      <div style={st("font-size:17px;font-weight:700;margin-bottom:3px")}>Kontierung</div>
      <div style={st("font-size:13px;color:var(--grau);margin-bottom:12px")}>{uTitel()}</div>
      <div className="rollen"><table>
        <thead><tr>
          <th>Konto</th><th>Bezeichnung</th><th>Auftrag</th><th>MwSt</th><th>Bezahlt</th>
          <th className="re">Posten</th><th className="re">Brutto</th>
          <th className="re">MwSt-Betrag</th><th className="re">Netto</th>
        </tr></thead>
        <tbody>
          {gruppen.map((g, i) => (
            <tr key={i}>
              <td className="gross">{g.konto}</td>
              <td>{g.bezeichnung}</td>
              <td>{auftragAnzeige(g.auftrag)}</td>
              <td>{g.satz} %</td>
              <td>{zahlartName(g.zahlart)}</td>
              <td className="re">{g.anzahl}</td>
              <td className="re gross">{chf(g.brutto)}</td>
              <td className="re">{chf(g.steuer)}</td>
              <td className="re">{chf(g.netto)}</td>
            </tr>))}
          <tr className="summe">
            <td colSpan={5}>Total</td>
            <td className="re">{tA}</td>
            <td className="re">{chf(tB)}</td>
            <td className="re">{chf(tS)}</td>
            <td className="re">{chf(tN)}</td>
          </tr>
        </tbody>
      </table></div>
    </div>);
}

function ExportBlock({ anzahl }: { anzahl: number }) {
  return (
    <div className="karte">
      <div style={st("font-size:16px;font-weight:700;margin-bottom:3px")}>Export für DocuWare</div>
      <div style={st("font-size:13px;color:var(--grau);margin-bottom:12px")}>
        Im PDF steht die Übersicht vorn, danach folgen alle {anzahl} Belege.</div>
      <Knopf akt="expPdf" className="knopf" style={st("margin-bottom:8px")}>PDF erzeugen</Knopf>
      <button className="zweit" data-akt="expCsv">Buchungsliste als CSV</button>
    </div>);
}

// Belegliste. woher steuert, wohin das Bearbeiten zurückkehrt.
function Belege({ liste, woher, titel }: { liste: any[]; woher: string; titel: string }) {
  const breit = istBreit();
  return (
    <div className="karte">
      <div style={st("font-size:17px;font-weight:700;margin-bottom:12px")}>{titel}</div>
      <KnopfFreigeben liste={liste} woher={woher} />
      {liste.length === 0
        ? <div className="leer">Keine Belege für diese Auswahl.</div>
        : liste.map((b, i) => breit ? (
          <div className="belegzeile" key={b.id}>
            <span className="datum">{datumCH(b.beleg_datum)}<br /><StatusMarke b={b} /></span>
            <span className="haupt">{belegText(b)}</span>
            <span className="neben">{b.geraet}</span>
            <span className="neben" style={st("width:100px")}>{zahlartName(b.zahlart)}</span>
            <span className="zahl"><BetragZelle b={b} /></span>
            {b.datei_pfad
              ? <button className="beleglink" data-akt="belegAuf" data-p={b.datei_pfad}>Beleg</button>
              : <span style={st("width:62px")} />}
            <button className="stift" data-akt="bearbeiten" data-id={b.id} data-w={woher}
                    aria-label="Beleg bearbeiten"><Stift /></button>
          </div>) : (
          <div className="zeile" key={b.id} style={st("padding:9px 0;border-bottom:1px solid #EDEFF5;gap:10px")}>
            <div style={st("flex:1 1 auto;min-width:0;overflow-wrap:anywhere")}>
              <div style={st("font-weight:600")}>{i + 1} · {belegKopf(b)} <StatusMarke b={b} /></div>
              <div style={st("font-size:13px;color:var(--grau)")}>
                {belegDetail(b, (S.istAdmin || S.istPruefer) && !S.uGeraet)}</div>
            </div>
            <div style={st("display:flex;align-items:center;gap:8px;flex-shrink:0")}>
              {b.datei_pfad &&
                <button className="beleglink" data-akt="belegAuf" data-p={b.datei_pfad}>Beleg</button>}
              <button className="stift" data-akt="bearbeiten" data-id={b.id} data-w={woher}
                      aria-label="Beleg bearbeiten"><Stift /></button>
              <div style={st("font-weight:700;text-align:right")}><BetragZelle b={b} /></div>
            </div>
          </div>))}
    </div>);
}

function FavoritenBlock() {
  if (S.favoriten.length === 0)
    return <button className="favlink" data-akt="zuFavoriten">Favoriten einrichten</button>;
  return <>
    <span className="abschnitt">FAVORITEN</span>
    <div className="favgitter" style={st("margin-top:8px")}>
      {S.favoriten.slice(0, MAX_KACHELN).map((f) => (
        <button className="favkachel" data-akt="favAnwenden" data-id={f.id} key={f.id}>
          <span className="nam">{f.name}</span>
          <span className="nrn">{f.konto_nummer} · {f.auftrag_nr}</span>
        </button>))}
    </div>
    <button className="favlink" data-akt="zuFavoriten">Favoriten verwalten</button>
  </>;
}

const Ablage = () => (
  <div className="ablagefeld ablage">
    <Hoch />
    <span style={st("font-size:14px;font-weight:700")}>Beleg hierher ziehen</span>
    <span style={st("font-size:12px;color:var(--grau);text-align:center;line-height:1.45")}>
      PDF-Rechnungen von Online-Käufen direkt ablegen</span>
  </div>);

// ---------- Rechner: alles auf einer Seite ----------
export function Desktop() {
  const gefiltert = uGefiltert();
  const gruppen   = gruppiere(gefiltert);
  return <>
    <Kopf titel="Spesen" sub={`${kurzName(S.session.user.email)} · ${uZeitraumText()}`} />
    <div className="inhalt">
      <Meldung />
      <div className="zweispalt">
        <div className="breit">
          <Filter />
          {S.uLaedt ? <div className="karte leer">Lade …</div>
            : gefiltert.length === 0 ? <div className="karte leer">Keine Belege für diese Auswahl.</div>
            : <><Kontierung gruppen={gruppen} /><Belege liste={gefiltert} woher="desktop" titel="Belege" /></>}
        </div>
        <div className="schmal">
          <button className="knopf" data-akt="neu" style={st("margin-bottom:14px")}>Spesen erfassen</button>
          <Ablage />
          <div className="karte"><FavoritenBlock /></div>
          {gefiltert.length > 0 && <ExportBlock anzahl={gefiltert.length} />}
        </div>
      </div>
    </div>
  </>;
}

// ---------- Handy: meine Belege ----------
export function Liste() {
  const summe = S.belege.reduce((t, b) => t + parseFloat(b.betrag), 0);
  return <>
    <Kopf titel="Meine Spesen" sub={`${kurzName(S.session.user.email)} · ${monatName(S.monat)}`} />
    <Reiter />
    <div className="inhalt">
      <Meldung />
      <div className="karte zeile">
        <div><div style={st("font-size:13px;color:var(--grau)")}>Erfasst diesen Monat</div>
             <div style={st("font-size:22px;font-weight:700")}>
               {S.belege.length} {S.belege.length === 1 ? "Beleg" : "Belege"}</div></div>
        <div style={st("text-align:right")}><div style={st("font-size:13px;color:var(--grau)")}>Total</div>
             <div style={st("font-size:22px;font-weight:700")}>CHF {chf(summe)}</div></div>
      </div>

      <button className="knopf" data-akt="neu">Spesen erfassen</button>
      <FavoritenBlock />

      <span className="abschnitt" style={st("padding-top:10px")}>ZULETZT ERFASST</span>
      <div style={st("height:8px")} />
      <KnopfFreigeben liste={S.belege} woher="liste" />

      {S.belege.length === 0
        ? <div className="karte leer">Noch keine Belege in diesem Monat.</div>
        : S.belege.map((b) => (
          <div className="karte zeile" style={st("gap:10px")} key={b.id}>
            <div style={st("flex:1 1 auto;min-width:0;overflow-wrap:anywhere")}>
              <div style={st("font-weight:600")}>{belegKopf(b)} <StatusMarke b={b} /></div>
              <div style={st("font-size:13px;color:var(--grau)")}>{belegDetail(b)}</div>
            </div>
            <div style={st("display:flex;align-items:center;gap:8px;flex-shrink:0")}>
              {b.datei_pfad &&
                <button className="beleglink" data-akt="belegAuf" data-p={b.datei_pfad}>Beleg</button>}
              <button className="stift" data-akt="bearbeiten" data-id={b.id} data-w="liste"
                      aria-label="Beleg bearbeiten"><Stift /></button>
              <div style={st("font-size:17px;font-weight:700;text-align:right")}><BetragZelle b={b} /></div>
            </div>
          </div>))}
    </div>
  </>;
}

// ---------- Handy: Übersicht ----------
export function Uebersicht() {
  const gefiltert = uGefiltert();
  const gruppen   = gruppiere(gefiltert);
  return <>
    <Kopf titel="Übersicht" sub={S.istAdmin ? "Alle Geräte" : kurzName(S.session.user.email)} />
    <Reiter />
    <div className="inhalt">
      <Meldung />
      <Filter />
      {S.uLaedt ? <div className="karte leer">Lade …</div>
        : gefiltert.length === 0 ? <div className="karte leer">Keine Belege für diese Auswahl.</div>
        : <>
            <Kontierung gruppen={gruppen} />
            <ExportBlock anzahl={gefiltert.length} />
            <Belege liste={gefiltert} woher="uebersicht" titel="Einzelne Belege" />
          </>}
    </div>
  </>;
}
