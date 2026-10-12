// sw.js — nur in der echten App angemeldet (siehe main.tsx).
// Macht die Seite für Android installierbar und lässt sie ohne Netz starten.
//
// WICHTIG: Netz zuerst, Zwischenspeicher nur als Rückfall. Andersherum würde
// die App nach einer Änderung tagelang die alte Fassung zeigen.
// Die Dateinamen ändern sich bei jedem Bauen — darum keine feste Liste,
// sondern alles merken, was einmal erfolgreich geladen wurde.

const CACHE = "spesen-react-v1";

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((namen) => Promise.all(namen.filter((n) => n !== CACHE).map((n) => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const anfrage = e.request;
  if (anfrage.method !== "GET") return;

  // Nur eigene Dateien. Supabase, Belegbilder und CDN nie zwischenspeichern.
  const ziel = new URL(anfrage.url);
  if (ziel.origin !== location.origin) return;
  // Die Testfassungen laufen bewusst ohne Zwischenspeicher.
  if (ziel.pathname.includes("/test/") || ziel.pathname.includes("/test-alt/")) return;

  e.respondWith(
    fetch(anfrage)
      .then((antwort) => {
        if (antwort.ok) {
          const kopie = antwort.clone();
          caches.open(CACHE).then((c) => c.put(anfrage, kopie)).catch(() => {});
        }
        return antwort;
      })
      .catch(() => caches.match(anfrage).then((treffer) => treffer || caches.match("./")))
  );
});
