/* ============================================================
   TILE-CACHE.JS — Caché de tiles en IndexedDB + plugin Leaflet
   ============================================================ */
(function (global) {
  'use strict';

  const DB_NAME = 'brigadistas_tiles';
  const STORE = 'tiles';
  const MAX_TILES = 8000;                 // ~240 MB — cubre zoom-out de 20k pacientes
   const MAX_AGE = 30 * 24 * 60 * 60 * 1000; // 30 días
  const FLUSH_EVERY = 25;

  let dbPromise = null;
  function openDB() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((res, rej) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE)) {
          const s = db.createObjectStore(STORE, { keyPath: 'url' });
          s.createIndex('savedAt', 'savedAt');
        }
      };
      req.onsuccess = () => res(req.result);
      req.onerror = () => rej(req.error);
    });
    return dbPromise;
  }

  async function getTile(url) {
    try {
      const db = await openDB();
      return new Promise((res) => {
        const r = db.transaction(STORE, 'readonly').objectStore(STORE).get(url);
        r.onsuccess = () => res(r.result || null);
        r.onerror = () => res(null);
      });
    } catch { return null; }
  }

  async function putTile(rec) {
    try {
      const db = await openDB();
      return new Promise((res) => {
        const t = db.transaction(STORE, 'readwrite');
        t.objectStore(STORE).put(rec);
        t.oncomplete = () => res(true);
        t.onerror = () => res(false);
      });
    } catch { return false; }
  }

  async function countTiles() {
    try {
      const db = await openDB();
      return new Promise((res) => {
        const r = db.transaction(STORE, 'readonly').objectStore(STORE).count();
        r.onsuccess = () => res(r.result);
        r.onerror = () => res(0);
      });
    } catch { return 0; }
  }

  async function pruneOldest() {
    const total = await countTiles();
    if (total <= MAX_TILES) return;
    const toDelete = total - MAX_TILES;
    const db = await openDB();
    return new Promise((res) => {
      const t = db.transaction(STORE, 'readwrite');
      const idx = t.objectStore(STORE).index('savedAt');
      let deleted = 0;
      idx.openCursor().onsuccess = (e) => {
        const c = e.target.result;
        if (!c || deleted >= toDelete) { res(); return; }
        c.delete();
        deleted++;
        c.continue();
      };
    });
  }

  async function pruneExpired() {
    try {
      const db = await openDB();
      const cutoff = Date.now() - MAX_AGE;
      return new Promise((res) => {
        const t = db.transaction(STORE, 'readwrite');
        const idx = t.objectStore(STORE).index('savedAt');
        idx.openCursor(IDBKeyRange.upperBound(cutoff)).onsuccess = (e) => {
          const c = e.target.result;
          if (!c) { res(); return; }
          c.delete();
          c.continue();
        };
      });
    } catch {}
  }

  /* Batched writes */
  let pending = [];
  let pendingTimer = null;
  function scheduleFlush() {
    if (pending.length >= FLUSH_EVERY) { flushPending(); return; }
    if (pendingTimer) return;
    pendingTimer = setTimeout(flushPending, 1500);
  }
  async function flushPending() {
    if (pendingTimer) { clearTimeout(pendingTimer); pendingTimer = null; }
    const batch = pending; pending = [];
    for (const rec of batch) await putTile(rec);
    const total = await countTiles();
    if (total > MAX_TILES) pruneOldest();
  }

  /* ─────────── Leaflet plugin ─────────── */
  if (typeof L !== 'undefined') {
    L.TileLayer.Offline = L.TileLayer.extend({
      createTile(coords, done) {
        const tile = document.createElement('img');
        tile.alt = '';
        tile.setAttribute('role', 'presentation');
        const url = this.getTileUrl(coords);

        (async () => {
          const cached = await getTile(url);
          if (cached && cached.blob) {
            const objUrl = URL.createObjectURL(cached.blob);
            tile.onload = () => { URL.revokeObjectURL(objUrl); done(null, tile); };
            tile.onerror = () => { URL.revokeObjectURL(objUrl); fetchAndCache(tile, url, done); };
            tile.src = objUrl;
            return;
          }
          fetchAndCache(tile, url, done);
        })();

        return tile;
      }
    });

    async function fetchAndCache(tile, url, done) {
      try {
        // 🔧 AbortController: evita que un tile colgado bloquee la carga para siempre
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 12000);
        const res = await fetch(url, { mode: 'cors', credentials: 'omit', signal: ctrl.signal });
        clearTimeout(timer);
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const blob = await res.blob();
        if (blob.size >= 200) {          // ignora PNGs vacíos
          pending.push({ url, blob, savedAt: Date.now() });
          scheduleFlush();
        }
        const objUrl = URL.createObjectURL(blob);
        tile.onload = () => { URL.revokeObjectURL(objUrl); done(null, tile); };
        tile.onerror = () => { URL.revokeObjectURL(objUrl); done(new Error('img'), tile); };
        tile.src = objUrl;
      } catch (e) {
        done(e, tile);
      }
    }

    L.tileLayer.offline = function (url, opts) {
      return new L.TileLayer.Offline(url, opts);
    };
  }

  /* Limpieza al arrancar */
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => pruneExpired());
    } else {
      pruneExpired();
    }
  }

  global.TileCache = {
    count: countTiles,
    clear: async () => {
      const db = await openDB();
      return new Promise((res) => {
        const t = db.transaction(STORE, 'readwrite');
        t.objectStore(STORE).clear();
        t.oncomplete = () => res(true);
      });
    },
    pruneExpired,
    flushPending,
    stats: async () => {
      const total = await countTiles();
      return { total, maxTiles: MAX_TILES, maxAgeDays: MAX_AGE / (24 * 60 * 60 * 1000) };
    }
  };
})(window);
