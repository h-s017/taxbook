const CACHE_NAME = 'hana-tax-book-local-v25';
const ASSETS = [
  './','./index.html','./styles.css','./manifest.webmanifest',
  './app.js','./monthly-report.js','./cashflow.js','./profitloss.js'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))));
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  const shouldCache = url.origin === location.origin;
  event.respondWith(fetch(event.request).then(response => {
    if (shouldCache && response.ok) {
      const copy = response.clone();
      caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
    }
    return response;
  }).catch(() => caches.match(event.request)));
});
