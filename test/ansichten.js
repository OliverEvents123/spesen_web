// ansichten.js
// Alle Bildschirme der App, aus wiederverwendbaren Bausteinen zusammengesetzt.
// Am Handy je ein Bildschirm, ab 900 px zweispaltig auf einer Seite.
// Klicks werden über data-akt="..." an app.js gemeldet.

function render() {
  const breit = istBreit();

  if (S.ansicht === "erfassen")    return renderErfassen();
  if (S.ansicht === "kontoWahl")   return renderKontoWahl();
  if (S.ansicht === "auftragWahl") return renderAuftragWahl();
  if (S.ansicht === "passwort")    return renderPasswort();
  if (S.ansicht === "favoriten")   return renderFavoriten();
  if (S.ansicht === "favForm")     return renderFavForm();
  if (S.ansicht === "freigabe")    return renderFreigabe();
  if (S.ansicht === "zuweisungen") return renderZuweisungen();

  if (S.ansicht === "benutzer" || S.ansicht === "benForm") {
    if (breit) return renderBenutzerBreit();
    return S.ansicht === "benForm" ? renderBenForm() : renderBenutzer();
  }

  if (S.ansicht === "konten" || S.ansicht === "kontoForm") {
    if (breit) return renderKontenBreit();
    return S.ansicht === "kontoForm" ? renderKontoForm() : renderKonten();
  }

  if (breit) return renderDesktop();
  return S.ansicht === "uebersicht" ? renderUebersicht() : renderListe();
}

// ---------- Kopf ----------
// zurueck = Pfeil links. auchKnoepfe = Pfeil UND die Knöpfe rechts,
// das brauchen die Admin-Seiten.
function kopf(titel, sub, zurueck, auchKnoepfe) {
  const adminAn = ["benutzer","benForm","konten","kontoForm","zuweisungen"]
                    .includes(S.ansicht) ? "an" : "";
  // Am Rechner gibt es keine Reiter — die Freigabe steht oben rechts.
  const freiAn = S.ansicht === "freigabe" ? "an" : "";
  const knoepfe = `<div class="kopfknoepfe">
      ${S.istPruefer && istBreit() ? `<button class="${freiAn}" data-akt="tabFreigabe"
          >Freigabe${S.freigabe.length ? " (" + S.freigabe.length + ")" : ""}</button>` : ""}
      ${S.istAdmin ? `<button class="${adminAn}" data-akt="tabBenutzer">Admin</button>` : ""}
      <button data-akt="zuPasswort">Passwort</button>
      <button data-akt="abmelden">Abmelden</button>
    </div>`;
  return `<div class="kopf">
    ${zurueck ? `<button class="rund" data-akt="zurueck" aria-label="Zurück">‹</button>` : ""}
    <div class="wachs"><h1>${esc(titel)}</h1><div class="sub">${esc(sub)}</div></div>
    ${(!zurueck || auchKnoepfe) ? knoepfe : ""}
  </div>`;
}

// Reiter nur am Handy — am Rechner steht ohnehin alles nebeneinander
function reiter() {
  if (istBreit()) return "";
  return `<div class="reiter">
    <button class="${S.ansicht==="liste"?"an":""}" data-akt="tabListe">Meine Belege</button>
    <button class="${S.ansicht==="uebersicht"?"an":""}" data-akt="tabUebersicht">Übersicht</button>
    ${S.istPruefer ? `<button class="${S.ansicht==="freigabe"?"an":""}" data-akt="tabFreigabe"
        >Freigabe${S.freigabe.length ? " (" + S.freigabe.length + ")" : ""}</button>` : ""}
  </div>`;
}

// Reiter der Admin-Seite — auf Handy und Rechner gleichermassen
function adminReiter() {
  const ben = (S.ansicht==="benutzer" || S.ansicht==="benForm") ? "an" : "";
  const kon = (S.ansicht==="konten"   || S.ansicht==="kontoForm") ? "an" : "";
  const zuw = S.ansicht==="zuweisungen" ? "an" : "";
  return `<div class="reiter">
    <button class="${ben}" data-akt="tabBenutzer">Benutzer</button>
    <button class="${kon}" data-akt="tabKonten">Konten</button>
    <button class="${zuw}" data-akt="tabZuweisungen">Zuweisungen</button>
  </div>`;
}

// ---------- Anmeldung ----------
function zeigeLogin(meldung) {
  app.innerHTML = `
    <div class="mitte"><div class="karte">
      <h1 style="margin:0 0 4px; font-size:24px;">Spesen</h1>
      <p style="margin:0 0 18px; color:var(--grau); font-size:14px;">Bitte anmelden</p>
      ${meldung ? `<div class="fehler">${esc(meldung)}</div>` : ""}
      <form id="f">
        <label for="mail">E-Mail</label>
        <input id="mail" type="email" inputmode="email" autocomplete="username" required
               style="margin-bottom:12px">
        <label for="pw">Passwort</label>
        <input id="pw" type="password" autocomplete="current-password" required
               style="margin-bottom:18px">
        <button class="knopf" id="btn" type="submit">Anmelden</button>
      </form>
    </div></div>`;

  document.getElementById("f").addEventListener("submit", async (e) => {
    e.preventDefault();
    const b = document.getElementById("btn"); b.disabled = true; b.textContent = "Moment …";
    let data, error;
    try {
      ({ data, error } = await sb.auth.signInWithPassword({
        email: document.getElementById("mail").value.trim(),
        password: document.getElementById("pw").value }));
    } catch (err) { zeigeLogin(NETZTEXT); return; }
    if (error) {
      zeigeLogin(istNetzfehler(error) ? NETZTEXT
                 : "Anmeldung fehlgeschlagen. E-Mail oder Passwort stimmt nicht.");
      return;
    }
    S.session = data.session;
    await ladeAlles();
    if (istBreit()) await ladeUebersicht(true); else render();
  });
}

/* ==========================================================
   Bausteine — werden von Handy und Rechner gleichermassen benutzt
   ========================================================== */

// Eine gespeicherte Periode als Kachel. Das ✕ muss ein eigener Knopf sein —
// ein Knopf innerhalb eines Knopfes ist in HTML nicht erlaubt.
function periodeKachel(p) {
  const an = (S.uVon === p.von && S.uBis === p.bis);
  return `<span style="position:relative;flex:1 1 150px;display:flex;">
    <button data-akt="periodeWahl" data-id="${p.id}"
      style="flex:1 1 auto;min-width:0;min-height:54px;border-radius:9px;cursor:pointer;
             font-family:inherit;font-size:14px;line-height:1.3;text-align:left;
             padding:6px 30px 6px 12px;
             border:1px solid ${an ? "var(--blau)" : "var(--rand)"};
             background:${an ? "var(--blau)" : "#fff"};
             color:${an ? "#fff" : "var(--blau)"};
             font-weight:${an ? "700" : "400"};">
      ${esc(p.name)}<br>
      <span style="font-size:12px;opacity:.85;">${kurzDatum(p.von)}–${kurzDatum(p.bis)}</span>
    </button>
    <button data-akt="periodeWeg" data-id="${p.id}"
      aria-label="Periode ${esc(p.name)} löschen"
      style="position:absolute;top:4px;right:4px;width:24px;height:24px;padding:0;
             border-radius:6px;font-size:13px;line-height:1;font-family:inherit;cursor:pointer;
             border:1px solid ${an ? "rgba(255,255,255,.55)" : "var(--rand)"};
             background:${an ? "transparent" : "#fff"};
             color:${an ? "#fff" : "var(--grau)"};">✕</button>
  </span>`;
}

