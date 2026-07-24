/* service worker — แคชไฟล์แอปให้ใช้งาน offline ได้ (สำคัญสำหรับหน้า Gate/มือถือ) */
const CACHE = "bp-reader-v11";
const ASSETS = [
  "./index.html",
  "./config.js",
  "./bcbp.js",
  "./validate.js",
  "./scanner.js",
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
  const req = e.request;
  if (req.method !== "GET") return;

  // หน้า HTML (navigation): network-first เพื่อให้ได้เวอร์ชันล่าสุดเสมอ
  // (กัน cache เก่าค้างจนปุ่มไม่ทำงานหลังอัปเดต) — offline ค่อย fallback ไป cache
  const isHTML = req.mode === "navigate" ||
    (req.headers.get("accept") || "").includes("text/html");
  if (isHTML) {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put("./index.html", copy));
          return res;
        })
        .catch(() => caches.match(req).then((hit) => hit || caches.match("./index.html")))
    );
    return;
  }

  // ไฟล์อื่น (JS/รูป/ไลบรารี): cache-first เพื่อความเร็ว/ออฟไลน์
  e.respondWith(caches.match(req).then((hit) => hit || fetch(req)));
});
