// aktionen.ts
// Alle Klicks und Feldänderungen. Wie in der alten app.js: jeder Knopf trägt
// data-akt="…", ein einziger Verteiler entscheidet, was passiert.
// Inhaltlich 1:1 übernommen; statt den Knopf direkt zu verändern, zeigt
// laeuft(akt, text) z. B. "Speichere …" an.

import { S, sb, render, laeuft } from "./zustand";
import {
  NETZTEXT, GESPERRT_TEXT, OHNE_KST, istBreit, istNetzfehler, chf, betragVon,
  ordnerName, statusName, statusVon, buchungsBetrag, periode, periodeUm, kurzDatum, MAX_PERIODEN
} from "./grundlagen";
import {
  leererBeleg, leerePosition, leererFavorit, leererBenutzer, leeresKonto, kontoName,
  ladeAlles, ladeKonten, ladeFavoriten, ladeFreigabe, ladeZuweisungen, ladeVerlauf,
  ladeUebersicht, ladeBenutzer, benutzerRuf, zeitraumLaden, kontoHoch,
  kontoSpeichern, favSpeichern, favLoeschen, favHoch, favAnwenden, favUebernehmen, belegBearbeiten,
  belegOeffnen, auftragObjekt, gruppiere, uGefiltert, uTitel, uDateiname, belegeFreigeben,
  eigeneErfasste, zurueckNachSpeichern, aufbereiten, entscheiden, umkontieren,
  zuruecksetzen, zeigeLogin, ladePerioden, periodeSpeichern, periodeLoeschen, personName,
  leeresGeraet, ladeGeraete, geraetSpeichern, geraetLoeschen, geraetName, geraetGewaehlt, geraetFehlt,
  standardBereich, freigabeIm, freigabeGefiltert, meineGefiltert,
  ladeAuftraege, kstJahrSetzen, kstJahrLoeschen, kstRegelSetzen, kstRegelLoeschen
} from "./daten";
import { SpesenExport } from "./export";

const wert = (id: string) => ((document.getElementById(id) as HTMLInputElement) || ({} as any)).value || "";

// ---------- Klicks ----------
export async function klick(el: HTMLElement) {
  const a = el.dataset.akt;
  // Eine Meldung ("Gespeichert.") gilt bis zur nächsten Aktion.
  S.meldung = null;
  try {
    await klickAusfuehren(a, el.dataset);
  } finally {
    // Arbeitet kein Knopf mehr, "Speichere …" wieder entfernen.
    if (S.laeuft) { S.laeuft = null; render(); }
  }
}