function blockFilter() {
  const geraete   = [...new Set(S.uBelege.map(b => b.geraet))].sort();
  const konten    = kontenImZeitraum();
  const auftraege = auftraegeImZeitraum();

  return `<div class="karte">
    <div class="paar">
      <div style="flex:1 1 130px;">
        <label for="uvon">Von</label>
        <input id="uvon" type="date" value="${S.uVon}" data-feld="uvon">
      </div>
      <div style="flex:1 1 130px;">
        <label for="ubis">Bis</label>
        <input id="ubis" type="date" value="${S.uBis}" data-feld="ubis">
      </div>
      <div style="flex:0 0 auto;display:flex;flex-direction:column;justify-content:flex-end;">
        <button data-akt="periodeNeu" title="Diesen Zeitraum als Periode merken"
          aria-label="Diesen Zeitraum als Periode merken"
          ${S.perioden.length >= MAX_PERIODEN ? "disabled" : ""}
          style="min-height:46px;min-width:46px;border:1px solid var(--blau);
                 border-radius:10px;background:#fff;color:var(--blau);
                 font-size:20px;line-height:1;font-family:inherit;cursor:pointer;
                 opacity:${S.perioden.length >= MAX_PERIODEN ? ".4" : "1"};">+</button>
      </div>
    </div>

    ${S.perioden.length ? `
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px;">
      ${S.perioden.map(periodeKachel).join("")}
    </div>
    ${S.perioden.length >= MAX_PERIODEN ? `
    <div style="font-size:12px;color:var(--grau);line-height:1.45;margin-top:6px;">
      ${MAX_PERIODEN} von ${MAX_PERIODEN} belegt — zum Merken zuerst eine über das ✕ löschen.
    </div>` : ""}` : `
    <div style="font-size:13px;color:var(--grau);line-height:1.45;margin-top:8px;">
      Noch keine Perioden gemerkt — Zeitraum eintragen und auf + tippen.
      Höchstens ${MAX_PERIODEN}, und nur du siehst sie.</div>`}

    <div class="paar" style="margin-top:10px;">
      <div>
        <label for="uzahlart">Zahlungsart</label>
        <select id="uzahlart" data-feld="uzahlart">
          <option value="" ${S.uZahlart===""?"selected":""}>Alle</option>
          ${Object.entries(ZAHLART).map(([w,n]) =>
            `<option value="${w}" ${S.uZahlart===w?"selected":""}>${n}</option>`).join("")}
        </select>
      </div>
      <div>
        <label for="ustatus">Status</label>
        <select id="ustatus" data-feld="ustatus">
          <option value="" ${S.uStatus===""?"selected":""}>Alle</option>
          ${Object.entries(STATUS).map(([w,n]) =>
            `<option value="${w}" ${S.uStatus===w?"selected":""}>${n}</option>`).join("")}
        </select>
      </div>
      <div>
        <label for="ukonto">Konto</label>
        <select id="ukonto" data-feld="ukonto">
          <option value="">Alle Konten</option>
          ${konten.map(k => `<option value="${esc(k)}" ${S.uKonto===k?"selected":""}
            >${esc(k)}${kontoName(k) ? " " + esc(kontoName(k)) : ""}</option>`).join("")}
        </select>
      </div>
      <div>
        <label for="uauftrag">Auftrag</label>
        <select id="uauftrag" data-feld="uauftrag">
          <option value="">Alle Aufträge</option>
          ${auftraege.map(a => `<option value="${esc(a)}" ${S.uAuftrag===a?"selected":""}
            >${esc(auftragAnzeige(a))}</option>`).join("")}
        </select>
      </div>
      ${S.istAdmin || S.istPruefer ? `
      <div>
        <label for="ugeraet">Gerät / Karte</label>
        <select id="ugeraet" data-feld="ugeraet">
          <option value="">Alle Geräte</option>
          ${geraete.map(g => `<option value="${esc(g)}"
              ${S.uGeraet===g?"selected":""}>${esc(g)}</option>`).join("")}
        </select>
      </div>` : ""}
    </div>
  </div>`;
}

function blockKontierung(gruppen) {
  const tB = gruppen.reduce((t,g) => t + g.brutto, 0);
  const tS = gruppen.reduce((t,g) => t + g.steuer, 0);
  const tN = gruppen.reduce((t,g) => t + g.netto,  0);
  const tA = gruppen.reduce((t,g) => t + g.anzahl, 0);

  return `<div class="karte">
    <div style="font-size:17px;font-weight:700;margin-bottom:3px;">Kontierung</div>
    <div style="font-size:13px;color:var(--grau);margin-bottom:12px;">${esc(uTitel())}</div>
    <div class="rollen"><table>
      <thead><tr>
        <th>Konto</th><th>Bezeichnung</th><th>Auftrag</th><th>MwSt</th><th>Bezahlt</th>
        <th class="re">Posten</th><th class="re">Brutto</th>
        <th class="re">MwSt-Betrag</th><th class="re">Netto</th>
      </tr></thead>
      <tbody>
        ${gruppen.map(g => `<tr>
          <td class="gross">${esc(g.konto)}</td>
          <td>${esc(g.bezeichnung)}</td>
          <td>${esc(auftragAnzeige(g.auftrag))}</td>
          <td>${g.satz} %</td>
          <td>${esc(zahlartName(g.zahlart))}</td>
          <td class="re">${g.anzahl}</td>
          <td class="re gross">${chf(g.brutto)}</td>
          <td class="re">${chf(g.steuer)}</td>
          <td class="re">${chf(g.netto)}</td>
        </tr>`).join("")}
        <tr class="summe">
          <td colspan="5">Total</td>
          <td class="re">${tA}</td>
          <td class="re">${chf(tB)}</td>
          <td class="re">${chf(tS)}</td>
          <td class="re">${chf(tN)}</td>
        </tr>
      </tbody>
    </table></div>
  </div>`;
}

function blockExport(anzahl) {
  return `<div class="karte">
    <div style="font-size:16px;font-weight:700;margin-bottom:3px;">Export für DocuWare</div>
    <div style="font-size:13px;color:var(--grau);margin-bottom:12px;">
      Im PDF steht die Übersicht vorn, danach folgen alle ${anzahl} Belege.</div>
    <button class="knopf" data-akt="expPdf" style="margin-bottom:8px;">PDF erzeugen</button>
    <button class="zweit" data-akt="expCsv">Buchungsliste als CSV</button>
  </div>`;
}

// Betrag in Listen. Gekürzt oder abgelehnt: Belegbetrag durchgestrichen,
// darunter, was gebucht wird.
function betragZelle(b) {
  const s = statusVon(b);
  if (s !== "teilweise" && s !== "abgelehnt") return chf(b.betrag);
  return `<s style="color:var(--grau);font-weight:400;font-size:13px;">${chf(b.betrag)}</s><br>`
       + chf(buchungsBetrag(b));
}

// Rollen der Benutzer
const ROLLEN = {
  user:          ["User",          "Sieht und erfasst nur die eigenen Belege."],
  projektleiter: ["Projektleiter", "Prüft und genehmigt die Belege seiner Kostenstellen (unter Zuweisungen)."],
  supervisor:    ["Supervisor",    "Prüft und genehmigt die Belege seiner Konten (unter Zuweisungen) und "
                                 + "die Belege von Benutzern mit eingerichteter Prüfung."],
  admin:         ["Admin",         "Sieht alles, darf alles entscheiden und Benutzer, Konten und Zuweisungen verwalten."]
};
const rolleName = (r) => (ROLLEN[r] || [r])[0];

// Zeitstempel kurz: 09.10.2026, 14:03
const zeitCH = (t) => t ? new Date(t).toLocaleString("de-CH", { day:"2-digit", month:"2-digit",
                            year:"numeric", hour:"2-digit", minute:"2-digit" }) : "";

// Der "Stempel": wer hat wann wie entschieden
function stempelText(n) {
  if (!n.entscheidVon) return "";
  if (n.entscheidVon === "automatisch")
    return `Ohne Prüfung durchgegangen (keine zuständige Person) · ${zeitCH(n.entscheidAm)}`;
  return `${statusName(n.status)} durch ${n.entscheidVon} · ${zeitCH(n.entscheidAm)}`;
}

// Farbige Marke für den Status eines Belegs
const statusMarke = (b) =>
  `<span class="rolle st-${esc(statusVon(b))}">${esc(statusName(statusVon(b)))}</span>`;

// Knopf "erfasste Belege freigeben" — nur wenn es eigene erfasste gibt.
// woher sagt app.js, aus welcher Liste die Belege kommen.
function knopfFreigeben(liste, woher) {
  const n = eigeneErfasste(liste).length;
  if (!n) return "";
  return `<button class="zweit" data-akt="freigebenAlle" data-w="${woher}"
            style="margin-bottom:12px;">
            ${n === 1 ? "1 erfassten Beleg" : n + " erfasste Belege"} zur Prüfung freigeben</button>`;
}

// Am Handy auf zwei Zeilen verteilt: oben das Konto, unten der Rest.
// Eine einzige lange Zeile drückt sonst die Knöpfe rechts aus der Karte.
function belegKopf(b) {
  if (istAufgeteilt(b)) return `Aufgeteilt auf ${b.positionen.length} Positionen` + anteilText(b);
  return `${esc(b.konto_nummer)} ${esc(kontoName(b.konto_nummer))}` + anteilText(b);
}

// Nur ein Teil eines aufgeteilten Belegs passt zum Filter
const anteilText = (b) =>
  b.gesamtBetrag != null ? ` · Anteil von CHF ${chf(b.gesamtBetrag)}` : "";

function belegDetail(b, mitGeraet) {
  const teile = [];
  if (!istAufgeteilt(b)) teile.push(auftragAnzeige(b.auftrag_nr), b.mwst + " %");
  teile.push(datumCH(b.beleg_datum), zahlartName(b.zahlart));
  if (mitGeraet) teile.push(kurzName(b.geraet));
  return esc(teile.join(" · "));
}

// Eine Zeile am Stück — für das Rechner-Layout, dort ist Platz genug
function belegText(b) {
  if (istAufgeteilt(b)) return `Aufgeteilt auf ${b.positionen.length} Positionen` + anteilText(b);
  return `${esc(b.konto_nummer)} ${esc(kontoName(b.konto_nummer))}`
       + ` · ${esc(auftragAnzeige(b.auftrag_nr))} · ${b.mwst} %` + anteilText(b);
}

