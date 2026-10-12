// grundlagen.ts
// Feste Werte und kleine Helfer ohne Zugriff auf den Zustand.

// ---------- Feste Werte ----------
export const ZAHLART: Record<string, string> = { karte: "Kreditkarte", bar: "Bar", vorkasse: "Vorauskasse" };
export const zahlartName = (z?: string) => ZAHLART[z || "karte"] || z;

// Status eines Belegs. In der Datenbank heisst "erfasst" noch "offen".
// Kreditkarte/Bar enden mit geprueft oder besprechung,
// Vorauskasse mit genehmigt, teilweise oder abgelehnt.
export const STATUS: Record<string, string> = {
  offen: "erfasst", eingereicht: "eingereicht",
  geprueft: "geprüft", besprechung: "zur Besprechung",
  genehmigt: "genehmigt", teilweise: "teilweise genehmigt", abgelehnt: "abgelehnt",
  abgeschlossen: "abgeschlossen"
};
// Für den Filter: zwei Gruppen zusätzlich zu den einzelnen Status
export const STATUS_FILTER: Record<string, string> = {
  unerledigt: "offen (erfasst oder eingereicht)", erledigt: "erledigt (entschieden)", ...STATUS
};
// Farbe der Statusmarke
export const statusKlasse = (s?: string) => ({
  offen: "erf", eingereicht: "ein", geprueft: "gep", besprechung: "bes",
  genehmigt: "gen", teilweise: "gen", abgelehnt: "abl", abgeschlossen: "erf" } as any)[s || "offen"] || "erf";
export const statusVon  = (b: any) => (b && b.status) || "offen";
export const statusName = (s?: string) => STATUS[s || "offen"] || s;
// Ändern und löschen geht nur, solange erfasst oder abgelehnt.
export const istGesperrt = (b: any) => !["offen", "abgelehnt"].includes(statusVon(b));
// Schon entschieden (von jemandem oder automatisch)?
export const istEntschieden = (b: any) =>
  ["geprueft", "besprechung", "genehmigt", "teilweise", "abgelehnt"].includes(statusVon(b));

// Was gebucht wird: bei Teilgenehmigung der genehmigte Betrag, abgelehnt nichts.
export const buchungsBetrag = (b: any) => {
  const s = statusVon(b);
  if (s === "abgelehnt") return 0;
  if (s === "teilweise" && b.genehmigt_betrag != null) return parseFloat(b.genehmigt_betrag);
  return parseFloat(b.betrag);
};

export const NETZTEXT = "Kein Netz. Bitte das Foto lokal speichern und im Nachhinein hochladen.";
export const GESPERRT_TEXT = "Dieser Beleg lässt sich nicht mehr ändern oder löschen — "
                           + "er ist zur Prüfung freigegeben oder gehört einem anderen Gerät.";
export const MAX_KACHELN = 6;          // mehr Favoriten nur in der Verwaltung
export const BREIT_AB = 900;           // ab dieser Breite das Rechner-Layout
export const SAETZE = ["8.1", "2.6", "3.8", "0"];

// Fester Eintrag für Belege ohne Kostenstelle. Kommt nicht aus FileMaker und
// steht in der Auswahl immer zuoberst.
export const OHNE_KST = { id: "ohne KST", name: "ohne KST", fix: true };

// Notfall-Administratoren: behalten immer die Rolle admin und lassen sich
// nicht sperren. Die Edge Function prüft dasselbe noch einmal — dort ist die
// verbindliche Stelle, hier wird nur die Oberfläche entsprechend gesperrt.
export const GESCHUETZTE_KONTEN = ["admin@eventorganisation.ch"];
export const istGeschuetzt = (mail: string) =>
  GESCHUETZTE_KONTEN.includes(String(mail || "").trim().toLowerCase());

// Rollen der Benutzer: Anzeigename und Erklärung
export const ROLLEN: Record<string, [string, string]> = {
  user:          ["User",          "Sieht und erfasst nur die eigenen Belege."],
  projektleiter: ["Projektleiter", "Prüft und genehmigt die Belege seiner Kostenstellen (unten zuweisen)."],
  supervisor:    ["Supervisor",    "Prüft und genehmigt die Belege seiner Konten (unten zuweisen) und "
                                 + "die Belege von Benutzern mit eingerichteter Prüfung."],
  admin:         ["Admin",         "Sieht alles, darf alles entscheiden und Benutzer und Konten verwalten."]
};
export const rolleName = (r: string) => (ROLLEN[r] || [r])[0];

// Wie eine Auftragsnummer (KST) im Text erscheint
export const auftragAnzeige = (nr: string) => nr === OHNE_KST.id ? OHNE_KST.name : nr;
export const auftragText = (a: any) => !a ? "wählen"
  : (a.id === OHNE_KST.id ? OHNE_KST.name : a.id + (a.name ? "  " + a.name : ""));

// Die Abrechnungsperiode läuft vom 16. bis zum 15. des Folgemonats.
export const PERIODE_START = 16;

export const istBreit = () => window.matchMedia(`(min-width:${BREIT_AB}px)`).matches;

