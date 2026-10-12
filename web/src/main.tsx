// main.tsx
// Start der App: Anmeldung prüfen, React starten, Dateifelder, Ziehen und
// Ablegen, Breitenwechsel. In der echten App zusätzlich installierbar (PWA).

import { createRoot } from "react-dom/client";
import "./stil.css";
import { App } from "./App";
import { S, sb, render } from "./zustand";
import { UMGEBUNG } from "./konfig";
import { BREIT_AB } from "./grundlagen";
import { dateiGewaehlt, nachAnmeldung, ladeUebersicht } from "./daten";

createRoot(document.getElementById("app")!).render(<App />);

// Supabase erneuert das Anmelde-Token etwa stündlich. S.session muss mitziehen,
// sonst schicken die Aufrufe der Edge Functions nach einer Stunde ein
// abgelaufenes Token und scheitern.
sb.auth.onAuthStateChange((_ereignis, session) => {
  if (session && S.session) S.session = session;
});

async function start() {
  const { data } = await sb.auth.getSession();
  S.gestartet = true;
  if (!data.session) { render(); return; }
  await nachAnmeldung(data.session);
}

// Wechselt die Bildschirmbreite die Seite, neu aufbauen —
// am Rechner braucht es dafür die Übersichtsdaten.
window.matchMedia(`(min-width:${BREIT_AB}px)`).addEventListener("change", async (e) => {
  if (!S.session) return;
  if (e.matches && !S.uBelege.length) { await ladeUebersicht(true); return; }
  render();
});

// ---------- Dateifelder ----------
for (const id of ["kamera", "datei"]) {
  document.getElementById(id)!.addEventListener("change", (e) => {
    const feld = e.target as HTMLInputElement;
    dateiGewaehlt(feld.files[0]); feld.value = "";
  });
}

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

// ---------- Installierbar (nur echte App) ----------
// Die Testfassung soll sich nicht installieren lassen und nichts
// zwischenspeichern, sonst mischt sie sich mit der echten App.
if (UMGEBUNG === "live") {
  const link = document.createElement("link");
  link.rel = "manifest"; link.href = "manifest.json";
  document.head.appendChild(link);
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => { navigator.serviceWorker.register("sw.js").catch(() => {}); });
  }
}

start();
