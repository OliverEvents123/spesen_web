// daten.ts
// Alle Datenzugriffe: Laden, Speichern, Gruppierung, Bildaufbereitung,
// Favoriten, Benutzer, Konten, Zeitraum, Freigabe.
// Inhaltlich 1:1 aus der alten daten.js übernommen.

import { S, sb, render } from "./zustand";
import { SUPABASE_URL, SUPABASE_KEY } from "./konfig";
import {
  OHNE_KST, NETZTEXT, istBreit, istNetzfehler, heute, chf, kurzName,
  statusVon, statusName, zahlartName, auftragAnzeige, langDatum, buchungsBetrag,
  belegZeilen
} from "./grundlagen";

// ---------- Leere Vorlagen ----------
export const leererBeleg = () => ({
  id: null, status: "offen", konto: null, auftrag: null, mwst: "8.1", betragText: "",
  positionen: null, datum: heute(), zahlart: "karte", datei: null, vorschau: null,
  altPfad: null, altUrl: null
});

export const leerePosition = (vorlage?: any) => ({
  betragText: "", mwst: (vorlage && vorlage.mwst) || "8.1",
  konto: (vorlage && vorlage.konto) || null,
  auftrag: (vorlage && vorlage.auftrag) || null
});

export const leererFavorit = () => ({ id: null, name: "", konto: null, auftrag: null });

export const leererBenutzer = () => ({ neu: true, email: "", name: "", rolle: "user",
                                       gesperrt: false, pruefung: false });

export const leeresKonto = () => {
  const hoechste = S.konten.reduce((m, k) => Math.max(m, k.sortierung || 0), 0);
  return { neu: true, nummer: "", bezeichnung: "", mwst: "8.1",
           sortierung: String(hoechste + 10), aktiv: true };
};

export const kontoName = (nr: string) => {
  const k = S.konten.find((x) => x.nummer === nr);
  return k ? k.bezeichnung : "";
};

// In der Auswahl stehen nur aktive Konten; die Admin-Liste zeigt alle.
export const aktiveKonten = () => S.konten.filter((k) => k.aktiv !== false);

// ---------- Laden ----------
const KONTO_SPALTEN = "nummer,bezeichnung,mwst,sortierung,aktiv";

export async function ladeAlles() {
  const [k, b, f, adm, per] = await Promise.all([
    sb.from("spesen_konto").select(KONTO_SPALTEN).order("sortierung").order("nummer"),
    sb.from("spesen_beleg").select("*").eq("monat", S.monat).eq("geraet", S.session.user.email)
      .order("beleg_datum", { ascending: false }).order("id", { ascending: false }),
    sb.from("spesen_favorit").select("*").order("sortierung").order("id"),
    sb.rpc("ist_admin"),
    sb.from("spesen_periode").select("*").order("sortierung").order("von", { ascending: false })
  ]);
  S.konten    = k.data || [];
  S.belege    = b.data || [];
  S.favoriten = f.data || [];
  S.istAdmin  = adm.data === true;
  S.perioden  = per.data || [];

  // Fehlt die Funktion (Datenbank ohne Etappe 2), bleibt alles wie bisher.
  const pr = await sb.rpc("ist_pruefer");
  S.istPruefer = !pr.error && pr.data === true;
  if (S.istPruefer) await ladeFreigabe();

  // Auftragsnummern kommen aus FileMaker und werden nur einmal je Sitzung geholt
  if (!S.auftraege.length) S.auftraege = await ladeAuftraege();
}

// Laufendes Jahr und das ganze Vorjahr — ein Dezember-Beleg wird oft erst im
// Januar erfasst. Die übergreifenden Nummern liefern beide Jahre; doppelte
// fallen weg. Reihenfolge: erst das laufende Jahr, dann das Vorjahr.
async function ladeAuftraege() {
  const jahr = new Date().getFullYear();
  const holen = async (j: number) => {
    try {
      const r = await fetch(`${SUPABASE_URL}/functions/v1/auftragsnummern?jahr=${j}`,
        { headers: { Authorization: `Bearer ${S.session.access_token}`, apikey: SUPABASE_KEY } });
      const d = await r.json();
      return d.ok ? d.auftragsnummern : [];
    } catch { return []; }
  };
  const [jetzt, vorher] = await Promise.all([holen(jahr), holen(jahr - 1)]);
  const gesehen = new Set();
  return [...jetzt, ...vorher].filter((a) => !gesehen.has(a.id) && gesehen.add(a.id));
}

