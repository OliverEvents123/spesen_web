// Startet die App und verarbeitet alle Klicks und Feldänderungen.
// Die Bildschirme kommen aus ansichten.js, die Datenzugriffe aus daten.js.

async function start() {
  const { data } = await sb.auth.getSession();
  if (!data.session) { zeigeLogin(); return; }
  S.session = data.session;
  await ladeAlles();
  render();
}

// ---------- Dateifelder ----------
document.getElementById("kamera").addEventListener("change", (e) => {
  dateiGewaehlt(e.target.files[0]); e.target.value = "";
});
document.getElementById("datei").addEventListener("change", (e) => {
  dateiGewaehlt(e.target.files[0]); e.target.value = "";
});

// ---------- Ziehen und Ablegen (nur beim Erfassen) ----------
let ziehZaehler = 0;
document.addEventListener("dragenter", (e) => {
  if (S.ansicht !== "erfassen") return;
  e.preventDefault(); ziehZaehler++; document.body.classList.add("ziehen");
});
document.addEventListener("dragover", (e) => {
  if (S.ansicht !== "erfassen") return;
  e.preventDefault(); e.dataTransfer.dropEffect = "copy";
});
document.addEventListener("dragleave", () => {
  if (S.ansicht !== "erfassen") return;
  if (--ziehZaehler <= 0) { ziehZaehler = 0; document.body.classList.remove("ziehen"); }
});
document.addEventListener("drop", (e) => {
  if (S.ansicht !== "erfassen") return;
  e.preventDefault(); ziehZaehler = 0; document.body.classList.remove("ziehen");
  const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
  if (f) dateiGewaehlt(f);
});

