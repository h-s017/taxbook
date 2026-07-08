const CACHE_NAME = 'hana-tax-book-v19';
const ASSETS = [
  './','./index.html','./styles.css','./manifest.webmanifest',
  './js/v2-core.js','./js/v2-data.js','./js/v2-auth.js','./js/v2-company.js',
  './js/v2-transactions.js','./js/v2-reports.js','./js/v2-app.js','./js/v2-bootstrap.js',
  './cashflow.js','./profitloss.js'
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