// Belegliste. woher steuert, wohin das Bearbeiten zurückkehrt.
function blockBelege(liste, woher, titel) {
  const breit = istBreit();
  return `<div class="karte">
    <div style="font-size:17px;font-weight:700;margin-bottom:12px;">${esc(titel)}</div>
    ${knopfFreigeben(liste, woher)}
    ${liste.length === 0
      ? `<div class="leer">Keine Belege für diese Auswahl.</div>`
      : liste.map((b,i) => breit ? `
        <div class="belegzeile">
          <span class="datum">${datumCH(b.beleg_datum)}<br>${statusMarke(b)}</span>
          <span class="haupt">${belegText(b)}</span>
          <span class="neben">${esc(b.geraet)}</span>
          <span class="neben" style="width:100px;">${esc(zahlartName(b.zahlart))}</span>
          <span class="zahl">${betragZelle(b)}</span>
          ${b.datei_pfad ? `<button class="beleglink" data-akt="belegAuf"
              data-p="${esc(b.datei_pfad)}">Beleg</button>`
            : `<span style="width:62px;"></span>`}
          <button class="stift" data-akt="bearbeiten" data-id="${b.id}" data-w="${woher}"
                  aria-label="Beleg bearbeiten">${STIFT}</button>
        </div>` : `
        <div class="zeile" style="padding:9px 0;border-bottom:1px solid #EDEFF5;gap:10px;">
          <div style="flex:1 1 auto;min-width:0;overflow-wrap:anywhere;">
            <div style="font-weight:600;">${i+1} · ${belegKopf(b)} ${statusMarke(b)}</div>
            <div style="font-size:13px;color:var(--grau);">
              ${belegDetail(b, (S.istAdmin || S.istPruefer) && !S.uGeraet)}</div>
          </div>
          <div style="display:flex;align-items:center;gap:8px;flex-shrink:0;">
            ${b.datei_pfad ? `<button class="beleglink" data-akt="belegAuf"
                data-p="${esc(b.datei_pfad)}">Beleg</button>` : ""}
            <button class="stift" data-akt="bearbeiten" data-id="${b.id}" data-w="${woher}"
                    aria-label="Beleg bearbeiten">${STIFT}</button>
            <div style="font-weight:700;text-align:right;">${betragZelle(b)}</div>
          </div>
        </div>`).join("")}
  </div>`;
}

function blockFavoriten() {
  if (S.favoriten.length === 0) {
    return `<button class="favlink" data-akt="zuFavoriten">Favoriten einrichten</button>`;
  }
  const favs = S.favoriten.slice(0, MAX_KACHELN);
  return `
    <span class="abschnitt">FAVORITEN</span>
    <div class="favgitter" style="margin-top:8px;">
      ${favs.map(f => `
        <button class="favkachel" data-akt="favAnwenden" data-id="${f.id}">
          <span class="nam">${esc(f.name)}</span>
          <span class="nrn">${esc(f.konto_nummer)} · ${esc(f.auftrag_nr)}</span>
        </button>`).join("")}
    </div>
    <button class="favlink" data-akt="zuFavoriten">Favoriten verwalten</button>`;
}

function blockAblage() {
  return `<div class="ablagefeld ablage">
    ${HOCH}
    <span style="font-size:14px;font-weight:700;">Beleg hierher ziehen</span>
    <span style="font-size:12px;color:var(--grau);text-align:center;line-height:1.45;">
      PDF-Rechnungen von Online-Käufen direkt ablegen</span>
  </div>`;
}

/* ==========================================================
   Bildschirme
   ========================================================== */

// ---------- Rechner: alles auf einer Seite ----------
function renderDesktop() {
  const gefiltert = uGefiltert();
  const gruppen   = gruppiere(gefiltert);

  app.innerHTML = kopf("Spesen", `${kurzName(S.session.user.email)} · ${uZeitraumText()}`) + `
    <div class="inhalt">
      ${S.meldung ? `<div class="ok">${esc(S.meldung)}</div>` : ""}
      <div class="zweispalt">

        <div class="breit">
          ${blockFilter()}
          ${S.uLaedt ? `<div class="karte leer">Lade …</div>`
            : gefiltert.length === 0
              ? `<div class="karte leer">Keine Belege für diese Auswahl.</div>`
              : blockKontierung(gruppen) + blockBelege(gefiltert, "desktop", "Belege")}
        </div>

        <div class="schmal">
          <button class="knopf" data-akt="neu" style="margin-bottom:14px;">Spesen erfassen</button>
          ${blockAblage()}
          <div class="karte">${blockFavoriten()}</div>
          ${gefiltert.length ? blockExport(gefiltert.length) : ""}
        </div>

      </div>
    </div>`;
  S.meldung = null;
}

// ---------- Handy: meine Belege ----------
function renderListe() {
  const summe = S.belege.reduce((t,b) => t + parseFloat(b.betrag), 0);

  app.innerHTML = kopf("Meine Spesen",
      `${kurzName(S.session.user.email)} · ${monatName(S.monat)}`) + reiter() + `
    <div class="inhalt">
      ${S.meldung ? `<div class="ok">${esc(S.meldung)}</div>` : ""}
      <div class="karte zeile">
        <div><div style="font-size:13px;color:var(--grau);">Erfasst diesen Monat</div>
             <div style="font-size:22px;font-weight:700;">${S.belege.length}
               ${S.belege.length===1?"Beleg":"Belege"}</div></div>
        <div style="text-align:right;"><div style="font-size:13px;color:var(--grau);">Total</div>
             <div style="font-size:22px;font-weight:700;">CHF ${chf(summe)}</div></div>
      </div>

      <button class="knopf" data-akt="neu">Spesen erfassen</button>
      ${blockFavoriten()}

      <span class="abschnitt" style="padding-top:10px;">ZULETZT ERFASST</span>
      <div style="height:8px;"></div>
      ${knopfFreigeben(S.belege, "liste")}

      ${S.belege.length === 0
        ? `<div class="karte leer">Noch keine Belege in diesem Monat.</div>`
        : S.belege.map(b => `
          <div class="karte zeile" style="gap:10px;">
            <div style="flex:1 1 auto;min-width:0;overflow-wrap:anywhere;">
              <div style="font-weight:600;">${belegKopf(b)} ${statusMarke(b)}</div>
              <div style="font-size:13px;color:var(--grau);">${belegDetail(b)}</div>
            </div>
            <div style="display:flex;align-items:center;gap:8px;flex-shrink:0;">
              ${b.datei_pfad ? `<button class="beleglink" data-akt="belegAuf"
                  data-p="${esc(b.datei_pfad)}">Beleg</button>` : ""}
              <button class="stift" data-akt="bearbeiten" data-id="${b.id}" data-w="liste"
                      aria-label="Beleg bearbeiten">${STIFT}</button>
              <div style="font-size:17px;font-weight:700;text-align:right;">${betragZelle(b)}</div>
            </div>
          </div>`).join("")}
    </div>`;
  S.meldung = null;
}

// ---------- Handy: Übersicht ----------
function renderUebersicht() {
  const gefiltert = uGefiltert();
  const gruppen   = gruppiere(gefiltert);

  app.innerHTML = kopf("Übersicht", S.istAdmin ? "Alle Geräte"
                                               : kurzName(S.session.user.email)) + reiter() + `
    <div class="inhalt">
      ${S.meldung ? `<div class="ok">${esc(S.meldung)}</div>` : ""}
      ${blockFilter()}
      ${S.uLaedt ? `<div class="karte leer">Lade …</div>`
        : gefiltert.length === 0
          ? `<div class="karte leer">Keine Belege für diese Auswahl.</div>`
          : blockKontierung(gruppen) + blockExport(gefiltert.length)
            + blockBelege(gefiltert, "uebersicht", "Einzelne Belege")}
    </div>`;
  S.meldung = null;
}

// ---------- Beleg erfassen und bearbeiten ----------

// Eine Position eines aufgeteilten Belegs: Betrag, Satz, Konto, Auftrag.
function blockPosition(p, i, anzahl) {
  return `<div class="karte" style="padding:12px 14px;">
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
      <span style="flex-grow:1;font-size:14px;font-weight:700;color:var(--blau);">
        Position ${i+1}</span>
      ${anzahl > 1 ? `<button class="stift" data-akt="posWeg" data-i="${i}"
          style="color:var(--rot);border-color:#E9C3C0;"
          aria-label="Position ${i+1} entfernen">✕</button>` : ""}
    </div>

    <div class="paar" style="margin-bottom:10px;">
      <div>
        <label for="pb${i}">Betrag CHF</label>
        <input id="pb${i}" type="text" inputmode="decimal" autocomplete="off" placeholder="0.00"
               value="${esc(p.betragText)}" data-feld="posbetrag" data-i="${i}">
      </div>
      <div>
        <label for="pm${i}">MwSt</label>
        <select id="pm${i}" data-feld="posmwst" data-i="${i}">
          ${SAETZE.map(m =>
            `<option value="${m}" ${p.mwst===m?"selected":""}>${m} %</option>`).join("")}
        </select>
      </div>
    </div>

    <button class="wahl ${p.konto ? "" : "offen"}" data-akt="kontoWahl" data-i="${i}">
      <span class="titel">Konto</span>
      <span class="wert" style="color:${p.konto ? "var(--dunkel)" : "var(--warn)"}">
        ${p.konto ? esc(p.konto.nummer + "  " + p.konto.bezeichnung) : "wählen"}</span>
      <span class="pfeil">›</span>
    </button>

    <button class="wahl ${p.auftrag ? "" : "offen"}" data-akt="auftragWahl" data-i="${i}">
      <span class="titel">Auftrag</span>
      <span class="wert" style="color:${p.auftrag ? "var(--dunkel)" : "var(--warn)"}">
        ${esc(auftragText(p.auftrag))}</span>
      <span class="pfeil">›</span>
    </button>
  </div>`;
}

