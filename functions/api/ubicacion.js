/* /functions/api/ubicacion.js — Cloudflare Pages Function
   v3:
     • Recibe `label` (folio/nombre del paciente) y genera batchId determinístico.
     • Un paciente = un batch (sus muestras se acumulan automáticamente).
     • location_list devuelve el label para agrupar en el admin.
     • Tile provider: NO se usa aquí (el cliente usa CartoDB, dentro del CSP).
*/

const DB = 'https://galleros-main-default-rtdb.firebaseio.com';
const enc = new TextEncoder();

const b64u = b => {
  const arr = b instanceof Uint8Array ? b : new Uint8Array(b);
  let s = '';
  for (let i = 0; i < arr.length; i++) s += String.fromCharCode(arr[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

const J = (o, s = 200) => new Response(JSON.stringify(o), {
  status: s,
  headers: {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer'
  }
});

const eq = (a, b) => {
  a = String(a); b = String(b);
  let d = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) d |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return d === 0;
};

// ═══════════════ FNV-1a (batchId determinístico desde label) ═══════════════
function labelToBatchId(label) {
  const s = 'loc:' + String(label).toLowerCase().trim();
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return 'l' + (h >>> 0).toString(36).padStart(7, '0');
}

// ═══════════════ DELTA SYNC (changelog + lastRev) ═══════════════
const pad15 = n => String(n).padStart(15, '0');

// 1 sola PATCH atómica. Purga probabilística (1% de las escrituras)
// borra entradas con > 60 días para que el changelog no crezca sin límite.
async function logLocationChange(env, batchId, label, sampleId, at) {
  // 🆕 Sufijo aleatorio evita colisión si 2 saves ocurren en el MISMO ms.
  //    Si colisionaran, uno sobrescribiría al otro y ese cambio se perdería
  //    del delta hasta el próximo sample en ms superior.
  const rnd = Math.random().toString(36).slice(2, 6);
  const key = pad15(at) + '_' + sampleId + '_' + rnd;
  const updates = {};
  updates[`_loc_changelog/${key}`] = { batchId, label: label || '', at, sid: sampleId };
  updates[`_loc_meta/lastRev`] = at;
   

  try {
    const r = await fetch(`${DB}/ocr.json?access_token=${await gtoken(env)}`, {
      method: 'PATCH',
      body: JSON.stringify(updates)
    });
    if (!r.ok) console.warn('[logLocationChange] Firebase', r.status);
  } catch (e) {
    console.warn('[logLocationChange]', e.message);
    return;
  }

  // 🧹 Purga probabilística: 1% de las escrituras limpia entradas viejas
  if (Math.random() > 0.01) return;
  try {
    const cutoff = pad15(Date.now() - 60 * 24 * 3600e3);
    const old = await fetch(
      `${DB}/ocr/_loc_changelog.json?orderBy="$key"&endAt="${cutoff}"&access_token=${await gtoken(env)}`
    );
    if (!old.ok) return;
    const obj = await old.json();
    if (!obj || typeof obj !== 'object') return;
    const del = {};
    for (const k of Object.keys(obj)) del[`_loc_changelog/${k}`] = null;
    if (!Object.keys(del).length) return;
    await fetch(`${DB}/ocr.json?access_token=${await gtoken(env)}`, {
      method: 'PATCH',
      body: JSON.stringify(del)
    });
  } catch (e) {
    console.warn('[logLocationChange] purge', e.message);
  }
}

// ═══════════════ RATE-LIMIT ═══════════════
const _localFails = new Map();

async function isLocked(env, k) {
  try {
    if (env && env.RATE_KV) {
      const v = await env.RATE_KV.get('rl:' + k);
      if (!v) return false;
      const o = JSON.parse(v);
      return o.n >= 5 && Date.now() < o.t;
    }
  } catch {}
  const f = _localFails.get(k);
  return f && f.n >= 5 && Date.now() < f.t;
}

async function bumpFail(env, k) {
  try {
    if (env && env.RATE_KV) {
      const v = await env.RATE_KV.get('rl:' + k);
      const o = v ? JSON.parse(v) : { n: 0, t: 0 };
      o.n = (o.n || 0) + 1;
      o.t = Date.now() + 15 * 60e3;
      await env.RATE_KV.put('rl:' + k, JSON.stringify(o), { expirationTtl: 900 });
      return;
    }
  } catch {}
  const f = _localFails.get(k) || { n: 0 };
  _localFails.set(k, { n: f.n + 1, t: Date.now() + 15 * 60e3 });
}

async function clearFails(env, k) {
  try { if (env && env.RATE_KV) await env.RATE_KV.delete('rl:' + k); } catch {}
  _localFails.delete(k);
}

// ─── Rate limit por IP (evita creación masiva de batches nuevos) ─────
const _batchCounter = new Map();
const MAX_BATCHES_PER_HOUR = 60;

async function checkBatchLimit(env, ip) {
  const k = 'bt:' + ip;
  const WINDOW = 3600000;
  try {
    if (env && env.RATE_KV) {
      const v = await env.RATE_KV.get(k);
      const o = v ? JSON.parse(v) : { n: 0, reset: 0 };
      const now = Date.now();
      if (now > o.reset) { o.n = 0; o.reset = now + WINDOW; }
      if (o.n >= MAX_BATCHES_PER_HOUR) return false;
      o.n++;
      await env.RATE_KV.put(k, JSON.stringify(o), { expirationTtl: 3600 });
      return true;
    }
  } catch {}
  const o = _batchCounter.get(ip) || { n: 0, reset: 0 };
  const now = Date.now();
  if (now > o.reset) { o.n = 0; o.reset = now + WINDOW; }
  if (o.n >= MAX_BATCHES_PER_HOUR) return false;
  o.n++;
  _batchCounter.set(ip, o);
  return true;
}

// ─── Rate limit por label (evita flood a un paciente específico) ─────
const _labelCounter = new Map();
const MAX_SAMPLES_PER_LABEL_HOUR = 100;   // 100 muestras/hora por folio
                                           // (suficiente: el cliente envía máx 15 por sesión)

async function checkLabelLimit(env, batchId, ip) {
  const k = 'lb:' + batchId;
  const WINDOW = 3600000;
  try {
    if (env && env.RATE_KV) {
      const v = await env.RATE_KV.get(k);
      const o = v ? JSON.parse(v) : { n: 0, reset: 0 };
      const now = Date.now();
      if (now > o.reset) { o.n = 0; o.reset = now + WINDOW; }
      if (o.n >= MAX_SAMPLES_PER_LABEL_HOUR) return false;
      o.n++;
      await env.RATE_KV.put(k, JSON.stringify(o), { expirationTtl: 3600 });
      return true;
    }
  } catch {}
  const o = _labelCounter.get(batchId) || { n: 0, reset: 0 };
  const now = Date.now();
  if (now > o.reset) { o.n = 0; o.reset = now + WINDOW; }
  if (o.n >= MAX_SAMPLES_PER_LABEL_HOUR) return false;
  o.n++;
  _labelCounter.set(batchId, o);
  return true;
}

// ═══════════════ TOKEN HMAC ═══════════════
async function hmacLoc(env, d) {
  const k = await crypto.subtle.importKey(
    'raw', enc.encode('s:loc:' + env.ADMIN_PASSWORD),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  return b64u(await crypto.subtle.sign('HMAC', k, enc.encode(d)));
}

async function mint(env) {
  const jti = b64u(crypto.getRandomValues(new Uint8Array(9)));
  const p = btoa(JSON.stringify({ r: 'loc_admin', jti, exp: Date.now() + 24 * 3600e3 }));
  return p + '.' + await hmacLoc(env, p);
}

async function verify(env, t) {
  try {
    const parts = String(t).split('.');
    if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
    const p = parts[0], s = parts[1];
    if (!eq(s, await hmacLoc(env, p))) return null;
    const o = JSON.parse(atob(p));
    if (o.r !== 'loc_admin') return null;
    return o.exp > Date.now() ? o : null;
  } catch { return null; }
}

// ═══════════════ FIREBASE ═══════════════
let tk = { t: '', e: 0 };

async function gtoken(env) {
  if (tk.t && Date.now() < tk.e) return tk.t;
  const sa = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT);
  const now = Math.floor(Date.now() / 1000);
  const u = b64u(enc.encode(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))) + '.' +
    b64u(enc.encode(JSON.stringify({
      iss: sa.client_email,
      scope: 'https://www.googleapis.com/auth/firebase.database https://www.googleapis.com/auth/userinfo.email',
      aud: 'https://oauth2.googleapis.com/token',
      iat: now, exp: now + 3600
    })));
  const der = Uint8Array.from(
    atob(sa.private_key.replace(/-----[A-Z ]+-----/g, '').replace(/\s/g, '')),
    c => c.charCodeAt(0)
  );
  const key = await crypto.subtle.importKey('pkcs8', der,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const sig = b64u(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, enc.encode(u)));
  const r = await (await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: u + '.' + sig
    })
  })).json();
  tk = { t: r.access_token, e: Date.now() + 3300e3 };
  return tk.t;
}