export async function ladeFavoriten() {
  const { data } = await sb.from("spesen_favorit").select("*").order("sortierung").order("id");
  S.favoriten = data || [];
}

export async function ladeKonten() {
  const { data } = await sb.from("spesen_konto")
    .select(KONTO_SPALTEN).order("sortierung").order("nummer");
  S.konten = data || [];
}

// ---------- Freigabe ----------
// Alles, was die angemeldete Person gerade entscheiden muss.
export async function ladeFreigabe() {
  const { data } = await sb.rpc("freigabe_liste");
  S.freigabe = data || [];
}

export const entscheiden = (id, status, betrag, grund) =>
  sb.rpc("beleg_entscheiden", { p_id: id, p_status: status,
                                p_betrag: betrag ?? null, p_grund: grund || null });
export const umkontieren = (id, konto, auftrag) =>
  sb.rpc("beleg_umkontieren", { p_id: id, p_konto: konto, p_auftrag: auftrag });
export const zuruecksetzen = (id, ziel) =>
  sb.rpc("beleg_zuruecksetzen", { p_id: id, p_ziel: ziel });

// ---------- Zuweisungen (nur Admin) ----------
export async function ladeZuweisungen() {
  const [z, k] = await Promise.all([
    sb.from("spesen_zuweisung").select("email,auftrag_nr").order("auftrag_nr"),
    sb.from("spesen_zuweisung_konto").select("email,konto_nummer").order("konto_nummer")
  ]);
  S.zuweisungen      = z.data || [];
  S.zuweisungenKonto = k.data || [];
}

// ---------- Gespeicherte Perioden ----------
// Jeder Benutzer hat seine eigenen, höchstens MAX_PERIODEN Stück.
export async function ladePerioden() {
  const { data } = await sb.from("spesen_periode")
    .select("*").order("sortierung").order("von", { ascending: false });
  S.perioden = data || [];
}

export async function periodeSpeichern(name, von, bis) {
  const hoechste = S.perioden.reduce((m, p) => Math.max(m, p.sortierung || 0), 0);
  return sb.from("spesen_periode")
    .insert({ geraet: S.session.user.email, name: String(name).trim(),
              von, bis, sortierung: hoechste + 10 });
}

export const periodeLoeschen = (id) => sb.from("spesen_periode").delete().eq("id", id);

// Zählt mit, welche Abfrage die neueste ist. Stellt man den Zeitraum schnell
// zweimal um, darf die langsamere erste Antwort die zweite nicht überschreiben.
let uLauf = 0;

export async function ladeUebersicht(stumm?: boolean) {
  const lauf = ++uLauf;
  if (!stumm) { S.uLaedt = true; render(); }

  const { data } = await sb.from("spesen_beleg").select("*")
    .gte("beleg_datum", S.uVon).lte("beleg_datum", S.uBis)
    .order("beleg_datum", { ascending: true }).order("id", { ascending: true });

  if (lauf !== uLauf) return;   // eine neuere Abfrage ist schon unterwegs
  S.uBelege = data || [];
  S.uLaedt  = false;
  render();
}

// ---------- Konten verwalten (nur Admin) ----------
export async function kontoSpeichern(k) {
  const daten = {
    bezeichnung: String(k.bezeichnung || "").trim(),
    mwst:        parseFloat(k.mwst),
    sortierung:  parseInt(k.sortierung, 10) || 0,
    aktiv:       !!k.aktiv
  };
  if (k.neu) {
    return sb.from("spesen_konto").insert({ ...daten, nummer: String(k.nummer).trim() });
  }
  return sb.from("spesen_konto").update(daten).eq("nummer", k.nummer);
}

