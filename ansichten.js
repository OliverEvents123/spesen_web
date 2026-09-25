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

  if (S.ansicht === "benutzer" || S.ansicht === "benForm") {
    if (breit) return renderBenutzerBreit();
    return S.ansicht === "benForm" ? renderBenForm() : renderBenutzer();
  }

  if (breit) return renderDesktop();
  return S.ansicht === "uebersicht" ? renderUebersicht() : renderListe();
}

// ---------- Kopf ----------
function kopf(titel, sub, zurueck) {
  const knoepfe = `<div class="kopfknoepfe">
      ${S.istAdmin ? `<button class="${S.ansicht==="benutzer"||S.ansicht==="benForm"?"an":""}"
          data-akt="tabBenutzer">Benutzer</button>` : ""}
      <button data-akt="zuPasswort">Passwort</button>
      <button data-akt="abmelden">Abmelden</button>
    </div>`;
  return `<div class="kopf">
    ${zurueck ? `<button class="rund" data-akt="zurueck" aria-label="Zurück">‹</button>` : ""}
    <div class="wachs"><h1>${esc(titel)}</h1><div class="sub">${esc(sub)}</div></div>
    ${zurueck ? "" : knoepfe}
  </div>`;
}

// Reiter nur am Handy — am Rechner steht ohnehin alles nebeneinander
function reiter() {
  if (istBreit()) return "";
  return `<div class="reiter">
    <button class="${S.ansicht==="liste"?"an":""}" data-akt="tabListe">Meine Belege</button>
    <button class="${S.ansicht==="uebersicht"?"an":""}" data-akt="tabUebersicht">Übersicht</button>
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

function blockFilter() {
  const geraete = [...new Set(S.uBelege.map(b => b.geraet))].sort();
  return `<div class="karte">
    <div class="paar">
      <div>
        <label for="umonat">Monat</label>
        <input id="umonat" type="month" value="${S.uMonat}" data-feld="umonat">
      </div>
      <div>
        <label for="uzahlart">Zahlungsart</label>
        <select id="uzahlart" data-feld="uzahlart">
          <option value="" ${S.uZahlart===""?"selected":""}>Alle</option>
          ${Object.entries(ZAHLART).map(([w,n]) =>
            `<option value="${w}" ${S.uZahlart===w?"selected":""}>${n}</option>`).join("")}
        </select>
      </div>
      ${S.istAdmin ? `
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
        <th class="re">Belege</th><th class="re">Brutto</th>
        <th class="re">MwSt-Betrag</th><th class="re">Netto</th>
      </tr></thead>
      <tbody>
        ${gruppen.map(g => `<tr>
          <td class="gross">${esc(g.konto)}</td>
          <td>${esc(g.bezeichnung)}</td>
          <td>${esc(g.auftrag)}</td>
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

// Belegliste. woher steuert, wohin das Bearbeiten zurückkehrt.
function blockBelege(liste, woher, titel) {
  const breit = istBreit();
  return `<div class="karte">
    <div style="font-size:17px;font-weight:700;margin-bottom:12px;">${esc(titel)}</div>
    ${liste.length === 0
      ? `<div class="leer">Keine Belege für diese Auswahl.</div>`
      : liste.map((b,i) => breit ? `
        <div class="belegzeile">
          <span class="datum">${datumCH(b.beleg_datum)}</span>
          <span class="haupt">${esc(b.konto_nummer)} ${esc(kontoName(b.konto_nummer))}
            · ${esc(b.auftrag_nr)} · ${b.mwst} %</span>
          <span class="neben">${esc(b.geraet)}</span>
          <span class="neben" style="width:100px;">${esc(zahlartName(b.zahlart))}</span>
          <span class="zahl">${chf(b.betrag)}</span>
          ${b.datei_pfad ? `<button class="beleglink" data-akt="belegAuf"
              data-p="${esc(b.datei_pfad)}">Beleg</button>`
            : `<span style="width:62px;"></span>`}
          <button class="stift" data-akt="bearbeiten" data-id="${b.id}" data-w="${woher}"
                  aria-label="Beleg bearbeiten">${STIFT}</button>
        </div>` : `
        <div class="zeile" style="padding:9px 0;border-bottom:1px solid #EDEFF5;">
          <div style="min-width:0;">
            <div style="font-weight:600;">${i+1} · ${esc(b.konto_nummer)} ·
              ${esc(b.auftrag_nr)} · ${b.mwst} %</div>
            <div style="font-size:13px;color:var(--grau);">
              ${datumCH(b.beleg_datum)} · ${esc(zahlartName(b.zahlart))}${
                S.istAdmin && !S.uGeraet ? " · " + esc(kurzName(b.geraet)) : ""}</div>
          </div>
          <div style="display:flex;align-items:center;gap:8px;">
            ${b.datei_pfad ? `<button class="beleglink" data-akt="belegAuf"
                data-p="${esc(b.datei_pfad)}">Beleg</button>` : ""}
            <button class="stift" data-akt="bearbeiten" data-id="${b.id}" data-w="${woher}"
                    aria-label="Beleg bearbeiten">${STIFT}</button>
            <div style="font-weight:700;">${chf(b.betrag)}</div>
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

  app.innerHTML = kopf("Spesen", `${kurzName(S.session.user.email)} · ${monatName(S.uMonat)}`) + `
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

      ${S.belege.length === 0
        ? `<div class="karte leer">Noch keine Belege in diesem Monat.</div>`
        : S.belege.map(b => `
          <div class="karte zeile">
            <div style="min-width:0;">
              <div style="font-weight:600;">${esc(b.konto_nummer)}
                ${esc(kontoName(b.konto_nummer))} · ${esc(b.auftrag_nr)}</div>
              <div style="font-size:13px;color:var(--grau);">
                ${datumCH(b.beleg_datum)} · MwSt ${b.mwst} % · ${esc(zahlartName(b.zahlart))}</div>
            </div>
            <div style="display:flex;align-items:center;gap:8px;">
              ${b.datei_pfad ? `<button class="beleglink" data-akt="belegAuf"
                  data-p="${esc(b.datei_pfad)}">Beleg</button>` : ""}
              <button class="stift" data-akt="bearbeiten" data-id="${b.id}" data-w="liste"
                      aria-label="Beleg bearbeiten">${STIFT}</button>
              <div style="font-size:17px;font-weight:700;">${chf(b.betrag)}</div>
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
function renderErfassen() {
  const n = S.neu;
  const bearbeiten = !!n.id;
  const betrag = betragVon(n.betragText);
  const hatBeleg = !!(n.datei || n.altPfad);
  const fertig = betrag > 0 && n.konto && n.auftrag && hatBeleg;

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

  app.innerHTML = kopf(bearbeiten ? "Beleg bearbeiten" : "Beleg erfassen",
                       bearbeiten ? "Werte ändern und speichern"
                                  : "Angaben prüfen und speichern", true) + `
    <div class="inhalt" style="max-width:620px;">
      ${belegKarte}

      <button class="wahl ${n.konto ? "" : "offen"}" data-akt="kontoWahl">
        <span class="titel">Konto</span>
        <span class="wert" style="color:${n.konto ? "var(--dunkel)" : "var(--warn)"}">
          ${n.konto ? esc(n.konto.nummer + "  " + n.konto.bezeichnung) : "wählen"}</span>
        <span class="pfeil">›</span>
      </button>

      <button class="wahl ${n.auftrag ? "" : "offen"}" data-akt="auftragWahl">
        <span class="titel">Auftrag</span>
        <span class="wert" style="color:${n.auftrag ? "var(--dunkel)" : "var(--warn)"}">
          ${n.auftrag ? esc(n.auftrag.id + (n.auftrag.name ? "  " + n.auftrag.name : ""))
                      : "wählen"}</span>
        <span class="pfeil">›</span>
      </button>

      <div class="karte">
        <label for="betrag">Betrag CHF</label>
        <input id="betrag" class="betrag" type="text" inputmode="decimal"
               autocomplete="off" placeholder="0.00"
               value="${esc(n.betragText)}" data-feld="betrag">
      </div>

      <div class="mwst">
        ${["8.1","2.6","3.8","0"].map(m =>
          `<button class="${n.mwst===m?"an":""}" data-akt="mwst" data-v="${m}">${m}&nbsp;%</button>`).join("")}
      </div>

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

      ${bearbeiten && n.konto && n.auftrag ? `
        <button class="zweit" data-akt="favMerken" style="margin-top:10px;
                display:flex;align-items:center;justify-content:center;gap:9px;">
          ${STERN} Als Favorit merken</button>` : ""}

      ${bearbeiten ? `<button class="loeschen" data-akt="loeschen">Diesen Beleg löschen</button>` : ""}
    </div>`;
}

// ---------- Auswahlbildschirme ----------
function renderKontoWahl() {
  const gewaehlt = (S.favEdit || S.neu).konto;
  app.innerHTML = kopf("Konto wählen", `${S.konten.length} Konten`, true) + `
    <div class="inhalt" style="max-width:620px;">
      ${S.konten.map(k => `
        <button class="eintrag ${gewaehlt && gewaehlt.nummer===k.nummer ? "an":""}"
                data-akt="kontoSet" data-nr="${esc(k.nummer)}">
          <span class="nr">${esc(k.nummer)}</span>
          <span class="nm">${esc(k.bezeichnung)}</span>
          <span class="marke">${k.mwst} %</span>
        </button>`).join("")}
    </div>`;
}

function renderAuftragWahl() {
  app.innerHTML = kopf("Auftrag wählen", `${S.auftraege.length} Nummern`, true) + `
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
  const gewaehlt = (S.favEdit || S.neu).auftrag;
  const liste = (q
    ? S.auftraege.filter(a => a.id.toLowerCase().includes(q) || a.name.toLowerCase().includes(q))
    : S.auftraege).slice(0, 60);
  const ziel = document.getElementById("treffer");
  if (!ziel) return;
  if (!S.auftraege.length) {
    ziel.innerHTML = `<div class="fehler">Die Auftragsnummern konnten nicht aus FileMaker
      geladen werden. Seite neu laden oder später nochmal versuchen.</div>`;
    return;
  }
  ziel.innerHTML = liste.length === 0
    ? `<div class="karte leer">Nichts gefunden.</div>`
    : liste.map(a => `
      <button class="eintrag ${gewaehlt && gewaehlt.id===a.id ? "an":""}"
              data-akt="auftragSet" data-id="${esc(a.id)}">
        <span class="nr">${esc(a.id)}</span>
        <span class="nm">${esc(a.name)}</span>
        ${a.immer ? `<span class="marke">fix</span>` : ""}
      </button>`).join("");
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
                Konto ${esc(f.konto_nummer)} · Auftrag ${esc(f.auftrag_nr)}</div>
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
          ${f.auftrag ? esc(f.auftrag.id + (f.auftrag.name ? "  " + f.auftrag.name : ""))
                      : "wählen"}</span>
        <span class="pfeil">›</span>
      </button>

      <button class="knopf" data-akt="favSichern" ${fertig ? "" : "disabled"}>
        ${fertig ? "Favorit speichern" : "Konto und Auftrag nötig"}</button>

      ${f.id ? `<button class="loeschen" data-akt="favWeg">Diesen Favoriten löschen</button>` : ""}
    </div>`;
}

/* ==========================================================
   Benutzerverwaltung
   ========================================================== */

function blockBenForm() {
  const b = S.benEdit || { neu:true, email:"", name:"", rolle:"user", gesperrt:false };
  return `<div class="karte">
    <div style="font-size:17px;font-weight:700;margin-bottom:14px;">
      ${b.neu ? "Neuer Benutzer" : esc(b.name || kurzName(b.email))}</div>

    ${b.neu ? `
      <label for="bmail">E-Mail</label>
      <input id="bmail" type="email" inputmode="email" value="${esc(b.email)}"
             placeholder="handy3@tit-pit.ch" style="margin-bottom:12px">
      <label for="bname">Name</label>
      <input id="bname" type="text" value="${esc(b.name)}" placeholder="Eventhandy 3"
             style="margin-bottom:14px">`
    : `<div style="font-size:14px;color:var(--grau);margin-bottom:14px;">${esc(b.email)}</div>`}

    <label>Rolle</label>
    <div class="mwst" style="margin-bottom:8px;">
      <button class="${b.rolle==="user"?"an":""}" data-akt="benRolle" data-v="user">User</button>
      <button class="${b.rolle==="admin"?"an":""}" data-akt="benRolle" data-v="admin">Admin</button>
    </div>
    <div style="font-size:13px;color:var(--grau);line-height:1.45;margin-bottom:14px;">
      ${b.rolle === "admin"
        ? "Sieht alle Belege aller Geräte und darf Benutzer verwalten."
        : "Sieht und erfasst nur die eigenen Belege."}</div>

    <label for="bpw">${b.neu ? "Passwort" : "Neues Passwort (leer lassen, wenn unverändert)"}</label>
    <input id="bpw" type="text" autocomplete="off" placeholder="mindestens 6 Zeichen">
    <div style="font-size:12px;color:var(--grau);padding:8px 0 14px;line-height:1.45;">
      Im Klartext sichtbar, damit du es weitergeben kannst.</div>

    <button class="knopf" data-akt="benSichern">
      ${b.neu ? "Benutzer anlegen" : "Änderungen speichern"}</button>

    ${!b.neu ? `
      <button class="zweit" data-akt="benSperren" style="margin-top:10px;">
        ${b.gesperrt ? "Wieder freischalten" : "Anmeldung sperren"}</button>
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
          <th>Zuletzt angemeldet</th><th class="re">Belege im Monat</th><th></th>
        </tr></thead>
        <tbody>
          ${S.benutzer.map(b => `<tr>
            <td style="font-weight:600;">${esc(b.name || kurzName(b.email))}</td>
            <td style="color:#3f5a80;">${esc(b.email)}</td>
            <td><span class="rolle ${b.rolle}">${b.rolle === "admin" ? "Admin" : "User"}</span></td>
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
              b.gesperrt || !b.aktiv ? "gesperrt" : (b.rolle === "admin" ? "Admin" : "User")}</span>
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

// Rechner: Liste und Formular nebeneinander
function renderBenutzerBreit() {
  const admins = S.benutzer.filter(b => b.rolle === "admin").length;
  app.innerHTML = kopf("Benutzer",
      `${S.benutzer.length} angelegt · ${admins} ${admins===1?"Administrator":"Administratoren"}`) + `
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
  app.innerHTML = kopf("Benutzer", `${S.benutzer.length} angelegt`) + reiter() + `
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