// ---------- Kleine Helfer ----------
export const heute = () => new Date().toLocaleDateString("sv-SE");
export const monatName = (m: string) => {
  const n = ["Januar", "Februar", "März", "April", "Mai", "Juni",
             "Juli", "August", "September", "Oktober", "November", "Dezember"];
  const [j, mm] = m.split("-");
  return n[parseInt(mm, 10) - 1] + " " + j;
};
export const chf = (z: any) => Number(z).toFixed(2);
export const datumCH = (d: any) => new Date(d).toLocaleDateString("de-CH");
export const zeitCH = (t: any) => t ? new Date(t).toLocaleString("de-CH", {
  day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "";
// Kurz, für Listen: "11.10. 18:42"
export const kurzZeit = (t: any) => {
  if (!t) return "";
  const d = new Date(t);
  return d.toLocaleDateString("de-CH", { day: "2-digit", month: "2-digit" }) + " "
       + d.toLocaleTimeString("de-CH", { hour: "2-digit", minute: "2-digit" });
};
// Zwei Buchstaben für die Kachel: "Hans Muster" → HM, "handy3@…" → HA
export const initialen = (text: string) => {
  const t = String(text || "").split("@")[0].trim();
  const w = t.split(/[\s._-]+/).filter(Boolean);
  return (w.length > 1 ? w[0][0] + w[1][0] : t.slice(0, 2)).toUpperCase() || "?";
};
// Beträge mit Tausender-Apostroph: 3'307.20
export const chfLang = (z: any) => {
  const [g, n] = Number(z || 0).toFixed(2).split(".");
  return g.replace(/\B(?=(\d{3})+(?!\d))/g, "'") + "." + n;
};
export const ordnerName = (mail: string) => mail.replace(/@/g, "_").replace(/\./g, "_");
export const kurzName = (mail: string) => String(mail || "").split("@")[0];

// Betrag aus dem Textfeld: akzeptiert Punkt und Komma
export const betragVon = (text: any) => {
  const z = parseFloat(String(text ?? "").replace(",", ".").replace(/[^\d.]/g, ""));
  return isFinite(z) && z > 0 ? Math.round(z * 100) / 100 : 0;
};

// ---------- Zeitraum ----------
// Ortszeit, nicht UTC — sonst rutscht das Datum je nach Stunde um einen Tag.
export const isoDatum = (d: Date) =>
  new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);

export const kurzDatum = (iso: string) => iso.slice(8, 10) + "." + iso.slice(5, 7) + ".";
export const langDatum = (iso: string) => iso.slice(8, 10) + "." + iso.slice(5, 7) + "." + iso.slice(0, 4);

// versatz 0 = laufende Periode, -1 = die davor
export function periode(versatz?: number) {
  const h = new Date();
  let m = h.getMonth();
  if (h.getDate() < PERIODE_START) m -= 1;   // vor dem 16. läuft noch die Vorperiode
  m += (versatz || 0);
  const von = new Date(h.getFullYear(), m, PERIODE_START);
  const bis = new Date(h.getFullYear(), m + 1, PERIODE_START - 1);
  return { von: isoDatum(von), bis: isoDatum(bis) };
}

// Die Periode, in der ein Datum liegt, um schritt Perioden verschoben
export function periodeUm(datum: string, schritt: number) {
  const d = new Date(datum + "T12:00:00");
  let m = d.getMonth();
  if (d.getDate() < PERIODE_START) m -= 1;
  m += schritt;
  return { von: isoDatum(new Date(d.getFullYear(), m, PERIODE_START)),
           bis: isoDatum(new Date(d.getFullYear(), m + 1, PERIODE_START - 1)) };
}
// Ist von–bis genau eine Abrechnungsperiode?
export const istPeriode = (von: string, bis: string) => {
  const p = periodeUm(von, 0);
  return p.von === von && p.bis === bis;
};

export function istNetzfehler(err: any) {
  if (!navigator.onLine) return true;
  const t = String((err && (err.message || err.error_description)) || err || "").toLowerCase();
  return t.includes("failed to fetch") || t.includes("networkerror") ||
         t.includes("network request failed") || t.includes("load failed") ||
         t.includes("timeout");
}

// Die Zeilen eines Belegs: entweder seine Positionen oder er selbst als eine.
export const belegZeilen = (b: any) =>
  (Array.isArray(b.positionen) && b.positionen.length)
    ? b.positionen
    : [{ betrag: b.betrag, mwst: b.mwst, konto_nummer: b.konto_nummer, auftrag_nr: b.auftrag_nr }];

export const istAufgeteilt = (b: any) => Array.isArray(b.positionen) && b.positionen.length > 1;

// Summe der Positionen — das ist der Belegbetrag, wenn aufgeteilt wird.
export const positionenSumme = (pos: any[]) =>
  (pos || []).reduce((t, p) => t + betragVon(p.betragText), 0);

export const positionenFertig = (pos: any[]) =>
  Array.isArray(pos) && pos.length > 0 &&
  pos.every((p) => betragVon(p.betragText) > 0 && p.konto && p.auftrag);

// ---------- Stil als Text ----------
// Erlaubt style={st("font-size:13px;color:var(--grau)")} — so bleiben die
// Stilangaben gleich lesbar wie in der alten Fassung.
const stilCache = new Map<string, Record<string, string>>();
export function st(css: string): Record<string, string> {
  let o = stilCache.get(css);
  if (o) return o;
  o = {};
  for (const teil of css.split(";")) {
    const i = teil.indexOf(":");
    if (i < 0) continue;
    const k = teil.slice(0, i).trim();
    const v = teil.slice(i + 1).trim();
    if (!k) continue;
    o[k.startsWith("--") ? k : k.replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = v;
  }
  stilCache.set(css, o);
  return o;
}
