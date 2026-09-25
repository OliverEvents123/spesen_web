// Alle Bildschirme der App. Jede Funktion baut ihren Bildschirm neu auf.
// Klicks werden über data-akt="..." an app.js gemeldet.

function render() {
  if (S.ansicht === "liste")       return renderListe();
  if (S.ansicht === "uebersicht")  return renderUebersicht();
  if (S.ansicht === "erfassen")    return renderErfassen();
  if (S.ansicht === "kontoWahl")   return renderKontoWahl();
  if (S.ansicht === "auftragWahl") return renderAuftragWahl();
  if (S.ansicht === "favoriten")   return renderFavoriten();
  if (S.ansicht === "favForm")     return renderFavForm();
}

function kopf(titel, sub, zurueck) {
  return `<div class="kopf">
    ${zurueck ? `<button class="rund" data-akt="zurueck" aria-label="Zurück">‹</button>` : ""}
    <div class="wachs"><h1>${esc(titel)}</h1><div class="sub">${esc(sub)}</div></div>
    ${zurueck ? "" : `<button class="rund" data-akt="abmelden"
        style="width:auto;padding:0 12px;font-size:14px;">Abmelden</button>`}
  </div>`;
}

function reiter() {
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
    S.session = data.session; await ladeAlles(); render();
  });
}