function renderErfassen() {
  const n = S.neu;
  if (n.id && istGesperrt(n)) return renderGesperrt(n);
  const bearbeiten = !!n.id;
  const geteilt = Array.isArray(n.positionen);
  const betrag = geteilt ? positionenSumme(n.positionen) : betragVon(n.betragText);
  const hatBeleg = !!(n.datei || n.altPfad);
  const fertig = hatBeleg && (geteilt ? positionenFertig(n.positionen)
                                      : (betrag > 0 && n.konto && n.auftrag));

  let belegInhalt = null;
  if (n.datei) {
    belegInhalt = n.vorschau
      ? `<img class="vorschau" src="${n.vorschau}" alt="Belegvorschau">`
      : `<div class="pdfmarke">PDF: ${esc(n.datei.name)}</div>`;
  } else if (n.altPfad) {
    belegInhalt = n.altUrl
      ? `<img class="vorschau" src="${n.altUrl}" alt="Beleg">`
      : `<div class="pdfmarke">PDF-Beleg hinterlegt</div>`;
  }

  const belegKarte = belegInhalt
    ? `<div class="karte ablage">
         ${belegInhalt}
         <button class="zweit" data-akt="belegNeu" style="margin-top:10px;">Anderen Beleg wählen</button>
         <div class="ziehhinweis">Datei hier ablegen, um sie zu ersetzen</div>
       </div>`
    : `<div class="karte ablage">
         <div style="font-size:13px;color:var(--grau);margin-bottom:10px;">Beleg</div>
         <button class="knopf" data-akt="foto" style="margin-bottom:8px;">Beleg fotografieren</button>
         <button class="zweit" data-akt="waehlen">PDF oder Bild wählen</button>
         <div style="font-size:12px;color:var(--grau);text-align:center;padding-top:8px;">
           am Rechner auch per Ziehen und Ablegen</div>
         <div class="ziehhinweis">Datei hier ablegen</div>
       </div>`;

  // Der Normalfall: ein Betrag, ein Konto, ein Auftrag, vier Sätze.
  const einfachTeil = `
      <button class="wahl ${n.konto ? "" : "offen"}" data-akt="kontoWahl">
        <span class="titel">Konto</span>
        <span class="wert" style="color:${n.konto ? "var(--dunkel)" : "var(--warn)"}">
          ${n.konto ? esc(n.konto.nummer + "  " + n.konto.bezeichnung) : "wählen"}</span>
        <span class="pfeil">›</span>
      </button>

      <button class="wahl ${n.auftrag ? "" : "offen"}" data-akt="auftragWahl">
        <span class="titel">Auftrag</span>
        <span class="wert" style="color:${n.auftrag ? "var(--dunkel)" : "var(--warn)"}">
          ${esc(auftragText(n.auftrag))}</span>
        <span class="pfeil">›</span>
      </button>

      <div class="karte">
        <label for="betrag">Betrag CHF</label>
        <input id="betrag" class="betrag" type="text" inputmode="decimal"
               autocomplete="off" placeholder="0.00"
               value="${esc(n.betragText)}" data-feld="betrag">
      </div>

      <div class="mwst">
        ${SAETZE.map(m =>
          `<button class="${n.mwst===m?"an":""}" data-akt="mwst" data-v="${m}">${m}&nbsp;%</button>`).join("")}
      </div>

      <button class="favlink" data-akt="aufteilen"
              style="display:flex;align-items:center;justify-content:center;gap:8px;">
        ${PLUS} Mehrere MwSt-Sätze auf diesem Beleg</button>`;

  // Aufgeteilt: je Position ein vollständiges Paket.
  // Nur bauen, wenn es Positionen gibt — sonst greift .map auf null zu.
  const geteiltTeil = !geteilt ? "" : `
      ${n.positionen.map((p,i) => blockPosition(p, i, n.positionen.length)).join("")}

      <button class="zweit" data-akt="posNeu"
              style="display:flex;align-items:center;justify-content:center;gap:8px;">
        ${PLUS} Weitere Position</button>

      <div class="karte zeile" style="margin-top:10px;">
        <div style="font-size:14px;color:var(--grau);">Beleg gesamt</div>
        <div id="gesamt" style="font-size:22px;font-weight:700;">CHF ${chf(betrag)}</div>
      </div>

      <button class="favlink" data-akt="aufteilenWeg">Aufteilung aufheben</button>`;

  app.innerHTML = kopf(bearbeiten ? "Beleg bearbeiten" : "Beleg erfassen",
                       geteilt ? `${n.positionen.length} Positionen`
                               : (bearbeiten ? "Werte ändern und speichern"
                                             : "Angaben prüfen und speichern"), true) + `
    <div class="inhalt" style="max-width:620px;">
      ${n.status === "abgelehnt" ? `
      <div class="fehler" style="line-height:1.5;">
        <b>Abgelehnt</b>${n.entscheidVon ? " von " + esc(n.entscheidVon) : ""}
        ${n.entscheidAm ? " · " + esc(zeitCH(n.entscheidAm)) : ""}<br>
        „${esc(n.entscheidGrund)}“<br>
        <span style="font-size:13px;">Korrigieren und neu zur Prüfung freigeben — oder löschen.</span>
      </div>` : ""}
      ${belegKarte}

      ${geteilt ? geteiltTeil : einfachTeil}

      <div class="karte">
        <div class="paar">
          <div>
            <label for="datum">Belegdatum</label>
            <input id="datum" type="date" value="${n.datum}" data-feld="datum">
          </div>
          <div>
            <label for="zahlart">Bezahlt mit</label>
            <select id="zahlart" data-feld="zahlart">
              ${Object.entries(ZAHLART).map(([w,t]) =>
                `<option value="${w}" ${n.zahlart===w?"selected":""}>${t}</option>`).join("")}
            </select>
          </div>
        </div>
      </div>

      <button class="knopf" data-akt="speichern" ${fertig ? "" : "disabled"}>
        ${fertig ? (bearbeiten ? "Änderungen speichern" : "Speichern")
                 : "Beleg, Konto, Auftrag und Betrag nötig"}</button>

      <button class="zweit" data-akt="speichernFrei" ${fertig ? "" : "disabled"}
              style="margin-top:10px;">Speichern und zur Prüfung freigeben</button>

      ${bearbeiten && !geteilt && n.konto && n.auftrag ? `
        <button class="zweit" data-akt="favMerken" style="margin-top:10px;
                display:flex;align-items:center;justify-content:center;gap:9px;">
          ${STERN} Als Favorit merken</button>` : ""}

      ${bearbeiten ? `<button class="loeschen" data-akt="loeschen">Diesen Beleg löschen</button>` : ""}
    </div>`;
}

