// Throwaway: cache everything fetched so the cut-out test works in airplane mode.
const CACHE = 'bg-test-v1';

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(['./', './index.html'])).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || !e.request.url.startsWith('http')) return;
  e.respondWith(caches.open(CACHE).then(async (c) => {
    const hit = await c.match(e.request);
    if (hit) return hit;
    try {
      const res = await fetch(e.request);
      if (res.ok) c.put(e.request, res.clone());
      return res;
    } catch (err) {
      return Response.error();
    }
  }));
});
