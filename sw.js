const CACHE = 'gongquan-salary-v11-1-calc-hotfix';

const CORE = [
  './',
  './index.html',
  './css/app.css',
  './manifest.webmanifest',
  './assets/logo.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(CORE))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE)
          .map(key => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  if(event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // 設定與 JS 一律優先拿最新版本，避免通知程式被舊 Service Worker 快取鎖住。
  const isConfig = url.pathname.endsWith('/js/config.js');
  const isJavaScript = url.pathname.includes('/js/') && url.pathname.endsWith('.js');

  if(isConfig || isJavaScript){
    event.respondWith(
      fetch(event.request, { cache: 'no-store' })
        .then(response => {
          const copy = response.clone();
          caches.open(CACHE).then(cache => cache.put(event.request, copy));
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then(hit => {
      if(hit) return hit;

      return fetch(event.request)
        .then(response => {
          const copy = response.clone();
          caches.open(CACHE).then(cache => cache.put(event.request, copy));
          return response;
        })
        .catch(() => caches.match('./index.html'));
    })
  );
});
