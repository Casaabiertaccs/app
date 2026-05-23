const CACHE_APP = 'casa-abierta-app-v18';
const CACHE_CDN = 'casa-abierta-cdn-v18';

const CDN_ASSETS = [
    'https://unpkg.com/react@18/umd/react.production.min.js',
    'https://unpkg.com/react-dom@18/umd/react-dom.production.min.js',
    'https://unpkg.com/@babel/standalone/babel.min.js',
    'https://cdn.tailwindcss.com',
    'https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js',
    'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore-compat.js',
    'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth-compat.js',
    'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js'
];

// Pre-cachear librerías CDN al instalar
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_CDN)
            .then(cache => cache.addAll(CDN_ASSETS))
            .catch(err => console.warn('[SW] Error pre-cacheando CDN:', err))
    );
    self.skipWaiting();
});

// Limpiar cachés viejas al activar
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(
                keys
                    .filter(k => k !== CACHE_APP && k !== CACHE_CDN)
                    .map(k => caches.delete(k))
            )
        )
    );
    self.clients.claim();
});

self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Firebase y APIs externas: nunca interceptar
    if (
        url.hostname.includes('firebaseio.com') ||
        url.hostname.includes('googleapis.com') ||
        url.hostname.includes('google.com') ||
        url.hostname.includes('gstatic.com') && url.pathname.includes('firebasejs')
    ) {
        return;
    }

    // Librerías CDN: cache-first (son archivos inmutables)
    if (url.hostname !== self.location.hostname) {
        event.respondWith(
            caches.match(request).then(cached => {
                if (cached) return cached;
                return fetch(request).then(response => {
                    if (response && response.ok) {
                        const clone = response.clone();
                        caches.open(CACHE_CDN).then(cache => cache.put(request, clone));
                    }
                    return response;
                });
            })
        );
        return;
    }

    // App shell (HTML, SVG, manifest): network-first con fallback a caché
    event.respondWith(
        fetch(request)
            .then(response => {
                if (response && response.ok) {
                    const clone = response.clone();
                    caches.open(CACHE_APP).then(cache => cache.put(request, clone));
                }
                return response;
            })
            .catch(() => caches.match(request))
    );
});