// Eingereichter oder entschiedener Beleg: nur noch lesen. Mit Stempel.
// Aus der Freigabeliste geöffnet (n.pruefen) kommt das Entscheid-Feld dazu.
// Admins haben den Rückweg.
function renderGesperrt(n) {
  const geteilt = Array.isArray(n.positionen);
  const betrag  = geteilt ? positionenSumme(n.positionen) : betragVon(n.betragText);
  const zeile = (titel, wert) => `<div class="zeile" style="padding:7px 0;
      border-bottom:1px solid #EDEFF5;gap:12px;">
      <span style="color:var(--grau);font-size:14px;">${titel}</span>
      <span style="font-weight:600;text-align:right;overflow-wrap:anywhere;">${wert}</span></div>`;
  const kontoText = (k) => k ? esc(k.nummer + "  " + (k.bezeichnung || "")) : "—";

  const beleg = n.altPfad
    ? (n.altUrl ? `<img class="vorschau" src="${n.altUrl}" alt="Beleg">`
                : `<div class="pdfmarke">PDF-Beleg hinterlegt</div>`)
      + `<button class="zweit" data-akt="belegAuf" data-p="${esc(n.altPfad)}"
                 style="margin-top:10px;">Beleg öffnen</button>`
    : `<div class="leer">Kein Beleg hinterlegt.</div>`;

  // Kontierung: beim Prüfen eines einfachen Belegs anklickbar (umkontieren)
  const umkont = n.pruefen && !geteilt;
  const geaendert = umkont && n.konto && n.auftrag &&
    (n.konto.nummer !== n.kontoAlt || n.auftrag.id !== n.auftragAlt);
  const kontierung = geteilt
    ? n.positionen.map((p, i) => zeile(`Position ${i+1}`,
        `CHF ${chf(betragVon(p.betragText))} · ${esc(p.mwst)} %<br>
         ${kontoText(p.konto)}<br>${esc(auftragText(p.auftrag))}`)).join("")
    : umkont ? `
        <button class="wahl" data-akt="kontoWahl" style="margin:0 0 8px;">
          <span class="titel">Konto</span>
          <span class="wert">${kontoText(n.konto)}</span><span class="pfeil">›</span></button>
        <button class="wahl" data-akt="auftragWahl" style="margin:0 0 8px;">
          <span class="titel">KST</span>
          <span class="wert">${esc(auftragText(n.auftrag))}</span><span class="pfeil">›</span></button>
        ${geaendert ? `<button class="knopf" data-akt="umkontieren" style="margin-bottom:10px;">
          Kontierung ändern</button>
          <div style="font-size:13px;color:var(--grau);line-height:1.45;margin-bottom:10px;">
            Bei einer anderen KST geht der Beleg an deren Projektleiter — wieder ungeprüft.</div>` : ""}
        ${zeile("MwSt", esc(n.mwst) + " %")}`
    : zeile("Konto", kontoText(n.konto))
      + zeile("KST", esc(auftragText(n.auftrag)))
      + zeile("MwSt", esc(n.mwst) + " %");

  const s = n.status;
  const stempel = stempelText(n);

  app.innerHTML = kopf(n.pruefen ? "Beleg prüfen" : "Beleg ansehen", statusName(s), true) + `
    <div class="inhalt" style="max-width:620px;">
      <div class="ok" style="background:#EEF3FA;border-color:#C9D8EE;color:var(--dunkel);
                             line-height:1.5;">
        ${statusMarke(n)}
        ${n.eingereichtAm ? ` <span style="font-size:13px;">· eingereicht am ${esc(zeitCH(n.eingereichtAm))}</span>` : ""}
        ${stempel ? `<div class="stempel">${esc(stempel)}</div>` : ""}
        ${s === "teilweise" ? `<div style="font-weight:700;">Genehmigt: CHF
            ${chf(n.genehmigtBetrag)} von ${chf(betrag)}</div>` : ""}
        ${n.entscheidGrund ? `<div>„${esc(n.entscheidGrund)}“</div>` : ""}
      </div>

      ${n.pruefen ? blockEntscheid(n, betrag) : ""}

      <div class="karte ablage">${beleg}</div>

      <div class="karte">
        ${kontierung}
        ${zeile("Betrag", "CHF " + chf(betrag))}
        ${zeile("Belegdatum", esc(datumCH(n.datum)))}
        ${zeile("Bezahlt mit", esc(zahlartName(n.zahlart)))}
        ${n.geraet && n.geraet !== S.session.user.email ? zeile("Erfasst von", esc(n.geraet)) : ""}
      </div>

      ${S.istAdmin && s !== "offen" && s !== "abgelehnt" ? `
        <div class="karte">
          <div style="font-size:14px;font-weight:700;margin-bottom:8px;">Admin: Rückweg</div>
          ${istEntschieden(n) ? `<button class="zweit" data-akt="zuruecksetzen" data-v="eingereicht"
              style="margin-bottom:8px;">Entscheid zurücknehmen — neu prüfen</button>` : ""}
          <button class="zweit" data-akt="zuruecksetzen" data-v="offen">
            Zurück auf „erfasst“ — Erfasser kann ändern</button>
        </div>` : ""}
    </div>`;
}

// Das Entscheid-Feld. Kreditkarte/Bar: Geld ist weg, nur prüfen oder
// vermerken. Vorauskasse: genehmigen, teilweise, ablehnen.
function blockEntscheid(n, betrag) {
  const vorkasse = n.zahlartDb === "vorkasse";
  return `<div class="karte" style="border:2px solid var(--blau);">
    <div style="font-size:16px;font-weight:700;margin-bottom:4px;">Entscheid</div>
    <div style="font-size:13px;color:var(--grau);line-height:1.45;margin-bottom:12px;">
      ${vorkasse ? "Vorauskasse — eigenes Geld. Du entscheidest über die Rückerstattung."
                 : "Firmengeld ist schon ausgegeben — es geht nur um die Richtigkeit."}</div>

    ${vorkasse ? `
      <button class="knopf" data-akt="entscheid" data-v="genehmigt" style="margin-bottom:8px;">
        Genehmigen — CHF ${chf(betrag)}</button>
      <label for="egbetrag" style="margin-top:6px;">Teilweise: genehmigter Betrag CHF</label>
      <input id="egbetrag" type="text" inputmode="decimal" placeholder="z. B. 45.00"
             style="margin-bottom:8px;">`
    : `<button class="knopf" data-akt="entscheid" data-v="geprueft" style="margin-bottom:8px;">
        Geprüft — stimmt</button>`}

    <label for="egrund" style="margin-top:6px;">Kommentar
      ${vorkasse ? "(nötig für teilweise und ablehnen)" : "(nötig für Besprechung)"}</label>
    <textarea id="egrund" rows="2" style="width:100%;margin-bottom:10px;font:inherit;
              padding:10px;border:1px solid var(--rand);border-radius:10px;"
              placeholder="${vorkasse ? "z. B. weniger, da Alkohol" : "z. B. Quittung fehlt"}"></textarea>

    ${vorkasse ? `
      <button class="zweit" data-akt="entscheid" data-v="teilweise" style="margin-bottom:8px;">
        Teilweise genehmigen</button>
      <button class="loeschen" data-akt="entscheid" data-v="abgelehnt" style="margin-top:0;">
        Ablehnen</button>`
    : `<button class="zweit" data-akt="entscheid" data-v="besprechung">
        Zur Besprechung vermerken</button>`}
  </div>`;
}

// ---------- Freigabe: was ich entscheiden muss ----------
function renderFreigabe() {
  const liste = S.freigabe;
  app.innerHTML = kopf("Zur Freigabe",
      liste.length === 1 ? "1 Beleg wartet" : `${liste.length} Belege warten`,
      istBreit(), istBreit()) + reiter() + `
    <div class="inhalt" style="max-width:760px;">
      ${S.meldung ? `<div class="ok">${esc(S.meldung)}</div>` : ""}
      ${liste.length === 0
        ? `<div class="karte leer">Nichts zu prüfen.</div>`
        : liste.map(b => `
          <button class="karte zeile freigabezeile" data-akt="bearbeiten" data-id="${b.id}"
                  data-w="freigabe">
            <div style="flex:1 1 auto;min-width:0;text-align:left;overflow-wrap:anywhere;">
              <div style="font-weight:600;">${belegKopf(b)}</div>
              <div style="font-size:13px;color:var(--grau);">${belegDetail(b, true)}</div>
              <div style="font-size:12px;color:var(--grau);">eingereicht ${esc(zeitCH(b.eingereicht_am))}</div>
            </div>
            <div style="text-align:right;flex-shrink:0;">
              <div style="font-size:17px;font-weight:700;">${chf(b.betrag)}</div>
              <div style="font-size:13px;color:var(--blau);">prüfen ›</div>
            </div>
          </button>`).join("")}
    </div>`;
  S.meldung = null;
}

// ---------- Auswahlbildschirme ----------
// Zielt die Auswahl auf eine Position, auf den ganzen Beleg oder auf einen Favoriten?
function wahlZiel() {
  if (S.favEdit) return S.favEdit;
  if (S.neu && S.posIndex != null && Array.isArray(S.neu.positionen)) {
    return S.neu.positionen[S.posIndex];
  }
  return S.neu;
}

function renderKontoWahl() {
  const liste = aktiveKonten();
  const ziel = wahlZiel();
  const gewaehlt = ziel ? ziel.konto : null;
  const sub = S.posIndex != null ? `Position ${S.posIndex + 1}` : `${liste.length} Konten`;

  app.innerHTML = kopf("Konto wählen", sub, true) + `
    <div class="inhalt" style="max-width:620px;">
      ${liste.length === 0
        ? `<div class="karte leer">Keine aktiven Konten. Unter Admin → Konten anlegen.</div>`
        : liste.map(k => `
        <button class="eintrag ${gewaehlt && gewaehlt.nummer===k.nummer ? "an":""}"
                data-akt="kontoSet" data-nr="${esc(k.nummer)}">
          <span class="nr">${esc(k.nummer)}</span>
          <span class="nm">${esc(k.bezeichnung)}</span>
          <span class="marke">${k.mwst} %</span>
        </button>`).join("")}
    </div>`;
}

