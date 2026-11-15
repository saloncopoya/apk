/* /api/ocrdb — Admin (ADMIN_PASSWORD) y brigadistas. Firebase RTDB vía service account.
   Env: ADMIN_PASSWORD, FIREBASE_SERVICE_ACCOUNT, CLOUDINARY_CLOUD_NAME/API_KEY/API_SECRET. Reglas RTDB: ".read":false,".write":false */
const DB = 'https://galleros-main-default-rtdb.firebaseio.com';
const enc = new TextEncoder();

const b64u = b => btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const J = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer' } });
const eq = (a, b) => { a = String(a); b = String(b); let d = a.length ^ b.length; for (let i = 0; i < Math.max(a.length, b.length); i++) d |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0); return d === 0; };


// 🔒 Rate limiting persistente por IP+clave usando KV (binding RATE_KV en Cloudflare Pages)
// Fallback a Map local si RATE_KV no está configurado (dev local / tests)
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
  try {
    if (env && env.RATE_KV) await env.RATE_KV.delete('rl:' + k);
  } catch {}
  _localFails.delete(k);
}


const okUrl = (v, env) => !v || v.startsWith(`https://res.cloudinary.com/${env.CLOUDINARY_CLOUD_NAME}/`);
const ucache = new Map();
const clean = s => String(s || '').toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 40);


const LONG = new Set(['enf', 'med', 'notas', 'expl', 'pron', 'plan', 'obs', 'diag', 'fachada']);
// ✅ pick preserva arrays (fachadas[], fotos[]) sin stringificar
const pick = (o, ks) => {
  const r = {};
  for (const k of ks) {
    if (!o || o[k] == null) continue;
    if (Array.isArray(o[k])) {
      // Arrays: máx 30 strings de 500 chars c/u
      r[k] = o[k].filter(x => typeof x === 'string').slice(0, 30).map(x => x.slice(0, 500));
    } else {
      r[k] = String(o[k]).slice(0, LONG.has(k) ? 2000 : 300);
    }
  }
  return r;
};

// Superconjunto de campos que viajan al paciente (para no perder NADA en restore)
const PAC = [
  // Identidad
  'nombre', 'nombreCompleto', 'tipo', 'curp', 'folio', 'numeroIdentificacion',
  'fechaNacimiento', 'estadoNacimiento',
  // Programa / visitas
  'est', 'vf', 'nv', 'ultimaVisita', 'motivo',
  // Domicilio
  'calle', 'numExt', 'numInt', 'mz', 'lt',
  'colonia', 'municipio', 'localidad', 'estado', 'cp',
  'seccion', 'area', 'refs', 'ref1', 'ref2',
  // Contacto
  'tel1', 'tel2',
  // GPS / foto
  'lat', 'lon', 'acc', 'fachada', 'fachadas',
  // Clínicos
  'sexo', 'edad', 'dep', 'ayuda', 'fam', 'comp',
  'diag', 'enf', 'expl', 'med', 'alg', 'notas', 'plan', 'pron',
   // Programación
  'prog_fecha', 'prog_hora', 'prog_by',
  // Campos manuales (que ahora se conservan en el restore)
  'region', 'zona', 'servidor', 'otro',
  // Vínculo catastro
  'casa_id'
];

// Alias por compatibilidad — ahora es igual a PAC (antes filtraba campos)
const DEMO = PAC;


const VIS = ['fecha', 'estado', 'pa', 'fc', 'spo2', 'temp', 'glu', 'peso', 'talla', 'cin', 'bra', 'pan', 'obs', 'foto', 'fotos', 'por_nombre'];

async function hmac(env, d) {
  const k = await crypto.subtle.importKey('raw', enc.encode('s:' + env.ADMIN_PASSWORD), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return b64u(await crypto.subtle.sign('HMAC', k, enc.encode(d)));
}
const sha = async s => b64u(await crypto.subtle.digest('SHA-256', enc.encode(s)));

async function mint(env, o) {
  // 🔒 Token de 8 h (turno de trabajo) + jti aleatorio
  const jti = b64u(crypto.getRandomValues(new Uint8Array(9)));
const p = btoa(JSON.stringify({ ...o, jti, exp: Date.now() + 3 * 24 * 3600e3 }));
  return p + '.' + await hmac(env, p);
}

async function verify(env, t) {
  try {
    const [p, s] = String(t).split('.');
    if (!p || !s || !eq(s, await hmac(env, p))) return null;
    const o = JSON.parse(atob(p));
    return o.exp > Date.now() ? o : null;
  } catch { return null; }
}

let tk = { t: '', e: 0 };
async function gtoken(env) {
  if (tk.t && Date.now() < tk.e) return tk.t;
  const sa = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT), now = Math.floor(Date.now() / 1000);
  const u = b64u(enc.encode(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))) + '.' + b64u(enc.encode(JSON.stringify({
    iss: sa.client_email, scope: 'https://www.googleapis.com/auth/firebase.database https://www.googleapis.com/auth/userinfo.email',
    aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 })));
  const der = Uint8Array.from(atob(sa.private_key.replace(/-----[A-Z ]+-----/g, '').replace(/\s/g, '')), c => c.charCodeAt(0));
  const key = await crypto.subtle.importKey('pkcs8', der, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const sig = b64u(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, enc.encode(u)));
  const r = await (await fetch('https://oauth2.googleapis.com/token', { method: 'POST',
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: u + '.' + sig }) })).json();
  tk = { t: r.access_token, e: Date.now() + 3300e3 };
  return tk.t;
}
async function db(env, m, p, body, q = '') {
  const r = await fetch(`${DB}/ocr/${p}.json?${q}access_token=${await gtoken(env)}`, { method: m, body: body === undefined ? undefined : JSON.stringify(body) });
  if (!r.ok) throw new Error('Firebase ' + r.status);
  return r.json();
}

/* 🆕 dbMulti: hace UN SOLO PATCH atómico con múltiples paths relativos a /ocr.
   Reemplaza N requests secuenciales por 1 sola operación.
   Uso:  dbMulti(env, { 'catcas/base/cid1': null, 'pac/base/pid1/casa_id': '', ... })
   ⚠️  Firebase limita el body a 16 MB → máximo ~50k paths por llamada. De sobra. */
