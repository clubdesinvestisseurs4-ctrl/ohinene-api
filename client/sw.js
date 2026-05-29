const CACHE_NAME = 'ohinene-v1.0.1';
const ASSETS = [
  '/',
  '/index.html',
  '/styles.css',
  '/app.js',
  '/manifest.json',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css',
];

// Install — mise en cache des ressources statiques
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

// Activate — suppression des anciens caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch — stratégie Network First pour l'API, Cache First pour les assets
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // API calls → network only (pas de cache)
  if (url.pathname.startsWith('/api/') || url.hostname.includes('render.com') || url.hostname.includes('firestore')) {
    event.respondWith(fetch(event.request).catch(() => new Response(
      JSON.stringify({ error: 'Hors ligne – vérifiez votre connexion' }),
      { headers: { 'Content-Type': 'application/json' }, status: 503 }
    )));
    return;
  }

  // Assets → Cache First avec fallback réseau
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        if (response.ok && event.request.method === 'GET') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      });
    }).catch(() => caches.match('/index.html'))
  );
});

// Message pour forcer la mise à jour
self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});
