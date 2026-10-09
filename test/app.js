// app.js
// Startet die App und verarbeitet alle Klicks und Feldänderungen.
// Die Bildschirme kommen aus ansichten.js, die Datenzugriffe aus daten.js.

// Supabase erneuert das Anmelde-Token etwa stündlich. S.session muss mitziehen,
// sonst schicken die Aufrufe der Edge Functions nach einer Stunde ein
// abgelaufenes Token und scheitern.
sb.auth.onAuthStateChange((ereignis, session) => {
  if (session && S.session) S.session = session;
});

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
// Überall erlaubt, solange jemand angemeldet ist.
const ziehenErlaubt = () => !!S.session;

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
  // Liegt gerade kein Beleg offen, öffnet dateiGewaehlt einen neuen —
  // aber erst, nachdem der Dateityp geprüft ist.
  if (f) dateiGewaehlt(f);
});

// ---------- Speicherknopf nachziehen ----------
// Wird beim Tippen gerufen, damit das Feld den Fokus nicht verliert.
function knopfStand() {
  const n = S.neu;
  if (!n) return;
  const knopf = app.querySelector('[data-akt="speichern"]');
  if (!knopf) return;
  const geteilt  = Array.isArray(n.positionen);
  const hatBeleg = !!(n.datei || n.altPfad);
  const fertig = hatBeleg && (geteilt
    ? positionenFertig(n.positionen)
    : (betragVon(n.betragText) > 0 && n.konto && n.auftrag));
  knopf.disabled = !fertig;
  knopf.textContent = fertig ? (n.id ? "Änderungen speichern" : "Speichern")
                             : "Beleg, Konto, Auftrag und Betrag nötig";
}

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
  if (a === "tabUebersicht") { S.favEdit = null; S.ansicht = "uebersicht"; return ladeUebersicht(true); }
  if (a === "neu")           { S.neu = leererBeleg(); S.posIndex = null;
                               S.zurueckZu = istBreit() ? "desktop" : "liste";
                               S.ansicht = "erfassen"; return render(); }
  if (a === "bearbeiten")    { return belegBearbeiten(el.dataset.id, el.dataset.w); }

  // ---------- Zeitraum ----------
  // Beim Wechsel des Zeitraums fallen Gerät, Konto und Auftrag zurück auf
  // "Alle" — sie könnten im neuen Zeitraum gar nicht vorkommen.
  if (a === "periodeWahl") {
    const p = S.perioden.find(x => String(x.id) === String(el.dataset.id));
    if (!p) return;
    S.uVon = p.von; S.uBis = p.bis;
    S.uGeraet = ""; S.uKonto = ""; S.uAuftrag = "";
    return ladeUebersicht(true);
  }

  if (a === "periodeNeu") {
    if (S.perioden.length >= MAX_PERIODEN) {
      alert(`Es gehen höchstens ${MAX_PERIODEN} Perioden. `
            + "Lösch zuerst eine über das ✕ an der Kachel.");
      return;
    }
    const vorschlag = `${kurzDatum(S.uVon)}–${kurzDatum(S.uBis)}`;
    const name = prompt("Name der Periode:", vorschlag);
    if (name === null) return;
    const { error } = await periodeSpeichern(name || vorschlag, S.uVon, S.uBis);
    if (error) {
      alert(istNetzfehler(error) ? NETZTEXT
            : "Konnte nicht gemerkt werden:\n" + error.message);
      return;
    }
    await ladePerioden();
    S.meldung = "Periode gemerkt.";
    return render();
  }

  if (a === "periodeWeg") {
    const p = S.perioden.find(x => String(x.id) === String(el.dataset.id));
    if (!p) return;
    if (!confirm(`Periode „${p.name}" löschen? Die Belege bleiben unberührt.`)) return;
    const { error } = await periodeLoeschen(p.id);
    if (error) {
      alert(istNetzfehler(error) ? NETZTEXT
            : "Konnte nicht gelöscht werden:\n" + error.message);
      return;
    }
    await ladePerioden();
    S.meldung = "Periode gelöscht.";
    return render();
  }

  // ---------- Admin: Benutzer ----------
  if (a === "tabBenutzer") {
    S.ansicht = "benutzer"; S.kontEdit = null;
    S.benEdit = istBreit() ? { neu:true, email:"", name:"", rolle:"user", gesperrt:false } : null;
    render();

    const j = await ladeBenutzer();
    if (!j || j.ok === false) {
      alert("Benutzer konnten nicht geladen werden:\n" + ((j && j.fehler) || ""));
    }
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
      const name = (document.getElementById("bname") || {}).value || "";
      const jn = await benutzerRuf({ aktion:"name", email:b.email, name });
      if (!jn.ok) {
        el.disabled = false; el.textContent = urspruenglich;
        alert(jn.fehler || "Name konnte nicht gespeichert werden."); return;
      }

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

  // ---------- Admin: Konten ----------
  if (a === "tabKonten") {
    S.ansicht = "konten"; S.benEdit = null; S.kontEdit = null;
    render();
    await ladeKonten();
    if (istBreit()) S.kontEdit = leeresKonto();
    return render();
  }

  if (a === "kontoNeu") {
    S.kontEdit = leeresKonto();
    if (!istBreit()) S.ansicht = "kontoForm";
    return render();
  }

  if (a === "kontoBearbeiten") {
    const k = S.konten.find(x => x.nummer === el.dataset.nr);
    if (!k) return;
    S.kontEdit = { neu:false, nummer:k.nummer, bezeichnung:k.bezeichnung || "",
                   mwst:String(k.mwst), sortierung:String(k.sortierung ?? ""),
                   aktiv: k.aktiv !== false };
    if (!istBreit()) S.ansicht = "kontoForm";
    return render();
  }

  if (a === "kontoMwst") { S.kontEdit.mwst = el.dataset.v; return render(); }

  if (a === "kontoSichern") {
    const k = S.kontEdit;
    const nummer = String(k.nummer || "").trim();

    if (k.neu) {
      if (!nummer) { alert("Bitte eine Kontonummer eingeben."); return; }
      if (S.konten.some(x => String(x.nummer) === nummer)) {
        alert("Diese Kontonummer gibt es schon."); return;
      }
    }
    if (!String(k.bezeichnung || "").trim()) {
      alert("Bitte eine Bezeichnung eingeben."); return;
    }

    const urspruenglich = el.textContent;
    el.disabled = true; el.textContent = "Speichere …";
    const { error } = await kontoSpeichern({ ...k, nummer });
    if (error) {
      el.disabled = false; el.textContent = urspruenglich;
      alert(istNetzfehler(error) ? NETZTEXT
            : "Konnte nicht gespeichert werden:\n" + error.message);
      return;
    }

    await ladeKonten();
    S.meldung  = k.neu ? "Konto angelegt." : "Konto gespeichert.";
    S.kontEdit = istBreit() ? leeresKonto() : null;
    S.ansicht  = "konten";
    return render();
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
      auftrag: auftragObjekt(f.auftrag_nr, f.auftrag_name)
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

  // ---------- Beleg aufteilen ----------
  if (a === "aufteilen") {
    const n = S.neu;
    n.positionen = [
      { betragText: n.betragText || "", mwst: n.mwst, konto: n.konto, auftrag: n.auftrag },
      leerePosition({ konto: n.konto, auftrag: n.auftrag })
    ];
    S.posIndex = null;
    return render();
  }

  if (a === "posNeu") {
    const n = S.neu;
    const vor = n.positionen[n.positionen.length - 1];
    n.positionen.push(leerePosition({ konto: vor.konto, auftrag: vor.auftrag }));
    return render();
  }

  if (a === "posWeg") {
    const n = S.neu;
    n.positionen.splice(Number(el.dataset.i), 1);
    // Unter zwei Positionen ist die Aufteilung sinnlos — zurück zum einfachen Beleg.
    if (n.positionen.length < 2) {
      const p = n.positionen[0];
      if (p) { n.betragText = p.betragText; n.mwst = p.mwst;
               n.konto = p.konto; n.auftrag = p.auftrag; }
      n.positionen = null;
    }
    S.posIndex = null;
    return render();
  }

  if (a === "aufteilenWeg") {
    const n = S.neu;
    const p = n.positionen && n.positionen[0];
    if (p) { n.betragText = p.betragText; n.mwst = p.mwst;
             n.konto = p.konto; n.auftrag = p.auftrag; }
    n.positionen = null;
    S.posIndex = null;
    return render();
  }

  // ---------- Zurück ----------
  if (a === "zurueck") {
    if (S.ansicht === "erfassen") {
      if (S.neu && S.neu.vorschau) URL.revokeObjectURL(S.neu.vorschau);
      const woher = S.zurueckZu; S.neu = null; S.posIndex = null;
      S.ansicht = (woher === "uebersicht" && !istBreit()) ? "uebersicht" : "liste";
      return render();
    }
    if (S.ansicht === "passwort")  { S.ansicht = "liste"; return render(); }
    if (S.ansicht === "favoriten") { S.ansicht = "liste"; return render(); }
    if (S.ansicht === "favForm")   { S.favEdit = null; S.ansicht = "favoriten"; return render(); }
    if (S.ansicht === "benForm")   { S.benEdit = null; S.ansicht = "benutzer"; return render(); }
    if (S.ansicht === "kontoForm") { S.kontEdit = null; S.ansicht = "konten"; return render(); }
    if (S.ansicht === "benutzer" || S.ansicht === "konten") {
      S.benEdit = null; S.kontEdit = null; S.ansicht = "liste"; return render();
    }
    // bleibt: die Auswahlbildschirme für Konto und Auftrag
    S.posIndex = null;
    S.ansicht = S.favEdit ? "favForm" : "erfassen"; return render();
  }

  if (a === "kontoWahl") {
    S.posIndex = (el.dataset.i != null) ? Number(el.dataset.i) : null;
    S.ansicht = "kontoWahl"; return render();
  }
  if (a === "auftragWahl") {
    S.posIndex = (el.dataset.i != null) ? Number(el.dataset.i) : null;
    S.suche = ""; S.ansicht = "auftragWahl"; return render();
  }
  if (a === "foto")     { document.getElementById("kamera").click(); return; }
  if (a === "waehlen")  { document.getElementById("datei").click(); return; }
  if (a === "belegAuf") { return belegOeffnen(el.dataset.p); }
  if (a === "belegNeu") {
    if (S.neu.vorschau) URL.revokeObjectURL(S.neu.vorschau);
    S.neu.datei = null; S.neu.vorschau = null; S.neu.altPfad = null; S.neu.altUrl = null;
    return render();
  }

  // Auswahl trifft den Favoriten, eine Position oder den ganzen Beleg
  if (a === "kontoSet") {
    const k = S.konten.find(x => x.nummer === el.dataset.nr);
    if (S.favEdit) { S.favEdit.konto = k; S.ansicht = "favForm"; return render(); }
    if (S.posIndex != null && Array.isArray(S.neu.positionen)) {
      S.neu.positionen[S.posIndex].konto = k;
      S.posIndex = null; S.ansicht = "erfassen"; return render();
    }
    S.neu.konto = k;
    if (!S.neu.id) S.neu.mwst = String(k.mwst);   // beim Bearbeiten den Satz nicht überschreiben
    S.ansicht = "erfassen"; return render();
  }
  if (a === "auftragSet") {
    const auf = auftragObjekt(el.dataset.id);
    if (S.favEdit) { S.favEdit.auftrag = auf; S.ansicht = "favForm"; return render(); }
    if (S.posIndex != null && Array.isArray(S.neu.positionen)) {
      S.neu.positionen[S.posIndex].auftrag = auf;
      S.posIndex = null; S.ansicht = "erfassen"; return render();
    }
    S.neu.auftrag = auf;
    S.ansicht = "erfassen"; return render();
  }

  if (a === "mwst") { S.neu.mwst = el.dataset.v; return render(); }

  // ---------- Export ----------
  if (a === "expCsv") {
    const belege = uGefiltert().map(b => ({ ...b, bezeichnung: kontoName(b.konto_nummer) }));
    SpesenExport.csv({ belege, gruppen: gruppiere(belege),
                       monat: S.uVon.slice(0,7), von: S.uVon, bis: S.uBis,
                       titel: uTitel(), dateiname: uDateiname().replace(".pdf", ".csv") });
    return;
  }

  if (a === "expPdf") {
    const belege = uGefiltert().map(b => ({ ...b, bezeichnung: kontoName(b.konto_nummer) }));
    el.disabled = true;
    try {
      await SpesenExport.pdf({
        sb, belege, gruppen: gruppiere(belege),
        monat: S.uVon.slice(0,7), von: S.uVon, bis: S.uBis, titel: uTitel(),
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
    const n = S.neu;
    const geteilt = Array.isArray(n.positionen);

    // Aufgeteilt: je Position eine Zeile. Der Belegbetrag ist ihre Summe,
    // die erste Position steht zusätzlich oben, damit alte Auswertungen
    // und die Belegliste weiter funktionieren.
    const positionen = geteilt ? n.positionen.map(p => ({
      betrag:       betragVon(p.betragText),
      mwst:         parseFloat(p.mwst),
      konto_nummer: p.konto.nummer,
      auftrag_nr:   p.auftrag.id
    })) : null;

    const betrag = geteilt
      ? Math.round(positionen.reduce((t,p) => t + p.betrag, 0) * 100) / 100
      : betragVon(n.betragText);

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
      mwst:         geteilt ? positionen[0].mwst         : parseFloat(n.mwst),
      konto_nummer: geteilt ? positionen[0].konto_nummer : n.konto.nummer,
      auftrag_nr:   geteilt ? positionen[0].auftrag_nr   : n.auftrag.id,
      positionen:   positionen,
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
      // Die eben hochgeladene Datei wieder wegräumen, sonst bleibt sie
      // ohne Beleg im Speicher liegen. Beim nächsten Versuch kommt sie neu.
      if (n.datei && pfad !== n.altPfad) {
        try { await sb.storage.from("belege").remove([pfad]); } catch {}
      }
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
  if (!f) return;

  // Ein geleertes Datumsfeld würde ohne Datum und Monat speichern — alten Wert zurück.
  if (f === "datum") {
    if (!e.target.value) { e.target.value = S.neu.datum; return; }
    S.neu.datum = e.target.value; return;
  }
  if (f === "zahlart") { S.neu.zahlart = e.target.value; return; }

  // MwSt einer Position — kein Neuzeichnen nötig, das Feld zeigt den Wert schon
  if (f === "posmwst" && S.neu && Array.isArray(S.neu.positionen)) {
    S.neu.positionen[Number(e.target.dataset.i)].mwst = e.target.value;
    return;
  }

  if (f === "kaktiv" && S.kontEdit) { S.kontEdit.aktiv = e.target.checked; return; }

  // Zeitraum. Mit true wird erst gezeichnet, wenn die Daten da sind —
  // sonst wird das Datumsfeld mitten im Laden neu gebaut.
  if (f === "uvon") {
    if (!e.target.value) return;
    S.uVon = e.target.value;
    if (S.uBis < S.uVon) S.uBis = S.uVon;
    S.uGeraet = ""; S.uKonto = ""; S.uAuftrag = "";
    ladeUebersicht(true); return;
  }
  if (f === "ubis") {
    if (!e.target.value) return;
    S.uBis = e.target.value;
    if (S.uBis < S.uVon) S.uVon = S.uBis;
    S.uGeraet = ""; S.uKonto = ""; S.uAuftrag = "";
    ladeUebersicht(true); return;
  }

  if (f === "ugeraet")  { S.uGeraet  = e.target.value; render(); return; }
  if (f === "ukonto")   { S.uKonto   = e.target.value; render(); return; }
  if (f === "uauftrag") { S.uAuftrag = e.target.value; render(); return; }
  if (f === "uzahlart") { S.uZahlart = e.target.value; render(); return; }
});

// Beim Tippen übernehmen, ohne neu zu zeichnen — sonst verliert das Feld den Fokus.
app.addEventListener("input", (e) => {
  const f = e.target.dataset && e.target.dataset.feld;
  if (!f) return;

  if (f === "betrag" && S.neu) {
    S.neu.betragText = e.target.value;
    knopfStand();
    return;
  }

  if (f === "posbetrag" && S.neu && Array.isArray(S.neu.positionen)) {
    S.neu.positionen[Number(e.target.dataset.i)].betragText = e.target.value;
    const gesamt = document.getElementById("gesamt");
    if (gesamt) gesamt.textContent = "CHF " + chf(positionenSumme(S.neu.positionen));
    knopfStand();
    return;
  }

  if (f === "favname" && S.favEdit) { S.favEdit.name = e.target.value; return; }

  if (f === "knummer" && S.kontEdit) { S.kontEdit.nummer      = e.target.value; return; }
  if (f === "kbez"    && S.kontEdit) { S.kontEdit.bezeichnung = e.target.value; return; }
  if (f === "ksort"   && S.kontEdit) { S.kontEdit.sortierung  = e.target.value; return; }
});

start();