async function dbMulti(env, updates) {
  if (!updates || typeof updates !== 'object') throw new Error('dbMulti: updates inválido');
  const keys = Object.keys(updates);
  if (!keys.length) return { ok: 1, empty: true };
  const r = await fetch(`${DB}/ocr.json?access_token=${await gtoken(env)}`, {
    method: 'PATCH',
    body: JSON.stringify(updates)
  });
  if (!r.ok) throw new Error('Firebase multi ' + r.status);
  return r.json();
}


function fnv(s) { let h = 2166136261; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36); }
const norm = s => String(s || '').toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();


// 🆕 helpers para delta sync
const pad15 = n => String(n).padStart(15, '0');
async function logChange(env, base, entry) {
  // 🔧 1 sola operación atómica (dbMulti) en lugar de ~5 GETs+PUTs.
  //    - Date.now() es monotónico en ms; dos writes en el MISMO ms comparten ts
  //      y la segunda sobrescribe la entrada (idempotente en la práctica, no se pierde dato).
  //    - _lastRev avanza con el mismo ts, así pacs_delta ve el cambio.
  //    Ahorro típico: 5 ops → 1 op por cada pac_patch/visit_save.
  const ts = Date.now();
  const key = pad15(ts);
  const updates = {};
  updates[`_changelog/${base}/${key}`] = { ...entry, at: ts };
  updates[`meta/${base}/_lastRev`] = ts;

  try {
    await dbMulti(env, updates);
    return ts;
  } catch (e) {
    // Fallback: si falla el PATCH, usar PUT individuales (mismo efecto, más lento)
    console.warn('[logChange] dbMulti falló, fallback:', e.message);
    await db(env, 'PUT', `_changelog/${base}/${key}`, { ...entry, at: ts });
    await db(env, 'PUT', `meta/${base}/_lastRev`, ts);
    return ts;
  }
}


