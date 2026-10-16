// daten.ts
// Alle Datenzugriffe: Laden, Speichern, Gruppierung, Bildaufbereitung,
// Favoriten, Benutzer, Konten, Zeitraum, Freigabe.
// Inhaltlich 1:1 aus der alten daten.js übernommen.

import { S, sb, render } from "./zustand";
import { SUPABASE_URL, SUPABASE_KEY } from "./konfig";
import { SpesenExport } from "./export";
import {
  OHNE_KST, NETZTEXT, istBreit, istNetzfehler, heute, chf, chfLang, kurzName, kurzZeit,
  statusVon, statusName, statusKlasse, istEntschieden, zahlartName, auftragAnzeige, langDatum,
  buchungsBetrag, belegZeilen, istGesperrt, STATUS_FILTER
} from "./grundlagen";

// ---------- Leere Vorlagen ----------
export const leererBeleg = () => ({
  id: null, status: "offen", konto: null, auftrag: null, mwst: "8.1", betragText: "",
  positionen: null, datum: heute(), zahlart: "karte", datei: null, vorschau: null,
  altPfad: null, altUrl: null, kommentar: "", zahlgeraet: null
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

export const leeresGeraet = () => ({ neu: true, id: null, name: "", auftrag_nr: "", aktiv: true });

export const kontoName = (nr: string) => {
  const k = S.konten.find((x) => x.nummer === nr);
  return k ? k.bezeichnung : "";
};

// In der Auswahl stehen nur aktive Konten; die Admin-Liste zeigt alle.
export const aktiveKonten = () => S.konten.filter((k) => k.aktiv !== false);

// ---------- Laden ----------
const KONTO_SPALTEN = "nummer,bezeichnung,mwst,sortierung,aktiv";

export async function ladeAlles() {
  const ich = S.session.user.email;
  const [k, f, adm, me, nam, ger] = await Promise.all([
    sb.from("spesen_konto").select(KONTO_SPALTEN).order("sortierung").order("nummer"),
    sb.from("spesen_favorit").select("*").order("sortierung").order("id"),
    sb.rpc("ist_admin"),
    sb.from("spesen_benutzer").select("name,rolle").eq("email", ich).maybeSingle(),
    sb.rpc("benutzer_namen"),
    sb.from("spesen_zahlgeraet").select("*").order("name"),
    ladeMeine(),
    ladePerioden()
  ]);
  S.konten    = k.data || [];
  S.favoriten = f.data || [];
  S.istAdmin  = adm.data === true;
  S.ich       = { name: (me.data && me.data.name) || "", rolle: (me.data && me.data.rolle) || "user" };
  // Namen statt E-Mail — fehlt die Funktion (ältere Datenbank), bleibt es bei der E-Mail
  if (!nam.error && Array.isArray(nam.data))
    S.namen = Object.fromEntries(nam.data.map((x) => [x.email, x.name]));
  // Geräte — fehlt die Tabelle (Datenbank ohne geraete.sql), gibt es keine Auswahl
  S.geraeteDa   = !ger.error;
  S.zahlgeraete = ger.error ? [] : (ger.data || []);

  // Fehlt die Funktion (Datenbank ohne Etappe 2), bleibt alles wie bisher.
  const pr = await sb.rpc("ist_pruefer");
  S.istPruefer = !pr.error && pr.data === true;
  if (S.istPruefer) await Promise.all([ladeFreigabe(), ladeVerlauf(), ladeEigeneZuweisungen()]);

  // Auftragsnummern kommen aus FileMaker und werden nur einmal je Sitzung geholt
  if (!S.auftraege.length) S.auftraege = await ladeAuftraege();
}

// ---------- Kostenstellen: was erscheint in der Auswahl? ----------
// Der Admin stellt ein: welche Jahre (Haken), welche KST immer erscheinen
// (auch aus ausgeblendeten Jahren) und welche ausgeblendet sind.
export async function ladeKstEinstellungen() {
  const [j, r] = await Promise.all([
    sb.from("spesen_kst_jahr").select("jahr,sichtbar").order("jahr", { ascending: false }),
    sb.from("spesen_kst_regel").select("auftrag_nr,sichtbar").order("auftrag_nr")
  ]);
  S.kstDa     = !j.error && !r.error;
  S.kstJahre  = j.data || [];
  S.kstRegeln = r.data || [];
}

async function auftragsnummernHolen(abfrage: string) {
  try {
    const r = await fetch(`${SUPABASE_URL}/functions/v1/auftragsnummern?${abfrage}`,
      { headers: { Authorization: `Bearer ${S.session.access_token}`, apikey: SUPABASE_KEY } });
    return await r.json();
  } catch { return { ok: false }; }
}

const nachNummer = (a, b) => String(a.id).localeCompare(String(b.id), "de", { numeric: true });

// Die Auswahl laden. Ohne Einstellungen (Datenbank ohne kst-auswahl.sql):
// wie bisher laufendes Jahr und Vorjahr. Reihenfolge: "immer anzeigen" zuerst,
// dann das neuere Jahr vor dem älteren, je nach Nummer.
export async function ladeAuftraege() {
  await ladeKstEinstellungen();
  let liste: any[] = [];
  if (!S.kstDa) {
    const jahr = new Date().getFullYear();
    const teile = await Promise.all([auftragsnummernHolen("jahr=" + jahr), auftragsnummernHolen("jahr=" + (jahr - 1))]);
    liste = teile.flatMap((t) => t.ok ? t.auftragsnummern : []);
  } else {
    const jahre = S.kstJahre.filter((x) => x.sichtbar).map((x) => x.jahr);
    const immer = S.kstRegeln.filter((x) => x.sichtbar).map((x) => x.auftrag_nr);
    const d = (jahre.length || immer.length)
      ? await auftragsnummernHolen(`jahre=${jahre.join(",")}&nummern=${immer.map(encodeURIComponent).join(",")}`)
      : { ok: true, jahre: [], auftragsnummern: [] };
    if (d.ok && Array.isArray(d.jahre)) {
      S.kstFunktionNeu = true;
      liste = d.auftragsnummern || [];
    } else {
      // Ältere Edge Function: Jahr für Jahr holen. Die festen Nummern liefert
      // sie dann selbst; "immer anzeigen" aus anderen Jahren geht erst nach dem Deploy.
      S.kstFunktionNeu = false;
      const teile = await Promise.all(jahre.map((j) => auftragsnummernHolen("jahr=" + j)));
      liste = teile.flatMap((t) => t.ok ? t.auftragsnummern : []);
    }
    const aus = new Set(S.kstRegeln.filter((x) => !x.sichtbar).map((x) => x.auftrag_nr));
    const immerSet = new Set(immer);
    liste = liste.filter((a) => !aus.has(a.id)).map((a) => ({ ...a, immer: immerSet.has(a.id) || (!S.kstFunktionNeu && a.immer) }));
  }
  const gesehen = new Set();
  liste = liste.filter((a) => !gesehen.has(a.id) && gesehen.add(a.id));
  liste.sort((a, b) => (a.immer === b.immer ? 0 : a.immer ? -1 : 1)
                    || String(b.jahr || "").localeCompare(String(a.jahr || "")) || nachNummer(a, b));
  return liste;
}

// Einstellungen ändern (nur Admin)
export const kstJahrSetzen = (jahr: number, sichtbar: boolean) =>
  sb.from("spesen_kst_jahr").upsert({ jahr, sichtbar });
export const kstJahrLoeschen = (jahr: number) => sb.from("spesen_kst_jahr").delete().eq("jahr", jahr);
export const kstRegelSetzen = (nr: string, sichtbar: boolean) =>
  sb.from("spesen_kst_regel").upsert({ auftrag_nr: nr, sichtbar });
export const kstRegelLoeschen = (nr: string) => sb.from("spesen_kst_regel").delete().eq("auftrag_nr", nr);

// Eigene Belege der gewählten Periode — und alle eigenen, die noch etwas
// brauchen (erfasst oder abgelehnt), egal aus welcher Periode.
export async function ladeMeine() {
  const ich = S.session.user.email;
  const [b, o] = await Promise.all([
    sb.from("spesen_beleg").select("*").eq("geraet", ich)
      .gte("beleg_datum", S.uVon).lte("beleg_datum", S.uBis)
      .order("beleg_datum", { ascending: false }).order("id", { ascending: false }),
    sb.from("spesen_beleg").select("*").eq("geraet", ich).in("status", ["offen", "abgelehnt"])
      .order("beleg_datum", { ascending: false }).order("id", { ascending: false })
  ]);
  S.belege       = b.data || [];
  S.offeneEigene = o.error ? S.belege.filter((x) => statusVon(x) === "offen") : (o.data || []);
}

// Neuer Zeitraum: eigene Belege und Übersicht neu holen
export async function zeitraumLaden() {
  S.uGeraet = ""; S.uKonto = ""; S.uAuftrag = "";
  render();
  await Promise.all([ladeMeine(), ladeUebersicht(true)]);
  render();
}

// ---------- Verlauf ----------
// Admin sieht alles, Prüfer den Verlauf der Belege, die sie sehen dürfen.
// Belege, die nicht im geladenen Zeitraum liegen, werden nachgeholt —
// sonst stünde in der Liste nur "Beleg".
export async function ladeVerlauf() {
  const { data, error } = await sb.from("spesen_verlauf")
    .select("id,beleg_id,wann,wer,aktion,status,details")
    .order("wann", { ascending: false }).limit(60);
  S.verlauf = error ? [] : (data || []);
  const fehlt = [...new Set(S.verlauf.map((v) => v.beleg_id))]
    .filter((id: any) => !verlaufBeleg(id) && !S.verlaufBelege[id]);
  if (!fehlt.length) return;
  const { data: b } = await sb.from("spesen_beleg")
    .select("id,geraet,auftrag_nr,konto_nummer,betrag,positionen,zahlart,status").in("id", fehlt);
  for (const x of b || []) S.verlaufBelege[x.id] = x;
}

// Der Beleg zu einem Verlaufseintrag, falls er geladen ist
const verlaufBeleg = (id) => {
  const gleich = (x) => String(x.id) === String(id);
  return S.uBelege.find(gleich) || S.belege.find(gleich) || S.freigabe.find(gleich)
      || S.verlaufBelege[id] || null;
};

// Name einer Person, sonst der Teil vor dem @
export const personName = (mail: string) => {
  if (!mail) return "";
  if (S.namen[mail]) return S.namen[mail];
  const b = S.benutzer.find((x) => x.email === mail);
  return (b && b.name) || kurzName(mail);
};

// Eine Zeile im Verlauf: Farbe, was geschah (titel), welcher Beleg (beleg,
// betrag), wer und wann. beleg ist null, wenn er nicht mehr zu finden ist.
export function verlaufEintrag(v: any) {
  const geladen = verlaufBeleg(v.beleg_id);
  const d = v.details || {};
  // In "angelegt"/"gelöscht" steht der ganze Beleg, sonst je Feld { alt, neu }
  const wert = (k) => (d[k] && typeof d[k] === "object" && "neu" in d[k]) ? d[k].neu : d[k];
  const ganz = v.aktion === "angelegt" || v.aktion === "gelöscht";
  const beleg = geladen || (ganz ? d : null);
  const betrag = beleg ? beleg.betrag : wert("betrag");
  let titel = "Geändert", farbe = "gep";
  if (v.aktion === "angelegt")      { titel = "Erfasst";  farbe = "erf"; }
  else if (v.aktion === "gelöscht") { titel = "Gelöscht"; farbe = "abl"; }
  else if (v.aktion === "status") {
    const s = v.status || "offen";
    titel = s === "offen" ? "Zurück auf erfasst" : statusName(s);
    titel = titel[0].toUpperCase() + titel.slice(1);
    if (s === "teilweise" && wert("genehmigt_betrag") != null) titel += " · " + chfLang(wert("genehmigt_betrag"));
    farbe = statusKlasse(s);
  } else if (d.konto_nummer || d.auftrag_nr) {
    titel = "Umkontiert" + (d.auftrag_nr ? ` · KST ${auftragAnzeige(d.auftrag_nr.alt)} → ${auftragAnzeige(d.auftrag_nr.neu)}` : "");
  }
  return { farbe, titel, beleg, betrag, wer: personName(v.wer), wann: kurzZeit(v.wann),
           belegId: geladen ? geladen.id : null };
}

// ---------- Geräte ----------
export async function ladeGeraete() {
  const { data, error } = await sb.from("spesen_zahlgeraet").select("*").order("name");
  S.geraeteDa   = !error;
  S.zahlgeraete = error ? [] : (data || []);
}

export const geraetName = (id: any) => {
  if (id == null || id === "") return "";
  const g = S.zahlgeraete.find((x) => String(x.id) === String(id));
  return g ? g.name : "Gerät " + id;
};

// Welche Geräte kommen für diesen Beleg in Frage? Nur bei Kreditkarte, nur
// aktive auf einer seiner KST — dazu das schon gewählte, auch wenn inaktiv.
export function geraeteFuer(n: any) {
  if (!n || n.zahlart !== "karte" || !S.zahlgeraete.length) return [];
  const kst = (Array.isArray(n.positionen) ? n.positionen : [n])
    .map((p) => p.auftrag && p.auftrag.id).filter(Boolean);
  return S.zahlgeraete.filter((g) => kst.includes(g.auftrag_nr)
    && (g.aktiv !== false || String(g.id) === String(n.zahlgeraet)));
}

// Das Gerät, das gespeichert wird: das gewählte, wenn es passt —
// gibt es nur eines, ist es das.
export function geraetGewaehlt(n: any) {
  const liste = geraeteFuer(n);
  const g = liste.find((x) => String(x.id) === String(n.zahlgeraet));
  if (g) return g.id;
  return liste.length === 1 ? liste[0].id : null;
}

// Mehrere Geräte zur Wahl, aber keines gewählt?
export const geraetFehlt = (n: any) => geraeteFuer(n).length > 1 && geraetGewaehlt(n) == null;

export function geraetSpeichern(g: any) {
  const daten = { name: String(g.name || "").trim(), auftrag_nr: String(g.auftrag_nr || "").trim(),
                  aktiv: !!g.aktiv };
  if (g.neu) return sb.from("spesen_zahlgeraet").insert(daten);
  return sb.from("spesen_zahlgeraet").update(daten).eq("id", g.id);
}

export const geraetLoeschen = (id) => sb.from("spesen_zahlgeraet").delete().eq("id", id);

// Wie viele Belege hat ein Gerät im gewählten Zeitraum?
export const belegeAufGeraet = (id) => S.uBelege.filter((b) => String(b.zahlgeraet_id) === String(id)).length;

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
  const [z, k, p] = await Promise.all([
    sb.from("spesen_zuweisung").select("email,auftrag_nr").order("auftrag_nr"),
    sb.from("spesen_zuweisung_konto").select("email,konto_nummer").order("konto_nummer"),
    sb.from("spesen_zuweisung_person").select("email,person").order("person")
  ]);
  S.zuweisungen       = z.data || [];
  S.zuweisungenKonto  = k.data || [];
  S.zuweisungenPerson = p.error ? [] : (p.data || []);
}

// Meine eigenen Zuweisungen (KST, Konten, Personen) — darf ich eigene Belege
// selbst genehmigen, und welche Abschnitte hat mein Menü?
async function ladeEigeneZuweisungen() {
  const ich = S.session.user.email;
  const [z, k, p] = await Promise.all([
    sb.from("spesen_zuweisung").select("auftrag_nr").eq("email", ich),
    sb.from("spesen_zuweisung_konto").select("konto_nummer").eq("email", ich),
    sb.from("spesen_zuweisung_person").select("person").eq("email", ich)
  ]);
  S.meineKst      = (z.data || []).map((x) => x.auftrag_nr);
  S.meineKonten   = (k.data || []).map((x) => x.konto_nummer);
  S.meinePersonen = p.error ? [] : (p.data || []).map((x) => x.person);
}

// ---------- Abschnitte: Projektleitung, Supervisor, Administration ----------
// Jeder Abschnitt hat seine eigene Übersicht und Freigabe.
export const BEREICH_NAME: Record<string, string> = { pl: "Projektleitung", sup: "Supervisor", admin: "Administration" };

export function bereiche(): string[] {
  const l = [];
  if (S.meineKst.length) l.push("pl");
  if (S.ich.rolle === "supervisor" || S.meineKonten.length || S.meinePersonen.length) l.push("sup");
  if (S.istAdmin) l.push("admin");
  return l;
}

// Wo startet die Übersicht? Admin bei allem, sonst beim ersten Abschnitt.
export const standardBereich = () => {
  const l = bereiche();
  return l.includes("admin") ? "admin" : (l[0] || "");
};

// Gehört ein Beleg in diesen Abschnitt?
// Projektleitung: eine seiner KST ist mir zugewiesen.
// Supervisor: eines seiner Konten, eine User-Zahlung meiner Personen — und
// alles andere Fremde, das ich sehen darf, aber nicht über meine KST
// (das sind Belege von Benutzern mit eingerichteter Prüfung).
// Administration (und leer): alles.
export function imBereich(b: any, bereich: string = S.bereich) {
  if (!bereich || bereich === "admin") return true;
  const zeilen = belegZeilen(b);
  const kst = zeilen.some((p) => S.meineKst.includes(p.auftrag_nr));
  if (bereich === "pl") return kst;
  return zeilen.some((p) => S.meineKonten.includes(p.konto_nummer))
      || ((b.zahlart || "karte") === "vorkasse" && S.meinePersonen.includes(b.geraet))
      || (!kst && b.geraet !== S.session.user.email);
}

export const freigabeIm = (bereich: string = S.bereich) => S.freigabe.filter((b) => imBereich(b, bereich));

// Freigabe mit den Filtern Person, KST, Konto (Supervisor und Admin)
export const freigabeGefiltert = (bereich: string = S.bereich) => freigabeIm(bereich).filter((b) =>
  (!S.fPerson || b.geraet === S.fPerson) &&
  (!S.fKst    || belegZeilen(b).some((p) => p.auftrag_nr === S.fKst)) &&
  (!S.fKonto  || belegZeilen(b).some((p) => p.konto_nummer === S.fKonto)));

// Dürfen in der Freigabe filtern: Supervisor und Admin
export const darfFreigabeFiltern = (bereich: string = S.bereich) =>
  istBreit() ? (bereich === "sup" || bereich === "admin")
             : (S.istAdmin || bereiche().includes("sup"));

// Bin ich für diesen (eigenen) Beleg selbst zuständig? Dann gibt es
// "Speichern und genehmigen" — sonst würde ich ihn zweimal anfassen.
// Gleiche Regel wie darf_entscheiden in der Datenbank.
export function kannSelbstEntscheiden(n: any) {
  if (S.istAdmin) return true;
  const zeilen = Array.isArray(n.positionen) ? n.positionen : [n];
  return zeilen.some((p) => (p.auftrag && S.meineKst.includes(p.auftrag.id))
                         || (p.konto && S.meineKonten.includes(p.konto.nummer)));
}

// ---------- Gespeicherte Zeiträume ----------
// Je Person höchstens MAX_PERIODEN, nur sie selbst sieht sie.
export async function ladePerioden() {
  const { data, error } = await sb.from("spesen_periode")
    .select("*").order("sortierung").order("von", { ascending: false });
  S.perioden = error ? [] : (data || []);
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

// Konto in der Auswahl eins nach oben. Danach stehen alle Konten in
// Zehnerschritten — nur geänderte werden geschrieben.
export async function kontoHoch(nr) {
  const liste = [...S.konten];
  const i = liste.findIndex((k) => k.nummer === nr);
  if (i <= 0) return null;
  [liste[i - 1], liste[i]] = [liste[i], liste[i - 1]];
  const auftraege = liste
    .map((k, j) => ({ k, neu: (j + 1) * 10 }))
    .filter(({ k, neu }) => k.sortierung !== neu)
    .map(({ k, neu }) => sb.from("spesen_konto").update({ sortierung: neu }).eq("nummer", k.nummer));
  const ergebnisse = await Promise.all(auftraege);
  await ladeKonten();
  return ergebnisse.find((r) => r.error)?.error || null;
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
  S.zurueckZu = ["liste", "uebersicht", "freigabe"].includes(S.ansicht) ? S.ansicht : "liste";
  S.ansicht = "erfassen";
  render();
}

// Favorit in den offenen Beleg übernehmen — Foto und Betrag bleiben
export function favUebernehmen(id) {
  const f = S.favoriten.find((x) => String(x.id) === String(id));
  if (!f || !S.neu) return;
  const k = S.konten.find((x) => x.nummer === f.konto_nummer)
            || { nummer: f.konto_nummer, bezeichnung: kontoName(f.konto_nummer) };
  S.neu.konto = k;
  S.neu.auftrag = auftragObjekt(f.auftrag_nr, f.auftrag_name);
  if (!S.neu.id && k.mwst != null) S.neu.mwst = String(k.mwst);
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
                                zahlart: (b.zahlart || "karte"), anzahl: 0, brutto: 0, kommentare: [] });
      const g = m.get(s);
      g.anzahl += 1;
      g.brutto += parseFloat(p.betrag);
      const k = String(b.kommentar || "").trim();
      if (k && !g.kommentare.includes(k)) g.kommentare.push(k);
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

// ---------- Meine Belege: eigener Filter ----------
const meineStatusPasst = (b, st) => !st ? true
  : st === "offenePunkte" ? ["offen", "eingereicht", "abgelehnt"].includes(statusVon(b))
  : st === "erledigt"     ? istErledigt(b) && statusVon(b) !== "abgelehnt"
  : statusVon(b) === st;
const meineZeilePasst = (p) => (!S.mKonto || p.konto_nummer === S.mKonto)
                            && (!S.mAuftrag || p.auftrag_nr === S.mAuftrag);
// ohne: "status" oder "zahlart" — für die Zähler auf den Kacheln
export const meineGefiltert = (ohne?: string) => S.belege.filter((b) =>
  (ohne === "zahlart" || ohne === "alles" || !S.mZahlart || (b.zahlart || "karte") === S.mZahlart) &&
  (ohne === "status" || ohne === "alles" || meineStatusPasst(b, S.mStatus)) &&
  belegZeilen(b).some(meineZeilePasst));
export const istMeinOffen = (b) => meineStatusPasst(b, "offenePunkte");
export const istMeinErledigt = (b) => meineStatusPasst(b, "erledigt");

// Statusfilter: ein einzelner Status oder eine der zwei Gruppen
export const istErledigt = (b) => istEntschieden(b) || statusVon(b) === "abgeschlossen";
const statusPasst = (b, st) => !st ? true
  : st === "erledigt"   ? istErledigt(b)
  : st === "unerledigt" ? !istErledigt(b)
  : statusVon(b) === st;

// Ein Beleg erscheint, wenn mindestens eine seiner Positionen passt.
// ohneStatus: alle Filter ausser dem Status — für die Zähler auf den Kacheln
export const uGefiltert = (ohneStatus?: boolean) => S.uBelege.filter((b) =>
  imBereich(b) &&
  (!S.uGeraet  || b.geraet === S.uGeraet) &&
  (!S.uZahlgeraet || String(b.zahlgeraet_id) === S.uZahlgeraet) &&
  (!S.uZahlart || (b.zahlart || "karte") === S.uZahlart) &&
  (ohneStatus || statusPasst(b, S.uStatus)) &&
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
    ...(S.bereich && S.bereich !== "admin" ? [BEREICH_NAME[S.bereich]] : []),
    S.uGeraet ? personName(S.uGeraet) : (S.istAdmin ? "Alle Personen" : S.session.user.email),
    S.uZahlart ? zahlartName(S.uZahlart) : "Alle Zahlungsarten"
  ];
  if (S.uZahlgeraet) teile.push("Gerät " + geraetName(S.uZahlgeraet));
  if (S.uStatus)  teile.push("Status " + (STATUS_FILTER[S.uStatus] || S.uStatus));
  if (S.uKonto)   teile.push("Konto " + S.uKonto);
  if (S.uAuftrag) teile.push("Auftrag " + auftragAnzeige(S.uAuftrag));
  return teile.join(" · ");
};

