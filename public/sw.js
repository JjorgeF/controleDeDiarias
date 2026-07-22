// Service Worker for Liga Positiva PWA
const CACHE_NAME = 'liga-positiva-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/logo.svg',
  '/manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // 1. Intercept manifest.json requests to dynamically update the PWA icon mapping
  if (url.pathname === '/manifest.json') {
    const logoParam = url.searchParams.get('logo');
    if (logoParam) {
      event.respondWith(
        fetch('/manifest.json')
          .then((response) => response.json())
          .then((manifest) => {
            const format = logoParam.split('.').pop() || 'png';
            manifest.icons = [
              {
                "src": `/brand/${logoParam}`,
                "sizes": "192x192 512x512",
                "type": format === 'svg' ? 'image/svg+xml' : `image/${format}`,
                "purpose": "any maskable"
              }
            ];
            return new Response(JSON.stringify(manifest), {
              headers: { 'Content-Type': 'application/json' }
            });
          })
          .catch(() => {
            // Fallback to original manifest request if offline/failed
            return fetch(event.request).catch(() => caches.match(event.request));
          })
      );
      return;
    }
  }

  // 2. Intercept logo.svg requests to transparently serve the custom logo to iOS/Android/Favicons
  if (url.pathname === '/logo.svg') {
    event.respondWith(
      (async () => {
        const formats = ['png', 'svg', 'webp', 'jpg', 'jpeg'];
        for (const format of formats) {
          const customUrl = `/brand/logo-custom.${format}`;
          try {
            const checkRes = await fetch(customUrl, { method: 'HEAD' });
            if (checkRes.ok) {
              const contentLength = checkRes.headers.get('content-length');
              if (contentLength !== '0') {
                return fetch(customUrl);
              }
            }
          } catch (e) {
            // ignore
          }
        }
        // Fallback to normal request
        return fetch(event.request).catch(() => caches.match(event.request));
      })()
    );
    return;
  }

  // Simple network-first strategy for all other requests
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // If successful, cache the response clone
        if (response.status === 200 && event.request.method === 'GET') {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      })
      .catch(() => {
        // Fallback to cache if network fails
        return caches.match(event.request);
      })
  );
});

// Handle notification click on mobile devices
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow('/');
      }
    })
  );
});