export async function onRequestPost({ request, env }) {
  try {
    const org = request.headers.get('Origin');
    if (org && new URL(org).host !== new URL(request.url).host) return J({ error: 'Origen no permitido' }, 403);
    if (+request.headers.get('Content-Length') > 12e6) return J({ error: 'Solicitud demasiado grande' }, 413);
    const ip = request.headers.get('CF-Connecting-IP') || 'x';
    const b = await request.json(), a = b.a;
    if (a === 'login') {

       if (b.admin !== undefined) {
  const ka = 'a:' + ip;
  if (await isLocked(env, ka)) return J({ error: 'Demasiados intentos. Espera 15 minutos.' }, 429);
  if (!env.ADMIN_PASSWORD || !eq(b.admin, env.ADMIN_PASSWORD)) {
    await bumpFail(env, ka);
    return J({ error: 'Contraseña incorrecta' }, 401);
  }
  await clearFails(env, ka);
  return J({ t: await mint(env, { r: 'admin' }), r: 'admin' });
}
       
      const u = clean(b.u), ku = 'u:' + ip + ':' + u;
      if (await isLocked(env, ku)) return J({ error: 'Demasiados intentos. Espera 15 minutos.' }, 429);
      const rec = u && await db(env, 'GET', 'users/' + u);
      const hh = await sha((rec && rec.salt || 'x') + String(b.p));
      if (!rec || !eq(rec.hash, hh)) { await bumpFail(env, ku); return J({ error: 'Usuario o contraseña incorrectos' }, 401); }
      await clearFails(env, ku);
      return J({ t: await mint(env, { r: 'user', u, b: rec.base, name: rec.name || u }), r: 'user', u, name: rec.name || u, base: rec.base });
    }
     
    const s = await verify(env, b.t);
    if (!s) return J({ error: 'Sesión inválida' }, 401);


     const adm = s.r === 'admin';

     
// ═══════════════════════════════════════════════════════════════
// 🔒 LOCKOUT en pin_check y pin_check_ocr
// ═══════════════════════════════════════════════════════════════
if (a === 'pin_check' || a === 'pin_check_ocr') {
  const envVar = a === 'pin_check' ? 'PIN_APP' : 'PIN_OCR';
  if (!env[envVar]) return J({ error: envVar + ' no configurado en el servidor' }, 500);
  const k = 'pin:' + a + ':' + ip;
  if (await isLocked(env, k)) return J({ error: 'Demasiados intentos de PIN. Espera 15 minutos.' }, 429);
  if (eq(b.pin, env[envVar])) { await clearFails(env, k); return J({ ok: 1 }); }
  await bumpFail(env, k);
  return J({ error: 'PIN incorrecto' }, 401);
}

// ═══════════════════════════════════════════════════════════════
// 🆕 AUDITORÍA DE DISPOSITIVOS
// ═══════════════════════════════════════════════════════════════

// device_register — sin sesión requerida, usa el token de login recién creado
// device_register
if (a === 'device_register') {
  const devId = clean(b.deviceId).slice(0, 64);
  if (!devId) return J({ error: 'deviceId requerido' }, 400);

  // 🆕 Solo admin puede registrar para otro user; regular siempre usa su propio s.u
  const username = adm ? (clean(b.username) || s.u || 'anon')
                       : (s.u || 'anon');
  const devPath = `audit/devices/${username}/${devId}`;

  const existing = await db(env, 'GET', devPath) || {};
  const upd = {
    brand:    String(b.brand    || '').slice(0, 40),
    model:    String(b.model    || '').slice(0, 40),
    platform: String(b.platform || '').slice(0, 40),
    ua:       String(b.ua       || '').slice(0, 300),
    firstSeen: existing.firstSeen || Date.now(),
    lastSeen:  Date.now(),
    blocked:   existing.blocked === true,   // ✅ preservado
    blockedAt: existing.blockedAt || null,
    blockedBy: existing.blockedBy || null,
  };
  await db(env, 'PUT', devPath, upd);
  return J({ ok: 1, blocked: upd.blocked });
}

// device_check
if (a === 'device_check') {
  const devId = clean(b.deviceId).slice(0, 64);
  if (!devId) return J({ error: 'deviceId requerido' }, 400);

  const username = adm ? (clean(b.username) || s.u || 'anon')
                       : (s.u || 'anon');
  const devPath = `audit/devices/${username}/${devId}`;

  const existing = await db(env, 'GET', devPath);
  if (!existing) return J({ ok: 1, exists: false, blocked: false });
  try { await db(env, 'PATCH', devPath, { lastSeen: Date.now() }); } catch(e){}
  return J({ ok: 1, exists: true, blocked: existing.blocked === true });
}

// ── A partir de aquí: solo admin ───────────────────────────────
if (adm) {
  if (a === 'device_list') {
    const username = clean(b.username || '').slice(0, 60);
    if (!username) return J({ error: 'username requerido' }, 400);
    const all = await db(env, 'GET', `audit/devices/${username}`) || {};
    return J({ devices: all });
  }

  if (a === 'device_set_blocked') {
    const username = clean(b.username || '').slice(0, 60);
    const devId    = clean(b.deviceId  || '').slice(0, 64);
    const val      = b.blocked === true;
    if (!username || !devId) return J({ error: 'username + deviceId requeridos' }, 400);
    const upd = {
      blocked:   val,
      blockedAt: val ? Date.now() : null,
      blockedBy: val ? 'admin' : null,
      pinResetAt: val ? Date.now() : null,
    };
    await db(env, 'PATCH', `audit/devices/${username}/${devId}`, upd);
    return J({ ok: 1 });
  }

  if (a === 'device_force_reenroll') {
    const username = clean(b.username || '').slice(0, 60);
    const devId    = clean(b.deviceId  || '').slice(0, 64);
    if (!username || !devId) return J({ error: 'faltan datos' }, 400);
    await db(env, 'PATCH', `audit/devices/${username}/${devId}`, {
      blocked: true,
      pinResetAt: Date.now(),
      forceReenroll: true,
    });
    return J({ ok: 1 });
  }
}

     
     
    if (!adm) { // el usuario debe seguir existiendo y con la misma base
      const c = ucache.get(s.u);
      if (!c || Date.now() > c.e) { const r = await db(env, 'GET', 'users/' + s.u); ucache.set(s.u, { b: r && r.base, e: Date.now() + 60e3 }); }
      if (ucache.get(s.u).b !== s.b) return J({ error: 'Sesión inválida' }, 401);
    }
    const base = adm ? clean(b.base) : s.b;

    if (adm) {
if (a === 'bases') {
  const meta = await db(env, 'GET', 'meta') || {};
  const basesOut = {};   // ← renombrar
  for (const [k, v] of Object.entries(meta)) if (v && typeof v === 'object') basesOut[k] = v;
  return J({ bases: basesOut });
}
       

             if (a === 'base_save') {
  const id = clean(b.id); if (!id || !Array.isArray(b.records)) return J({ error: 'Datos inválidos' }, 400);

  const isFullReset = b.mode !== 'merge';

  // 🛑 1) Un reemplazo total DEBE ser explícito para no perder datos por accidente
  if (isFullReset && b.confirmFullReset !== true && b.force !== true) {
    return J({ error: 'Modo reemplazo requiere confirmFullReset=true' }, 400);
  }

  // 🛑 2) Bloqueo anti-pérdida: rechaza reemplazo si reduce el set a <90%
  if (isFullReset && b.force !== true) {
    const shallow = await db(env, 'GET', 'pac/' + id, undefined, 'shallow=true&') || {};
    const currentCount = Object.keys(shallow).length;
    if (currentCount > 0 && b.records.length < currentCount * 0.9) {
      return J({
        error: `Rechazado: intentas reemplazar ${currentCount} pacientes con ${b.records.length} (<90%). Usa mode:'merge' o envía force:true.`,
        currentCount, newCount: b.records.length
      }, 409);
    }
  }

  // 🔧 Marca de mantenimiento: clientes con delta saben que deben hacer full reload
  //    (evita aplicar deltas sobre un estado mixto durante el reset)
  let _maintStart = 0;
  if (isFullReset) {
    _maintStart = Date.now();
    try { await db(env, 'PUT', `meta/${id}/_maint`, _maintStart); } catch {}
  }

  // Normalizar registros y PIDs (SIEMPRE minúsculas para consistencia con clean())
  const items = [];
  for (const r of b.records) {
    const d = pick({ ...r, nombre: r.nombreCompleto }, DEMO);
    if (d.ultimaVisita == null) d.ultimaVisita = 'SN';
    const originalPid = r && r._pid ? String(r._pid).trim() : '';
    const validPid = /^p[a-z0-9_]{3,40}$/i.test(originalPid);
    const pid = validPid
                ? originalPid.toLowerCase()
                : 'p' + fnv(norm(d.nombre) + '|' + norm(d.calle) + '|' + norm(d.numExt));
    items.push({ pid, d });
  }

  // 🔧 Escritura en chunks (400 regs/lote) — evita OOM con 20 000 pacientes
  const CHUNK = 400;
  let buf = {}, bufCount = 0;

  for (const { pid, d } of items) {
    if (b.mode === 'merge') {
      for (const k in d) buf[pid + '/' + k] = d[k];
    } else {
      buf[pid] = d;
    }
    if (++bufCount >= CHUNK) {
      await db(env, 'PATCH', 'pac/' + id, buf);
      buf = {}; bufCount = 0;
    }
  }
  if (bufCount > 0) await db(env, 'PATCH', 'pac/' + id, buf);

  // 🔧 En full reset: borrar los PIDs viejos que ya no están en el nuevo set
  if (isFullReset) {
    const newPidSet = new Set(items.map(i => i.pid));
    const currentShallow = await db(env, 'GET', 'pac/' + id, undefined, 'shallow=true&') || {};
    const toDelete = Object.keys(currentShallow).filter(k => !newPidSet.has(k));
    for (let i = 0; i < toDelete.length; i += CHUNK) {
      const delBatch = {};
      for (const pid of toDelete.slice(i, i + CHUNK)) delBatch[pid] = null;
      await db(env, 'PATCH', 'pac/' + id, delBatch);
    }
  }

  // 🔧 Guardar texto OCR crudo (solo si el frontend lo envía)
  if (Array.isArray(b.texts) && b.texts.length) {
    const txt = {};
    b.texts.forEach((t, i) => {
      if (t && t.text) txt['t' + i] = {
        name: String(t.name || '').slice(0, 200),
        text: String(t.text).slice(0, 100000),
        at: Date.now()
      };
    });
    if (Object.keys(txt).length) await db(env, 'PUT', 'texts/' + id, txt);
  }

  const n = Object.keys(await db(env, 'GET', 'pac/' + id, undefined, 'shallow=true&') || {}).length;
  const rev = Date.now();

  // Purgar changelog (replace total) o limpiar >30 días (merge)
  if (b.mode !== 'merge') {
    try {
      const all = await db(env, 'GET', `_changelog/${id}`) || {};
      for (const k of Object.keys(all)) await db(env, 'DELETE', `_changelog/${id}/${k}`);
    } catch(e) { console.warn('changelog purge', e); }
  } else {
    try {
      const cutoff = pad15(rev - 30 * 24 * 3600e3);
      const old = await db(env, 'GET', `_changelog/${id}`, undefined,
        `orderBy="$key"&endAt="${cutoff}"&`) || {};
      for (const k of Object.keys(old)) await db(env, 'DELETE', `_changelog/${id}/${k}`);
    } catch(e) { console.warn('changelog cleanup', e); }
  }

  // 🆕 Marca de "última escritura masiva" → clientes con `since < _lastFullSave`
  //    harán full reload en el próximo delta (evita desincronización silenciosa).
  await db(env, 'PUT', 'meta/' + id, {
    name: String(b.name || id).slice(0, 80),
    n, at: rev, _lastRev: rev,
    _lastFullSave: rev
  });
  // 🔧 Borrar flag de mantenimiento
  if (isFullReset) {
    try { await db(env, 'DELETE', `meta/${id}/_maint`); } catch {}
  }
  return J({ ok: 1, n, rev });
}

       
      if (a === 'base_del') {
  if (!base || base.length < 3) return J({ error: 'base inválida' }, 400);
  if (!await db(env, 'GET', 'meta/' + base)) return J({ error: 'base no existe' }, 404);
  await db(env, 'DELETE', 'pac/' + base);
  await db(env, 'DELETE', 'meta/' + base);
  await db(env, 'DELETE', 'texts/' + base);
  // 🆕 Limpiar catastro y changelog (antes quedaban huérfanos)
  try { await db(env, 'DELETE', 'catman/' + base); } catch(e){}
  try { await db(env, 'DELETE', 'catcas/' + base); } catch(e){}
  try { await db(env, 'DELETE', '_changelog/' + base); } catch(e){}
  const us = await db(env, 'GET', 'users') || {};
  for (const u in us) if (us[u].base === base) await db(env, 'DELETE', 'users/' + u);
  return J({ ok: 1 });
}
       
     if (a === 'users') {
  const us = await db(env, 'GET', 'users') || {};
  return J({ users: Object.entries(us)
    .filter(([_, v]) => v && typeof v === 'object')
    .map(([u, v]) => ({ u, name: v.name || u, base: v.base || '' })) });
}

       
      if (a === 'user_save') {
        const u = clean(b.u);
        const baseId = clean(b.base);
        if (!u || !baseId) return J({ error: 'Usuario/base requeridos' }, 400);

        // 🔧 Validar que la base existe
        const baseMeta = await db(env, 'GET', 'meta/' + baseId);
        if (!baseMeta) return J({ error: 'Base no existe: ' + baseId }, 404);

        const d = { name: String((b && b.name) || u).slice(0, 60), base: baseId };
        if (b.p) {
          d.salt = b64u(crypto.getRandomValues(new Uint8Array(12)));
          d.hash = await sha(d.salt + String(b.p));
        } else if (!await db(env, 'GET', 'users/' + u)) {
          return J({ error: 'Contraseña requerida' }, 400);
        }
        await db(env, 'PATCH', 'users/' + u, d);
        return J({ ok: 1 });
      }
       
      if (a === 'user_del') { await db(env, 'DELETE', 'users/' + clean(b.u)); return J({ ok: 1 }); }

             if (a === 'pac_del') {
        const pid = clean(b.pid);
        if (!pid || pid.length < 4) return J({ error: 'pid inválido' }, 400);

        // 🆕 Validar que el paciente exista antes de borrar (evita changelog basura)
        const exists = await db(env, 'GET', `pac/${base}/${pid}/nombre`);
        if (!exists) return J({ error: 'Paciente no encontrado' }, 404);

        // 🔧 1) Desvincular del catastro ANTES de borrar (usa backref casa_id)
        try {
          const casaId = await db(env, 'GET', `pac/${base}/${pid}/casa_id`);
          if (casaId && typeof casaId === 'string') {
            const cid = casaId.replace(/[^a-zA-Z0-9_]/g, '').slice(0, 60);
            if (cid) {
              const casa = await db(env, 'GET', `catcas/${base}/${cid}`);
              if (casa) {
                await db(env, 'PATCH', `catcas/${base}/${cid}/pacientes`, { [pid]: null });
                if (casa.paciente_id === pid) {
                  await db(env, 'PATCH', `catcas/${base}/${cid}`, { paciente_id: '' });
                }
              }
            }
          }
        } catch(e) { console.warn('pac_del catastro cleanup', e); }

        // 🔧 2) Borrar paciente
        await db(env, 'DELETE', `pac/${base}/${pid}`);
        const rev = await logChange(env, base, { pid, kind: 'pac', action: 'del' });
        return J({ ok: 1, rev });
      }
       
    }
    if (!base) return J({ error: 'Sin base asignada' }, 400);
         if (a === 'visit_del') {
      const pid = clean(b.pid);
      const vid = clean(b.vid);
      if (!pid || !vid) return J({ error: 'Datos inválidos' }, 400);
      const existe = await db(env, 'GET', `pac/${base}/${pid}/nombre`);
      if (!existe) return J({ error: 'Paciente no encontrado' }, 404);
      await db(env, 'DELETE', `pac/${base}/${pid}/vis/${vid}`);
      const rev = await logChange(env, base, { pid, kind: 'visit', action: 'del', vid });
      return J({ ok: 1, rev });
    }
    if (a === 'csign') {
      const ts = Math.floor(Date.now() / 1000), folder = 'ocr/' + base;
      const h = [...new Uint8Array(await crypto.subtle.digest('SHA-1', enc.encode(`folder=${folder}&timestamp=${ts}${env.CLOUDINARY_API_SECRET}`)))].map(x => x.toString(16).padStart(2, '0')).join('');
      return J({ ts, folder, sig: h, key: env.CLOUDINARY_API_KEY, cloud: env.CLOUDINARY_CLOUD_NAME });
    }

               if (a === 'pacs') {
      // 🔧 Paginación por $key — el cliente itera con startAt hasta nextPage === null
      const limit = Math.min(Math.max(+b.limit || 2000, 100), 3000);
      const startAt = b.startAt ? String(b.startAt).replace(/[^a-zA-Z0-9_]/g, '').slice(0, 60) : '';
      // Pedimos limit+1 para saber si hay siguiente página
      const q = `orderBy="$key"&limitToFirst=${limit + 1}&${startAt ? 'startAt="' + startAt + '"&' : ''}`;
      const raw = await db(env, 'GET', 'pac/' + base, undefined, q) || {};
      // ✅ CORRECCIÓN: capturar el conteo ANTES de borrar el duplicado de startAt
      const rawCount = Object.keys(raw).length;
      // startAt es inclusivo en RTDB → la primera key viene duplicada; la descartamos
      if (startAt && raw[startAt] !== undefined) delete raw[startAt];
      const keys = Object.keys(raw).sort();
      // ✅ CORRECCIÓN: hasNext se basa en el conteo ORIGINAL (antes del delete)
      const hasNext = rawCount > limit;
      const pageKeys = hasNext ? keys.slice(0, limit) : keys;
      const pac = {};
      for (const k of pageKeys) pac[k] = raw[k];
      const nextPage = hasNext ? pageKeys[pageKeys.length - 1] : null;

      const meta = await db(env, 'GET', 'meta/' + base) || {};
      let rev = meta._lastRev;
      if (!rev) {
        rev = Date.now();
        try { await db(env, 'PUT', `meta/${base}/_lastRev`, rev); } catch {}
      }
      return J({ pac, base, rev, nextPage, pageSize: pageKeys.length });
    }
     

    // 🆕 pregunta liviana: solo dice la rev actual
    if (a === 'pacs_meta') {
      const meta = await db(env, 'GET', 'meta/' + base) || {};
      return J({ rev: meta._lastRev || 0 });
    }

    // 🆕 delta: devuelve SOLO lo que cambió desde "since"
    if (a === 'pacs_delta') {
      // 🔧 _maint SOLO es válido durante 5 minutos. Si tiene más → proceso colgado → ignorar.
      const maint = await db(env, 'GET', `meta/${base}/_maint`);
      if (maint) {
        const ageMs = Date.now() - (+maint || 0);
        if (ageMs < 5 * 60e3) {
          return J({ full: true, maintenance: true, rev: 0 });
        }
        // 🆕 Stale (>5 min): borrar y continuar
        try { await db(env, 'DELETE', `meta/${base}/_maint`); } catch {}
      }

      const since = +b.since || 0;
      if (!since) return J({ full: true, rev: 0 }); // sin rev → forzar full

      // 🆕 Si hubo base_save (merge o reset) después de "since" → forzar full reload
      const lastFullSave = +(await db(env, 'GET', `meta/${base}/_lastFullSave`)) || 0;
      if (lastFullSave && since < lastFullSave) {
        return J({ full: true, rev: lastFullSave });
      }
       
      const from = pad15(since + 1);
      const raw = await db(env, 'GET', `_changelog/${base}`, undefined,
        `orderBy="$key"&startAt="${from}"&`) || {};
      const changes = [];
      for (const k of Object.keys(raw).sort()) {
        const v = raw[k];
        if (v && v.at > since) changes.push(v);
      }
      const MAX = 500;
      if (changes.length > MAX) {
        return J({ full: true, rev: (await db(env, 'GET', `meta/${base}/_lastRev`)) || 0 });
      }
      const meta = await db(env, 'GET', 'meta/' + base) || {};
      const curRev = meta._lastRev || since;

      // 🆕 Si el server avanzó pero no hay ningún cambio en el rango,
      // significa que el changelog fue purgado (base_save PUT o cleanup agresivo)
      // → el cliente DEBE hacer full reload para no quedar desactualizado.
      if (curRev > since && changes.length === 0) {
        return J({ full: true, rev: curRev });
      }

      return J({ changes, rev: curRev });
    }
     
    if (a === 'audit') { await db(env, 'PUT', 'log/' + Date.now() + '_' + clean(s.u || 'admin'), { u: s.u || 'admin', act: String(b.act || '').slice(0, 40), n: +b.n || 0, base }); return J({ ok: 1 }); }

    // ═══════════════════════════════════════════════════════════════
    // 🏘️ CATASTRO · Manzanas y Casas (sincronizado entre brigadistas)
    // ═══════════════════════════════════════════════════════════════

    // GET · descargar todo el catastro de la base
    if (a === 'cat_get') {
      // 🔧 Manzanas: pocas cientos, se devuelven enteras siempre
      const manzanas = await db(env, 'GET', 'catman/' + base) || {};
      // 🔧 Casas: paginadas por $key (pueden ser decenas de miles)
      const limit = Math.min(Math.max(+b.casasLimit || 2000, 100), 3000);
      const startAt = b.casasStartAt ? String(b.casasStartAt).replace(/[^a-zA-Z0-9_]/g, '').slice(0, 60) : '';
      const q = `orderBy="$key"&limitToFirst=${limit + 1}&${startAt ? 'startAt="' + startAt + '"&' : ''}`;
      const rawCasas = await db(env, 'GET', 'catcas/' + base, undefined, q) || {};
      // ✅ CORRECCIÓN: capturar el conteo ANTES de borrar el duplicado
      const rawCount = Object.keys(rawCasas).length;
      if (startAt && rawCasas[startAt] !== undefined) delete rawCasas[startAt];
      const casaKeys = Object.keys(rawCasas).sort();
      // ✅ CORRECCIÓN: hasNext basado en el conteo original
      const hasNext = rawCount > limit;
      const pageKeys = hasNext ? casaKeys.slice(0, limit) : casaKeys;
      const casas = {};
      for (const k of pageKeys) casas[k] = rawCasas[k];
      const casasNextPage = hasNext ? pageKeys[pageKeys.length - 1] : null;
      return J({ manzanas, casas, casasNextPage, casasPageSize: pageKeys.length });
    }
    // SAVE MANZANA · crear o actualizar (y migrar casas hijas si cambia ID)
    if (a === 'cat_save_manzana') {
      const m = b.m;
      if (!m || !m.id || !m.colonia || !m.manzana) return J({ error: 'Datos de manzana incompletos' }, 400);
      const cleanId = s => String(s || '').toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 60);

      const rawIdNuevo = String(m.id || '');
      const rawIdViejo = String(b.idViejo || m.id || '');
      const idNuevo = cleanId(rawIdNuevo);
      const idViejo = cleanId(rawIdViejo);
      if (!idNuevo) return J({ error: 'ID de manzana inválido' }, 400);

      if (idViejo !== idNuevo) {
        /* 🆕 FAST PATH: cliente envía repointedCasas + patientRepoint.
           Hacemos 1 solo multi-path PATCH atómico en lugar de GET grande + loop.
           El cliente ya regeneró los id_unico_casa (determinísticos) y nos los pasa. */
        if (Array.isArray(b.repointedCasas)) {
          const updates = {};
          const now = Date.now();

          // Borrar manzana vieja
          updates[`catman/${base}/${idViejo}`] = null;

          // Re-apuntar cada casa al nuevo id_padre (y regenerar id si cambió)
          for (const r of b.repointedCasas) {
            if (!r) continue;
            const oldCid = cleanId(r.oldId);
            const newCid = cleanId(r.newId);
            if (!oldCid || !newCid) continue;

            // Si el id cambió, borrar el viejo
            if (oldCid !== newCid) {
              updates[`catcas/${base}/${oldCid}`] = null;
            }

            // Normalizar pacientes {pid: true}
            const pacientesObj = {};
            const src = r.casa && r.casa.pacientes;
            if (src && typeof src === 'object') {
              for (const pid of Object.keys(src)) {
                if (src[pid] && String(pid).length >= 4) pacientesObj[String(pid)] = true;
              }
            }
            // Compat legacy paciente_id
            const legacyPid = (r.casa && r.casa.paciente_id) || '';
            if (legacyPid && String(legacyPid).length >= 4) pacientesObj[String(legacyPid)] = true;

            updates[`catcas/${base}/${newCid}`] = {
              id_unico_casa: newCid,
              tipo: 'casa',
              id_padre: idNuevo,
              noExterior: String((r.casa && r.casa.noExterior) || r.noExterior || '').slice(0, 20),
              lat: +((r.casa && r.casa.lat) || r.lat) || 0,
              lng: +((r.casa && r.casa.lng) || r.lng) || 0,
              pacientes: pacientesObj,
              paciente_id: legacyPid,
              createdAt: (r.casa && r.casa.createdAt) || now,
              updatedAt: now
            };
          }

          // Re-apuntar pacientes al nuevo casa_id
          if (Array.isArray(b.patientRepoint)) {
            for (const pr of b.patientRepoint) {
              if (!pr) continue;
              const pid = clean(pr.pid);
              const newCid = cleanId(pr.newCasaId);
              if (pid && newCid) updates[`pac/${base}/${pid}/casa_id`] = newCid;
            }
          }

          await dbMulti(env, updates);
          console.log(`[cat_save_manzana] fast path: ${b.repointedCasas.length} casas re-apuntadas`);
        } else {
          /* 🐌 FALLBACK: cliente viejo sin repointedCasas. */
          console.warn('[cat_save_manzana] slow path (cliente sin repointedCasas)');
          const casas = await db(env, 'GET', 'catcas/' + base) || {};
          for (const [cid, c] of Object.entries(casas)) {
            if (c.id_padre === idViejo) {
              await db(env, 'PATCH', `catcas/${base}/${cid}`, { id_padre: idNuevo, updatedAt: Date.now() });
            }
          }
          await db(env, 'DELETE', `catman/${base}/${idViejo}`);
        }
      }

      // PUT final de la manzana (crea nueva o actualiza existente)
      const upd = {
        id: idNuevo,
        tipo: 'manzana',
        colonia: String(m.colonia).slice(0, 80),
        seccion: String(m.seccion || '').slice(0, 20),
        area: String(m.area || '').slice(0, 20),
        manzana: String(m.manzana).slice(0, 20),
        lat: +m.lat || 0,
        lng: +m.lng || 0,
        createdAt: m.createdAt || Date.now(),
        updatedAt: Date.now()
      };
      await db(env, 'PUT', `catman/${base}/${idNuevo}`, upd);
      return J({ ok: 1, id: idNuevo, fast: idViejo !== idNuevo && Array.isArray(b.repointedCasas) ? 1 : 0 });
    }

    // DELETE MANZANA · borrar manzana y TODAS sus casas hijas
    if (a === 'cat_del_manzana') {
      const id = clean(b.id);
      if (!id) return J({ error: 'ID requerido' }, 400);

      /* 🆕 FAST PATH: si el cliente envía casaIds + patientIds, hacemos
         1 solo multi-path PATCH atómico. Sin GETs grandes, sin loops.
         Es el camino normal en clientes nuevos (~300ms vs ~15-30s). */
      if (Array.isArray(b.casaIds) && Array.isArray(b.patientIds)) {
        const updates = {};
        // Borrar casas (1 path por casa)
        for (const cidRaw of b.casaIds) {
          const cid = clean(cidRaw);
          if (cid) updates[`catcas/${base}/${cid}`] = null;
        }
        // Desvincular pacientes (1 path por paciente)
        for (const pidRaw of b.patientIds) {
          const pid = clean(pidRaw);
          if (pid) updates[`pac/${base}/${pid}/casa_id`] = '';
        }
        // Borrar manzana
        updates[`catman/${base}/${id}`] = null;

        await dbMulti(env, updates);
        console.log(`[cat_del_manzana] fast path: ${b.casaIds.length} casas, ${b.patientIds.length} pacientes`);
        return J({ ok: 1, fast: 1, casas: b.casaIds.length, pacientes: b.patientIds.length });
      }

      /* 🐌 FALLBACK: cliente viejo sin casaIds/patientIds.
         Mantiene el comportamiento original para no romper nada. */
      console.warn('[cat_del_manzana] slow path (cliente sin casaIds/patientIds)');
      const shallowPac = await db(env, 'GET', 'pac/' + base, undefined, 'shallow=true&') || {};

      const casas = await db(env, 'GET', 'catcas/' + base) || {};
      for (const [cid, c] of Object.entries(casas)) {
        if (c.id_padre === id) {
          const pids = new Set();
          if (c.paciente_id) pids.add(String(c.paciente_id));
          if (c.pacientes && typeof c.pacientes === 'object') {
            for (const pid of Object.keys(c.pacientes)) {
              if (c.pacientes[pid]) pids.add(String(pid));
            }
          }
          for (const pid of pids) {
            try { if (shallowPac[pid]) await db(env, 'PATCH', `pac/${base}/${pid}`, { casa_id: '' }); } catch(e){}
          }
          await db(env, 'DELETE', `catcas/${base}/${cid}`);
        }
      }
      await db(env, 'DELETE', `catman/${base}/${id}`);
      return J({ ok: 1, fast: 0 });
    }

     

    // SAVE CASA · crear o actualizar (MULTI-PACIENTE)
    if (a === 'cat_save_casa') {
      const c = b.c;
      if (!c || !c.id_unico_casa || !c.id_padre || !c.noExterior) {
        return J({ error: 'Datos de casa incompletos' }, 400);
      }
      const cleanId = s => String(s || '').toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 60);
      const rawIdNuevo = String(c.id_unico_casa || '');
      const rawIdViejo = String(b.idViejo || c.id_unico_casa || '');
      const idNuevo = cleanId(rawIdNuevo);
      const idViejo = cleanId(rawIdViejo);
      const idPadre = cleanId(c.id_padre);
      if (!idNuevo || !idPadre) return J({ error: 'ID de casa/manzana inválido' }, 400);

      if (idNuevo !== rawIdNuevo) {
        return J({ error: 'id_unico_casa debe ser solo [a-zA-Z0-9_], máx 60 chars. Recibido: ' + rawIdNuevo.slice(0, 20) }, 400);
      }
      if (b.idViejo && idViejo !== rawIdViejo) {
        return J({ error: 'idViejo debe ser solo [a-zA-Z0-9_]. Recibido: ' + rawIdViejo.slice(0, 20) }, 400);
      }

      // Normalizar objeto pacientes (Firebase-safe: {pid: true})
      let pacientesObj = {};
      const pushPid = (pid) => {
        const s = String(pid || '').trim();
        if (s.length >= 4 && s.length <= 80) pacientesObj[s] = true;
      };
      if (c.paciente_id) pushPid(c.paciente_id);
      if (c.pacientes && typeof c.pacientes === 'object') {
        for (const pid of Object.keys(c.pacientes)) {
          if (c.pacientes[pid]) pushPid(pid);
        }
      }

      const upd = {
        id_unico_casa: idNuevo,
        tipo: 'casa',
        id_padre: idPadre,
        noExterior: String(c.noExterior).slice(0, 20),
        lat: +c.lat || 0,
        lng: +c.lng || 0,
        pacientes: pacientesObj,
        paciente_id: c.paciente_id || '',
        createdAt: c.createdAt || Date.now(),
        updatedAt: Date.now()
      };

      /* 🆕 FAST PATH: si el cliente envió patientIds y cambió el idViejo,
         hacemos 1 solo multi-path PATCH atómico:
           DELETE catcas/{idViejo}
           PUT    catcas/{idNuevo}
           pac/{pid}/casa_id = idNuevo  (para cada pid)
         Antes: 1 DELETE + 1 PUT + N pac_patch = race conditions.
         Ahora: 1 request atómico (~300 ms). */
      if (b.idViejo && idViejo !== idNuevo && Array.isArray(b.patientIds)) {
        const updates = {};
        updates[`catcas/${base}/${idViejo}`] = null;
        updates[`catcas/${base}/${idNuevo}`] = upd;
        for (const pidRaw of b.patientIds) {
          const pid = clean(pidRaw);
          if (pid) updates[`pac/${base}/${pid}/casa_id`] = idNuevo;
        }
        await dbMulti(env, updates);
        console.log(`[cat_save_casa] fast path: renombró ${idViejo} → ${idNuevo}, ${b.patientIds.length} pacientes re-apuntados`);
        return J({ ok: 1, id: idNuevo, fast: 1 });
      }

      // ── Fallback: cliente viejo sin patientIds (comportamiento original) ──
      if (b.idViejo && idViejo !== idNuevo) {
        await db(env, 'DELETE', `catcas/${base}/${idViejo}`);
      }
      await db(env, 'PUT', `catcas/${base}/${idNuevo}`, upd);
      return J({ ok: 1, id: idNuevo });
    }
     
    // DELETE CASA · borrar casa individual
    if (a === 'cat_del_casa') {
      const id = clean(b.id);
      if (!id) return J({ error: 'ID requerido' }, 400);

      /* 🆕 FAST PATH: si el cliente envía patientIds, hacemos
         1 solo multi-path PATCH atómico (dbMulti).
         Antes: GET shallow de TODOS los pacientes (~200-500 KB) + N PATCHes.
         Ahora: 1 request atómico (~300ms). */
      if (Array.isArray(b.patientIds)) {
        const updates = {};
        updates[`catcas/${base}/${id}`] = null;
        for (const pidRaw of b.patientIds) {
          const pid = clean(pidRaw);
          if (pid) updates[`pac/${base}/${pid}/casa_id`] = '';
        }
        await dbMulti(env, updates);
        console.log(`[cat_del_casa] fast path: ${b.patientIds.length} pacientes`);
        return J({ ok: 1, fast: 1, pacientes: b.patientIds.length });
      }

      /* 🐌 FALLBACK: cliente viejo sin patientIds — comportamiento original. */
      console.warn('[cat_del_casa] slow path (cliente sin patientIds)');
      const casa = await db(env, 'GET', `catcas/${base}/${id}`);
      if (casa) {
        const shallowPac = await db(env, 'GET', 'pac/' + base, undefined, 'shallow=true&') || {};
        const pids = new Set();
        if (casa.paciente_id) pids.add(String(casa.paciente_id));
        if (casa.pacientes && typeof casa.pacientes === 'object') {
          for (const pid of Object.keys(casa.pacientes)) {
            if (casa.pacientes[pid]) pids.add(String(pid));
          }
        }
        for (const pid of pids) {
          try { if (shallowPac[pid]) await db(env, 'PATCH', `pac/${base}/${pid}`, { casa_id: '' }); } catch(e){}
        }
      }
      await db(env, 'DELETE', `catcas/${base}/${id}`);
      return J({ ok: 1, fast: 0 });
    }

    // ═══════════════════════════════════════════════════════════════
    // 🔗 VINCULAR PACIENTE ↔ CASA · 1 solo dbMulti atómico
    //    Antes: 3 requests no atómicos → doble vínculo fantasma
    //    Ahora: 1 PATCH atómico (~300 ms)
    // ═══════════════════════════════════════════════════════════════
    if (a === 'cat_link_patient') {
      const pidLink  = clean(b.pid);
      const idCasa   = clean(b.casaId);
      const idCasaAnt = clean(b.casaAnterior || '');
      if (!pidLink || !idCasa) return J({ error: 'pid + casaId requeridos' }, 400);

      // Validar existencia (reads — no afectan atomicidad del write)
      const pacNombre = await db(env, 'GET', `pac/${base}/${pidLink}/nombre`);
      if (!pacNombre) return J({ error: 'Paciente no encontrado' }, 404);

      const casa = await db(env, 'GET', `catcas/${base}/${idCasa}`);
      if (!casa) return J({ error: 'Casa no encontrada' }, 404);

      const now = Date.now();
      const updates = {};
      updates[`pac/${base}/${pidLink}/casa_id`]                    = idCasa;
      updates[`catcas/${base}/${idCasa}/pacientes/${pidLink}`]     = true;
      updates[`catcas/${base}/${idCasa}/updatedAt`]                = now;

      // Desvincular de casa anterior (solo si existe en el server, evita ghost)
      if (idCasaAnt && idCasaAnt !== idCasa) {
        const casaAnt = await db(env, 'GET', `catcas/${base}/${idCasaAnt}`);
        if (casaAnt) {
          updates[`catcas/${base}/${idCasaAnt}/pacientes/${pidLink}`] = null;
          updates[`catcas/${base}/${idCasaAnt}/updatedAt`]            = now;
        }
      }

      await dbMulti(env, updates);
      console.log(`[cat_link_patient] ${pidLink} → ${idCasa} (antes: ${idCasaAnt || 'ninguna'})`);
      return J({ ok: 1, pid: pidLink, casaId: idCasa });
    }

    const pid = clean(b.pid);
     
    if (!pid || !await db(env, 'GET', `pac/${base}/${pid}/nombre`)) return J({ error: 'Paciente no encontrado' }, 404);
    
         if (a === 'pac_patch') {
  if (b.d) {
    const unknown = Object.keys(b.d).filter(k => !PAC.includes(k));
    if (unknown.length) console.warn('[pac_patch] campos ignorados:', unknown, 'pid=', pid);
  }
  const d = pick(b.d, PAC);
  // ✅ Validar cada URL del array fachadas
  if (Array.isArray(d.fachadas)) {
    for (const u of d.fachadas) {
      if (!okUrl(u, env)) return J({ error: 'URL de foto no permitida en fachadas' }, 400);
    }
  }
  if (!okUrl(d.fachada, env)) return J({ error: 'URL de foto no permitida' }, 400);
  for (const k of ['lat', 'lon', 'acc']) if (d[k] != null && !isFinite(d[k])) return J({ error: 'Coordenadas inválidas' }, 400);
  await db(env, 'PATCH', `pac/${base}/${pid}`, d);
  const rev = await logChange(env, base, { pid, kind: 'pac', action: 'update', data: d });
  return J({ ok: 1, rev });
}


            if (a === 'visit_save') {
      const _v = pick(b.v, VIS);
      const v = { ..._v, por: adm ? 'admin' : s.u, por_nombre: _v.por_nombre || (adm ? 'admin' : (s.name || s.u)), at: Date.now() };

               
      // ✅ Validar cada URL del array fotos
      if (Array.isArray(v.fotos)) {
        for (const u of v.fotos) {
          if (!okUrl(u, env)) return J({ error: 'URL de foto no permitida en fotos' }, 400);
        }
      }
      if (!okUrl(v.foto, env)) return J({ error: 'URL de foto no permitida' }, 400);
      let vid = clean(b.vid);

            
      if (vid) {
        await db(env, 'PATCH', `pac/${base}/${pid}/vis/${vid}`, v);
      } else {
        // 🔧 vid 100% minúsculas — consistente con clean() usado en visit_del
        const rnd = b64u(crypto.getRandomValues(new Uint8Array(4)))
                      .replace(/[^a-z0-9]/gi, '').toLowerCase().slice(0, 6);
        vid = ('v' + Date.now().toString(36) + rnd).toLowerCase();
        const existing = await db(env, 'GET', `pac/${base}/${pid}/vis/${vid}`);
        if (existing) {
          vid = vid + 'x';
        }
        await db(env, 'PUT', `pac/${base}/${pid}/vis/${vid}`, v);
      }
      const rev = await logChange(env, base, { pid, kind: 'visit', action: 'set', vid, data: v });
      return J({ ok: 1, vid, v, rev });
    }
     
    return J({ error: 'Acción desconocida' }, 400);
  } catch (e) { console.error('ERR:', e?.stack || e); return J({ error: 'Detalle: ' + (e?.message || String(e)) }, 500); }
}