// ---------- Favoriten ----------
export async function favSpeichern(fav) {
  const daten = {
    geraet:       S.session.user.email,
    name:         fav.name.trim() || fav.konto.bezeichnung || fav.konto.nummer,
    konto_nummer: fav.konto.nummer,
    auftrag_nr:   fav.auftrag.id,
    auftrag_name: fav.auftrag.name || null
  };
  if (fav.id) return sb.from("spesen_favorit").update(daten).eq("id", fav.id);
  const hoechste = S.favoriten.reduce((m, f) => Math.max(m, f.sortierung || 0), 0);
  return sb.from("spesen_favorit").insert({ ...daten, sortierung: hoechste + 10 });
}

export const favLoeschen = (id) => sb.from("spesen_favorit").delete().eq("id", id);

export async function favHoch(id) {
  const i = S.favoriten.findIndex((f) => String(f.id) === String(id));
  if (i <= 0) return;
  const a = S.favoriten[i], b = S.favoriten[i - 1];
  const sa = a.sortierung || (i + 1) * 10, sbv = b.sortierung || i * 10;
  await Promise.all([
    sb.from("spesen_favorit").update({ sortierung: sbv }).eq("id", a.id),
    sb.from("spesen_favorit").update({ sortierung: sa  }).eq("id", b.id)
  ]);
  await ladeFavoriten();
}

export function favAnwenden(id) {
  const f = S.favoriten.find((x) => String(x.id) === String(id));
  if (!f) return;
  const k = S.konten.find((x) => x.nummer === f.konto_nummer)
            || { nummer: f.konto_nummer, bezeichnung: kontoName(f.konto_nummer) };
  const a = auftragObjekt(f.auftrag_nr, f.auftrag_name);
  S.neu = { ...leererBeleg(), konto: k, auftrag: a, mwst: String(k.mwst ?? "8.1") };
  S.zurueckZu = istBreit() ? "desktop" : "liste";
  S.ansicht = "erfassen";
  render();
}

// ---------- Auswertung ----------
// Passt eine einzelne Position zu den Filtern für Konto und Auftrag?
// Bei aufgeteilten Belegen zählt jede Position für sich.
export const zeilePasst = (p) =>
  (!S.uKonto   || p.konto_nummer === S.uKonto) &&
  (!S.uAuftrag || p.auftrag_nr   === S.uAuftrag);

// MwSt wird auf der Gruppensumme gerechnet, nicht je Beleg — sonst
// entstehen durch das Runden Rappendifferenzen.
// Ein aufgeteilter Beleg liefert je Position eine Zeile.
export function gruppiere(belege: any[]) {
  const m = new Map();
  for (const b of belege) {
    if (statusVon(b) === "abgelehnt") continue;   // wird nicht gebucht
    // Teilgenehmigt: jede Position im selben Verhältnis kürzen.
    const faktor = parseFloat(b.betrag) ? buchungsBetrag(b) / parseFloat(b.betrag) : 1;
    for (const p0 of belegZeilen(b)) {
      if (!zeilePasst(p0)) continue;  // gefilterte Positionen zählen nicht mit
      const p = faktor === 1 ? p0
        : { ...p0, betrag: Math.round(parseFloat(p0.betrag) * faktor * 100) / 100 };
      const s = `${p.konto_nummer}|${p.auftrag_nr}|${p.mwst}|${b.zahlart || "karte"}`;
      if (!m.has(s)) m.set(s, { konto: p.konto_nummer, bezeichnung: kontoName(p.konto_nummer),
                                auftrag: p.auftrag_nr, satz: Number(p.mwst),
                                zahlart: (b.zahlart || "karte"), anzahl: 0, brutto: 0 });
      const g = m.get(s);
      g.anzahl += 1;
      g.brutto += parseFloat(p.betrag);
    }
  }
  const liste = [...m.values()].map((g) => {
    const netto = g.brutto / (1 + g.satz / 100);
    return { ...g, netto: Math.round(netto * 100) / 100,
             steuer: Math.round((g.brutto - netto) * 100) / 100 };
  });
  liste.sort((a, b) => String(a.konto).localeCompare(String(b.konto), "de", { numeric: true })
                    || String(a.auftrag).localeCompare(String(b.auftrag), "de", { numeric: true })
                    || b.satz - a.satz);
  return liste;
}