async function db(env, m, p, body, q = '') {
  const r = await fetch(`${DB}/ocr/${p}.json?${q}access_token=${await gtoken(env)}`, {
    method: m,
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  if (!r.ok) throw new Error('Firebase ' + r.status);
  return r.json();
}

// ═══════════════ 🔐 CIFRADO AES-GCM (en reposo) ═══════════════
// Cifra lat/lng/acc antes de guardar en Firebase.
// Requiere env.ENCRYPTION_KEY (32 bytes hex = 64 chars).
// Si no está configurada, guarda en texto plano (fallback).

async function getEncKey(env) {
  if (!env.ENCRYPTION_KEY) return null;
  try {
    const hex = String(env.ENCRYPTION_KEY).replace(/[^0-9a-fA-F]/g, '');
    if (hex.length !== 64) {
      console.warn('[enc] ENCRYPTION_KEY debe ser 64 chars hex');
      return null;
    }
    const raw = Uint8Array.from(hex.match(/.{2}/g).map(h => parseInt(h, 16)));
    return await crypto.subtle.importKey(
      'raw', raw, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']
    );
  } catch (e) {
    console.warn('[enc] key inválida:', e.message);
    return null;
  }
}

async function encryptSample(env, obj) {
  const key = await getEncKey(env);
  if (!key) return obj;   // sin key → texto plano (compat)
  try {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const data = enc.encode(JSON.stringify(obj));
    const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data);
    return { _enc: b64u(new Uint8Array([...iv, ...new Uint8Array(ct)])) };
  } catch (e) {
    console.warn('[enc] encrypt falló:', e.message);
    return obj;   // nunca pierde el sample
  }
}

async function decryptSample(env, obj) {
  if (!obj || !obj._enc) return obj;   // texto plano legacy → as-is
  const key = await getEncKey(env);
  if (!key) {
    console.warn('[enc] sample cifrado pero no hay ENCRYPTION_KEY');
    return null;
  }
  try {
    const clean = String(obj._enc).replace(/-/g, '+').replace(/_/g, '/');
    const pad = clean + '='.repeat((4 - clean.length % 4) % 4);
    const buf = Uint8Array.from(atob(pad), c => c.charCodeAt(0));
    const iv = buf.slice(0, 12);
    const ct = buf.slice(12);
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct);
    return JSON.parse(new TextDecoder().decode(pt));
  } catch (e) {
    console.warn('[enc] decrypt falló:', e.message);
    return null;
  }
}

