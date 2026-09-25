// Erzeugt das Monats-PDF und die Buchungsliste als CSV.
// Aufbau des PDF: Seite 1 Kontierung, Seite 2 Belegliste, danach jeder Beleg.

const SpesenExport = (function () {

  const BREITE = 595.28, HOEHE = 841.89, RAND = 40;   // A4 hoch, in Punkt
  const chf = (z) => Number(z).toFixed(2);
  const datumCH = (d) => new Date(d).toLocaleDateString("de-CH");

  function laden() {
    return new Promise((ok, fehler) => {
      if (window.PDFLib) return ok();
      const s = document.createElement("script");
      s.src = "https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.min.js";
      s.onload = () => ok();
      s.onerror = () => fehler(new Error("PDF-Bibliothek konnte nicht geladen werden."));
      document.head.appendChild(s);
    });
  }

  function speichern(blob, name) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  // ---------- PDF ----------
  async function pdf({ sb, belege, gruppen, monat, titel, fortschritt }) {
    await laden();
    const { PDFDocument, StandardFonts, rgb } = PDFLib;

    const doc   = await PDFDocument.create();
    const font  = await doc.embedFont(StandardFonts.Helvetica);
    const fett  = await doc.embedFont(StandardFonts.HelveticaBold);
    const grau  = rgb(0.42, 0.45, 0.50);
    const blau  = rgb(0.13, 0.35, 0.66);
    const linie = rgb(0.84, 0.86, 0.89);

    const nummeriert = belege.map((b, i) => ({ ...b, nr: i + 1 }));

    // Hilfsmittel zum Zeichnen einer Tabellenzeile
    function zeile(seite, y, spalten, werte, schrift, groesse, farbe) {
      let x = RAND;
      spalten.forEach((sp, i) => {
        const text = String(werte[i] ?? "");
        const b = schrift.widthOfTextAtSize(text, groesse);
        seite.drawText(text, {
          x: sp.re ? x + sp.w - b - 4 : x,
          y, size: groesse, font: schrift, color: farbe || rgb(0.1,0.24,0.42)
        });
        x += sp.w;
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

    s1.drawRectangle({ x:RAND, y:y-6, width:BREITE-2*RAND, height:34,
                       color:rgb(0.93,0.95,0.98) });
    s1.drawText(`${tA} Belege`, { x:RAND+12, y:y+6, size:12, font:fett, color:blau });
    const tot = `Total CHF ${chf(tB)}`;
    s1.drawText(tot, { x:BREITE-RAND-12-fett.widthOfTextAtSize(tot,14), y:y+4,
                       size:14, font:fett, color:blau });
    y -= 34;

    const sp = [
      { w:48 }, { w:118 }, { w:58 }, { w:44 },
      { w:38, re:true }, { w:72, re:true }, { w:72, re:true }, { w:65, re:true }
    ];
    const kopf = ["Konto","Bezeichnung","Auftrag","MwSt","Belege","Brutto","MwSt-Betrag","Netto"];

    zeile(s1, y, sp, kopf, fett, 9, grau);
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
    s1.drawRectangle({ x:RAND, y:y-6, width:BREITE-2*RAND, height:24,
                       color:rgb(0.93,0.95,0.98) });
    zeile(s1, y, sp, ["Total","","","", tA, chf(tB), chf(tS), chf(tN)], fett, 10);
    y -= 40;

    s1.drawText(`Erstellt am ${datumCH(new Date())}`,
                { x:RAND, y:RAND-12, size:8, font, color:grau });

    // ===== Seite 2: Belegliste =====
    let s2 = doc.addPage([BREITE, HOEHE]);
    let z  = HOEHE - RAND - 10;
    s2.drawText("Belegliste", { x:RAND, y:z, size:16, font:fett, color:blau });
    z -= 26;

    const spL = [
      { w:34 }, { w:72 }, { w:58 }, { w:110 }, { w:58 }, { w:44 }, { w:80, re:true }
    ];
    zeile(s2, z, spL, ["Nr","Datum","Konto","Bezeichnung","Auftrag","MwSt","Betrag"], fett, 9, grau);
    z -= 6;
    s2.drawLine({ start:{x:RAND,y:z}, end:{x:BREITE-RAND,y:z}, thickness:1, color:linie });
    z -= 16;

    for (const b of nummeriert) {
      if (z < RAND + 40) { s2 = doc.addPage([BREITE,HOEHE]); z = HOEHE - RAND - 10; }
      zeile(s2, z, spL, [b.nr, datumCH(b.beleg_datum), b.konto_nummer,
                         b.bezeichnung || "", b.auftrag_nr, b.mwst + " %", chf(b.betrag)], font, 10);
      z -= 8;
      s2.drawLine({ start:{x:RAND,y:z}, end:{x:BREITE-RAND,y:z}, thickness:0.5, color:linie });
      z -= 16;
    }

    // ===== Die Belege selbst =====
    const mitDatei = nummeriert.filter(b => b.datei_pfad);
    let urlVon = {};
    if (mitDatei.length) {
      const { data } = await sb.storage.from("belege")
        .createSignedUrls(mitDatei.map(b => b.datei_pfad), 900);
      (data || []).forEach(e => { if (e.signedUrl) urlVon[e.path] = e.signedUrl; });
    }

    let i = 0;
    for (const b of nummeriert) {
      i++;
      if (fortschritt) fortschritt(i, nummeriert.length);
      const url = urlVon[b.datei_pfad];
      const beschriftung =
        `Beleg ${b.nr} · ${datumCH(b.beleg_datum)} · Konto ${b.konto_nummer} · ` +
        `Auftrag ${b.auftrag_nr} · MwSt ${b.mwst} % · CHF ${chf(b.betrag)}`;

      if (!url) {
        const p = doc.addPage([BREITE, HOEHE]);
        p.drawText(beschriftung, { x:RAND, y:HOEHE-RAND, size:9, font, color:grau });
        p.drawText("Belegdatei nicht verfügbar.",
                   { x:RAND, y:HOEHE/2, size:12, font, color:grau });
        continue;
      }

      let puffer;
      try { puffer = await (await fetch(url)).arrayBuffer(); }
      catch {
        const p = doc.addPage([BREITE, HOEHE]);
        p.drawText(beschriftung, { x:RAND, y:HOEHE-RAND, size:9, font, color:grau });
        p.drawText("Belegdatei konnte nicht geladen werden.",
                   { x:RAND, y:HOEHE/2, size:12, font, color:grau });
        continue;
      }

      const endung = (b.datei_pfad.split(".").pop() || "").toLowerCase();

      try {
        if (endung === "pdf") {
          const quelle = await PDFDocument.load(puffer, { ignoreEncryption:true });
          const seiten = await doc.copyPages(quelle, quelle.getPageIndices());
          seiten.forEach((seite, nr) => {
            doc.addPage(seite);
            if (nr === 0) {
              const { width, height } = seite.getSize();
              const t = `Beleg ${b.nr}`;
              const br = fett.widthOfTextAtSize(t, 9);
              seite.drawRectangle({ x:width-br-18, y:height-22, width:br+10, height:16,
                                    color:rgb(1,1,1), opacity:0.85 });
              seite.drawText(t, { x:width-br-13, y:height-18, size:9, font:fett, color:blau });
            }
          });
        } else {
          const p = doc.addPage([BREITE, HOEHE]);
          p.drawText(beschriftung, { x:RAND, y:HOEHE-RAND, size:9, font, color:grau });
          const bild = (endung === "png")
            ? await doc.embedPng(puffer)
            : await doc.embedJpg(puffer);
          const maxB = BREITE - 2*RAND, maxH = HOEHE - 2*RAND - 24;
          const f = Math.min(maxB / bild.width, maxH / bild.height);
          const w = bild.width * f, h = bild.height * f;
          p.drawImage(bild, { x:(BREITE-w)/2, y:(HOEHE-24-h)/2, width:w, height:h });
        }
      } catch {
        const p = doc.addPage([BREITE, HOEHE]);
        p.drawText(beschriftung, { x:RAND, y:HOEHE-RAND, size:9, font, color:grau });
        p.drawText("Dieses Dateiformat konnte nicht eingebettet werden.",
                   { x:RAND, y:HOEHE/2, size:12, font, color:grau });
      }
    }

    const bytes = await doc.save();
    speichern(new Blob([bytes], { type:"application/pdf" }),
              `Spesen_${monat}${titel.includes("Alle") ? "_alle" : ""}.pdf`);
  }

  // ---------- CSV ----------
  function csv({ belege, gruppen, monat, titel }) {
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
    r("Nr","Datum","Konto","Bezeichnung","Auftrag","MwSt-Satz","Betrag","Gerät");
    belege.forEach((b, i) => r(i+1, datumCH(b.beleg_datum), b.konto_nummer,
                               b.bezeichnung || "", b.auftrag_nr, b.mwst,
                               chf(b.betrag), b.geraet));

    // BOM voran, damit Excel die Umlaute richtig anzeigt
    speichern(new Blob(["\uFEFF" + z.join("\r\n")],
              { type:"text/csv;charset=utf-8" }), `Spesen_${monat}.csv`);
  }

  return { pdf, csv };
})();