// Ist nach Konto oder Auftrag gefiltert, zählt von einem aufgeteilten Beleg
// nur der passende Teil — sonst zeigt die Belegliste mehr als die Kontierung.
// gesamtBetrag hält dann fest, wie viel der ganze Beleg ausmacht.
function belegImFilter(b) {
  if (!S.uKonto && !S.uAuftrag) return b;
  if (!Array.isArray(b.positionen) || b.positionen.length < 2) return b;
  const teile = b.positionen.filter(zeilePasst);
  if (teile.length === b.positionen.length) return b;
  const betrag = Math.round(teile.reduce((t, p) => t + parseFloat(p.betrag), 0) * 100) / 100;
  const genehmigt = b.genehmigt_betrag != null && parseFloat(b.betrag)
    ? Math.round(parseFloat(b.genehmigt_betrag) * betrag / parseFloat(b.betrag) * 100) / 100
    : b.genehmigt_betrag;
  return { ...b, positionen: teile, betrag, gesamtBetrag: b.betrag, genehmigt_betrag: genehmigt,
           mwst: teile[0].mwst, konto_nummer: teile[0].konto_nummer,
           auftrag_nr: teile[0].auftrag_nr };
}

// Ein Beleg erscheint, wenn mindestens eine seiner Positionen passt.
export const uGefiltert = () => S.uBelege.filter((b) =>
  (!S.uGeraet  || b.geraet === S.uGeraet) &&
  (!S.uZahlart || (b.zahlart || "karte") === S.uZahlart) &&
  (!S.uStatus  || statusVon(b) === S.uStatus) &&
  belegZeilen(b).some(zeilePasst)).map(belegImFilter);

// Was kommt im geladenen Zeitraum überhaupt vor? Füllt die Auswahlfelder.
export function kontenImZeitraum() {
  const s = new Set<string>();
  for (const b of S.uBelege) for (const p of belegZeilen(b)) s.add(p.konto_nummer);
  return [...s].sort((a, b) => String(a).localeCompare(String(b), "de", { numeric: true }));
}

export function auftraegeImZeitraum() {
  const s = new Set<string>();
  for (const b of S.uBelege) for (const p of belegZeilen(b)) s.add(p.auftrag_nr);
  return [...s].sort((a, b) => String(a).localeCompare(String(b), "de", { numeric: true }));
}

export const uZeitraumText = () => `${langDatum(S.uVon)} – ${langDatum(S.uBis)}`;

export const uTitel = () => {
  const teile = [
    uZeitraumText(),
    S.uGeraet || (S.istAdmin ? "Alle Geräte" : S.session.user.email),
    S.uZahlart ? zahlartName(S.uZahlart) : "Alle Zahlungsarten"
  ];
  if (S.uStatus)  teile.push("Status " + statusName(S.uStatus));
  if (S.uKonto)   teile.push("Konto " + S.uKonto);
  if (S.uAuftrag) teile.push("Auftrag " + auftragAnzeige(S.uAuftrag));
  return teile.join(" · ");
};

export const uDateiname = () =>
  `Spesen_${S.uVon}_bis_${S.uBis}` +
  (S.uKonto   ? "_K" + S.uKonto   : "") +
  (S.uAuftrag ? "_A" + String(S.uAuftrag).replace(/\s+/g, "") : "") +
  (S.uZahlart ? "_" + S.uZahlart : "") +
  (S.uGeraet ? "_" + kurzName(S.uGeraet) : (S.istAdmin ? "_alle" : "")) + ".pdf";

// Wie viele Belege hat ein Gerät im gewählten Zeitraum?
export const belegeVon = (mail) => S.uBelege.filter((b) => b.geraet === mail).length;

