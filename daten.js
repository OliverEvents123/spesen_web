// daten.js
// Verbindung zu Supabase, der Zustand der App und alle Datenzugriffe.
// Hier ändern: Laden, Speichern, Gruppierung, Bildaufbereitung,
// Favoriten, Benutzer, Konten, Zeitraum.

// SUPABASE_URL und SUPABASE_KEY stehen in konfig.js — je eine für die echte
// App und für test/, damit beide auf ihre eigene Datenbank zeigen können.

const sb  = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
const app = document.getElementById("app");

// ---------- Feste Werte ----------
const ZAHLART = { karte:"Kreditkarte", bar:"Bar", vorkasse:"Vorauskasse" };
const zahlartName = (z) => ZAHLART[z || "karte"] || z;

const NETZTEXT = "Kein Netz. Bitte das Foto lokal speichern und im Nachhinein hochladen.";
const GESPERRT_TEXT = "Dieser Beleg lässt sich nicht mehr ändern oder löschen — "
                    + "er ist abgeschlossen oder gehört einem anderen Gerät.";
const MAX_KACHELN = 6;          // mehr Favoriten nur in der Verwaltung
const MAX_PERIODEN = 3;         // je Benutzer; die Datenbank hält dieselbe Grenze
const BREIT_AB = 900;           // ab dieser Breite das Rechner-Layout
const SAETZE = ["8.1","2.6","3.8","0"];

// Fester Eintrag für Belege ohne Kostenstelle. Kommt nicht aus FileMaker und
// steht in der Auswahl immer zuoberst. In der Datenbank landet die id "ohne" —
// braucht DocuWare etwas anderes, nur hier die id ändern.
const OHNE_KST = { id:"ohne KST", name:"ohne KST", fix:true };

// Notfall-Administratoren: behalten immer die Rolle admin und lassen sich
// nicht sperren. Die Edge Function prüft dasselbe noch einmal — dort ist die
// verbindliche Stelle, hier wird nur die Oberfläche entsprechend gesperrt.
const GESCHUETZTE_KONTEN = ["admin@eventorganisation.ch"];
const istGeschuetzt = (mail) =>
  GESCHUETZTE_KONTEN.includes(String(mail || "").trim().toLowerCase());

// Wie eine Auftragsnummer im Text erscheint
const auftragAnzeige = (nr) => nr === OHNE_KST.id ? OHNE_KST.name : nr;
const auftragText = (a) => !a ? "wählen"
  : (a.id === OHNE_KST.id ? OHNE_KST.name
     : a.id + (a.name ? "  " + a.name : ""));

// Die Abrechnungsperiode läuft vom 16. bis zum 15. des Folgemonats.
const PERIODE_START = 16;

const istBreit = () => window.matchMedia(`(min-width:${BREIT_AB}px)`).matches;

const STIFT = `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#215aa8"
  stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <path d="M4 20h4l10-10-4-4L4 16z"></path><path d="M14 6l4 4"></path></svg>`;
const STERN = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#215aa8"
  stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <path d="M12 4l2.4 5 5.6.8-4 3.9 1 5.5-5-2.6-5 2.6 1-5.5-4-3.9 5.6-.8z"></path></svg>`;
const HOCH = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#8B9AB4"
  stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <path d="M12 16V5"></path><path d="M7 10l5-5 5 5"></path><path d="M5 19h14"></path></svg>`;
const PLUS = `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#215aa8"
  stroke-width="2.2" stroke-linecap="round" aria-hidden="true">
  <path d="M12 5v14"></path><path d="M5 12h14"></path></svg>`;

