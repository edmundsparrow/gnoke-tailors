/* sw.js — Gnoke Tailors service worker
   Caches app shell for offline use.
   © 2026 Edmund Sparrow — GNU GPL v3 */

const CACHE = 'gnoke-tailors-v1';
const SHELL = [
  '/',
  '/index.html',
  '/main/',
  '/main/index.html',
  '/style.css',
  '/js/state.js',
  '/js/theme.js',
  '/js/ui.js',
  '/js/db-core.js',
  '/js/db-orders.js',
  '/js/render.js',
  '/js/update.js',
  '/js/app.js',
  '/manifest.json',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});
