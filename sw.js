/* ============================================================
   SW.JS — v3 (tiles manejados por IndexedDB via L.tileLayer.offline)
   ============================================================ */
const VERSION      = 'brigadistas-v4';
const STATIC_CACHE = `${VERSION}-static`;
const HTML_CACHE   = `${VERSION}-html`;

const PRECACHE = [
  '/',
  '/index.html',
    '/inegi.html',
  '/404.html',
  
  '/offline.html',
  '/manifest.json',
  '/img.png',
  '/js/db-offline.js',
  '/js/tile-cache.js',
  // CDN libs (para que funcionen 100% offline)
  'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js',
  'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.css',
  'https://cdn.jsdelivr.net/npm/leaflet.markercluster@1.5.3/dist/leaflet.markercluster.js',
  'https://cdn.jsdelivr.net/npm/leaflet.markercluster@1.5.3/dist/MarkerCluster.css',
  'https://cdn.jsdelivr.net/npm/leaflet.markercluster@1.5.3/dist/MarkerCluster.Default.css',
  'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js',
  'https://cdn.jsdelivr.net/npm/html5-qrcode@2.3.8/html5-qrcode.min.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(STATIC_CACHE);
    await Promise.all(PRECACHE.map(async (url) => {
      try {
        const res = await fetch(url, { cache: 'reload' });
        if (res && res.ok) await cache.put(url, res);
      } catch (e) {}
    }));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys.filter(k => !k.startsWith(VERSION)).map(k => caches.delete(k))
    );
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  let url;
  try { url = new URL(req.url); } catch (e) { return; }

   // 1) Recursos externos → solo cachear libs CDN (leaflet, xlsx, etc.)
  if (url.origin !== self.location.origin) {
    const jsdelivrOK = /^https:\/\/cdn\.jsdelivr\.net\/npm\/(leaflet@|leaflet\.markercluster@|xlsx@|html5-qrcode@)/.test(url.href);
    if (!jsdelivrOK) return;
    event.respondWith(cacheFirst(req, STATIC_CACHE));
    return;
  }

  // 2) API → NUNCA interceptar (sesiones, datos, etc.)
  if (url.pathname.startsWith('/api/')) return;

  // 3) SEO → dejar pasar directo
  if (url.pathname === '/sitemap.xml' || url.pathname === '/robots.txt') return;

  // 4) HTML → network-first con fallback offline
  if (req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html')) {
    event.respondWith(htmlStrategy(req));
    return;
  }

  // 5) JS / CSS / assets → cache-first
  event.respondWith(cacheFirst(req, STATIC_CACHE));
});

/* ══════════════════════════════════════════════════════════════
   HTML: CACHE-FIRST con revalidación en background (stale-while-revalidate)
   - Sirve INSTANTÁNEO del caché → funciona con WiFi on sin internet
   - Actualiza el caché en background sin bloquear al usuario
   - Fallback a /offline.html solo si NUNCA se guardó nada
   ══════════════════════════════════════════════════════════════ */
async function htmlStrategy(req) {
  const cache = await caches.open(HTML_CACHE);

  // 1) Buscar en caché HTML (primero) y en STATIC (por si nunca se pobló HTML_CACHE)
  let cached = await cache.match(req);
  if (!cached) cached = await caches.match(req);

  // 2) Si hay caché → servirlo YA (instantáneo) y revalidar en background
  if (cached) {
    revalidateHtml(req, cache);
    return cached;
  }

  // 3) Sin caché → intentar red con timeout de 6s (no cuelga 60s)
  try {
    const fresh = await fetchWithTimeout(req, 6000);
    if (fresh && fresh.ok) {
      cache.put(req, fresh.clone()).catch(() => {});
      return fresh;
    }
    throw new Error('bad');
  } catch (e) {
    // 4) Fallback final
    const offline = await caches.match('/offline.html');
    return offline || new Response('Sin conexión', {
      status: 503,
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    });
  }
}

/* Revalida HTML en background SOLO si el caché tiene >1 hora.
   Así en Modo Ahorro se evita el consumo de datos: solo revalida 1×/hora
   como máximo (o al abrir la app después de ese tiempo). */
async function revalidateHtml(req, cache) {
  try {
    const cached = await cache.match(req);
    if (cached) {
      const dateHeader = cached.headers.get('date');
      if (dateHeader) {
        const age = Date.now() - Date.parse(dateHeader);
        if (isFinite(age) && age < 60 * 60 * 1000) {
          return;   // ← menos de 1h → NO revalidar (0 consumo)
        }
      }
    }
  } catch (e) {}
  // Revalidar (esto se ejecuta como máximo 1×/hora por URL)
  fetchWithTimeout(req, 15000)
    .then(res => { if (res && res.ok) cache.put(req, res.clone()); })
    .catch(() => {});
}

/* fetch con AbortController → nunca cuelga más de `ms` milisegundos
   Sirve para "WiFi on pero sin internet real": aborta rápido y cae al caché */
function fetchWithTimeout(req, ms) {
  return new Promise((resolve, reject) => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      try { controller.abort(); } catch (e) {}
      reject(new Error('timeout'));
    }, ms);
    fetch(req, { signal: controller.signal })
      .then(res => { clearTimeout(timer); resolve(res); })
      .catch(err => { clearTimeout(timer); reject(err); });
  });
}
async function cacheFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(req);
  if (cached) return cached;
  try {
    const fresh = await fetch(req);
    if (fresh && fresh.ok) cache.put(req, fresh.clone());
    return fresh;
  } catch (e) {
    return cached || new Response('', { status: 503, statusText: 'Offline' });
  }
}

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
  if (event.data === 'CLEAR_CACHE') {
    event.waitUntil(caches.keys().then(ks => Promise.all(ks.map(k => caches.delete(k)))));
  }
});
