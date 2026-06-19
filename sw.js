const CACHE_NAME = 'evdeki-hesap-v108';
const urlsToCache = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png',
  './manifest.json',
  './evdekihesap_logo_yeni.png'
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return Promise.allSettled(
        urlsToCache.map(url =>
          cache.add(url).catch(err => {
            console.warn('[SW] Cache eklenemedi:', url, err.message);
          })
        )
      );
    })
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    Promise.all([
      caches.keys().then(cacheNames =>
        Promise.all(
          cacheNames
            .filter(name => name !== CACHE_NAME)
            .map(name => caches.delete(name))
        )
      ),
      self.clients.claim() 
    ])
  );
});

const OWN_ORIGIN = self.location.origin;

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || !event.request.url.startsWith('http')) return;

  const url = new URL(event.request.url);
  
  // 3. parti istekler Service Worker'a takılmasın (CSP sorununu çözer)
  if (url.origin !== OWN_ORIGIN) return;

  event.respondWith(
    fetch(event.request)
      .then(response => {
        if (response && response.status === 200 && response.type === 'basic') {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseToCache);
          });
        }
        return response;
      })
      .catch(() => {
        return caches.match(event.request)
          .then(cached => {
            if (cached) return cached;
            return caches.match(url.pathname);
          })
          .then(found => {
            if (found) return found;
            
            // KRİTİK FİX: Önbellekte HTML yoksa çökmesin!
            if (event.request.headers.get('accept')?.includes('text/html')) {
              return caches.match('./index.html').then(html => {
                  return html || new Response('Uygulama yükleniyor veya çevrimdışı. Lütfen internet bağlantınızı kontrol edip sayfayı yenileyin.', {
                      status: 503,
                      headers: { 'Content-Type': 'text/plain; charset=utf-8' }
                  });
              });
            }
            
            return new Response('', { status: 503 });
          });
      })
  );
});

self.addEventListener('message', event => {
  if (event.data?.type === 'SHOW_NOTIFICATION') {
    event.waitUntil(
      self.registration.showNotification(event.data.title, {
        body:  event.data.body,
        icon:  './evdekihesap_logo_yeni.png',
        badge: './evdekihesap_logo_yeni.png',
        tag:   event.data.tag || 'evdeki',
        vibrate: [200, 100, 200]
      })
    );
  }
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      if (list.length > 0) return list[0].focus();
      return clients.openWindow('/');
    })
  );
});