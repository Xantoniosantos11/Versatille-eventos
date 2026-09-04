const CACHE = "versatille-v11";
const ASSETS = ["./","./index.html","./style.css","./app.js","./config.js","./manifest.json","./icon.svg"];
self.addEventListener("install", e => e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS))));
self.addEventListener("fetch", e => e.respondWith(caches.match(e.request).then(r => r || fetch(e.request))));
