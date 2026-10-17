/* Service worker for Solitaire Word Match — build 20261016-art1.
   Exists so the page meets Chrome's installability criteria
   (registered worker with a fetch handler). Pass-through, network
   first, no caching: the page and its assets always come fresh
   from the network, so a new build reaches phones on the next load.
   Bump SW_VERSION on every release so browsers swap in this worker. */
var SW_VERSION = '20261016-art1';
self.addEventListener('install', function (e) {
  self.skipWaiting();
});
self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys()
      .then(function (keys) { return Promise.all(keys.map(function (k) { return caches.delete(k); })); })
      .then(function () { return self.clients.claim(); })
  );
});
self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;
  // pages: skip the HTTP cache so a fresh build is picked up right away
  if (e.request.mode === 'navigate') {
    e.respondWith(fetch(e.request, { cache: 'no-cache' }).catch(function () { return fetch(e.request); }));
    return;
  }
  e.respondWith(fetch(e.request));
});
