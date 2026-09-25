/* Offline support. Network first (so price/product edits show up right away), cache as fallback
   (so a count still opens in a storage room with bad wifi). Bump CACHE when you deploy changes. */
var CACHE = "suma-tools-v1.2.0";
var SHELL = [
  "./", "index.html", "manifest.json", "css/styles.css",
  "js/vendor/jspdf.umd.min.js", "js/config.js", "js/core.js", "js/inventario.js", "js/b2b.js", "js/app.js",
  "assets/logo-wordmark.png", "assets/logo-wordmark-dark.png", "assets/logo-pdf.png",
  "assets/icons/apple-touch-icon.png", "assets/icons/icon-192.png", "assets/icons/icon-512.png", "assets/icons/favicon.png"
];

self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(SHELL); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener("fetch", function (e) {
  var req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(
    fetch(req).then(function (res) {
      var copy = res.clone();
      caches.open(CACHE).then(function (c) { c.put(req, copy); });
      return res;
    }).catch(function () {
      return caches.match(req, { ignoreSearch: true }).then(function (hit) { return hit || caches.match("index.html"); });
    })
  );
});