// ---------- Kleine Helfer ----------
const esc = (t) => String(t ?? "").replace(/[&<>"]/g,
  (c) => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;" }[c]));
const heute = () => new Date().toLocaleDateString("sv-SE");
const monatName = (m) => {
  const n = ["Januar","Februar","März","April","Mai","Juni",
             "Juli","August","September","Oktober","November","Dezember"];
  const [j, mm] = m.split("-");
  return n[parseInt(mm,10)-1] + " " + j;
};
const chf = (z) => Number(z).toFixed(2);
const datumCH = (d) => new Date(d).toLocaleDateString("de-CH");
const ordnerName = (mail) => mail.replace(/@/g,"_").replace(/\./g,"_");
const kurzName = (mail) => String(mail || "").split("@")[0];

// Betrag aus dem Textfeld: akzeptiert Punkt und Komma
const betragVon = (text) => {
  const z = parseFloat(String(text ?? "").replace(",", ".").replace(/[^\d.]/g, ""));
  return isFinite(z) && z > 0 ? Math.round(z * 100) / 100 : 0;
};

// ---------- Zeitraum ----------
// Ortszeit, nicht UTC — sonst rutscht das Datum je nach Stunde um einen Tag.
const isoDatum = (d) =>
  new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);

const kurzDatum = (iso) => iso.slice(8,10) + "." + iso.slice(5,7) + ".";
const langDatum = (iso) => iso.slice(8,10) + "." + iso.slice(5,7) + "." + iso.slice(0,4);

// versatz 0 = laufende Periode, -1 = die davor
function periode(versatz) {
  const h = new Date();
  let m = h.getMonth();
  if (h.getDate() < PERIODE_START) m -= 1;   // vor dem 16. läuft noch die Vorperiode
  m += (versatz || 0);
  const von = new Date(h.getFullYear(), m, PERIODE_START);
  const bis = new Date(h.getFullYear(), m + 1, PERIODE_START - 1);
  return { von: isoDatum(von), bis: isoDatum(bis) };
}

function istNetzfehler(err) {
  if (!navigator.onLine) return true;
  const t = String((err && (err.message || err.error_description)) || err || "").toLowerCase();
  return t.includes("failed to fetch") || t.includes("networkerror") ||
         t.includes("network request failed") || t.includes("load failed") ||
         t.includes("timeout");
}

// ---------- Zustand ----------
const START = periode(0);

let S = {
  session:null, istAdmin:false, konten:[], auftraege:[], belege:[], favoriten:[],
  benutzer:[], benEdit:null, kontEdit:null, perioden:[],
  monat: heute().slice(0,7), ansicht:"liste", neu:null, favEdit:null, posIndex:null,
  suche:"", meldung:null, zurueckZu:"liste",
  uVon: START.von, uBis: START.bis, uBelege:[], uLaedt:false,
  uGeraet:"", uZahlart:"", uKonto:"", uAuftrag:""
};

const leererBeleg = () => ({ id:null, konto:null, auftrag:null, mwst:"8.1", betragText:"",
                             positionen:null,
                             datum: heute(), zahlart:"karte", datei:null, vorschau:null,
                             altPfad:null, altUrl:null });

const leerePosition = (vorlage) => ({
  betragText: "", mwst: (vorlage && vorlage.mwst) || "8.1",
  konto: (vorlage && vorlage.konto) || null,
  auftrag: (vorlage && vorlage.auftrag) || null
});

const leererFavorit = () => ({ id:null, name:"", konto:null, auftrag:null });

const leeresKonto = () => {
  const hoechste = S.konten.reduce((m,k) => Math.max(m, k.sortierung || 0), 0);
  return { neu:true, nummer:"", bezeichnung:"", mwst:"8.1",
           sortierung: String(hoechste + 10), aktiv:true };
};

const kontoName = (nr) => {
  const k = S.konten.find(x => x.nummer === nr);
  return k ? k.bezeichnung : "";
};

// In der Auswahl stehen nur aktive Konten; die Admin-Liste zeigt alle.
const aktiveKonten = () => S.konten.filter(k => k.aktiv !== false);

// Die Zeilen eines Belegs: entweder seine Positionen oder er selbst als eine.
const belegZeilen = (b) =>
  (Array.isArray(b.positionen) && b.positionen.length)
    ? b.positionen
    : [{ betrag:b.betrag, mwst:b.mwst,
         konto_nummer:b.konto_nummer, auftrag_nr:b.auftrag_nr }];

const istAufgeteilt = (b) => Array.isArray(b.positionen) && b.positionen.length > 1;

// ---------- Laden ----------
const KONTO_SPALTEN = "nummer,bezeichnung,mwst,sortierung,aktiv";

async function ladeAlles() {
  const [k, b, f, adm, per] = await Promise.all([
    sb.from("spesen_konto").select(KONTO_SPALTEN).order("sortierung").order("nummer"),
    sb.from("spesen_beleg").select("*").eq("monat", S.monat).eq("geraet", S.session.user.email)
      .order("beleg_datum",{ascending:false}).order("id",{ascending:false}),
    sb.from("spesen_favorit").select("*").order("sortierung").order("id"),
    sb.rpc("ist_admin"),
    sb.from("spesen_periode").select("*").order("sortierung").order("von",{ascending:false})
  ]);
  S.konten    = k.data || [];
  S.belege    = b.data || [];
  S.favoriten = f.data || [];
  S.istAdmin  = adm.data === true;
  S.perioden  = per.data || [];

  // Auftragsnummern kommen aus FileMaker und werden nur einmal je Sitzung geholt
  if (!S.auftraege.length) {
    try {
      const r = await fetch(`${SUPABASE_URL}/functions/v1/auftragsnummern?jahr=${new Date().getFullYear()}`,
        { headers:{ Authorization:`Bearer ${S.session.access_token}`, apikey: SUPABASE_KEY } });
      const j = await r.json();
      if (j.ok) S.auftraege = j.auftragsnummern;
    } catch (e) { /* Hinweis erscheint bei der Auswahl */ }
  }
}

async function ladeFavoriten() {
  const { data } = await sb.from("spesen_favorit").select("*").order("sortierung").order("id");
  S.favoriten = data || [];
}

async function ladeKonten() {
  const { data } = await sb.from("spesen_konto")
    .select(KONTO_SPALTEN).order("sortierung").order("nummer");
  S.konten = data || [];
}

// ---------- Gespeicherte Perioden ----------
// Jeder Benutzer hat seine eigenen, höchstens MAX_PERIODEN Stück.
// Die Zugriffsregeln in Supabase zeigen ohnehin nur die eigenen.
async function ladePerioden() {
  const { data } = await sb.from("spesen_periode")
    .select("*").order("sortierung").order("von", { ascending:false });
  S.perioden = data || [];
}

async function periodeSpeichern(name, von, bis) {
  const hoechste = S.perioden.reduce((m,p) => Math.max(m, p.sortierung || 0), 0);
  return sb.from("spesen_periode")
    .insert({ geraet: S.session.user.email, name: String(name).trim(),
              von, bis, sortierung: hoechste + 10 });
}

async function periodeLoeschen(id) {
  return sb.from("spesen_periode").delete().eq("id", id);
}

// Zählt mit, welche Abfrage die neueste ist. Stellt man den Zeitraum schnell
// zweimal um, darf die langsamere erste Antwort die zweite nicht überschreiben.
let uLauf = 0;

async function ladeUebersicht(stumm) {
  const lauf = ++uLauf;
  if (!stumm) { S.uLaedt = true; render(); }

  const { data } = await sb.from("spesen_beleg").select("*")
    .gte("beleg_datum", S.uVon).lte("beleg_datum", S.uBis)
    .order("beleg_datum",{ascending:true}).order("id",{ascending:true});

  if (lauf !== uLauf) return;   // eine neuere Abfrage ist schon unterwegs
  S.uBelege = data || [];
  S.uLaedt  = false;
  render();
}

// ---------- Konten verwalten (nur Admin) ----------
async function kontoSpeichern(k) {
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
async function favSpeichern(fav) {
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

async function favLoeschen(id) {
  return sb.from("spesen_favorit").delete().eq("id", id);
}

async function favHoch(id) {
  const i = S.favoriten.findIndex(f => String(f.id) === String(id));
  if (i <= 0) return;
  const a = S.favoriten[i], b = S.favoriten[i-1];
  const sa = a.sortierung || (i+1)*10, sbv = b.sortierung || i*10;
  await Promise.all([
    sb.from("spesen_favorit").update({ sortierung: sbv }).eq("id", a.id),
    sb.from("spesen_favorit").update({ sortierung: sa  }).eq("id", b.id)
  ]);
  await ladeFavoriten();
}

function favAnwenden(id) {
  const f = S.favoriten.find(x => String(x.id) === String(id));
  if (!f) return;
  const k = S.konten.find(x => x.nummer === f.konto_nummer)
            || { nummer:f.konto_nummer, bezeichnung:kontoName(f.konto_nummer) };
  const a = auftragObjekt(f.auftrag_nr, f.auftrag_name);
  S.neu = { ...leererBeleg(), konto:k, auftrag:a, mwst:String(k.mwst ?? "8.1") };
  S.zurueckZu = istBreit() ? "desktop" : "liste";
  S.ansicht = "erfassen";
  render();
}

// ---------- Auswertung ----------
// MwSt wird auf der Gruppensumme gerechnet, nicht je Beleg — sonst
// entstehen durch das Runden Rappendifferenzen.
// Ein aufgeteilter Beleg liefert je Position eine Zeile.
function gruppiere(belege) {
  const m = new Map();
  for (const b of belege) {
    for (const p of belegZeilen(b)) {
      if (!zeilePasst(p)) continue;   // gefilterte Positionen zählen nicht mit
      const s = `${p.konto_nummer}|${p.auftrag_nr}|${p.mwst}|${b.zahlart || "karte"}`;
      if (!m.has(s)) m.set(s, { konto:p.konto_nummer, bezeichnung:kontoName(p.konto_nummer),
                                auftrag:p.auftrag_nr, satz:Number(p.mwst),
                                zahlart:(b.zahlart || "karte"), anzahl:0, brutto:0 });
      const g = m.get(s);
      g.anzahl += 1;
      g.brutto += parseFloat(p.betrag);
    }
  }
  const liste = [...m.values()].map(g => {
    const netto = g.brutto / (1 + g.satz / 100);
    return { ...g, netto: Math.round(netto*100)/100,
             steuer: Math.round((g.brutto - netto)*100)/100 };
  });
  liste.sort((a,b) => String(a.konto).localeCompare(String(b.konto),"de",{numeric:true})
                   || String(a.auftrag).localeCompare(String(b.auftrag),"de",{numeric:true})
                   || b.satz - a.satz);
  return liste;
}

// Passt eine einzelne Position zu den Filtern für Konto und Auftrag?
// Bei aufgeteilten Belegen zählt jede Position für sich.
const zeilePasst = (p) =>
  (!S.uKonto   || p.konto_nummer === S.uKonto) &&
  (!S.uAuftrag || p.auftrag_nr   === S.uAuftrag);

// Ist nach Konto oder Auftrag gefiltert, zählt von einem aufgeteilten Beleg
// nur der passende Teil — sonst zeigt die Belegliste mehr als die Kontierung.
// gesamtBetrag hält dann fest, wie viel der ganze Beleg ausmacht.
function belegImFilter(b) {
  if (!S.uKonto && !S.uAuftrag) return b;
  if (!Array.isArray(b.positionen) || b.positionen.length < 2) return b;
  const teile = b.positionen.filter(zeilePasst);
  if (teile.length === b.positionen.length) return b;
  const betrag = Math.round(teile.reduce((t,p) => t + parseFloat(p.betrag), 0) * 100) / 100;
  return { ...b, positionen: teile, betrag, gesamtBetrag: b.betrag,
           mwst: teile[0].mwst, konto_nummer: teile[0].konto_nummer,
           auftrag_nr: teile[0].auftrag_nr };
}

// Ein Beleg erscheint, wenn mindestens eine seiner Positionen passt.
const uGefiltert = () => S.uBelege.filter(b =>
  (!S.uGeraet  || b.geraet === S.uGeraet) &&
  (!S.uZahlart || (b.zahlart || "karte") === S.uZahlart) &&
  belegZeilen(b).some(zeilePasst)).map(belegImFilter);

// Was kommt im geladenen Zeitraum überhaupt vor? Füllt die Auswahlfelder.
function kontenImZeitraum() {
  const s = new Set();
  for (const b of S.uBelege) for (const p of belegZeilen(b)) s.add(p.konto_nummer);
  return [...s].sort((a,b) => String(a).localeCompare(String(b),"de",{numeric:true}));
}

function auftraegeImZeitraum() {
  const s = new Set();
  for (const b of S.uBelege) for (const p of belegZeilen(b)) s.add(p.auftrag_nr);
  return [...s].sort((a,b) => String(a).localeCompare(String(b),"de",{numeric:true}));
}

const uZeitraumText = () => `${langDatum(S.uVon)} – ${langDatum(S.uBis)}`;

const uTitel = () => {
  const teile = [
    uZeitraumText(),
    S.uGeraet || (S.istAdmin ? "Alle Geräte" : S.session.user.email),
    S.uZahlart ? zahlartName(S.uZahlart) : "Alle Zahlungsarten"
  ];
  if (S.uKonto)   teile.push("Konto " + S.uKonto);
  if (S.uAuftrag) teile.push("Auftrag " + auftragAnzeige(S.uAuftrag));
  return teile.join(" · ");
};

const uDateiname = () =>
  `Spesen_${S.uVon}_bis_${S.uBis}` +
  (S.uKonto   ? "_K" + S.uKonto   : "") +
  (S.uAuftrag ? "_A" + String(S.uAuftrag).replace(/\s+/g, "") : "") +
  (S.uZahlart ? "_" + S.uZahlart : "") +
  (S.uGeraet ? "_" + kurzName(S.uGeraet) : (S.istAdmin ? "_alle" : "")) + ".pdf";

// ---------- Belegdatei ----------
async function aufbereiten(file) {
  if (file.type === "application/pdf") return { blob:file, typ:"application/pdf", ext:"pdf" };
  try {
    const bm  = await createImageBitmap(file);
    const max = 2000;
    const f   = Math.min(1, max / Math.max(bm.width, bm.height));
    const c   = document.createElement("canvas");
    c.width   = Math.round(bm.width  * f);
    c.height  = Math.round(bm.height * f);
    c.getContext("2d").drawImage(bm, 0, 0, c.width, c.height);
    const blob = await new Promise((r) => c.toBlob(r, "image/jpeg", 0.82));
    if (!blob) throw new Error("leer");
    return { blob, typ:"image/jpeg", ext:"jpg" };
  } catch {
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
    return { blob:file, typ:(file.type || "image/jpeg"), ext };
  }
}

function dateiGewaehlt(file) {
  if (!file) return;
  const erlaubt = file.type === "application/pdf" || file.type.startsWith("image/");
  if (!erlaubt) { alert("Bitte ein Bild oder ein PDF wählen."); return; }

  // Vom Rechner direkt auf die Ablagefläche gezogen: Erfassung öffnen
  if (!S.neu) { S.neu = leererBeleg(); S.zurueckZu = istBreit() ? "desktop" : "liste";
                S.ansicht = "erfassen"; }

  if (S.neu.vorschau) URL.revokeObjectURL(S.neu.vorschau);
  S.neu.datei    = file;
  S.neu.vorschau = file.type === "application/pdf" ? null : URL.createObjectURL(file);
  render();
}

async function belegOeffnen(pfad) {
  const { data, error } = await sb.storage.from("belege").createSignedUrl(pfad, 60);
  if (error) { alert("Beleg konnte nicht geöffnet werden:\n" + error.message); return; }
  window.open(data.signedUrl, "_blank");
}

// ---------- Beleg zum Bearbeiten öffnen ----------
function kontoObjekt(nr) {
  return S.konten.find(x => x.nummer === nr)
         || { nummer:nr, bezeichnung:kontoName(nr) };
}
function auftragObjekt(id, ersatzName) {
  if (id === OHNE_KST.id) return OHNE_KST;
  return S.auftraege.find(x => x.id === id) || { id, name: ersatzName || "" };
}

async function belegBearbeiten(id, woher) {
  const quelle = woher === "liste" ? S.belege : S.uBelege;
  const b = (quelle.find(x => String(x.id) === String(id)))
            || S.belege.find(x => String(x.id) === String(id))
            || S.uBelege.find(x => String(x.id) === String(id));
  if (!b) return;

  let url = null;
  if (b.datei_pfad && !b.datei_pfad.toLowerCase().endsWith(".pdf")) {
    const { data } = await sb.storage.from("belege").createSignedUrl(b.datei_pfad, 600);
    url = data ? data.signedUrl : null;
  }

  const aufgeteilt = Array.isArray(b.positionen) && b.positionen.length > 1;

  S.neu = {
    id: b.id,
    konto:   kontoObjekt(b.konto_nummer),
    auftrag: auftragObjekt(b.auftrag_nr),
    mwst: String(b.mwst),
    betragText: chf(b.betrag),
    positionen: aufgeteilt ? b.positionen.map(p => ({
      betragText: chf(p.betrag),
      mwst: String(p.mwst),
      konto: kontoObjekt(p.konto_nummer),
      auftrag: auftragObjekt(p.auftrag_nr)
    })) : null,
    datum: b.beleg_datum, zahlart: b.zahlart || "karte",
    datei:null, vorschau:null, altPfad: b.datei_pfad, altUrl: url
  };
  S.posIndex  = null;
  S.zurueckZu = woher;
  S.ansicht   = "erfassen";
  render();
}

// Summe der Positionen — das ist der Belegbetrag, wenn aufgeteilt wird.
const positionenSumme = (pos) =>
  (pos || []).reduce((t,p) => t + betragVon(p.betragText), 0);

const positionenFertig = (pos) =>
  Array.isArray(pos) && pos.length > 0 &&
  pos.every(p => betragVon(p.betragText) > 0 && p.konto && p.auftrag);

// ---------- Nach dem Speichern zurück ----------
async function zurueckNachSpeichern(text) {
  S.meldung = text;
  const woher = S.zurueckZu;
  S.neu = null; S.posIndex = null; S.zurueckZu = istBreit() ? "desktop" : "liste";
  if (istBreit()) {
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
// Wirft nie: bei Netzfehler oder kaputter Antwort kommt { ok:false } zurück,
// sonst bliebe der Knopf auf "Speichere …" hängen.
async function benutzerRuf(daten) {
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

async function ladeBenutzer() {
  try {
    const j = await benutzerRuf({ aktion: "liste" });
    S.benutzer = j.ok ? (j.benutzer || []) : [];
    return j;
  } catch (e) {
    S.benutzer = [];
    return { ok: false, fehler: String(e) };
  }
}

// Wie viele Belege hat ein Gerät im gewählten Zeitraum?
const belegeVon = (mail) => S.uBelege.filter(b => b.geraet === mail).length;
