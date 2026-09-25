// app.js
// Startet die App und verarbeitet alle Klicks und Feldänderungen.
// Die Bildschirme kommen aus ansichten.js, die Datenzugriffe aus daten.js.

async function start() {
  const { data } = await sb.auth.getSession();
  if (!data.session) { zeigeLogin(); return; }
  S.session = data.session;
  await ladeAlles();
  if (istBreit()) await ladeUebersicht(true); else render();
}

// Wechselt die Bildschirmbreite die Seite, neu aufbauen —
// am Rechner braucht es dafür die Übersichtsdaten.
window.matchMedia(`(min-width:${BREIT_AB}px)`).addEventListener("change", async (e) => {
  if (!S.session) return;
  if (e.matches && !S.uBelege.length) { await ladeUebersicht(true); return; }
  render();
});

// ---------- Dateifelder ----------
document.getElementById("kamera").addEventListener("change", (e) => {
  dateiGewaehlt(e.target.files[0]); e.target.value = "";
});
document.getElementById("datei").addEventListener("change", (e) => {
  dateiGewaehlt(e.target.files[0]); e.target.value = "";
});

// ---------- Ziehen und Ablegen ----------
// Beim Erfassen und am Rechner auch auf der Hauptseite
const ziehenErlaubt = () => S.session &&
  (S.ansicht === "erfassen" || (istBreit() && S.ansicht === "liste"));