function renderAuftragWahl() {
  const sub = S.posIndex != null ? `Position ${S.posIndex + 1}`
                                 : `${S.auftraege.length} Nummern`;
  app.innerHTML = kopf("Auftrag wählen", sub, true) + `
    <div class="inhalt" style="max-width:620px;">
      <input id="suche" type="search" placeholder="Nummer oder Name suchen"
             value="${esc(S.suche)}" style="margin-bottom:12px;">
      <div id="treffer"></div>
    </div>`;
  const feld = document.getElementById("suche");
  feld.addEventListener("input", () => { S.suche = feld.value; zeichneTreffer(); });
  zeichneTreffer();
}

// Nur die Trefferliste neu zeichnen, damit das Suchfeld den Fokus behält
function zeichneTreffer() {
  const q = S.suche.trim().toLowerCase();
  const ziel = wahlZiel();
  const gewaehlt = ziel ? ziel.auftrag : null;

  const passt = (a) => !q || String(a.id).toLowerCase().includes(q)
                          || String(a.name || "").toLowerCase().includes(q);

  // "ohne KST" steht immer zuoberst — auch wenn FileMaker nichts geliefert hat.
  const liste = [
    ...(passt(OHNE_KST) ? [OHNE_KST] : []),
    ...S.auftraege.filter(passt).slice(0, 60)
  ];

  const feld = document.getElementById("treffer");
  if (!feld) return;

  const hinweis = S.auftraege.length ? "" :
    `<div class="fehler">Die Auftragsnummern konnten nicht aus FileMaker geladen
      werden. Seite neu laden oder später nochmal versuchen.</div>`;

  feld.innerHTML = hinweis + (liste.length === 0
    ? `<div class="karte leer">Nichts gefunden.</div>`
    : liste.map(a => `
      <button class="eintrag ${gewaehlt && gewaehlt.id===a.id ? "an":""}"
              data-akt="auftragSet" data-id="${esc(a.id)}">
        <span class="nr">${a.id === OHNE_KST.id ? "—" : esc(a.id)}</span>
        <span class="nm">${esc(a.name)}</span>
        ${a.fix ? `<span class="marke">fest</span>`
                : (a.immer ? `<span class="marke">fix</span>` : "")}
      </button>`).join(""));
}

// ---------- Passwort ändern ----------
function renderPasswort() {
  app.innerHTML = kopf("Passwort ändern", S.session.user.email, true) + `
    <div class="inhalt" style="max-width:480px;">
      <div class="karte">
        <label for="pw1">Neues Passwort</label>
        <input id="pw1" type="password" autocomplete="new-password" style="margin-bottom:12px">
        <label for="pw2">Wiederholen</label>
        <input id="pw2" type="password" autocomplete="new-password">
      </div>
      <button class="knopf" data-akt="pwSichern">Passwort speichern</button>
      <div style="font-size:13px;color:var(--grau);padding-top:12px;line-height:1.45;">
        Mindestens sechs Zeichen. Nach dem Ändern bleibst du angemeldet.</div>
    </div>`;
}

// ---------- Favoriten verwalten ----------
function renderFavoriten() {
  app.innerHTML = kopf("Favoriten", `${S.favoriten.length} gespeichert`, true) + `
    <div class="inhalt" style="max-width:620px;">
      ${S.meldung ? `<div class="ok">${esc(S.meldung)}</div>` : ""}
      <div style="font-size:14px;color:var(--grau);line-height:1.45;margin-bottom:12px;">
        Ein Favorit setzt Konto und Auftragsnummer. Der Pfeil schiebt ihn nach oben.</div>

      ${S.favoriten.length === 0
        ? `<div class="karte leer">Noch keine Favoriten.</div>`
        : S.favoriten.map((f, i) => `
          <div class="favzeile">
            <button class="pfeil" data-akt="favHoch" data-id="${f.id}" ${i===0?"disabled":""}
                    aria-label="Nach oben">↑</button>
            <div style="flex-grow:1;min-width:0;">
              <div style="font-size:16px;font-weight:700;">${esc(f.name)}</div>
              <div style="font-size:13px;color:var(--grau);">
                Konto ${esc(f.konto_nummer)} · Auftrag ${esc(auftragAnzeige(f.auftrag_nr))}</div>
            </div>
            <button class="stift" data-akt="favBearbeiten" data-id="${f.id}"
                    aria-label="Favorit bearbeiten">${STIFT}</button>
          </div>`).join("")}

      <button class="knopf" data-akt="favNeu" style="margin-top:4px;">+ Neuer Favorit</button>

      <div style="font-size:13px;color:var(--grau);text-align:center;padding-top:14px;line-height:1.45;">
        Schneller geht es über einen bestehenden Beleg: dort auf den Stift
        und „Als Favorit merken“.</div>
    </div>`;
  S.meldung = null;
}

function renderFavForm() {
  const f = S.favEdit;
  const fertig = f.konto && f.auftrag;
  app.innerHTML = kopf(f.id ? "Favorit ändern" : "Neuer Favorit",
                       "Konto und Auftragsnummer festlegen", true) + `
    <div class="inhalt" style="max-width:620px;">
      <div class="karte">
        <label for="favname">Name</label>
        <input id="favname" type="text" data-feld="favname" value="${esc(f.name)}"
               placeholder="${esc(f.konto ? f.konto.bezeichnung : "z. B. Eventorganisation")}">
      </div>

      <button class="wahl ${f.konto ? "" : "offen"}" data-akt="kontoWahl">
        <span class="titel">Konto</span>
        <span class="wert" style="color:${f.konto ? "var(--dunkel)" : "var(--warn)"}">
          ${f.konto ? esc(f.konto.nummer + "  " + f.konto.bezeichnung) : "wählen"}</span>
        <span class="pfeil">›</span>
      </button>

      <button class="wahl ${f.auftrag ? "" : "offen"}" data-akt="auftragWahl">
        <span class="titel">Auftrag</span>
        <span class="wert" style="color:${f.auftrag ? "var(--dunkel)" : "var(--warn)"}">
          ${esc(auftragText(f.auftrag))}</span>
        <span class="pfeil">›</span>
      </button>

      <button class="knopf" data-akt="favSichern" ${fertig ? "" : "disabled"}>
        ${fertig ? "Favorit speichern" : "Konto und Auftrag nötig"}</button>

      ${f.id ? `<button class="loeschen" data-akt="favWeg">Diesen Favoriten löschen</button>` : ""}
    </div>`;
}

/* ==========================================================
   Admin — Benutzer
   ========================================================== */

function blockBenForm() {
  const b = S.benEdit || { neu:true, email:"", name:"", rolle:"user", gesperrt:false };
  const fest = !b.neu && istGeschuetzt(b.email);   // Notfall-Administrator
  return `<div class="karte">
    <div style="font-size:17px;font-weight:700;margin-bottom:14px;">
      ${b.neu ? "Neuer Benutzer" : esc(b.name || kurzName(b.email))}</div>

    ${b.neu ? `
      <label for="bmail">E-Mail</label>
      <input id="bmail" type="email" inputmode="email" value="${esc(b.email)}" data-feld="bmail"
             placeholder="handy3@tit-pit.ch" style="margin-bottom:12px">`
    : `<div style="font-size:14px;color:var(--grau);margin-bottom:12px;line-height:1.45;">
         ${esc(b.email)} — bleibt fest, die Belege hängen daran.</div>`}

    <label for="bname">Name</label>
    <input id="bname" type="text" value="${esc(b.name)}" placeholder="Eventhandy 3" data-feld="bname"
           style="margin-bottom:14px">

    <label>Rolle</label>
    <div class="mwst rollenwahl" style="margin-bottom:8px;">
      ${Object.entries(ROLLEN).map(([w, [name]]) =>
        `<button class="${b.rolle===w?"an":""}" data-akt="benRolle" data-v="${w}"
                 ${fest ? "disabled" : ""}>${name}</button>`).join("")}
    </div>
    <div style="font-size:13px;color:var(--grau);line-height:1.45;margin-bottom:14px;">
      ${fest
        ? "Notfall-Administrator. Rolle und Sperre sind festgelegt, damit immer ein Weg in die Verwaltung offen bleibt."
        : esc((ROLLEN[b.rolle] || ROLLEN.user)[1])}</div>

    <div style="display:flex;align-items:flex-start;gap:10px;margin-bottom:14px;">
      <input id="bpruefung" type="checkbox" ${b.pruefung ? "checked" : ""} data-feld="bpruefung"
             style="width:20px;height:20px;margin:2px 0 0;flex-shrink:0;accent-color:var(--blau);">
      <label for="bpruefung" style="margin:0;font-size:14px;color:var(--dunkel);line-height:1.45;">
        <b>Prüfung einrichten</b><br>
        <span style="color:var(--grau);">Belege ohne zuständigen Projektleiter gehen nicht
        automatisch durch, sondern warten auf einen Admin oder Supervisor.</span></label>
    </div>

    <label for="bpw">${b.neu ? "Passwort" : "Neues Passwort (leer lassen, wenn unverändert)"}</label>
    <input id="bpw" type="text" autocomplete="off" placeholder="mindestens 6 Zeichen">
    <div style="font-size:12px;color:var(--grau);padding:8px 0 14px;line-height:1.45;">
      Im Klartext sichtbar, damit du es weitergeben kannst.</div>

    <button class="knopf" data-akt="benSichern">
      ${b.neu ? "Benutzer anlegen" : "Änderungen speichern"}</button>

    ${!b.neu && !fest ? `
      <button class="zweit" data-akt="benSperren" style="margin-top:10px;">
        ${b.gesperrt ? "Wieder freischalten" : "Anmeldung sperren"}</button>` : ""}
    ${!b.neu ? `
      <button class="zweit" data-akt="benNeu" style="margin-top:10px;">
        Stattdessen neuen anlegen</button>` : ""}
  </div>`;
}