// ---------- Klicks ----------
app.addEventListener("click", async (e) => {
  const el = e.target.closest("[data-akt]");
  if (!el) return;
  const a = el.dataset.akt;

  if (a === "abmelden") {
    await sb.auth.signOut(); S.session = null; S.auftraege = []; zeigeLogin(); return;
  }
  if (a === "tabListe")      { S.ansicht = "liste"; return render(); }
  if (a === "tabUebersicht") { S.ansicht = "uebersicht"; return ladeUebersicht(); }
  if (a === "neu")           { S.neu = leererBeleg(); S.zurueckZu = "liste";
                               S.ansicht = "erfassen"; return render(); }
  if (a === "bearbeiten")    { return belegBearbeiten(el.dataset.id, el.dataset.w); }

  if (a === "zurueck") {
    if (S.ansicht === "erfassen") {
      const woher = S.zurueckZu; S.neu = null;
      S.ansicht = (woher === "uebersicht") ? "uebersicht" : "liste";
      return render();
    }
    S.ansicht = "erfassen"; return render();
  }

  if (a === "kontoWahl")   { S.ansicht = "kontoWahl"; return render(); }
  if (a === "auftragWahl") { S.suche = ""; S.ansicht = "auftragWahl"; return render(); }
  if (a === "foto")        { document.getElementById("kamera").click(); return; }
  if (a === "waehlen")     { document.getElementById("datei").click(); return; }
  if (a === "belegAuf")    { return belegOeffnen(el.dataset.p); }
  if (a === "belegNeu") {
    S.neu.datei = null; S.neu.vorschau = null; S.neu.altPfad = null; S.neu.altUrl = null;
    return render();
  }

  if (a === "kontoSet") {
    const k = S.konten.find(x => x.nummer === el.dataset.nr);
    S.neu.konto = k;
    if (!S.neu.id) S.neu.mwst = String(k.mwst);   // beim Bearbeiten den Satz nicht überschreiben
    S.ansicht = "erfassen"; return render();
  }
  if (a === "auftragSet") {
    S.neu.auftrag = S.auftraege.find(x => x.id === el.dataset.id);
    S.ansicht = "erfassen"; return render();
  }
  if (a === "mwst") { S.neu.mwst = el.dataset.v; return render(); }
  if (a === "ziffer") {
    const z = el.dataset.z;
    if (z === "⌫") S.neu.roh = S.neu.roh.slice(0, -1);
    else if (S.neu.roh.length + z.length <= 7)
      S.neu.roh = (S.neu.roh + z).replace(/^0+(?=\d)/, "");
    return render();
  }

  // ---------- Export ----------
  if (a === "expCsv") {
    const belege = uGefiltert().map(b => ({ ...b, bezeichnung: kontoName(b.konto_nummer) }));
    SpesenExport.csv({ belege, gruppen: gruppiere(belege), monat: S.uMonat,
                       titel: uTitel(), dateiname: uDateiname().replace(".pdf", ".csv") });
    return;
  }

  if (a === "expPdf") {
    const belege = uGefiltert().map(b => ({ ...b, bezeichnung: kontoName(b.konto_nummer) }));
    el.disabled = true;
    try {
      await SpesenExport.pdf({
        sb, belege, gruppen: gruppiere(belege), monat: S.uMonat, titel: uTitel(),
        dateiname: uDateiname(),
        fortschritt: (i, n) => { el.textContent = `Beleg ${i} von ${n} …`; }
      });
    } catch (err) {
      alert(istNetzfehler(err) ? NETZTEXT
            : "Das PDF konnte nicht erstellt werden:\n" + (err.message || err));
    }
    el.textContent = "PDF erzeugen"; el.disabled = false;
    return;
  }

  // ---------- Löschen ----------
  if (a === "loeschen") {
    const n = S.neu;
    if (!confirm("Diesen Beleg wirklich löschen? Der Scan wird mitgelöscht.")) return;
    el.disabled = true; el.textContent = "Lösche …";
    const { error } = await sb.from("spesen_beleg").delete().eq("id", n.id);
    if (error) {
      el.disabled = false; el.textContent = "Diesen Beleg löschen";
      alert(istNetzfehler(error) ? NETZTEXT : "Konnte nicht gelöscht werden:\n" + error.message);
      return;
    }
    if (n.altPfad) { try { await sb.storage.from("belege").remove([n.altPfad]); } catch {} }
    await zurueckNachSpeichern("Beleg gelöscht.");
    return;
  }

  // ---------- Speichern (neu und geändert) ----------
  if (a === "speichern") {
    const n = S.neu, betrag = betragVon(n.roh);
    const urspruenglich = el.textContent;
    el.disabled = true;

    let pfad = n.altPfad;
    if (n.datei) {
      el.textContent = "Bereite Beleg auf …";
      try {
        const { blob, typ, ext } = await aufbereiten(n.datei);
        el.textContent = "Lade Beleg hoch …";
        pfad = `${ordnerName(S.session.user.email)}/${n.datum.slice(0,7)}/${Date.now()}.${ext}`;
        const { error: upFehler } = await sb.storage.from("belege")
          .upload(pfad, blob, { contentType: typ, upsert:false });
        if (upFehler) throw upFehler;
      } catch (err) {
        el.disabled = false; el.textContent = urspruenglich;
        alert(istNetzfehler(err) ? NETZTEXT
              : "Der Beleg konnte nicht hochgeladen werden:\n" + (err.message || err));
        return;
      }
    }

    el.textContent = "Speichere …";
    const daten = {
      beleg_datum:  n.datum,
      betrag:       betrag,
      mwst:         parseFloat(n.mwst),
      konto_nummer: n.konto.nummer,
      auftrag_nr:   n.auftrag.id,
      zahlart:      n.zahlart,
      datei_pfad:   pfad,
      monat:        n.datum.slice(0, 7)
    };

    let error;
    if (n.id) {
      ({ error } = await sb.from("spesen_beleg")
        .update({ ...daten, geaendert: new Date().toISOString() }).eq("id", n.id));
    } else {
      ({ error } = await sb.from("spesen_beleg")
        .insert({ ...daten, geraet: S.session.user.email }));
    }

    if (error) {
      el.disabled = false; el.textContent = urspruenglich;
      alert(istNetzfehler(error) ? NETZTEXT : "Konnte nicht gespeichert werden:\n" + error.message);
      return;
    }

    // Alte Datei erst nach erfolgreichem Speichern entfernen
    if (n.datei && n.altPfad && n.altPfad !== pfad) {
      try { await sb.storage.from("belege").remove([n.altPfad]); } catch {}
    }
    if (n.vorschau) URL.revokeObjectURL(n.vorschau);

    await zurueckNachSpeichern(n.id ? "Beleg geändert."
                                    : `Beleg über CHF ${chf(betrag)} gespeichert.`);
  }
});

// ---------- Feldänderungen ----------
app.addEventListener("change", (e) => {
  const f = e.target.dataset && e.target.dataset.feld;
  if (f === "datum")    { S.neu.datum   = e.target.value; }
  if (f === "zahlart")  { S.neu.zahlart = e.target.value; }
  if (f === "umonat")   { S.uMonat = e.target.value; S.uGeraet = ""; ladeUebersicht(); }
  if (f === "ugeraet")  { S.uGeraet = e.target.value; render(); }
  if (f === "uzahlart") { S.uZahlart = e.target.value; render(); }
});

start();
