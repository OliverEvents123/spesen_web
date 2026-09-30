// sw.js
// Der Service Worker macht die Seite für Android zu einer installierbaren App
// und lässt sie ohne Netz starten.
//
// WICHTIG: Netz zuerst, Zwischenspeicher nur als Rückfall. Andersherum würde
// die App nach einem Upload auf GitHub tagelang die alte Fassung zeigen.

const CACHE = "spesen-v1";

const DATEIEN = [
  "./",
  "./index.html",
  "./stil.css",
  "./daten.js",
  "./ansichten.js",
  "./export.js",
  "./app.js",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png"
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(DATEIEN))
      .catch(() => {})          // eine fehlende Datei darf die Installation nicht kippen
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((namen) => Promise.all(
        namen.filter((n) => n !== CACHE).map((n) => caches.delete(n))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const anfrage = e.request;
  if (anfrage.method !== "GET") return;

  // Nur eigene Dateien. Supabase, das supabase-js vom CDN und die
  // Belegbilder werden nie zwischengespeichert.
  const ziel = new URL(anfrage.url);
  if (ziel.origin !== location.origin) return;

  e.respondWith(
    fetch(anfrage)
      .then((antwort) => {
        const kopie = antwort.clone();
        caches.open(CACHE).then((c) => c.put(anfrage, kopie)).catch(() => {});
        return antwort;
      })
      .catch(() => caches.match(anfrage)
        .then((treffer) => treffer || caches.match("./index.html")))
  );
});