// Wie viele Posten laufen im gewählten Zeitraum auf dieses Konto?
export function postenAufKonto(nr) {
  let n = 0;
  for (const b of S.uBelege) for (const p of belegZeilen(b)) if (p.konto_nummer === nr) n += 1;
  return n;
}

// ---------- Belegdatei ----------
export async function aufbereiten(file: File) {
  if (file.type === "application/pdf") return { blob: file as Blob, typ: "application/pdf", ext: "pdf" };
  try {
    const bm  = await createImageBitmap(file);
    const max = 2000;
    const f   = Math.min(1, max / Math.max(bm.width, bm.height));
    const c   = document.createElement("canvas");
    c.width   = Math.round(bm.width  * f);
    c.height  = Math.round(bm.height * f);
    c.getContext("2d").drawImage(bm, 0, 0, c.width, c.height);
    const blob = await new Promise<Blob>((r) => c.toBlob(r, "image/jpeg", 0.82));
    if (!blob) throw new Error("leer");
    return { blob, typ: "image/jpeg", ext: "jpg" };
  } catch {
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
    return { blob: file as Blob, typ: (file.type || "image/jpeg"), ext };
  }
}

export function dateiGewaehlt(file: File) {
  if (!file) return;
  const erlaubt = file.type === "application/pdf" || file.type.startsWith("image/");
  if (!erlaubt) { alert("Bitte ein Bild oder ein PDF wählen."); return; }

  // Vom Rechner direkt auf die Ablagefläche gezogen: Erfassung öffnen
  if (!S.neu) {
    S.neu = leererBeleg(); S.zurueckZu = istBreit() ? "desktop" : "liste";
    S.ansicht = "erfassen";
  }

  if (S.neu.vorschau) URL.revokeObjectURL(S.neu.vorschau);
  S.neu.datei    = file;
  S.neu.vorschau = file.type === "application/pdf" ? null : URL.createObjectURL(file);
  render();
}

export async function belegOeffnen(pfad) {
  const { data, error } = await sb.storage.from("belege").createSignedUrl(pfad, 60);
  if (error) { alert("Beleg konnte nicht geöffnet werden:\n" + error.message); return; }
  window.open(data.signedUrl, "_blank");
}

// ---------- Beleg zum Bearbeiten öffnen ----------
export function kontoObjekt(nr) {
  return S.konten.find((x) => x.nummer === nr) || { nummer: nr, bezeichnung: kontoName(nr) };
}
export function auftragObjekt(id, ersatzName?) {
  if (id === OHNE_KST.id) return OHNE_KST;
  return S.auftraege.find((x) => x.id === id) || { id, name: ersatzName || "" };
}

export async function belegBearbeiten(id, woher) {
  const gleich = (x) => String(x.id) === String(id);
  const quelle = woher === "liste" ? S.belege : woher === "freigabe" ? S.freigabe : S.uBelege;
  const b = quelle.find(gleich) || S.belege.find(gleich)
         || S.uBelege.find(gleich) || S.freigabe.find(gleich);
  if (!b) return;

  let url = null;
  if (b.datei_pfad && !b.datei_pfad.toLowerCase().endsWith(".pdf")) {
    const { data } = await sb.storage.from("belege").createSignedUrl(b.datei_pfad, 600);
    url = data ? data.signedUrl : null;
  }

  const aufgeteilt = Array.isArray(b.positionen) && b.positionen.length > 1;

  S.neu = {
    id: b.id,
    status: statusVon(b), eingereichtAm: b.eingereicht_am || null, geraet: b.geraet,
    zahlartDb: b.zahlart || "karte", betragDb: b.betrag,
    genehmigtBetrag: b.genehmigt_betrag, entscheidGrund: b.entscheid_grund || "",
    entscheidVon: b.entscheid_von || "", entscheidAm: b.entscheid_am || null,
    // Prüfen: aus der Freigabeliste geöffnet und noch offen für einen Entscheid
    pruefen: woher === "freigabe" && statusVon(b) === "eingereicht",
    kontoAlt: b.konto_nummer, auftragAlt: b.auftrag_nr,
    konto:   kontoObjekt(b.konto_nummer),
    auftrag: auftragObjekt(b.auftrag_nr),
    mwst: String(b.mwst),
    betragText: chf(b.betrag),
    positionen: aufgeteilt ? b.positionen.map((p) => ({
      betragText: chf(p.betrag),
      mwst: String(p.mwst),
      konto: kontoObjekt(p.konto_nummer),
      auftrag: auftragObjekt(p.auftrag_nr)
    })) : null,
    datum: b.beleg_datum, zahlart: b.zahlart || "karte",
    datei: null, vorschau: null, altPfad: b.datei_pfad, altUrl: url
  };
  S.posIndex  = null;
  S.zurueckZu = woher;
  S.ansicht   = "erfassen";
  render();
}