function blockBenListe() {
  const breit = istBreit();
  return `<div class="karte">
    <div style="font-size:17px;font-weight:700;margin-bottom:12px;">Alle Benutzer</div>
    ${S.benutzer.length === 0
      ? `<div class="leer">Keine Benutzer geladen.</div>`
      : breit ? `
      <div class="rollen"><table>
        <thead><tr>
          <th>Name</th><th>E-Mail</th><th>Rolle</th><th>Status</th>
          <th>Zuletzt angemeldet</th><th class="re">Belege im Zeitraum</th><th></th>
        </tr></thead>
        <tbody>
          ${S.benutzer.map(b => `<tr>
            <td style="font-weight:600;">${esc(b.name || kurzName(b.email))}</td>
            <td style="color:#3f5a80;">${esc(b.email)}</td>
            <td><span class="rolle ${b.rolle}">${esc(rolleName(b.rolle))}</span>${
                  b.pruefung ? ` <span class="rolle st-eingereicht">Prüfung</span>` : ""}</td>
            <td>${b.gesperrt || !b.aktiv
                  ? `<span class="rolle aus">gesperrt</span>`
                  : `<span style="color:#3f5a80;">aktiv</span>`}</td>
            <td style="color:var(--grau);">${b.angemeldet
                  ? new Date(b.angemeldet).toLocaleString("de-CH",
                      { day:"2-digit", month:"2-digit", year:"numeric",
                        hour:"2-digit", minute:"2-digit" })
                  : "nie"}</td>
            <td class="re">${belegeVon(b.email)}</td>
            <td class="re" style="width:52px;">
              <button class="stift" data-akt="benBearbeiten" data-e="${esc(b.email)}"
                      style="display:inline-flex;" aria-label="Benutzer bearbeiten">${STIFT}</button>
            </td>
          </tr>`).join("")}
        </tbody>
      </table></div>`
      : S.benutzer.map(b => `
        <div class="zeile" style="padding:10px 0;border-bottom:1px solid #EDEFF5;">
          <div style="min-width:0;">
            <div style="font-weight:600;">${esc(b.name || kurzName(b.email))}</div>
            <div style="font-size:13px;color:var(--grau);overflow:hidden;
                        text-overflow:ellipsis;">${esc(b.email)}</div>
          </div>
          <div style="display:flex;align-items:center;gap:8px;flex-shrink:0;">
            <span class="rolle ${b.gesperrt || !b.aktiv ? "aus" : b.rolle}">${
              b.gesperrt || !b.aktiv ? "gesperrt" : esc(rolleName(b.rolle))}</span>
            <button class="stift" data-akt="benBearbeiten" data-e="${esc(b.email)}"
                    aria-label="Benutzer bearbeiten">${STIFT}</button>
          </div>
        </div>`).join("")}
  </div>`;
}

const BEN_HINWEIS = `<div class="karte" style="display:flex;gap:14px;align-items:flex-start;">
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#5A6478" stroke-width="2"
         stroke-linecap="round" style="flex-shrink:0;margin-top:2px;" aria-hidden="true">
      <circle cx="12" cy="12" r="9"></circle><path d="M12 11v5"></path><path d="M12 8v.01"></path></svg>
    <span style="font-size:14px;color:var(--grau);line-height:1.5;">
      Gesperrte Benutzer können sich nicht anmelden. Ihre Belege bleiben vollständig erhalten
      und erscheinen weiter in der Übersicht und in den Exporten. Ein Konto zu sperren ist
      deshalb immer besser, als es zu löschen.</span>
  </div>`;

function adminSub() {
  const admins = S.benutzer.filter(b => b.rolle === "admin").length;
  return `${S.benutzer.length} Benutzer · ${admins} ${admins===1?"Administrator":"Administratoren"}`
       + ` · ${S.konten.length} Konten`;
}

// Rechner: Liste und Formular nebeneinander
function renderBenutzerBreit() {
  app.innerHTML = kopf("Admin", adminSub(), true, true) + adminReiter() + `
    <div class="inhalt">
      ${S.meldung ? `<div class="ok">${esc(S.meldung)}</div>` : ""}
      <div class="zweispalt">
        <div class="breit">${blockBenListe()}${BEN_HINWEIS}</div>
        <div class="schmal" style="width:380px;">${blockBenForm()}</div>
      </div>
    </div>`;
  S.meldung = null;
}

// Handy: erst die Liste
function renderBenutzer() {
  app.innerHTML = kopf("Admin", `${S.benutzer.length} Benutzer`, true, true) + adminReiter() + `
    <div class="inhalt">
      ${S.meldung ? `<div class="ok">${esc(S.meldung)}</div>` : ""}
      <button class="knopf" data-akt="benNeu" style="margin-bottom:14px;">+ Neuer Benutzer</button>
      ${blockBenListe()}
      ${BEN_HINWEIS}
    </div>`;
  S.meldung = null;
}

// Handy: dann das Formular
function renderBenForm() {
  const b = S.benEdit;
  app.innerHTML = kopf(b.neu ? "Neuer Benutzer" : "Benutzer ändern",
                       b.neu ? "Konto anlegen" : b.email, true) + `
    <div class="inhalt" style="max-width:620px;">${blockBenForm()}</div>`;
}

/* ==========================================================
   Admin — Konten
   ========================================================== */

function blockKontoForm() {
  const k = S.kontEdit || leeresKonto();
  return `<div class="karte">
    <div style="font-size:17px;font-weight:700;margin-bottom:14px;">
      ${k.neu ? "Neues Konto" : esc(k.nummer + "  " + k.bezeichnung)}</div>

    ${k.neu ? `
      <label for="knummer">Nummer</label>
      <input id="knummer" type="text" inputmode="numeric" value="${esc(k.nummer)}"
             placeholder="4590" data-feld="knummer" style="margin-bottom:12px">`
    : `<div style="font-size:14px;color:var(--grau);margin-bottom:12px;line-height:1.45;">
         Nummer ${esc(k.nummer)} — bleibt fest, weil die Belege daran hängen.</div>`}

    <label for="kbez">Bezeichnung</label>
    <input id="kbez" type="text" value="${esc(k.bezeichnung)}" placeholder="Übernachtungen"
           data-feld="kbez" style="margin-bottom:14px">

    <label>MwSt-Standard</label>
    <div class="mwst" style="margin-bottom:8px;">
      ${SAETZE.map(m =>
        `<button class="${String(k.mwst)===m?"an":""}" data-akt="kontoMwst"
                 data-v="${m}">${m}&nbsp;%</button>`).join("")}
    </div>
    <div style="font-size:13px;color:var(--grau);line-height:1.45;margin-bottom:14px;">
      Wird beim neuen Beleg vorbelegt und lässt sich dort ändern.</div>

    <label for="ksort">Reihenfolge in der Auswahl</label>
    <input id="ksort" type="text" inputmode="numeric" value="${esc(k.sortierung)}"
           data-feld="ksort" style="margin-bottom:6px">
    <div style="font-size:13px;color:var(--grau);line-height:1.45;margin-bottom:14px;">
      Zehnerschritte, damit später etwas dazwischen passt.</div>

    <div style="display:flex;align-items:center;gap:10px;min-height:44px;margin-bottom:8px;">
      <input id="kaktiv" type="checkbox" ${k.aktiv ? "checked" : ""} data-feld="kaktiv"
             style="width:20px;height:20px;margin:0;accent-color:var(--blau);">
      <label for="kaktiv" style="margin:0;font-size:15px;color:var(--dunkel);">
        Steht in der Auswahl</label>
    </div>

    <button class="knopf" data-akt="kontoSichern">
      ${k.neu ? "Konto anlegen" : "Änderungen speichern"}</button>

    ${!k.neu ? `<button class="zweit" data-akt="kontoNeu" style="margin-top:10px;">
      Stattdessen neues anlegen</button>` : ""}
  </div>`;
}