export const uDateiname = () =>
  `Spesen_${S.uVon}_bis_${S.uBis}` +
  (S.uKonto   ? "_K" + S.uKonto   : "") +
  (S.uAuftrag ? "_A" + String(S.uAuftrag).replace(/\s+/g, "") : "") +
  (S.uZahlart ? "_" + S.uZahlart : "") +
  (S.uZahlgeraet ? "_" + geraetName(S.uZahlgeraet).replace(/[^\wäöüÄÖÜ-]+/g, "") : "") +
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

  // Vom Rechner direkt auf die Ablagefläche gezogen: Erfassung öffnen.
  // In der Freigabe am Rechner liegt S.neu als Prüfbeleg offen — der bleibt unberührt.
  if (!S.neu || S.ansicht !== "erfassen" || (S.neu.id && istGesperrt(S.neu))) {
    S.neu = leererBeleg(); S.posIndex = null; S.wahlOffen = null;
    S.zurueckZu = ["liste", "uebersicht", "freigabe"].includes(S.ansicht) ? S.ansicht : "liste";
    S.ansicht = "erfassen";
  }

  if (S.neu.vorschau) URL.revokeObjectURL(S.neu.vorschau);
  const n = S.neu;
  n.datei    = file;
  n.vorschau = file.type === "application/pdf" ? null : URL.createObjectURL(file);
  render();
  // PDF: erste Seite als Bild zeigen
  if (file.type === "application/pdf") {
    file.arrayBuffer().then((p) => SpesenExport.ersteSeite(p, 1600)).then((bild) => {
      if (S.neu === n && n.datei === file) { n.vorschau = bild; render(); }
    }).catch(() => { /* bleibt bei "PDF: Name" */ });
  }
}

