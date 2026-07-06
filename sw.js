const CACHE_NAME = 'hana-tax-book-v12';
const ASSETS = [
  './','./index.html','./styles.css','./manifest.webmanifest',
  './js/v2-core.js','./js/v2-data.js','./js/v2-auth.js','./js/v2-company.js',
  './js/v2-transactions.js','./js/v2-reports.js','./js/v2-app.js',
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
  event.respondWith(fetch(event.request).then(response => {
    const copy = response.clone();
    caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
    return response;
  }).catch(() => caches.match(event.request)));
});