// ═══════════════ FIN CIFRADO ═══════════════

async function shortHash(s) {
  const buf = await crypto.subtle.digest('SHA-256', enc.encode('ip:' + s));
  return b64u(new Uint8Array(buf).slice(0, 8));
}

const clean = s => String(s || '').toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 40);

// Sanitiza el label del paciente (permite tildes, espacios, guiones)
function cleanLabel(s) {
  return String(s || '')
    .replace(/[\x00-\x1f\x7f-\x9f\u200b-\u200f\u202a-\u202e\u2066-\u2069\ufeff]/g, '')
    .replace(/[<>]/g, '')   // ← nunca aceptar HTML
    .trim()
    .slice(0, 200);
}

// ═══════════════ HANDLER ═══════════════
export async function onRequestPost({ request, env }) {
  try {
    // ─── Origin check: bloquea requests cross-origin
    const org = request.headers.get('Origin');
    if (org && org !== 'null') {
      try {
        if (new URL(org).host !== new URL(request.url).host) {
          return J({ error: 'Origen no permitido' }, 403);
        }
      } catch {
        // Origin malformado → rechazo (antes se ignoraba)
        return J({ error: 'Origen inválido' }, 403);
      }
    }

    const cl = +request.headers.get('Content-Length') || 0;
    if (cl > 200000) return J({ error: 'Solicitud demasiado grande' }, 413);

    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';

    let b;
    try { b = await request.json(); } catch { return J({ error: 'JSON inválido' }, 400); }
    const a = b && b.a;

    // ─── PACIENTE ───
    if (a === 'location_save') {
      let batchId, label = '';

      // Si viene label → batchId determinístico (todas sus muestras al mismo lugar)
      if (b.label && String(b.label).trim()) {
        label = cleanLabel(b.label);
        if (!label) return J({ error: 'label vacío tras sanitizar' }, 400);
        batchId = labelToBatchId(label);
      } else {
        batchId = clean(b.batchId);
        if (!/^b[a-z0-9]{8,40}$/.test(batchId)) {
          return J({ error: 'batchId inválido' }, 400);
        }
      }

      const lat = parseFloat(b.lat);
      const lng = parseFloat(b.lng);
      const acc = parseFloat(b.acc);

      if (!isFinite(lat) || lat < -90 || lat > 90)   return J({ error: 'Latitud inválida' }, 400);
      if (!isFinite(lng) || lng < -180 || lng > 180) return J({ error: 'Longitud inválida' }, 400);
      if (!isFinite(acc) || acc < 0 || acc > 100000) return J({ error: 'Precisión inválida' }, 400);

      const deviceId = clean(b.deviceId) || '';
      const batchPath = 'locations/' + batchId;
      const existing = await db(env, 'GET', batchPath);

      // Rate limit: solo la primera vez que se crea el batch
      if (!existing) {
        if (!await checkBatchLimit(env, ip)) {
          return J({ error: 'Demasiados envíos. Intenta en una hora.' }, 429);
        }
      }

      // Rate limit por label (evita flood a un paciente específico)
      if (label && !await checkLabelLimit(env, batchId, ip)) {
        return J({ error: 'Demasiados envíos para este folio. Espera 1 hora.' }, 429);
      }

      // Límite de muestras
      const existingSamples = (existing && existing.samples) || {};
      const sampleCount = Object.keys(existingSamples).length;
      if (sampleCount >= 500) {
        return J({ error: 'Límite de muestras por lote alcanzado' }, 429);
      }

      // Construir el NUEVO sample (sin tocar los existentes)
      const now = Date.now();
      const sampleId = 's' + now.toString(36) + Math.random().toString(36).slice(2, 6);
      const newSample = {
        lat: +lat.toFixed(7),
        lng: +lng.toFixed(7),
        acc: Math.round(acc),
        at: now
      };

      // 🔐 Cifrar el sample antes de guardar en Firebase
      const encSample = await encryptSample(env, newSample);

      // ⚡ PATCH atómico: solo actualiza los campos que cambian.
      // Múltiples muestras concurrentes NO se pisan (cada una va a su propia key).
      const patch = {
        batchId,
        label: label || (existing && existing.label) || '',
        deviceId: deviceId || (existing && existing.deviceId) || '',
        createdAt: (existing && existing.createdAt) || now,
        updatedAt: now,
        [`samples/${sampleId}`]: encSample,
        // ℹ️ best NO se guarda en Firebase: se recomputa al leer
        //    (evita guardar coordenadas en texto plano en este campo)
      };
      if (!existing) {
        patch.ipHash = await shortHash(ip);
        // Sanitize ua: además de control chars, quitar <>"'
        patch.ua = String(b.ua || '')
          .replace(/[\x00-\x1f\x7f<>"']/g, '')
          .slice(0, 200);
      }

         await db(env, 'PATCH', batchPath, patch);

      // 🆕 Registrar en el changelog para que otros clientes reciban el delta
      await logLocationChange(env, batchId, label || patch.label || '', sampleId, now);

      return J({ ok: 1, batchId, sampleId, label: patch.label });
    }

     // ─── CONSULTA PÚBLICA: mejor ubicación por label (folio o nombre) ───
    // Usado por la app OCR para autocompletar coordenadas ya enviadas.
    // Rate-limited por IP para evitar enumeración de folios.
    if (a === 'location_best_for') {
      const label = cleanLabel(b.label || '');
      if (!label) return J({ error: 'label requerido' }, 400);

      // Rate limit: 20 consultas/minuto/IP
      const rk = 'lbf:' + ip;
      const WINDOW_MS = 60 * 1000;
      const MAX_PER_MIN = 20;
      try {
        if (env && env.RATE_KV) {
          const v = await env.RATE_KV.get(rk);
          const o = v ? JSON.parse(v) : { n: 0, reset: 0 };
          const now = Date.now();
          if (now > o.reset) { o.n = 0; o.reset = now + WINDOW_MS; }
          if (o.n >= MAX_PER_MIN) return J({ error: 'Demasiadas consultas. Espera un minuto.' }, 429);
          o.n++;
          await env.RATE_KV.put(rk, JSON.stringify(o), { expirationTtl: 60 });
        } else {
          const o = _labelCounter.get(rk) || { n: 0, reset: 0 };
          const now = Date.now();
          if (now > o.reset) { o.n = 0; o.reset = now + WINDOW_MS; }
          if (o.n >= MAX_PER_MIN) return J({ error: 'Demasiadas consultas.' }, 429);
          o.n++;
          _labelCounter.set(rk, o);
        }
      } catch {}

      const batchId = labelToBatchId(label);
      const batch = await db(env, 'GET', 'locations/' + batchId);
      if (!batch || !batch.samples) return J({ ok: 1, found: false });

      // Descifrar muestras y calcular la mejor
      const decrypted = await Promise.all(
        Object.entries(batch.samples).map(async ([sid, sm]) => {
          const dec = sm && sm._enc ? await decryptSample(env, sm) : sm;
          if (!dec) return null;
          return { lat: +dec.lat, lng: +dec.lng, acc: +dec.acc, at: +dec.at };
        })
      );
      const valid = decrypted.filter(x =>
        x && isFinite(x.lat) && isFinite(x.lng) && isFinite(x.acc) &&
        x.lat >= -90 && x.lat <= 90 && x.lng >= -180 && x.lng <= 180
      );
      if (!valid.length) return J({ ok: 1, found: false });

      let best = valid[0];
      for (const x of valid) if (x.acc < best.acc) best = x;

      return J({
        ok: 1,
        found: true,
        lat: +(+best.lat).toFixed(7),
        lng: +(+best.lng).toFixed(7),
        acc: Math.round(best.acc),
        at: best.at,
        samples: valid.length
      });
    }

    // ─── ADMIN LOGIN ───
    // ─── CONSULTA MASIVA: mejor ubicación para múltiples labels ───
    // Usada por el mapa del admin para mostrar 1 pin por paciente.
    // Hasta 100 labels por request, 10 requests/min por IP.
    if (a === 'location_best_bulk') {
      const rawLabels = Array.isArray(b.labels) ? b.labels : [];
      if (!rawLabels.length) return J({ error: 'labels[] requerido' }, 400);
      if (rawLabels.length > 100) return J({ error: 'Máximo 100 labels por llamada' }, 400);

      const rk = 'lbb:' + ip;
      const WINDOW_MS = 60 * 1000;
      // 🆕 300/min: _syncFull de 20k pacientes = 400 requests en ~3 min.
      //    Con 10/min fallaba (429 en request #11). Con 300/min pasa holgado.
      //    Sigue bloqueando floods absurdos (>5 req/segundo sostenido).
      const MAX_PER_MIN = 300;
      try {
        if (env && env.RATE_KV) {
          const v = await env.RATE_KV.get(rk);
          const o = v ? JSON.parse(v) : { n: 0, reset: 0 };
          const now = Date.now();
          if (now > o.reset) { o.n = 0; o.reset = now + WINDOW_MS; }
          if (o.n >= MAX_PER_MIN) return J({ error: 'Demasiadas consultas. Espera un minuto.' }, 429);
          o.n++;
          await env.RATE_KV.put(rk, JSON.stringify(o), { expirationTtl: 60 });
        } else {
          const o = _labelCounter.get(rk) || { n: 0, reset: 0 };
          const now = Date.now();
          if (now > o.reset) { o.n = 0; o.reset = now + WINDOW_MS; }
          if (o.n >= MAX_PER_MIN) return J({ error: 'Demasiadas consultas.' }, 429);
          o.n++;
          _labelCounter.set(rk, o);
        }
      } catch {}

      const results = {};
      const PARALLEL = 10;

      for (let i = 0; i < rawLabels.length; i += PARALLEL) {
        const chunk = rawLabels.slice(i, i + PARALLEL);
        await Promise.all(chunk.map(async (raw) => {
          const label = cleanLabel(raw || '');
          if (!label) return;
          try {
            const batchId = labelToBatchId(label);
            const batch = await db(env, 'GET', 'locations/' + batchId);
            if (!batch || !batch.samples) return;

            const decrypted = await Promise.all(
              Object.entries(batch.samples).map(async ([sid, sm]) => {
                const dec = sm && sm._enc ? await decryptSample(env, sm) : sm;
                if (!dec) return null;
                return { lat: +dec.lat, lng: +dec.lng, acc: +dec.acc, at: +dec.at };
              })
            );
            const valid = decrypted.filter(x =>
              x && isFinite(x.lat) && isFinite(x.lng) && isFinite(x.acc) &&
              x.lat >= -90 && x.lat <= 90 && x.lng >= -180 && x.lng <= 180
            );
            if (!valid.length) return;

            let best = valid[0];
            for (const x of valid) if (x.acc < best.acc) best = x;

            results[label] = {
              lat: +(+best.lat).toFixed(7),
              lng: +(+best.lng).toFixed(7),
              acc: Math.round(best.acc),
              at: best.at,
              samples: valid.length
            };
          } catch (e) {
            console.warn('[bulk]', label, e.message);
          }
        }));
      }

      return J({ ok: 1, results, queried: rawLabels.length, found: Object.keys(results).length });
    }

      // ─── 🆕 DELTA SYNC: metadata (cheap, ~20 bytes) ───
    if (a === 'location_meta') {
      // 🔒 Rate limit: 30 consultas/min por IP (permite refreshes normales,
      //    bloquea enumeración agresiva que necesitaría miles/min)
      const rk = 'lm:' + ip;
      const WINDOW_MS = 60 * 1000;
      const MAX_PER_MIN = 30;
       
      try {
        if (env && env.RATE_KV) {
          const v = await env.RATE_KV.get(rk);
          const o = v ? JSON.parse(v) : { n: 0, reset: 0 };
          const now = Date.now();
          if (now > o.reset) { o.n = 0; o.reset = now + WINDOW_MS; }
          if (o.n >= MAX_PER_MIN) return J({ error: 'Demasiadas consultas. Espera un minuto.' }, 429);
          o.n++;
          await env.RATE_KV.put(rk, JSON.stringify(o), { expirationTtl: 60 });
        } else {
          const o = _labelCounter.get(rk) || { n: 0, reset: 0 };
          const now = Date.now();
          if (now > o.reset) { o.n = 0; o.reset = now + WINDOW_MS; }
          if (o.n >= MAX_PER_MIN) return J({ error: 'Demasiadas consultas.' }, 429);
          o.n++;
          _labelCounter.set(rk, o);
        }
      } catch {}

      const rev = +(await db(env, 'GET', '_loc_meta/lastRev')) || 0;
      return new Response(JSON.stringify({ rev }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=10',
          'X-Content-Type-Options': 'nosniff'
        }
      });
    }

       // ─── 🆕 DELTA SYNC: solo lo que cambió desde `since` ───
    if (a === 'location_delta') {
      // 🔒 Rate limit: 30 consultas/min por IP (payload mayor que meta, pero
      //    clientes legítimos lo llaman 1-2 veces por sesión de mapa)
      const rk = 'ld:' + ip;
      const WINDOW_MS = 60 * 1000;
      const MAX_PER_MIN = 30;
      try {
        if (env && env.RATE_KV) {
          const v = await env.RATE_KV.get(rk);
          const o = v ? JSON.parse(v) : { n: 0, reset: 0 };
          const now = Date.now();
          if (now > o.reset) { o.n = 0; o.reset = now + WINDOW_MS; }
          if (o.n >= MAX_PER_MIN) return J({ error: 'Demasiadas consultas. Espera un minuto.' }, 429);
          o.n++;
          await env.RATE_KV.put(rk, JSON.stringify(o), { expirationTtl: 60 });
        } else {
          const o = _labelCounter.get(rk) || { n: 0, reset: 0 };
          const now = Date.now();
          if (now > o.reset) { o.n = 0; o.reset = now + WINDOW_MS; }
          if (o.n >= MAX_PER_MIN) return J({ error: 'Demasiadas consultas.' }, 429);
          o.n++;
          _labelCounter.set(rk, o);
        }
      } catch {}

      const since = +b.since || 0;
      if (!since) return J({ full: true, rev: 0 });
       

      const from = pad15(since + 1);
      let raw;
      try {
        raw = await db(env, 'GET', '_loc_changelog', undefined,
          `orderBy="$key"&startAt="${from}"&`) || {};
      } catch (e) {
        return J({ error: 'No se pudo leer el changelog' }, 500);
      }

      const changes = [];
      for (const k of Object.keys(raw).sort()) {
        const v = raw[k];
        if (v && v.at > since) changes.push(v);
      }

      const MAX = 500;
      const curRev = +(await db(env, 'GET', '_loc_meta/lastRev')) || since;

      if (changes.length > MAX) {
        return J({ full: true, rev: curRev });
      }
      // Si el server avanzó pero el changelog está vacío → fue purgado → full reload
      if (curRev > since && changes.length === 0) {
        return J({ full: true, rev: curRev });
      }

      // Dedupe por batchId (varios samples por batch → 1 sola lectura)
      const batchSet = new Set();
      for (const ch of changes) if (ch.batchId) batchSet.add(ch.batchId);
      const ids = Array.from(batchSet);

      const results = {};
      const PARALLEL = 10;
      for (let i = 0; i < ids.length; i += PARALLEL) {
        const chunk = ids.slice(i, i + PARALLEL);
        await Promise.all(chunk.map(async (batchId) => {
          try {
            const batch = await db(env, 'GET', 'locations/' + batchId);
            if (!batch || !batch.samples) return;

            const decrypted = await Promise.all(
              Object.entries(batch.samples).map(async ([sid, sm]) => {
                const dec = sm && sm._enc ? await decryptSample(env, sm) : sm;
                if (!dec) return null;
                return { lat: +dec.lat, lng: +dec.lng, acc: +dec.acc, at: +dec.at };
              })
            );
            const valid = decrypted.filter(x =>
              x && isFinite(x.lat) && isFinite(x.lng) && isFinite(x.acc) &&
              x.lat >= -90 && x.lat <= 90 && x.lng >= -180 && x.lng <= 180
            );
            if (!valid.length) return;

            let best = valid[0];
            for (const x of valid) if (x.acc < best.acc) best = x;

            const label = batch.label || batchId;
            results[label] = {
              lat: +(+best.lat).toFixed(7),
              lng: +(+best.lng).toFixed(7),
              acc: Math.round(best.acc),
              at: best.at,
              samples: valid.length,
              batchId
            };
          } catch (e) {
            console.warn('[delta]', batchId, e.message);
          }
        }));
      }

      return new Response(
        JSON.stringify({ rev: curRev, changes: results, count: Object.keys(results).length }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-store',
            'X-Content-Type-Options': 'nosniff'
          }
        }
      );
    }

    // ─── ADMIN LOGIN ───
    if (a === 'location_login') {
       const ka = 'la:' + ip;
      if (await isLocked(env, ka)) {
        return J({ error: 'Demasiados intentos. Espera 15 minutos.' }, 429);
      }
      if (!env.ADMIN_PASSWORD) {
        return J({ error: 'ADMIN_PASSWORD no configurado en el servidor' }, 500);
      }
      if (!eq(b.admin, env.ADMIN_PASSWORD)) {
        await bumpFail(env, ka);
        return J({ error: 'Contraseña incorrecta' }, 401);
      }
      await clearFails(env, ka);
      return J({ t: await mint(env), r: 'loc_admin' });
    } 
     
    // ─── SOLO CON TOKEN ───
    const s = await verify(env, b && b.t);
    if (!s) return J({ error: 'Sesión inválida o expirada' }, 401);

    if (a === 'location_list') {
      const all = await db(env, 'GET', 'locations') || {};
      const entries = Object.entries(all).filter(([_, v]) => v && typeof v === 'object');
      entries.sort((x, y) => {
        const ax = (x[1].updatedAt || x[1].createdAt || 0);
        const ay = (y[1].updatedAt || y[1].createdAt || 0);
        return ay - ax;
      });
      const trimmed = entries.slice(0, 300);

      // 🔐 Descifrar muestras en paralelo (AES-GCM)
      const list = await Promise.all(trimmed.map(async ([batchId, batch]) => {
        const samples = batch.samples || {};
        const decrypted = await Promise.all(
          Object.entries(samples).map(async ([sid, sm]) => {
            // Compatibilidad: sm puede ser plain (legacy) o {_enc} (cifrado)
            const dec = sm && sm._enc ? await decryptSample(env, sm) : sm;
            if (!dec) return null;
            return {
              sid,
              lat: +dec.lat,
              lng: +dec.lng,
              acc: +dec.acc,
              at: +dec.at
            };
          })
        );
        const sampleList = decrypted.filter(x =>
          x && isFinite(x.lat) && isFinite(x.lng) && isFinite(x.acc)
        );
        sampleList.sort((x, y) => x.at - y.at);

        let best = null;
        for (const x of sampleList) if (!best || x.acc < best.acc) best = x;

        return {
          batchId,
          label: batch.label || '',
          deviceId: batch.deviceId || '',
          createdAt: batch.createdAt || 0,
          updatedAt: batch.updatedAt || 0,
          ipHash: batch.ipHash || '',
          ua: batch.ua || '',
          sampleCount: sampleList.length,
          samples: sampleList,
          best
        };
      }));

      return J({ ok: 1, locations: list, total: entries.length, shown: list.length });
    }

    if (a === 'location_del') {
      const batchId = clean(b.batchId);
      if (!batchId) return J({ error: 'batchId requerido' }, 400);
      const existing = await db(env, 'GET', 'locations/' + batchId);
      if (!existing) return J({ error: 'No encontrado' }, 404);
      await db(env, 'DELETE', 'locations/' + batchId);
      return J({ ok: 1 });
    }

    return J({ error: 'Acción desconocida' }, 400);
  } catch (e) {
    console.error('[ubicacion]', (e && e.stack) || e);
    return J({ error: 'Error del servidor: ' + ((e && e.message) || e) }, 500);
  }
}
