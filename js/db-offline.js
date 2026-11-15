/* ============================================================
   DB-OFFLINE.JS — Capa offline con IndexedDB para Brigadistas
   Stores: patients, visits, syncQueue, deleted (tombstones), meta
   ============================================================ */
(function (global) {
  'use strict';

  const DB_NAME = 'brigadistas_offline';
  const DB_VER = 1;
  let dbPromise = null;

  function openDB() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VER);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('patients')) {
          const s = db.createObjectStore('patients', { keyPath: 'id' });
          s.createIndex('nombre', 'nombre');
          s.createIndex('colonia', 'colonia');
          s.createIndex('updatedAt', '_cachedAt');
        }
        if (!db.objectStoreNames.contains('visits')) {
          const s = db.createObjectStore('visits', { keyPath: 'id' });
          s.createIndex('pid', 'pid');
        }
        if (!db.objectStoreNames.contains('syncQueue')) {
          const s = db.createObjectStore('syncQueue', { keyPath: 'id', autoIncrement: true });
          s.createIndex('createdAt', 'createdAt');
        }
        if (!db.objectStoreNames.contains('deleted')) {
          db.createObjectStore('deleted', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('meta')) {
          db.createObjectStore('meta', { keyPath: 'key' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return dbPromise;
  }

  async function get(store, key) {
    const db = await openDB();
    return new Promise((res, rej) => {
      const r = db.transaction(store, 'readonly').objectStore(store).get(key);
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
  }

  async function getAll(store) {
    const db = await openDB();
    return new Promise((res, rej) => {
      const r = db.transaction(store, 'readonly').objectStore(store).getAll();
      r.onsuccess = () => res(r.result || []);
      r.onerror = () => rej(r.error);
    });
  }

  async function put(store, value) {
    const db = await openDB();
    return new Promise((res, rej) => {
      const t = db.transaction(store, 'readwrite');
      t.objectStore(store).put(value);
      t.oncomplete = () => res();
      t.onerror = () => rej(t.error);
    });
  }

  async function del(store, key) {
    const db = await openDB();
    return new Promise((res, rej) => {
      const t = db.transaction(store, 'readwrite');
      t.objectStore(store).delete(key);
      t.oncomplete = () => res();
      t.onerror = () => rej(t.error);
    });
  }

  async function clear(store) {
    const db = await openDB();
    return new Promise((res, rej) => {
      const t = db.transaction(store, 'readwrite');
      t.objectStore(store).clear();
      t.oncomplete = () => res();
      t.onerror = () => rej(t.error);
    });
  }

  /* ─────────── Patients (bulk save) ─────────── */
  async function saveAllPatients(pacObj, opts) {
    if (!pacObj || typeof pacObj !== 'object') return;
    const db = await openDB();
    const now = Date.now();
    const entries = Object.entries(pacObj).filter(([, p]) => p);
    const CHUNK = 400;

    // 🔧 Opción replaceAll: limpia stale patients que ya no existen en el servidor
    if (opts && opts.replaceAll === true) {
      await new Promise((res, rej) => {
        const t = db.transaction('patients', 'readwrite');
        t.objectStore('patients').clear();
        t.oncomplete = () => res();
        t.onerror = () => rej(t.error);
      });
    }

    // 🔧 Escritura en chunks: evita timeout de transacción con 20k registros
    for (let i = 0; i < entries.length; i += CHUNK) {
      const slice = entries.slice(i, i + CHUNK);
      await new Promise((res, rej) => {
        const t = db.transaction('patients', 'readwrite');
        const store = t.objectStore('patients');
        for (const [pid, p] of slice) {
          store.put({ ...p, id: pid, _cachedAt: now });
        }
        t.oncomplete = () => res();
        t.onerror = () => rej(t.error);
      });
    }
  }

  async function getPatientsObject() {
    const arr = await getAll('patients');
    const pac = {};
    for (const p of arr) {
      const { id, _cachedAt, ...rest } = p;
      pac[id] = rest;
    }
    return pac;
  }

  /* ─────────── Visits ─────────── */
  async function getVisitsByPid(pid) {
    const db = await openDB();
    return new Promise((res, rej) => {
      const idx = db.transaction('visits', 'readonly').objectStore('visits').index('pid');
      const r = idx.getAll(pid);
      r.onsuccess = () => res(r.result || []);
      r.onerror = () => rej(r.error);
    });
  }

  /* ─────────── Tombstones (borrado anti-resurrección) ─────────── */
  async function markDeleted(pid) {
    return put('deleted', { id: pid, at: Date.now() });
  }

  async function isDeleted(pid) {
    const d = await get('deleted', pid);
    return !!(d && (Date.now() - d.at < 7 * 24 * 60 * 60 * 1000));
  }

  async function cleanTombstones() {
    try {
      const all = await getAll('deleted');
      const now = Date.now();
      for (const d of all) {
        if (now - d.at > 7 * 24 * 60 * 60 * 1000) await del('deleted', d.id);
      }
    } catch (e) {}
  }

  /* ─────────── Sync Queue ─────────── */
  async function queueSync(item) {
    const db = await openDB();
    // 🔧 Dedup REAL: la estructura del item es {a: action, d: data, pid, vid, _enc}.
    // El pid está en item.pid (top level, añadido por el wrapper) o item.d.pid.
    const action = item && (item.a || item.action);
    const pid = item && (item.pid || (item.d && item.d.pid));
    const vid = item && (item.vid || (item.d && item.d.vid));
    if (pid && action) {
      const all = await new Promise((res, rej) => {
        const r = db.transaction('syncQueue', 'readonly').objectStore('syncQueue').getAll();
        r.onsuccess = () => res(r.result || []);
        r.onerror = () => rej(r.error);
      });
      const dup = all.find(q => {
        if (!q) return false;
        const qAction = q.a || q.action;
        const qPid = q.pid || (q.d && q.d.pid);
        const qVid = q.vid || (q.d && q.d.vid);
        if (qAction !== action || qPid !== pid) return false;
        // Para visitas, distinguir por vid (no colapsar 2 visitas distintas)
        if ((action === 'visit_save' || action === 'visit_del') && qVid !== vid) return false;
        return true;
      });
      if (dup) {
        await new Promise((res, rej) => {
          const t = db.transaction('syncQueue', 'readwrite');
          t.objectStore('syncQueue').delete(dup.id);
          t.oncomplete = () => res();
          t.onerror = () => rej(t.error);
        });
      }
    }
    return new Promise((res, rej) => {
      const t = db.transaction('syncQueue', 'readwrite');
      const r = t.objectStore('syncQueue').add({ ...item, createdAt: Date.now() });
      r.onsuccess = () => res(r.result);
      t.onerror = () => rej(t.error);
    });
  }
  async function getQueue() {
    return getAll('syncQueue');
  }

  async function removeFromQueue(id) {
    return del('syncQueue', id);
  }

  /* ─────────── Meta ─────────── */
  async function setMeta(key, value) {
    return put('meta', { key, value, at: Date.now() });
  }

  async function getMeta(key) {
    const m = await get('meta', key);
    return m ? m.value : null;
  }

  /* ─────────── Stats ─────────── */
  async function stats() {
    return {
      patients: (await getAll('patients')).length,
      visits: (await getAll('visits')).length,
      queue: (await getQueue()).length,
      deleted: (await getAll('deleted')).length
    };
  }

  async function clearAll() {
    await Promise.all(['patients', 'visits', 'syncQueue', 'deleted', 'meta'].map(clear));
  }

  global.OFFDB = {
    openDB, get, getAll, put, del, clear,
    saveAllPatients, getPatientsObject, getVisitsByPid,
    markDeleted, isDeleted, cleanTombstones,
    queueSync, getQueue, removeFromQueue,
    setMeta, getMeta,
    stats, clearAll
  };

  // Limpieza al cargar
  if (typeof document !== 'undefined') {
    setTimeout(() => cleanTombstones().catch(() => {}), 3000);
  }
})(window);