async function klickAusfuehren(a: string, d: DOMStringMap) {
  if (a === "abmelden") {
    await sb.auth.signOut();
    S.auftraege = []; S.uBelege = []; S.belege = []; S.offeneEigene = []; S.benutzer = [];
    S.freigabe = []; S.verlauf = []; S.namen = {}; S.neu = null; S.ansicht = "liste";
    S.meineKst = []; S.meineKonten = []; S.meinePersonen = []; S.bereich = ""; S.verlaufBelege = {};
    return zeigeLogin();
  }
  // Hauptseiten: was gerade offen war (Formulare, Prüfbeleg) schliessen
  const wechsel = (ansicht: string) => {
    S.favEdit = null; S.benEdit = null; S.kontEdit = null; S.geraetEdit = null; S.wahlOffen = null;
    if (S.ansicht === "freigabe" || S.ansicht === "erfassen") S.neu = null;
    S.ansicht = ansicht;
  };
  if (a === "tabListe")      { wechsel("liste"); return render(); }
  // Übersicht und Freigabe gibt es je Abschnitt (data-b: pl, sup, admin).
  // Am Handy ohne Abschnitt: alles, was ich sehen darf.
  if (a === "tabUebersicht") {
    const neu = d.b || S.bereich || standardBereich();
    if (neu !== S.bereich) { S.uAuftrag = ""; S.uKonto = ""; S.uGeraet = ""; S.uGruppe = ""; }
    S.bereich = neu;
    wechsel("uebersicht"); render();
    await ladeUebersicht(true);
    if (S.istPruefer) { await ladeVerlauf(); render(); }
    return;
  }
  if (a === "zuProfil")      { wechsel("profil"); return render(); }
  if (a === "neu") {
    const von = ["liste", "uebersicht", "freigabe"].includes(S.ansicht) ? S.ansicht : "liste";
    wechsel("erfassen");
    S.neu = leererBeleg(); S.posIndex = null; S.zurueckZu = von;
    return render();
  }
  if (a === "bearbeiten") return belegBearbeiten(d.id, d.w);

  // ---------- Zeitraum und Filter ----------
  // Beim Wechsel des Zeitraums fallen Person, Konto und KST zurück auf
  // "Alle" — sie könnten im neuen Zeitraum gar nicht vorkommen.
  if (a === "periode") {
    const p = periodeUm(S.uVon, Number(d.v));
    S.uVon = p.von; S.uBis = p.bis; S.eigenerZeitraum = false;
    return zeitraumLaden();
  }
  if (a === "periodeJetzt") {
    const p = periode(0);
    S.uVon = p.von; S.uBis = p.bis; S.eigenerZeitraum = false;
    return zeitraumLaden();
  }
  if (a === "eigenerZeitraum") { S.eigenerZeitraum = !S.eigenerZeitraum; return render(); }
  // Filter: data-b="m" für Meine Belege, sonst die Übersicht
  if (a === "filterAuf") {
    if (d.b === "m") S.mFilterOffen = !S.mFilterOffen; else S.uFilterOffen = !S.uFilterOffen;
    return render();
  }
  if (a === "filterWeg") {
    S[d.f] = "";
    if (d.f === "bSuche") S.bSucheNeu++;   // Suchfelder neu aufbauen, damit sie leer sind
    return render();
  }
  // ---------- Gespeicherte Zeiträume ----------
  if (a === "periodeWahl") {
    const p = S.perioden.find((x) => String(x.id) === String(d.id));
    if (!p) return;
    S.uVon = p.von; S.uBis = p.bis; S.eigenerZeitraum = false;
    return zeitraumLaden();
  }
  if (a === "periodeNeu") {
    if (S.perioden.length >= MAX_PERIODEN) {
      alert(`Es gehen höchstens ${MAX_PERIODEN} gespeicherte Zeiträume. Lösch zuerst einen über das ✕.`);
      return;
    }
    const vorschlag = `${kurzDatum(S.uVon)}–${kurzDatum(S.uBis)}`;
    const name = prompt("Name für diesen Zeitraum:", vorschlag);
    if (name === null) return;
    const { error } = await periodeSpeichern(name || vorschlag, S.uVon, S.uBis);
    if (error) {
      alert(istNetzfehler(error) ? NETZTEXT : "Konnte nicht gespeichert werden:\n" + error.message);
      return;
    }
    await ladePerioden();
    S.eigenerZeitraum = false;
    S.meldung = "Zeitraum gespeichert — jetzt mit einem Klick wählbar.";
    return render();
  }
  if (a === "periodeWeg") {
    const p = S.perioden.find((x) => String(x.id) === String(d.id));
    if (!p) return;
    if (!confirm(`Gespeicherten Zeitraum „${p.name}" löschen? Die Belege bleiben unberührt.`)) return;
    const { error } = await periodeLoeschen(p.id);
    if (error) { alert(istNetzfehler(error) ? NETZTEXT : error.message); return; }
    await ladePerioden();
    return render();
  }

  // ---------- Admin: Benutzer ----------
  if (a === "tabBenutzer") {
    wechsel("benutzer");
    S.benEdit = istBreit() ? leererBenutzer() : null;
    render();
    const [j] = await Promise.all([ladeBenutzer(), ladeZuweisungen()]);
    if (!j || j.ok === false) alert("Benutzer konnten nicht geladen werden:\n" + ((j && j.fehler) || ""));
    return render();
  }

  if (a === "benNeu") {
    S.benEdit = leererBenutzer();
    if (!istBreit()) S.ansicht = "benForm";
    return render();
  }

  if (a === "benBearbeiten") {
    const b = S.benutzer.find((x) => x.email === d.e);
    if (!b) return;
    S.benEdit = { neu: false, email: b.email, name: b.name || "",
                  rolle: b.rolle, gesperrt: b.gesperrt || !b.aktiv,
                  pruefung: !!b.pruefung, pruefungAlt: !!b.pruefung };
    if (!istBreit()) S.ansicht = "benForm";
    return render();
  }

  if (a === "benRolle") { S.benEdit.rolle = d.v; return render(); }

  if (a === "benSperren") {
    const b = S.benEdit;
    const jetzt = !b.gesperrt;
    if (!confirm(jetzt ? `Anmeldung für ${b.email} sperren?` : `${b.email} wieder freischalten?`)) return;
    laeuft(a, "Moment …");
    const j = await benutzerRuf({ aktion: "aktiv", email: b.email, aktiv: !jetzt });
    if (!j.ok) { alert(j.fehler || "Hat nicht geklappt."); return; }
    S.meldung = jetzt ? "Benutzer gesperrt." : "Benutzer freigeschaltet.";
    S.benEdit = istBreit() ? leererBenutzer() : null;
    S.ansicht = "benutzer";
    await ladeBenutzer(); return render();
  }

  if (a === "benSichern") {
    const b  = S.benEdit;
    const pw = wert("bpw");
    laeuft(a, "Speichere …");

    if (b.neu) {
      const mail = wert("bmail").trim().toLowerCase();
      const name = wert("bname").trim();
      if (!mail.includes("@"))  { alert("Bitte eine gültige E-Mail eingeben."); return; }
      if (pw.length < 6)        { alert("Das Passwort braucht mindestens sechs Zeichen."); return; }
      const j = await benutzerRuf({ aktion: "anlegen", email: mail, passwort: pw,
                                    name, rolle: b.rolle, pruefung: !!b.pruefung });
      if (!j.ok) { alert(j.fehler || "Anlegen fehlgeschlagen."); return; }
      // Vorgemerkte Zuweisungen jetzt speichern — nur die, die zur Rolle passen
      const vor = b.vor || { kst: [], konto: [], person: [] };
      const pl = b.rolle === "projektleiter", sup = b.rolle === "supervisor";
      const auftraege = [
        ...(pl  ? vor.kst.map((x) => sb.from("spesen_zuweisung").insert({ email: mail, auftrag_nr: x })) : []),
        ...(sup ? vor.konto.map((x) => sb.from("spesen_zuweisung_konto").insert({ email: mail, konto_nummer: x })) : []),
        ...(sup ? vor.person.map((x) => sb.from("spesen_zuweisung_person").insert({ email: mail, person: x })) : [])
      ];
      const ergebnisse = await Promise.all(auftraege);
      const fehler = ergebnisse.filter((r) => r.error && r.error.code !== "23505");
      if (auftraege.length) await ladeZuweisungen();
      S.meldung = "Benutzer angelegt." + (auftraege.length
        ? ` ${auftraege.length - fehler.length} Zuweisung${auftraege.length - fehler.length === 1 ? "" : "en"} gespeichert.` : "");
      if (fehler.length) alert(`${fehler.length} Zuweisung(en) konnten nicht gespeichert werden — bitte beim Benutzer unter „Ändern“ nachtragen.\n`
                               + fehler[0].error.message);
    } else {
      const name = wert("bname");
      const jn = await benutzerRuf({ aktion: "name", email: b.email, name });
      if (!jn.ok) { alert(jn.fehler || "Name konnte nicht gespeichert werden."); return; }

      const j1 = await benutzerRuf({ aktion: "rolle", email: b.email, rolle: b.rolle });
      if (!j1.ok) { alert(j1.fehler || "Rolle konnte nicht geändert werden."); return; }
      if (pw) {
        if (pw.length < 6) { alert("Das Passwort braucht mindestens sechs Zeichen."); return; }
        const j2 = await benutzerRuf({ aktion: "passwort", email: b.email, passwort: pw });
        if (!j2.ok) { alert(j2.fehler || "Passwort konnte nicht gesetzt werden."); return; }
      }
      if (!!b.pruefung !== !!b.pruefungAlt) {
        const j3 = await benutzerRuf({ aktion: "pruefung", email: b.email, pruefung: !!b.pruefung });
        if (!j3.ok) { alert(j3.fehler || "„Prüfung einrichten“ konnte nicht gespeichert werden."); return; }
      }
      S.meldung = "Gespeichert.";
    }

    S.benEdit = istBreit() ? leererBenutzer() : null;
    S.ansicht = "benutzer";
    await ladeBenutzer(); return render();
  }

  // ---------- Admin: Zuweisungen ----------
  if (a === "zuwNeu" || a === "zuwKontoNeu" || a === "zuwPersonNeu") {
    const neu = wert(d.f).trim();
    if (!neu) { alert(a === "zuwNeu" ? "Bitte eine KST eingeben." : a === "zuwKontoNeu" ? "Bitte ein Konto wählen."
                                     : "Bitte eine Person wählen."); return; }
    if (a === "zuwNeu" && neu !== OHNE_KST.id && S.auftraege.length
        && !S.auftraege.some((x) => x.id === neu)
        && !confirm(`KST ${neu} ist in der Auswahl nicht bekannt. Trotzdem zuweisen?`)) return;
    // Neuer Benutzer: nur vormerken — gespeichert wird mit "Benutzer anlegen"
    if (S.benEdit && S.benEdit.neu) {
      const art = a === "zuwNeu" ? "kst" : a === "zuwKontoNeu" ? "konto" : "person";
      const vor = S.benEdit.vor || (S.benEdit.vor = { kst: [], konto: [], person: [] });
      if (vor[art].includes(neu)) { alert("Ist schon vorgemerkt."); return; }
      vor[art].push(neu);
      const feld = document.getElementById(d.f) as HTMLInputElement;
      if (feld) feld.value = "";
      return render();
    }
    const { error } = a === "zuwNeu"
      ? await sb.from("spesen_zuweisung").insert({ email: d.e, auftrag_nr: neu })
      : a === "zuwKontoNeu"
      ? await sb.from("spesen_zuweisung_konto").insert({ email: d.e, konto_nummer: neu })
      : await sb.from("spesen_zuweisung_person").insert({ email: d.e, person: neu });
    if (error) {
      alert(error.code === "23505" ? "Ist schon zugewiesen."
            : istNetzfehler(error) ? NETZTEXT : "Nicht gespeichert:\n" + error.message);
      return;
    }
    const feld = document.getElementById(d.f) as HTMLInputElement;
    if (feld) feld.value = "";
    await ladeZuweisungen(); return render();
  }

  if (a === "zuwWeg" || a === "zuwKontoWeg" || a === "zuwPersonWeg") {
    if (S.benEdit && S.benEdit.neu && S.benEdit.vor) {
      const art = a === "zuwWeg" ? "kst" : a === "zuwKontoWeg" ? "konto" : "person";
      S.benEdit.vor[art] = S.benEdit.vor[art].filter((x) => x !== d.v);
      return render();
    }
    const { error } = a === "zuwWeg"
      ? await sb.from("spesen_zuweisung").delete().eq("email", d.e).eq("auftrag_nr", d.v)
      : a === "zuwKontoWeg"
      ? await sb.from("spesen_zuweisung_konto").delete().eq("email", d.e).eq("konto_nummer", d.v)
      : await sb.from("spesen_zuweisung_person").delete().eq("email", d.e).eq("person", d.v);
    if (error) { alert(istNetzfehler(error) ? NETZTEXT : error.message); return; }
    await ladeZuweisungen(); return render();
  }

  // ---------- Admin: Konten ----------
  if (a === "tabKonten") {
    wechsel("konten");
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
    const k = S.konten.find((x) => x.nummer === d.nr);
    if (!k) return;
    S.kontEdit = { neu: false, nummer: k.nummer, bezeichnung: k.bezeichnung || "",
                   mwst: String(k.mwst), sortierung: String(k.sortierung ?? ""),
                   aktiv: k.aktiv !== false };
    if (!istBreit()) S.ansicht = "kontoForm";
    return render();
  }

  if (a === "kontoMwst") { S.kontEdit.mwst = d.v; return render(); }

  if (a === "kontoHoch") {
    const fehler = await kontoHoch(d.nr);
    if (fehler) alert(istNetzfehler(fehler) ? NETZTEXT : "Reihenfolge nicht gespeichert:\n" + fehler.message);
    return render();
  }

  if (a === "kontoSichern") {
    const k = S.kontEdit;
    const nummer = String(k.nummer || "").trim();
    if (k.neu) {
      if (!nummer) { alert("Bitte eine Kontonummer eingeben."); return; }
      if (S.konten.some((x) => String(x.nummer) === nummer)) { alert("Diese Kontonummer gibt es schon."); return; }
    }
    if (!String(k.bezeichnung || "").trim()) { alert("Bitte eine Bezeichnung eingeben."); return; }

    laeuft(a, "Speichere …");
    const { error } = await kontoSpeichern({ ...k, nummer });
    if (error) {
      alert(istNetzfehler(error) ? NETZTEXT : "Konnte nicht gespeichert werden:\n" + error.message);
      return;
    }
    await ladeKonten();
    S.meldung  = k.neu ? "Konto angelegt." : "Konto gespeichert.";
    S.kontEdit = istBreit() ? leeresKonto() : null;
    S.ansicht  = "konten";
    return render();
  }

  // ---------- Admin: Kostenstellen (welche erscheinen in der Auswahl) ----------
  if (a === "tabKst") {
    wechsel("kst"); render();
    S.auftraege = await ladeAuftraege();
    return render();
  }

  if (a === "kstJahrNeu" || a === "kstJahrSchalten" || a === "kstJahrWeg" || a === "kstRegelNeu" || a === "kstRegelWeg") {
    let fehler: any = null;
    if (a === "kstJahrNeu") {
      const j = Number(wert("kstjahr").trim());
      if (!(j >= 2000 && j <= new Date().getFullYear() + 5)) { alert("Bitte ein Jahr wie 2027 eingeben."); return; }
      if (S.kstJahre.some((x) => x.jahr === j)) { alert(`${j} ist schon in der Liste.`); return; }
      ({ error: fehler } = await kstJahrSetzen(j, true));
    } else if (a === "kstJahrSchalten") {
      const j = S.kstJahre.find((x) => String(x.jahr) === d.v);
      if (!j) return;
      ({ error: fehler } = await kstJahrSetzen(j.jahr, !j.sichtbar));
    } else if (a === "kstJahrWeg") {
      if (!confirm(`Jahr ${d.v} aus der Liste nehmen? Die Belege bleiben unberührt.`)) return;
      ({ error: fehler } = await kstJahrLoeschen(Number(d.v)));
    } else if (a === "kstRegelNeu") {
      // d.v: "1" = immer anzeigen, "0" = ausblenden; d.f: Eingabefeld
      const nr = wert(d.f).trim();
      if (!/^[0-9A-Za-z.\-]{1,20}$/.test(nr)) { alert("Bitte eine KST-Nummer eingeben (nur Ziffern und Buchstaben)."); return; }
      const sichtbar = d.v === "1";
      const schon = S.kstRegeln.find((x) => x.auftrag_nr === nr);
      if (schon && schon.sichtbar !== sichtbar &&
          !confirm(`KST ${nr} steht schon unter „${schon.sichtbar ? "Immer anzeigen" : "Ausblenden"}“. Verschieben?`)) return;
      ({ error: fehler } = await kstRegelSetzen(nr, sichtbar));
      const feld = document.getElementById(d.f) as HTMLInputElement;
      if (feld && !fehler) feld.value = "";
    } else {
      ({ error: fehler } = await kstRegelLoeschen(d.v));
    }
    if (fehler) { alert(istNetzfehler(fehler) ? NETZTEXT : "Nicht gespeichert:\n" + fehler.message); return; }
    laeuft("kstLaden", "Lade Auswahl …");
    S.auftraege = await ladeAuftraege();
    S.laeuft = null;
    return render();
  }

  // ---------- Admin: Geräte ----------
  if (a === "tabGeraete") {
    wechsel("geraete");
    if (istBreit()) S.geraetEdit = leeresGeraet();
    render();
    await ladeGeraete();
    return render();
  }

  if (a === "geraetNeu") {
    S.geraetEdit = leeresGeraet();
    if (!istBreit()) S.ansicht = "geraetForm";
    return render();
  }

  if (a === "geraetBearbeiten") {
    const g = S.zahlgeraete.find((x) => String(x.id) === String(d.id));
    if (!g) return;
    S.geraetEdit = { neu: false, id: g.id, name: g.name || "", auftrag_nr: g.auftrag_nr || "",
                     aktiv: g.aktiv !== false };
    if (!istBreit()) S.ansicht = "geraetForm";
    return render();
  }

  if (a === "geraetSichern") {
    const g = S.geraetEdit;
    const name = String(g.name || "").trim(), kst = String(g.auftrag_nr || "").trim();
    if (!name) { alert("Bitte einen Namen für das Gerät eingeben."); return; }
    if (!kst)  { alert("Bitte eine KST eingeben."); return; }
    if (kst !== OHNE_KST.id && S.auftraege.length && !S.auftraege.some((x) => x.id === kst)
        && !confirm(`KST ${kst} ist in FileMaker (dieses und letztes Jahr) nicht bekannt. Trotzdem speichern?`)) return;
    laeuft(a, "Speichere …");
    const { error } = await geraetSpeichern({ ...g, name, auftrag_nr: kst });
    if (error) {
      alert(istNetzfehler(error) ? NETZTEXT : "Konnte nicht gespeichert werden:\n" + error.message);
      return;
    }
    await ladeGeraete();
    S.meldung    = g.neu ? "Gerät angelegt." : "Gerät gespeichert.";
    S.geraetEdit = istBreit() ? leeresGeraet() : null;
    S.ansicht    = "geraete";
    return render();
  }

  if (a === "geraetWeg") {
    const g = S.geraetEdit;
    if (!g || g.neu) return;
    if (!confirm(`Gerät „${g.name}" löschen?`)) return;
    laeuft(a, "Lösche …");
    const { error } = await geraetLoeschen(g.id);
    if (error) {
      // 23503: steckt schon in Belegen
      alert(error.code === "23503"
        ? "Dieses Gerät steckt schon in Belegen und lässt sich darum nicht löschen. Schalte „Steht in der Auswahl“ aus — dann ist es nicht mehr wählbar."
        : istNetzfehler(error) ? NETZTEXT : "Konnte nicht gelöscht werden:\n" + error.message);
      return;
    }
    await ladeGeraete();
    S.meldung    = "Gerät gelöscht.";
    S.geraetEdit = istBreit() ? leeresGeraet() : null;
    S.ansicht    = "geraete";
    return render();
  }

  // ---------- Eigenes Passwort ----------
  if (a === "zuPasswort") { wechsel("passwort"); return render(); }

  if (a === "pwSichern") {
    const p1 = wert("pw1"), p2 = wert("pw2");
    if (p1.length < 6) { alert("Das Passwort braucht mindestens sechs Zeichen."); return; }
    if (p1 !== p2)     { alert("Die beiden Passwörter stimmen nicht überein."); return; }
    laeuft(a, "Speichere …");
    const { error } = await sb.auth.updateUser({ password: p1 });
    if (error) {
      alert(istNetzfehler(error) ? NETZTEXT : "Konnte nicht geändert werden:\n" + error.message);
      return;
    }
    S.meldung = "Passwort geändert."; S.ansicht = istBreit() ? "liste" : "profil"; return render();
  }

  // ---------- Favoriten ----------
  if (a === "zuFavoriten") { wechsel("favoriten"); return render(); }
  if (a === "favAnwenden") return favAnwenden(d.id);
  if (a === "favUebernehmen") return favUebernehmen(d.id);
  if (a === "favNeu")      { S.favEdit = leererFavorit(); S.ansicht = "favForm"; return render(); }

  if (a === "favBearbeiten") {
    const f = S.favoriten.find((x) => String(x.id) === String(d.id));
    if (!f) return;
    S.favEdit = {
      id: f.id, name: f.name,
      konto: S.konten.find((x) => x.nummer === f.konto_nummer)
             || { nummer: f.konto_nummer, bezeichnung: kontoName(f.konto_nummer) },
      auftrag: auftragObjekt(f.auftrag_nr, f.auftrag_name)
    };
    S.ansicht = "favForm"; return render();
  }

  if (a === "favHoch") { await favHoch(d.id); return render(); }

  if (a === "favSichern") {
    laeuft(a, "Speichere …");
    const { error } = await favSpeichern(S.favEdit);
    if (error) {
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
    const { error } = await favSpeichern({ id: null, name, konto: n.konto, auftrag: n.auftrag });
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
    n.positionen.splice(Number(d.i), 1);
    // Unter zwei Positionen ist die Aufteilung sinnlos — zurück zum einfachen Beleg.
    if (n.positionen.length < 2) {
      const p = n.positionen[0];
      if (p) { n.betragText = p.betragText; n.mwst = p.mwst; n.konto = p.konto; n.auftrag = p.auftrag; }
      n.positionen = null;
    }
    S.posIndex = null;
    return render();
  }

  if (a === "aufteilenWeg") {
    const n = S.neu;
    const p = n.positionen && n.positionen[0];
    if (p) { n.betragText = p.betragText; n.mwst = p.mwst; n.konto = p.konto; n.auftrag = p.auftrag; }
    n.positionen = null;
    S.posIndex = null;
    return render();
  }

  // ---------- Zurück ----------
  if (a === "zurueck") {
    S.wahlOffen = null;
    // Profil-Unterseiten führen am Handy ins Profil zurück
    const heim = istBreit() ? "liste" : "profil";
    if (S.ansicht === "erfassen") {
      if (S.neu && S.neu.vorschau) URL.revokeObjectURL(S.neu.vorschau);
      const woher = S.zurueckZu; S.neu = null; S.posIndex = null;
      S.ansicht = ["liste", "uebersicht", "freigabe"].includes(woher) ? woher : "liste";
      return render();
    }
    if (S.ansicht === "passwort")  { S.ansicht = heim; return render(); }
    if (S.ansicht === "favoriten") { S.ansicht = heim; return render(); }
    if (S.ansicht === "favForm")   { S.favEdit = null; S.ansicht = "favoriten"; return render(); }
    if (S.ansicht === "benForm")   { S.benEdit = null; S.ansicht = "benutzer"; return render(); }
    if (S.ansicht === "kontoForm") { S.kontEdit = null; S.ansicht = "konten"; return render(); }
    if (S.ansicht === "geraetForm") { S.geraetEdit = null; S.ansicht = "geraete"; return render(); }
    if (S.ansicht === "freigabe" || S.ansicht === "profil") { S.neu = null; S.ansicht = "liste"; return render(); }
    if (S.ansicht === "benutzer" || S.ansicht === "konten" || S.ansicht === "geraete" || S.ansicht === "kst") {
      S.benEdit = null; S.kontEdit = null; S.geraetEdit = null; S.ansicht = heim; return render();
    }
    // bleibt: die Auswahlbildschirme für Konto und Auftrag
    S.posIndex = null;
    S.ansicht = S.favEdit ? "favForm" : "erfassen"; return render();
  }

  // Konto/KST wählen: am Handy eine eigene Seite, am Rechner klappt die
  // Liste direkt unter dem Feld auf (noch einmal klicken schliesst sie).
  if (a === "kontoWahl" || a === "auftragWahl") {
    const art = a === "kontoWahl" ? "konto" : "auftrag";
    const i = (d.i != null) ? Number(d.i) : null;
    S.posIndex = i; S.suche = "";
    if (istBreit()) {
      const offen = S.wahlOffen && S.wahlOffen.art === art && S.wahlOffen.i === i;
      S.wahlOffen = offen ? null : { art, i };
      return render();
    }
    S.ansicht = art === "konto" ? "kontoWahl" : "auftragWahl"; return render();
  }
  if (a === "wahlZu") { S.wahlOffen = null; S.posIndex = null; return render(); }
  if (a === "foto")     { document.getElementById("kamera").click(); return; }
  if (a === "waehlen")  { document.getElementById("datei").click(); return; }
  if (a === "belegAuf") return belegOeffnen(d.p);
  if (a === "belegNeu") {
    if (S.neu.vorschau) URL.revokeObjectURL(S.neu.vorschau);
    S.neu.datei = null; S.neu.vorschau = null; S.neu.altPfad = null; S.neu.altUrl = null;
    return render();
  }

  // Auswahl trifft den Favoriten, eine Position oder den ganzen Beleg.
  // Danach am Handy zurück ins Formular; am Rechner nur die Liste zuklappen.
  const ausWahl = () => {
    S.posIndex = null; S.wahlOffen = null;
    if (!istBreit()) S.ansicht = S.favEdit ? "favForm" : "erfassen";
    return render();
  };
  if (a === "kontoSet") {
    const k = S.konten.find((x) => x.nummer === d.nr);
    if (S.favEdit) { S.favEdit.konto = k; return ausWahl(); }
    if (S.posIndex != null && Array.isArray(S.neu.positionen)) {
      S.neu.positionen[S.posIndex].konto = k;
      return ausWahl();
    }
    S.neu.konto = k;
    if (!S.neu.id) S.neu.mwst = String(k.mwst);   // beim Bearbeiten den Satz nicht überschreiben
    return ausWahl();
  }
  if (a === "auftragSet") {
    const auf = auftragObjekt(d.id);
    if (S.favEdit) { S.favEdit.auftrag = auf; return ausWahl(); }
    if (S.posIndex != null && Array.isArray(S.neu.positionen)) {
      S.neu.positionen[S.posIndex].auftrag = auf;
      return ausWahl();
    }
    S.neu.auftrag = auf;
    return ausWahl();
  }

  if (a === "mwst")    { S.neu.mwst = d.v; return render(); }
  if (a === "zahlart") { S.neu.zahlart = d.v; return render(); }
  if (a === "zahlgeraet") { S.neu.zahlgeraet = Number(d.v); return render(); }
  if (a === "korrMwst") { S.neu.korrMwst = d.v; return render(); }

  // ---------- Export ----------
  const zumExport = () => uGefiltert().map((b) => ({
    ...b, bezeichnung: kontoName(b.konto_nummer),
    gebucht: buchungsBetrag(b), statusText: statusName(statusVon(b)),
    geraetName: b.zahlgeraet_id != null ? geraetName(b.zahlgeraet_id) : "",
    entscheidName: b.entscheid_von && b.entscheid_von !== "automatisch" ? personName(b.entscheid_von) : "" }));

  if (a === "expCsv") {
    const belege = zumExport();
    SpesenExport.csv({ belege, gruppen: gruppiere(belege),
                       monat: S.uVon.slice(0, 7),
                       titel: uTitel(), dateiname: uDateiname().replace(".pdf", ".csv") });
    return;
  }

  if (a === "expPdf") {
    const belege = zumExport();
    laeuft(a, "Bereite vor …");
    try {
      await SpesenExport.pdf({
        sb, belege, gruppen: gruppiere(belege),
        monat: S.uVon.slice(0, 7), titel: uTitel(),
        dateiname: uDateiname(),
        fortschritt: (i, n) => laeuft(a, `Beleg ${i} von ${n} …`)
      });
    } catch (err) {
      alert(istNetzfehler(err) ? NETZTEXT : "Das PDF konnte nicht erstellt werden:\n" + (err.message || err));
    }
    return;
  }

  // ---------- Zur Prüfung freigeben ----------
  if (a === "freigebenAlle") {
    const quelle = d.w === "offene" ? S.offeneEigene : d.w === "liste" ? S.belege : uGefiltert();
    const ids = eigeneErfasste(quelle).map((b) => b.id);
    if (!ids.length) return;
    if (!confirm(`${ids.length === 1 ? "Diesen Beleg" : "Diese " + ids.length + " Belege"} `
                 + "zur Prüfung freigeben?\nDanach lassen sie sich nicht mehr ändern.")) return;
    laeuft(a, "Gebe frei …");
    const { anzahl, direkt, error } = await belegeFreigeben(ids);
    if (error) {
      alert(istNetzfehler(error) ? NETZTEXT : "Freigabe hat nicht geklappt:\n" + error.message);
      return render();
    }
    S.meldung = (anzahl === 1 ? "1 Beleg zur Prüfung freigegeben."
                              : `${anzahl} Belege zur Prüfung freigegeben.`)
              + (direkt ? ` ${direkt} davon ohne Prüfung direkt erledigt.` : "");
    await ladeAlles();
    S.laeuft = null;
    if (istBreit() || S.ansicht === "uebersicht") await ladeUebersicht(true); else render();
    return;
  }

  if (a === "tabFreigabe") {
    // Am Handy gibt es eine Freigabe für alles; der Abschnitt bleibt für die Übersicht
    if (istBreit()) {
      const neu = d.b || S.bereich || standardBereich();
      if (neu !== S.bereich) { S.fPerson = ""; S.fKst = ""; S.fKonto = ""; }
      S.bereich = neu;
    }
    wechsel("freigabe"); S.zurueckZu = "freigabe"; S.erledigtJetzt = [];
    render();
    await ladeFreigabe();
    // Am Rechner gleich den ersten Beleg rechts daneben öffnen
    const liste = freigabeGefiltert();
    if (istBreit() && liste.length) return belegBearbeiten(liste[0].id, "freigabe");
    return render();
  }

  // Arbeitsplatz am Rechner: vorheriger / nächster Beleg in der Liste links
  // (in der Freigabe heisst "nächster" Überspringen)
  if (a === "apNav") {
    const woher = S.ansicht === "freigabe" ? "freigabe" : S.zurueckZu;
    const liste = apListe(woher);
    const i = liste.findIndex((b) => S.neu && String(b.id) === String(S.neu.id));
    const ziel = liste[i + Number(d.v)] || (Number(d.v) > 0 ? liste[0] : null);
    if (!ziel || (S.neu && String(ziel.id) === String(S.neu.id))) return;
    return belegBearbeiten(ziel.id, woher);
  }

  if (a === "freigabeFilterWeg") { S.fPerson = ""; S.fKst = ""; S.fKonto = ""; return render(); }

  // Beleg vergrössern: + / − / einpassen
  if (a === "zoom") {
    S.zoom = d.v === "fit" ? 100 : Math.min(400, Math.max(50, S.zoom + (d.v === "+" ? 25 : -25)));
    return render();
  }

  // Alle Filter eines Bereichs auf einmal weg (m = Meine Belege, u = Übersicht)
  if (a === "filterAlleWeg") {
    const felder = d.b === "m" ? ["mZahlart", "mStatus", "mKonto", "mAuftrag"]
      : ["uZahlart", "uStatus", "uKonto", "uAuftrag", "uGeraet", "uZahlgeraet"];
    for (const f of felder) S[f] = "";
    S.bSuche = ""; S.bSucheNeu++;
    return render();
  }

  // Einen Filter direkt setzen (Reiter mit Zahlen) — anders als die
  // Kacheln hebt ein zweiter Klick ihn nicht auf
  if (a === "setze") { S[d.f] = d.v || ""; return render(); }

  // Übersicht links: Gruppe (KST, Konto, Person) anklicken filtert, nochmals hebt auf
  if (a === "gruppeWahl") {
    const feld = { kst: "uAuftrag", konto: "uKonto", person: "uGeraet" }[d.g];
    for (const f of ["uAuftrag", "uKonto", "uGeraet"]) if (f !== feld) S[f] = "";
    S[feld] = S[feld] === d.v ? "" : (d.v || "");
    return render();
  }

  if (a === "entscheid") {
    const n = S.neu;
    const status = d.v;
    const grund  = wert("egrund").trim();
    let betrag = null;
    if (["besprechung", "teilweise", "abgelehnt"].includes(status) && !grund) {
      alert("Bitte einen Kommentar angeben."); return;
    }
    if (status === "teilweise") {
      betrag = betragVon(wert("egbetrag"));
      if (!(betrag > 0 && betrag < parseFloat(n.betragDb))) {
        alert(`Bitte den genehmigten Betrag eingeben — mehr als 0 und weniger als ${chf(n.betragDb)}.`);
        return;
      }
    }
    if (status === "abgelehnt" && !confirm("Beleg ablehnen? Der Erfasser sieht deinen Kommentar.")) return;
    laeuft("entscheid", "Moment …");
    // Noch nicht gespeicherte Korrektur zuerst speichern. Geht der Beleg dabei
    // an eine andere KST, wird hier nicht mehr entschieden.
    if (n.pruefen && n.zahlartDb !== "vorkasse" && korrekturOffen(n)) {
      const kstNeu = n.auftrag.id !== n.auftragAlt;
      if (!(await korrekturSpeichern(n))) return;
      if (kstNeu) return zurueckNachSpeichern("Korrektur gespeichert — der Beleg liegt jetzt bei der neuen KST.");
    }
    const { error } = await entscheiden(n.id, status, betrag, grund);
    if (error) { alert(istNetzfehler(error) ? NETZTEXT : error.message); return; }
    // Für den Fortschritt in der Freigabe ("2 von 5 erledigt")
    const vorher = S.freigabe.find((x) => String(x.id) === String(n.id));
    if (vorher) S.erledigtJetzt.push({ ...vorher, status });
    return zurueckNachSpeichern(status === "teilweise"
      ? `Teilweise genehmigt: CHF ${chf(betrag)}.` : `Beleg ${statusName(status)}.`);
  }

  // Korrektur beim Prüfen (Kreditkarte/Bar): Betrag, Satz, Datum — und
  // falls geändert auch Konto/KST. Danach bleibt der Beleg zum Entscheiden offen.
  if (a === "korrigieren") {
    const n = S.neu;
    laeuft(a, "Speichere …");
    if (!(await korrekturSpeichern(n))) return;
    const id = n.id;
    await ladeFreigabe();
    // Liegt er noch bei mir, gleich wieder öffnen — zum Entscheiden
    if (S.freigabe.some((x) => String(x.id) === String(id))) {
      await belegBearbeiten(id, "freigabe");
      S.meldung = "Korrektur gespeichert. Jetzt entscheiden.";
      return render();
    }
    return zurueckNachSpeichern("Korrektur gespeichert — der Beleg liegt jetzt bei der neuen KST.");
  }

  if (a === "umkontieren") {
    const n = S.neu;
    laeuft(a, "Moment …");
    const { error } = await umkontieren(n.id, n.konto.nummer, n.auftrag.id);
    if (error) { alert(istNetzfehler(error) ? NETZTEXT : error.message); return; }
    return zurueckNachSpeichern(n.auftrag.id !== n.auftragAlt
      ? "Kontierung geändert — der Beleg liegt jetzt bei der neuen KST."
      : "Kontierung geändert.");
  }

  if (a === "zuruecksetzen") {
    const n = S.neu;
    const ziel = d.v;
    if (!confirm(ziel === "offen"
        ? "Zurück auf „erfasst“? Der Erfasser kann den Beleg dann wieder ändern und löschen."
        : "Entscheid zurücknehmen? Der Beleg muss dann neu geprüft werden.")) return;
    laeuft(a, "Moment …");
    const { error } = await zuruecksetzen(n.id, ziel);
    if (error) { alert(istNetzfehler(error) ? NETZTEXT : error.message); return; }
    return zurueckNachSpeichern(ziel === "offen" ? "Beleg ist wieder erfasst." : "Entscheid zurückgenommen.");
  }

  // ---------- Beleg löschen ----------
  if (a === "loeschen") {
    const n = S.neu;
    if (!confirm("Diesen Beleg wirklich löschen? Der Scan wird mitgelöscht.")) return;
    laeuft(a, "Lösche …");
    const { data: weg, error } = await sb.from("spesen_beleg").delete().eq("id", n.id).select("id");
    // Verbietet die Datenbank das Löschen, kommt kein Fehler, sondern einfach
    // nichts zurück. Dann auch den Scan nicht anrühren.
    if (!error && !(weg && weg.length)) { alert(GESPERRT_TEXT); return; }
    if (error) {
      alert(istNetzfehler(error) ? NETZTEXT : "Konnte nicht gelöscht werden:\n" + error.message);
      return;
    }
    if (n.altPfad) { try { await sb.storage.from("belege").remove([n.altPfad]); } catch { /* egal */ } }
    return zurueckNachSpeichern("Beleg gelöscht.");
  }

  // ---------- Beleg speichern ----------
  if (a === "speichern" || a === "speichernFrei" || a === "speichernGenehmigen") return belegSpeichern(a);
}

// Die Liste links im Arbeitsplatz — je nachdem, woher der Beleg geöffnet wurde
export function apListe(woher: string) {
  if (woher === "freigabe") return freigabeGefiltert();
  if (woher === "uebersicht") return uGefiltert();
  return meineGefiltert();
}

// Korrektur beim Prüfen: ist etwas geändert? (Betrag, MwSt, Datum, Konto, KST)
function korrekturOffen(n: any) {
  const werte = n.zahlartDb !== "vorkasse" && (Math.abs(betragVon(n.korrBetrag) - parseFloat(n.betragDb)) > 0.004
    || parseFloat(n.korrMwst) !== parseFloat(n.mwst) || n.korrDatum !== n.datum);
  return werte || n.konto.nummer !== n.kontoAlt || n.auftrag.id !== n.auftragAlt;
}

// Speichert die Korrektur. Gibt false zurück, wenn es nicht geklappt hat.
async function korrekturSpeichern(n: any) {
  const betrag = betragVon(n.korrBetrag);
  if (!(betrag > 0)) { alert("Bitte einen Betrag grösser als 0 eingeben."); return false; }
  if (!n.korrDatum) { alert("Bitte ein Belegdatum angeben."); return false; }
  const werteNeu = n.zahlartDb !== "vorkasse" && (Math.abs(betrag - parseFloat(n.betragDb)) > 0.004
                || parseFloat(n.korrMwst) !== parseFloat(n.mwst) || n.korrDatum !== n.datum);
  const kontNeu = n.konto.nummer !== n.kontoAlt || n.auftrag.id !== n.auftragAlt;
  if (werteNeu) {
    const { error } = await sb.rpc("beleg_korrigieren", { p_id: n.id, p_betrag: betrag,
                                   p_mwst: parseFloat(n.korrMwst), p_datum: n.korrDatum });
    if (error) { alert(istNetzfehler(error) ? NETZTEXT : error.message); return false; }
  }
  if (kontNeu) {
    const { error } = await umkontieren(n.id, n.konto.nummer, n.auftrag.id);
    if (error) { alert(istNetzfehler(error) ? NETZTEXT : error.message); return false; }
  }
  return true;
}

async function belegSpeichern(a: string) {
  const n = S.neu;
  const geteilt = Array.isArray(n.positionen);
  // "Speichern und genehmigen": eigener Beleg, für den ich selbst zuständig
  // bin — freigeben und gleich entscheiden, statt ihn zweimal anzufassen.
  const genehmigen = a === "speichernGenehmigen";
  if (geraetFehlt(n)) { alert("Bitte das Gerät wählen."); return; }
  const freigeben = a === "speichernFrei" || genehmigen;
  if (freigeben && !confirm(genehmigen
        ? "Beleg speichern und genehmigen?\nDanach lässt er sich nicht mehr ändern."
        : "Beleg speichern und zur Prüfung freigeben?\nDanach lässt er sich nicht mehr ändern.")) return;

  // Aufgeteilt: je Position eine Zeile. Der Belegbetrag ist ihre Summe,
  // die erste Position steht zusätzlich oben, damit alte Auswertungen
  // und die Belegliste weiter funktionieren.
  const positionen = geteilt ? n.positionen.map((p) => ({
    betrag:       betragVon(p.betragText),
    mwst:         parseFloat(p.mwst),
    konto_nummer: p.konto.nummer,
    auftrag_nr:   p.auftrag.id
  })) : null;

  const betrag = geteilt
    ? Math.round(positionen.reduce((t, p) => t + p.betrag, 0) * 100) / 100
    : betragVon(n.betragText);

  let pfad = n.altPfad;
  if (n.datei) {
    laeuft(a, "Bereite Beleg auf …");
    try {
      const { blob, typ, ext } = await aufbereiten(n.datei);
      laeuft(a, "Lade Beleg hoch …");
      pfad = `${ordnerName(S.session.user.email)}/${n.datum.slice(0, 7)}/${Date.now()}.${ext}`;
      const { error: upFehler } = await sb.storage.from("belege")
        .upload(pfad, blob, { contentType: typ, upsert: false });
      if (upFehler) throw upFehler;
    } catch (err) {
      alert(istNetzfehler(err) ? NETZTEXT : "Der Beleg konnte nicht hochgeladen werden:\n" + (err.message || err));
      return;
    }
  }

  laeuft(a, "Speichere …");
  const daten: any = {
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
  // Kommentar nur mitschicken, wenn es einen gibt oder die Spalte schon
  // bekannt ist — eine Datenbank ohne die Spalte würde sonst ablehnen.
  const kommentar = String(n.kommentar || "").trim();
  if (kommentar || n.kommentarDa) daten.kommentar = kommentar || null;
  // Gerät nur bei Kreditkarte — und nur, wenn die Datenbank die Geräte kennt
  if (S.geraeteDa) daten.zahlgeraet_id = n.zahlart === "karte" ? geraetGewaehlt(n) : null;

  // Beim Ändern geht die Freigabe im selben Schritt mit. Ein neuer Beleg
  // muss erst als "offen" angelegt werden — so will es die Datenbank —
  // und wird gleich danach freigegeben.
  if (freigeben && n.id) daten.status = "eingereicht";
  // Ein abgelehnter Beleg wird beim Korrigieren wieder "erfasst".
  else if (n.id && n.status === "abgelehnt") daten.status = "offen";

  let error: any, neueId = null, neuerStatus = null;
  if (n.id) {
    let zeilen;
    ({ data: zeilen, error } = await sb.from("spesen_beleg")
      .update({ ...daten, geaendert: new Date().toISOString() }).eq("id", n.id).select("id,status"));
    // Wie beim Löschen: eine gesperrte Änderung meldet keinen Fehler, nur null Zeilen.
    if (!error && !(zeilen && zeilen.length)) error = { message: GESPERRT_TEXT, gesperrt: true };
    if (!error && freigeben) neuerStatus = zeilen[0].status;
  } else {
    let neu;
    ({ data: neu, error } = await sb.from("spesen_beleg")
      .insert({ ...daten, geraet: S.session.user.email }).select("id"));
    if (!error && neu && neu[0]) neueId = neu[0].id;
  }

  if (error) {
    // Die eben hochgeladene Datei wieder wegräumen, sonst bleibt sie
    // ohne Beleg im Speicher liegen. Beim nächsten Versuch kommt sie neu.
    if (n.datei && pfad !== n.altPfad) {
      try { await sb.storage.from("belege").remove([pfad]); } catch { /* egal */ }
    }
    alert(error.gesperrt ? GESPERRT_TEXT
          : istNetzfehler(error) ? NETZTEXT : "Konnte nicht gespeichert werden:\n" + error.message);
    return;
  }

  if (n.datei && n.altPfad && n.altPfad !== pfad) {
    try { await sb.storage.from("belege").remove([n.altPfad]); } catch { /* egal */ }
  }
  if (n.vorschau) URL.revokeObjectURL(n.vorschau);

  let text = n.id ? "Beleg geändert." : `Beleg über CHF ${chf(betrag)} gespeichert.`;
  if (freigeben && neueId) {
    const f = await belegeFreigeben([neueId]);
    text = !f.anzahl ? `Beleg über CHF ${chf(betrag)} gespeichert, aber NICHT freigegeben — `
                       + "bitte in der Liste nochmals freigeben."
         : f.direkt ? `Beleg über CHF ${chf(betrag)} gespeichert — ohne Prüfung direkt erledigt.`
         : `Beleg über CHF ${chf(betrag)} gespeichert und zur Prüfung freigegeben.`;
  } else if (freigeben) {
    text = neuerStatus && neuerStatus !== "eingereicht"
      ? "Beleg gespeichert — ohne Prüfung direkt erledigt."
      : "Beleg gespeichert und zur Prüfung freigegeben.";
  }

  // Selbst genehmigen: nur wenn er nach dem Freigeben wirklich auf mich wartet
  const id = n.id || neueId;
  if (genehmigen && id) {
    const { data: jetzt } = await sb.from("spesen_beleg").select("status").eq("id", id).maybeSingle();
    if (jetzt && jetzt.status === "eingereicht") {
      const { error: e2 } = await entscheiden(id, n.zahlart === "vorkasse" ? "genehmigt" : "geprueft", null, null);
      text = e2 ? `Gespeichert und freigegeben, aber nicht genehmigt: ${e2.message}`
                : `Beleg über CHF ${chf(betrag)} gespeichert und ${n.zahlart === "vorkasse" ? "genehmigt" : "geprüft"}.`;
    }
  }
  await zurueckNachSpeichern(text);
}

// ---------- Feldänderungen ----------
export function aenderung(ziel: HTMLInputElement) {
  const f = ziel.dataset && ziel.dataset.feld;
  if (!f) return;

  // Ein geleertes Datumsfeld würde ohne Datum und Monat speichern — alten Wert zurück.
  if (f === "datum") {
    if (!ziel.value) { ziel.value = S.neu.datum; return; }
    S.neu.datum = ziel.value; return;
  }
  if (f === "zahlart") { S.neu.zahlart = ziel.value; return; }

  if (f === "posmwst" && S.neu && Array.isArray(S.neu.positionen)) {
    S.neu.positionen[Number(ziel.dataset.i)].mwst = ziel.value;
    return;
  }

  if (f === "kaktiv" && S.kontEdit)    { S.kontEdit.aktiv = ziel.checked; return; }
  if (f === "bpruefung" && S.benEdit)  { S.benEdit.pruefung = ziel.checked; return; }
  if (f === "gaktiv" && S.geraetEdit)  { S.geraetEdit.aktiv = ziel.checked; return; }

  // Eigener Zeitraum: erst zeichnen, wenn die Daten da sind.
  if (f === "uvon") {
    if (!ziel.value) return;
    S.uVon = ziel.value;
    if (S.uBis < S.uVon) S.uBis = S.uVon;
    zeitraumLaden(); return;
  }
  if (f === "ubis") {
    if (!ziel.value) return;
    S.uBis = ziel.value;
    if (S.uBis < S.uVon) S.uVon = S.uBis;
    zeitraumLaden(); return;
  }

  if (f === "ugeraet")  { S.uGeraet  = ziel.value; render(); return; }
  if (f === "ukonto")   { S.uKonto   = ziel.value; render(); return; }
  if (f === "uauftrag") { S.uAuftrag = ziel.value; render(); return; }
  if (f === "uzahlart") { S.uZahlart = ziel.value; render(); return; }
  if (f === "ustatus")  { S.uStatus  = ziel.value; render(); return; }
  if (f === "uzahlgeraet") { S.uZahlgeraet = ziel.value; render(); return; }
  // Freigabe filtern
  if (f === "fperson") { S.fPerson = ziel.value; render(); return; }
  if (f === "fkst")    { S.fKst    = ziel.value; render(); return; }
  if (f === "fkonto")  { S.fKonto  = ziel.value; render(); return; }
  // Zeitraum aus der Auswahl: p:-1 = Periode, g:id = gespeichert, eigen = Von/Bis
  if (f === "zeitraum") {
    const w = ziel.value;
    if (w === "eigen") { S.eigenerZeitraum = true; render(); return; }
    if (w.startsWith("p:")) {
      const p = periode(Number(w.slice(2)));
      S.uVon = p.von; S.uBis = p.bis;
    } else if (w.startsWith("g:")) {
      const p = S.perioden.find((x) => String(x.id) === w.slice(2));
      if (!p) return;
      S.uVon = p.von; S.uBis = p.bis;
    }
    S.eigenerZeitraum = false;
    zeitraumLaden(); return;
  }
  if (f === "mzahlart") { S.mZahlart = ziel.value; render(); return; }
  if (f === "mstatus")  { S.mStatus  = ziel.value; render(); return; }
  if (f === "mkonto")   { S.mKonto   = ziel.value; render(); return; }
  if (f === "mauftrag") { S.mAuftrag = ziel.value; render(); return; }
  if (f === "korrDatum" && S.neu) {
    if (!ziel.value) { ziel.value = S.neu.korrDatum; return; }
    S.neu.korrDatum = ziel.value; return render();
  }
}

// Beim Tippen übernehmen. Die Felder behalten dabei den Fokus.
export function eingabe(ziel: HTMLInputElement) {
  const f = ziel.dataset && ziel.dataset.feld;
  if (!f) return;

  if (f === "betrag" && S.neu) { S.neu.betragText = ziel.value; return render(); }

  if (f === "posbetrag" && S.neu && Array.isArray(S.neu.positionen)) {
    S.neu.positionen[Number(ziel.dataset.i)].betragText = ziel.value;
    return render();
  }

  if (f === "suche")   { S.suche = ziel.value; return render(); }
  if (f === "bsuche")  { S.bSuche = ziel.value; return render(); }
  if (f === "zoom")    { S.zoom = Number(ziel.value) || 100; return render(); }
  if (f === "kommentar" && S.neu)  { S.neu.kommentar = ziel.value; return; }
  if (f === "korrBetrag" && S.neu) { S.neu.korrBetrag = ziel.value; return render(); }
  if (f === "favname" && S.favEdit) { S.favEdit.name = ziel.value; return; }
  if (f === "bname" && S.benEdit)   { S.benEdit.name  = ziel.value; return; }
  if (f === "bmail" && S.benEdit)   { S.benEdit.email = ziel.value; return; }

  if (f === "knummer" && S.kontEdit) { S.kontEdit.nummer      = ziel.value; return; }
  if (f === "kbez"    && S.kontEdit) { S.kontEdit.bezeichnung = ziel.value; return; }
  if (f === "gname" && S.geraetEdit) { S.geraetEdit.name       = ziel.value; return; }
  if (f === "gkst"  && S.geraetEdit) { S.geraetEdit.auftrag_nr = ziel.value; return; }
  if (f === "ksort"   && S.kontEdit) { S.kontEdit.sortierung  = ziel.value; return; }
}
