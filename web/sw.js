/* service worker — แคชไฟล์แอปให้ใช้งาน offline ได้ (สำคัญสำหรับหน้า Gate/มือถือ) */
const CACHE = "bp-reader-v7";
const ASSETS = [
  "./index.html",
  "./bcbp.js",
  "./validate.js",
  "./scanner.js",
  "./samples.js",
  "./manifest.webmanifest",
  "./icon.svg",
  "./vendor/zxing.min.js",
  "./vendor/pdf.min.mjs",
  "./vendor/pdf.worker.min.mjs",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  e.respondWith(
    caches.match(e.request).then((hit) => hit || fetch(e.request))
  );
});
