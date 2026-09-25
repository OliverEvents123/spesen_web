// Verbindung zu Supabase, der Zustand der App und alle Datenzugriffe.
// Hier ändern: Zugangsdaten, Laden, Speichern, Gruppierung, Bildaufbereitung, Favoriten.

const SUPABASE_URL = "https://ieziwunnhyoiacleyspw.supabase.co";
const SUPABASE_KEY = "sb_publishable_vFDhfRba41suO17FZOHdAg_wa0jonFy";

const sb  = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
const app = document.getElementById("app");

// ---------- Feste Werte ----------
const ZAHLART = { karte:"Kreditkarte", bar:"Bar", vorkasse:"Vorauskasse" };
const zahlartName = (z) => ZAHLART[z || "karte"] || z;

const NETZTEXT = "Kein Netz. Bitte das Foto lokal speichern und im Nachhinein hochladen.";
const MAX_KACHELN = 6;   // mehr Favoriten sind nur in der Verwaltung sichtbar

const STIFT = `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#215aa8"
  stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <path d="M4 20h4l10-10-4-4L4 16z"></path><path d="M14 6l4 4"></path></svg>`;
const STERN = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#215aa8"
  stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <path d="M12 4l2.4 5 5.6.8-4 3.9 1 5.5-5-2.6-5 2.6 1-5.5-4-3.9 5.6-.8z"></path></svg>`;

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
const betragVon = (roh) => parseInt(roh || "0", 10) / 100;
const ordnerName = (mail) => mail.replace(/@/g,"_").replace(/\./g,"_");

function istNetzfehler(err) {
  if (!navigator.onLine) return true;
  const t = String((err && (err.message || err.error_description)) || err || "").toLowerCase();
  return t.includes("failed to fetch") || t.includes("networkerror") ||
         t.includes("network request failed") || t.includes("load failed") ||
         t.includes("timeout");
}

// ---------- Zustand ----------
let S = {
  session:null, istAdmin:false, konten:[], auftraege:[], belege:[], favoriten:[],
  monat: heute().slice(0,7), ansicht:"liste", neu:null, favEdit:null,
  suche:"", meldung:null, zurueckZu:"liste",
  uMonat: heute().slice(0,7), uGeraet:"", uZahlart:"", uBelege:[], uLaedt:false
};

const leererBeleg = () => ({ id:null, konto:null, auftrag:null, mwst:"8.1", roh:"",
                             datum: heute(), zahlart:"karte", datei:null, vorschau:null,
                             altPfad:null, altUrl:null });

const leererFavorit = () => ({ id:null, name:"", konto:null, auftrag:null });

const kontoName = (nr) => {
  const k = S.konten.find(x => x.nummer === nr);
  return k ? k.bezeichnung : "";
};

// ---------- Laden ----------
async function ladeAlles() {
  const [k, b, f, adm] = await Promise.all([
    sb.from("spesen_konto").select("nummer,bezeichnung,mwst").eq("aktiv",true).order("sortierung"),
    sb.from("spesen_beleg").select("*").eq("monat", S.monat).eq("geraet", S.session.user.email)
      .order("beleg_datum",{ascending:false}).order("id",{ascending:false}),
    sb.from("spesen_favorit").select("*").order("sortierung").order("id"),
    sb.rpc("ist_admin")
  ]);
  S.konten    = k.data || [];
  S.belege    = b.data || [];
  S.favoriten = f.data || [];
  S.istAdmin  = adm.data === true;

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

async function ladeUebersicht() {
  S.uLaedt = true; render();
  const { data } = await sb.from("spesen_beleg").select("*").eq("monat", S.uMonat)
    .order("beleg_datum",{ascending:true}).order("id",{ascending:true});
  S.uBelege = data || [];
  S.uLaedt  = false;
  render();
}

// ---------- Favoriten ----------
// Ein Favorit hält Konto und Auftragsnummer. Alles andere bleibt am Beleg.
async function favSpeichern(fav) {
  const daten = {
    geraet:       S.session.user.email,
    name:         fav.name.trim() || fav.konto.bezeichnung || fav.konto.nummer,
    konto_nummer: fav.konto.nummer,
    auftrag_nr:   fav.auftrag.id,
    auftrag_name: fav.auftrag.name || null
  };
  if (fav.id) {
    return sb.from("spesen_favorit").update(daten).eq("id", fav.id);
  }
  const hoechste = S.favoriten.reduce((m, f) => Math.max(m, f.sortierung || 0), 0);
  return sb.from("spesen_favorit").insert({ ...daten, sortierung: hoechste + 10 });
}

async function favLoeschen(id) {
  return sb.from("spesen_favorit").delete().eq("id", id);
}

// Tauscht einen Favoriten mit dem darüberliegenden
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

// Favorit auf einen neuen Beleg anwenden
function favAnwenden(id) {
  const f = S.favoriten.find(x => String(x.id) === String(id));
  if (!f) return;
  const k = S.konten.find(x => x.nummer === f.konto_nummer)
            || { nummer:f.konto_nummer, bezeichnung:kontoName(f.konto_nummer) };
  const a = S.auftraege.find(x => x.id === f.auftrag_nr)
            || { id:f.auftrag_nr, name:f.auftrag_name || "" };
  S.neu = { ...leererBeleg(), konto:k, auftrag:a, mwst:String(k.mwst ?? "8.1") };
  S.zurueckZu = "liste";
  S.ansicht = "erfassen";
  render();
}

// ---------- Auswertung ----------
// MwSt wird auf der Gruppensumme gerechnet, nicht je Beleg — sonst
// entstehen durch das Runden Rappendifferenzen.
function gruppiere(belege) {
  const m = new Map();
  for (const b of belege) {
    const s = `${b.konto_nummer}|${b.auftrag_nr}|${b.mwst}`;
    if (!m.has(s)) m.set(s, { konto:b.konto_nummer, bezeichnung:kontoName(b.konto_nummer),
                              auftrag:b.auftrag_nr, satz:Number(b.mwst), anzahl:0, brutto:0 });
    const g = m.get(s);
    g.anzahl += 1;
    g.brutto += parseFloat(b.betrag);
  }
  const liste = [...m.values()].map(g => {
    const netto = g.brutto / (1 + g.satz / 100);
    return { ...g, netto: Math.round(netto*100)/100,
             steuer: Math.round((g.brutto - netto)*100)/100 };
  });
  liste.sort((a,b) => a.konto.localeCompare(b.konto,"de",{numeric:true})
                   || a.auftrag.localeCompare(b.auftrag,"de",{numeric:true})
                   || b.satz - a.satz);
  return liste;
}

const uGefiltert = () => S.uBelege.filter(b =>
  (!S.uGeraet  || b.geraet === S.uGeraet) &&
  (!S.uZahlart || (b.zahlart || "karte") === S.uZahlart));

const uTitel = () => [
  monatName(S.uMonat),
  S.uGeraet || (S.istAdmin ? "Alle Geräte" : S.session.user.email),
  S.uZahlart ? zahlartName(S.uZahlart) : "Alle Zahlungsarten"
].join(" · ");

const uDateiname = () =>
  `Spesen_${S.uMonat}` +
  (S.uZahlart ? "_" + S.uZahlart : "") +
  (S.uGeraet ? "_" + S.uGeraet.split("@")[0] : (S.istAdmin ? "_alle" : "")) + ".pdf";

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
  if (!file || !S.neu) return;
  const erlaubt = file.type === "application/pdf" || file.type.startsWith("image/");
  if (!erlaubt) { alert("Bitte ein Bild oder ein PDF wählen."); return; }
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
async function belegBearbeiten(id, woher) {
  const quelle = woher === "uebersicht" ? S.uBelege : S.belege;
  const b = quelle.find(x => String(x.id) === String(id));
  if (!b) return;

  const k = S.konten.find(x => x.nummer === b.konto_nummer)
            || { nummer:b.konto_nummer, bezeichnung:kontoName(b.konto_nummer) };
  const a = S.auftraege.find(x => x.id === b.auftrag_nr) || { id:b.auftrag_nr, name:"" };

  let url = null;
  if (b.datei_pfad && !b.datei_pfad.toLowerCase().endsWith(".pdf")) {
    const { data } = await sb.storage.from("belege").createSignedUrl(b.datei_pfad, 600);
    url = data ? data.signedUrl : null;
  }

  S.neu = {
    id: b.id, konto:k, auftrag:a, mwst:String(b.mwst),
    roh: String(Math.round(parseFloat(b.betrag) * 100)),
    datum: b.beleg_datum, zahlart: b.zahlart || "karte",
    datei:null, vorschau:null, altPfad: b.datei_pfad, altUrl: url
  };
  S.zurueckZu = woher;
  S.ansicht = "erfassen";
  render();
}

// ---------- Nach dem Speichern zurück ----------
async function zurueckNachSpeichern(text) {
  S.meldung = text;
  const woher = S.zurueckZu;
  S.neu = null; S.zurueckZu = "liste";
  if (woher === "uebersicht") { S.ansicht = "uebersicht"; await ladeUebersicht(); }
  else { S.ansicht = "liste"; await ladeAlles(); render(); }
}