// ---------- Zur Prüfung freigeben ----------
// Setzt erfasste Belege auf "eingereicht". Gibt zurück, wie viele es wirklich
// wurden — die Datenbank lässt nur eigene, noch erfasste Belege zu.
// "direkt" zählt die, die ohne Prüfer gleich durchgegangen sind.
export async function belegeFreigeben(ids) {
  if (!ids.length) return { anzahl: 0, direkt: 0, error: null };
  const { data, error } = await sb.from("spesen_beleg")
    .update({ status: "eingereicht" })
    .in("id", ids).eq("status", "offen").select("id,status");
  const zeilen = data || [];
  return { anzahl: zeilen.length,
           direkt: zeilen.filter((z) => z.status !== "eingereicht").length, error };
}

// Eigene, noch erfasste Belege aus einer Liste — die lassen sich freigeben.
export const eigeneErfasste = (liste) => (liste || []).filter((b) =>
  b.geraet === S.session.user.email && statusVon(b) === "offen");

// ---------- Nach dem Speichern zurück ----------
export async function zurueckNachSpeichern(text) {
  S.meldung = text;
  S.laeuft = null;
  const woher = S.zurueckZu;
  S.neu = null; S.posIndex = null; S.zurueckZu = istBreit() ? "desktop" : "liste";
  if (woher === "freigabe") {
    // Zurück in die Freigabeliste — am Handy wie am Rechner.
    S.zurueckZu = "freigabe";
    S.ansicht = "freigabe"; await ladeAlles(); render();
  } else if (istBreit()) {
    S.ansicht = "liste";
    await ladeAlles(); await ladeUebersicht(true);
  } else if (woher === "uebersicht") {
    S.ansicht = "uebersicht"; await ladeUebersicht(true);
  } else {
    S.ansicht = "liste"; await ladeAlles(); render();
  }
}

// ---------- Benutzerverwaltung (nur Admin) ----------
// Alles läuft über die Edge Function, weil Passwörter setzen und Konten
// anlegen nur mit dem service_role-Schlüssel geht — und der bleibt dort.
// Wirft nie: bei Netzfehler oder kaputter Antwort kommt { ok:false } zurück.
export async function benutzerRuf(daten): Promise<any> {
  try {
    const r = await fetch(`${SUPABASE_URL}/functions/v1/benutzer`, {
      method: "POST",
      headers: { Authorization: `Bearer ${S.session.access_token}`,
                 apikey: SUPABASE_KEY, "Content-Type": "application/json" },
      body: JSON.stringify(daten)
    });
    return await r.json();
  } catch (e) {
    return { ok: false, fehler: istNetzfehler(e) ? NETZTEXT : String(e.message || e) };
  }
}

export async function ladeBenutzer() {
  const j = await benutzerRuf({ aktion: "liste" });
  S.benutzer = j.ok ? (j.benutzer || []) : [];
  return j;
}

// Nach dem Anmelden: alles laden und anzeigen
export async function nachAnmeldung(session) {
  S.session = session;
  S.loginMeldung = null;
  await ladeAlles();
  if (istBreit()) await ladeUebersicht(true); else render();
}

// Zur Anmeldung zurück
export function zeigeLogin(meldung?: string) {
  S.session = null;
  S.loginMeldung = meldung || null;
  render();
}

