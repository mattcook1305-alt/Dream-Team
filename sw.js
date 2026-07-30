var CACHE_VERSION = "v3";
var CACHE_NAME = "dreamteam-" + CACHE_VERSION;
var ASSETS = ["/", "/index.html", "/app.js", "/players-data.js", "/rules-data.js", "/manifest.json"];

self.addEventListener("install", function (event) {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(ASSETS);
    })
  );
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys().then(function (names) {
      var deletions = [];
      for (var i = 0; i < names.length; i++) {
        if (names[i] !== CACHE_NAME) deletions.push(caches.delete(names[i]));
      }
      return Promise.all(deletions);
    }).then(function () {
      return self.clients.claim();
    })
  );
});

/* Network-first: always try to fetch the latest file. Only fall back to the
   cached copy if the network request fails (offline). This stops Safari
   from getting stuck on whatever version was cached the first time the
   app was installed. */
self.addEventListener("fetch", function (event) {
  event.respondWith(
    fetch(event.request).then(function (resp) {
      var copy = resp.clone();
      caches.open(CACHE_NAME).then(function (cache) {
        cache.put(event.request, copy);
      });
      return resp;
    }).catch(function () {
      return caches.match(event.request);
    })
  );
});
