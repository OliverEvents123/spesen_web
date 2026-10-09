// Erzeugt das Monats-PDF und die Buchungsliste als CSV.
// Aufbau des PDF: Seite 1 Kontierung, Seite 2 Belegliste, danach jeder Beleg.
//
// Jede Belegseite wird gleich aufgebaut: Kopfzeile mit den Eckdaten, darunter
// der Beleg eingepasst. Auch PDF-Belege werden eingebettet statt kopiert,
// damit die Kopfzeile nichts überdeckt.
// Verschlüsselte PDFs (Bankauszüge, viele Shop-Rechnungen) lassen sich nicht
// einbetten — ihre Datenströme sind unlesbar. Die werden gerendert.

const SpesenExport = (function () {

  const BREITE = 595.28, HOEHE = 841.89, RAND = 40;   // A4 hoch, in Punkt
  const ZAHLART = { karte:"Kreditkarte", bar:"Bar", vorkasse:"Vorauskasse" };
  const zahlartName = (z) => ZAHLART[z || "karte"] || z;
  const chf = (z) => Number(z).toFixed(2);
  const datumCH = (d) => new Date(d).toLocaleDateString("de-CH");

  function skriptLaden(src) {
    return new Promise((ok, fehler) => {
      const s = document.createElement("script");
      s.src = src;
      s.onload = () => ok();
      s.onerror = () => fehler(new Error("Bibliothek konnte nicht geladen werden: " + src));
      document.head.appendChild(s);
    });
  }

  async function pdfLibLaden() {
    if (!window.PDFLib) await skriptLaden("https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.min.js");
  }

  async function pdfJsLaden() {
    if (!window.pdfjsLib) {
      await skriptLaden("https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js");
      window.pdfjsLib.GlobalWorkerOptions.workerSrc =
        "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js";
    }
    return window.pdfjsLib;
  }

  async function seitenAlsBilder(puffer, skala) {
    const lib = await pdfJsLaden();
    const dok = await lib.getDocument({ data: puffer.slice(0) }).promise;
    const bilder = [];
    for (let i = 1; i <= dok.numPages; i++) {
      const seite = await dok.getPage(i);
      const sicht = seite.getViewport({ scale: skala || 2 });
      const c = document.createElement("canvas");
      c.width = Math.round(sicht.width); c.height = Math.round(sicht.height);
      const ctx = c.getContext("2d");
      ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, c.width, c.height);
      await seite.render({ canvasContext: ctx, viewport: sicht }).promise;
      const blob = await new Promise((r) => c.toBlob(r, "image/jpeg", 0.85));
      bilder.push(new Uint8Array(await blob.arrayBuffer()));
    }
    return bilder;
  }

  function speichern(blob, name) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  // ---------- PDF ----------
  async function pdf({ sb, belege, gruppen, monat, titel, dateiname, fortschritt }) {
    await pdfLibLaden();
    const { PDFDocument, StandardFonts, rgb } = PDFLib;

    const doc   = await PDFDocument.create();
    const font  = await doc.embedFont(StandardFonts.Helvetica);
    const fett  = await doc.embedFont(StandardFonts.HelveticaBold);
    const grau  = rgb(0.42, 0.45, 0.50);
    const blau  = rgb(0.13, 0.35, 0.66);
    const linie = rgb(0.84, 0.86, 0.89);
    const text  = rgb(0.1, 0.24, 0.42);

    const nummeriert = belege.map((b, i) => ({ ...b, nr: i + 1 }));

    function zeile(seite, y, spalten, werte, schrift, groesse, farbe) {
      let x = RAND;
      spalten.forEach((sp, i) => {
        let t = String(werte[i] ?? "");
        // zu lange Texte kürzen, damit nichts überlappt
        while (t && schrift.widthOfTextAtSize(t, groesse) > sp.w - 6) t = t.slice(0, -1);
        const b = schrift.widthOfTextAtSize(t, groesse);
        seite.drawText(t, { x: sp.re ? x + sp.w - b - 4 : x,
                            y, size: groesse, font: schrift, color: farbe || text });
        x += sp.w;
      });
    }

    function kopfzeile(seite, b, zusatz) {
      const t = `Beleg ${b.nr} · ${datumCH(b.beleg_datum)} · Konto ${b.konto_nummer} · ` +
                `Auftrag ${b.auftrag_nr} · MwSt ${b.mwst} % · ${zahlartName(b.zahlart)} · ` +
                `CHF ${chf(b.betrag)}${zusatz || ""}`;
      seite.drawText(t, { x:RAND, y:HOEHE-RAND+4, size:9, font, color:grau });
      seite.drawLine({ start:{x:RAND, y:HOEHE-RAND-6}, end:{x:BREITE-RAND, y:HOEHE-RAND-6},
                       thickness:0.5, color:linie });
    }

    // Ersatzseite, wenn keine Datei da ist oder sie nicht eingebettet werden kann
    function ersatzSeite(b, grund) {
      const p = doc.addPage([BREITE, HOEHE]);
      kopfzeile(p, b);

      const kx = RAND + 40, kb = BREITE - 2*RAND - 80;
      const ky = HOEHE/2 - 110, kh = 230;
      p.drawRectangle({ x:kx, y:ky, width:kb, height:kh,
                        borderColor:linie, borderWidth:1.5, color:rgb(0.98,0.98,0.99) });
      p.drawText(grund, { x:kx + (kb - fett.widthOfTextAtSize(grund,17))/2,
                          y:ky + kh - 46, size:17, font:fett, color:blau });

      const daten = [
        ["Beleg-Nr.", String(b.nr)],
        ["Datum",     datumCH(b.beleg_datum)],
        ["Konto",     `${b.konto_nummer} ${b.bezeichnung || ""}`.trim()],
        ["Auftrag",   String(b.auftrag_nr)],
        ["MwSt",      `${b.mwst} %`],
        ["Bezahlt",   zahlartName(b.zahlart)],
        ["Betrag",    `CHF ${chf(b.betrag)}`]
      ];
      let dy = ky + kh - 84;
      daten.forEach(([k, v]) => {
        p.drawText(k, { x:kx+26, y:dy, size:11, font, color:grau });
        p.drawText(v, { x:kx+130, y:dy, size:12, font:fett, color:text });
        dy -= 22;
      });
    }

    // ===== Seite 1: Kontierung =====
    let s1 = doc.addPage([BREITE, HOEHE]);
    let y  = HOEHE - RAND - 10;

    s1.drawText("Spesenabrechnung", { x:RAND, y, size:20, font:fett, color:blau });
    y -= 22;
    s1.drawText(titel, { x:RAND, y, size:11, font, color:grau });
    y -= 30;

    const tB = gruppen.reduce((t,g) => t+g.brutto, 0);
    const tS = gruppen.reduce((t,g) => t+g.steuer, 0);
    const tN = gruppen.reduce((t,g) => t+g.netto,  0);
    const tA = gruppen.reduce((t,g) => t+g.anzahl, 0);

    s1.drawRectangle({ x:RAND, y:y-6, width:BREITE-2*RAND, height:34, color:rgb(0.93,0.95,0.98) });
    s1.drawText(`${tA} Belege`, { x:RAND+12, y:y+6, size:12, font:fett, color:blau });
    const tot = `Total CHF ${chf(tB)}`;
    s1.drawText(tot, { x:BREITE-RAND-12-fett.widthOfTextAtSize(tot,14), y:y+4,
                       size:14, font:fett, color:blau });
    y -= 34;

    const sp = [{ w:48 }, { w:118 }, { w:58 }, { w:44 },
                { w:38, re:true }, { w:72, re:true }, { w:72, re:true }, { w:65, re:true }];
    zeile(s1, y, sp, ["Konto","Bezeichnung","Auftrag","MwSt","Belege","Brutto","MwSt-Betrag","Netto"],
          fett, 9, grau);
    y -= 6;
    s1.drawLine({ start:{x:RAND,y}, end:{x:BREITE-RAND,y}, thickness:1, color:linie });
    y -= 16;

    for (const g of gruppen) {
      if (y < RAND + 60) { s1 = doc.addPage([BREITE,HOEHE]); y = HOEHE - RAND - 10; }
      zeile(s1, y, sp, [g.konto, g.bezeichnung || "", g.auftrag, g.satz + " %",
                        g.anzahl, chf(g.brutto), chf(g.steuer), chf(g.netto)], font, 10);
      y -= 8;
      s1.drawLine({ start:{x:RAND,y}, end:{x:BREITE-RAND,y}, thickness:0.5, color:linie });
      y -= 16;
    }

    y -= 4;
    s1.drawRectangle({ x:RAND, y:y-6, width:BREITE-2*RAND, height:24, color:rgb(0.93,0.95,0.98) });
    zeile(s1, y, sp, ["Total","","","", tA, chf(tB), chf(tS), chf(tN)], fett, 10);
    s1.drawText(`Erstellt am ${datumCH(new Date())}`,
                { x:RAND, y:RAND-12, size:8, font, color:grau });

    // ===== Seite 2: Belegliste =====
    let s2 = doc.addPage([BREITE, HOEHE]);
    let z  = HOEHE - RAND - 10;
    s2.drawText("Belegliste", { x:RAND, y:z, size:16, font:fett, color:blau });
    z -= 26;

    const spL = [{ w:30 }, { w:66 }, { w:48 }, { w:96 }, { w:50 }, { w:40 }, { w:80 }, { w:65, re:true }];
    zeile(s2, z, spL, ["Nr","Datum","Konto","Bezeichnung","Auftrag","MwSt","Bezahlt","Betrag"],
          fett, 9, grau);
    z -= 6;
    s2.drawLine({ start:{x:RAND,y:z}, end:{x:BREITE-RAND,y:z}, thickness:1, color:linie });
    z -= 16;

    for (const b of nummeriert) {
      if (z < RAND + 40) { s2 = doc.addPage([BREITE,HOEHE]); z = HOEHE - RAND - 10; }
      zeile(s2, z, spL, [b.nr, datumCH(b.beleg_datum), b.konto_nummer, b.bezeichnung || "",
                         b.auftrag_nr, b.mwst + " %", zahlartName(b.zahlart), chf(b.betrag)], font, 10);
      z -= 8;
      s2.drawLine({ start:{x:RAND,y:z}, end:{x:BREITE-RAND,y:z}, thickness:0.5, color:linie });
      z -= 16;
    }

    // ===== Die Belege selbst =====
    const mitDatei = nummeriert.filter(b => b.datei_pfad);
    const urlVon = {};
    if (mitDatei.length) {
      const { data } = await sb.storage.from("belege")
        .createSignedUrls(mitDatei.map(b => b.datei_pfad), 900);
      (data || []).forEach(e => { if (e.signedUrl) urlVon[e.path] = e.signedUrl; });
    }

    const platzB = BREITE - 2*RAND;
    const platzH = HOEHE - 2*RAND - 26;

    async function bildSeite(bytes, istPng, b, zusatz) {
      const p = doc.addPage([BREITE, HOEHE]);
      kopfzeile(p, b, zusatz);
      const bild = istPng ? await doc.embedPng(bytes) : await doc.embedJpg(bytes);
      const f = Math.min(platzB / bild.width, platzH / bild.height);
      const w = bild.width * f, h = bild.height * f;
      p.drawImage(bild, { x:(BREITE-w)/2, y:RAND + (platzH-h)/2, width:w, height:h });
    }

    async function seiteEinbetten(quellSeite, b, zusatz) {
      const p = doc.addPage([BREITE, HOEHE]);
      kopfzeile(p, b, zusatz);
      const e = await doc.embedPage(quellSeite);
      const f = Math.min(platzB / e.width, platzH / e.height);
      const w = e.width * f, h = e.height * f;
      p.drawPage(e, { x:(BREITE-w)/2, y:RAND + (platzH-h)/2, width:w, height:h });
    }

    let i = 0;
    for (const b of nummeriert) {
      i++;
      if (fortschritt) fortschritt(i, nummeriert.length);

      if (!b.datei_pfad) { ersatzSeite(b, "Kein Beleg hinterlegt"); continue; }
      const url = urlVon[b.datei_pfad];
      if (!url) { ersatzSeite(b, "Belegdatei nicht gefunden"); continue; }

      let puffer;
      try { puffer = await (await fetch(url)).arrayBuffer(); }
      catch { ersatzSeite(b, "Belegdatei konnte nicht geladen werden"); continue; }

      const endung = (b.datei_pfad.split(".").pop() || "").toLowerCase();

      try {
        if (endung === "pdf") {
          const quelle = await PDFDocument.load(puffer, { ignoreEncryption:true });
          const anzahl = quelle.getPageCount();

          if (quelle.isEncrypted) {
            const bilder = await seitenAlsBilder(puffer, 2);
            for (let s = 0; s < bilder.length; s++)
              await bildSeite(bilder[s], false, b, bilder.length > 1 ? ` · Seite ${s+1} von ${bilder.length}` : "");
          } else {
            const seiten = quelle.getPages();
            for (let s = 0; s < anzahl; s++)
              await seiteEinbetten(seiten[s], b, anzahl > 1 ? ` · Seite ${s+1} von ${anzahl}` : "");
          }
        } else {
          await bildSeite(new Uint8Array(puffer), endung === "png", b, "");
        }
      } catch (fehler) {
        let geschafft = false;
        if (endung === "pdf") {
          try {
            const bilder = await seitenAlsBilder(puffer, 2);
            for (let s = 0; s < bilder.length; s++)
              await bildSeite(bilder[s], false, b, bilder.length > 1 ? ` · Seite ${s+1} von ${bilder.length}` : "");
            geschafft = true;
          } catch { /* unten abfangen */ }
        }
        if (!geschafft) ersatzSeite(b, "Beleg konnte nicht eingebettet werden");
      }
    }

    const bytes = await doc.save();
    speichern(new Blob([bytes], { type:"application/pdf" }), dateiname || `Spesen_${monat}.pdf`);
  }

  // ---------- CSV ----------
  function csv({ belege, gruppen, monat, titel, dateiname }) {
    const z = [];
    const r = (...felder) => z.push(felder.map(f => String(f ?? "")).join(";"));

    r("Spesenabrechnung", titel);
    r("");
    r("KONTIERUNG");
    r("Konto","Bezeichnung","Auftrag","MwSt-Satz","Belege","Brutto","MwSt-Betrag","Netto");
    gruppen.forEach(g => r(g.konto, g.bezeichnung || "", g.auftrag, g.satz,
                           g.anzahl, chf(g.brutto), chf(g.steuer), chf(g.netto)));
    r("Total","","","",
      gruppen.reduce((t,g)=>t+g.anzahl,0),
      chf(gruppen.reduce((t,g)=>t+g.brutto,0)),
      chf(gruppen.reduce((t,g)=>t+g.steuer,0)),
      chf(gruppen.reduce((t,g)=>t+g.netto,0)));
    r("");
    r("EINZELNE BELEGE");
    r("Nr","Datum","Konto","Bezeichnung","Auftrag","MwSt-Satz","Bezahlt mit","Betrag","Beleg","Gerät");
    belege.forEach((b, i) => r(i+1, datumCH(b.beleg_datum), b.konto_nummer, b.bezeichnung || "",
                               b.auftrag_nr, b.mwst, zahlartName(b.zahlart), chf(b.betrag),
                               b.datei_pfad ? "ja" : "fehlt", b.geraet));

    speichern(new Blob(["\uFEFF" + z.join("\r\n")], { type:"text/csv;charset=utf-8" }),
              dateiname || `Spesen_${monat}.csv`);
  }

  return { pdf, csv };
})();
