const CACHE_NAME = 'glass-timer-v2';
const urlsToCache = [
  '/',
  '/index.html',
  '/style.css',
  '/script.js',
  '/manifest.json'
];

// Install event: cache core files
self.addEventListener('install', event => {
  console.log('[SW] Install');
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache))
  );
  self.skipWaiting(); // activate new SW immediately
});

// Activate event: remove old caches
self.addEventListener('activate', event => {
  console.log('[SW] Activate');
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.map(key => {
        if (key !== CACHE_NAME) {
          console.log('[SW] Deleting old cache', key);
          return caches.delete(key);
        }
      })
    ))
  );
  self.clients.claim(); // take control of all open clients
});

// Fetch event: network-first for HTML, stale-while-revalidate for others
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  const isHtml = url.pathname === '/' || url.pathname === '/index.html';

  if (isHtml) {
    // Network-first: try to get latest from network, fallback to cache
    event.respondWith(
      fetch(event.request).catch(() => {
        return caches.match(event.request);
      })
    );
  } else {
    // Stale-while-revalidate: serve from cache, update cache in background
    event.respondWith(
      caches.match(event.request).then(cachedResponse => {
        const fetchPromise = fetch(event.request).then(networkResponse => {
          // Update cache with fresh version
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, networkResponse.clone());
          });
          return networkResponse;
        }).catch(() => cachedResponse);
        return cachedResponse || fetchPromise;
      })
    );
  }
});