let ziehZaehler = 0;
document.addEventListener("dragenter", (e) => {
  if (!ziehenErlaubt()) return;
  e.preventDefault(); ziehZaehler++; document.body.classList.add("ziehen");
});
document.addEventListener("dragover", (e) => {
  if (!ziehenErlaubt()) return;
  e.preventDefault(); e.dataTransfer.dropEffect = "copy";
});
document.addEventListener("dragleave", () => {
  if (!ziehenErlaubt()) return;
  if (--ziehZaehler <= 0) { ziehZaehler = 0; document.body.classList.remove("ziehen"); }
});
document.addEventListener("drop", (e) => {
  if (!ziehenErlaubt()) return;
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
    await sb.auth.signOut();
    S.session = null; S.auftraege = []; S.uBelege = []; S.benutzer = [];
    zeigeLogin(); return;
  }
  if (a === "tabListe")      { S.favEdit = null; S.ansicht = "liste"; return render(); }
  if (a === "tabUebersicht") { S.favEdit = null; S.ansicht = "uebersicht"; return ladeUebersicht(); }
  if (a === "neu")           { S.neu = leererBeleg();
                               S.zurueckZu = istBreit() ? "desktop" : "liste";
                               S.ansicht = "erfassen"; return render(); }
  if (a === "bearbeiten")    { return belegBearbeiten(el.dataset.id, el.dataset.w); }

  // ---------- Benutzerverwaltung (nur Admin) ----------
  if (a === "tabBenutzer") {
    S.ansicht = "benutzer";
    S.benEdit = istBreit() ? { neu:true, email:"", name:"", rolle:"user", gesperrt:false } : null;
    render();
    const j = await ladeBenutzer();
    if (!j.ok) alert("Benutzer konnten nicht geladen werden:\n" + (j.fehler || ""));
    return render();
  }

  if (a === "benNeu") {
    S.benEdit = { neu:true, email:"", name:"", rolle:"user", gesperrt:false };
    if (!istBreit()) S.ansicht = "benForm";
    return render();
  }

  if (a === "benBearbeiten") {
    const b = S.benutzer.find(x => x.email === el.dataset.e);
    if (!b) return;
    S.benEdit = { neu:false, email:b.email, name:b.name || "",
                  rolle:b.rolle, gesperrt: b.gesperrt || !b.aktiv };
    if (!istBreit()) S.ansicht = "benForm";
    return render();
  }

  if (a === "benRolle") { S.benEdit.rolle = el.dataset.v; return render(); }

  if (a === "benSperren") {
    const b = S.benEdit;
    const jetzt = !b.gesperrt;
    if (!confirm(jetzt ? `Anmeldung für ${b.email} sperren?`
                       : `${b.email} wieder freischalten?`)) return;
    const j = await benutzerRuf({ aktion:"aktiv", email:b.email, aktiv: !jetzt });
    if (!j.ok) { alert(j.fehler || "Hat nicht geklappt."); return; }
    S.meldung = jetzt ? "Benutzer gesperrt." : "Benutzer freigeschaltet.";
    S.benEdit = istBreit() ? { neu:true, email:"", name:"", rolle:"user", gesperrt:false } : null;
    S.ansicht = "benutzer";
    await ladeBenutzer(); return render();
  }

  if (a === "benSichern") {
    const b  = S.benEdit;
    const pw = (document.getElementById("bpw") || {}).value || "";
    const urspruenglich = el.textContent;
    el.disabled = true; el.textContent = "Speichere …";

    if (b.neu) {
      const mail = (document.getElementById("bmail").value || "").trim().toLowerCase();
      const name = (document.getElementById("bname").value || "").trim();
      if (!mail.includes("@")) {
        el.disabled = false; el.textContent = urspruenglich;
        alert("Bitte eine gültige E-Mail eingeben."); return;
      }
      if (pw.length < 6) {
        el.disabled = false; el.textContent = urspruenglich;
        alert("Das Passwort braucht mindestens sechs Zeichen."); return;
      }
      const j = await benutzerRuf({ aktion:"anlegen", email:mail, passwort:pw,
                                    name, rolle:b.rolle });
      if (!j.ok) {
        el.disabled = false; el.textContent = urspruenglich;
        alert(j.fehler || "Anlegen fehlgeschlagen."); return;
      }
      S.meldung = "Benutzer angelegt.";
    } else {
      const j1 = await benutzerRuf({ aktion:"rolle", email:b.email, rolle:b.rolle });
      if (!j1.ok) {
        el.disabled = false; el.textContent = urspruenglich;
        alert(j1.fehler || "Rolle konnte nicht geändert werden."); return;
      }
      if (pw) {
        if (pw.length < 6) {
          el.disabled = false; el.textContent = urspruenglich;
          alert("Das Passwort braucht mindestens sechs Zeichen."); return;
        }
        const j2 = await benutzerRuf({ aktion:"passwort", email:b.email, passwort:pw });
        if (!j2.ok) {
          el.disabled = false; el.textContent = urspruenglich;
          alert(j2.fehler || "Passwort konnte nicht gesetzt werden."); return;
        }
      }
      S.meldung = "Gespeichert.";
    }

    S.benEdit = istBreit() ? { neu:true, email:"", name:"", rolle:"user", gesperrt:false } : null;
    S.ansicht = "benutzer";
    await ladeBenutzer(); return render();
  }

  // ---------- Eigenes Passwort ----------
  if (a === "zuPasswort") { S.ansicht = "passwort"; return render(); }

  if (a === "pwSichern") {
    const p1 = document.getElementById("pw1").value;
    const p2 = document.getElementById("pw2").value;
    if (p1.length < 6) { alert("Das Passwort braucht mindestens sechs Zeichen."); return; }
    if (p1 !== p2)     { alert("Die beiden Passwörter stimmen nicht überein."); return; }
    el.disabled = true; el.textContent = "Speichere …";
    const { error } = await sb.auth.updateUser({ password: p1 });
    if (error) {
      el.disabled = false; el.textContent = "Passwort speichern";
      alert(istNetzfehler(error) ? NETZTEXT : "Konnte nicht geändert werden:\n" + error.message);
      return;
    }
    S.meldung = "Passwort geändert."; S.ansicht = "liste"; return render();
  }

  // ---------- Favoriten ----------
  if (a === "zuFavoriten") { S.ansicht = "favoriten"; return render(); }
  if (a === "favAnwenden") { return favAnwenden(el.dataset.id); }
  if (a === "favNeu")      { S.favEdit = leererFavorit(); S.ansicht = "favForm"; return render(); }

  if (a === "favBearbeiten") {
    const f = S.favoriten.find(x => String(x.id) === String(el.dataset.id));
    if (!f) return;
    S.favEdit = {
      id: f.id, name: f.name,
      konto: S.konten.find(x => x.nummer === f.konto_nummer)
             || { nummer:f.konto_nummer, bezeichnung:kontoName(f.konto_nummer) },
      auftrag: S.auftraege.find(x => x.id === f.auftrag_nr)
               || { id:f.auftrag_nr, name:f.auftrag_name || "" }
    };
    S.ansicht = "favForm"; return render();
  }

  if (a === "favHoch") { await favHoch(el.dataset.id); return render(); }

  if (a === "favSichern") {
    el.disabled = true; el.textContent = "Speichere …";
    const { error } = await favSpeichern(S.favEdit);
    if (error) {
      el.disabled = false; el.textContent = "Favorit speichern";
      alert(istNetzfehler(error) ? NETZTEXT : "Konnte nicht gespeichert werden:\n" + error.message);
      return;
    }
    S.favEdit = null;
    await ladeFavoriten();
    S.meldung = "Favorit gespeichert."; S.ansicht = "favoriten"; return render();
  }

  if (a === "favWeg") {
    if (!confirm("Diesen Favoriten löschen?")) return;
    const { error } = await favLoeschen(S.favEdit.id);
    if (error) {
      alert(istNetzfehler(error) ? NETZTEXT : "Konnte nicht gelöscht werden:\n" + error.message);
      return;
    }
    S.favEdit = null;
    await ladeFavoriten();
    S.meldung = "Favorit gelöscht."; S.ansicht = "favoriten"; return render();
  }

  if (a === "favMerken") {
    const n = S.neu;
    const vorschlag = n.konto.bezeichnung || n.konto.nummer;
    const name = prompt("Name des Favoriten:", vorschlag);
    if (name === null) return;
    const { error } = await favSpeichern({ id:null, name, konto:n.konto, auftrag:n.auftrag });
    if (error) {
      alert(istNetzfehler(error) ? NETZTEXT : "Konnte nicht gespeichert werden:\n" + error.message);
      return;
    }
    await ladeFavoriten();
    alert("Als Favorit gespeichert.");
    return;
  }

  // ---------- Zurück ----------
  if (a === "zurueck") {
    if (S.ansicht === "erfassen") {
      const woher = S.zurueckZu; S.neu = null;
      S.ansicht = (woher === "uebersicht" && !istBreit()) ? "uebersicht" : "liste";
      return render();
    }
    if (S.ansicht === "passwort")  { S.ansicht = "liste"; return render(); }
    if (S.ansicht === "favoriten") { S.ansicht = "liste"; return render(); }
    if (S.ansicht === "favForm")   { S.favEdit = null; S.ansicht = "favoriten"; return render(); }
    if (S.ansicht === "benForm")   { S.benEdit = null; S.ansicht = "benutzer"; return render(); }
    S.ansicht = S.favEdit ? "favForm" : "erfassen"; return render();
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

  // Auswahl trifft entweder den Favoriten oder den Beleg
  if (a === "kontoSet") {
    const k = S.konten.find(x => x.nummer === el.dataset.nr);
    if (S.favEdit) { S.favEdit.konto = k; S.ansicht = "favForm"; return render(); }
    S.neu.konto = k;
    if (!S.neu.id) S.neu.mwst = String(k.mwst);   // beim Bearbeiten den Satz nicht überschreiben
    S.ansicht = "erfassen"; return render();
  }
  if (a === "auftragSet") {
    const auf = S.auftraege.find(x => x.id === el.dataset.id);
    if (S.favEdit) { S.favEdit.auftrag = auf; S.ansicht = "favForm"; return render(); }
    S.neu.auftrag = auf;
    S.ansicht = "erfassen"; return render();
  }

  if (a === "mwst") { S.neu.mwst = el.dataset.v; return render(); }

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

  // ---------- Beleg löschen ----------
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

  // ---------- Beleg speichern ----------
  if (a === "speichern") {
    const n = S.neu, betrag = betragVon(n.betragText);
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

// Betrag und Favoritenname schon beim Tippen übernehmen,
// ohne neu zu zeichnen — sonst verliert das Feld den Fokus.
app.addEventListener("input", (e) => {
  const f = e.target.dataset && e.target.dataset.feld;
  if (f === "betrag" && S.neu) {
    S.neu.betragText = e.target.value;
    const knopf = app.querySelector('[data-akt="speichern"]');
    if (knopf) {
      const fertig = betragVon(S.neu.betragText) > 0 && S.neu.konto
                     && S.neu.auftrag && (S.neu.datei || S.neu.altPfad);
      knopf.disabled = !fertig;
      knopf.textContent = fertig ? (S.neu.id ? "Änderungen speichern" : "Speichern")
                                 : "Beleg, Konto, Auftrag und Betrag nötig";
    }
  }
  if (f === "favname" && S.favEdit) { S.favEdit.name = e.target.value; }
});

start();
