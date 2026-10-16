// zustand.ts
// Der Zustand der App an einer Stelle — wie in der alten Fassung das Objekt S.
// Wer etwas ändert, ruft danach render(); React zeichnet dann neu.
//
// Bewusst so einfach gehalten: die Abläufe sind 1:1 aus der alten App
// übernommen und lassen sich später Schritt für Schritt verfeinern.

import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_KEY } from "./konfig";
import { periode } from "./grundlagen";

export const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

const START = periode(0);

export const S: any = {
  gestartet: false, loginMeldung: null,
  session: null, istAdmin: false, konten: [], auftraege: [], favoriten: [],
  // ich: eigener Name und Rolle; namen: E-Mail → Name für Listen und Verlauf
  ich: { name: "", rolle: "user" }, namen: {},
  // belege: eigene der gewählten Periode; offeneEigene: eigene erfasste und
  // abgelehnte, egal aus welcher Periode — das sind die offenen Aufgaben
  belege: [], offeneEigene: [],
  benutzer: [], benEdit: null, kontEdit: null,
  // Geräte (Kreditkarte) je KST — in der Datenbank "zahlgeraet". geraeteDa: Tabelle vorhanden
  zahlgeraete: [], geraeteDa: false, geraetEdit: null,
  // Welche KST erscheinen in der Auswahl: Jahre (mit Haken) und Regeln je KST
  // (sichtbar = immer anzeigen, sonst ausblenden). kstDa: Tabellen vorhanden;
  // kstFunktionNeu: die Edge Function kennt "immer anzeigen" aus jedem Jahr
  kstJahre: [], kstRegeln: [], kstDa: false, kstFunktionNeu: true,
  ansicht: "liste", neu: null, favEdit: null, posIndex: null,
  suche: "", bSuche: "", bSucheNeu: 0, meldung: null, zurueckZu: "liste",
  // Zeitraum für alles: Abrechnungsperiode, mit ‹ › blätterbar
  uVon: START.von, uBis: START.bis, eigenerZeitraum: false, uBelege: [], uLaedt: false,
  uGeraet: "", uZahlart: "", uKonto: "", uAuftrag: "", uStatus: "", uZahlgeraet: "", uFilterOffen: false,
  // Gespeicherte Zeiträume (je Person, höchstens drei) als Schnellwahl
  perioden: [],
  // Filter für "Meine Belege" — eigene, unabhängig von der Übersicht
  mZahlart: "", mKonto: "", mAuftrag: "", mStatus: "", mFilterOffen: false,
  // Eigene Zuweisungen: darf ich eigene Belege gleich selbst genehmigen?
  // Daraus ergeben sich auch die Abschnitte im Menü (Projektleitung, Supervisor).
  meineKst: [], meineKonten: [], meinePersonen: [], zuweisungenPerson: [],
  // Welcher Abschnitt gilt für Übersicht und Freigabe: "pl", "sup", "admin";
  // leer = alles, was ich sehen darf (Handy)
  bereich: "",
  // Übersicht: Reiter rechts (belege, kontierung, verlauf) und Gruppen links (kst, konto, person)
  uReiter: "belege", uGruppe: "",
  // Freigabe filtern (Supervisor, Admin): Person, KST, Konto
  fPerson: "", fKst: "", fKonto: "",
  // Beleg am Rechner vergrössern (Prozent, 100 = auf Breite eingepasst)
  zoom: 100,
  // Freigabe: in dieser Runde schon entschiedene Belege (für "2 von 5 erledigt")
  erledigtJetzt: [],
  // Verlauf: Belege, die nicht im geladenen Zeitraum liegen (id → Beleg)
  verlaufBelege: {},
  istPruefer: false, freigabe: [], zuweisungen: [], zuweisungenKonto: [], verlauf: [],
  // Am Rechner klappt die Auswahl für Konto/KST direkt unter dem Feld auf: { art, i }
  wahlOffen: null,
  // Knopf, der gerade arbeitet: { akt, text } — zeigt z. B. "Speichere …"
  laeuft: null
};

// ---------- Neu zeichnen ----------
let stand = 0;
const hoerer = new Set<() => void>();

export function render() {
  stand++;
  hoerer.forEach((h) => h());
}
export const abonnieren = (h: () => void) => { hoerer.add(h); return () => hoerer.delete(h); };
export const aktuellerStand = () => stand;

// ---------- Schlüssel für Formulare ----------
// Eingabefelder behalten in React ihren Inhalt, solange sie nicht neu
// entstehen. Jedes Bearbeitungs-Objekt (Beleg, Benutzer, Konto …) bekommt
// darum eine eigene Nummer; wird es ersetzt, entsteht das Formular neu.
const nummern = new WeakMap<object, number>();
let naechste = 1;
export function schluessel(obj: any): string {
  if (!obj || typeof obj !== "object") return "leer";
  if (!nummern.has(obj)) nummern.set(obj, naechste++);
  return String(nummern.get(obj));
}

// ---------- Knopf arbeitet ----------
export function laeuft(akt: string, text: string) { S.laeuft = { akt, text }; render(); }
export function fertig() { S.laeuft = null; render(); }