function blockKontenListe() {
  const breit = istBreit();
  return `<div class="karte">
    <div style="font-size:17px;font-weight:700;margin-bottom:12px;">Alle Konten</div>
    ${S.konten.length === 0
      ? `<div class="leer">Noch keine Konten angelegt.</div>`
      : breit ? `
      <div class="rollen"><table>
        <thead><tr>
          <th>Nummer</th><th>Bezeichnung</th><th>MwSt-Standard</th><th>Reihenfolge</th>
          <th>Status</th><th class="re">Posten im Zeitraum</th><th></th>
        </tr></thead>
        <tbody>
          ${S.konten.map(k => `<tr>
            <td class="gross">${esc(k.nummer)}</td>
            <td style="color:#3f5a80;">${esc(k.bezeichnung)}</td>
            <td style="color:#3f5a80;">${k.mwst} %</td>
            <td style="color:var(--grau);">${k.sortierung ?? ""}</td>
            <td>${k.aktiv === false
                  ? `<span class="rolle aus">inaktiv</span>`
                  : `<span style="color:#3f5a80;">aktiv</span>`}</td>
            <td class="re">${postenAufKonto(k.nummer)}</td>
            <td class="re" style="width:52px;">
              <button class="stift" data-akt="kontoBearbeiten" data-nr="${esc(k.nummer)}"
                      style="display:inline-flex;" aria-label="Konto bearbeiten">${STIFT}</button>
            </td>
          </tr>`).join("")}
        </tbody>
      </table></div>`
      : S.konten.map(k => `
        <div class="zeile" style="padding:10px 0;border-bottom:1px solid #EDEFF5;">
          <div style="min-width:0;">
            <div style="font-weight:600;">${esc(k.nummer)} ${esc(k.bezeichnung)}</div>
            <div style="font-size:13px;color:var(--grau);">
              MwSt ${k.mwst} % · Reihenfolge ${k.sortierung ?? ""}</div>
          </div>
          <div style="display:flex;align-items:center;gap:8px;flex-shrink:0;">
            ${k.aktiv === false ? `<span class="rolle aus">inaktiv</span>` : ""}
            <button class="stift" data-akt="kontoBearbeiten" data-nr="${esc(k.nummer)}"
                    aria-label="Konto bearbeiten">${STIFT}</button>
          </div>
        </div>`).join("")}
  </div>`;
}

// Wie viele Posten laufen im gewählten Zeitraum auf dieses Konto?
function postenAufKonto(nr) {
  let n = 0;
  for (const b of S.uBelege) {
    for (const p of belegZeilen(b)) if (p.konto_nummer === nr) n += 1;
  }
  return n;
}

const KONTO_HINWEIS = `<div class="karte" style="display:flex;gap:14px;align-items:flex-start;">
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#5A6478" stroke-width="2"
         stroke-linecap="round" style="flex-shrink:0;margin-top:2px;" aria-hidden="true">
      <circle cx="12" cy="12" r="9"></circle><path d="M12 11v5"></path><path d="M12 8v.01"></path></svg>
    <span style="font-size:14px;color:var(--grau);line-height:1.5;">
      Ein Konto auf inaktiv zu stellen nimmt es aus der Auswahl, lässt es aber in alten
      Belegen und Exporten stehen. Löschen gibt es bewusst nicht — die Belege hängen an
      der Nummer.</span>
  </div>`;

// Rechner: Liste und Formular nebeneinander
function renderKontenBreit() {
  // Am Rechner steht das Formular immer da — also eines bereitlegen,
  // sonst laufen die Tastatureingaben ins Leere.
  if (!S.kontEdit) S.kontEdit = leeresKonto();
  app.innerHTML = kopf("Admin", adminSub(), true, true) + adminReiter() + `
    <div class="inhalt">
      ${S.meldung ? `<div class="ok">${esc(S.meldung)}</div>` : ""}
      <div class="zweispalt">
        <div class="breit">${blockKontenListe()}${KONTO_HINWEIS}</div>
        <div class="schmal" style="width:380px;">${blockKontoForm()}</div>
      </div>
    </div>`;
  S.meldung = null;
}

// Handy: erst die Liste
function renderKonten() {
  app.innerHTML = kopf("Admin", `${S.konten.length} Konten`, true, true) + adminReiter() + `
    <div class="inhalt">
      ${S.meldung ? `<div class="ok">${esc(S.meldung)}</div>` : ""}
      <button class="knopf" data-akt="kontoNeu" style="margin-bottom:14px;">+ Neues Konto</button>
      ${blockKontenListe()}
      ${KONTO_HINWEIS}
    </div>`;
  S.meldung = null;
}

// Handy: dann das Formular
function renderKontoForm() {
  if (!S.kontEdit) S.kontEdit = leeresKonto();
  const k = S.kontEdit;
  app.innerHTML = kopf(k.neu ? "Neues Konto" : "Konto ändern",
                       k.neu ? "Nummer und Bezeichnung festlegen"
                             : k.nummer + "  " + k.bezeichnung, true) + `
    <div class="inhalt" style="max-width:620px;">${blockKontoForm()}</div>`;
}

/* ==========================================================
   Admin — Zuweisungen: wer prüft welche KST, welche Konten
   ========================================================== */

function renderZuweisungen() {
  const pls  = S.benutzer.filter(b => b.rolle === "projektleiter"
                 || S.zuweisungen.some(z => z.email === b.email));
  const sups = S.benutzer.filter(b => b.rolle === "supervisor"
                 || S.zuweisungenKonto.some(z => z.email === b.email));
  const kstName = (nr) => {
    if (nr === OHNE_KST.id) return OHNE_KST.name;
    const a = S.auftraege.find(x => x.id === nr);
    return a && a.name ? nr + " " + a.name : nr;
  };
  const chip = (text, akt, email, wert) => `<span class="chip">${esc(text)}
      <button data-akt="${akt}" data-e="${esc(email)}" data-v="${esc(wert)}"
              aria-label="${esc(text)} entfernen">✕</button></span>`;

  const karte = (b, art) => {
    const eigene = art === "kst"
      ? S.zuweisungen.filter(z => z.email === b.email)
      : S.zuweisungenKonto.filter(z => z.email === b.email);
    const feld = `zw-${art}-${b.email.replace(/[^a-z0-9]/gi, "_")}`;
    return `<div class="karte">
      <div class="zeile" style="margin-bottom:8px;">
        <div><div style="font-weight:700;">${esc(b.name || kurzName(b.email))}</div>
             <div style="font-size:13px;color:var(--grau);">${esc(b.email)}</div></div>
        <span class="rolle ${b.rolle}">${esc(rolleName(b.rolle))}</span>
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px;">
        ${eigene.length ? eigene.map(z => art === "kst"
            ? chip(kstName(z.auftrag_nr), "zuwWeg", b.email, z.auftrag_nr)
            : chip(z.konto_nummer + " " + kontoName(z.konto_nummer), "zuwKontoWeg", b.email, z.konto_nummer)
          ).join("")
          : `<span style="font-size:13px;color:var(--grau);">noch ${art === "kst" ? "keine KST" : "keine Konten"}</span>`}
      </div>
      <div style="display:flex;gap:8px;">
        ${art === "kst"
          ? `<input id="${feld}" list="kstliste" placeholder="KST-Nummer eingeben" style="flex:1;">`
          : `<select id="${feld}" style="flex:1;">
               <option value="">Konto wählen</option>
               ${aktiveKonten().map(k => `<option value="${esc(k.nummer)}">${esc(k.nummer)}
                 ${esc(k.bezeichnung)}</option>`).join("")}</select>`}
        <button class="zweit" style="width:auto;padding:0 16px;" data-akt="${art === "kst" ? "zuwNeu" : "zuwKontoNeu"}"
                data-e="${esc(b.email)}" data-f="${feld}">Hinzufügen</button>
      </div>
    </div>`;
  };

  app.innerHTML = kopf("Admin", "Zuweisungen", true, true) + adminReiter() + `
    <div class="inhalt" style="max-width:760px;">
      ${S.meldung ? `<div class="ok">${esc(S.meldung)}</div>` : ""}
      <datalist id="kstliste">
        <option value="${esc(OHNE_KST.id)}">${esc(OHNE_KST.name)}</option>
        ${S.auftraege.map(a => `<option value="${esc(a.id)}">${esc(a.name || "")}</option>`).join("")}
      </datalist>

      <span class="abschnitt">PROJEKTLEITER × KOSTENSTELLEN</span>
      <div style="height:8px;"></div>
      ${pls.length ? pls.map(b => karte(b, "kst")).join("")
        : `<div class="karte leer">Noch niemand mit der Rolle Projektleiter. Unter Benutzer die Rolle setzen.</div>`}

      <span class="abschnitt" style="padding-top:10px;">SUPERVISOREN × KONTEN</span>
      <div style="height:8px;"></div>
      ${sups.length ? sups.map(b => karte(b, "konto")).join("")
        : `<div class="karte leer">Noch niemand mit der Rolle Supervisor. Unter Benutzer die Rolle setzen.</div>`}

      <div style="font-size:13px;color:var(--grau);line-height:1.5;padding-top:6px;">
        Ein Beleg geht an alle, denen seine KST oder sein Konto zugewiesen ist — wer zuerst
        entscheidet, gilt. Hat er niemanden, läuft er ohne Prüfung durch, ausser beim
        Erfasser ist „Prüfung einrichten“ angehakt.</div>
    </div>`;
  S.meldung = null;
}