// ---------- Meine Belege ----------
function renderListe() {
  const summe = S.belege.reduce((t,b) => t + parseFloat(b.betrag), 0);
  const favs  = S.favoriten.slice(0, MAX_KACHELN);

  const favBlock = S.favoriten.length === 0 ? `
      <button class="favlink" data-akt="zuFavoriten">Favoriten einrichten</button>`
    : `
      <span class="abschnitt">FAVORITEN</span>
      <div class="favgitter">
        ${favs.map(f => `
          <button class="favkachel" data-akt="favAnwenden" data-id="${f.id}">
            <span class="nam">${esc(f.name)}</span>
            <span class="nrn">${esc(f.konto_nummer)} · ${esc(f.auftrag_nr)}</span>
          </button>`).join("")}
      </div>
      <button class="favlink" data-akt="zuFavoriten">Favoriten verwalten</button>`;

  app.innerHTML = kopf("Meine Spesen", `${S.session.user.email} · ${monatName(S.monat)}`) + reiter() + `
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
      ${favBlock}

      <span class="abschnitt" style="padding-top:10px;">ZULETZT ERFASST</span>
      <div style="height:8px;"></div>

      ${S.belege.length === 0
        ? `<div class="karte leer">Noch keine Belege in diesem Monat.</div>`
        : S.belege.map(b => `
          <div class="karte zeile">
            <div>
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

// ---------- Favoriten verwalten ----------
function renderFavoriten() {
  app.innerHTML = kopf("Favoriten",
    `${S.favoriten.length} ${S.favoriten.length===1?"gespeichert":"gespeichert"}`, true) + `
    <div class="inhalt">
      ${S.meldung ? `<div class="ok">${esc(S.meldung)}</div>` : ""}
      <div style="font-size:14px;color:var(--grau);line-height:1.45;margin-bottom:12px;">
        Ein Favorit setzt Konto und Auftragsnummer. Der Pfeil schiebt ihn nach oben.</div>

      ${S.favoriten.length === 0
        ? `<div class="karte leer">Noch keine Favoriten.</div>`
        : S.favoriten.map((f, i) => `
          <div class="favzeile">
            <button class="pfeil" data-akt="favHoch" data-id="${f.id}" ${i===0?"disabled":""}
                    aria-label="Nach oben">↑</button>
            <div style="flex-grow:1;">
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

// ---------- Favorit anlegen und ändern ----------
function renderFavForm() {
  const f = S.favEdit;
  const fertig = f.konto && f.auftrag;
  app.innerHTML = kopf(f.id ? "Favorit ändern" : "Neuer Favorit",
                       "Konto und Auftragsnummer festlegen", true) + `
    <div class="inhalt">
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

// ---------- Übersicht mit Kontierung und Export ----------
function renderUebersicht() {
  const geraete   = [...new Set(S.uBelege.map(b => b.geraet))].sort();
  const gefiltert = uGefiltert();
  const gruppen   = gruppiere(gefiltert);
  const tBrutto = gruppen.reduce((t,g) => t + g.brutto, 0);
  const tSteuer = gruppen.reduce((t,g) => t + g.steuer, 0);
  const tNetto  = gruppen.reduce((t,g) => t + g.netto,  0);
  const tAnzahl = gruppen.reduce((t,g) => t + g.anzahl, 0);

  app.innerHTML = kopf("Übersicht", S.istAdmin ? "Alle Geräte" : S.session.user.email) + reiter() + `
    <div class="inhalt">
      ${S.meldung ? `<div class="ok">${esc(S.meldung)}</div>` : ""}

      <div class="karte">
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
      </div>

      ${S.uLaedt ? `<div class="karte leer">Lade …</div>` : gefiltert.length === 0
        ? `<div class="karte leer">Keine Belege für diese Auswahl.</div>`
        : `
        <div class="karte">
          <div style="font-size:17px;font-weight:700;margin-bottom:3px;">Kontierung</div>
          <div style="font-size:13px;color:var(--grau);margin-bottom:12px;">${esc(uTitel())}</div>
          <div class="rollen"><table>
            <thead><tr>
              <th>Konto</th><th>Bezeichnung</th><th>Auftrag</th><th>MwSt</th>
              <th class="re">Belege</th><th class="re">Brutto</th>
              <th class="re">MwSt-Betrag</th><th class="re">Netto</th>
            </tr></thead>
            <tbody>
              ${gruppen.map(g => `<tr>
                <td class="gross">${esc(g.konto)}</td>
                <td>${esc(g.bezeichnung)}</td>
                <td>${esc(g.auftrag)}</td>
                <td>${g.satz} %</td>
                <td class="re">${g.anzahl}</td>
                <td class="re gross">${chf(g.brutto)}</td>
                <td class="re">${chf(g.steuer)}</td>
                <td class="re">${chf(g.netto)}</td>
              </tr>`).join("")}
              <tr class="summe">
                <td colspan="4">Total</td>
                <td class="re">${tAnzahl}</td>
                <td class="re">${chf(tBrutto)}</td>
                <td class="re">${chf(tSteuer)}</td>
                <td class="re">${chf(tNetto)}</td>
              </tr>
            </tbody>
          </table></div>
        </div>

        <div class="karte">
          <div style="font-size:17px;font-weight:700;margin-bottom:3px;">Export für DocuWare</div>
          <div style="font-size:13px;color:var(--grau);margin-bottom:12px;">
            Im PDF steht diese Übersicht vorn, danach folgen alle ${tAnzahl} Belege.</div>
          <button class="knopf" data-akt="expPdf" style="margin-bottom:8px;">PDF erzeugen</button>
          <button class="zweit" data-akt="expCsv">Buchungsliste als CSV</button>
        </div>

        <div class="karte">
          <div style="font-size:17px;font-weight:700;margin-bottom:12px;">Einzelne Belege</div>
          ${gefiltert.map((b,i) => `
            <div class="zeile" style="padding:9px 0;border-bottom:1px solid #EDEFF5;">
              <div>
                <div style="font-weight:600;">${i+1} · ${esc(b.konto_nummer)} ·
                  ${esc(b.auftrag_nr)} · ${b.mwst} %</div>
                <div style="font-size:13px;color:var(--grau);">
                  ${datumCH(b.beleg_datum)} · ${esc(zahlartName(b.zahlart))}${
                    S.istAdmin && !S.uGeraet ? " · " + esc(b.geraet) : ""}</div>
              </div>
              <div style="display:flex;align-items:center;gap:8px;">
                ${b.datei_pfad ? `<button class="beleglink" data-akt="belegAuf"
                    data-p="${esc(b.datei_pfad)}">Beleg</button>` : ""}
                <button class="stift" data-akt="bearbeiten" data-id="${b.id}" data-w="uebersicht"
                        aria-label="Beleg bearbeiten">${STIFT}</button>
                <div style="font-weight:700;">${chf(b.betrag)}</div>
              </div>
            </div>`).join("")}
        </div>`}
    </div>`;
  S.meldung = null;
}

// ---------- Beleg erfassen und bearbeiten ----------
function renderErfassen() {
  const n = S.neu;
  const bearbeiten = !!n.id;
  const betrag = betragVon(n.roh);
  const hatBeleg = !!(n.datei || n.altPfad);
  const fertig = betrag > 0 && n.konto && n.auftrag && hatBeleg;
  const tasten = ["1","2","3","4","5","6","7","8","9","00","0","⌫"];

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
    <div class="inhalt">
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

      <div class="karte zeile">
        <span style="font-size:14px;color:var(--grau);">Betrag CHF</span>
        <span style="font-size:34px;font-weight:700;line-height:1.1;
                     color:${betrag>0 ? "var(--dunkel)" : "#AEB6C6"};">${chf(betrag)}</span>
      </div>

      <div class="block">
        ${tasten.map(t => `<button class="taste" data-akt="ziffer" data-z="${t}">${t}</button>`).join("")}
      </div>

      <div class="mwst">
        ${["8.1","2.6","3.8","0"].map(m =>
          `<button class="${n.mwst===m?"an":""}" data-akt="mwst" data-v="${m}">${m}&nbsp;%</button>`).join("")}
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
    <div class="inhalt">
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
    <div class="inhalt">
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