// Vorschau eines hinterlegten PDFs: erste Seite als Bild, kommt nach
async function pdfVorschauLaden(n: any, url: string) {
  try {
    const puffer = await (await fetch(url)).arrayBuffer();
    const bild = await SpesenExport.ersteSeite(puffer, 1600);
    if (S.neu === n) { n.altUrl = bild; render(); }
  } catch { /* bleibt bei "PDF-Beleg hinterlegt" */ }
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
  const b = quelle.find(gleich) || S.belege.find(gleich) || S.offeneEigene.find(gleich)
         || S.uBelege.find(gleich) || S.freigabe.find(gleich);
  if (!b) return;

  let url = null, pdfUrl = null;
  if (b.datei_pfad) {
    const { data } = await sb.storage.from("belege").createSignedUrl(b.datei_pfad, 600);
    const signiert = data ? data.signedUrl : null;
    if (b.datei_pfad.toLowerCase().endsWith(".pdf")) pdfUrl = signiert; else url = signiert;
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
    datei: null, vorschau: null, altPfad: b.datei_pfad, altUrl: url, altPdf: !!pdfUrl,
    // Kommentar: "kommentarDa" merkt sich, ob die Datenbank die Spalte schon kennt
    kommentar: b.kommentar || "", kommentarDa: "kommentar" in b,
    zahlgeraet: b.zahlgeraet_id ?? null,
    // Korrektur beim Prüfen (Kreditkarte/Bar): Betrag, Satz, Datum
    korrBetrag: chf(b.betrag), korrMwst: String(b.mwst), korrDatum: b.beleg_datum
  };
  if (pdfUrl) pdfVorschauLaden(S.neu, pdfUrl);
  S.posIndex  = null;
  S.wahlOffen = null;
  S.zurueckZu = ["liste", "uebersicht", "freigabe"].includes(woher) ? woher : "liste";
  // Am Rechner steht der Prüfbeleg rechts neben der Freigabeliste
  S.ansicht   = (woher === "freigabe" && istBreit()) ? "freigabe" : "erfassen";
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
  const woher = ["liste", "uebersicht", "freigabe"].includes(S.zurueckZu) ? S.zurueckZu : "liste";
  S.neu = null; S.posIndex = null; S.wahlOffen = null;
  S.ansicht = woher;
  await ladeAlles();
  if (woher === "uebersicht" || istBreit()) await ladeUebersicht(true);
  // Am Rechner gleich den nächsten Beleg zum Prüfen zeigen
  if (woher === "freigabe" && istBreit() && freigabeGefiltert().length) {
    await belegBearbeiten(freigabeGefiltert()[0].id, "freigabe");
    S.meldung = text;
  }
  render();
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

// Nach dem Anmelden: alles laden und anzeigen.
// Am Rechner starten Prüfer und Admins in der Übersicht.
export async function nachAnmeldung(session) {
  S.session = session;
  S.loginMeldung = null;
  await ladeAlles();
  if (istBreit()) {
    S.bereich = standardBereich();
    if (S.bereich) S.ansicht = "uebersicht";
    await ladeUebersicht(true);
  } else render();
}

// Zur Anmeldung zurück
export function zeigeLogin(meldung?: string) {
  S.session = null;
  S.loginMeldung = meldung || null;
  render();
}

