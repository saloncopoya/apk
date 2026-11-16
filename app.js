
(() => {
'use strict';
// 🛡️ SEGURIDAD: si por accidente la URL tiene credenciales, limpiarla YA
try {
  if (location.search.includes('password=') || location.search.includes('username=')) {
    history.replaceState({}, '', location.pathname);
  }
} catch (e) {}

/* ═══════════════════════════════════════════════════════════════
   🔋 MODO AHORRO · Bloqueo total de datos móviles
   ───────────────────────────────────────────────────────────────
   Cuando está ACTIVO (persistido en localStorage):
     • fetch() se intercepta y BLOQUEA /api/* y URLs externas
       (Cloudinary, INEGI, CARTO, Esri, etc.) → cero red.
     • processSyncQueue() no ejecuta.
     • INEGI no activa.
     • Pines dorados no consultan.
     • Catastro no sincroniza.
     • Fotos no suben (toast informativo).
     • Fotos ya subidas se muestran como placeholder (no descargan).
     • La app funciona 100% offline aunque el celular tenga WiFi/datos.

   Cuando se DESACTIVA:
     • Se dispara processSyncQueue() → sube cola pendiente.
     • Se dispara catFlushQueue + catPull → catastro.
     • Se refresca la vista actual + ficha abierta (recarga fotos).
   ═══════════════════════════════════════════════════════════════ */


  let SAVING_MODE = false;
try { SAVING_MODE = localStorage.getItem('bSavingMode') === '1'; } catch {}

/* ═══════════════════════════════════════════════════════════════
   📲 PWA INSTALL PROMPT · Captura el evento nativo del navegador
   y lo muestra tras el primer login + PIN correcto.
   Solo se dispara en el primer enrollment (needPin === true).
   ═══════════════════════════════════════════════════════════════ */
let _deferredPrompt = null;
let _pendingInstallPrompt = false;

/* 🆕 Detecta si la app YA está instalada (standalone) o corriendo en navegador.
   - display-mode:standalone → PWA instalada y abierta desde icono
   - navigator.standalone (iOS) → instalada en iOS Safari
   - Si devuelve false → NO está instalada → podemos ofrecer el prompt */
function _isPwaInstalled() {
  try {
    if (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) return true;
    if (window.navigator && window.navigator.standalone === true) return true;
    return false;
  } catch (e) { return false; }
}

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  _deferredPrompt = e;
  if (_pendingInstallPrompt) {
    setTimeout(() => _tryShowInstallPrompt(), 200);
  }
});

async function _tryShowInstallPrompt() {
  if (!_deferredPrompt) return false;
  const ev = _deferredPrompt;
  try {
    await ev.prompt();
    // ✅ prompt() resolvió → el browser mostró su UI nativa.
    //    Ahora sí consumimos el evento (ya no sirve para otra llamada).
    _deferredPrompt = null;
    _pendingInstallPrompt = false;
    try {
      const choice = await ev.userChoice;
      console.log('[PWA install]', choice && choice.outcome);
    } catch (e) {
      console.warn('[PWA install] userChoice error:', e);
    }
    return true;
  } catch (e) {
    // ⚠️ prompt() falló (probablemente sin user gesture activo).
    //    NO consumimos el evento → permitir reintento en el próximo tap.
    console.warn('[PWA install] prompt falló (se reintentará en próximo tap):', e);
    return false;
  }
}

// 🆕 Reintento automático en el siguiente click/tap del usuario.
//    Chrome requiere user gesture para ev.prompt(), y como el primer
//    intento en start() corre después de varios `await`, el gesture
//    se pierde. Este listener captura el próximo tap real del usuario.
document.addEventListener('click', () => {
  if (_pendingInstallPrompt && _deferredPrompt) {
    _tryShowInstallPrompt();
  }
}, { passive: true });
  
  
  /* ═══════════════════════════════════════════════════════════════════
   🔒 CSP-SAFE GLOBAL LISTENERS
   Bloquea TODOS los envíos de formulario (evita password en URL).
   Reemplaza los onsubmit="return false" inline que CSP estricto bloquea.
   ═══════════════════════════════════════════════════════════════════ */
document.addEventListener('submit', e => {
  // NUNCA dejamos que un formulario se envíe nativo. Sin esto,
  // la "Go" del teclado móvil dispara GET con ?password=... en la URL.
  e.preventDefault();
}, true);   // ← capture: true intercepta ANTES del handler nativo

/* Oculta imágenes rotas sin onerror inline (CSP-safe).
   El evento 'error' de <img> NO burbujea → capture: true es obligatorio. */
document.addEventListener('error', e => {
  const t = e.target;
  if (t && t.tagName === 'IMG') t.style.display = 'none';
}, true);


  
  /* ---------- SVG ICONS (Feather Icons, MIT) ---------- */
const SVG = {
  home:     '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>',
  table:    '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/></svg>',
  map:      '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/></svg>',
  filter:   '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>',
  sync:     '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>',
  edit:     '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>',
  save:     '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
  check:    '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
  close:    '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
  back:     '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>',
  prev:     '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>',
  next:     '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>',
  phone:    '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>',
  whatsapp: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>',
  sms:      '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
  copy:     '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
  pin:      '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>',
  camera:   '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>',
  cal:      '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
  pulse:    '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>',
  pill:     '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.5 20.5 3.5 13.5a5 5 0 0 1 7-7l7 7a5 5 0 0 1-7 7z"/><line x1="8.5" y1="8.5" x2="15.5" y2="15.5"/></svg>',
  notes:    '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>',
  clipboard:'<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg>',
  trash:    '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>',
  warn:     '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
  settings: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
  search:   '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
  logout:   '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>',
  sort:     '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="8 5 12 1 16 5"/><polyline points="8 19 12 23 16 19"/><line x1="12" y1="1" x2="12" y2="23"/></svg>',
  excel:    '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="15" y2="17"/></svg>',
  user:     '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
};
  
/* ---------- UTILS ---------- */
const $  = (s, r=document) => r.querySelector(s);
const $$ = (s, r=document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));


/* 🆕 norm() con cache — mismo resultado, pero 5-10× más rápido en loops grandes.
   El cache tiene cap de 100k entradas (se limpia solo al llenarse) para no crecer infinito. */
const _normRaw = s => String(s ?? '').toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
const _normCache = new Map();
const norm = s => {
  if (s === undefined || s === null || s === '') return '';
  const k = typeof s === 'string' ? s : String(s);
  let v = _normCache.get(k);
  if (v === undefined) {
    v = _normRaw(k);
    if (_normCache.size >= 100000) _normCache.clear();
    _normCache.set(k, v);
  }
  return v;
};

  
// 🆕 Collator compartido: localeCompare crea uno nuevo por llamada (lento con 20k)
const _collator = new Intl.Collator('es', { numeric: true, sensitivity: 'base' });
const _cmpStr = (a, b) => _collator.compare(String(a ?? ''), String(b ?? ''));
  
  
   const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
};
  const safeU = u => /^https:\/\/res\.cloudinary\.com\//.test(u||'') ? u : '';

/* ═══════════════════════════════════════════════════════════════
   🎂 PARSER DE CURP · extrae fecha de nacimiento y sexo
   Acepta CURPs válidas (18 chars) e inválidas siempre que tengan
   el patrón YYMMDD[H/M] en las posiciones 5-11.
   Cero dependencias, cero GPU, cero red. Solo string ops.
   ═══════════════════════════════════════════════════════════════ */
function parseCURP(curpRaw) {
  const c = String(curpRaw || '').toUpperCase().replace(/\s/g, '');
  if (c.length < 11) return null;

  const yy = c.slice(4, 6);
  const mm = c.slice(6, 8);
  const dd = c.slice(8, 10);
  const sx = c.slice(10, 11);

  if (!/^\d{2}$/.test(yy) || !/^\d{2}$/.test(mm) || !/^\d{2}$/.test(dd)) return null;
  if (sx !== 'H' && sx !== 'M') return null;

  const mmN = parseInt(mm, 10);
  const ddN = parseInt(dd, 10);
  if (mmN < 1 || mmN > 12 || ddN < 1 || ddN > 31) return null;

  const yyN = parseInt(yy, 10);
  const currentYear = new Date().getFullYear();

  // Ambiguo: YY=24 puede ser 1924 o 2024.
  // Bias: preferir 19XX si la edad resultante es <= 100 (app geriátrica).
  const y2k   = 2000 + yyN;
  const y19   = 1900 + yyN;
  const age2k = currentYear - y2k;
  const age19 = currentYear - y19;

  let year;
  if (y2k > currentYear)     year = y19;   // 20XX futuro → 19XX
  else if (age19 > 120)      year = y2k;   // 19XX imposible (>120) → 20XX
  else if (age19 <= 100)     year = y19;   // preferir 19XX (adulto mayor)
  else                       year = y2k;   // 101-120 años → asumir 20XX (raro, corrige user)

  // Validar fecha real (rechaza 30/02, 31/04, etc.)
  const dt = new Date(year, mmN - 1, ddN);
  if (dt.getFullYear() !== year || dt.getMonth() !== mmN - 1 || dt.getDate() !== ddN) return null;

  return {
    y: year, m: mmN, d: ddN,
    dateStr: `${year}-${String(mmN).padStart(2,'0')}-${String(ddN).padStart(2,'0')}`,
    sexo: sx === 'H' ? 'Hombre' : 'Mujer',
    sexRaw: sx
  };
}

function _curpSexo(curp) {
  const p = parseCURP(curp);
  return p ? p.sexo : '';
}

function _curpEdad(curp) {
  const p = parseCURP(curp);
  if (!p) return '';
  const now = new Date();
  let age = now.getFullYear() - p.y;
  const m = now.getMonth() + 1;
  const d = now.getDate();
  if (m < p.m || (m === p.m && d < p.d)) age--;
  return age >= 0 ? String(age) : '';
}
  

  
  const imgH  = u => {
  if (!safeU(u)) return '';
  // Cloudinary: redimensiona a 800px + compresión automática + formato webp/avif
  const optimized = u.replace('/upload/', '/upload/w_800,q_auto:good,f_auto/');
  // ✅ Sin onerror inline (CSP-safe). El listener global de 'error' se encarga.
  return `<img src="${esc(optimized)}" alt="" loading="lazy" style="max-width:100%;max-height:220px;border-radius:10px;display:block;margin-top:6px">`;
};
  
const toast = (m, e, persistent = false) => {
  const t = $('#toast'); 
  t.textContent = m; 
  t.className = e ? 'err' : ''; 
  t.classList.add('show'); 
  clearTimeout(t._h); 
  if (!persistent) {
    t._h = setTimeout(() => t.classList.remove('show'), 2600);
  }
};

/* ═══════════════════════════════════════════════════════════════
   📸 GALERÍA DE FOTOS MÚLTIPLES
   ═══════════════════════════════════════════════════════════════ */

/** Devuelve array de URLs: array nuevo primero, fallback al campo legacy string. */
const _isCloudinaryUrl = u =>
  typeof u === 'string' && u.startsWith('https://res.cloudinary.com/');

function photoUrls(obj, arrayKey, singleKey) {
  if (!obj) return [];
  const arr = obj[arrayKey];
  if (Array.isArray(arr) && arr.length) {
    return arr.filter(_isCloudinaryUrl);
  }
  const single = obj[singleKey];
  if (_isCloudinaryUrl(single)) return [single];
  return [];
}

/** Abre visor fullscreen con navegación ← → entre fotos. */
function openPhotoViewer(urls, startIdx = 0) {
  if (!urls || !urls.length) return;
  let idx = Math.max(0, Math.min(startIdx, urls.length - 1));
  const ovl = document.createElement('div');
  ovl.id = 'photoViewer';
  const render = () => {
    ovl.innerHTML = `
      <img src="${esc(urls[idx])}" alt="">
      <button class="pv-close" data-x="close">×</button>
      ${urls.length > 1 ? `
        <button class="pv-prev" data-x="prev" ${idx===0?'disabled':''}>‹</button>
        <button class="pv-next" data-x="next" ${idx===urls.length-1?'disabled':''}>›</button>
        <div class="pv-count">${idx+1} / ${urls.length}</div>
      ` : ''}
    `;
  };
  render();
  ovl.onclick = (e) => {
    const t = e.target.closest('[data-x]');
    if (t) {
      const act = t.dataset.x;
      if (act === 'close') { ovl.remove(); return; }
      if (act === 'prev' && idx > 0) { idx--; render(); }
      if (act === 'next' && idx < urls.length-1) { idx++; render(); }
      return;
    }
    if (e.target === ovl) ovl.remove();
  };
  document.body.appendChild(ovl);
}

/**
 * Renderiza una galería en `container`.
 * Los botones eliminar/agregar se renderizan siempre (si editable=true)
 * y se muestran/ocultan vía CSS (solo en .editing o .visit-edit-modal).
 */
function renderPhotoGallery(container, urls, opts = {}) {
  if (!container) return;
  const {
    editable = false,
    max = 20,
    onAdd,
    onDelete,
    onView,
    label = 'FOTO'
  } = opts;

  container.className = 'photo-gallery';
  container.innerHTML = '';

  if (!urls.length && !editable) {
    container.innerHTML = '<div class="photo-empty">Sin fotos</div>';
    return;
  }

  urls.forEach((url, i) => {
    const item = document.createElement('div');
    item.className = 'photo-item';

    if (SAVING_MODE) {
      // 🆕 Modo ahorro: placeholder SIN descargar la imagen de Cloudinary
      const ph = document.createElement('div');
      ph.className = 'photo-placeholder';
      ph.innerHTML = `<span class="ph-ic">📷</span><span>AHORRO</span>`;
      item.appendChild(ph);
      item.onclick = () => toast('🔋 Modo ahorro activo. Desactívalo para ver la foto.', 1);
    } else {
      const img = document.createElement('img');
      img.src = url; img.alt = `${label} ${i+1}`; img.loading = 'lazy';
      item.appendChild(img);
      item.onclick = () => { (onView || openPhotoViewer)(urls, i); };
    }

    const badge = document.createElement('span');
    badge.className = 'photo-num';
    badge.textContent = String(i+1);
    item.appendChild(badge);

    if (editable) {
      const del = document.createElement('button');
      del.type = 'button';
      del.className = 'photo-del';
      del.title = 'Eliminar foto';
      del.textContent = '×';
      del.onclick = (e) => {
        e.stopPropagation();
        if (onDelete) onDelete(url, i);
      };
      item.appendChild(del);
    }
    container.appendChild(item);
  });

  if (editable && urls.length < max) {
    const add = document.createElement('button');
    add.type = 'button';
    add.className = 'photo-add';
    add.innerHTML = `<span class="plus">+</span><span class="lbl">Agregar</span>`;
    add.onclick = () => { if (onAdd) onAdd(urls); };
    container.appendChild(add);
  }
}

/** Comprime + sube 1 foto a Cloudinary. Devuelve secure_url. */
async function uploadPhotoToCloudinary(file) {
  const compressed = await new Promise((resolve) => {
    const img = new Image();
    const _u = URL.createObjectURL(file);
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const MAX_DIM = 1400;
      const scale = Math.min(1, MAX_DIM / Math.max(img.width, img.height));
      canvas.width  = Math.round(img.width  * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(b => { URL.revokeObjectURL(_u); resolve(b || file); }, 'image/jpeg', 0.78);
    };
    img.onerror = () => { URL.revokeObjectURL(_u); resolve(file); };
    img.src = _u;
  });

  const s = await api('csign');
  const fd = new FormData();
  fd.append('file', compressed, 'photo.jpg');
  fd.append('api_key', s.key);
  fd.append('timestamp', s.ts);
  fd.append('folder', s.folder);
  fd.append('signature', s.sig);
  const j = await (await fetch(`https://api.cloudinary.com/v1_1/${s.cloud}/image/upload`, {method:'POST', body: fd})).json();
  if (!j.secure_url) throw new Error('Sin URL de Cloudinary');
  return j.secure_url;
}

/** Abre picker multi-archivo y sube todas. Devuelve array de URLs exitosas. */
/** Abre modal para elegir Cámara o Galería, luego sube las fotos. */
function pickAndUploadPhotos(maxCount = 20) {
  // 🆕 Bloqueo en modo ahorro: no permitir subir fotos
  if (SAVING_MODE) {
    toast('🔋 Modo ahorro activo. Desactívalo para subir fotos.', 1);
    return Promise.resolve([]);
  }
  return new Promise((resolve) => {
    let picked = false;
    const prevCallback = _pickMapOnFinish;

    openModal(`
      <div class="sheet-head">📸 Agregar foto<button class="close" data-a="close-modal">✕</button></div>
      <div class="sheet-body" style="padding:20px 16px 24px">
        <div style="font-size:13px;color:var(--muted);text-align:center;margin-bottom:16px">
          ¿Cómo quieres agregar la foto?
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <button type="button" id="__pick_camera"
            style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;
                   padding:20px 10px;border-radius:14px;background:var(--burgundy);color:#fff;
                   border:1.5px solid var(--burgundy);font-weight:800;font-size:13px;
                   box-shadow:0 4px 14px rgba(139,41,66,.28);cursor:pointer">
            <svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
              <circle cx="12" cy="13" r="4"/>
            </svg>
            Tomar foto
          </button>
          <button type="button" id="__pick_gallery"
            style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;
                   padding:20px 10px;border-radius:14px;background:#fff;color:var(--text);
                   border:1.5px solid var(--border);font-weight:800;font-size:13px;cursor:pointer">
            <svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="var(--burgundy)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
              <circle cx="8.5" cy="8.5" r="1.5"/>
              <polyline points="21 15 16 10 5 21"/>
            </svg>
            Galería
          </button>
        </div>
      </div>
    `, true);

    const doPick = (useCamera) => {
      picked = true;
      closeModal();
      const inp = document.createElement('input');
      inp.type = 'file';
      inp.accept = 'image/*';
      if (useCamera) {
        inp.capture = 'environment';   // 📷 Abre la cámara trasera directa
        inp.multiple = false;          // La cámara solo toma 1 foto
      } else {
        inp.multiple = maxCount > 1;   // Galería permite varias
      }
      inp.onchange = async () => {
        const files = Array.from(inp.files || []).slice(0, maxCount);
        if (!files.length) { resolve([]); return; }
        if (!navigator.onLine) { toast('Necesitas conexión para subir fotos', 1); resolve([]); return; }
        const urls = [];
        toast(`⏳ Subiendo ${files.length} foto${files.length>1?'s':''}…`, 0, true);
        for (let i = 0; i < files.length; i++) {
          const f = files[i];
          if (!/^image\//.test(f.type) || f.size > 12e6) {
            toast(`❌ ${f.name}: imagen inválida o >12MB`, 1);
            continue;
          }
          try {
            const url = await uploadPhotoToCloudinary(f);
            urls.push(url);
            toast(`⏳ Subiendo ${i+1}/${files.length}…`, 0, true);
          } catch(e) {
            toast(`❌ ${f.name}: ${e.message}`, 1);
          }
        }
        toast(`✓ ${urls.length} foto${urls.length>1?'s':''} subida${urls.length>1?'s':''}`);
        resolve(urls);
      };
      inp.oncancel = () => { resolve([]); };   // Si el usuario cancela el picker
      inp.click();
    };

    setTimeout(() => {
      const camBtn = document.getElementById('__pick_camera');
      const galBtn = document.getElementById('__pick_gallery');
      if (camBtn) camBtn.addEventListener('click', () => doPick(true));
      if (galBtn) galBtn.addEventListener('click', () => doPick(false));
    }, 50);

    // Si cierran el modal sin elegir → resolve([])
    _pickMapOnFinish = () => {
      if (!picked) resolve([]);
      _pickMapOnFinish = prevCallback;
    };
  });
}
  
/* ═══════════════════════════════════════════════════════════════
   🔐 CRIPTOGRAFÍA · PBKDF2 + AES-GCM + SHA-256
   ═══════════════════════════════════════════════════════════════ */
const CRYPT = {
  ENC: new TextEncoder(),
  DEC: new TextDecoder(),
  hex(buf) { return [...new Uint8Array(buf)].map(x => x.toString(16).padStart(2,'0')).join(''); },
  unhex(h) { const a = new Uint8Array(h.length/2); for (let i=0;i<a.length;i++) a[i] = parseInt(h.substr(i*2,2),16); return a; },
  b64u(buf) { return btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,''); },
  unb64u(s) { const b = s.replace(/-/g,'+').replace(/_/g,'/'); return Uint8Array.from(atob(b + '='.repeat((4 - b.length % 4) % 4)), c => c.charCodeAt(0)); },
  async pbkdf2(password, saltBytes) {
    const base = await crypto.subtle.importKey('raw', this.ENC.encode(password), 'PBKDF2', false, ['deriveBits']);
    return await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: saltBytes, iterations: 500000, hash: 'SHA-256' }, base, 256);
  },
  async aesKey(bits) { return crypto.subtle.importKey('raw', bits, { name: 'AES-GCM' }, false, ['encrypt','decrypt']); },
  async encryptJSON(key, obj, aad = '') {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = this.ENC.encode(JSON.stringify(obj));
  const params = { name: 'AES-GCM', iv };
  if (aad) params.additionalData = this.ENC.encode(aad);
  const ct = await crypto.subtle.encrypt(params, key, data);
  return this.b64u(new Uint8Array([...iv, ...new Uint8Array(ct)]));
},
  async decryptJSON(key, b64, aad = '') {
  const buf = this.unb64u(b64);
  const iv = buf.slice(0, 12);
  const ct = buf.slice(12);
  const params = { name: 'AES-GCM', iv };
  if (aad) params.additionalData = this.ENC.encode(aad);
  const pt = await crypto.subtle.decrypt(params, key, ct);
  return JSON.parse(this.DEC.decode(pt));
},
  async sha256(s) { return this.hex(await crypto.subtle.digest('SHA-256', this.ENC.encode(s))); }
};

/* ═══════════════════════════════════════════════════════════════
   💾 ALMACENAMIENTO PERSISTENTE (localStorage)
   ═══════════════════════════════════════════════════════════════ */
const STORE = {
  KEY_T: 'bT',      // { t, exp }
  KEY_PIN: 'bPin',  // { h, salt, exp }
  KEY_PW: 'bPw',    // { h, salt }
  KEY_N: 'bN',      // nombre usuario
  KEY_FAIL: 'bPinFail',
  get(k) { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { console.warn('localStorage full', e); } },
  del(k) { try { localStorage.removeItem(k); } catch {} }
};

/* ═══════════════════════════════════════════════════════════════
   🕐 CLOCK WATERMARK · Detecta si el usuario retrocede la hora/fecha
   ─────────────────────────────────────────────────────────────────
   Ataque: usuario llega al día 3, se bloquea y retrocede el reloj
   del teléfono para que parezca que aún está en día 0.
   Defensa: guardamos el timestamp MÁS ALTO jamás visto (watermark)
   en localStorage, y lo anclamos al servidor (header `Date`) en
   cada respuesta /api/*. Si en un boot el reloj local está MÁS
   ATRÁS que el watermark (menos 5 min de margen), asumimos
   manipulación y forzamos re-login online (se borra el token).
   ═══════════════════════════════════════════════════════════════ */
const CLOCK_KEY = 'bClockHi';
const CLOCK_TOL = 5 * 60 * 1000;   // 5 min de margen (NTP / DST)

function _clockRead() {
  try {
    const s = JSON.parse(localStorage.getItem(CLOCK_KEY) || 'null');
    return s && typeof s === 'object' ? { hi: +s.hi || 0 } : { hi: 0 };
  } catch { return { hi: 0 }; }
}

function _clockBumpLocal() {
  try {
    const now = Date.now();
    if (!isFinite(now) || now <= 0) return;
    if (now > _clockRead().hi) {
      localStorage.setItem(CLOCK_KEY, JSON.stringify({ hi: now }));
    }
  } catch {}
}

function _clockBumpServer(serverTs) {
  try {
    if (!isFinite(serverTs) || serverTs <= 0) return;
    const c = _clockRead();
    // Setear si: no hay watermark, el server adelanta, o el watermark
    // está ADELANTE del server por más que CLOCK_TOL (reloj local
    // contaminado → reset al tiempo del server, que es la única verdad).
    if (!c.hi || serverTs > c.hi || c.hi > serverTs + CLOCK_TOL) {
      localStorage.setItem(CLOCK_KEY, JSON.stringify({ hi: serverTs }));
    }
  } catch {}
}

function _clockTampered() {
  const c = _clockRead();
  if (!c.hi) return false;
  return (Date.now() + CLOCK_TOL) < c.hi;
}

/* ═══════════════════════════════════════════════════════════════
   🆕 TIEMPO EFECTIVO · Devuelve el MAYOR entre el reloj local y
   el watermark (máximo timestamp visto). Si el usuario retrocede
   el reloj, effectiveNow sigue reflejando la hora REAL última
   conocida → bloquea el ataque de "retrocedo a día 2 para que el
   token del día 3 no expire".
   ═══════════════════════════════════════════════════════════════ */
function _effectiveNow() {
  const hi = _clockRead().hi || 0;
  const now = Date.now();
  return Math.max(now, hi);
}

/* ═══════════════════════════════════════════════════════════════
   🆕 LAST-SERVER-OK · Timestamp del último contacto exitoso con
   el servidor. Se usa para forzar re-login si el usuario lleva
   > MAX_OFFLINE_DAYS sin internet (evita que un ataque de rollback
   "infinito" mantenga la sesión viva offline indefinidamente).
   ═══════════════════════════════════════════════════════════════ */
const LAST_SERVER_KEY = 'bLastServerOk';
const MAX_OFFLINE_DAYS = 3;   // ← Cambia a 1 si quieres ventana más corta

function _bumpLastServerOk() {
  try {
    const now = Date.now();
    const cur = +localStorage.getItem(LAST_SERVER_KEY) || 0;
    if (now > cur) {
      localStorage.setItem(LAST_SERVER_KEY, String(now));
      // También bumpear el watermark (reloj real confirmado por server)
      _clockBumpLocal();
    }
  } catch {}
}

function _tooLongOffline() {
  try {
    const last = +localStorage.getItem(LAST_SERVER_KEY) || 0;
    if (!last) return false;   // sin info → no bloquear
    const effective = _effectiveNow();
    return (effective - last) > MAX_OFFLINE_DAYS * 24 * 3600e3;
  } catch { return false; }
}

// 🕐 Interceptar fetch: anclar watermark al `Date` + MODO AHORRO + TIMEOUT API
const _origFetch = window.fetch.bind(window);
window.fetch = async function (url, opts) {
  const u = typeof url === 'string' ? url : (url && url.url) || '';

  /* 🔋 MODO AHORRO: bloquear ANTES de tocar la red */
  if (SAVING_MODE) {
    let bodyAction = '';
    try {
      if (opts && typeof opts.body === 'string') {
        bodyAction = JSON.parse(opts.body).a || '';
      }
    } catch (e) {}
    const AUTH_ACTIONS = new Set([
      'login', 'pin_check', 'pin_check_ocr',
      'device_check', 'device_register'
    ]);
    const isAuth = AUTH_ACTIONS.has(bodyAction);

    const isApi      = /\/api\//.test(u);
    const isExternal = /^https?:\/\//.test(u) && !u.startsWith(location.origin);
    const isExempt   = /cdn\.jsdelivr\.net|static\.cloudflareinsights\.com/.test(u);
    if (!isAuth && (isApi || (isExternal && !isExempt))) {
      throw new TypeError('Failed to fetch (Modo Ahorro activo)');
    }
  }

  /* 🆕 TIMEOUT universal en /api/* → 10s para auth, 12s para el resto
   Esto arregla el caso "WiFi encendido pero sin internet real":
   - login/device_check: aborta a los 10s (antes colgaba 30-60s)
   - pacs/pacs_delta/etc: aborta a los 12s (antes colgaba 30-60s)
   - Modo Ahorro: los no-auth ya fueron bloqueados arriba (throw) */
let controller = null;
let timer = null;
let finalOpts = opts;

if (/\/api\//.test(u) && !SAVING_MODE) {
  let bodyAction = '';
  try {
    if (opts && typeof opts.body === 'string') bodyAction = JSON.parse(opts.body).a || '';
  } catch (e) {}
  const AUTH_ACTIONS = new Set([
    'login', 'pin_check', 'pin_check_ocr',
    'device_check', 'device_register'
  ]);
  const isAuth = AUTH_ACTIONS.has(bodyAction);
  const timeout = isAuth ? 10000 : 12000;   // ← auth: 10s, otros: 12s

  controller = new AbortController();
  timer = setTimeout(() => controller.abort(), timeout);
  finalOpts = { ...(opts || {}), signal: controller.signal };
}

  try {
    const r = await _origFetch(url, finalOpts);
    try {
      if (r && r.ok && /\/api\//.test(u)) {
        const dh = r.headers.get('date');
        if (dh) {
          const st = Date.parse(dh);
          if (isFinite(st) && st > 0) _clockBumpServer(st);
        }
        // 🆕 Registrar último contacto exitoso con el servidor
        _bumpLastServerOk();
      }
    } catch {}
    return r;
  } catch (e) {
    // Convertir AbortError en TypeError para que el catch de load() lo trate
    // igual que un fallo de red normal (cae al caché de IndexedDB).
    if (e && e.name === 'AbortError') {
      throw new TypeError('Failed to fetch (timeout 12s)');
    }
    throw e;
  } finally {
    if (timer) clearTimeout(timer);
  }
};

// 🆕 FIX BATERÍA: heartbeat pausable (antes el timer existía siempre).
let _clockTimer = null;
function _startClockBeat() {
  if (_clockTimer) return;
  _clockTimer = setInterval(() => {
    try { _clockBumpLocal(); } catch {}
  }, 60e3);
}
function _stopClockBeat() {
  if (_clockTimer) { clearInterval(_clockTimer); _clockTimer = null; }
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    try { _clockBumpLocal(); } catch {}
    _startClockBeat();
  } else {
    _stopClockBeat();
  }
});
if (document.visibilityState === 'visible') _startClockBeat();
  

/* ═══════════════════════════════════════════════════════════════
   🔑 Llave AES-GCM en memoria (NUNCA se persiste)
   ═══════════════════════════════════════════════════════════════ */
let APP_KEY = null;

  
  /* ---------- BLOQUEO DE COPIADO (versión ligera) ---------- */
(function lockCopy() {
  const editable = el => el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
  const stop = e => { if (!editable(e.target)) e.preventDefault(); };

  // 4 listeners — se ejecutan SOLO cuando ocurre el evento
  document.addEventListener('contextmenu', stop);
  document.addEventListener('copy', stop);
  document.addEventListener('cut', stop);
  document.addEventListener('paste', stop);

  // 1 listener para atajos — sale en 1 instrucción si estás en un input
  document.addEventListener('keydown', e => {
    if (editable(e.target)) return;
    if (e.key === 'F12') { e.preventDefault(); return; }
    const ctrl = e.ctrlKey || e.metaKey;
    if (!ctrl) return;
    const k = e.key.toLowerCase();
    if (e.shiftKey && (k === 'i' || k === 'j' || k === 'c' || k === 's' || k === 'p')) {
      e.preventDefault();
      return;
    }
    if (k === 'c' || k === 'x' || k === 'a' || k === 'p' || k === 's' || k === 'u') {
      e.preventDefault();
    }
  });
})();

  
/* ---------- STATE ---------- */

  let T = (() => { try { return STORE.get(STORE.KEY_T)?.t || ''; } catch { return ''; } })();
  

  

  let P = {}, LIST = [], cur = '', MAP, CL, E = 0, D = 0, TAB = 0, idle, sync = '', VIEW = 'list';

  // 🆕 LIM persistente (sobrevive a reload — igual que filtros)
let LIM = (() => {
  try {
    const n = parseInt(localStorage.getItem('bLim') || '60', 10);
    return (isFinite(n) && n >= 60) ? n : 60;
  } catch { return 60; }
})();

// 🆕 FIX RENDIMIENTO: cache del badge "Programados HOY".
//    Antes, updateProgBadge() iteraba TODOS los pacientes (~20k) en cada
//    búsqueda (calc → teclado del usuario) → lag al escribir.
let _progBadgeCache = { day: '', count: -1 };
function _invalidateProgBadge() { _progBadgeCache.count = -1; }
  
  let TABLE_LIMIT = 500;           // 🆕 filas visibles en la tabla (incrementa de 500 en 500)
const TABLE_MAX = 3000;          // 🆕 tope duro (más allá el navegador se arrastra)
let _homeScrollY = 0;            // 🆕 guardar scroll de Home al cambiar de vista
  
  let LAYERS = { streets: null, minimal: null, sat: null };

  // 🆕 INEGI WMS
  let INEGI_WMS_LAYERS = [];
  let INEGI_ACTIVE = false;
  const INEGI_WMS_URL = 'https://gaia.inegi.org.mx/NLB/tunnel/wms/wms61';

  let PICK = null;
let userLocLayer = null;    // capa del marcador GPS (círculo + punto)
let userLocWatch = null;    // ID del watcher de geolocalización

// 🆕 GPS dedicado al modal "Ver mapa offline" (se apaga al cerrar)
let _viewMapUserWatch = null;
let _viewMapUserLayer = null;

// 🆕 Token para invalidar inicializaciones pendientes de mapas en modales
let _modalVersion = 0;
  

  
let VISIT_DRAFT = {};
let _visitEditPhotos = [];    // 🆕 fotos en el modal de edición de visita
let PROG_MONTH = new Date();  // mes visible en calendario
  
let PROG_DAY = today();       // día seleccionado
let _progModalId = null;      // 🆕 Paciente actualmente abierto en el modal "Programar visita"
let SHOW_BIRTHDAYS = false;   // 🎂 toggle de cumpleaños en calendario
  

let TBL = (() => {                                    // ← 🆕 ESTA LÍNEA FALTA
  const DEF = {
    sorts: [],
    cols: ['nombre','tipo','colonia','calle','numExt','mz','refs','tel1','tel2']
  };
  
  try {
    const saved = JSON.parse(localStorage.getItem('tblPref') || 'null');
    if (saved && Array.isArray(saved.sorts) && Array.isArray(saved.cols)) {
      // ✅ Sanitizar: solo aceptar keys y modes válidos
      const validModes = new Set(['asc','desc','freq']);
      const validCols = new Set([
  'nombre','tipo','est','vf','nv','ultimaVisita','colonia','calle',
  'numExt','numInt','mz','lt','municipio','estado','sexo','edad',
  'dep','curp','folio','motivo','refs','tel1','tel2','diag','med',
  'seccion','area',
  'prog'   // 🆕 permite guardar/restaurar el sort por programación
]);
      const sorts = saved.sorts.filter(
        s => s && validCols.has(s.k) && validModes.has(s.mode)
      );
      const cols = saved.cols.filter(k => validCols.has(k));
        // Si quedó vacío por corrupción → usar defaults
      if (!cols.length) return DEF;
      // ✅ sorts vacío es válido → significa "sin orden manual" (se usa nombre A-Z)
      return { sorts, cols };
    }
  } catch(e) {
    console.warn('[TBL] localStorage corrupto, usando defaults', e);
  }
  return DEF;
})();

const saveTBL = () => {
  try { localStorage.setItem('tblPref', JSON.stringify({ sorts: TBL.sorts, cols: TBL.cols })); } catch(e) {}
};
  
  
/* ---------- ESTATUS ---------- */
const EST = {1:'1🔴',2:'2✅',3:'3❎',4:'4🟢',5:'5📵',6:'6🔁',7:'7⏰',8:'8⚪',9:'9📅'};
const EC  = {1:'#ef5350',2:'#4caf50',3:'#78909c',4:'#9ccc65',5:'#8d6e63',6:'#ab47bc',7:'#ffa726',8:'#bdbdbd',9:'#42a5f5'};

// Opciones NUEVAS para "Visita fué" (credencialización)
const VFS = [
  'CREDENCIALIZADO',
  'NO CREDENCIALIZADO',
  'NO QUISO LA CREDENCIALIZACION',
  'NO ACEPTA',
  'NO CREE',
  'NO SE ENCUENTRA EN DOMICILIO',
  'NO LOCALIZADO'
];

// Opciones ANTERIORES de "Visita fué" que ahora pasan a "Motivo"
const MOTIVOS = [
  'EFECTIVO',
  'DEFUNCION',
  'NO QUISO EL PROGRAMA',
  'CAMBIO DE DOMICILIO',
  'NO SE ENCONTRO A LA PERSONA EN SU DOMICILIO'
];

// Color para cada valor de VF (credencialización) → tarjetas
const VC = {
  'CREDENCIALIZADO':                '#4caf50',
  'NO CREDENCIALIZADO':             '#ff9800',
  'NO QUISO LA CREDENCIALIZACION':  '#ffa726',
  'NO ACEPTA':                      '#ef5350',
  'NO CREE':                        '#ab47bc',
  'NO SE ENCUENTRA EN DOMICILIO':   '#78909c',
  'NO LOCALIZADO':                  '#bdbdbd'
};

// Color para cada valor de MOTIVO → tarjetas
const MC = {
  'EFECTIVO':                                  '#4caf50',
  'DEFUNCION':                                 '#6d4c41',
  'NO QUISO EL PROGRAMA':                      '#ff9800',
  'CAMBIO DE DOMICILIO':                       '#42a5f5',
  'NO SE ENCONTRO A LA PERSONA EN SU DOMICILIO':'#ef5350'
};


  const NVS = Array.from({length:30}, (_,i) => (i+1)+'V');
const DEPS = ['Independiente','Dependencia leve','Dependencia moderada','Dependencia total'];

// 🆕 Catálogos para los ComboBox (evita errores de tipeo que rompen los textos clínicos)
const AYUDAS_TECNICAS = [
  'Ninguna', 
  'Baston', 
  'Bastón',
  'Andadera', 
  'Muletas', 
  'Silla de ruedas', 
  'Postrado'
];
const COMPORTAMIENTOS = [
  'Cooperador y receptivo', 
  'Renuente, poco receptivo y evasivo'
];
  
  
/* Helpers seguros para datos */
/* Helpers seguros para datos */


  const isReal = v => { const s = String(v ?? '').trim(); return s !== '' && s.toUpperCase() !== 'SN' && s !== '-' && s !== 'S/N' && s !== '0'; };
const normOrSN = v => isReal(v) ? norm(v) : 'SN';
  
/* 🆕 Pacientes que comparten el mismo teléfono (offline/online, sin tocar P) */
function phoneKey(v) {
  const d = String(v ?? '').replace(/\D/g, '');
  if (d.length < 7) return '';
  // Canonical: últimos 10 dígitos (por si hay +52), o completo si son ≤10
  return d.length > 10 ? d.slice(-10) : d;
}
function getOtherPatientsWithPhone(phoneValue, excludeId) {
  const key = phoneKey(phoneValue);
  if (!key) return [];
  const out = [];
  for (const id in P) {
    if (id === excludeId) continue;
    const p = P[id];
    if (!p) continue;
    if (phoneKey(p.tel1) === key || phoneKey(p.tel2) === key) {
      const nm = String(p.nombre || '').trim();
      out.push({ id, nombre: nm || 'Sin nombre' });
    }
  }
  return out;
}

  function renderDetailPhone(phoneValue, excludeId, field) {
  const clean = String(phoneValue).replace(/\D/g, '');
const raw = String(phoneValue ?? '').trim();
const val = isReal(raw) || raw.toUpperCase() === 'SN' ? raw : '';
    
  // Vista LECTURA (click para llamar)
  let readHtml;
  if (isReal(phoneValue)) {
    const others = getOtherPatientsWithPhone(phoneValue, excludeId);
    const othersHtml = others.length ? `<div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:6px">
      ${others.map(o => `<span data-a="tel-shared" data-id="${esc(o.id)}" title="Abrir ficha de ${esc(o.nombre)}" style="display:inline-block;max-width:160px;padding:3px 9px;border-radius:999px;background:var(--chip);color:var(--chip-tx);font-weight:700;font-size:11px;cursor:pointer;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;vertical-align:middle">👤 ${esc(o.nombre)}</span>`).join('')}
    </div>` : '';
    readHtml = `<div class="only-read"><div class="tel-row" data-a="tel" data-n="${esc(clean)}" data-pid="${esc(excludeId)}"><span class="ic">📞</span>${esc(phoneValue)}</div>${othersHtml}</div>`;
  } else {
    readHtml = `<div class="only-read"><div class="val">—</div></div>`;
  }

  // Vista EDICIÓN (input)
  const editHtml = `<input class="only-edit" data-p="${field}" value="${esc(val)}" inputmode="tel" placeholder="Teléfono" style="width:100%;padding:9px 12px;border-radius:var(--r-sm);border:1.5px solid var(--border);background:#fff;font-size:14px;outline:none">`;

  return readHtml + editHtml;
}
  
function renderProgPhone(phoneValue, patientId) {
  const clean = String(phoneValue).replace(/\D/g, '');
  const others = getOtherPatientsWithPhone(phoneValue, patientId);
  const othersHtml = others.length ? `<div style="display:flex;flex-wrap:wrap;gap:4px;justify-content:center;max-width:220px">
    ${others.map(o => `<span data-a="tel-shared" data-id="${esc(o.id)}" title="Abrir ficha de ${esc(o.nombre)}" style="display:inline-block;max-width:180px;padding:2px 8px;border-radius:999px;background:var(--chip);color:var(--chip-tx);font-weight:700;font-size:10.5px;cursor:pointer;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;vertical-align:middle">👤 ${esc(o.nombre)}</span>`).join('')}
  </div>` : '';
  return `<div style="display:flex;flex-direction:column;align-items:center;gap:4px">
    <button type="button" data-a="prog-tel" data-n="${esc(clean)}" data-id="${esc(patientId)}" style="display:inline-flex;align-items:center;gap:4px;background:#fff;padding:6px 14px;border-radius:999px;font-weight:700;font-size:13px;border:1px solid var(--border);color:var(--burgundy);cursor:pointer">📞 ${esc(phoneValue)}</button>
    ${othersHtml}
  </div>`;
}
/* ---------- CATÁLOGO ---------- */

  const TBL_COLS = [
  { k:'nombre',       l:'Nombre',        get: p => p.nombre || '' },
  { k:'tipo',         l:'Tipo',          get: p => p.tipo || '' },

    { k:'est',          l:'Estatus',       get: p => p.est || '', isEst:true },
{ k:'seccion',      l:'Sección',       get: p => p.seccion || '' },
{ k:'area',         l:'Área',          get: p => p.area || '' },
    
    { k:'prog',         l:'Programación',  get: p => {
      if (!p.prog_fecha) return '';
      return p.prog_fecha + (p.prog_hora ? ' ' + p.prog_hora : '');
    } },
  { k:'vf',           l:'Visita fué',    get: p => p.vf || '' },
  { k:'nv',           l:'#V',            get: p => p.nv || '' },
  { k:'ultimaVisita', l:'Últ. visita',   get: p => p.ultimaVisita || '' },
  { k:'colonia',      l:'Colonia',       get: p => p.colonia || '' },
  { k:'calle',        l:'Calle',         get: p => p.calle || '' },
  { k:'numExt',       l:'No. Ext',       get: p => p.numExt || '' },
  { k:'numInt',       l:'No. Int',       get: p => p.numInt || '' },
  { k:'mz',           l:'Mz',            get: p => p.mz || '' },
  { k:'lt',           l:'Lt',            get: p => p.lt || '' },
  { k:'municipio',    l:'Municipio',     get: p => p.municipio || '' },
  { k:'estado',       l:'Estado',        get: p => p.estado || '' },
  { k:'sexo',         l:'Sexo',          get: p => p.sexo || '' },
  { k:'edad',         l:'Edad',          get: p => p.edad || '' },
  { k:'dep',          l:'Dependencia',   get: p => p.dep || '' },
  { k:'curp',         l:'CURP',          get: p => p.curp || '' },
  { k:'folio',        l:'Folio',         get: p => p.folio || '' },
  { k:'motivo',       l:'Motivo',        get: p => p.motivo || '' },
  { k:'refs',         l:'Refs',          get: p => p.refs || '' },
  { k:'tel1',         l:'Tel 1',         get: p => p.tel1 || '' },
  { k:'tel2',         l:'Tel 2',         get: p => p.tel2 || '' },
  { k:'diag',         l:'Diagnóstico',   get: p => p.diag || '' },
  { k:'med',          l:'Medicamentos',  get: p => p.med || '' },
];
  
/* ═══════════════════════════════════════════════════════════════
   🔐 WRAPPER: cifra/descifra TODO lo que entra/sale de IndexedDB
   ═══════════════════════════════════════════════════════════════ */
const RAW_OFFDB = window.OFFDB;
const OFFDB = {

  
  async get(store, id) {
    const r = await RAW_OFFDB.get(store, id);
    if (!r) return r;
    if (r._enc && APP_KEY) {
      try { return { ...(await CRYPT.decryptJSON(APP_KEY, r._enc)), id: r.id || id }; }
      catch (e) {
        console.warn('[OFFDB.get] decrypt fail, purging stale record', id, e);
        // 🆕 Stale record: delete so it gets re-fetched fresh from server
        try { await RAW_OFFDB.del(store, id); } catch {}
        // 🆕 Flag for full re-download
        try { localStorage.setItem('needsFullReload', '1'); } catch {}
        return null;
      }
    }
    return r;
  },

  
  async put(store, obj) {
    if (store === 'patients' && APP_KEY && !obj._enc) {
      const { id, ...rest } = obj;
      return RAW_OFFDB.put(store, { id, _enc: await CRYPT.encryptJSON(APP_KEY, rest) });
    }
    return RAW_OFFDB.put(store, obj);
  },
  del: (s, id) => RAW_OFFDB.del(s, id),
  markDeleted: (id) => RAW_OFFDB.markDeleted(id),

      async saveAllPatients(pac, opts) {
  if (!APP_KEY) return RAW_OFFDB.saveAllPatients(pac, opts);
  const enc = {};
  const entries = Object.entries(pac);
  const CHUNK = 100;
  for (let i = 0; i < entries.length; i += CHUNK) {
    const chunk = entries.slice(i, i + CHUNK);
    await Promise.all(chunk.map(async ([id, p]) => {
      enc[id] = { id, _enc: await CRYPT.encryptJSON(APP_KEY, p) };
    }));
  }
  return RAW_OFFDB.saveAllPatients(enc, opts);
},


    async getPatientsObject() {
  const raw = await RAW_OFFDB.getPatientsObject();
  if (!APP_KEY) return raw;
  const out = {};
  const purgeList = [];
  const entries = Object.entries(raw);

  // 🆕 Procesar en lotes de 200 para evitar picos de memoria (20k decrypts)
  const CHUNK = 300;
  for (let i = 0; i < entries.length; i += CHUNK) {
    const chunk = entries.slice(i, i + CHUNK);
    await Promise.all(chunk.map(async ([id, p]) => {
      if (p && p._enc) {
        try { out[id] = await CRYPT.decryptJSON(APP_KEY, p._enc); }
        catch (e) {
          console.warn('[OFFDB.getPatientsObject] decrypt fail, purging', id);
          purgeList.push(id);
        }
      } else out[id] = p;
    }));
  }

  if (purgeList.length) {
    for (const id of purgeList) { try { await RAW_OFFDB.del('patients', id); } catch {} }
    try { localStorage.setItem('needsFullReload', '1'); } catch {}
  }
  return out;
},

  
 

                         async queueSync(item) {
  if (!APP_KEY) return RAW_OFFDB.queueSync(item);

  // 🆕 MERGE de pac_patch pendientes ANTES de cifrar.
  //    Antes: dos pac_patch al mismo pid → el segundo BORRABA al primero.
  //    Ahora: se descifran todos, se fusionan (el más nuevo gana campo por
  //    campo), se borran los viejos y se encola UN solo item con todo.
  const action = item.a || item.action;
  const pid = item.pid || (item.d && item.d.pid);

  if (action === 'pac_patch' && pid) {
    try {
      const rawQueue = await RAW_OFFDB.getQueue();
      const existing = rawQueue
        .filter(q => q && (q.a === 'pac_patch' || q.action === 'pac_patch') &&
                     (q.pid === pid || (q.d && q.d.pid === pid)))
        .sort((a, b) => (a.id || 0) - (b.id || 0));   // viejo → nuevo

      if (existing.length) {
        let mergedD = {};
        for (const ex of existing) {
          let exD = {};
          if (ex._enc && typeof ex.d === 'string') {
            try { exD = await CRYPT.decryptJSON(APP_KEY, ex.d); } catch (e) {
              console.warn('[queueSync] decrypt ex falló, ignorando item', ex.id);
            }
          } else if (ex.d && typeof ex.d === 'object') {
            exD = ex.d;
          }
          mergedD = { ...mergedD, ...exD };        // más nuevo gana
          await RAW_OFFDB.removeFromQueue(ex.id);
        }
        // El item actual es el más nuevo → se aplica al final
        item = { ...item, d: { ...mergedD, ...(item.d || {}) } };
      }
    } catch (e) {
      console.warn('[queueSync] merge pac_patch falló, se encola sin merge', e);
    }
  }

  const d = await CRYPT.encryptJSON(APP_KEY, item.d);
  return RAW_OFFDB.queueSync({ ...item, d, _enc: 1 });
},

  
  async getQueue() {
    const raw = await RAW_OFFDB.getQueue();
    if (!APP_KEY) return raw;
    const out = [];
    for (const item of raw) {
      if (item._enc) {
        try { out.push({ ...item, d: await CRYPT.decryptJSON(APP_KEY, item.d), _enc: 0 }); } catch {}
      } else out.push(item);
    }
    return out;
  },
  removeFromQueue: (id) => RAW_OFFDB.removeFromQueue(id)
};

let PR = {}; try { PR = JSON.parse(localStorage.getItem('bPref')||'{}'); } catch {}
  

  const savePr = () => { try { localStorage.setItem('bPref', JSON.stringify({fl:FL})); } catch {} };
  
const FL_DEFAULT = { ch:{}, calle:[], colonia:[], num:[], mz:[], municipio:[], loc:'', vis:'', foto:'', sortCol:'az', sortCalle:'az', sortNum:'asc' };
let FL = Object.assign({}, FL_DEFAULT, PR.fl || {});

// 🛡️ Sanitización: si bPref se corrompió (JSON parcial, tipos erróneos),
//    forzamos tipos correctos para que pass() / _fltHTML() / calc() no truenen.
FL.ch        = (FL.ch && typeof FL.ch === 'object' && !Array.isArray(FL.ch)) ? FL.ch : {};
FL.calle     = Array.isArray(FL.calle)     ? FL.calle     : [];
FL.colonia   = Array.isArray(FL.colonia)   ? FL.colonia   : [];
FL.num       = Array.isArray(FL.num)       ? FL.num       : [];
FL.mz        = Array.isArray(FL.mz)        ? FL.mz        : [];
FL.municipio = Array.isArray(FL.municipio) ? FL.municipio : [];
// Limpiar claves internas de FL.ch que no sean arrays
for (const k of Object.keys(FL.ch)) if (!Array.isArray(FL.ch[k])) FL.ch[k] = [];
  
  
  const FC = [
  ['ultimaVisita','Última visita', p=>p.ultimaVisita||''],
  ['est','Estatus', p=>p.est||'', v=>EST[v]||'—'],
  ['vf','Visita fué', p=>p.vf||''],
  ['nv','#V', p=>p.nv||''],
  ['tipo','Tipo', p=>p.tipo||''],
  ['seccion','Sección', p=>p.seccion||''],
  ['area','Área', p=>p.area||''],
    
  ['sexo','Sexo', p=>p.sexo||''],
  ['dep','Dependencia', p=>p.dep||''],
  ['motivo','Motivo', p=>p.motivo||''],
];

/* ---------- API ---------- */
async function api(a, d={}) {
  /* ═══════════════════════════════════════════════════════════
     READ: pacs  →  IndexedDB primero si offline; red primero si online
     ═══════════════════════════════════════════════════════════ */
   if (a === 'pacs') {
  if (navigator.onLine) {
    try {
      let allPac = {}, startAt = '', firstRev = 0;
      let pages = 0;
      do {
        const r = await fetch('/api/ocrdb', {
          method: 'POST',
          headers: {'Content-Type':'application/json'},
          body: JSON.stringify({a, t:T, startAt, limit: 2000, ...d})
        });
        if (r.status === 401) { logout(); throw new Error('Sesión expirada'); }
        if (!r.ok) throw new Error('HTTP ' + r.status);
        const j = await r.json();
        if (!firstRev && j && j.rev) firstRev = j.rev;
        if (j && j.pac) Object.assign(allPac, j.pac);   // solo acumula
        startAt = (j && j.nextPage) || '';
        pages++;
        if (pages > 100) throw new Error('Demasiadas páginas (>200k registros). Abortando.');
      } while (startAt);

      // 🆕 UNA sola escritura atómica al final con replaceAll:true.
      //    - Purga registros stale (pacientes borrados en el servidor que
      //      quedaron huérfanos en IndexedDB).
      //    - Solo se ejecuta si TODAS las páginas se descargaron OK.
      //    - Si falla la descarga, se lanza error ANTES de tocar la caché
      //      (mejor caché vieja completa que caché nueva parcial).
      await OFFDB.saveAllPatients(allPac, { replaceAll: true });

      return { pac: allPac, rev: firstRev, pageSize: pages * 2000 };
    } catch (e) {
      if (/Sesión|401/.test(e.message)) throw e;
      console.warn('[pacs] red falló, usando caché:', e.message);
    }
  }
  const pac = await OFFDB.getPatientsObject();
  if (Object.keys(pac).length) return { pac, offline: true };
  throw new Error('Sin conexión y sin datos cacheados. Conéctate al menos una vez.');
}
  

  /* ═══════════════════════════════════════════════════════════
     WRITE: pac_patch, visit_save, visit_del, pac_del
     ═══════════════════════════════════════════════════════════ */
  if (['pac_patch', 'visit_save', 'visit_del', 'pac_del'].includes(a)) {
    // Generar vid determinístico para visit_save (permite sync bidireccional)
    if (a === 'visit_save' && !d.vid) {
      d.vid = 'v' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    }

    // Aplicar localmente (optimistic update)
    await applyLocalWrite(a, d);

      if (navigator.onLine) {
      try {
        const r = await fetch('/api/ocrdb', {
          method: 'POST',
          headers: {'Content-Type':'application/json'},
          body: JSON.stringify({a, t:T, ...d})
        });
        if (r.status === 401) { logout(); throw new Error('Sesión expirada'); }
        if (!r.ok) throw new Error('HTTP ' + r.status);
             const j = await r.json();
        // 🆕 NO adelantar lastSyncRev aquí: si dos clientes escriben al mismo
        // tiempo, este cliente "se saltaría" el cambio del otro. El próximo
        // load() fetchea los deltas (los propios son idempotentes).
        return j;
      } catch (e) {
        if (/Sesión|401/.test(e.message)) throw e;
        console.warn('[write] red falló, encolando:', e.message);
      }
    }

      // Offline o falló la red → encolar (pid y vid arriba para dedup en db-offline)
    await OFFDB.queueSync({ a, d, pid: d.pid, vid: d.vid });
    return { ok: 1, offline: true, queued: true, vid: d.vid, v: d.v };
 }
  /* ═══════════════════════════════════════════════════════════
     RESTO: pass-through con manejo de 401
     ═══════════════════════════════════════════════════════════ */
  const r = await fetch('/api/ocrdb', {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({a, t:T, ...d})
  });
let j;
try { j = JSON.parse(await r.text()); }
catch { j = {error:'El servidor respondió '+r.status+' sin datos'}; }
if (!r.ok) {
  // 🆕 NO cerrar sesión en pin_check ni device_*
  const NO_LOGOUT = new Set(['login', 'pin_check', 'pin_check_ocr', 'device_check', 'device_register']);
  if (r.status === 401 && !NO_LOGOUT.has(a)) logout();
  throw new Error(j.error || r.status);
}
return j;
}

/* ─── Aplicar escritura en IndexedDB (sin red) ─── */
async function applyLocalWrite(action, data) {
  if (!APP_KEY) { console.warn('[applyLocalWrite] sin APP_KEY, saltando'); return; }
  try {
    if (action === 'pac_patch') {
      // 🆕 Invalidar cache del badge si cambió prog_fecha (saveProg/removeProg/delta)
      if (data.d && data.d.prog_fecha !== undefined) _invalidateProgBadge();
      const p = await OFFDB.get('patients', data.pid);
      if (p) {
        await OFFDB.put('patients', { ...p, ...data.d });
      } else {
        // 🆕 missing or corrupt → force reload so we re-fetch from server
        try { localStorage.setItem('needsFullReload', '1'); } catch {}
      }
    } else if (action === 'visit_save') {
      const p = await OFFDB.get('patients', data.pid);
      if (p) {
        p.vis = p.vis || {};
        p.vis[data.vid] = { ...(p.vis[data.vid] || {}), ...data.v, at: Date.now() };
        await OFFDB.put('patients', p);
      } else {
        try { localStorage.setItem('needsFullReload', '1'); } catch {}
      }
    } else if (action === 'visit_del') {
      const p = await OFFDB.get('patients', data.pid);
      if (p && p.vis && p.vis[data.vid]) {
        delete p.vis[data.vid];
        await OFFDB.put('patients', p);
      } else if (!p) {
        try { localStorage.setItem('needsFullReload', '1'); } catch {}
      }
    } else if (action === 'pac_del') {
      await OFFDB.del('patients', data.pid);
      await OFFDB.markDeleted(data.pid);
    }
  } catch (e) {
    console.warn('[applyLocalWrite]', e);
  }
}

/* ─── Procesar cola de sync cuando vuelve la conexión ─── */
let _syncing = false;

  // 🆕 Retries persistidos para que el MAX_RETRIES funcione
const _retryKey = (item) => 'syncRetry_' + (item.a || '?') + '_' + ((item.d && (item.d.pid || item.d.vid || item.d.id)) || '') + '_' + (item.id || '');
const _getRetries = (item) => parseInt(localStorage.getItem(_retryKey(item)) || '0', 10) || 0;
const _setRetries = (item, n) => { try { localStorage.setItem(_retryKey(item), String(n)); } catch(e){} };
const _clearRetries = (item) => { try { localStorage.removeItem(_retryKey(item)); } catch(e){} };
  
/* ═══════════════════════════════════════════════════════════════
   🔋 Modo Ahorro · helpers de UI + activación
   ═══════════════════════════════════════════════════════════════ */
function _syncSavingBtn() {
  const btn = document.getElementById('btnSaving');
  if (btn) btn.classList.toggle('on', SAVING_MODE);
}

function _setSavingMode(on) {
  SAVING_MODE = !!on;

  try {
    if (SAVING_MODE) localStorage.setItem('bSavingMode', '1');
    else localStorage.removeItem('bSavingMode');
  } catch (e) {}

  _syncSavingBtn();

  /* ── AL ACTIVAR ── */
  if (SAVING_MODE) {
    // 1) Apagar INEGI si estaba activo (evita seguir gastando en tiles WMS)
    // 🆕 Bypass del guard: _toggleInegiMap early-retorna si SAVING_MODE=true,
    //    pero AQUÍ necesitamos que SÍ ejecute el apagado. Toggle temporal.
    if (INEGI_ACTIVE) {
      const wasSaving = SAVING_MODE;
      SAVING_MODE = false;
      try { _toggleInegiMap(); } catch (e) {}
      SAVING_MODE = wasSaving;
    }
    // 2) Apagar pines dorados (⭐) si estaban activos
    if (SHOW_REMOTE) {
      SHOW_REMOTE = false;
      try { localStorage.setItem('bSentLoc', '0'); } catch (e) {}
      const btnSL = document.getElementById('btnSentLoc');
      if (btnSL) btnSL.classList.remove('on');
      try { _drawRemoteMarkers(); } catch (e) {}
    }
    // 3) Feedback
    if (navigator.vibrate) navigator.vibrate([20, 40, 20]);
    toast('🔋 Modo ahorro activo · 0 consumo de datos');
    return;
  }

  /* ── AL DESACTIVAR ── */
  if (navigator.vibrate) navigator.vibrate(20);
  toast('📶 Modo normal · Sincronizando…');

  // Refrescar vista actual + ficha abierta (recarga fotos reales)
  setTimeout(() => {
    try {
      if (VIEW === 'list') calc();
      else if (VIEW === 'map') { if (MAP) drawMap(); }
      else if (VIEW === 'prog') { renderProgCal(); drawProgCards(); }
      else if (VIEW === 'table') renderTbl();
    } catch (e) {}

    try {
      if (!$('#detail').hidden && cur && P[cur]) tab(TAB, true);
    } catch (e) {}

    // Disparar sincronización
    if (navigator.onLine) {
      processSyncQueue().catch(() => {});
      setTimeout(() => {
        catFlushQueue().catch(() => {});
        catPull().catch(() => {});
      }, 1500);
    }
  }, 300);
}

/* ═══════════════════════════════════════════════════════════════
   Procesar cola de sync (con guard de modo ahorro)
   ═══════════════════════════════════════════════════════════════ */
async function processSyncQueue() {
  if (_syncing || !navigator.onLine || !T) return;
  if (SAVING_MODE) return;   // 🆕 Modo ahorro: no sincronizar
  _syncing = true;

  const MAX_RETRIES = 5;           // 🆕 máximo de reintentos por ítem
  const FETCH_TIMEOUT = 15000;     // 🆕 timeout por fetch (15s)

  try {
    const queue = await OFFDB.getQueue();
    if (!queue.length) return;

    let ok = 0, fail = 0, authFailed = false, dropped = 0;

    // 🆕 helper fetch con timeout
    const fetchWithTimeout = (url, opts, ms) => {
  let timer;
  return Promise.race([
    fetch(url, opts),
    new Promise((_, rej) => { timer = setTimeout(() => rej(new Error('timeout')), ms); })
  ]).finally(() => clearTimeout(timer));
};

      let _lastProgress = 0;
    const _total = queue.length;
    for (let _i = 0; _i < queue.length; _i++) {
      const item = queue[_i];

      // 🆕 feedback de progreso cada 10 items (solo si hay muchos)
    if (_total >= 5 && _i >= 5 && _i - _lastProgress >= 5) {
  _lastProgress = _i;
  toast(`🔄 Sincronizando ${_i}/${_total}…`, 0, true);   // ← persistente
}

      // 🆕 NO descartar por fallos de red/5xx. Solo descartar si:
      //   (a) es un error 4xx explícito (ya manejado abajo con 404),
      //   (b) o lleva >6h sin éxito Y superó MAX_RETRIES (probablemente permanente).
      // Conectividad inestable NO debe causar pérdida de datos.
if (_getRetries(item) >= MAX_RETRIES) {
  const lastTryKey = 'syncLastTry_' + item.id;
  const lastTry = +localStorage.getItem(lastTryKey) || 0;
  const ageMs = Date.now() - lastTry;
  if (ageMs < 6 * 3600e3) {
    // Intento reciente → dejar en cola para la próxima
    fail++;
    continue;
  }
  console.warn('[sync] descartando tras 6h sin éxito (probable error permanente):', item);
  try { await OFFDB.removeFromQueue(item.id); } catch {}
  _clearRetries(item);
  try { localStorage.removeItem(lastTryKey); } catch {}
  dropped++;
  continue;
}

      try {
        const r = await fetchWithTimeout('/api/ocrdb', {
          method: 'POST',
          headers: {'Content-Type':'application/json'},
          body: JSON.stringify({a: item.a, t:T, ...item.d})
        }, FETCH_TIMEOUT);

                if (r.ok) {
  await OFFDB.removeFromQueue(item.id);
  _clearRetries(item);
  try { localStorage.removeItem('syncLastTry_' + item.id); } catch {}
  ok++;
  continue;
}

                // 401 → token inválido → logout inmediato
        if (r.status === 401) {
          authFailed = true;
          break;
        }

        // 404 → paciente ya no existe en servidor → descartar de la cola
        if (r.status === 404) {
          console.warn('[sync] 404, descartando:', item.a, item.d?.pid);
          await OFFDB.removeFromQueue(item.id);
          _clearRetries(item);
          try { localStorage.removeItem('syncLastTry_' + item.id); } catch {}
          dropped++;
          continue;
        }

        // 🆕 4xx cliente (400/403/413/422…) → reintentar NO ayuda.
        //    Descartar YA. (429 se deja abajo como reintentable.)
        if (r.status >= 400 && r.status < 500 && r.status !== 429) {
          console.warn('[sync] 4xx permanente, descartando:', r.status, item.a, item.d?.pid);
          await OFFDB.removeFromQueue(item.id);
          _clearRetries(item);
          try { localStorage.removeItem('syncLastTry_' + item.id); } catch {}
          dropped++;
          continue;
        }

        // 5xx o 429 → sí reintentar (transitorio)
        fail++;
        _setRetries(item, _getRetries(item) + 1);
        try { localStorage.setItem('syncLastTry_' + item.id, String(Date.now())); } catch {}
        
        

      } catch (e) {
        fail++;
        console.warn('[sync] error en ítem:', e.message);
      }
    }

    // 🆕 Logout inmediato si auth falló
    if (authFailed) {
      toast('🔒 Sesión expirada. Inicia sesión de nuevo.', 1);
      setTimeout(() => logout(), 1500);
      return;
    }

    // 🆕 Feedback al usuario con TODOS los estados
    if (ok > 0 && fail === 0 && dropped === 0) {
      toast(`✓ ${ok} cambio${ok>1?'s':''} sincronizado${ok>1?'s':''}`);
    } else if (ok > 0) {
      toast(`✓ ${ok} sincronizados · ⚠️ ${fail + dropped} pendientes`, 1);
    } else if (fail > 0) {
      toast(`⚠️ ${fail} sin sincronizar. Reintentará al reconectar.`, 1);
    }

    // 🆕 tras sincronizar, solo pedir la rev (20 bytes) — sin re-descargar todo
    // 🆕 tras sincronizar NO tocamos lastSyncRev.
    // El siguiente load() verá que el server avanzó y aplicará TODOS los
    // deltas pendientes (incluidos los propios, que son idempotentes).
    if (ok > 0 && T) {
      // Aplicar deltas inmediatamente para no dejar la UI desactualizada
      try {
        const since = +localStorage.getItem('lastSyncRev') || 0;
        const delta = await api('pacs_delta', { since });
        if (delta && !delta.full && Array.isArray(delta.changes)) {
          for (const ch of delta.changes) {
            try {
                      if (ch.kind === 'pac') {
          if (ch.action === 'del') {
            delete P[ch.pid];
            await OFFDB.del('patients', ch.pid);
              _invalidateProgBadge();   // 🆕 el conteo puede cambiar

            // 🔧 Si estamos viendo al paciente borrado, cerrar el detalle
            if (cur === ch.pid && !$('#detail').hidden) {
              closeD();
              toast('El paciente que veías fue eliminado por otro usuario', 1);
            }
           } else {
                  const cur = P[ch.pid] || {};
                  P[ch.pid] = { ...cur, ...(ch.data || {}) };
                  // 🆕 si el delta toca prog_fecha, invalidar el badge
                  if (ch.data && ch.data.prog_fecha !== undefined) _invalidateProgBadge();
                  await OFFDB.put('patients', { id: ch.pid, ...P[ch.pid] });
                }
              } else if (ch.kind === 'visit') {
                const pat = P[ch.pid];
                if (!pat) continue;
                pat.vis = pat.vis || {};
                if (ch.action === 'del') delete pat.vis[ch.vid];
                else pat.vis[ch.vid] = ch.data;
                await OFFDB.put('patients', { id: ch.pid, ...pat });
              }
            } catch (e) { console.warn('[sync] delta apply', e); }
          }
          if (delta.rev) localStorage.setItem('lastSyncRev', String(delta.rev));
        } else if (delta && delta.full) {
          // el servidor pidió full (muchos cambios) → marcar para que
          // el próximo load() haga descarga completa
          localStorage.setItem('lastSyncRev', '0');
        }
      } catch (e) { console.warn('[sync] delta falló', e); }
      calc();
    }

  } finally {
    _syncing = false;
  }
}

window.addEventListener('online', () => {
  console.log('[sync] conexión restaurada');

  // 🆕 Modo ahorro: no hacer nada aunque vuelva la señal
  if (SAVING_MODE) return;

  setTimeout(processSyncQueue, 800);

  // 🆕 Sincronizar catastro también al recuperar conexión
  setTimeout(async () => {
    try {
      if (SAVING_MODE) return;   // doble check (por si cambió mientras tanto)
      await catFlushQueue();   // sube cambios pendientes de manzanas/casas
      await catPull();         // trae novedades del servidor
    } catch (e) { console.warn('[online] catSync', e); }
  }, 1500);
});
window.addEventListener('offline', () => {
  console.log('[sync] sin conexión');
});
  

  // 🆕 FIX RENDIMIENTO: throttle a 30s. Antes se ejecutaba clearTimeout+setTimeout
//    en CADA click/tecla/touch. En pantallas con muchas interacciones sumaba.
let _bumpLastRun = 0;
const bump = () => {
  const now = Date.now();
  if (now - _bumpLastRun < 30000) return;
  _bumpLastRun = now;
  clearTimeout(idle);
  if (T) idle = setTimeout(() => { logout(); }, 8*60*60e3);
};
  ['click','keydown','touchstart'].forEach(e => addEventListener(e, bump, {passive:true}));
  

/* ═══════════════════════════════════════════════════════════════
   🛠️ SETUP INICIAL · PIN + contraseña + cifrado
   ═══════════════════════════════════════════════════════════════ */
async function setupPIN(token) {
  // ═══════════════════════════════════════════════════════════
  // 🔒 LOCKOUT INCREMENTAL (mismo contador que verifyPIN)
  // ═══════════════════════════════════════════════════════════
  const fails = STORE.get(STORE.KEY_FAIL) || { n: 0, until: 0 };

  if (fails.n >= 6) {
    await _nuclearReset('PIN');
    return false;
  }
  if (fails.until && Date.now() < fails.until) {
    const mins = Math.ceil((fails.until - Date.now()) / 60000);
    toast(`🔒 Bloqueado. Espera ${mins} min (${fails.n}/6)`, 1);
    return false;
  }

  const pin = await promptPINModal();
  if (!pin) return false;
  if (!/^\d{6,8}$/.test(pin)) { toast('PIN debe ser 6-8 dígitos', 1); return false; }

  try {
    const r = await fetch('/api/ocrdb', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ a: 'pin_check', t: token, pin })
    });
    const j = await r.json();
    if (!r.ok || !j.ok) {
      // 🔒 Registrar fallo con lockout incremental
      const n = (fails.n || 0) + 1;
      let until = 0, msg = '';
      if (n === 1 || n === 2) {
        msg = `PIN incorrecto (${n}/6)`;
      } else if (n === 3) {
        until = Date.now() + 5 * 60e3;
        msg = `🔒 Bloqueado 5 min (3/6)`;
      } else if (n === 4) {
        until = Date.now() + 15 * 60e3;
        msg = `🔒 Bloqueado 15 min (4/6)`;
      } else if (n === 5) {
        until = Date.now() + 60 * 60e3;
        msg = `🔒 Bloqueado 60 min (5/6). ⚠️ UN INTENTO MÁS BORRARÁ TODOS LOS DATOS.`;
      } else if (n >= 6) {
        await _nuclearReset('PIN');
        return false;
      }
      STORE.set(STORE.KEY_FAIL, { n, until });
      toast(msg, 1);
      return false;
    }

    // ✅ Correcto → resetear contador y guardar
    STORE.del(STORE.KEY_FAIL);
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const bits = await CRYPT.pbkdf2(pin, salt);
    STORE.set(STORE.KEY_PIN, {
      h: CRYPT.hex(bits),
      salt: CRYPT.hex(salt),
      exp: Date.now() + 7 * 24 * 3600e3,
      v: 2
    });
    return true;

  } catch (e) { toast('Error: ' + e.message, 1); return false; }
}

/* ═══════════════════════════════════════════════════════════════
   🔑 NUEVO SISTEMA DE LLAVES · MK (Master) + DK (Data)
   ═══════════════════════════════════════════════════════════════ */

const SALT_MK = 'bSaltMK';
const SALT_DK = 'bSaltDK';
const WRAPPED_DK_KEY = 'bWrappedDK';       // IndexedDB (no localStorage)
const PIN_VERIFY = 'bPinVerify';           // Hash de DK para verificar PIN


  function _b64(bytes) {
  // ArrayBuffer no es iterable → convertir a Uint8Array antes de spread
  const arr = bytes instanceof ArrayBuffer ? new Uint8Array(bytes)
            : bytes instanceof Uint8Array ? bytes
            : new Uint8Array(bytes);
  // Loop en vez de spread (evita stack overflow con buffers grandes)
  let s = '';
  for (let i = 0; i < arr.length; i++) s += String.fromCharCode(arr[i]);
  return btoa(s);
}
  
  function _unb64(s) { return Uint8Array.from(atob(s), c => c.charCodeAt(0)); }

/** Deriva MK = PBKDF2(password, saltMK) */
async function deriveMK(password) {
  let s = STORE.get(SALT_MK);
  if (!s) {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    s = { salt: CRYPT.hex(salt) };
    STORE.set(SALT_MK, s);
  }
  return await CRYPT.pbkdf2(password, CRYPT.unhex(s.salt));
}

/** Deriva DK = PBKDF2(password || "|" || pin, saltDK) */
async function deriveDK(password, pin) {
  let s = STORE.get(SALT_DK);
  if (!s) {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    s = { salt: CRYPT.hex(salt) };
    STORE.set(SALT_DK, s);
  }
  return await CRYPT.pbkdf2(password + '|' + pin, CRYPT.unhex(s.salt));
}

/** Cifra DK con MK y lo guarda en IndexedDB (por dispositivo) */
async function saveWrappedDK(mkBits, dkBits) {
  const mkKey = await CRYPT.aesKey(mkBits);
  const b64 = await CRYPT.encryptJSON(mkKey, { dk: _b64(dkBits) });
  // Guardar en IndexedDB (store 'meta' o similar)
  try { await RAW_OFFDB.put('meta', { key: 'wrappedDK', value: b64 }); } catch (e) {
  STORE.set(WRAPPED_DK_KEY, { value: b64 });
}
  // También guardar verificador del PIN
  const pinHash = await CRYPT.sha256(_b64(dkBits) + '|verify');
  STORE.set(PIN_VERIFY, { h: pinHash });
}

/** Devuelve el b64 del wrappedDK (IDB primero, localStorage como fallback).
 *  Es la ÚNICA fuente de verdad de "¿hay enrollment en este device?" */
async function getWrappedDK() {
  let b64 = null;
  try {
    const stored = await RAW_OFFDB.get('meta', 'wrappedDK');
    b64 = stored?.value || null;
  } catch (e) {}
  if (!b64) b64 = STORE.get(WRAPPED_DK_KEY)?.value || null;
  return b64;
}

/** Recupera DK descifrado con MK */
async function loadWrappedDK(mkBits) {
  const b64 = await getWrappedDK();
  if (!b64) return null;

  try {
    const mkKey = await CRYPT.aesKey(mkBits);
    const obj = await CRYPT.decryptJSON(mkKey, b64);
    return _unb64(obj.dk);
  } catch (e) {
    console.warn('[crypto] wrappedDK corrupto', e);
    return null;
  }
}

/** Borra el wrappedDK local (fuerza re-enrollment con PIN) */
async function clearWrappedDK() {
  try { await RAW_OFFDB.del('meta', 'wrappedDK'); } catch (e) {}
  STORE.del(WRAPPED_DK_KEY);
  STORE.del(PIN_VERIFY);
}

/** Setup inicial (enrollment): requiere password + PIN */
async function setupKeys(password, pin, forceResync) {
  const mkBits = await deriveMK(password);
  const dkBits = await deriveDK(password, pin);

  // Guardar verificador de MK (password)
  const pwHash = await CRYPT.sha256(_b64(mkBits));
  STORE.set(STORE.KEY_PW, { h: pwHash });

  // Guardar DK cifrado con MK
  await saveWrappedDK(mkBits, dkBits);

  // APP_KEY = DK → ahora sí, todo se cifra con DK
  APP_KEY = await CRYPT.aesKey(dkBits);

  
  // 🆕 SIEMPRE limpiar cache de pacientes y cola cuando setupKeys corre.
  // Motivo: si por CUALQUIER razón (cambio de PIN_APP en server, saltDK
  // perdido, cambio de password en server, etc.) el DK derivado difiere
  // del anterior, los registros viejos quedan ilegibles. Al limpiar, el
  // siguiente load() los trae frescos cifrados con el DK actual.
  try {
    const existing = await RAW_OFFDB.getPatientsObject();
    for (const id of Object.keys(existing)) await RAW_OFFDB.del('patients', id);
    // 🆕 También purgar la cola de sync (items cifrados con DK viejo son irrecuperables)
    try {
      const q = await RAW_OFFDB.getQueue();
      for (const item of q) await RAW_OFFDB.removeFromQueue(item.id);
    } catch {}
    // Forzar full re-download en el próximo load()
    try { localStorage.removeItem('lastSyncRev'); } catch {}
  } catch (e) {}
  
}

async function verifyPIN() {
  const pinData = STORE.get(STORE.KEY_PIN);
  if (!pinData) { toast('PIN no configurado', 1); return false; }

  // ═══════════════════════════════════════════════════════════
  // 🔒 LOCKOUT INCREMENTAL: 3→5min, 4→15min, 5→60min, 6→WIPE
  // ═══════════════════════════════════════════════════════════
  const fails = STORE.get(STORE.KEY_FAIL) || { n: 0, until: 0 };

  // 🛑 NUCLEAR: 6 fallos acumulados → wipe total
  if (fails.n >= 6) {
    await _nuclearReset('PIN');
    return false;
  }

  // ⏳ Lockout activo
  if (fails.until && Date.now() < fails.until) {
    const mins = Math.ceil((fails.until - Date.now()) / 60000);
    toast(`🔒 Bloqueado. Espera ${mins} min (${fails.n}/6)`, 1);
    return false;
  }

  const entered = await promptPINModal();
  if (!entered) return false;

  // ═══════════════════════════════════════════════════════════
  // VERIFICAR CON MIGRACIÓN AUTOMÁTICA v1 (SHA-256) → v2 (PBKDF2)
  // ═══════════════════════════════════════════════════════════
  let matches = false;
  if (pinData.v === 2) {
    // Formato nuevo: PBKDF2
    const bits = await CRYPT.pbkdf2(entered, CRYPT.unhex(pinData.salt));
    matches = CRYPT.hex(bits) === pinData.h;
  } else {
    // Formato legacy: SHA-256 (verificar y auto-upgrade si acierta)
    const h = await CRYPT.sha256(entered + '|' + pinData.salt);
    matches = h === pinData.h;
    if (matches) {
      // 🆕 Auto-migración silenciosa a PBKDF2
      const newSalt = crypto.getRandomValues(new Uint8Array(16));
      const newBits = await CRYPT.pbkdf2(entered, newSalt);
      STORE.set(STORE.KEY_PIN, {
        h: CRYPT.hex(newBits),
        salt: CRYPT.hex(newSalt),
        exp: pinData.exp,
        v: 2
      });
    }
  }

  if (!matches) {
    const n = (fails.n || 0) + 1;
    let until = 0, msg = '';

    if (n === 1 || n === 2) {
      msg = `PIN incorrecto (${n}/6)`;
    } else if (n === 3) {
      until = Date.now() + 5 * 60e3;
      msg = `🔒 Bloqueado 5 min (3/6)`;
    } else if (n === 4) {
      until = Date.now() + 15 * 60e3;
      msg = `🔒 Bloqueado 15 min (4/6)`;
    } else if (n === 5) {
      until = Date.now() + 60 * 60e3;
      // ⚠️ Verificar si hay datos sin sincronizar
      let pending = 0;
      try { pending = (await OFFDB.getQueue()).length; } catch(e){}
      msg = pending > 0
        ? `🔒 Bloqueado 60 min (5/6). ⚠️ Tienes ${pending} cambios sin sincronizar. Conéctate a internet ANTES del 6to intento.`
        : `🔒 Bloqueado 60 min (5/6). ⚠️ UN INTENTO MÁS BORRARÁ TODOS LOS DATOS LOCALES.`;
    } else if (n >= 6) {
      await _nuclearReset('PIN');
      return false;
    }

    STORE.set(STORE.KEY_FAIL, { n, until });
    toast(msg, 1);
    return false;
  }

  // ✅ PIN correcto → resetear contador
  STORE.del(STORE.KEY_FAIL);
  return true;
}

async function verifyPasswordOffline() {
  // 🕐 Doble verificación (defense-in-depth: _boot ya lo chequea, pero si
  //    por cualquier razón se llegara a llamar directo, debe fallar igual).
  if (_clockTampered()) {
    try { STORE.del(STORE.KEY_T); } catch {}
    T = '';
    return { ok: false, cancelled: true };
  }

  // 🆕 Forzar re-login si el usuario lleva > MAX_OFFLINE_DAYS sin internet.
  //    Cierra el gap del "rollback pre-apertura": aunque el watermark no
  //    detecte el retroceso, el token caduca por tiempo sin servidor.
  if (_tooLongOffline()) {
    STORE.del(STORE.KEY_T);
    T = '';
    return { ok: false, expired: true };
  }

  const pwData = STORE.get(STORE.KEY_PW);
  if (!pwData) { toast('Contraseña no configurada', 1); return { ok: false }; }

  const fails = STORE.get('bPwFail') || { n: 0, until: 0 };
  if (fails.n >= 6) { await _nuclearReset('Contraseña'); return { ok: false }; }
  if (fails.until && Date.now() < fails.until) {
    toast(`🔒 Bloqueado. Espera ${Math.ceil((fails.until-Date.now())/60000)} min (${fails.n}/6)`, 1);
    return { ok: false };
  }

  const entered = await promptPasswordModal();
  if (!entered) return { ok: false, cancelled: true };

  const mkBits = await deriveMK(entered);
  const pwHash = await CRYPT.sha256(_b64(mkBits));
  if (pwHash !== pwData.h) {
    const n = (fails.n || 0) + 1;
    let until = 0, msg = '';
    if (n <= 2) msg = `Contraseña incorrecta (${n}/6)`;
    else if (n === 3) { until = Date.now() + 5*60e3; msg = '🔒 Bloqueado 5 min (3/6)'; }
    else if (n === 4) { until = Date.now() + 15*60e3; msg = '🔒 Bloqueado 15 min (4/6)'; }
    else if (n === 5) { until = Date.now() + 60*60e3; msg = '🔒 Bloqueado 60 min (5/6)'; }
    else { await _nuclearReset('Contraseña'); return { ok: false }; }
    STORE.set('bPwFail', { n, until });
    toast(msg, 1);
    return { ok: false };
  }
  STORE.del('bPwFail');

const mkKey = await CRYPT.aesKey(mkBits);
const tEnc = STORE.get(STORE.KEY_T);
if (tEnc && tEnc._enc) {
  try {
    const dec = await CRYPT.decryptJSON(mkKey, tEnc._enc);
    // 🆕 Expiración de 3 días — usa _effectiveNow() para que el watermark
    //    (máximo timestamp visto) también cuente. Aunque el usuario retroceda
    //    el reloj, effectiveNow refleja la hora REAL última conocida.
    if (dec.exp && dec.exp < _effectiveNow()) {   // ← ✅ FIX: _effectiveNow()
      STORE.del(STORE.KEY_T);
      T = '';
      return { ok: false, expired: true, password: entered, mkBits };
    }
    T = dec.t;
  } catch(e) {
    console.warn('[auth] token cifrado con MK anterior — forzar re-login');
    STORE.del(STORE.KEY_T);
    T = '';
    // 🆕 Token corrupto/ilegible → NO dejar pasar con T vacío (provoca 401 posterior)
    return { ok: false, expired: true, password: entered, mkBits };
  }
}

// Ahora intentar cargar DK para desbloquear datos
const dkBits = await loadWrappedDK(mkBits);
if (!dkBits) {
  return { ok: false, needEnroll: true, password: entered, mkBits };
}

APP_KEY = await CRYPT.aesKey(dkBits);
return { ok: true, password: entered, mkBits, dkBits };
}

  /* ═══════════════════════════════════════════════════════════════
   🛑 WIPE DE SEGURIDAD · Se ejecuta tras 6 intentos fallidos
   Borra: tokens, PIN, password hash, caché cifrado, cola de sync,
          preferencias. Fuerza re-login con internet.
   ═══════════════════════════════════════════════════════════════ */
async function _nuclearReset(motivo) {
  // Marca para que _boot sepa que fue un wipe intencional (no error)
  try { sessionStorage.setItem('bNuke', '1'); } catch(e){}

  // 1) Borrar credenciales de acceso
  try {
    STORE.del(STORE.KEY_T);      // Token sesión
    STORE.del(STORE.KEY_N);      // Nombre usuario
    STORE.del(STORE.KEY_PIN);    // Hash PIN
    STORE.del(STORE.KEY_PW);     // Hash password (¡pierde la salt!)
    STORE.del(STORE.KEY_FAIL);   // Contador PIN
    STORE.del('bPwFail');        // Contador password

     STORE.del('bSaltMK');
  STORE.del('bSaltDK');
  STORE.del('bPinVerify');
  STORE.del('bWrappedDK');
  STORE.del('bDeviceId');
  await RAW_OFFDB.del('meta', 'wrappedDK').catch(()=>{});
    
  } catch(e){}

  // 2) Limpiar preferencias (se regeneran solas)
  try {
    sessionStorage.clear();
    localStorage.removeItem('tblPref');
    localStorage.removeItem('bPref');
    localStorage.removeItem('bSavingMode');       // 🆕 resetear Modo Ahorro
    SAVING_MODE = false;                          // 🆕 resetear en memoria
    
    localStorage.removeItem('pacsCache_default');
    localStorage.removeItem('lastPacsAt');
    localStorage.removeItem('lastSyncRev');
    localStorage.removeItem('needsFullReload');   // 🆕
    localStorage.removeItem('pinLockUntil');      // 🆕 lockout PIN
    // 🆕 Re-marcar DESPUÉS del clear (el setItem inicial se borraba)
    sessionStorage.setItem('bNuke', '1');
  } catch(e){}

  // 3) Borrar caché de pacientes (cifrados) — el servidor es la fuente de verdad
  //    🆕 clear() = 1 transacción IDB (<100 ms) vs 20k deletes individuales (10-20s)
  try { await RAW_OFFDB.clear('patients'); } catch(e){}

  // 4) Borrar cola de sincronización (cambios no subidos)
  //    🆕 Mismo fix: 1 transacción atómica
  try { await RAW_OFFDB.clear('syncQueue'); } catch(e){}

  // 5) Avisar y recargar (dar tiempo a IDB a terminar de borrar)
  try {
    alert(
      `🛑 BLOQUEO DE SEGURIDAD\n\n` +
      `Motivo: 6 intentos fallidos de ${motivo || 'autenticación'}.\n\n` +
      `Por seguridad, TODOS los datos locales han sido eliminados.\n\n` +
      `Al continuar deberás:\n` +
      `  1. Conectarte a internet\n` +
      `  2. Iniciar sesión con tu usuario y contraseña\n` +
      `  3. Configurar un nuevo PIN\n\n` +
      `Los datos de pacientes se re-descargarán del servidor.`
    );
  } catch(e){}

  // 🆕 Esperar un tick para que terminen los await de IDB antes del reload
setTimeout(() => location.reload(), 800);
}
  
/* ═══════════════════════════════════════════════════════════════
   🔓 PANTALLA DE BLOQUEO · PIN + contraseña
   ═══════════════════════════════════════════════════════════════ */
async function showLockScreen() {
  const loginDiv = document.getElementById('login');
  if (loginDiv) { loginDiv.hidden = true; loginDiv.style.display = ''; }

  // 🆕 Mostrar la interfaz vacía detrás del modal (P = {} → sin datos)
  const appDiv = document.getElementById('app');
  if (appDiv) appDiv.hidden = false;

  const pwResult = await verifyPasswordOffline();
  if (!pwResult || pwResult.cancelled) {
    if (appDiv) appDiv.hidden = true;          // 🆕 ocultar de nuevo
    if (loginDiv) loginDiv.hidden = false;
    return;
  }

    if (pwResult.expired) {
    toast('⏰ Sesión expirada (3 días). Inicia sesión de nuevo.', 1);
    if (appDiv) appDiv.hidden = true;          // 🆕
    if (loginDiv) loginDiv.hidden = false;
    return;
  }
  
  if (!pwResult.ok && !pwResult.needEnroll) {
    if (appDiv) appDiv.hidden = true;          // 🆕
    if (loginDiv) loginDiv.hidden = false;
    return;
  }

  // 🆕 AHORA sí: con password correcto (o before enroll), verificar bloqueo
// ⚠️ SOLO si NO estamos en Modo Ahorro. En Modo Ahorro no consumimos datos
//    para esto; el login (que sí permite auth) ya verifica en su momento.
if (navigator.onLine && !SAVING_MODE) {
  const dev = await getDeviceInfo();
  try {
    const r = await api('device_check', { deviceId: dev.deviceId, username: STORE.get(STORE.KEY_N) });
    if (r && r.blocked === true) {
      await clearWrappedDK();
      pwResult.needEnroll = true;
      toast('🚫 Este dispositivo fue bloqueado. Re-enrola con PIN.', 1);
    }
  } catch (e) { /* silencioso — puede ser offline */ }
}

  if (pwResult.needEnroll) {
    // 🆕 Bloqueo temprano: si está bloqueado, ni siquiera abrir el modal
    const _lockUntil3 = +localStorage.getItem('pinLockUntil') || 0;
    if (Date.now() < _lockUntil3) {
      const _mins3 = Math.ceil((_lockUntil3 - Date.now()) / 60000);
      toast(`🔒 PIN bloqueado. Espera ${_mins3} minuto(s).`, 1);
      if (appDiv) appDiv.hidden = true;    // 🆕 arreglo bug #app visible
      if (loginDiv) loginDiv.hidden = false;
      return;
    }

    // 🆕 Pedir SOLO el PIN (password ya está en pwResult.password)
    const pin = await promptPINModal();
    if (!pin) {
      if (appDiv) appDiv.hidden = true;     // 🆕 ocultar app vacía al cancelar
      if (loginDiv) loginDiv.hidden = false;
      return;
    }
    if (!/^\d{6,8}$/.test(pin)) {
      toast('PIN 6-8 dígitos', 1);
      if (appDiv) appDiv.hidden = true;     // 🆕
      if (loginDiv) loginDiv.hidden = false;
      return;
    }

    try {
      await _pinCheckWithLockout(pin);
    } catch (e) {
      toast('PIN: ' + (e.message || 'incorrecto'), 1);
      if (appDiv) appDiv.hidden = true;    // 🆕 arreglo bug #app visible
      if (loginDiv) loginDiv.hidden = false;
      return;
    }

    // Enrolar usando el password ya capturado
    await setupKeys(pwResult.password, pin, false);

    const dev = await getDeviceInfo();
    try {
await api('device_register', dev);
    } catch(e){}
  }

  // Desbloqueado — T ya quedó seteado por verifyPasswordOffline (descifrado con MK).
  // NO intentar descifrarlo otra vez con APP_KEY (DK): siempre falla y borra la sesión.
  if (!T) {
    // Fallback defensivo: re-descifrar con la MK correcta que devolvió verifyPasswordOffline
    try {
      const mkKey = await CRYPT.aesKey(pwResult.mkBits);
      const tEnc = STORE.get(STORE.KEY_T);
      if (tEnc && tEnc._enc) {
        const dec = await CRYPT.decryptJSON(mkKey, tEnc._enc);
        T = dec.t;
      }
    } catch (e) {
      // Token realmente corrupto → pedir re-login
      STORE.del(STORE.KEY_T);
      T = '';
    }
  }

  _pendingInstallPrompt = !_isPwaInstalled();   // 📲 Mostrar prompt si no está instalada
  await start(STORE.get(STORE.KEY_N) || 'Brigadistas');
}


  /* ═══════════════════════════════════════════════════════════════
   🔒 Helper: pin_check con lockout local persistente
   - Evita abrir el modal de PIN mientras el server está bloqueando
   - El server es la fuente de verdad (RATE_KV, 15 min)
   - Este helper replica ese estado en localStorage para UX
   ═══════════════════════════════════════════════════════════════ */
async function _pinCheckWithLockout(pin) {
  // 1) Si ya está bloqueado localmente → ni llamar al server
  const until = +localStorage.getItem('pinLockUntil') || 0;
  const now   = Date.now();
  if (now < until) {
    const mins = Math.ceil((until - now) / 60000);
    throw new Error(`🔒 PIN bloqueado. Espera ${mins} minuto(s).`);
  }

  // 2) Llamar al server
  try {
    const r = await api('pin_check', { pin });
    if (!r.ok) throw new Error('PIN incorrecto');
    // Éxito → limpiar lockout local (el server ya hizo clearFails)
    try { localStorage.removeItem('pinLockUntil'); } catch {}
    return r;
  } catch (e) {
    // 3) Si el server dice "Demasiados intentos" → guardar 15 min localmente
    if (/Demasiados intentos/i.test(e.message || '')) {
      try { localStorage.setItem('pinLockUntil', String(Date.now() + 15 * 60e3)); } catch {}
    }
    throw e;
  }
}
  
/* ═══════════════════════════════════════════════════════════════
   🔐 LOGIN (con contraseña + setup de PIN si es primera vez)
   ═══════════════════════════════════════════════════════════════ */
async function login() {
  const u = $('#lu').value.trim(), p = $('#lp').value;
  if (!u || !p) { $('#le').textContent = 'Ingresa usuario y contraseña'; return; }

  if (!navigator.onLine) {
    $('#le').textContent = 'Sin conexión. Necesitas internet para el primer inicio.';
    return;
  }

  $('#le').textContent = '';
  $('#lgo').disabled = true; $('#lgo').textContent = 'Entrando…';

  try {
    const j = await api('login', { u, p });
    T = j.t;
    STORE.set(STORE.KEY_N, j.name || u);

    const exp = Date.now() + 3 * 24 * 3600e3;
    STORE.set(STORE.KEY_T, { t: j.t, exp, _pendingEncrypt: true });

    // ── ¿Ya existe enrollment en este device? ──
// 🆕 Reglas claras:
//   • PIN se pide SOLO si: device nuevo, wrappedDK borrado, o device bloqueado
//   • PIN NO se pide si: sesión expiró pero enrollment sigue intacto
const pwData = STORE.get(STORE.KEY_PW);
let needPin = !pwData;   // device nuevo (nunca enrolado) → pedir PIN

// Verificar si hay wrappedDK local (IDB + localStorage, igual que loadWrappedDK)
if (!needPin) {
  const b64 = await getWrappedDK();
  if (!b64) needPin = true;   // cache borrado o device bloqueado
}

// Si device está bloqueado remotamente → forzar PIN
if (!needPin && navigator.onLine) {
  const dev = await getDeviceInfo();
  try {
    const r = await api('device_check', { deviceId: dev.deviceId });
    if (r && r.blocked === true) {
      await clearWrappedDK();
      needPin = true;
      toast('🚫 Dispositivo bloqueado. Re-enrola con PIN.', 1);
    }
  } catch(e){}
}

    if (needPin) {
      // ── ENROLLMENT: pedir PIN ──
      // 🆕 Bloqueo temprano: si está bloqueado, no abrir el modal
      const _lockUntil = +localStorage.getItem('pinLockUntil') || 0;
      if (Date.now() < _lockUntil) {
        const _mins = Math.ceil((_lockUntil - Date.now()) / 60000);
        throw new Error(`🔒 PIN bloqueado. Espera ${_mins} minuto(s).`);
      }

      const pin = await promptPINModal();
      if (!pin) throw new Error('PIN requerido');
      if (!/^\d{6,8}$/.test(pin)) throw new Error('PIN debe ser 6-8 dígitos');

      // Validar PIN contra server (con lockout local)
      try {
        await _pinCheckWithLockout(pin);
      } catch (e) { throw new Error(e.message || 'PIN incorrecto'); }

      // Derivar MK+DK, guardar wrappedDK
// 🆕 Detectar migración: si NO había SALT_MK antes, es un user viejo → forzar resync
const wasMigrated = !!STORE.get('bSaltMK');
await setupKeys(p, pin, !wasMigrated);
      
      // Registrar dispositivo en Firebase
      const dev = await getDeviceInfo();
      try { await api('device_register', dev); } catch(e){}
    } else {
      // ── LOGIN NORMAL: solo password ──
      const mkBits = await deriveMK(p);
      const pwHash = await CRYPT.sha256(_b64(mkBits));
      if (pwHash !== pwData.h) {
        // 🆕 Contraseña cambió en el server → re-enrolar
        try {
          await clearWrappedDK();
          STORE.del(STORE.KEY_PW);
          STORE.del('bSaltMK');
          STORE.del('bSaltDK');
          const all = await RAW_OFFDB.getPatientsObject();
          for (const id of Object.keys(all)) await RAW_OFFDB.del('patients', id);
        } catch(e) { console.warn('[login] reset', e); }
        toast('🔄 Contraseña actualizada. Re-enrola tu PIN.', 0);

        // 🆕 Bloqueo temprano: si está bloqueado, no abrir el modal
        const _lockUntil2 = +localStorage.getItem('pinLockUntil') || 0;
        if (Date.now() < _lockUntil2) {
          const _mins2 = Math.ceil((_lockUntil2 - Date.now()) / 60000);
          throw new Error(`🔒 PIN bloqueado. Espera ${_mins2} minuto(s).`);
        }

        const pin = await promptPINModal();
        if (!pin) throw new Error('PIN requerido para re-enrolar');
        if (!/^\d{6,8}$/.test(pin)) throw new Error('PIN 6-8 dígitos');
        try {
          await _pinCheckWithLockout(pin);
        } catch (e) { throw new Error(e.message || 'PIN incorrecto'); }
        await setupKeys(p, pin, true);
        const dev = await getDeviceInfo();
        try { await api('device_register', dev); } catch(e){}
      } else {
        const dkBits = await loadWrappedDK(mkBits);
        if (!dkBits) throw new Error('Enrollment corrupto. Vuelve a iniciar sesión.');
        APP_KEY = await CRYPT.aesKey(dkBits);
        if (navigator.onLine) {
          const dev = await getDeviceInfo();
          try { await api('device_register', dev); } catch(e){}
        }
      }
    }

   //  Cifrar token con MK (no con DK) para permitir pin_check sin wrappedDK
try {
  const mkBits = await deriveMK(p);
  const mkKey = await CRYPT.aesKey(mkBits);
  const EXP_MS = 3 * 24 * 3600e3;   // 🆕 3 días
  const encT = await CRYPT.encryptJSON(mkKey, { t: j.t, exp: Date.now() + EXP_MS });
  STORE.set(STORE.KEY_T, { _enc: encT, exp: Date.now() + EXP_MS });
} catch(e){ console.warn('No se pudo cifrar token', e); }

       _pendingInstallPrompt = !_isPwaInstalled();   // 📲 Si NO está instalada, intentar mostrar
    await start(j.name || u);

  } catch (e) {
    
    try { STORE.del(STORE.KEY_T); } catch(_) {}
    T = '';
    if ($('#le')) $('#le').textContent = e.message || 'Error al entrar';
    if ($('#lgo')) { $('#lgo').disabled = false; $('#lgo').textContent = 'Entrar'; }
  }
}


  async function getDeviceInfo() {
  let deviceId = localStorage.getItem('bDeviceId');
  if (!deviceId) {
    deviceId = (crypto.randomUUID ? crypto.randomUUID()
      : 'd-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10));
    localStorage.setItem('bDeviceId', deviceId);
  }

  const ua = navigator.userAgent || '';
  let brand = 'unknown', model = 'unknown', platform = 'unknown';

  // userAgentData (Chrome 90+)
  if (navigator.userAgentData) {
    try {
      const hv = await navigator.userAgentData.getHighEntropyValues(['model', 'platform']);

      // 🆕 UA-CH mete marcas "GREASE" (Not/A)Brand, Not_A Brand…) y marcas del
      //    NAVEGADOR (Chromium, Chrome, Edge…) que NO identifican el teléfono.
      //    Filtramos ambas: queremos la marca REAL del dispositivo si existe.
      const BROWSER_BRAND = /^(chromium|google chrome|microsoft edge|opera|firefox|safari|android webview)$/i;
      const realBrands = (navigator.userAgentData.brands || [])
        .map(b => b.brand)
        .filter(b => b && !/^not/i.test(b) && !BROWSER_BRAND.test(b));

      // Si el navegador no expone la marca real (Android rara vez lo hace),
      // queda '' y el display solo mostrará el MODELO (moto edge 60 neo).
      brand = realBrands[0] || '';

      model    = hv.model    || model;
      platform = hv.platform || navigator.userAgentData.platform || platform;
    } catch(e){}
  }

  // Fallback regex
  if (model === 'unknown' || platform === 'unknown') {
    const android = ua.match(/Android\s+([^;]+);\s*([^)]+)/);
    if (android) {
      platform = 'Android ' + android[1].trim();
      model = android[2].trim();
      if (!brand || brand === 'unknown') brand = 'Android';
    } else if (/iPhone/.test(ua)) { brand = 'Apple'; model = 'iPhone'; platform = 'iOS'; }
    else if (/iPad/.test(ua))     { brand = 'Apple'; model = 'iPad';   platform = 'iOS'; }
    else if (/Macintosh/.test(ua)){ brand = 'Apple'; model = 'Mac';    platform = 'macOS'; }
    else if (/Windows/.test(ua))  { brand = 'Microsoft'; model = 'PC'; platform = 'Windows'; }
    else if (/Linux/.test(ua))    { brand = 'Linux'; model = 'PC';     platform = 'Linux'; }
  }

  return { deviceId, brand, model, platform, ua: ua.slice(0, 300) };
}

  
/* ═══════════════════════════════════════════════════════════════
   🔄 LOGOUT · solo borra token (conserva PIN y pw para offline)
   ═══════════════════════════════════════════════════════════════ */
function logout() {
  try {
    STORE.del(STORE.KEY_T);
    STORE.del(STORE.KEY_N);
    sessionStorage.clear();
  } catch (e) {}
  location.reload();
}
  
  
async function start(name) {
  const lf = document.getElementById('loginForm');
  if (lf) lf.remove();
  $('#login').remove();
  $('#app').hidden = false;
  $('#ttl').textContent = name || 'Brigadistas';
  history.replaceState({view: 'list'}, '');
  bump();

  // 🆕 ─────────────────────────────────────────────────────────
  // PEDIR PERSISTENCIA de storage al navegador (una sola vez)
  // Con esto: IndexedDB no se evapora por presión de espacio
  // ─────────────────────────────────────────────────────────────
  try {
    if (navigator.storage && navigator.storage.persist) {
      const already = await navigator.storage.persisted();
      if (!already) {
        const granted = await navigator.storage.persist();
        console.log('[storage] persist:', granted ? '✅ granted' : '⚠️ denied');
      }
      // Log de diagnóstico (visible en consola)
      if (navigator.storage.estimate) {
        const est = await navigator.storage.estimate();
        const usedMB = (est.usage / 1024 / 1024).toFixed(1);
        const quotaMB = (est.quota / 1024 / 1024).toFixed(0);
        console.log(`[storage] ${usedMB} MB / ${quotaMB} MB`);
      }
    }
  } catch (e) { console.warn('[storage.persist]', e); }
  // ─────────────────────────────────────────────────────────────

  await load();
  // 🆕 Cargar catastro ANTES de mostrar la UI para que la ficha del paciente
  // muestre el vínculo a casa aunque el usuario nunca abra el Mapa
  try { await loadCatastroFromDB(); } catch (e) { console.warn('[start] catastro', e); }
  // 🆕 Flush de catastro pendiente → pull del servidor (silencioso)
  try { await catSyncOnStart(); } catch (e) { console.warn('[start] catSync', e); }
  // 🆕 Cargar cache cifrado de ubicaciones YA con APP_KEY listo
  try { await _loadRemoteCache(); } catch (e) { console.warn('[start] remoteCache', e); }
  setView('list', false);
}
  
// 🔒 SEGURIDAD: usar 'click' en lugar de 'submit'. Sin formularios nativos.
$('#lgo').addEventListener('click', login);
  
$('#q').addEventListener('input', () => { clearTimeout(calc._h); calc._h = setTimeout(calc, 150); });

  // 🔒 Permite que Enter funcione en los campos SIN triggerear submit nativo
$('#lu').addEventListener('keydown', e => {
  if (e.key === 'Enter') { e.preventDefault(); login(); }
});
$('#lp').addEventListener('keydown', e => {
  if (e.key === 'Enter') { e.preventDefault(); login(); }
});
  
function invalidatePacsCache() {
  // 🆕 No-op. El delta sync detecta cambios automáticamente.
  // Se mantiene como stub para no romper las ~10 llamadas existentes.
}

  
async function load(force = false) {

    // 🆕 Auto-heal: if a previous decrypt failed, force full re-download
  if (localStorage.getItem('needsFullReload') === '1') {
    console.warn('[load] needsFullReload flag set, forcing full re-download');
    try { localStorage.removeItem('needsFullReload'); } catch {}
    try { localStorage.removeItem('lastSyncRev'); } catch {}
    force = 'full';
    P = {};
    // 🔧 Purga paralela en lotes de 50: 20k registros en ~3–5s (antes 30–40s).
    //    Solo borra registros que NO se pueden descifrar (DK cambió, cache corrupto).
    try {
      const all = await RAW_OFFDB.getPatientsObject();
      const ids = Object.keys(all);
      const corrupt = [];
      const CHUNK = 50;
      for (let i = 0; i < ids.length; i += CHUNK) {
        const slice = ids.slice(i, i + CHUNK);
        await Promise.all(slice.map(async (id) => {
          const rec = all[id];
          if (rec && rec._enc) {
            try { await CRYPT.decryptJSON(APP_KEY, rec._enc); }
            catch { corrupt.push(id); }
          }
        }));
      }
      for (const id of corrupt) {
        try { await RAW_OFFDB.del('patients', id); } catch {}
      }
    } catch {}
    try { localStorage.removeItem('needsFullReload'); } catch {}
  }
  

  let hasData = Object.keys(P).length > 0;
  const lastSync = +localStorage.getItem('lastSyncRev') || 0;
  const _noNet = !navigator.onLine || SAVING_MODE;   // 🆕 incluye modo ahorro
  

  // 🆕 Si no hay datos en memoria, precargar desde IndexedDB
  //    (necesario en reload: P arranca vacío pero IDB tiene todo)
  if (!hasData) {
  try {
    const cached = await OFFDB.getPatientsObject();
    if (Object.keys(cached).length) {
      P = cached;
      hasData = true;
      console.log('[load] preloaded from IDB:', Object.keys(P).length);
      // 🆕 MOSTRAR CACHÉ INMEDIATAMENTE — no esperar al delta sync
      sync = '📴 Caché';
      calc();
    }
  } catch (e) { console.warn('[load] IDB preload', e); }
}

   // ── OFFLINE (o modo ahorro) ──
  if (_noNet) {
    if (hasData) { sync = SAVING_MODE ? '🔋 Ahorro' : '📴 Offline'; calc(); return; }
    try {
      const pac = await OFFDB.getPatientsObject();
      if (Object.keys(pac).length) {
        P = pac;
        sync = SAVING_MODE ? '🔋 Ahorro' : '📴 Offline';
        calc();
        return;
      }
    } catch {}
    toast('Sin conexión y sin datos cacheados. Conéctate al menos una vez.', 1);
    calc();
    return;
  }

  // ── ONLINE: primero subir cambios pendientes ──
  try {
    const pending = await OFFDB.getQueue();
    if (pending.length > 0) await processSyncQueue();
  } catch {}

  // ── Sin datos locales → descarga completa ──
  if (!hasData || force === 'full' || lastSync === 0) {
    try {
      const j = await api('pacs');
      P = j.pac || {};
      _searchCache.clear();   // 🆕 invalidar índice completo (P fue reemplazado)
      if (j.rev) localStorage.setItem('lastSyncRev', String(j.rev));
      
      const ts = new Date().toLocaleTimeString('es-MX', {hour:'numeric', minute:'2-digit'});
      sync = '✓ ' + ts;
      calc();
    } catch (e) {
      toast(e.message, 1);
      try {
        const pac = await OFFDB.getPatientsObject();
        if (Object.keys(pac).length) { P = pac; sync = '📴 Offline'; }
      } catch {}
      calc();
    }
    return;
  }

  // ── DELTA SYNC ──
  try {
    const meta = await api('pacs_meta');
    if (!meta || +meta.rev === lastSync) {
      sync = '✓ sin cambios';
      calc();
      return;
    }

    const delta = await api('pacs_delta', { since: lastSync });

    // El server pidió full (demasiados cambios acumulados o base nueva)
    if (delta && delta.full) {
      return load('full');
    }

    if (!delta || !Array.isArray(delta.changes)) {
      sync = '⚠️ sin cambios';
      calc();
      return;
    }

    let applied = 0;
    for (const ch of delta.changes) {
      try {
                   if (ch.kind === 'pac') {
                     
                            if (ch.action === 'del') {
                  delete P[ch.pid];
                  await OFFDB.del('patients', ch.pid);
                  _invalidateProgBadge();   // 🆕 el conteo puede cambiar
                  // 🔧 Cerrar detalle si estamos viendo al borrado
                  if (cur === ch.pid && !$('#detail').hidden) {
                    
                    closeD();
                    toast('El paciente que veías fue eliminado por otro usuario', 1);
                  }
                   } else {
            // merge (puede ser patch parcial o paciente completo)
            const cur = P[ch.pid] || {};
            P[ch.pid] = { ...cur, ...(ch.data || {}) };
            // 🆕 si el delta toca prog_fecha, invalidar el badge
            if (ch.data && ch.data.prog_fecha !== undefined) _invalidateProgBadge();
            await OFFDB.put('patients', { id: ch.pid, ...P[ch.pid] });
          }
          applied++;
        } else if (ch.kind === 'visit') {
          const pat = P[ch.pid];
          if (!pat) continue;
          pat.vis = pat.vis || {};
          if (ch.action === 'del') delete pat.vis[ch.vid];
          else pat.vis[ch.vid] = ch.data;
          await OFFDB.put('patients', { id: ch.pid, ...pat });
          applied++;
        }
      } catch (e) { console.warn('[delta] error aplicando', ch, e); }
    }

    if (delta.rev) localStorage.setItem('lastSyncRev', String(delta.rev));
    _searchCache.clear();   // 🆕 invalidar índice (llegaron cambios del server)
    sync = `✓ ${applied} cambio${applied===1?'':'s'}`;
    calc();
  } catch (e) {
    console.warn('[load] delta falló:', e.message);
    sync = '⚠️ usando caché';
    calc();
  }
}

/* ---------- FILTRAR / ORDENAR / LISTAR ---------- */
function pass(p) {
  for (const [k,, f] of FC) {
    const s = FL.ch[k];
    if (s && s.length && !s.includes(f(p))) return 0;
  }
  // 🆕 Filtro Municipio
  if (FL.municipio && FL.municipio.length &&
      !FL.municipio.some(m => (isReal(p.municipio) ? norm(p.municipio) : 'SN') === norm(m))) return 0;

  // 🆕 FIX: comparar con 'SN' cuando el campo está vacío.
  //    Antes comparaba norm('') con norm('SN') → nunca matcheaba → 0 resultados.
  if (FL.colonia.length && !FL.colonia.some(c =>
      (isReal(p.colonia) ? norm(p.colonia) : 'SN') === norm(c))) return 0;
  if (FL.mz.length && !FL.mz.some(m =>
      (isReal(p.mz) ? norm(p.mz) : 'SN') === norm(m))) return 0;
  if (FL.calle.length && !FL.calle.some(c =>
      (isReal(p.calle) ? norm(p.calle) : 'SN') === norm(c))) return 0;
  if (FL.num.length && !FL.num.some(n => String(p.numExt||'').replace(/\D/g,'') === String(n).replace(/\D/g,''))) return 0;

  if (FL.loc && (FL.loc === 'con') !== !!p.lat) return 0;
  if (FL.foto && (FL.foto === 'con') !== !!p.fachada) return 0;
  return 1;
}
  
const cmp = (a,b) => {
  if (a === '' && b === '') return 0;
  if (a === '') return 1;
  if (b === '') return -1;
  return _cmpStr(a, b);            // 🆕 Collator cacheado
};

  
const numVal = v => { const n = parseInt(String(v||'').replace(/\D/g,''), 10); return isNaN(n) ? Infinity : n; };

/* ═══════════════════════════════════════════════════════════════
   🆕 ORDEN DE HOME · replica la configuración de "Ver tabla"
   (TBL.sorts con modos asc/desc/freq, solo columnas visibles)
   ═══════════════════════════════════════════════════════════════ */
const TBL_COL_MAP = Object.fromEntries(TBL_COLS.map(c => [c.k, c]));
const TBL_NUMCOLS = new Set(['numExt','numInt','mz','lt','edad','ultimaVisita','nv']);

function sortHomeByTable(ids){
  if (!ids.length) return ids;

  // 1. Solo sorts de columnas visibles y existentes (igual que la tabla)
  const sorts = TBL.sorts.filter(s =>
    s && TBL.cols.includes(s.k) && TBL_COL_MAP[s.k]
  );

  
  // ✅ Sin orden manual → fallback alfabético por NOMBRE (consistente con tabla)
  if (!sorts.length) {
    return ids.slice().sort((a, b) => _cmpStr(P[a]?.nombre || '', P[b]?.nombre || ''));
  }
  

  // 2. Precalcular frecuencia (modo 'freq') sobre el CONJUNTO YA FILTRADO
  const freqMaps = {};
  for (const s of sorts){
    if (s.mode !== 'freq') continue;
    const col = TBL_COL_MAP[s.k];
    const counts = {};
    for (const id of ids){
      const v = String(col.get(P[id]) ?? '').trim();
      if (v === '' || v === '—') continue;
      counts[v] = (counts[v] || 0) + 1;
    }
    freqMaps[s.k] = counts;
  }

  // 3. Comparator multi-criterio idéntico a renderTbl()
  const compare = (a, b) => {
    for (const s of sorts){
      const col = TBL_COL_MAP[s.k];
      const sa = String(col.get(a) ?? '').trim();
      const sb = String(col.get(b) ?? '').trim();
      const ea = sa === '' || sa === '—';
      const eb = sb === '' || sb === '—';

      // ── MODO FRECUENCIA: repetidos primero, vacíos al final ──
      if (s.mode === 'freq'){
        if (ea && !eb) return 1;
        if (!ea && eb) return -1;
        const freq = freqMaps[s.k] || {};
        const ca = freq[sa] || 0, cb = freq[sb] || 0;
        if (ca !== cb) return cb - ca;
        const r = _cmpStr(sa, sb);
        if (r) return r;
        continue;
      }

      // ── MODO NUMÉRICO ASC / DESC ──
      if (TBL_NUMCOLS.has(s.k)){
        const na = parseInt(sa.replace(/\D/g,''), 10);
        const nb = parseInt(sb.replace(/\D/g,''), 10);
        if (isNaN(na) && isNaN(nb)) continue;
        if (isNaN(na)) return 1;
        if (isNaN(nb)) return -1;
        const r = (na - nb) * (s.mode === 'desc' ? -1 : 1);
        if (r) return r;
        continue;
      }

      // ── MODO TEXTO ASC / DESC ──
      const r = _cmpStr(sa, sb) * (s.mode === 'desc' ? -1 : 1);
      if (r) return r;
    }
    return 0;
  };

  return ids.slice().sort((a, b) => compare(P[a], P[b]));
}

/* 🆕 Cache del haystack de búsqueda: se llena on-demand y se invalida por id */
const _searchCache = new Map();
function _searchUpsert(id) {
  const p = P[id];
  if (!p) { _searchCache.delete(id); return; }
  _searchCache.set(id, norm([
    p.nombre, p.folio, p.tel1, p.tel2, p.calle, p.colonia, p.refs,
    p.curp, p.numExt, p.numInt, p.mz, p.lt, p.diag, p.motivo,
    p.vf, p.municipio, p.estado, p.ultimaVisita
  ].join(' ')));
}
function _searchGet(id) {
  let h = _searchCache.get(id);
  if (h === undefined) { _searchUpsert(id); h = _searchCache.get(id); }
  return h;
}

function calc(keep) {
  const q = norm($('#q').value).split(/\s+/).filter(Boolean);

  
  LIST = Object.keys(P).filter(id => {
    const p = P[id];
    if (q.length) {
      const h = _searchGet(id);
      if (!q.every(w => h.includes(w))) return 0;
    }
    return pass(p);
  });

  
  // 🆕 Ordenar tarjetas de Home con la MISMA configuración de "Ver tabla"
  LIST = sortHomeByTable(LIST);

  const n = (FL.calle.length?1:0) + (FL.colonia.length?1:0) + (FL.num.length?1:0) + (FL.mz?.length?1:0) + (FL.municipio?.length?1:0) + (FL.loc?1:0) + (FL.foto?1:0)
          + Object.values(FL.ch).filter(a => a.length).length;

    const fbTop = $('#fbTop');
  if (fbTop) {
    const _svg = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>';
    fbTop.innerHTML = _svg + (n ? `<span class="fbdg">${n}</span>` : '');
  }

  // 🆕 Mismo contador en el botón "Filtros" de la barra inferior
  const fbBot = $('#fbBot');
  if (fbBot) {
    const ic = fbBot.querySelector('.ic');
    if (ic) {
      let badge = ic.querySelector('.fbdg');
      if (n) {
        if (!badge) {
          badge = document.createElement('span');
          badge.className = 'fbdg';
          ic.appendChild(badge);
        }
        badge.textContent = n;
      } else if (badge) {
        badge.remove();
      }
    }
  }
  
  const cntTab = $('#cntTab'); if (cntTab) cntTab.textContent = LIST.length;
  const fi = $('#fi'); if (fi) fi.textContent = `Registros: ${LIST.length}${LIST.length < Object.keys(P).length ? ' de '+Object.keys(P).length : ''}`;

   if (!keep) {
    LIM = 60;
    try { localStorage.setItem('bLim', '60'); } catch {}
  }
  drawCards();
  
  
  const more = $('#moreBtn'); if (more) more.hidden = LIST.length <= LIM;

  
  if (VIEW === 'map') drawMap();
  /* 🆕 FIX: refresca la vista Programados si está activa (evita quedar "congelado"
     cuando llega un delta sync con cambios de prog_fecha desde otro dispositivo) */
  if (VIEW === 'prog') { renderProgCal(); drawProgCards(); }
  /* 🆕 FIX 2: refresca la TABLA si está visible (antes quedaba estancada
     cuando un delta sync traía cambios mientras el usuario estaba en Tabla) */
  if (VIEW === 'table') renderTbl();
  /* 🆕 Badge "Programados HOY" (siempre, aunque no estés en la vista Programados) */
  updateProgBadge();
  updateFilterBtn();
  savePr();
}
function updateFilterBtn() {

  

  const b = document.querySelector('[data-a=fapply]');
  if (b) b.textContent = `Ver ${LIST.length} resultados`;
}

/* 🆕 Badge de Programados HOY.
   - Cuenta TODOS los pacientes con prog_fecha = hoy (NO respeta filtros, es global).
   - Se ejecuta desde calc(), saveProg() y removeProg() para mantenerse sincronizado. */
function updateProgBadge() {
  const btn = document.getElementById('navProg');
  if (!btn) return;
  const ic = btn.querySelector('.ic');
  if (!ic) return;

  const todayStr = today();

  // 🆕 Solo recalcular si cambió el día o si el cache fue invalidado
  //    (invalidación manual en pac_patch con prog_fecha, saveProg, removeProg)
  if (_progBadgeCache.day !== todayStr || _progBadgeCache.count < 0) {
    let cnt = 0;
    for (const id in P) {
      const p = P[id];
      if (p && p.prog_fecha === todayStr) cnt++;
    }
    _progBadgeCache = { day: todayStr, count: cnt };
  }
  const cnt = _progBadgeCache.count;

  let badge = ic.querySelector('.progdg');
  if (cnt > 0) {
    if (!badge) {
      badge = document.createElement('span');
      badge.className = 'progdg';
      ic.appendChild(badge);
    }
    badge.textContent = cnt > 99 ? '99+' : String(cnt);
  } else if (badge) {
    badge.remove();
  }
}

  
  

/* ---------- CARDS ---------- */
function addrLine(p) {
  const parts = [];
  if (isReal(p.calle)) parts.push(`<b>${esc(p.calle)}</b>`);
  if (isReal(p.numExt)) parts.push(`#${esc(p.numExt)}`);
  if (isReal(p.numInt)) parts.push(`Int. ${esc(p.numInt)}`);
  if (isReal(p.mz))     parts.push(`Mza. ${esc(p.mz)}`);      // 🆕
  if (isReal(p.lt))     parts.push(`Lt. ${esc(p.lt)}`);        // 🆕
  const col = isReal(p.colonia) ? p.colonia : 'Sin colonia';
  parts.push(`<span class="cn">${esc(col)}</span>`);
  return parts.join(', ') || '<span class="cn">Sin domicilio</span>';
}
/* --- Fecha legible: "lun 13 oct · 09:00" --- */
function fmtProgDate(f, h) {
  if (!f) return '';
  try {
    const parts = String(f).split('-');
    if (parts.length !== 3) return f;
    const [y, m, d] = parts.map(Number);
    const date = new Date(y, m-1, d);
    const dn = ['dom','lun','mar','mié','jue','vie','sáb'][date.getDay()];
    const mn = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'][m-1];
    return `${dn} ${d} ${mn}${h ? ' · '+h : ''}`;
  } catch (e) { return f; }
}

/* 🆕 URL de Google Maps: GPS exacto si existe, si no → dirección aproximada */
function _mapsUrl(p) {
  if (p.lat && p.lon) {
    // ✅ URL oficial de Google Maps: pin EXACTO, sin "snap to address"
    const lat = String(p.lat).trim();
    const lon = String(p.lon).trim();
    return `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`;
  }
  const parts = [];
  if (isReal(p.calle))     parts.push(p.calle);
  if (isReal(p.numExt))    parts.push(p.numExt);
  if (isReal(p.colonia))   parts.push(p.colonia);
  if (isReal(p.municipio)) parts.push(p.municipio);
  if (!parts.length) return '';
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(parts.join(', '))}`;
}

/* --- Renderiza 1 card, con botones según contexto --- */
function buildCardHTML(id, inProgSection) {
  const p = P[id];
  const _progBy = String(p.prog_by || '').trim();
  const _progByHtml = (p.prog_fecha && _progBy)
    ? `<div style="font-size:9px;color:var(--muted);text-align:center;max-width:110px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:600;line-height:1.2;padding:0 2px;margin-top:1px" title="${esc(_progBy)}">👤 ${esc(_shortName(_progBy))}</div>`
    : '';
  const initial = (p.nombre||'?').trim().charAt(0).toUpperCase();
  const phones = [p.tel1, p.tel2].filter(isReal).filter(x => String(x).replace(/\D/g,'').length >= 7);
  const visitNum = isReal(p.ultimaVisita) ? p.ultimaVisita : (isReal(p.nv) ? String(p.nv).replace(/\D/g,'') : '0');
  const motivo = isReal(p.motivo) ? p.motivo : '';
  const vf = isReal(p.vf) ? p.vf : '';
  const refs = isReal(p.refs) ? p.refs : '';
  const estKey = p.est && EST[p.est] ? p.est : null;

  // Línea 2: Tipo · estatus · VF (credencialización) · Motivo   ← SIN "ACTIVO"
  const subParts = [];
  if (p.tipo) {
    // 🆕 Mostrar la edad (solo el número) al lado de PAM/PCD.
    //    Fallback a la CURP si `p.edad` está vacío.
    const edadNum = String(p.edad || _curpEdad(p.curp) || '').trim();
    const edadTxt = edadNum ? ' ' + esc(edadNum) : '';
    subParts.push('(' + esc(p.tipo) + edadTxt + ')');
  }

  
  if (estKey) subParts.push('<span class="est" style="background:' + EC[estKey] + '">' + esc(EST[estKey]) + '</span>');

  // VF (visita fué) → con su color; si no hay valor NO se pinta nada
  if (vf) {
    const vfColor = VC[vf] || '#8B2942';
    subParts.push('<span class="est" style="background:' + vfColor + '">' + esc(vf) + '</span>');
  }

  // MOTIVO → con su color propio; si no hay valor NO se pinta nada
  if (motivo) {
    const motColor = MC[motivo] || '#8B2942';
    subParts.push('<span class="est" style="background:' + motColor + '">' + esc(motivo) + '</span>');
  }

  const subHtml = subParts.join(' · ');

  

  // ✅ 3 estados de programación: past (ámbar) · today (azul) · future (verde)
  const hoyStr = today();
  const progState = !p.prog_fecha ? ''
    : p.prog_fecha < hoyStr ? 'past'
    : p.prog_fecha === hoyStr ? 'today'
    : 'future';
  const avatarCls = progState ? ` prog-${progState}` : '';

  let progBtn = '';
  if (p.prog_fecha) {
    if (inProgSection) {
      // En la sección "Programados" solo la hora (1 línea) — no cambia
      progBtn = `<button class="prog-btn set ${progState}" data-a="prog-edit" data-id="${esc(id)}">🕐 ${esc(p.prog_hora || '—')}</button>`;
    } else {
      // En Home: fecha arriba + hora abajo (2 líneas)
      const fechaTxt = fmtProgDate(p.prog_fecha);      // solo "lun 13 oct"
      const horaTxt  = p.prog_hora || '—';
      progBtn = `<button class="prog-btn prog-btn-dual set ${progState}" data-a="prog-edit" data-id="${esc(id)}">
        <span class="pb-date">📅 ${esc(fechaTxt)}</span>
        <span class="pb-time">🕐 ${esc(horaTxt)}</span>
      </button>`;
    }
  } else if (!inProgSection) {
    progBtn = `<button class="prog-btn" data-a="prog-new" data-id="${esc(id)}">Programar</button>`;
  }
  

  return `
    <div class="pc est-${estKey||0}" data-a="open" data-id="${esc(id)}">
      <div class="rail"></div>
      <div class="main">
        <div class="header">
          <div class="avatar${avatarCls}">${esc(initial)}</div>
          <div class="title">
            <div class="name">${esc(p.nombre||'—')}</div>
            <div class="sub">${subHtml}</div>
          </div>
        </div>
        <div class="info">
          <div class="row"><span class="addr">${addrLine(p)}</span></div>
          ${refs ? `<div class="row"><span class="refs"><b>Refs.:</b> ${esc(refs)}</span></div>` : ''}

                    ${(() => {
                      
                   const url = _mapsUrl(p);
            const label = (p.lat && p.lon) ? 'GPS' : 'Aprox';
         const mapsBtn = url
  ? (p.lat && p.lon)
    ? `<button type="button" class="t" data-a="view-map" data-id="${esc(id)}" title="Ver ubicación del paciente"><span style="font-size:11px">📍</span> ${label}</button>`
    : `<a class="t" href="${url}" target="_blank" rel="noopener noreferrer" data-a="stop" title="Abrir en Google Maps"><span style="font-size:11px">📍</span> ${label}</a>`
  : '';
                      
                      
            const phonesHtml = phones.map(t => `<span class="t" data-a="tel" data-n="${esc(String(t).replace(/\D/g,''))}" data-pid="${esc(id)}">${esc(t)}</span>`).join('');
            const showRow = phones.length || mapsBtn;
            return showRow ? `<div class="row tel">${phonesHtml}${mapsBtn}</div>` : '';
          })()}

          
                  </div>
      </div>
      <div class="actions">
        <button class="visit-btn" data-a="visit" data-id="${esc(id)}">
          <span class="v1">Visitar</span>
          <span class="v2">Visita ${esc(visitNum)}</span>
        </button>
        <div style="display:flex;flex-direction:column;align-items:center;gap:2px;max-width:120px">
          ${progBtn}
          ${_progByHtml}
        </div>
      </div>
    </div>`;
}

/* --- Cards de home --- */
function drawCards() {
  const root = $('#cards'); if (!root) return;

  // 🆕 Caso 1: sin datos cargados aún (P vacío) → mensaje + recargar
  if (Object.keys(P).length === 0) {
    root.innerHTML = `
      <div class="empty">
        <span class="big">⏳</span>
        <div style="font-size:16px;font-weight:700;margin-bottom:14px">Cargando datos...</div>
        <button type="button" data-a="reload-page" class="btn p" style="padding:12px 28px;font-size:14px">
          🔄 Recargar
        </button>
      </div>`;
    return;
  }

  // Caso 2: hay datos pero los filtros no dejan resultados
  if (!LIST.length) {
    root.innerHTML = `<div class="empty"><span class="big">🔍</span>Sin resultados con los filtros actuales.</div>`;
    return;
  }

  // Caso 3: hay datos → renderizar cards normalmente
  const slice = LIST.slice(0, LIM);
  root.innerHTML = slice.map(id => buildCardHTML(id, false)).join('');
}

/* --- Calendario --- */
/* --- Calendario --- */
function _getBirthdayMap(year, month) {
  // Devuelve { day: [{id, nombre, age, birthYear}] } solo del mes/año indicado.
  // Costo: O(n) sobre P + parseCURP O(1) por paciente. Sin DOM, sin GPU.
  const map = {};
  const targetMonth = month + 1;
  for (const id in P) {
    const p = P[id];
    if (!p) continue;
    const parsed = parseCURP(p.curp);
    if (!parsed || parsed.m !== targetMonth) continue;
    const day = parsed.d;
    if (!map[day]) map[day] = [];
    map[day].push({
      id,
      nombre: String(p.nombre || '').trim() || '—',
      age: year - parsed.y,
      birthYear: parsed.y,
      month: parsed.m,
      day: parsed.d
    });
  }
  return map;
}

function _renderBirthdayList(year, month, birthMap) {
  const wrap = $('#progBirthdays');
  if (!wrap) return;
  if (!SHOW_BIRTHDAYS) { wrap.hidden = true; wrap.innerHTML = ''; return; }

  const monthNames = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];

  // 🆕 SOLO mostrar los cumpleaños del DÍA SELECCIONADO (PROG_DAY).
  // Validar que PROG_DAY pertenezca al mes/año que se está mostrando.
  let selectedDay = 0;
  if (PROG_DAY) {
    const p = String(PROG_DAY).split('-').map(Number);
    if (p.length === 3 && p[0] === year && (p[1] - 1) === month && p[2] >= 1 && p[2] <= 31) {
      selectedDay = p[2];
    }
  }

  wrap.hidden = false;

  // Sin día seleccionado válido (raro) → mensaje neutro
  if (!selectedDay) {
    wrap.innerHTML = `<div class="bday-empty">Selecciona un día en el calendario para ver cumpleaños</div>`;
    return;
  }

  // Recolectar SOLO los del día seleccionado
  const all = [];
  if (birthMap[selectedDay]) {
    for (const b of birthMap[selectedDay]) all.push({ ...b, day: selectedDay });
  }
  // Orden estable por nombre dentro del mismo día
  all.sort((a, b) => _cmpStr(a.nombre, b.nombre));

  if (!all.length) {
    wrap.innerHTML = `<div class="bday-empty">🎂 Sin cumpleaños el ${selectedDay} de ${monthNames[month]}</div>`;
    return;
  }

  const HARD_CAP = 300;
  const shown = Math.min(all.length, HARD_CAP);
  const items = all.slice(0, shown).map(b => `
    <button type="button" class="bday-item" data-a="bday-open" data-id="${esc(b.id)}">
      <div class="bday-day">${b.day}<small>${monthNames[month].slice(0,3)}</small></div>
      <div class="bday-info">
        <div class="bday-name">${esc(b.nombre)}</div>
        <div class="bday-age">Cumple ${b.age} año${b.age === 1 ? '' : 's'}</div>
      </div>
      <div class="bday-arrow">›</div>
    </button>
  `).join('');

  wrap.innerHTML = `
    <div class="bday-head">🎂 Cumpleaños el ${selectedDay} de ${monthNames[month]} · ${all.length}</div>
    <div class="bday-list">${items}</div>
    ${all.length > HARD_CAP ? `<div class="bday-note">Mostrando ${HARD_CAP} de ${all.length}</div>` : ''}
  `;
}

function renderProgCal() {
  const year = PROG_MONTH.getFullYear();
  const month = PROG_MONTH.getMonth();
  const monthNames = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
  const title = $('#progMonthTitle'); if (title) title.textContent = `${monthNames[month]} ${year}`;

  // Toggle button state
  const toggleBtn = $('#btnToggleBdays');
  if (toggleBtn) toggleBtn.classList.toggle('on', SHOW_BIRTHDAYS);

  // Contador por día
  const counts = {};
  Object.values(P).forEach(p => {
    if (p.prog_fecha) counts[p.prog_fecha] = (counts[p.prog_fecha]||0) + 1;
  });

  // Cumpleaños del mes (solo si toggle activo → cero costo si está apagado)
  const birthMap = SHOW_BIRTHDAYS ? _getBirthdayMap(year, month) : {};

  const first = new Date(year, month, 1);
  const firstDow = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month+1, 0).getDate();
  const todayStr = today();

   // Icono de cumpleaños: regalo rosa, sin sombra, inline junto al número
  const BDAY_SVG = '<svg class="pd-bday-icon" viewBox="0 0 24 24" width="11" height="11" fill="#e91e63" aria-hidden="true"><path d="M12,6C13.11,6 14,5.1 14,4C14,3.62 13.9,3.27 13.71,2.97L12,0L10.29,2.97C10.1,3.27 10,3.62 10,4A2,2 0 0,0 12,6M18,10H13V7H11V10H6A2,2 0 0,0 4,12V14A2,2 0 0,0 6,16H7.4L9,14.5L11.5,17H12.5L15,14.5L16.6,16H18A2,2 0 0,0 20,14V12A2,2 0 0,0 18,10Z"/></svg>';

  
  let html = '';
  for (let i = 0; i < firstDow; i++) html += '<div class="pd pd-empty"></div>';

  for (let d = 1; d <= daysInMonth; d++) {
    const ds = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const cnt = counts[ds] || 0;
    const bdayCount = (SHOW_BIRTHDAYS && birthMap[d]) ? birthMap[d].length : 0;
    const hasBday = bdayCount > 0;
    const cls = ['pd'];
    if (cnt > 0) cls.push(cnt > 10 ? 'has-10plus' : 'has-1to10');
    if (ds === todayStr) cls.push('pd-today');
    if (ds === PROG_DAY) cls.push('pd-sel');
    if (hasBday) cls.push('pd-bday');
    const bdayLabel = bdayCount > 9 ? '9+' : String(bdayCount);
    const bdayHtml = hasBday
      ? `<span class="pd-bday-wrap">${BDAY_SVG}<span class="pd-bday-badge">${bdayLabel}</span></span>`
      : '';
    html += `<button class="${cls.join(' ')}" data-a="prog-day" data-d="${ds}">${d}${bdayHtml}</button>`;
  }

  const cal = $('#progCal'); if (cal) cal.innerHTML = html;

  // Lista de cumpleaños
  _renderBirthdayList(year, month, birthMap);
}

/* --- Cards del día seleccionado --- */
function drawProgCards() {
  const root = $('#progCards'); if (!root) return;

  const list = Object.entries(P)
    .filter(([id, p]) => p.prog_fecha === PROG_DAY)
    .sort(([a, pa], [b, pb]) => String(pa.prog_hora||'').localeCompare(String(pb.prog_hora||'')));

  if (!list.length) {
    root.innerHTML = '<div class="empty"><span class="big">📅</span>Sin pacientes programados este día.</div>';
    return;
  }
  root.innerHTML = list.map(([id]) => buildCardHTML(id, true)).join('');
  root.scrollTop = 0;   // reset scroll al cambiar de día
}

/* --- Modal de programación --- */
function progModal(id, initState) {
  const p = P[id];
  if (!p) return;
  _progModalId = id;   // 🆕 Recordar el paciente del modal (para restaurar si el usuario cancela "mismo teléfono")
  const existing = p.prog_fecha || '';

  
  const existingH = p.prog_hora || '';
  const t = today();
  const now = new Date();
  const nowH = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
  const addDays = (dateStr, n) => {
    const [y,m,d] = dateStr.split('-').map(Number);
    const dt = new Date(y, m-1, d + n);
    return `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`;
  };
  const dayName = (dateStr) => {
    const [y,m,d] = dateStr.split('-').map(Number);
    return ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'][new Date(y, m-1, d).getDay()];
  };

  // ── Estado del formulario (para preservarlo si se abre el modal de teléfono) ──
  // 🆕 Fecha y hora NO se autocompletan: si el paciente no tiene programación
  //    previa, los campos quedan vacíos. Así, pulsar Guardar sin elegir nada
  //    NO programa la visita (la validación en saveProg lo bloquea).
  const sFecha = initState ? initState.fecha : existing;   // ← sin `|| t`
  const sHora  = initState ? initState.hora  : existingH;  // ← sin `|| nowH`
  const sNotas = initState ? initState.notas : (p.notas || '');

  // ── Domicilio completo ──
  const addrParts = [];
  if (isReal(p.calle))    addrParts.push(esc(p.calle));
  if (isReal(p.numExt))   addrParts.push('#' + esc(p.numExt));
  if (isReal(p.numInt))   addrParts.push('Int. ' + esc(p.numInt));
  if (isReal(p.colonia))  addrParts.push(esc(p.colonia));
  if (isReal(p.municipio))addrParts.push(esc(p.municipio));
  if (isReal(p.estado))   addrParts.push(esc(p.estado));
  const addrText = addrParts.join(', ') || 'Sin domicilio';

  // ── Teléfonos válidos ──
  const phones = [p.tel1, p.tel2]
    .filter(isReal)
    .filter(x => String(x).replace(/\D/g,'').length >= 7);



    // ── Chips de días: Hoy + Mañana + próximos 8 días (10 días totales) ──
  const dayChips = [0,1,2,3,4,5,6,7,8,9].map(i => {
    const date = addDays(t, i);
    const dn = dayName(date);
    const dd = date.slice(8, 10);   // 🆕 "01".."31"
    let label;
    if (i === 0) label = `Hoy · ${dn}`;
    else if (i === 1) label = `Mañana · ${dn}`;
    else label = `${dn} ${dd}`;     // 🆕 "Lun 20", "Mar 21", ...
    return `<button type="button" class="chip" data-a="prog-quick" data-d="${date}">${label}</button>`;
  }).join('');

  

  // ── Chips de horas ──
  const hourChips = [
    ['09:00','9:00'],
        ['09:30','9:30'],
    ['10:00','10:00'],
        ['10:30','10:30'],
    ['11:00','11:00'],
    ['11:30','11:30'],

    ['12:00','12:00'],
    ['12:30','12:30'],
    ['13:00','1:00'],
    ['13:30','1:30'],
    ['14:00','2:00'],
    ['14:30','2:30'],

  ].map(([v,l]) =>
    `<button type="button" class="chip" data-a="prog-quick-hour" data-h="${v}">${l}</button>`
  ).join('');

  openModal(`
    <div class="sheet-head"> ${existing ? 'Editar programación' : 'Programar visita'}<button class="close" data-a="close-modal">✕</button></div>
    <div class="sheet-body">

      <div class="dgrid-2" style="margin-bottom:14px">
        <div class="dfield">
          <div class="lbl">📅 Fecha</div>
          <input type="date" id="progFecha" value="${sFecha}">
        </div>
        <div class="dfield">
          <div class="lbl">🕐 Hora</div>
          <input type="time" id="progHora" value="${sHora}">
        </div>
      </div>

      <div class="fgroup">
        <div class="chips">${dayChips}</div>
      </div>

      <div class="fgroup">
        <div class="chips">${hourChips}</div>
      </div>

      <div class="prog-name">${esc(p.nombre || '—')}</div>

      <div style="font-size:13px;color:var(--muted);text-align:center;line-height:1.5;margin:-4px 0 16px;padding:12px 14px;background:var(--cream-2);border-radius:var(--r-sm);border:1px solid var(--border)">
        <div>🏠 ${addrText}</div>
        ${phones.length ? `<div style="display:flex;flex-wrap:wrap;gap:10px 14px;justify-content:center;margin-top:10px">
          ${phones.map(tel => renderProgPhone(tel, id)).join('')}
        </div>` : ''}
      </div>

      <div class="dfield wide">
        <div class="lbl">📝 Notas</div>
        <textarea id="progNotas" rows="4" placeholder="Escribe aquí notas para la visita...">${esc(sNotas)}</textarea>
      </div>

      ${existing ? `<button class="btn" data-a="prog-remove" data-id="${esc(id)}" style="width:100%;margin-top:12px;background:#fdeaea;color:var(--err);border-color:#f2c4c4">🗑 Quitar programación</button>` : ''}
    </div>
    <div class="sheet-foot">
      <button class="btn g" data-a="close-modal" style="flex:1">Cancelar</button>
          <button class="btn p" data-a="prog-save" data-id="${esc(id)}" style="flex:1">Guardar</button>
    </div>
  `, true);

  // 🆕 Sincroniza el estado visual de los chips con los valores actuales
  //    de fecha/hora. Se ejecuta al abrir y cada vez que el usuario
  //    escribe/toca manualmente en los inputs.
  setTimeout(() => {
    const syncProgChips = () => {
      const fVal = (document.getElementById('progFecha') || {}).value || '';
      const hVal = (document.getElementById('progHora')  || {}).value || '';
      document.querySelectorAll('[data-a="prog-quick"]').forEach(c => {
        c.classList.toggle('on', !!fVal && c.dataset.d === fVal);
      });
      document.querySelectorAll('[data-a="prog-quick-hour"]').forEach(c => {
        c.classList.toggle('on', !!hVal && c.dataset.h === hVal);
      });
    };
    syncProgChips();
    const fInp = document.getElementById('progFecha');
    const hInp = document.getElementById('progHora');
    if (fInp) fInp.addEventListener('change', syncProgChips);
    if (hInp) hInp.addEventListener('change', syncProgChips);
  }, 60);
}
  

/* --- Guardar / quitar programación --- */
async function saveProg(id) {
  /* 🆕 FIX: paciente puede haber sido borrado por delta sync mientras el modal estaba abierto */
  if (!P[id]) { closeModal(); toast('Paciente ya no existe', 1); return; }
  const fecha = ($('#progFecha')||{}).value || '';
  const hora = ($('#progHora')||{}).value || '';
  const notas = ($('#progNotas')||{}).value || '';
  if (!fecha) { toast('⚠️ Selecciona una fecha antes de guardar', 1); return; }
  if (!hora)  { toast('⚠️ Selecciona una hora antes de guardar', 1);  return; }

  // Bloqueo visual (previene doble click en los ~50ms que tarda el modal en cerrarse)
  const btn = document.querySelector('[data-a="prog-save"]');
  if (btn) { btn.disabled = true; btn.dataset.orig = btn.innerHTML; btn.innerHTML = '⏳ Guardando…'; }

  // Optimistic: aplicar YA
  P[id].prog_fecha = fecha;
  P[id].prog_hora = hora;
  P[id].notas = notas;
  P[id].prog_by = STORE.get(STORE.KEY_N) || '';
  invalidatePacsCache();
  _invalidateProgBadge();   // 🆕 invalidar cache del badge ANTES de updateProgBadge
  
  // UI responde YA
  closeModal();
  toast('✓ Programado para ' + fmtProgDate(fecha, hora));
  if (VIEW === 'prog') { renderProgCal(); drawProgCards(); }
  else { drawCards(); }
  /* 🆕 Actualiza badge HOY: incrementa si prog_fecha = hoy, decrementa si cambió a otra fecha */
  updateProgBadge();

  // Red en background (no bloquea)
  api('pac_patch', {pid: id, d: {prog_fecha: fecha, prog_hora: hora, notas: notas, prog_by: STORE.get(STORE.KEY_N) || ''}})
    .then(r => { if (r && r.offline) toast('📴 Guardado local. Se sincronizará al recuperar señal.', 0); })
    .catch(() => toast('Error al guardar programación', 1));
}

async function removeProg(id) {
  const p = P[id];
  if (!p) return;
  const curUser = String(STORE.get(STORE.KEY_N) || '').trim();
  const progBy  = String(p.prog_by || '').trim();
  const otherUser = progBy && curUser && progBy.toLowerCase() !== curUser.toLowerCase();

  let msg = '¿Quitar la programación de este paciente?';
  if (otherUser) {
    msg = '⚠️ Esta programación fue hecha por ' + progBy + '. ¿ELIMINAR de todos modos?';
        if (navigator.vibrate) navigator.vibrate([300, 150, 300, 150, 500]);

  }

  if (!(await askConfirm(msg, '🗑 Quitar programación'))) return;

  // Optimistic
  P[id].prog_fecha = '';
  P[id].prog_hora = '';
  P[id].prog_by = '';
  invalidatePacsCache();
  _invalidateProgBadge();   // 🆕 invalidar cache del badge
  toast('✓ Programación eliminada');
  closeModal();
  if (VIEW === 'prog') { renderProgCal(); drawProgCards(); }
  else { drawCards(); }
  /* 🆕 Actualiza badge HOY: si estaba programado para hoy, decrementa o desaparece */
  updateProgBadge();

  // Background
  api('pac_patch', {pid: id, d: {prog_fecha: '', prog_hora: '', prog_by: ''}})
    .then(r => { if (r && r.offline) toast('📴 Guardado local. Se sincronizará al recuperar señal.', 0); })
    .catch(() => toast('Error al guardar', 1));
}



/* ---------- DETALLE ---------- */

  const safeNm = s => (s||'').trim().slice(0,1).toUpperCase() || '?';
const _shortName = n => {
  const s = String(n || '').trim();
  if (!s) return '';
  const parts = s.split(/\s+/);
  if (parts.length <= 2) return s;
  return parts[0] + ' ' + parts[1];
};
  
  const o = (a,v) => a.map(x => Array.isArray(x) ? x : [x,x])
  .map(([k,l]) => `<option value="${esc(k)}"${String(k)===String(v??'')?' selected':''}>${esc(l)}</option>`).join('');
const F = (l,h,c='') => `<div class="dfield ${c}"><div class="lbl">${l}</div>${h}</div>`;
const R = (l,v,c='') => `<div class="dfield ${c}"><div class="lbl">${l}</div><div class="val">${esc(v)||'&nbsp;'}</div></div>`;
const I = (k,v,t='p',a='') => `<input data-${t}="${k}" value="${esc(v??'')}" ${a}>`;
const TA = (k,v,t='p') => `<textarea data-${t}="${k}" rows="3">${esc(v??'')}</textarea>`;

  
// Reemplaza por:
const SE = (k,a,v,t='p') => {
  // 🔒 Si el valor actual no está en el catálogo (dato viejo), lo agregamos
  //    para que NO se pierda al guardar. Se verá con la etiqueta " (anterior)".
  const cur = String(v ?? '').trim();
  const inList = a.some(x => (Array.isArray(x) ? x[0] : x) === cur);
  const opts = [['','']].concat(a);
  if (cur && !inList) opts.push([cur, cur + ' (anterior)']);
  return `<select data-${t}="${k}">${o(opts, v)}</select>`;
};
  

  async function askVisitGPS(id) {
  const p = P[id];
  if (!p) return;
  // Si ya tiene GPS, abrir directo
  if (p.lat && p.lon) { openP(id); return; }
  // Si no hay geolocalización en el dispositivo, abrir directo
  if (!navigator.geolocation) { openP(id); return; }

  if (navigator.vibrate) navigator.vibrate(20);

  openModal(`
    <div class="sheet-head">📍 Ubicación del domicilio<button class="close" data-a="ask-cancel" data-id="${esc(id)}">✕</button></div>
    <div class="sheet-body" style="padding:24px 18px 20px;text-align:center">

      <div style="width:88px;height:88px;margin:0 auto 16px;border-radius:50%;background:var(--chip);display:flex;align-items:center;justify-content:center">
        <svg viewBox="0 0 24 24" width="44" height="44" fill="none" stroke="var(--burgundy)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
          <circle cx="12" cy="10" r="3"/>
        </svg>
      </div>

      <h3 style="margin:0 0 8px;font-size:19px;font-weight:800;color:var(--text);line-height:1.2">
        ¿Estás en el domicilio?
      </h3>

      <p style="margin:0 0 22px;font-size:13.5px;color:var(--muted);line-height:1.5;padding:0 6px">
        Guarda tu ubicación GPS actual como dirección del paciente, o solo abre la ficha sin guardar nada.
      </p>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">

        <button data-a="ask-save" data-id="${esc(id)}"
          style="display:flex;flex-direction:column;align-items:center;justify-content:center;
                 gap:9px;padding:16px 10px;border-radius:14px;
                 background:var(--burgundy);color:#fff;border:1.5px solid var(--burgundy);
                 font-weight:700;font-size:12.5px;line-height:1.25;text-align:center;
                 box-shadow:0 4px 14px rgba(139,41,66,.28);cursor:pointer">
          <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
            <circle cx="12" cy="10" r="3"/>
          </svg>
          Estoy en el domicilio
        </button>

        <button data-a="ask-skip" data-id="${esc(id)}"
          style="display:flex;flex-direction:column;align-items:center;justify-content:center;
                 gap:9px;padding:16px 10px;border-radius:14px;
                 background:#fff;color:var(--text);border:1.5px solid var(--border);
                 font-weight:700;font-size:12.5px;line-height:1.25;text-align:center;
                 cursor:pointer">
          <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="var(--burgundy)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
            <circle cx="12" cy="12" r="3"/>
          </svg>
          Ver datos
        </button>

      </div>

      <p style="margin:16px 4px 0;font-size:11.5px;color:var(--muted);line-height:1.4">
        💡 Toca <b style="color:var(--burgundy)">"Estoy en el domicilio"</b> para capturar tu GPS actual.
      </p>

    </div>
  `, true);
}

  
function openP(id, targetTab = 1) {
  if (!P[id]) return;
  if ($('#detail').hidden) history.pushState({d:1}, '');
  if (cur !== id) VISIT_DRAFT = {};
  cur = id; E = 0; D = 0;
  const p = P[id];
  $('#dtt').textContent = p.nombre || '—';
  $('#dts').textContent = [p.tipo, EST[p.est], p.ultimaVisita ? ('Visita '+p.ultimaVisita) : ''].filter(Boolean).join(' · ');
  $('#dtAvatar').textContent = safeNm(p.nombre);
  tab(targetTab, true);   // ← Abre en la pestaña indicada (1 por defecto)
  $('#detail').hidden = false;
}


  function updateGeoDatalists(field, value) {
  if (!cur || !P[cur]) return;
  const dlC = document.getElementById('dl-calles');
  const dlCol = document.getElementById('dl-colonias');
  if (!dlC || !dlCol) return;

 const munSel = norm(field === 'municipio' ? value : (P[cur].municipio || ''));
  const colSel = norm(field === 'colonia'   ? value : (P[cur].colonia   || ''));

  // ✅ Solo filtrar calles por colonia si el texto actual YA coincide
  //    con una colonia existente del mismo municipio.
  let colExists = false;
  if (colSel) {
    for (const p of Object.values(P)) {
      const pMun = norm(p.municipio || '');
      const pCol = norm(p.colonia   || '');
      if (munSel && pMun !== munSel) continue;
      if (pCol === colSel) { colExists = true; break; }
    }
  }

  const calles = new Set();
  const colonias = new Set();

  for (const p of Object.values(P)) {
    const pMun = norm(p.municipio || '');
    const pCol = norm(p.colonia   || '');

    // Colonias: mismo municipio (o todas si no hay municipio)
    if (isReal(p.colonia) && (!munSel || pMun === munSel)) {
      colonias.add(p.colonia);
    }
    // Calles: mismo municipio; por colonia SOLO si ya existe
    if (isReal(p.calle)) {
      if (munSel && pMun !== munSel) continue;
      if (colExists && pCol !== colSel) continue;   // ← solo si colExists
      calles.add(p.calle);
    }
  }

  const srt = (a,b) => a.localeCompare(b, 'es', { numeric:true, sensitivity:'base' });
  dlC.innerHTML   = [...calles  ].sort(srt).map(v => `<option value="${esc(v)}">`).join('');
  dlCol.innerHTML = [...colonias].sort(srt).map(v => `<option value="${esc(v)}">`).join('');
}
  
function tab(n, force) {
  const newTab = +n;
  if (newTab === TAB && !force) return;
  // Capturar ediciones del paciente
  if (!force && E && cur && P[cur]) {
    $$('#dtBody [data-p]').forEach(e => { P[cur][e.dataset.p] = e.value; });
  }
  // Capturar borrador de visita (data-v)
  if (!force) {
    $$('#dtBody [data-v]').forEach(e => {
      if (e.dataset.v === 'foto') { VISIT_DRAFT.foto = e.value; return; }
      VISIT_DRAFT[e.dataset.v] = e.value;
    });
  }
  TAB = newTab;
  const p = P[cur]; if (!p) return;

  $('#dtBody').innerHTML = buildDetailHTML(p);
if (TAB === 0) { updateGeoDatalists(); _initGPSPasteAutoFill(); }
  
  if (!force && TAB === 1) {
    setTimeout(() => {
      $$('#dtBody [data-v]').forEach(e => {
        if (VISIT_DRAFT[e.dataset.v] != null && !e.disabled) e.value = VISIT_DRAFT[e.dataset.v];
      });
      _initVisitPhotosDraft();
    }, 20);
  }
  $$('#dtTabs button').forEach((b, i) => b.classList.toggle('on', i === TAB));
  setE(force ? 0 : E);
  // 🆕 Inicializar galerías tras aplicar edición
  if (TAB === 0) _initFachadaGallery();
  if (TAB === 1 && force) _initVisitPhotosDraft();
}

/* ═══════════════════════════════════════════════════════════════
   📸 Inicializadores de galería dentro del tab activo
   ═══════════════════════════════════════════════════════════════ */
function _initFachadaGallery() {
  if (!cur || !P[cur]) return;
  const box = document.getElementById('fpv');
  if (!box) return;
  const urls = photoUrls(P[cur], 'fachadas', 'fachada');
  renderPhotoGallery(box, urls, {
    editable: true,
    max: 20,
    label: 'FACHADA',
    onView: openPhotoViewer,
    onAdd: async () => {
      const current = photoUrls(P[cur], 'fachadas', 'fachada');
      if (current.length >= 20) { toast('Máximo 20 fotos de fachada', 1); return; }
      const newUrls = await pickAndUploadPhotos(20 - current.length);
      if (!newUrls.length) return;
      const all = [...current, ...newUrls];
      P[cur].fachadas = all;
      P[cur].fachada = all[0] || '';
      D = 1;
      _initFachadaGallery();
    },
    onDelete: (url, i) => {
      const current = photoUrls(P[cur], 'fachadas', 'fachada');
      const all = current.filter((_, j) => j !== i);
      P[cur].fachadas = all;
      P[cur].fachada = all[0] || '';
      D = 1;
      _initFachadaGallery();
      toast(`✓ Foto eliminada · quedan ${all.length}`);
    }
  });
}

function _initVisitPhotosDraft() {
  if (!cur) return;
  const box = document.getElementById('fvv');
  if (!box) return;
  if (!Array.isArray(VISIT_DRAFT.fotos)) {
    VISIT_DRAFT.fotos = VISIT_DRAFT.foto ? [VISIT_DRAFT.foto] : [];
  }
  renderPhotoGallery(box, VISIT_DRAFT.fotos, {
    editable: true,
    max: 10,
    label: 'VISITA',
    onView: openPhotoViewer,
    onAdd: async () => {
      if (VISIT_DRAFT.fotos.length >= 10) { toast('Máximo 10 fotos por visita', 1); return; }
      const newUrls = await pickAndUploadPhotos(10 - VISIT_DRAFT.fotos.length);
      if (!newUrls.length) return;
      VISIT_DRAFT.fotos = [...VISIT_DRAFT.fotos, ...newUrls];
      VISIT_DRAFT.foto = VISIT_DRAFT.fotos[0] || '';
      D = 1;
      _initVisitPhotosDraft();
    },
    onDelete: (url, i) => {
      VISIT_DRAFT.fotos = VISIT_DRAFT.fotos.filter((_, j) => j !== i);
      VISIT_DRAFT.foto = VISIT_DRAFT.fotos[0] || '';
      D = 1;
      _initVisitPhotosDraft();
      toast(`✓ Foto eliminada · quedan ${VISIT_DRAFT.fotos.length}`);
    }
  });
}

function buildDetailHTML(p) {
  const tabs = [
    /* 0 DATOS */
       `
    <div class="dcard">
      <div class="head"><span class="ic">📋</span>Datos del programa</div>
      <div class="body">
        <div class="dgrid-3" style="margin-bottom:14px">
          ${F('Estatus', `<select data-p="est">${o([['','']].concat(Object.entries(EST)), p.est)}</select>`)}
          ${F('Tipo', SE('tipo', ['PAM','PCD'], p.tipo))}
          ${F('Folio', I('folio', p.folio))}
        </div>

           <div class="dgrid-3" style="margin-bottom:14px">
          ${F('CURP', I('curp', p.curp, 'p', 'maxlength="18"'))}
          ${F('Visita fué', SE('vf', VFS, p.vf))}
          ${F('#V', SE('nv', NVS, p.nv))}
        </div>
        <div class="dgrid-2" style="margin-bottom:14px">
          ${F('Última visita', I('ultimaVisita', p.ultimaVisita, 'p', 'inputmode="numeric"'))}
          ${F('Motivo', SE('motivo', MOTIVOS, p.motivo))}
        </div>

        
        <div class="dfield wide">
          <div class="lbl">Referencias</div>
          ${TA('refs', p.refs)}
        </div>
      </div>
    </div>

    <div class="dcard">
  <div class="head"><span class="ic">📍</span>Domicilio completo</div>
  <div class="body">
    <div class="dgrid-2" style="margin-bottom:14px">
      ${F('Calle', I('calle', p.calle, 'p', 'list="dl-calles" autocomplete="off"'))}
      ${F('Colonia', I('colonia', p.colonia, 'p', 'list="dl-colonias" autocomplete="off"'))}
    </div>
    <datalist id="dl-calles"></datalist>
    <datalist id="dl-colonias"></datalist>
    <div class="dgrid-3" style="margin-bottom:14px">
      ${F('No. exterior', I('numExt', p.numExt))}
      ${F('No. interior', I('numInt', p.numInt))}
      ${F('Manzana', I('mz', p.mz))}
    </div>
    
      <div class="dgrid-3" style="margin-bottom:14px">
      ${F('Lote', I('lt', p.lt))}
      ${F('Municipio', I('municipio', p.municipio))}
      ${F('Estado', I('estado', p.estado))}
    </div>
    
    <div class="dgrid-2" style="margin-bottom:14px">
      ${F('Sección', I('seccion', p.seccion))}
      ${F('Área', I('area', p.area))}
    </div>
    
        <div class="dfield wide" style="margin-bottom:14px">
      <div class="lbl">Ubicación GPS</div>

      
      <div class="val" id="gi">${p.lat ? esc(p.lat+', '+p.lon)+' · ±'+esc(p.acc||'?')+' m' : 'Sin ubicación'}</div>

      <div class="only-edit" style="display:flex;gap:6px;margin:8px 0">
        <input id="gpsPaste" placeholder="Pega coordenadas. Ej: 16.753, -93.115" autocomplete="off"
          style="flex:1;min-width:0;padding:9px 12px;border-radius:var(--r-sm);border:1.5px solid var(--border);background:#fff;font-size:13px;outline:none">
        <button type="button" class="btn" data-a="gps-paste-apply"
          style="padding:9px 12px;font-size:12px;white-space:nowrap">Aplicar</button>
      </div>
      
      
<div class="geo-box">
  ${!p.lat ? `<button type="button" class="btn only-edit" data-a="geo">◎ Ubicación actual</button>
  <button type="button" class="btn only-edit" data-a="geo-map">🗺 Seleccionar en mapa</button>` : ''}
  ${p.lat ? `<button type="button" class="btn" data-a="view-map">🗺 Ver mapa offline</button>` : ''}
  ${p.lat ? `<button type="button" class="btn only-edit" data-a="geo-del" style="background:#fdeaea;color:var(--err);border-color:#f2c4c4">🗑 Eliminar ubicación</button>` : ''}
</div>

      
    </div>

        <!-- 🆕 Vínculo con Casa del Mapa (catastro) -->
        <div class="dfield wide" style="margin-bottom:14px">
          <div class="lbl">🏠 Casa vinculada del mapa</div>
          ${_catRenderPatientHouseLink(p)}
        </div>

        
        <div class="dfield wide">
          <div class="lbl">Fotos de fachada</div>
          <input type="hidden" data-p="fachada" value="${esc(p.fachada||'')}">
          <div id="fpv" class="photo-gallery"></div>
        </div>
        
      </div>
    </div>
    
     <div class="dcard">
      <div class="head"><span class="ic">📞</span>Contacto</div>
      <div class="body">
        <div class="dgrid-2">
          <div class="dfield"><div class="lbl">Teléfono 1</div>${renderDetailPhone(p.tel1, cur, 'tel1')}</div>
          <div class="dfield"><div class="lbl">Teléfono 2</div>${renderDetailPhone(p.tel2, cur, 'tel2')}</div>
        </div>
      </div>
    </div>`,
    
       /* 1 VALORACIÓN */
    `
    <div class="dcard">
      <div class="head"><span class="ic">🩺</span>Valoración clínica</div>
      <div class="body">
            <div class="dgrid-3" style="margin-bottom:14px">
          ${F('Sexo', SE('sexo', ['Hombre','Mujer'], isReal(p.sexo) ? p.sexo : _curpSexo(p.curp)))}
          ${F('Edad', I('edad', p.edad || _curpEdad(p.curp), 'p', 'inputmode="numeric"'))}
          ${F('Dependencia', SE('dep', DEPS, p.dep))}
        </div>
            <div class="dgrid-3" style="margin-bottom:14px">
          ${F('Ayuda técnica', SE('ayuda', AYUDAS_TECNICAS, p.ayuda))}
          ${F('Familiar', I('fam', p.fam))}
          ${F('Comportamiento', SE('comp', COMPORTAMIENTOS, p.comp))}
        </div>
        <div class="dgrid-2" style="margin-bottom:14px">
          ${F('Interrogatorio', TA('enf', p.enf))}
          ${F('Exploración', TA('expl', p.expl))}
        </div>
        <div class="dgrid-2" style="margin-bottom:14px">
          ${F('Diagnóstico', TA('diag', p.diag))}
          ${F('Medicamentos', TA('med', p.med))}
        </div>
        ${F('Alergias', I('alg', p.alg), 'wide')}
      </div>
    </div>
    <div class="dcard">
      <div class="head"><span class="ic">📊</span>Signos vitales y somatometría</div>
      <div class="body">

      
                  <div class="dgrid-2" style="margin-bottom:14px">
          ${F('Fecha', I('fecha', VISIT_DRAFT.fecha || today(), 'v', 'type="date"'))}
          ${F('Estado', (() => {
            // 🆕 Estado de la visita ahora usa las mismas opciones que "Motivo"
            //    y se sincroniza bidireccionalmente con el motivo del paciente.
            const vd = String(VISIT_DRAFT.estado || '').trim();
            const pm = String(p.motivo || '').trim();
            const _estVal = MOTIVOS.includes(vd) ? vd : (MOTIVOS.includes(pm) ? pm : '');
            return `<select data-v="estado">${o(MOTIVOS, _estVal)}</select>`;
          })())}
        </div>

        
        <div class="dgrid-2" style="margin-bottom:14px">
          ${F('Peso (kg)', I('peso','','v','inputmode="decimal"'))}
          ${F('Talla (m)', I('talla','','v','inputmode="decimal"'))}
        </div>
        <div class="dgrid-3" style="margin-bottom:14px">
          ${F('Pantorrilla', I('pan','','v','inputmode="decimal"'))}
          ${F('Brazo', I('bra','','v','inputmode="decimal"'))}
          ${F('Abdomen', I('cin','','v','inputmode="decimal"'))}
        </div>
        <div class="dgrid-3" style="margin-bottom:14px">
          ${F('Presión art.', `<input data-v="pa" readonly placeholder="120/80" data-a="pa-modal" style="cursor:pointer;font-weight:800">`)}
          ${F('SpO₂', I('spo2','','v','inputmode="decimal"'))}
          ${F('Frec. cardíaca', I('fc','','v','inputmode="decimal"'))}
        </div>
        <div class="dgrid-3" style="margin-bottom:14px">
          ${F('Glucosa', I('glu','','v','inputmode="decimal"'))}
          ${F('Temp °C', I('temp','','v','inputmode="decimal"'))}
          <div class="dfield"><div class="lbl">IMC</div><div class="val big" id="imc">—</div></div>
        </div>
        
            ${F('Observaciones', TA('obs','','v'), 'wide')}
        <div class="dfield wide" style="margin-top:12px">
          <div class="lbl">Fotos de la visita</div>
          <div id="fvv" class="photo-gallery"></div>
        </div>

        
      </div>
    </div>
    <button type="button" class="fab-save" data-a="save-visit" style="display:none">💾 Guardar visita</button>
    `,
    /* 2 NOTAS */
    `
    <div class="dcard">
      <div class="head"><span class="ic">📝</span>Notas</div>
      <div class="body">${F('Notas', TA('notas', p.notas), 'wide')}</div>
    </div>
    <div class="dcard">
      <div class="head"><span class="ic">📅</span>Historial de visitas</div>
      <div class="body">
        ${renderHistorial(p)}
      </div>
    </div>`,
    /* 3 TRATAMIENTO */
    `
    <div class="dcard">
      <div class="head"><span class="ic">💊</span>Tratamiento y pronóstico</div>
      <div class="body">
        ${F('Plan de cuidado', TA('plan', p.plan), 'wide')}
        ${F('Pronóstico', TA('pron', p.pron), 'wide')}
      </div>
    </div>`
  ];
  return tabs[TAB] || tabs[0];
}
function renderHistorial(p) {
  if (!p.vis || !Object.keys(p.vis).length) {
    return '<div class="empty" style="padding:24px"><span class="big">📋</span>Sin visitas registradas aún.</div>';
  }
  const v = Object.entries(p.vis).map(([id,x]) => ({id, ...x}))
    .sort((a,b) => (a.fecha||'').localeCompare(b.fecha||'') || (a.at||0)-(b.at||0));
  const rows = v.slice().reverse();

  // 🆕 Base del contador: usamos `ultimaVisita` (contador acumulado real del
  //    paciente) en lugar de `v.length` (posición en el array `vis`).
  //    Así, si el paciente fue importado con visita 3 y se crea la nueva
  //    visita 4, aunque `vis` solo tenga 1 entrada, se mostrará #4.
  //    Math.max protege contra datos viejos donde `vis` > `ultimaVisita`.
  const _ultimaNum = parseInt(String(p.ultimaVisita || '0').replace(/\D/g,''), 10) || 0;
  const _baseNum   = Math.max(_ultimaNum, v.length);

  // Definición de columnas
  const HCOLS = [
    { k:'fecha',  l:'Fecha',  w:96,  num:false },
    { k:'estado', l:'Estado', w:80,  num:false },
    { k:'pa',     l:'PA',     w:70,  num:true  },
    { k:'fc',     l:'FC',     w:50,  num:true  },
    { k:'spo2',   l:'SpO₂',   w:55,  num:true  },
    { k:'glu',    l:'Glu',    w:55,  num:true  },
    { k:'temp',   l:'Temp',   w:55,  num:true  },
    { k:'peso',   l:'Peso',   w:55,  num:true  },
    { k:'talla',  l:'Talla',  w:55,  num:true  },
    { k:'pan',    l:'Pant',   w:55,  num:true  },
    { k:'bra',    l:'Brazo',  w:55,  num:true  },
    { k:'cin',    l:'Abd',    w:55,  num:true  },
    { k:'obs',    l:'Obs',    w:200, num:false },
    { k:'por_nombre', l:'Brigadista', w:100, num:false },
  ];

  const headHTML = `<tr>
    <th style="width:34px">#</th>
    ${HCOLS.map(c => `<th style="min-width:${c.w}px">${esc(c.l)}</th>`).join('')}
    <th style="width:44px">📷</th>
  </tr>`;

  const bodyHTML = rows.map((x, i) => {
    const num = Math.max(0, _baseNum - i);       // ✅ número real de visita
    const cells = HCOLS.map(c => {
      let raw = x[c.k];
      if (c.k === 'por_nombre' && (raw == null || raw === '')) raw = x.por;
      const val = raw != null ? String(raw).trim() : '';
      const isReal = val !== '' && val.toUpperCase() !== 'SN' && val !== '-';
      const display = isReal
        ? `<span title="${esc(val)}">${esc(val)}</span>`
        : '<span class="hv-empty">—</span>';
      return `<td class="${c.num ? 'hv-num' : ''}">${display}</td>`;
    }).join('');
    const visitFotos = photoUrls(x, 'fotos', 'foto');
    let foto;
    if (visitFotos.length === 0) {
      foto = '<span class="hv-empty">—</span>';
    } else if (visitFotos.length === 1) {
      foto = `<a class="hv-photo" href="${esc(safeU(visitFotos[0]))}" target="_blank" rel="noopener noreferrer" data-a="stop" title="Ver foto">📷</a>`;
    } else {
      foto = `<a class="hv-photo" href="javascript:void(0)" data-a="ver-visita" data-vid="${esc(x.id)}" title="Ver ${visitFotos.length} fotos" style="position:relative">📷<sup style="font-size:9px;font-weight:800;color:var(--burgundy);margin-left:1px">${visitFotos.length}</sup></a>`;
    }
    return `<tr data-a="ver-visita" data-vid="${esc(x.id)}">
      <td class="hv-numcol">${num}</td>
      ${cells}
      <td style="text-align:center">${foto}</td>
    </tr>`;
  }).join('');

  return `
    <div class="hist-wrap">
      <table class="hist-tbl">
        <thead>${headHTML}</thead>
        <tbody>${bodyHTML}</tbody>
      </table>
    </div>`;
}
  
  
function imc() {
  const a = k => ($(`#dtBody [data-v=${k}]`) || {}).value || '';
  const w = +a('peso'), t = +a('talla');
  const h = t > 3 ? t/100 : t;
  const i = w && h ? w/h/h : 0;
  const el = $('#imc'); if (el) el.textContent = i ? (i.toFixed(1) + ' (' + (i<18.5?'Bajo peso':i<25?'Normal':i<30?'Sobrepeso':'Obesidad') + ')') : '—';
}
  /* 🆕 Auto-llenar el input #gpsPaste con la mejor ubicación de Firebase.
   - Solo si el paciente NO tiene GPS guardado localmente (p.lat vacío).
   - Prioriza folio → si no hay dato, prueba nombre sin espacios.
   - NUNCA autoguarda: deja el valor en el input para que el admin pulse "Aplicar". */
function _initGPSPasteAutoFill() {
  if (SAVING_MODE) return;             // 🆕 0 red en Modo Ahorro
  if (!cur || !P[cur]) return;
  const p = P[cur];
  if (p.lat && p.lon) return;         // ya tiene GPS → nada que hacer

  const inp = document.getElementById('gpsPaste');
  if (!inp) return;
  if (inp.dataset.filled === '1') return;
  inp.dataset.filled = '1';

  const pidAtStart = cur;

  const folio    = String(p.folio || '').trim();
  const folioOk  = folio && folio.toUpperCase() !== 'SN' && folio !== '-' && folio.length >= 2;
  const nombre   = String(p.nombre || '').trim().replace(/\s+/g, '');
  //                          ↑ antes: nombreCompleto
  const nombreOk = nombre && nombre.length >= 2;
  if (!folioOk && !nombreOk) return;

  (async () => {
    let loc = null;
    if (folioOk) loc = await _fetchBestLocation(folio);
    if (!loc && nombreOk) loc = await _fetchBestLocation(nombre);
    if (!loc) return;

    // Guard: paciente cambió / input desapareció / usuario ya escribió / ya hay GPS
    if (cur !== pidAtStart) return;
    if (!P[cur]) return;
    if (P[cur].lat && P[cur].lon) return;
    const inpNow = document.getElementById('gpsPaste');
    if (!inpNow) return;
    if (inpNow.value.trim()) return;

    inpNow.value = `${(+loc.lat).toFixed(6)}, ${(+loc.lng).toFixed(6)}`;
    inpNow.dataset.auto = '1';
    inpNow.style.background = 'rgba(16,185,129,.08)';
    inpNow.style.borderColor = 'rgba(16,185,129,.5)';
    inpNow.title = `Ubicación previa del paciente (±${Math.round(loc.acc)}m). Pulsa "Aplicar" para confirmar.`;
  })();
}

function setE(b) {
  E = b;
  const dtb = $('#dtBody');
  if (dtb) dtb.classList.toggle('editing', !!b);
  $$('#dtBody [data-p], #dtBody [data-v], #dtBody [data-a=up], #dtBody [data-a=geo], #dtBody [data-a=geo-map], #dtBody [data-a=geo-del]')
    
    .forEach(e => e.disabled = !b);
  const ok = $('#ok'); if (ok) ok.hidden = !b;
const pen = $('#pen'); if (pen) { pen.classList.toggle('on', !!b); pen.hidden = !!b; }
  // Mostrar/ocultar FAB Guardar visita
  const fab = document.querySelector('.fab-save');
  if (fab) fab.style.display = b ? 'inline-flex' : 'none';
}
  
function closeD() {
  if ($('#detail').hidden) return;
  $('#detail').hidden = true;
  calc(1);
  // 🆕 Consumir el {d:1} del historial si existe → evita botón "back" colgado
  if (history.state && history.state.d === 1) {
    history.back();
  }
}
/* Campos que cuentan como "visita real" (fecha y estado NO cuentan) */
const VISIT_CLINICAL = ['pa','fc','spo2','glu','temp','peso','talla','pan','bra','cin','obs','foto'];
const hasRealVisitData = (v) => VISIT_CLINICAL.some(k => String(v[k] ?? '').trim() !== '');
  

let _savingSave = false;
let _savingVisit = false;   // 🆕 evita ReferenceError
async function save(noReopen = false) {
  
  if (!cur || _savingSave || _savingVisit) return false;
  if (!P[cur]) { toast('Paciente eliminado por otro usuario', 1); closeD(); return false; }
  // 🆕 Capturar pidToSave: si el usuario navega mientras corre el background,
  //    la visita se guarda en el paciente ORIGINAL, no en el que esté abierto.
  const pidToSave = cur;
  _savingSave = true;
  try {
    $$('#dtBody [data-p]').forEach(e => { P[pidToSave][e.dataset.p] = e.value; });
    _searchUpsert(pidToSave);

    const ALL_P = ['est','tipo','folio','curp','vf','nv','ultimaVisita','motivo','refs',
                   'calle','numExt','numInt','mz','lt','colonia','municipio','estado','fachada','fachadas',
                   'lat','lon','acc','enf','med','alg','notas','sexo','edad','dep','ayuda','fam',
                   'comp','diag','expl','pron','plan','seccion','area','prog_fecha','prog_hora','tel1','tel2'];
    const d = {};
    // ✅ Preservar arrays (fachadas) sin stringificar
    for (const k of ALL_P) if (P[pidToSave][k] != null) {
      d[k] = Array.isArray(P[pidToSave][k]) ? P[pidToSave][k] : String(P[pidToSave][k]);
    }
    // ✅ Sincronizar fachada primaria con fachadas[0]
    if (Array.isArray(P[pidToSave].fachadas)) {
      P[pidToSave].fachada = P[pidToSave].fachadas[0] || '';
      d.fachada = P[pidToSave].fachada;
    }

    let visitToSave = null, newVid = null;
    if (E) {
      const v = { ...VISIT_DRAFT };
      $$('#dtBody [data-v]').forEach(e => { v[e.dataset.v] = (e.value || '').trim(); });
      // ✅ FIX #2: sincronizar foto ANTES del check
      if (Array.isArray(v.fotos) && v.fotos.length) {
        v.foto = v.fotos[0];
      } else {
        v.foto = v.foto || '';
      }
      if (hasRealVisitData(v)) {
        if (!v.fecha) v.fecha = today();
        if (!v.estado) v.estado = 'realizada';
        v.por_nombre = STORE.get(STORE.KEY_N) || '';
        visitToSave = v;
        newVid = 'v' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      }
    }
    if (visitToSave) {
      P[pidToSave].vis = P[pidToSave].vis || {};
      P[pidToSave].vis[newVid] = { ...visitToSave, at: Date.now() };
      const currentNum = parseInt(String(P[pidToSave].ultimaVisita || '0').replace(/\D/g,''), 10) || 0;
      const newNum = currentNum + 1;
      P[pidToSave].ultimaVisita = String(newNum);
      P[pidToSave].nv = newNum + 'V';
      d.ultimaVisita = String(newNum);
      d.nv = newNum + 'V';
    }

    invalidatePacsCache();
    toast(visitToSave ? '✓ Datos y visita guardados' : '✓ Guardado');
    D = 0;
    VISIT_DRAFT = {};
    if (!noReopen) openP(pidToSave, visitToSave ? 2 : 1);

    (async () => {
      try {
        const r1 = await api('pac_patch', {pid: pidToSave, d});
        let r2 = null;
        if (visitToSave) {
          r2 = await api('visit_save', {pid: pidToSave, vid: newVid, v: visitToSave});
        }
        if ((r1 && r1.offline) || (r2 && r2.offline)) {
          toast('📴 Guardado local. Se sincronizará al recuperar señal.', 0);
        }
      } catch (_) {
        toast('Error al guardar', 1);
      } finally {
        _savingSave = false;
      }
    })();

    return true;
  } catch (err) {
    _savingSave = false;
    console.error('[save]', err);
    toast('Error al guardar: ' + (err?.message || err), 1);
    return false;
  }
}

async function saveVisit() { return save(); }

async function up(inp) {
  const f = inp.files[0]; if (!f) return;
  if (!navigator.onLine) {
    toast('Necesitas conexión para subir fotos', 1);
    return;
  }
  if (!/^image\//.test(f.type) || f.size > 12e6) { toast('Imagen no válida (máx 12 MB)', 1); return; }
  toast('Optimizando foto…');
  try {
    // ─── Comprimir antes de subir ───
    const compressed = await new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_DIM = 1400;
        const scale = Math.min(1, MAX_DIM / Math.max(img.width, img.height));
        canvas.width  = Math.round(img.width  * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(b => resolve(b || f), 'image/jpeg', 0.78);
      };
       img.onerror = () => { URL.revokeObjectURL(img.src); resolve(f); };
      const _u = URL.createObjectURL(f);
      img.onload = (() => { const _orig = img.onload; return function() { _orig.call(img); URL.revokeObjectURL(_u); }; })();
      img.src = _u;
    });

    const originalKB = Math.round(f.size / 1024);
    const newKB      = Math.round(compressed.size / 1024);
    toast(`Subiendo foto… (${originalKB} KB → ${newKB} KB)`);

    const s = await api('csign');
    const fd = new FormData();
    fd.append('file', compressed, 'photo.jpg');
    fd.append('api_key', s.key);
    fd.append('timestamp', s.ts);
    fd.append('folder', s.folder);
    fd.append('signature', s.sig);
    const j = await (await fetch(`https://api.cloudinary.com/v1_1/${s.cloud}/image/upload`, {method:'POST', body: fd})).json();
    if (!j.secure_url) throw new Error('Sin URL');
    const t = inp.dataset.t;
    const target = t === 'foto' ? $('#dtBody [data-v="foto"]') : $('#dtBody [data-p="fachada"]');
    if (target) target.value = j.secure_url;
    const box = t === 'foto' ? $('#fvv') : $('#fpv');
    if (box) box.innerHTML = imgH(j.secure_url);
    D = 1;
    toast('Foto lista; pulsa Guardar');
  } catch (e) { toast('Error al subir la foto', 1); }
}

  
function geo() {
  if (!navigator.geolocation) { toast('Sin geolocalización', 1); return; }

  // ✅ FIX: capturar el paciente AHORA. `cur` puede cambiar mientras
  //         el GPS busca (hasta 20s). Sin esto, guarda en el paciente equivocado.
  const patientId = cur;
  if (!patientId || !P[patientId]) return;

  toast('Buscando señal GPS precisa… (puede tardar unos segundos)');

  let bestPosition = null;
  let watchId = null;
  let timeoutId = null;

  const cleanup = () => {
    if (watchId !== null) navigator.geolocation.clearWatch(watchId);
    if (timeoutId !== null) clearTimeout(timeoutId);
    watchId = null;
    timeoutId = null;
  };

  const onPositionUpdate = (pos) => {
    if (!bestPosition || pos.coords.accuracy < bestPosition.coords.accuracy) {
      bestPosition = pos;
    }
    const acc = pos.coords.accuracy;
    const statusText = `Precisión actual: ±${Math.round(acc)} m. ${acc > 15 ? 'Buscando mejor señal…' : '¡Buena precisión!'}`;
    toast(statusText, acc > 15 ? 1 : 0);
    if (acc <= 15) {
      cleanup();
      savePosition(bestPosition);
    }
  };

  const savePosition = async (pos) => {
    const d = {
      lat: pos.coords.latitude.toFixed(6),
      lon: pos.coords.longitude.toFixed(6),
      acc: String(Math.round(pos.coords.accuracy))
    };
    try {
      await api('pac_patch', { pid: patientId, d });     // ✅ patientId capturado
      Object.assign(P[patientId], d);                     // ✅
      // Solo actualizar UI si el usuario SIGUE en esa ficha
      if (cur === patientId) {
        const gi = $('#gi');
        if (gi) gi.textContent = `${d.lat}, ${d.lon} · ±${d.acc} m`;
      }
      invalidatePacsCache();
      toast(`✓ Ubicación guardada (paciente) con ±${d.acc} m`);
    } catch (e) { toast(e.message, 1); }
  };

  watchId = navigator.geolocation.watchPosition(
    onPositionUpdate,
    (err) => {
      cleanup();
      if (bestPosition) savePosition(bestPosition);
      else toast('GPS: ' + err.message, 1);
    },
    { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
  );

  timeoutId = setTimeout(() => {
    cleanup();
    if (bestPosition) {
      toast(`Tiempo agotado. Guardando (±${Math.round(bestPosition.coords.accuracy)} m).`, 1);
      savePosition(bestPosition);
    } else {
      toast('No se pudo obtener una ubicación. Intenta de nuevo.', 1);
    }
  }, 20000);
}


  /* ─── Pin SVG para offline (no depende de imágenes externas) ─── */
function makePinIcon() {
  return L.divIcon({
    className: 'custom-pin',   // clase inocua, Leaflet la pone al contenedor
    html: `<svg viewBox="0 0 32 44" width="32" height="44"
             xmlns="http://www.w3.org/2000/svg"
             style="display:block;filter:drop-shadow(0 2px 5px rgba(0,0,0,.45))">
        <path d="M16 1C7.7 1 1 7.7 1 16c0 11.5 15 27 15 27s15-15.5 15-27C31 7.7 24.3 1 16 1z"
              fill="#8B2942" stroke="#ffffff" stroke-width="2"/>
        <circle cx="16" cy="16" r="5.5" fill="#ffffff"/>
      </svg>`,
    iconSize:    [32, 44],   // ancho × alto del SVG
    iconAnchor:  [16, 44],   // la PUNTA del pin queda sobre el punto geográfico
    popupAnchor: [0, -40],
    tooltipAnchor: [0, -40]
  });
}


  /* ═══════════════════════════════════════════════════════════════════════
   🏘️ CATASTRO · Capa de persistencia cifrada + Renderizado + CRUD
   ═══════════════════════════════════════════════════════════════════════ */

// 🎨 Pin de CASA: solo el No.Exterior en un círculo (clickeable, sin forma de gota)
//    - Verde si tiene paciente vinculado
//    - Burdeos si está libre
// 🆕 FIX RENDIMIENTO: cache de iconos (evita crear cientos de divIcon por re-render)
const _casaIconCache = new Map();
function makeCasaIcon(noExt, hasPatient) {
  const txt = String(noExt || '').trim();
  const key = txt + '|' + (hasPatient ? 1 : 0);
  const cached = _casaIconCache.get(key);
  if (cached) return cached;

  const len = txt.length;
  const h  = 18;
  const w  = len >= 4 ? 32 : (len === 3 ? 26 : 22);
  const fs = len >= 4 ? 10 : 11;
  const bg = hasPatient ? '#3f8f5b' : '#8B2942';

  const icon = L.divIcon({
    className: 'cat-casa-pin',
    html: `<div style="
      width:${w}px; height:${h}px;
      background:${bg}; color:#fff;
      border:none; border-radius:3px;
      display:flex; align-items:center; justify-content:center;
      font-weight:900; font-size:${fs}px; line-height:1;
      letter-spacing:-.2px;
      box-shadow:none;
      pointer-events:auto; cursor:pointer;
    ">${esc(txt)}</div>`,
    iconSize: [w, h],
    iconAnchor: [w/2, h/2],
    popupAnchor: [0, -h/2 - 2],
    tooltipAnchor: [0, -h/2 - 2]
  });
  if (_casaIconCache.size >= 1000) _casaIconCache.clear();
  _casaIconCache.set(key, icon);
  return icon;
}
  

// 🎨 Círculo de MANZANA (canvas-friendly)
const MAN_STYLE = { radius: 14, color: '#0d3333', weight: 3, fillColor: '#0d3333', fillOpacity: 0.75 };

// 🎨 Pin de MANZANA: solo el número en un cuadrado redondeado (clickeable)
// 🎨 Pin de MANZANA: rectángulo compacto, mismo estilo que casa,
//    pero ligeramente más grande y en verde oscuro para diferenciarse
function makeManzanaIcon(manzana) {
  const txt = String(manzana || '').trim();
  const len = txt.length;

  const h  = 20; // 2px más alto que casa (18) → jerarquía visual
  const w  = len >= 4 ? 34 : (len === 3 ? 28 : 24);
  const fs = len >= 4 ? 10 : 11.5;
  const bg = '#0d3333'; // verde oscuro catastro

  return L.divIcon({
    className: 'cat-manzana-pin',
    html: `<div style="
      width:${w}px; height:${h}px;
      background:${bg}; color:#fff;
      border:none; border-radius:3px;
      display:flex; align-items:center; justify-content:center;
      font-weight:900; font-size:${fs}px; line-height:1;
      letter-spacing:-.2px;
      box-shadow:none;
      pointer-events:auto; cursor:pointer;
    ">${esc(txt)}</div>`,
    iconSize: [w, h],
    iconAnchor: [w/2, h/2],
    popupAnchor: [0, -h/2 - 2],
    tooltipAnchor: [0, -h/2 - 2]
  });
}
  
// 🆔 Generador de IDs determinísticos (evita duplicados)
function catGenIdManzana(colonia, seccion, area, manzana) {
  const k = [colonia, seccion, area, manzana].map(v => norm(v || '')).join('|');
  // Hash FNV simple → base36 (mismo patrón que usa tu server para pid)
  let h = 2166136261;
  for (const c of k) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }
  return 'man_' + (h >>> 0).toString(36);
}
function catGenIdCasa(idPadre, noExt) {
  const k = String(idPadre) + '|' + norm(noExt || '');
  let h = 2166136261;
  for (const c of k) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }
  return 'cas_' + (h >>> 0).toString(36);
}

/* ─── Persistencia cifrada (mismo APP_KEY, mismo RAW_OFFDB) ───
   Guardamos DOS registros meta:
     • meta/cat_manzanas  → { id → manzana }
     • meta/cat_casas     → { id → casa }
   Cada uno cifrado AES-GCM con APP_KEY (el DK del enrollment).
   No usamos la cola de sync porque el catastro es 100% local del brigadista.
*/
let _catSaveManTimer = null;
let _catSaveCasTimer = null;

async function catLoad() {
  if (!APP_KEY) return;
  try {
    const [manRec, casRec] = await Promise.all([
      RAW_OFFDB.get('meta', 'cat_manzanas').catch(() => null),
      RAW_OFFDB.get('meta', 'cat_casas').catch(() => null)
    ]);
    if (manRec && manRec.value) {
      try {
        CAT_MANZANAS = await CRYPT.decryptJSON(APP_KEY, manRec.value);
      } catch(e) {
        // 🆕 DK cambió (re-enroll / cambio de password) → registro ilegible.
        //    Lo purgamos para que catSyncOnStart lo re-descargue del server.
        console.info('[cat] manzanas stale (DK cambió) — purgando y re-sincronizando');
        try { await RAW_OFFDB.del('meta', 'cat_manzanas'); } catch {}
        CAT_MANZANAS = {};
      }
    } else CAT_MANZANAS = {};
    if (casRec && casRec.value) {
      try {
        CAT_CASAS = await CRYPT.decryptJSON(APP_KEY, casRec.value);
      } catch(e) {
        console.info('[cat] casas stale (DK cambió) — purgando y re-sincronizando');
        try { await RAW_OFFDB.del('meta', 'cat_casas'); } catch {}
        CAT_CASAS = {};
      }
    } else CAT_CASAS = {};
  } catch (e) {
    console.warn('[catLoad]', e);
    CAT_MANZANAS = CAT_MANZANAS || {};
    CAT_CASAS    = CAT_CASAS    || {};
  }
}

function catSaveManzanas() {
  clearTimeout(_catSaveManTimer);
  _catSaveManTimer = setTimeout(async () => {
    if (!APP_KEY) return;
    try {
      const enc = await CRYPT.encryptJSON(APP_KEY, CAT_MANZANAS);
      await RAW_OFFDB.put('meta', { key: 'cat_manzanas', value: enc });  // ✅
    } catch (e) { console.warn('[catSaveManzanas]', e); }
  }, 400);
}

function catSaveCasas() {
  clearTimeout(_catSaveCasTimer);
  _catSaveCasTimer = setTimeout(async () => {
    if (!APP_KEY) return;
    try {
      const enc = await CRYPT.encryptJSON(APP_KEY, CAT_CASAS);
      await RAW_OFFDB.put('meta', { key: 'cat_casas', value: enc });     // ✅
    } catch (e) { console.warn('[catSaveCasas]', e); }
  }, 400);
}

/* ═══════════════════════════════════════════════════════════════
   ☁️ SYNC DE CATASTRO CON FIREBASE (compartido por base)
   ═══════════════════════════════════════════════════════════════ */

// Cada mutación llama a esto: sube si hay red, si no → cola
async function catSync(action, payload, extra) {
  if (!T) return;
  const d = { ...(extra || {}) };
  if (action === 'cat_save_manzana') d.m = payload;
  else if (action === 'cat_save_casa') d.c = payload;
  else if (action === 'cat_link_patient') d.pid = payload;   // 🆕
  else d.id = payload;

   const _noNet = !navigator.onLine || SAVING_MODE;   // 🆕
  if (!_noNet) {
    try {
      const r = await fetch('/api/ocrdb', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ a: action, t: T, ...d })
      });
      if (r.status === 401) { logout(); return; }
      if (r.ok) return;
    } catch (e) {
      console.warn('[catSync] red falló, encolando:', e.message);
    }
  }
  try { await OFFDB.queueSync({ a: action, d }); } catch (e) { console.warn('[catSync] queue', e); }
}

// Flush SOLO de los items cat_* (respeta la cola existente de pac_*/visit_*)
async function catFlushQueue() {
  if (!navigator.onLine || !T) return;
  if (SAVING_MODE) return;   // 🆕
  try {
    const queue = await OFFDB.getQueue();
    for (const item of queue) {
      if (!item.a || !item.a.startsWith('cat_')) continue;
      try {
        const r = await fetch('/api/ocrdb', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ a: item.a, t: T, ...item.d })
        });
        if (r.ok) await OFFDB.removeFromQueue(item.id);
        else if (r.status === 401) return;
      } catch (e) {}
    }
  } catch (e) { console.warn('[catFlushQueue]', e); }
}

// Descarga del servidor y merge (local pendiente gana)
async function catPull() {
  if (!navigator.onLine || !T) return;
  if (SAVING_MODE) return;   // 🆕
  let j;
  try {
    // 🔧 Paginación: iterar casas hasta que casasNextPage sea null
    let remoteMan = {}, remoteCas = {}, startAt = '', pages = 0;
    do {
      const r = await api('cat_get', { casasStartAt: startAt, casasLimit: 2000 });
      if (!r) break;
      if (r.manzanas) remoteMan = r.manzanas;
      if (r.casas) Object.assign(remoteCas, r.casas);
      startAt = r.casasNextPage || '';
      pages++;
      if (pages > 100) break;
    } while (startAt);
    j = { manzanas: remoteMan, casas: remoteCas };
  } catch (e) { console.warn('[catPull]', e.message); return; }
  if (!j) return;

  const remoteMan = j.manzanas || {};
  const remoteCas = j.casas || {};

  // IDs con cambio PENDIENTE en cola → no sobrescribir
  const pendingManIds = new Set();
  const pendingCasIds = new Set();
  try {
    const queue = await OFFDB.getQueue();
    for (const item of queue) {
      if (!item.a) continue;
      if (item.a === 'cat_save_manzana' && item.d?.m?.id) pendingManIds.add(item.d.m.id);
      if (item.a === 'cat_del_manzana'  && item.d?.id)    pendingManIds.add(item.d.id);
      if (item.a === 'cat_save_casa'    && item.d?.c?.id_unico_casa) pendingCasIds.add(item.d.c.id_unico_casa);
      if (item.a === 'cat_del_casa'     && item.d?.id)    pendingCasIds.add(item.d.id);
      // 🆕 cat_link_patient afecta a DOS casas → proteger ambas del merge
      if (item.a === 'cat_link_patient' && item.d?.casaId)       pendingCasIds.add(item.d.casaId);
      if (item.a === 'cat_link_patient' && item.d?.casaAnterior) pendingCasIds.add(item.d.casaAnterior);
    }
  } catch (e) {}

  // Merge manzanas
  const newMan = {};
  for (const id of Object.keys(remoteMan)) {
    if (pendingManIds.has(id) && CAT_MANZANAS[id]) newMan[id] = CAT_MANZANAS[id];
    else newMan[id] = remoteMan[id];
  }
  for (const id of Object.keys(CAT_MANZANAS)) {
    if (!newMan[id] && pendingManIds.has(id)) newMan[id] = CAT_MANZANAS[id];
  }
  CAT_MANZANAS = newMan;

  // Merge casas
  const newCas = {};
  for (const id of Object.keys(remoteCas)) {
    if (pendingCasIds.has(id) && CAT_CASAS[id]) newCas[id] = CAT_CASAS[id];
    else newCas[id] = remoteCas[id];
  }
  for (const id of Object.keys(CAT_CASAS)) {
    if (!newCas[id] && pendingCasIds.has(id)) newCas[id] = CAT_CASAS[id];
  }
  CAT_CASAS = newCas;

  catSaveManzanas();
  catSaveCasas();
  _catRenderManzanas();
  _catRenderCasas();
  _catPopulatePanelSelects();
}

// Al arrancar: FLUSH primero, luego PULL (nunca al revés)
async function catSyncOnStart() {
  await catFlushQueue();
  // 🆕 FIX RED: pull solo si >5 min desde el último pull exitoso.
  //    Antes se descargaba TODO el catastro paginado en cada arranque.
  const last = +localStorage.getItem('catLastPull') || 0;
  if (Date.now() - last < 5 * 60e3) return;
  await catPull();
  try { localStorage.setItem('catLastPull', String(Date.now())); } catch {}
}

  
/* ─── Carga inicial (llamada desde initMap) ─── */
let _catLoaded = false;
async function loadCatastroFromDB(force = false) {
  // 🆕 Si ya está cargado y no se fuerza, solo renderizar
  if (!force && _catLoaded) {
    _catRenderManzanas();
    _catRenderCasas();
    _catPopulatePanelSelects();
    return;
  }
  await catLoad();
  _catLoaded = true;
  
  // 🆕 Marcar el radio por defecto (100m) en la barra
  $$('#radioBar .radio-btn').forEach(b =>
    b.classList.toggle('on', +b.dataset.r === CAT_RADIUS)
  );

  // 🆕 Restaurar toggle de vista previo (si el usuario lo cambió en esta sesión)
  const viewBtn = $('#catViewBtn');
  if (viewBtn && CAT_MODE === 'only-patients') {
    viewBtn.textContent = '👁️ Solo con pacientes';
    viewBtn.style.background = 'var(--burgundy)';
    viewBtn.style.color = '#fff';
  }

  _catRenderManzanas();
  _catRenderCasas();
  _catPopulatePanelSelects();
}

/* ─── Poblar los <select> del panel de búsqueda ─── */
function _catPopulatePanelSelects() {
  const fills = (sel, values, currentVal) => {
    if (!sel) return;
    const v = currentVal ?? sel.value ?? '';
    const opts = ['<option value="">Todas</option>'].concat(
      [...new Set(values.filter(x => isReal(x)))].sort((a,b) =>
        a.localeCompare(b, 'es', {numeric:true, sensitivity:'base'}))
        .map(x => `<option value="${esc(x)}">${esc(x)}</option>`)
    );
    sel.innerHTML = opts.join('');
    if (v) sel.value = v;
  };

  const mans     = Object.values(CAT_MANZANAS);
  const colSel   = $('#catColonia');
  const secSel   = $('#catSeccion');
  const areaSel  = $('#catArea');
  const manSel   = $('#catManzana');
  const noExtInp = $('#catNoExt');

  let col   = colSel?.value?.trim() || '';
  let sec   = secSel?.value   || '';
  let area  = areaSel?.value  || '';
  let man   = manSel?.value   || '';
  let noExt = noExtInp?.value?.trim() || '';

  // 🆕 Colonia ahora es un <input> autocomplete → solo filtrar los demás
  //    selects si el texto coincide EXACTAMENTE con una colonia real.
  //    Así, mientras el usuario escribe "Cen" (parcial) no se vacían los demás.
  const colFilterActive = col && mans.some(m => norm(m.colonia) === norm(col));

  // NoExt → manzanas que contienen una casa con ese NoExt exacto
  const manzanasFromNoExt = new Set();
  if (noExt) {
    for (const c of Object.values(CAT_CASAS)) {
      if (norm(c.noExterior) === norm(noExt)) manzanasFromNoExt.add(c.id_padre);
    }
  }
  const noExtFilterActive = noExt && manzanasFromNoExt.size > 0;

  // Filtra el universo de manzanas aplicando todos los filtros
  // EXCEPTO el del propio campo `skip`.
  const filterExcept = (skip) => mans.filter(m => {
    if (skip !== 'col'  && colFilterActive && norm(m.colonia) !== norm(col))  return false;
    if (skip !== 'sec'  && sec  && norm(m.seccion) !== norm(sec))  return false;
    if (skip !== 'area' && area && norm(m.area)    !== norm(area)) return false;
    if (skip !== 'man'  && man  && norm(m.manzana) !== norm(man))  return false;
    if (skip !== 'noext' && noExtFilterActive && !manzanasFromNoExt.has(m.id)) return false;
    return true;
  });

  // 🆕 Colonia: input + datalist (autocomplete nativo del navegador)
  //    El datalist muestra TODAS las colonias que cumplen el resto de filtros.
  //    El navegador filtra las sugerencias automáticamente al escribir.
  if (colSel) {
    const dlCol = document.getElementById('dl-cat-colonias-panel');
    if (dlCol) {
      const colValues = [...new Set(filterExcept('col').map(m => m.colonia).filter(isReal))]
        .sort((a,b) => a.localeCompare(b, 'es', {numeric:true, sensitivity:'base'}));
      dlCol.innerHTML = colValues.slice(0, 500)
        .map(x => `<option value="${esc(x)}">`).join('');
    }
    col = colSel.value?.trim() || '';
  }

  fills(secSel,  filterExcept('sec') .map(m => m.seccion), sec);
  sec = secSel?.value || '';

  fills(areaSel, filterExcept('area').map(m => m.area), area);
  area = areaSel?.value || '';

  fills(manSel,  filterExcept('man') .map(m => m.manzana), man);
  man = manSel?.value || '';

  // Datalist de No.Ext válidos según el contexto actual
  if (noExtInp) {
    let dl = document.getElementById('dl-cat-noext');
    if (!dl) {
      dl = document.createElement('datalist');
      dl.id = 'dl-cat-noext';
      noExtInp.parentElement.appendChild(dl);
    }
    if (noExtInp.getAttribute('list') !== 'dl-cat-noext') {
      noExtInp.setAttribute('list', 'dl-cat-noext');
    }

    if (col || man) {
      const validMans = mans.filter(m => {
        if (colFilterActive && norm(m.colonia) !== norm(col))  return false;
        if (sec  && norm(m.seccion) !== norm(sec))  return false;
        if (area && norm(m.area)    !== norm(area)) return false;
        if (man  && norm(m.manzana) !== norm(man))  return false;
        return true;
      });
      const validManIds = new Set(validMans.map(m => m.id));

      const validNoExts = [...new Set(
        Object.values(CAT_CASAS)
          .filter(c => validManIds.has(c.id_padre) && isReal(c.noExterior))
          .map(c => c.noExterior)
      )].sort((a, b) => String(a).localeCompare(String(b), 'es', {numeric:true}));

      dl.innerHTML = validNoExts.slice(0, 500)
        .map(v => `<option value="${esc(v)}">`).join('');
    } else {
      dl.innerHTML = '';
    }
  }
}
  
/* ─── Renderizar manzanas en el clúster ─── */
function _catRenderManzanas() {
  if (!CL_MAN) return;
  if (!MAP || !MAP._container || !MAP._container.isConnected) return;
  if (!MAP._container.offsetWidth) return;   // 🆕 mapa realmente visible
  CL_MAN.clearLayers();
  Object.values(CAT_MANZANAS).forEach(man => {
    if (!isFinite(man.lat) || !isFinite(man.lng)) return;
    const mk = L.marker([+man.lat, +man.lng], {
      icon: makeManzanaIcon(man.manzana),
      keyboard: false,
      draggable: false
    });
    mk._catManId = man.id;
    mk.bindPopup(_catManzanaPopupHTML(man), {
      maxWidth: 320, minWidth: 240, maxHeight: '70vh', autoPan: true
    });
    CL_MAN.addLayer(mk);
  });
}

/* ─── Renderizar casas en el clúster ─── */
/* ═══════════════════════════════════════════════════════════════════════
   👥 MULTI-PACIENTE POR CASA · helpers
   ═══════════════════════════════════════════════════════════════════════ */
function getCasaPatients(cas) {
  if (!cas) return [];
  const seen = new Set();
  const out = [];
  if (cas.pacientes && typeof cas.pacientes === 'object') {
    for (const pid of Object.keys(cas.pacientes)) {
      if (cas.pacientes[pid] && P[pid] && !seen.has(pid)) {
        seen.add(pid);
        out.push(pid);
      }
    }
  }
  // Retrocompatibilidad: incluir paciente_id viejo si aún existe
  if (cas.paciente_id && P[cas.paciente_id] && !seen.has(cas.paciente_id)) {
    out.push(cas.paciente_id);
  }
  return out;
}
function casaHasPatients(cas) {
  return getCasaPatients(cas).length > 0;
}
function addPatientToCasa(cas, pid) {
  if (!cas || !pid) return;
  if (!cas.pacientes || typeof cas.pacientes !== 'object') cas.pacientes = {};
  // Migrar legacy → objeto
  if (cas.paciente_id && !cas.pacientes[cas.paciente_id]) {
    cas.pacientes[cas.paciente_id] = true;
  }
  delete cas.paciente_id;
  cas.pacientes[pid] = true;
}
function removePatientFromCasa(cas, pid) {
  if (!cas || !pid) return;
  if (cas.paciente_id === pid) delete cas.paciente_id;
  if (cas.pacientes && cas.pacientes[pid]) delete cas.pacientes[pid];
}

/* ─── Renderizar casas en el clúster ─── */
function _catRenderCasas() {
  if (!CL_CAS) return;
  if (!MAP || !MAP._container || !MAP._container.isConnected) return;
  if (!MAP._container.offsetWidth) return;   // 🆕 mapa realmente visible (no hidden)
  CL_CAS.clearLayers();
  
  const radioActivo = !!_catUserLatLng;

  Object.values(CAT_CASAS).forEach(cas => {
    if (!isFinite(cas.lat) || !isFinite(cas.lng)) return;
    const hasPatient = casaHasPatients(cas);
    // ── RADIO GPS ACTIVO: regla estricta ──
    // Solo casas con paciente_id vinculado Y dentro del radio.
    // (Las casas sin paciente se ignoran mientras el GPS esté activo.)
    if (radioActivo) {
      if (!hasPatient) return;
      const dist = catHaversine(_catUserLatLng.lat, _catUserLatLng.lng, +cas.lat, +cas.lng);
      if (dist > CAT_RADIUS) return;
    } else {
      // ── SIN RADIO: respeta el toggle de vista ──
      if (CAT_MODE === 'only-patients' && !hasPatient) return;
    }

    const mk = L.marker([+cas.lat, +cas.lng], {
      icon: makeCasaIcon(cas.noExterior, hasPatient),
      draggable: false,
      keyboard: false
    });
    mk._catCasId = cas.id_unico_casa;
    mk.bindPopup(_catCasaPopupHTML(cas), { maxWidth: 280, minWidth: 200 });
    CL_CAS.addLayer(mk);
  });
}
/* ─── Popup HTML de manzana (con lista de casas clickeables) ─── */
function _catManzanaPopupHTML(man) {
  const casasMan = Object.values(CAT_CASAS).filter(c => c.id_padre === man.id);

  // Ordenar por No.Exterior numérico (los no-numéricos al final, alfabéticos)
  casasMan.sort((a, b) => {
    const na = parseInt(String(a.noExterior || '').replace(/\D/g, ''), 10);
    const nb = parseInt(String(b.noExterior || '').replace(/\D/g, ''), 10);
    if (isNaN(na) && isNaN(nb))
      return String(a.noExterior || '').localeCompare(String(b.noExterior || ''), 'es');
    if (isNaN(na)) return 1;
    if (isNaN(nb)) return -1;
    return na - nb;
  });

  const numCasas = casasMan.length;
  const dir = [man.colonia, man.seccion ? 'Secc. ' + man.seccion : '', man.area ? 'Área ' + man.area : '', 'Mz. ' + man.manzana]
    .filter(Boolean).join(' · ');

  // ── Lista de casas: cada una es un botón que vuela a la casa ──
  const casasList = casasMan.map(c => {
    const pidsInCasa = getCasaPatients(c);
    const tienePac   = pidsInCasa.length > 0;
    const bg         = tienePac ? 'var(--ok)' : 'var(--burgundy)';
    const pacLbl     = pidsInCasa.length === 1
      ? String((P[pidsInCasa[0]] || {}).nombre || '').trim().slice(0, 15)
      : pidsInCasa.length + ' pacientes';
    const meta = tienePac
      ? `<span style="font-size:10px;opacity:.9;margin-left:auto;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:115px">👤 ${esc(pacLbl)}</span>`
      : `<span style="font-size:10px;opacity:.75;margin-left:auto;font-style:italic">libre</span>`;
    return `<button type="button" data-a="cat-go-casa" data-id="${esc(c.id_unico_casa)}"
      style="display:flex;align-items:center;gap:7px;width:100%;
             padding:6px 10px;margin-bottom:4px;
             background:${bg};color:#fff;border:0;border-radius:8px;
             font-weight:800;font-size:12.5px;cursor:pointer;
             text-align:left;line-height:1.15">
      <span style="font-size:13.5px">🏠 ${esc(c.noExterior || '—')}</span>
      ${meta}
    </button>`;
  }).join('');

  return `
    <div style="font-size:13px;line-height:1.35;min-width:220px">
      <div style="font-weight:900;color:var(--burgundy);font-size:13.5px;margin-bottom:2px">
        🏘️ Manzana ${esc(man.manzana || '—')}
      </div>
      <div style="color:var(--muted);font-size:11.5px;margin-bottom:8px">${esc(dir)}</div>

      ${numCasas > 0 ? `
        <div style="font-size:10.5px;font-weight:800;color:var(--muted);
                    text-transform:uppercase;letter-spacing:.3px;margin-bottom:5px">
          Casas (${numCasas}) · toca para ubicar
        </div>
        <div style="max-height:200px;overflow-y:auto;-webkit-overflow-scrolling:touch;
                    margin-bottom:9px;padding-right:2px">
          ${casasList}
        </div>
      ` : `
        <div style="font-size:11.5px;color:var(--muted);text-align:center;
                    padding:10px 0;margin-bottom:8px;font-style:italic">
          Sin casas registradas aún
        </div>
      `}

      <div style="display:flex;gap:5px;flex-wrap:wrap">
        <button data-a="cat-manzana-addcasa" data-id="${esc(man.id)}"
          style="background:var(--burgundy);color:#fff;border:0;border-radius:999px;
                 padding:6px 11px;font-size:11.5px;font-weight:800;cursor:pointer">
          ➕ Agregar Casa
        </button>
        <button data-a="cat-manzana-edit" data-id="${esc(man.id)}"
          style="background:var(--cream-2);color:var(--text);border:1px solid var(--border);
                 border-radius:999px;padding:6px 11px;font-size:11.5px;font-weight:800;cursor:pointer">
          ✏️ Editar
        </button>
      </div>

  
    </div>`;
}

/* ─── Popup HTML de casa ─── */
/* ─── Popup HTML de casa (MULTI-PACIENTE) ─── */
function _catCasaPopupHTML(cas) {
  const padre = CAT_MANZANAS[cas.id_padre];
  const pidsInCasa = getCasaPatients(cas);
  const tienePac = pidsInCasa.length > 0;
  const dir = padre
    ? [padre.colonia, padre.seccion ? 'Secc. ' + padre.seccion : '', 'Mz. ' + padre.manzana].filter(Boolean).join(' · ')
    : '—';

  const pacListHtml = pidsInCasa.map(pid => {
    const pac = P[pid] || {};
    return `<div style="display:flex;align-items:center;gap:5px;padding:5px 8px;background:var(--chip);border-radius:7px;margin-bottom:4px">
      <button data-a="cat-casa-open-pac" data-id="${esc(cas.id_unico_casa)}" data-pid="${esc(pid)}"
        title="Abrir ficha de ${esc(pac.nombre || '—')}"
        style="flex:1;min-width:0;background:none;border:0;padding:0;margin:0;text-align:left;
               cursor:pointer;font:inherit;font-size:11.5px;font-weight:700;color:var(--text);
               overflow:hidden;text-overflow:ellipsis;white-space:nowrap">👤 ${esc(pac.nombre || '—')}</button>
      <button data-a="cat-casa-unlink-patient" data-id="${esc(cas.id_unico_casa)}" data-pid="${esc(pid)}"
        title="Desvincular"
        style="background:#fdeaea;color:var(--err);border:1px solid #f2c4c4;border-radius:999px;
               padding:3px 8px;font-size:10.5px;font-weight:800;cursor:pointer;line-height:1">✕</button>
    </div>`;
  }).join('');
  
  return `
    <div style="font-size:13px;line-height:1.35">
      <div style="font-weight:900;color:${tienePac ? 'var(--ok)' : 'var(--burgundy)'};font-size:14px;margin-bottom:2px">
        🏠 No. ${esc(cas.noExterior || '—')}
      </div>
      <div style="color:var(--muted);font-size:11.5px;margin-bottom:8px">${esc(dir)}</div>
      ${tienePac
        ? `<div style="font-size:10.5px;font-weight:800;color:var(--muted);
                       text-transform:uppercase;letter-spacing:.3px;margin-bottom:4px">
             ${pidsInCasa.length} paciente${pidsInCasa.length>1?'s':''} vinculado${pidsInCasa.length>1?'s':''}
           </div>
           ${pacListHtml}
           <button data-a="cat-casa-link-more" data-id="${esc(cas.id_unico_casa)}"
             style="background:var(--burgundy);color:#fff;border:0;border-radius:999px;
                    padding:5px 11px;font-size:11px;font-weight:800;cursor:pointer;width:100%;margin-top:4px">
             ➕ Vincular otro paciente
           </button>`
        : `<div style="font-size:11.5px;color:var(--muted);margin-bottom:6px">Sin pacientes vinculados</div>
           <button data-a="cat-casa-link-patient" data-id="${esc(cas.id_unico_casa)}"
             style="background:var(--burgundy);color:#fff;border:0;border-radius:999px;
                    padding:5px 11px;font-size:11px;font-weight:800;cursor:pointer;width:100%;margin-bottom:6px">
             ➕ Vincular paciente
           </button>`
      }
      <div style="display:flex;gap:5px;flex-wrap:wrap;margin-top:6px">
        <button data-a="cat-casa-view-map" data-id="${esc(cas.id_unico_casa)}"
          style="background:var(--ok);color:#fff;border:0;
                 border-radius:999px;padding:6px 11px;font-size:11.5px;font-weight:800;cursor:pointer;flex:1">
          🗺️ Ver mapa
        </button>
        <button data-a="cat-casa-edit" data-id="${esc(cas.id_unico_casa)}"
          style="background:var(--cream-2);color:var(--text);border:1px solid var(--border);
                 border-radius:999px;padding:6px 11px;font-size:11.5px;font-weight:800;cursor:pointer;flex:1">
          ✏️ Editar / Mover
        </button>
      </div>
    </div>`;
}

/* ═══════════════════════════════════════════════════════════════════════
   🏘️ MODAL "Agregar Manzana" (abre con click en el mapa)
   ═══════════════════════════════════════════════════════════════════════ */
const CAT_MEM_KEY = 'catMemLast';   // localStorage: memoria de últimos valores

function _catMemRead() {
  try { return JSON.parse(localStorage.getItem(CAT_MEM_KEY) || '{}'); } catch { return {}; }
}
function _catMemWrite(o) {
  try { localStorage.setItem(CAT_MEM_KEY, JSON.stringify(o)); } catch {}
}

function _catOpenManzanaModal(lat, lng) {
  if (!isFinite(lat) || !isFinite(lng)) { toast('Toca el mapa primero', 1); return; }

  const mem = _catMemRead();
  // Sugerencias de valores existentes
  const mans = Object.values(CAT_MANZANAS);
  const uniq = (arr) => [...new Set(arr.filter(isReal))]
    .sort((a,b) => a.localeCompare(b, 'es', {numeric:true, sensitivity:'base'}));

  const colOpts = uniq(mans.map(m => m.colonia));
  const secOpts = uniq(mans.map(m => m.seccion));
  const areaOpts = uniq(mans.map(m => m.area));

  // Valores precargados (memoria de los últimos + colonia del paciente si aplica)
  const preCol = mem.colonia || '';
  const preSec = mem.seccion || '';
  const preAra = mem.area    || '';

  openModal(`
    <div class="sheet-head">🏘️ Nueva manzana<button class="close" data-a="close-modal">✕</button></div>
    <div class="sheet-body">
      <div style="font-size:11.5px;color:var(--muted);text-align:center;margin-bottom:14px;
                  padding:8px 12px;background:var(--cream-2);border-radius:var(--r-sm);border:1px solid var(--border)">
        📍 ${lat.toFixed(6)}, ${lng.toFixed(6)}
      </div>

      <div class="dgrid-2" style="gap:10px;margin-bottom:12px">
        <div class="dfield">
          <div class="lbl">Colonia *</div>
          <input id="catManColonia" list="dl-cat-colonias" value="${esc(preCol)}" placeholder="Ej. Centro" autocomplete="off">
          <datalist id="dl-cat-colonias">${colOpts.map(v => `<option value="${esc(v)}">`).join('')}</datalist>
        </div>
        <div class="dfield">
          <div class="lbl">Sección</div>
          <input id="catManSeccion" list="dl-cat-secciones" value="${esc(preSec)}" placeholder="Ej. 3" autocomplete="off">
          <datalist id="dl-cat-secciones">${secOpts.map(v => `<option value="${esc(v)}">`).join('')}</datalist>
        </div>
      </div>

      <div class="dgrid-2" style="gap:10px;margin-bottom:12px">
        <div class="dfield">
          <div class="lbl">Área</div>
          <input id="catManArea" list="dl-cat-areas" value="${esc(preAra)}" placeholder="Ej. A" autocomplete="off">
          <datalist id="dl-cat-areas">${areaOpts.map(v => `<option value="${esc(v)}">`).join('')}</datalist>
        </div>
        <div class="dfield">
          <div class="lbl">Manzana *</div>
          <input id="catManNum" inputmode="numeric" placeholder="Ej. 12" autocomplete="off">
        </div>
      </div>

      <div style="font-size:11px;color:var(--muted);text-align:center;line-height:1.4;margin-top:8px">
        💡 La colonia y el número de manzana son obligatorios. Evita duplicados.
      </div>
    </div>
    <div class="sheet-foot">
      <button class="btn g" data-a="close-modal" style="flex:1">Cancelar</button>
      <button class="btn p" data-a="cat-save-manzana" data-lat="${lat}" data-lng="${lng}" style="flex:1">💾 Guardar</button>
    </div>
  `, true);

  setTimeout(() => document.getElementById('catManColonia')?.focus(), 100);
}

async function _catSaveManzana(lat, lng) {
  const colonia = ($('#catManColonia')||{}).value?.trim() || '';
  const seccion = ($('#catManSeccion')||{}).value?.trim() || '';
  const area    = ($('#catManArea')   ||{}).value?.trim() || '';
  const manzana = ($('#catManNum')    ||{}).value?.trim() || '';

  if (!colonia) { toast('Falta la colonia', 1); return; }
  if (!manzana) { toast('Falta el número de manzana', 1); return; }

  const id = catGenIdManzana(colonia, seccion, area, manzana);
  if (CAT_MANZANAS[id]) {
    toast('Ya existe esta manzana (misma colonia/sección/área/número)', 1);
    return;
  }

  const now = Date.now();
  CAT_MANZANAS[id] = {
    id, tipo: 'manzana',
    colonia, seccion, area, manzana,
    lat: +lat, lng: +lng,
    createdAt: now,
    updatedAt: now
  };
  catSaveManzanas();
  catSync('cat_save_manzana', CAT_MANZANAS[id]).catch(() => {});
  _catMemWrite({ colonia, seccion, area });   // memoria para próxima

  toast('✓ Manzana agregada');
  closeModal();

  _catRenderManzanas();
  _catPopulatePanelSelects();

  // Vuelo suave a la nueva manzana (sin flyTo agresivo)
  if (MAP && isFinite(lat) && isFinite(lng)) {
    MAP.panTo([+lat, +lng], { animate: true, duration: 0.3 });
  }
}

/* ═══════════════════════════════════════════════════════════════════════
   🏘️ MODAL "Editar Manzana" (solo datos; mover es opcional)
   ═══════════════════════════════════════════════════════════════════════ */
function _catOpenManzanaEdit(id) {
  const man = CAT_MANZANAS[id];
  if (!man) return;

  openModal(`
    <div class="sheet-head">✏️ Editar manzana<button class="close" data-a="close-modal">✕</button></div>
    <div class="sheet-body">
      <div class="dgrid-2" style="gap:10px;margin-bottom:12px">
        <div class="dfield"><div class="lbl">Colonia *</div>
          <input id="catEditManColonia" value="${esc(man.colonia||'')}"></div>
        <div class="dfield"><div class="lbl">Sección</div>
          <input id="catEditManSeccion" value="${esc(man.seccion||'')}"></div>
      </div>
      <div class="dgrid-2" style="gap:10px;margin-bottom:12px">
        <div class="dfield"><div class="lbl">Área</div>
          <input id="catEditManArea" value="${esc(man.area||'')}"></div>
        <div class="dfield"><div class="lbl">Manzana *</div>
          <input id="catEditManNum" value="${esc(man.manzana||'')}"></div>
      </div>
      
<div class="dfield" style="margin-bottom:12px">
  <div class="lbl">Ubicación</div>
  <div style="font-size:13px;color:var(--text);padding:8px 11px;background:var(--cream-2);border-radius:var(--r-sm);border:1px solid var(--border);font-family:ui-monospace,monospace">
    ${(+man.lat).toFixed(6)}, ${(+man.lng).toFixed(6)}
  </div>
  <div style="display:flex;gap:8px;margin-top:8px">
  
    <button type="button" data-a="cat-manzana-del" data-id="${esc(id)}"
      style="flex:1;background:#fdeaea;color:var(--err);border:1px solid #f2c4c4;
             border-radius:var(--r-sm);padding:11px 14px;
             font-weight:800;font-size:13px;cursor:pointer">
      🗑 Eliminar
    </button>

      <button type="button" data-a="cat-manzana-move" data-id="${esc(id)}"
      style="flex:1;background:var(--cream-2);color:var(--text);
             border:1px solid var(--border);border-radius:var(--r-sm);padding:11px 14px;
             font-weight:800;font-size:13px;cursor:pointer">
      🖐️ Mover ubicación
    </button>
    
  </div>
</div>

      
    </div>
    <div class="sheet-foot">
      <button class="btn g" data-a="close-modal" style="flex:1">Cancelar</button>
      <button class="btn p" data-a="cat-save-manzana-edit" data-id="${esc(id)}" style="flex:1">💾 Guardar</button>
    </div>
  `, true);
}

async function _catSaveManzanaEdit(id) {
  const man = CAT_MANZANAS[id];
  if (!man) return;
  const colonia = ($('#catEditManColonia')||{}).value?.trim() || '';
  const seccion = ($('#catEditManSeccion')||{}).value?.trim() || '';
  const area    = ($('#catEditManArea')   ||{}).value?.trim() || '';
  const manzana = ($('#catEditManNum')    ||{}).value?.trim() || '';
  if (!colonia || !manzana) { toast('Colonia y manzana son obligatorios', 1); return; }

    const eraInegi = man.origen === 'INEGI';
  
  // Si cambian los 4 identificadores, el ID debe cambiar (para evitar colisiones)
  const newId = catGenIdManzana(colonia, seccion, area, manzana);
  if (newId !== id && CAT_MANZANAS[newId]) {
    toast('Ya existe otra manzana con esos datos', 1);
    return;
  }

  const upd = { ...man, colonia, seccion, area, manzana, updatedAt: Date.now() };

  if (newId !== id) {
    delete CAT_MANZANAS[id];
    upd.id = newId;
    CAT_MANZANAS[newId] = upd;

    // Re-apuntar casas hijas Y regenerar id_unico_casa determinístico
    const casasToRepoint = Object.values(CAT_CASAS).filter(c => c.id_padre === id);
    const repointed = [];
    const patientRepoint = [];   // 🆕 acumular sin N llamadas

    for (const c of casasToRepoint) {
      const oldCasaId = c.id_unico_casa;
      const newCasaId = catGenIdCasa(newId, c.noExterior);

      delete CAT_CASAS[oldCasaId];
      c.id_padre    = newId;
      c.id_unico_casa = newCasaId;
      c.updatedAt   = Date.now();
      CAT_CASAS[newCasaId] = c;

      // Actualizar TODOS los pacientes vinculados al nuevo casa_id
      const pids = Object.keys(c.pacientes || {});
      if (c.paciente_id) pids.push(c.paciente_id);
      for (const pid of pids) {
        if (P[pid]) {
          P[pid].casa_id = newCasaId;
          patientRepoint.push({ pid, newCasaId });   // 🆕
        }
      }

      repointed.push({
        oldId: oldCasaId,
        newId: newCasaId,
        casa: {
          noExterior: c.noExterior,
          lat: c.lat,
          lng: c.lng,
          pacientes: c.pacientes || {},
          paciente_id: c.paciente_id || '',
          createdAt: c.createdAt
        }
      });
    }
    catSaveCasas();

    /* 🆕 ANTES: 1 cat_save_casa × cada casa + 1 cat_save_manzana con GET grande.
       AHORA: 1 sola llamada con repointedCasas + patientRepoint → 1 multi-path PATCH.
       Si el cliente está offline, la cola guarda todo en 1 item, no en N. */
    try {
      await catSync('cat_save_manzana', CAT_MANZANAS[newId], {
        idViejo: id,
        repointedCasas: repointed,
        patientRepoint: patientRepoint,
      });
    } catch (e) { console.warn('[cat_save_manzana] sync', e); }
  } else {
    CAT_MANZANAS[id] = upd;
    catSaveManzanas();
    catSync('cat_save_manzana', CAT_MANZANAS[id]).catch(() => {});
  }

     // 🆕 SIN PERSISTENCIA: no guardamos nada en localStorage.
  toast('✓ Manzana actualizada');

  closeModal();
  _catRenderManzanas();
  _catRenderCasas();
  _catPopulatePanelSelects();
}
  
async function _catDeleteManzana(id) {
  const man = CAT_MANZANAS[id];
  if (!man) return;
  const casas = Object.values(CAT_CASAS).filter(c => c.id_padre === id);
  const msg = casas.length
    ? `Esta manzana tiene ${casas.length} casa(s) registrada(s). ¿Eliminar TODAS también?`
    : '¿Eliminar esta manzana?';

  const ok = await askConfirm(msg, '🗑 Eliminar manzana');
  if (!ok) return;

  /* 🆕 Recolectar casaIds y patientIds ANTES de mutar memoria local.
     Se enviarán al servidor para que haga 1 solo multi-path PATCH atómico
     (~300ms) en lugar del viejo GET grande + loop (~15-30s). */
  const casaIds = [];
  const patientIds = new Set();
  for (const c of casas) {
    casaIds.push(c.id_unico_casa);
    const pids = getCasaPatients(c);
    for (const pid of pids) if (P[pid]) patientIds.add(pid);
  }

  // Desvincular localmente (optimistic)
  for (const pid of patientIds) {
    if (P[pid]) P[pid].casa_id = '';
  }
  for (const c of casas) delete CAT_CASAS[c.id_unico_casa];

  catSaveCasas();
  delete CAT_MANZANAS[id];
  catSaveManzanas();

  /* 🆕 1 sola llamada atómica (en vez de N pac_patch + N cat_del_casa). */
  catSync('cat_del_manzana', id, {
    casaIds:    casaIds,
    patientIds: Array.from(patientIds),
  }).catch(() => {});

  toast('✓ Manzana eliminada');
  closeModal();
  _catRenderManzanas();
  _catRenderCasas();
  _catPopulatePanelSelects();
}
/* ═══════════════════════════════════════════════════════════════════════
   🏘️ MODAL "Agregar Casa" (abre desde popup de manzana)
   ═══════════════════════════════════════════════════════════════════════ */
function _catOpenCasaModal(idPadre) {
  const padre = CAT_MANZANAS[idPadre];
  if (!padre) return;

  openModal(`
    <div class="sheet-head">🏠 Nueva casa<button class="close" data-a="close-modal">✕</button></div>
    <div class="sheet-body">
      <div style="font-size:11.5px;color:var(--muted);text-align:center;margin-bottom:14px;
                  padding:8px 12px;background:var(--cream-2);border-radius:var(--r-sm);border:1px solid var(--border)">
        🏘️ ${esc(padre.colonia || '')} · Mz. ${esc(padre.manzana || '')}
      </div>

      <div class="dfield" style="margin-bottom:14px">
        <div class="lbl">No. Exterior *</div>
        <input id="catCasaNoExt" inputmode="numeric" placeholder="Ej. 42" autocomplete="off"
               style="font-size:18px;text-align:center;font-weight:800;letter-spacing:1px">
      </div>

      <div class="dfield" style="margin-bottom:12px">
        <div class="lbl">Ubicación</div>
        <div style="font-size:11.5px;color:var(--muted);line-height:1.45;margin-bottom:8px">
          Puedes capturar el GPS exacto de la casa ahora, o dejarla sin ubicación y moverla después.
        </div>
        <div style="display:flex;flex-direction:column;gap:6px">
          <button type="button" data-a="cat-casa-new-gps" data-id="${esc(idPadre)}"
            style="background:var(--burgundy);color:#fff;border:0;border-radius:var(--r-sm);
                   padding:12px 14px;font-weight:800;font-size:13px;cursor:pointer;
                   display:flex;align-items:center;justify-content:center;gap:6px">
            📍 Estoy aquí (GPS)
          </button>
          <button type="button" data-a="cat-casa-new-map" data-id="${esc(idPadre)}"
            style="background:var(--cream-2);color:var(--text);border:1px solid var(--border);
                   border-radius:var(--r-sm);padding:12px 14px;font-weight:800;font-size:13px;
                   cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px">
            🗺️ Elegir en mapa
          </button>
        </div>
      </div>

      <div style="font-size:11px;color:var(--muted);text-align:center;line-height:1.4">
        💡 Al guardar con GPS o mapa, la casa aparecerá en su ubicación.
        Si no, se ubicará sobre la manzana.
      </div>
    </div>
    <div class="sheet-foot">
      <button class="btn g" data-a="close-modal" style="flex:1">Cancelar</button>
      <button class="btn p" data-a="cat-save-casa" data-padre="${esc(idPadre)}" style="flex:1">💾 Guardar</button>
    </div>
  `, true);

  setTimeout(() => document.getElementById('catCasaNoExt')?.focus(), 100);
}

// Guarda la casa. Si `coords` es null, usa las coordenadas del padre.
async function _catSaveCasa(idPadre, lat, lng, src) {
  const padre = CAT_MANZANAS[idPadre];
  if (!padre) return false;
  const noExt = ($('#catCasaNoExt')||{}).value?.trim() || '';
  if (!noExt) { toast('Falta el número exterior', 1); return false; }

  const id = catGenIdCasa(idPadre, noExt);
  if (CAT_CASAS[id]) {
    toast('Ya existe esa casa en esta manzana', 1);
    return false;
  }

  // Fallback: si no hay coords, usar las de la manzana con pequeño offset aleatorio
  // Fallback: si no hay coords, usar las de la manzana con pequeño offset aleatorio
  // ✅ FIX: `+null === 0` es FINITO, por eso `isFinite()` NO detectaba null.
  //         Ahora revisamos null/undefined/'' explícitamente.
  const hasCoords =
    lat != null && lng != null &&
    lat !== '' && lng !== '' &&
    isFinite(+lat) && isFinite(+lng);

  let finalLat, finalLng;
  if (hasCoords) {
    finalLat = +lat;
    finalLng = +lng;
  } else {
    const angle = Math.random() * Math.PI * 2;
    const dist = 0.00015;   // ~15m
    finalLat = +padre.lat + Math.cos(angle) * dist;
    finalLng = +padre.lng + Math.sin(angle) * dist;
  }

  const now = Date.now();
  CAT_CASAS[id] = {
    id_unico_casa: id,
    id_padre: idPadre,
    tipo: 'casa',
    noExterior: noExt,
    lat: +finalLat,
    lng: +finalLng,
    paciente_id: '',
    pacientes: {},
    createdAt: now,
    updatedAt: now
  };

  
  catSaveCasas();
  catSync('cat_save_casa', CAT_CASAS[id]).catch(() => {});

  toast(src === 'gps' ? '✓ Casa agregada (GPS)' : '✓ Casa agregada');
  closeModal();
  _catRenderCasas();
  return true;
}

/* ═══════════════════════════════════════════════════════════════════════
   🏘️ MODAL "Editar Casa" (con botón "Mover ubicación" → drag)
   ═══════════════════════════════════════════════════════════════════════ */
let _catCasaDragging = null;   // { marker, casaId, onSave }

function _catOpenCasaEdit(casaId) {
  const cas = CAT_CASAS[casaId];
  if (!cas) return;
  const padre = CAT_MANZANAS[cas.id_padre];

  openModal(`
    <div class="sheet-head">✏️ Editar casa<button class="close" data-a="close-modal">✕</button></div>
    <div class="sheet-body">
      <div style="font-size:11.5px;color:var(--muted);text-align:center;margin-bottom:14px;
                  padding:8px 12px;background:var(--cream-2);border-radius:var(--r-sm);border:1px solid var(--border)">
        🏘️ ${esc(padre ? (padre.colonia + ' · Mz. ' + padre.manzana) : '—')}
      </div>

      <div class="dfield" style="margin-bottom:14px">
        <div class="lbl">No. Exterior *</div>
        <input id="catEditCasaNoExt" value="${esc(cas.noExterior||'')}"
               style="font-size:18px;text-align:center;font-weight:800;letter-spacing:1px">
      </div>

      <div class="dfield" style="margin-bottom:12px">
        <div class="lbl">Ubicación</div>
        <div style="font-size:13px;color:var(--text);padding:8px 11px;background:var(--cream-2);border-radius:var(--r-sm);border:1px solid var(--border);font-family:ui-monospace,monospace">
          ${(+cas.lat).toFixed(6)}, ${(+cas.lng).toFixed(6)}
        </div>
             <div style="display:flex;gap:8px;margin-top:8px">
         
          <button type="button" data-a="cat-casa-del" data-id="${esc(casaId)}"
            style="flex:1;background:#fdeaea;color:var(--err);border:1px solid #f2c4c4;
                   border-radius:var(--r-sm);padding:11px 14px;
                   font-weight:800;font-size:13px;cursor:pointer">
            🗑 Eliminar
          </button>

           <button type="button" data-a="cat-casa-move-mode" data-id="${esc(casaId)}"
            style="flex:1;background:var(--cream-2);color:var(--text);
                   border:1px solid var(--border);border-radius:var(--r-sm);padding:11px 14px;
                   font-weight:800;font-size:13px;cursor:pointer">
            🖐️ Mover ubicación
          </button>
          
        </div>
        <div id="catMoveHint" style="display:none;font-size:11.5px;color:var(--warn);
             text-align:center;margin-top:6px;font-weight:700">
          Arrastra el pin. Al soltarlo se guardará la nueva ubicación.
        </div>
      </div>
    </div>
    <div class="sheet-foot">
      <button class="btn g" data-a="close-modal" style="flex:1">Cancelar</button>
      <button class="btn p" data-a="cat-save-casa-edit" data-id="${esc(casaId)}" style="flex:1">💾 Guardar</button>
    </div>
  `, true);
}

async function _catSaveCasaEdit(casaId) {
  const cas = CAT_CASAS[casaId];
  if (!cas) return;
  const noExt = ($('#catEditCasaNoExt')||{}).value?.trim() || '';
  if (!noExt) { toast('Falta el número exterior', 1); return; }

  // Si cambia el NoExt, ID debería cambiar (mismo principio que manzana)
  const newId = catGenIdCasa(cas.id_padre, noExt);
  if (newId !== casaId && CAT_CASAS[newId]) {
    toast('Ya existe otra casa con ese número en esta manzana', 1);
    return;
  }

  const upd = { ...cas, noExterior: noExt, updatedAt: Date.now() };
  if (newId !== casaId) {
    delete CAT_CASAS[casaId];
    upd.id_unico_casa = newId;
    CAT_CASAS[newId] = upd;

    /* 🆕 Acumular patientIds sin N llamadas pac_patch.
       El server hará 1 solo dbMulti atómico:
         · DELETE catcas/{idViejo}
         · PUT    catcas/{idNuevo}
         · pac/pid/casa_id = idNuevo   (para cada pid)
       Antes: 1 DELETE + 1 PUT + N pac_patch secuenciales → race conditions. */
    const pidsInCasa = getCasaPatients(upd);
    const patientIds = [];
    for (const pid of pidsInCasa) {
      if (P[pid]) {
        P[pid].casa_id = newId;
        patientIds.push(pid);   // 🆕 acumular
      }
    }
    catSaveCasas();

    // 1 sola llamada con patientIds → server usa fast path atómico.
    try {
      await catSync('cat_save_casa', CAT_CASAS[newId], {
        idViejo: casaId,
        patientIds,
      });
    } catch (e) { console.warn('[cat_save_casa_edit] sync', e); }
  } else {
    CAT_CASAS[casaId] = upd;
    catSaveCasas();
    catSync('cat_save_casa', CAT_CASAS[casaId]).catch(() => {});
  }

  toast('✓ Casa actualizada');
  closeModal();
  _catRenderCasas();
}

function _catStartCasaDrag(casaId) {
  // 🆕 Si ya había un drag activo, restaurarlo antes (evita marker huérfano)
  if (_catCasaDragging) {
    try { _catCasaDragging.restore(); } catch (e) {}
    _catCasaDragging = null;
  }
  const cas = CAT_CASAS[casaId];
  if (!cas || !CL_CAS || !MAP) return;

  // Encontrar el marker existente y hacerlo draggable
  let targetLayer = null;
  CL_CAS.eachLayer(l => {
    if (l._catCasId === casaId) targetLayer = l;
  });
  if (!targetLayer) {
    toast('Abre el mapa para mover el pin', 1);
    return;
  }

  // Salir del clúster temporalmente (para arrastrar sin cluster weirdness)
  CL_CAS.removeLayer(targetLayer);
  targetLayer.options.draggable = true;
  targetLayer.addTo(MAP);

  const oldLat = +cas.lat, oldLng = +cas.lng;
  targetLayer.setLatLng([oldLat, oldLng]);

  const onDragEnd = () => {
    const { lat, lng } = targetLayer.getLatLng();
    cas.lat = +lat.toFixed(6);
    cas.lng = +lng.toFixed(6);
    cas.updatedAt = Date.now();
    catSaveCasas();
    catSync('cat_save_casa', cas).catch(() => {});
    toast('✓ Ubicación actualizada');
  };
  targetLayer.on('dragend', onDragEnd);

  toast('🖐️ Arrastra el pin a la nueva ubicación');

  const hint = $('#catMoveHint');
  if (hint) hint.style.display = 'block';

  // Al cerrar el modal, devolver al clúster
  _catCasaDragging = {
    marker: targetLayer,
    casaId,
    restore: () => {
      targetLayer.off('dragend', onDragEnd);
      targetLayer.options.draggable = false;
      if (MAP && MAP.hasLayer(targetLayer)) MAP.removeLayer(targetLayer);
      CL_CAS.addLayer(targetLayer);
      _catCasaDragging = null;
    }
  };
}

async function _catDeleteCasa(casaId) {
  const cas = CAT_CASAS[casaId];
  if (!cas) return;
  const pidsInCasa = getCasaPatients(cas);
  const msg = pidsInCasa.length
    ? `Esta casa está vinculada a ${pidsInCasa.length} paciente${pidsInCasa.length>1?'s':''}. ¿Eliminar de todos modos?`
    : '¿Eliminar esta casa?';
  const ok = await askConfirm(msg, '🗑 Eliminar casa');
  if (!ok) return;

  /* 🆕 Optimistic local: desvincular YA en memoria (sin N llamadas pac_patch).
     El servidor hará 1 PATCH atómico con todos los pacientes. */
  for (const pid of pidsInCasa) {
    if (P[pid]) P[pid].casa_id = '';
  }
  delete CAT_CASAS[casaId];
  catSaveCasas();

  /* 🆕 1 sola llamada con patientIds → servidor usa dbMulti (fast path).
     Antes: N pac_patch + 1 cat_del_casa con shallow GET de TODOS los pacientes (~500 KB).
     Ahora: 1 PATCH atómico (~2 KB de payload). */
  catSync('cat_del_casa', casaId, {
    patientIds: pidsInCasa.filter(pid => P[pid])
  }).catch(() => {});

  toast('✓ Casa eliminada');
  closeModal();
  _catRenderCasas();
}


  /* ═══════════════════════════════════════════════════════════════════════
   📏 HAVERSINE · Distancia en metros (offline, sin APIs)
   ═══════════════════════════════════════════════════════════════════════ */
function catHaversine(lat1, lng1, lat2, lng2) {
  const R = 6371000;                            // radio Tierra en metros
  const toRad = d => d * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat/2) ** 2 +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
            Math.sin(dLng/2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/* ═══════════════════════════════════════════════════════════════════════
   📍 POSICIÓN DEL USUARIO + CÍRCULO DE RADIO
   ═══════════════════════════════════════════════════════════════════════ */
let _catUserLatLng      = null;   // { lat, lng } o null
let _catRadiusCircle    = null;   // L.circle del radio actual


  function _catDrawRadiusCircle() {
  if (!MAP) return;

  // 🆕 FIX BATERÍA: reutilizar el círculo si ya existe.
  //    Antes: removeLayer + new L.circle en CADA tick del GPS
  //    (1-5 veces/segundo mientras el usuario camina) → CPU constante.
  if (!_catUserLatLng) {
    if (_catRadiusCircle) {
      try { MAP.removeLayer(_catRadiusCircle); } catch(e){}
      _catRadiusCircle = null;
    }
    return;
  }
  if (_catRadiusCircle) {
    _catRadiusCircle.setLatLng([_catUserLatLng.lat, _catUserLatLng.lng]);
    _catRadiusCircle.setRadius(CAT_RADIUS);
    return;
  }
  _catRadiusCircle = L.circle(
    [_catUserLatLng.lat, _catUserLatLng.lng],
    {
      radius: CAT_RADIUS,
      color: '#8B2942',
      fillColor: '#8B2942',
      fillOpacity: 0.06,
      weight: 2,
      dashArray: '6,6',
      interactive: false
    }
  ).addTo(MAP);
}
  

/* ═══════════════════════════════════════════════════════════════════════
   🔗 MODAL BUSCADOR DE CASAS · para vincular paciente
   ═══════════════════════════════════════════════════════════════════════ */
function _catOpenLinkPicker(patientId) {
  const pac = P[patientId];
  if (!pac) return;

  const mans = Object.values(CAT_MANZANAS);
  const colOpts = [...new Set(mans.map(m => m.colonia).filter(isReal))]
    .sort((a,b) => a.localeCompare(b, 'es', { numeric:true, sensitivity:'base' }));

  // Precargar con los datos del paciente si los tiene
  const preColonia = isReal(pac.colonia) ? pac.colonia : '';
  const preNoExt   = isReal(pac.numExt)  ? pac.numExt  : '';

  openModal(`
    <div class="sheet-head">🔗 Vincular a casa<button class="close" data-a="close-modal">✕</button></div>
    <div class="sheet-body">
      <div style="font-size:13px;color:var(--muted);margin-bottom:12px;text-align:center">
        Buscando casa para <b style="color:var(--text)">${esc(pac.nombre || '—')}</b>
      </div>
      <div class="dgrid-2" style="gap:10px;margin-bottom:12px">
        <div class="dfield">
          <div class="lbl">Colonia</div>
          <select id="catLinkColonia">
            <option value="">Todas</option>
            ${colOpts.map(v => `<option value="${esc(v)}" ${norm(v)===norm(preColonia)?'selected':''}>${esc(v)}</option>`).join('')}
          </select>
        </div>
        <div class="dfield">
          <div class="lbl">No. Exterior</div>
          <input id="catLinkNoExt" inputmode="numeric" value="${esc(preNoExt)}" placeholder="Ej. 42" autocomplete="off">
        </div>
      </div>
      <button type="button" class="btn p" data-a="cat-link-search" data-id="${esc(patientId)}"
        style="width:100%;font-size:13px;padding:12px;margin-bottom:12px">
        🔍 Buscar casas
      </button>
      <div id="catLinkResults">
        <div style="text-align:center;color:var(--muted);font-size:12.5px;padding:14px 0;font-style:italic">
          Toca "Buscar casas" para ver resultados
        </div>
      </div>
    </div>
    <div class="sheet-foot">
      <button class="btn g" data-a="close-modal" style="flex:1">Cancelar</button>
    </div>
  `, true);

  // Auto-buscar si tiene datos precargados
  if (preColonia || preNoExt) {
    setTimeout(() => _catDoLinkSearch(patientId), 120);
  }
}

function _catDoLinkSearch(patientId) {
  const col   = ($('#catLinkColonia')||{}).value?.trim() || '';
  const noExt = ($('#catLinkNoExt')||{}).value?.trim()   || '';

  let results = Object.values(CAT_CASAS);

  if (col) {
    results = results.filter(c => {
      const m = CAT_MANZANAS[c.id_padre];
      return m && norm(m.colonia) === norm(col);
    });
  }
  if (noExt) {
    results = results.filter(c => norm(c.noExterior) === norm(noExt));
  }

  // Ordenar: casas libres primero, luego las que ya tienen paciente
  // Ordenar: casas libres primero, luego las que ya tienen pacientes
  results.sort((a, b) => {
    const aLinked = casaHasPatients(a);
    const bLinked = casaHasPatients(b);
    if (aLinked !== bLinked) return aLinked ? 1 : -1;
    return String(a.noExterior).localeCompare(String(b.noExterior), 'es', { numeric:true });
  });

  const root = $('#catLinkResults');
  if (!root) return;

  if (!results.length) {
    root.innerHTML = '<div class="empty" style="padding:20px"><span class="big">🔍</span>Sin casas con esos criterios.</div>';
    return;
  }

  const LIMIT = 40;
  root.innerHTML = results.slice(0, LIMIT).map(cas => {
    const m = CAT_MANZANAS[cas.id_padre];
    const dir = m
      ? [m.colonia, 'Mz. ' + m.manzana, m.seccion ? 'Secc. ' + m.seccion : ''].filter(Boolean).join(' · ')
      : '—';
    const casaPids    = getCasaPatients(cas);
    const otherPids   = casaPids.filter(pid => pid !== patientId);
    const otherLbl    = otherPids.length
      ? otherPids.slice(0, 3).map(pid => (P[pid] || {}).nombre || '—').join(', ')
        + (otherPids.length > 3 ? ` (+${otherPids.length - 3})` : '')
      : null;
    const isLinked    = casaPids.includes(patientId);

    return `
      <button type="button" class="btn g" data-a="cat-link-pick"
        data-id="${esc(patientId)}" data-casa="${esc(cas.id_unico_casa)}"
        style="width:100%;text-align:left;justify-content:flex-start;padding:11px 13px;margin-bottom:8px;display:block;border-radius:10px;border-color:${casaPids.length ? 'var(--ok)' : 'var(--border)'}">
        <div style="font-weight:900;font-size:13.5px;color:${casaPids.length ? 'var(--ok)' : 'var(--text)'}">
          🏠 No. ${esc(cas.noExterior)}${isLinked ? ' ✓ ya vinculado' : ''}${casaPids.length > 1 ? ' · ' + casaPids.length + ' pacientes' : ''}
        </div>
        <div style="font-size:11.5px;color:var(--muted);margin-top:2px">${esc(dir)}</div>
        ${otherLbl ? `<div style="font-size:11px;color:var(--warn);margin-top:3px">👤 ${esc(otherLbl)}</div>` : ''}
      </button>
    `;
  }).join('') + (results.length > LIMIT
    ? `<div style="text-align:center;font-size:11.5px;color:var(--muted);padding:6px">Mostrando ${LIMIT} de ${results.length}…</div>`
    : '');
}

async function _catPickLink(patientId, casaId) {
  const cas = CAT_CASAS[casaId];
  if (!cas) { toast('Casa no existe', 1); return; }
  const pac = P[patientId];
  if (!pac) { toast('Paciente no existe', 1); return; }

  // 🆕 ¿Ya vinculado a esta casa?
  const already = getCasaPatients(cas).includes(patientId);
  if (already && pac.casa_id === casaId) {
    toast('Ya está vinculado a esta casa');
    closeModal();
    return;
  }

  const casaAnterior = pac.casa_id;
  const casaAnteriorExists = !!(casaAnterior && casaAnterior !== casaId && CAT_CASAS[casaAnterior]);

  // ── Optimistic local: desvincular de la vieja + vincular a la nueva ──
  if (casaAnteriorExists) {
    removePatientFromCasa(CAT_CASAS[casaAnterior], patientId);
    CAT_CASAS[casaAnterior].updatedAt = Date.now();
  }
  addPatientToCasa(cas, patientId);
  cas.updatedAt = Date.now();
  pac.casa_id = casaId;
  catSaveCasas();

  /* 🆕 1 sola llamada atómica al nuevo endpoint cat_link_patient.
     Server hace dbMulti:
       · pac/pid/casa_id = casaId
       · catcas/casaId/pacientes/pid = true
       · catcas/casaId/updatedAt = now
       · (si cambió) catcas/casaAnterior/pacientes/pid = null
       · (si cambió) catcas/casaAnterior/updatedAt = now
     Antes: 3 requests no atómicos → riesgo de doble vínculo fantasma. */
  catSync('cat_link_patient', patientId, {
    casaId,
    casaAnterior: casaAnteriorExists ? casaAnterior : '',
  }).catch(() => {});

  toast('✓ Paciente vinculado a la casa');
  closeModal();
  _catRenderCasas();

  // Refrescar la ficha si está abierta
  if (cur === patientId && !$('#detail').hidden) {
    tab(TAB, true);
  }
}
  

async function _catUnlinkPatient(patientId) {
  const pac = P[patientId];
  if (!pac) return;
  const casaId = pac.casa_id;
  if (!casaId) return;

  const ok = await askConfirm('¿Desvincular la casa del paciente?', '🔗 Desvincular');
  if (!ok) return;

  const cas = CAT_CASAS[casaId];
  if (cas) {
    removePatientFromCasa(cas, patientId);
    cas.updatedAt = Date.now();
    catSaveCasas();
    catSync('cat_save_casa', cas).catch(() => {});
  }
  pac.casa_id = '';
  api('pac_patch', { pid: patientId, d: { casa_id: '' } }).catch(() => {});

  toast('✓ Casa desvinculada');
  _catRenderCasas();
  if (cur === patientId && !$('#detail').hidden) {
    tab(TAB, true);
  }
}

/* ═══════════════════════════════════════════════════════════════════════
   🏠 RENDER DEL VÍNCULO EN LA PESTAÑA DATOS DEL PACIENTE
   ═══════════════════════════════════════════════════════════════════════ */
function _catRenderPatientHouseLink(p) {
  const casaId = p.casa_id;
  const tieneVinculo = casaId && CAT_CASAS[casaId];

  if (casaId && !CAT_CASAS[casaId]) {
    return `
      <div class="only-read" style="background:#fff7e6;border:1px solid var(--warn);border-radius:var(--r-sm);padding:10px 12px;margin-bottom:6px">
        <div style="font-weight:800;font-size:12.5px;color:var(--warn)">🏠 Casa ${esc(casaId)} (no cargada)</div>
        <div style="font-size:11px;color:var(--muted);margin-top:3px">Abre el mapa para sincronizar el catastro</div>
      </div>
      <div class="geo-box">
        <button type="button" class="btn only-edit" data-a="cat-link-open" data-id="${esc(cur)}" style="font-size:11.5px;padding:8px 10px;flex:1">🔄 Cambiar casa</button>
        <button type="button" class="btn only-edit" data-a="cat-link-unlink" data-id="${esc(cur)}" style="font-size:11.5px;padding:8px 10px;flex:1;background:#fdeaea;color:var(--err);border-color:#f2c4c4">🗑 Desvincular</button>
      </div>
    `;
  }

  if (tieneVinculo) {
    const cas = CAT_CASAS[casaId];
    const padre = CAT_MANZANAS[cas.id_padre];
    const dir = padre
      ? [padre.colonia, 'Mz. ' + padre.manzana, 'No. ' + cas.noExterior].filter(Boolean).join(' · ')
      : ('No. ' + cas.noExterior);

    // 🆕 Otros pacientes que comparten la misma casa
    const otrosPids = getCasaPatients(cas).filter(pid => pid !== cur);
    const otrosHtml = otrosPids.length
      ? `<div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:6px;align-items:center">
          <span style="font-size:10.5px;color:var(--muted);font-weight:700">Comparten casa:</span>
          ${otrosPids.map(pid => {
            const op = P[pid];
            if (!op) return '';
            const n = String(op.nombre || '').trim();
            return `<span data-a="cat-shared-open" data-id="${esc(pid)}" title="Abrir ficha de ${esc(n)}" style="display:inline-block;max-width:160px;padding:3px 9px;border-radius:999px;background:var(--chip);color:var(--chip-tx);font-weight:700;font-size:11px;cursor:pointer;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">👤 ${esc(n)}</span>`;
          }).join('')}
        </div>`
      : '';

    return `
      <div class="only-read" style="background:var(--chip);border:1px solid var(--border);border-radius:var(--r-sm);padding:10px 12px;margin-bottom:6px">
        <div style="font-weight:800;font-size:13px;color:var(--text)">🏠 ${esc(dir)}</div>
        ${otrosHtml}
      </div>
      <div class="geo-box">
        <button type="button" class="btn" data-a="cat-casa-view-map" data-id="${esc(casaId)}" style="font-size:11.5px;padding:8px 10px;flex:1;background:var(--ok);color:#fff;border-color:var(--ok)">🗺️ Ver ubicación</button>
        <button type="button" class="btn only-edit" data-a="cat-link-open" data-id="${esc(cur)}" style="font-size:11.5px;padding:8px 10px;flex:1">🔄 Cambiar casa</button>
        <button type="button" class="btn only-edit" data-a="cat-link-unlink" data-id="${esc(cur)}" style="font-size:11.5px;padding:8px 10px;flex:1;background:#fdeaea;color:var(--err);border-color:#f2c4c4">🗑 Desvincular</button>
      </div>
    `;
  }
  return `
    <div class="only-read" style="font-size:12.5px;color:var(--muted);padding:4px 0 6px">— Sin casa vinculada —</div>
    <button type="button" class="btn only-edit" data-a="cat-link-open" data-id="${esc(cur)}" style="width:100%;font-size:12px;padding:10px">🔗 Vincular a Casa del Mapa</button>
  `;
}

/* ═══════════════════════════════════════════════════════════════════════
   🗺️ MODAL · VER UBICACIÓN DE LA CASA (mini-mapa, solo lectura)
   ═══════════════════════════════════════════════════════════════════════ */
function _catViewHouseMap(casaId) {
  const cas = CAT_CASAS[casaId];
  if (!cas) { toast('Casa no encontrada', 1); return; }
  const lat = +cas.lat, lng = +cas.lng;
  if (!isFinite(lat) || !isFinite(lng)) { toast('Casa sin ubicación', 1); return; }

  const padre = CAT_MANZANAS[cas.id_padre];
  const pidsInCasa = getCasaPatients(cas);
  const pacNames = pidsInCasa.map(pid => (P[pid] || {}).nombre || '').filter(Boolean).join(', ');

  openModal(`
    <div class="sheet-head">🏠 Ubicación de la casa<button class="close" data-a="close-modal">✕</button></div>
    <div class="sheet-body" style="padding:0">
      <div id="catViewHouseMap" style="height:55vh;width:100%"></div>
      <div style="padding:10px 14px;font-size:12.5px;color:var(--muted);background:#fff;border-top:1px solid var(--border)">
        <div style="font-weight:800;color:var(--text);margin-bottom:2px">
          🏠 No. ${esc(cas.noExterior || '—')}${padre ? ' · ' + esc(padre.colonia || '') + ' · Mz. ' + esc(padre.manzana || '') : ''}
        </div>
        <div>Coordenadas: <b style="color:var(--text);font-family:ui-monospace,monospace">${lat.toFixed(6)}, ${lng.toFixed(6)}</b></div>
        ${pidsInCasa.length ? `<div style="margin-top:6px">👥 ${pidsInCasa.length} paciente${pidsInCasa.length>1?'s':''}: ${esc(pacNames)}</div>` : ''}
      </div>
    </div>
    <div class="sheet-foot">
      <a class="btn g" target="_blank" rel="noopener noreferrer" href="https://www.google.com/maps/search/?api=1&query=${lat},${lng}" style="flex:1;text-decoration:none;justify-content:center">Google Maps</a>
      <button class="btn p" data-a="close-modal" style="flex:1">Cerrar</button>
    </div>
  `, true);

   const __mv = _modalVersion;
  setTimeout(() => {
    if (__mv !== _modalVersion) return;      // 🆕 modal fue reemplazado/cerrado
    if (_pickMapInstance) return;             // 🆕 doble click
    if (!document.getElementById('catViewHouseMap')) return;
    const vm = L.map('catViewHouseMap', { zoomControl: true, zoomSnap: 0.5 }).setView([lat, lng], 19);
    
    L.tileLayer.offline('https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png?key=cb1_4no0_1_f130c033decf00e3dfc9fbdf', {
      maxZoom: 20, maxNativeZoom: 18,
      attribution: '© <a href="https://carto.com/attributions">CARTO</a> © OpenStreetMap'
    }).addTo(vm);

    L.marker([lat, lng], { icon: makePinIcon() }).addTo(vm)
      .bindPopup(`🏠 No. ${esc(cas.noExterior || '—')}`).openPopup();

    // Otras casas de la manzana como referencia (no interactivas)
    if (padre) {
      Object.values(CAT_CASAS).forEach(c => {
        if (c.id_padre !== cas.id_padre || c.id_unico_casa === casaId) return;
        if (!isFinite(+c.lat) || !isFinite(+c.lng)) return;
        L.marker([+c.lat, +c.lng], {
          icon: makeCasaIcon(c.noExterior, casaHasPatients(c)),
          interactive: false, keyboard: false
        }).addTo(vm);
      });
    }

    _pickMapInstance = vm;
    setTimeout(() => vm.invalidateSize(), 100);
  }, 60);
}

/* ═══════════════════════════════════════════════════════════════════════
   ➕ MODAL · ELEGIR PACIENTE PARA VINCULAR A UNA CASA
   ═══════════════════════════════════════════════════════════════════════ */
function _catOpenPatientPicker(casaId) {
  const cas = CAT_CASAS[casaId];
  if (!cas) return;
  const padre = CAT_MANZANAS[cas.id_padre];
  const already = new Set(getCasaPatients(cas));

  const candidates = Object.entries(P)
    .filter(([pid]) => !already.has(pid))
    .sort(([,a],[,b]) => String(a.nombre||'').localeCompare(String(b.nombre||''), 'es', {numeric:true, sensitivity:'base'}));

  const renderItem = ([pid, p]) => {
    const curCasa = p.casa_id && CAT_CASAS[p.casa_id];
    const curLbl = curCasa && curCasa.id_unico_casa !== casaId
      ? `<span style="color:var(--warn);font-size:10.5px;font-weight:700"> · ya en otra casa</span>` : '';
    return `
      <button data-a="cat-casa-pick-patient" data-casa="${esc(casaId)}" data-pid="${esc(pid)}"
        class="btn g" style="width:100%;text-align:left;justify-content:flex-start;padding:10px 12px;margin-bottom:6px;display:block;border-radius:10px">
        <div style="font-weight:800;font-size:13px;color:var(--text)">${esc(p.nombre || '—')}${curLbl}</div>
        <div style="font-size:11px;color:var(--muted);margin-top:2px">
          ${[p.calle, p.numExt ? '#'+p.numExt : '', p.colonia].filter(isReal).map(esc).join(' · ') || '—'}
        </div>
      </button>`;
  };

  openModal(`
    <div class="sheet-head">➕ Vincular paciente<button class="close" data-a="close-modal">✕</button></div>
    <div class="sheet-body">
      <div style="font-size:12px;color:var(--muted);text-align:center;margin-bottom:10px;padding:8px 12px;background:var(--cream-2);border-radius:var(--r-sm);border:1px solid var(--border)">
        🏠 No. ${esc(cas.noExterior || '—')}${padre ? ' · ' + esc(padre.colonia || '') + ' Mz.' + esc(padre.manzana || '') : ''}
      </div>
      <input id="catPatSearch" placeholder="🔍 Buscar por nombre, calle, colonia…" autocomplete="off"
        style="width:100%;padding:11px 14px;border:1.5px solid var(--border);border-radius:var(--r-sm);margin-bottom:10px;font-size:14px;outline:none">
      <div id="catPatResults" style="max-height:50vh;overflow-y:auto">
        ${candidates.length ? candidates.slice(0, 100).map(renderItem).join('') : '<div class="empty" style="padding:20px"><span class="big">👥</span>Sin candidatos</div>'}
      </div>
    </div>
    <div class="sheet-foot">
      <button class="btn g" data-a="close-modal" style="flex:1">Cancelar</button>
    </div>
  `, true);

  setTimeout(() => {
    const inp = document.getElementById('catPatSearch');
    if (!inp) return;
    inp.addEventListener('input', () => {
      const q = norm(inp.value).trim();
      const root = document.getElementById('catPatResults');
      if (!root) return;
      const filtered = !q ? candidates : candidates.filter(([,p]) =>
        norm([p.nombre, p.calle, p.colonia, p.numExt, p.curp, p.folio].join(' ')).includes(q)
      );
      root.innerHTML = filtered.slice(0, 100).map(renderItem).join('')
        || '<div class="empty" style="padding:20px">Sin resultados</div>';
    });
  }, 100);
}


  
/* ─── Mini-mapa modal para elegir ubicación de CASA ─── */
function _catPickMapForCasa(initialLat, initialLng, hasGPS, userLat, userLng, onSave, manzanaId, excludeCasaId) {
  /* 🆕 Coerción defensiva: acepta strings numéricos del backend (Firebase a veces
     serializa numbers como strings). Sin esto, Leaflet puede fallar en setView()
     o dibujar el pin en (0,0) si lat/lng llegan como texto. */
  initialLat = (initialLat != null && initialLat !== '' && isFinite(+initialLat)) ? +initialLat : null;
  initialLng = (initialLng != null && initialLng !== '' && isFinite(+initialLng)) ? +initialLng : null;
  userLat    = (userLat    != null && userLat    !== '' && isFinite(+userLat))    ? +userLat    : null;
  userLng    = (userLng    != null && userLng    !== '' && isFinite(+userLng))    ? +userLng    : null;

  if (_pickMapInstance) { try { _pickMapInstance.remove(); } catch(e){} _pickMapInstance = null; }
  let picked = { lat: initialLat, lng: initialLng };
  let mk = null;
  

  openModal(`
    <div class="sheet-head">📍 Ubicación de la casa<button class="close" data-a="close-modal">✕</button></div>
    <div class="sheet-body" style="padding:0">
      <div id="catPickMap" style="height:60vh;width:100%"></div>
      <div style="padding:10px 14px;font-size:12.5px;color:var(--muted);background:#fff;border-top:1px solid var(--border)">
        Toca el mapa o arrastra el pin para ubicar la casa.
        <br><b id="catPickCoord" style="color:var(--text);font-family:ui-monospace,monospace">${picked.lat ? (+picked.lat).toFixed(6)+', '+(+picked.lng).toFixed(6) : '—'}</b>
      </div>
    </div>
    <div class="sheet-foot">
      <button class="btn g" data-a="close-modal" style="flex:1">Cancelar</button>
      <button class="btn p" id="catPickSaveBtn" style="flex:1">💾 Usar ubicación</button>
    </div>
  `, true);

  const __mv = _modalVersion;
  setTimeout(() => {
    if (__mv !== _modalVersion) return;      // 🆕 modal fue reemplazado/cerrado
    if (_pickMapInstance) return;             // 🆕 doble click
    const el = document.getElementById('catPickMap');
    if (!el) return;
    const center = picked.lat ? [picked.lat, picked.lng]
                          : [userLat || 16.748, userLng || -93.180];

    // ✅ Zoom 18.5 (con zoomSnap:0.5) → menos pixelado que 20,
    //    pero suficiente para ver los números de las casas vecinas.
    const pm = L.map('catPickMap', {
      zoomControl: true,
      zoomSnap: 0.5,
      minZoom: 16,
    }).setView(center, 18.5);
    _pickMapInstance = pm;

    L.tileLayer.offline('https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png?key=cb1_4no0_1_f130c033decf00e3dfc9fbdf', {
      maxZoom: 20, maxNativeZoom: 18, attribution: '© CARTO © OSM'
    }).addTo(pm);

    // 🆕 Mostrar las OTRAS casas de la manzana como referencia visual
    //    (no interactivas → no interfieren con el click del usuario)
    if (manzanaId) {
      const casasMan = Object.values(CAT_CASAS).filter(c =>
        c.id_padre === manzanaId &&
        c.id_unico_casa !== excludeCasaId &&
        isFinite(+c.lat) && isFinite(+c.lng)
      );
      casasMan.forEach(cas => {
        const hasPatient = casaHasPatients(cas);
        L.marker([+cas.lat, +cas.lng], {
          icon: makeCasaIcon(cas.noExterior, hasPatient),
          interactive: false,     // ← deja pasar el click al mapa
          keyboard: false,
        }).addTo(pm);
      });
    }

    if (hasGPS && isFinite(userLat) && isFinite(userLng)) {
      L.circleMarker([userLat, userLng], {radius:9, color:'#fff', weight:3, fillColor:'#1e88e5', fillOpacity:1})
        .addTo(pm).bindPopup('Tu ubicación');
    }

    const syncPicked = () => {
      if (!mk) return;
      const ll = mk.getLatLng();
      picked = { lat: ll.lat, lng: ll.lng };
      const c = document.getElementById('catPickCoord');
      if (c) c.textContent = picked.lat.toFixed(6)+', '+picked.lng.toFixed(6);
    };

    if (picked.lat) {
      mk = L.marker([picked.lat, picked.lng], { draggable: true, icon: makePinIcon() }).addTo(pm);
      mk.on('dragend', syncPicked);
    }

    pm.on('click', (e) => {
      if (mk) pm.removeLayer(mk);
      mk = L.marker([e.latlng.lat, e.latlng.lng], { draggable: true, icon: makePinIcon() }).addTo(pm);
      mk.on('dragend', syncPicked);
      syncPicked();
    });

    setTimeout(() => pm.invalidateSize(), 100);

    const btn = document.getElementById('catPickSaveBtn');
    if (btn) btn.onclick = () => {
      let finalLat = picked.lat, finalLng = picked.lng;
      if (mk) {
        const ll = mk.getLatLng();
        finalLat = ll.lat;
        finalLng = ll.lng;
      }
      if (finalLat == null) { toast('Toca el mapa primero', 1); return; }
      if (_pickMapInstance) { try { _pickMapInstance.remove(); } catch(e){} _pickMapInstance = null; }
      closeModal();
      onSave(finalLat, finalLng);
    };
  }, 60);
}
  
/* ---------- MAPA ---------- */
/* ═══════════════════════════════════════════════════════════════
   🏘️ CATASTRO VISUAL · Estado en memoria (pacientes intactos)
   ═══════════════════════════════════════════════════════════════ */
let CAT_MANZANAS = {};          // { id → {id, tipo:'manzana', colonia, seccion, area, manzana, lat, lng} }
let CAT_CASAS    = {};          // { id → {id_unico_casa, id_padre, tipo:'casa', noExterior, lat, lng, paciente_id} }
let CL_MAN       = null;        // clúster de manzanas
let CL_CAS       = null;        // clúster de casas
let CAT_MODE     = 'all';       // 'all' | 'only-patients' (botón 👁️)
let CAT_RADIUS   = 100;         // metros (radio del GPS)
let CAT_RADIUS_LAYER = null;    // círculo translúcido

  let CAT_ADD_MODE = null;

// 🆕 Debounce del re-render de casas frente a ticks del GPS
let _catLastWatchLatLng = null;
let _catLastWatchTime = 0;

/* 🆕 Ubicaciones enviadas desde ubicacion.html (pines dorados con estrella) */
let CL_REMOTE = null;
let REMOTE_LOCS = new Map();          // label → { lat, lng, acc, at, pid, samples }
let SHOW_REMOTE = false;
let _remoteFetching = false;
let _remoteLastFetchAt = 0;
const REMOTE_CACHE_KEY = 'bRemoteLocs';
const REMOTE_CACHE_TTL = 12 * 3600 * 1000;   // 12 horas
  
/* ═══════════════════════════════════════════════════════════════════════
   ⭐ UBICACIONES ENVIADAS (desde ubicacion.html)
   ═══════════════════════════════════════════════════════════════════════ */
function _getPatientLabelForRemote(p) {
  if (!p) return '';
  const folio = String(p.folio || '').trim();
  if (folio && folio.toUpperCase() !== 'SN' && folio !== '-' && folio.length >= 2) {
    return folio;
  }
  const nombre = String(p.nombre || '').trim().replace(/\s+/g, '');
  if (nombre && nombre.length >= 2) return nombre;
  return '';
}

// 🔐 Cache cifrado con APP_KEY (AES-GCM) en IndexedDB, igual que pacientes.
// Migra automáticamente desde la versión vieja en localStorage (texto plano).
async function _loadRemoteCache() {
  REMOTE_LOCS.clear();
  try {
    // 1) Intentar versión cifrada nueva
    const rec = await RAW_OFFDB.get('meta', 'remoteLocs_v2').catch(() => null);
    if (rec && rec.value && APP_KEY) {
      try {
        const obj = await CRYPT.decryptJSON(APP_KEY, rec.value);
        for (const [label, entry] of Object.entries(obj || {})) {
          if (!entry || !entry.at) continue;
          REMOTE_LOCS.set(label, entry);
        }
        const revRec = await RAW_OFFDB.get('meta', 'remoteLocsRev').catch(() => null);
        if (revRec && revRec.value) {
          try { localStorage.setItem('lastLocRev', String(revRec.value)); } catch {}
        }
        return;
      } catch (e) {
        console.warn('[remote cache] decrypt falló → purgando', e);
        try { await RAW_OFFDB.del('meta', 'remoteLocs_v2'); } catch {}
        try { await RAW_OFFDB.del('meta', 'remoteLocsRev'); } catch {}
      }
    }

    // 2) MIGRACIÓN desde localStorage plano → IndexedDB cifrado
    const legacy = JSON.parse(localStorage.getItem(REMOTE_CACHE_KEY) || 'null');
    if (legacy && typeof legacy === 'object') {
      for (const [label, entry] of Object.entries(legacy)) {
        if (!entry || !entry.at) continue;
        REMOTE_LOCS.set(label, { ...entry, _fetchedAt: entry.at });
      }
      // Borrar la versión vieja YA (era texto plano)
      try { localStorage.removeItem(REMOTE_CACHE_KEY); } catch {}
      await _saveRemoteCache();
    }
  } catch (e) {
    console.warn('[remote cache load]', e);
  }
}

async function _saveRemoteCache() {
  if (!APP_KEY) return;
  try {
    const now = Date.now();
    const HARD_TTL = 30 * 24 * 3600e3; // 30 días
    const obj = {};
    for (const [label, entry] of REMOTE_LOCS) {
      if (!entry) continue;
      const ts = entry._fetchedAt || entry.at;
      if (ts && (now - ts) > HARD_TTL) continue;   // 🧹 purga
      obj[label] = entry;
    }
    const enc = await CRYPT.encryptJSON(APP_KEY, obj);
    await RAW_OFFDB.put('meta', { key: 'remoteLocs_v2', value: enc });
   } catch (e) {
    console.warn('[remote cache save]', e);
  }
}

// 🆕 Guarda la revisión de ubicaciones de dos formas: localStorage (rápido)
// y IndexedDB cifrado (persistente, sobrevive a wipe de localStorage).
async function _saveLocRev(rev) {
  try {
    localStorage.setItem('lastLocRev', String(rev));
    if (APP_KEY) {
      await RAW_OFFDB.put('meta', { key: 'remoteLocsRev', value: rev });
    }
  } catch (e) {}
}

function makeRemoteStarIcon() {
  return L.divIcon({
    className: 'remote-star-pin',
    html: `<div style="
      width: 22px; height: 22px;
      border-radius: 50%;
      background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
      border: 2px solid #fff;
      box-shadow: 0 1px 5px rgba(0,0,0,.4);
      display: flex; align-items: center; justify-content: center;
    ">
      <svg viewBox="0 0 24 24" width="12" height="12" fill="#fff" stroke="#fff" stroke-width="1" stroke-linejoin="round">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
      </svg>
    </div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
    popupAnchor: [0, -11]
  });
}
  
async function _fetchRemoteLocations(opts = {}) {
  if (_remoteFetching) return;
  if (!navigator.onLine) return;
  if (SAVING_MODE) return;   // 🆕

  const now = Date.now();
  // 🆕 FIX RED: throttle a 60s (antes 5s → hacía red cada vez que el usuario
  //    entraba al mapa, incluso si no había cambios reales).
  if (!opts.force && now - _remoteLastFetchAt < 60000) return;
  _remoteLastFetchAt = now;

  _remoteFetching = true;
  try {
    // 🆕 Helper: fetch con timeout (AbortController)
    const _fetchTO = async (url, opts, ms) => {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), ms);
      try {
        return await fetch(url, { ...opts, signal: ctrl.signal });
      } finally {
        clearTimeout(timer);
      }
    };

    // ─── Paso 1: ¿el server cambió? (~20 bytes) ───
    const lastRev = +localStorage.getItem('lastLocRev') || 0;
    let meta;
    try {
      const r = await _fetchTO('/api/ubicacion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ a: 'location_meta' })
      }, 8000);   // 🆕 8s timeout
      if (!r.ok) { console.warn('[sync] meta HTTP', r.status); return; }
      meta = await r.json();
    } catch (e) {
      console.warn('[sync] meta error:', e.message);
      return;
    }

    const serverRev = +meta.rev || 0;
    if (serverRev === lastRev) {
      if (!opts.silent && lastRev > 0) toast('✓ Ubicaciones al día');
      return;
    }

    // ─── Paso 2: pedir delta ───
    let delta;
    try {
      const r = await _fetchTO('/api/ubicacion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ a: 'location_delta', since: lastRev })
      }, 12000);   // 🆕 12s timeout (delta puede ser más grande)
      
      if (!r.ok) {
        if (r.status === 429) { if (!opts.silent) toast('⏳ Servidor ocupado', 1); return; }
        if (r.status === 400) { if (!opts.silent) toast('⚠️ Actualiza api/ubicacion.js en el server', 1); return; }
        return;
      }
      delta = await r.json();
    } catch (e) {
      console.warn('[sync] delta error:', e.message);
      return;
    }

    // ─── Paso 3: si el server pidió full → única vez ───
    if (delta.full) {
      await _syncFull(opts);
      return;
    }

    // ─── Paso 4: aplicar cambios (solo labels que cambiaron) ───
    const changes = delta.changes || {};
    const labelToPid = _buildLabelToPidMap();
    let applied = 0;
    for (const [label, loc] of Object.entries(changes)) {
      if (!loc || !isFinite(loc.lat) || !isFinite(loc.lng)) continue;
      const pid = labelToPid.get(label);
      if (!pid) continue;
      REMOTE_LOCS.set(label, {
        lat: loc.lat, lng: loc.lng, acc: loc.acc, at: loc.at,
        samples: loc.samples, pid, _fetchedAt: Date.now()
      });
      applied++;
    }

    // ─── Paso 5: guardar rev + cache cifrado ───
    if (delta.rev) await _saveLocRev(delta.rev);
    await _saveRemoteCache();

    if (!opts.silent) {
      if (applied > 0) toast(`✓ ${applied} ubicación${applied === 1 ? '' : 'es'} actualizada${applied === 1 ? '' : 's'}`);
      else toast('✓ Ubicaciones al día');
    }
  } finally {
    _remoteFetching = false;
  }
}

// 🆕 Construye mapa inverso label → pid una sola vez por sync (O(n))
function _buildLabelToPidMap() {
  const m = new Map();
  for (const pid in P) {
    const p = P[pid];
    if (!p) continue;
    const label = _getPatientLabelForRemote(p);
    if (label && !m.has(label)) m.set(label, pid);
  }
  return m;
}

// 🆕 Full sync paginado (solo en 1er arranque o si el server pidió full)
async function _syncFull(opts = {}) {
  const missing = [];
  const seen = new Set();
  // 🆕 Iterar sobre TODOS los pacientes, no solo los filtrados.
  //    Con LIST, si había filtro activo, el sync inicial solo bajaba
  //    los labels del filtro → 95% de pines dorados invisibles.
  for (const pid of Object.keys(P)) {
    const p = P[pid];
    if (!p) continue;
    if (p.lat && p.lon) continue;
    const label = _getPatientLabelForRemote(p);
    if (!label || seen.has(label)) continue;
    seen.add(label);
    missing.push({ pid, label });
  }

  if (!missing.length) {
    if (!opts.silent) toast('✓ Ubicaciones al día');
    return;
  }

  const BATCH = 50;
  let done = 0;
  for (let i = 0; i < missing.length; i += BATCH) {
    const chunk = missing.slice(i, i + BATCH);
    const labels = chunk.map(x => x.label);
    try {
      const r = await fetch('/api/ubicacion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ a: 'location_best_bulk', labels })
      });
      if (!r.ok) {
        if (r.status === 429) { if (!opts.silent) toast('⏳ Servidor ocupado', 1); break; }
        if (r.status === 400) { if (!opts.silent) toast('⚠️ Actualiza api/ubicacion.js', 1); break; }
        continue;
      }
      const j = await r.json();
      if (j && j.results) {
        for (const [label, loc] of Object.entries(j.results)) {
          if (!loc || !isFinite(loc.lat) || !isFinite(loc.lng)) continue;
          const match = chunk.find(x => x.label === label);
          if (!match) continue;
          REMOTE_LOCS.set(label, {
            lat: loc.lat, lng: loc.lng, acc: loc.acc, at: loc.at,
            samples: loc.samples, pid: match.pid, _fetchedAt: Date.now()
          });
        }
      }
    } catch (e) {
      console.warn('[syncFull] batch error:', e.message);
    }

    done += chunk.length;
    if (!opts.silent && missing.length > BATCH) {
      toast(`📍 Consultando ${done}/${missing.length}…`, 0, true);
    }
    if (i + BATCH < missing.length) {
      await new Promise(r => setTimeout(r, 300));
    }
  }

  // Actualizar rev
  try {
    const r = await fetch('/api/ubicacion', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ a: 'location_meta' })
    });
    if (r.ok) {
      const m = await r.json();
      if (m.rev) await _saveLocRev(m.rev);
    }
  } catch (e) {}

  await _saveRemoteCache();

  if (!opts.silent) {
    const found = missing.filter(x => REMOTE_LOCS.has(x.label)).length;
    toast(`✓ ${found} ubicación${found === 1 ? '' : 'es'} encontrada${found === 1 ? '' : 's'}`);
  }
}

function _drawRemoteMarkers() {
  if (!CL_REMOTE) return;

  // 🧹 Limpiar entradas obsoletas (paciente borrado, ya tiene GPS local, etc.)
  let purged = 0;
  for (const [label, loc] of REMOTE_LOCS) {
    if (!loc || !loc.pid) { REMOTE_LOCS.delete(label); purged++; continue; }
    const p = P[loc.pid];
    if (!p) { REMOTE_LOCS.delete(label); purged++; continue; }
    if (p.lat && p.lon) { REMOTE_LOCS.delete(label); purged++; continue; }
  }
  // Persistir purga en background (no bloquea)
  if (purged > 0) _saveRemoteCache().catch(() => {});

  CL_REMOTE.clearLayers();
  if (!SHOW_REMOTE) return;
  if (!MAP || !MAP._container || !MAP._container.isConnected) return;

  const visible = new Set(LIST);
  // 🆕 Si el radio GPS está activo, respetar la misma regla que las casas
  const radioActivo = !!_catUserLatLng;
  const radioMax = CAT_RADIUS;

  for (const [label, loc] of REMOTE_LOCS) {
    if (!isFinite(loc.lat) || !isFinite(loc.lng)) continue;
    const pid = loc.pid;
    if (!pid || !P[pid]) continue;
    if (!visible.has(pid)) continue;
    const p = P[pid];
    if (p.lat && p.lon) continue;
    // 🆕 Filtrar por distancia si "Mi ubicación" está encendida
    if (radioActivo) {
      const dist = catHaversine(_catUserLatLng.lat, _catUserLatLng.lng, +loc.lat, +loc.lng);
      if (dist > radioMax) continue;
    }
    

    const accTxt = loc.acc ? ` · ±${Math.round(loc.acc)}m` : '';
    let fecha = '';
    if (loc.at) {
      try {
        fecha = new Date(loc.at).toLocaleString('es-MX', {
          day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
        });
      } catch (e) {}
    }

    L.marker([+loc.lat, +loc.lng], { icon: makeRemoteStarIcon(), keyboard: false })
      .bindPopup(`
        <div style="font-family:system-ui;font-size:12px;line-height:1.55;min-width:200px">
          <b style="color:#d97706;font-size:13px">⭐ ${esc(p.nombre || '—')}</b><br>
          <span style="color:#666;font-size:11px">${p.folio ? 'Folio: ' + esc(p.folio) : 'Sin folio'}</span><br>
          ${isReal(p.calle) ? `<b>Calle:</b> ${esc(p.calle)}${isReal(p.numExt) ? ' #' + esc(p.numExt) : ''}<br>` : ''}
          ${isReal(p.colonia) ? `<b>Colonia:</b> ${esc(p.colonia)}<br>` : ''}
          <hr style="margin:6px 0;border:0;border-top:1px solid #eee">
          <b>📍 Ubicación enviada</b>${accTxt}<br>
          <span style="color:#999;font-size:10.5px">${fecha}</span><br>
          <a href="#" data-a="open" data-id="${esc(pid)}" style="color:#8B2942;font-weight:700;display:inline-block;margin-top:6px">→ Abrir ficha</a>
          ·
          <a target="_blank" rel="noopener noreferrer" href="https://www.google.com/maps/dir/?api=1&destination=${loc.lat},${loc.lng}" style="color:#1e88e5;font-weight:700">Cómo llegar</a>
        </div>
      `)
      .addTo(CL_REMOTE);
  }
}

function initMap() {
  if (typeof L === 'undefined') { toast('No se pudo cargar el mapa', 1); return; }
  if (MAP) return;

  // 🚀 preferCanvas: pinta círculos/polilíneas en canvas (no colapsa el DOM)
  MAP = L.map('map', {
    zoomControl: false,
    preferCanvas: true,
    updateWhenIdle: true,
    tap: false,
    maxZoom: 21
  }).setView([16.748, -93.180], 16);
  
    const streets = L.tileLayer.offline('https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png?key=cb1_4no0_1_f130c033decf00e3dfc9fbdf', {
    maxZoom: 21,
    maxNativeZoom: 18,
    attribution: '© <a href="https://carto.com/attributions">CARTO</a> © OpenStreetMap'
  });

  // 🆕 Estilo "Solo calles" (CARTO Positron `light_all`):
  // Muestra calles, avenidas y nombres SIN edificios destacados.
  // Ideal para orientación rápida sin el ruido visual de las construcciones.
  const minimal = L.tileLayer.offline('https://basemaps.cartocdn.com/rastertiles/light_all/{z}/{x}/{y}.png?key=cb1_4no0_1_f130c033decf00e3dfc9fbdf', {
    maxZoom: 21,
    maxNativeZoom: 18,
    attribution: '© <a href="https://carto.com/attributions">CARTO</a> © OpenStreetMap'
  });

       const sat = L.tileLayer.offline('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    maxZoom: 21,
    maxNativeZoom: 18,
    attribution: 'Esri'
  });

  streets.addTo(MAP);
  LAYERS.streets = streets;
  LAYERS.minimal = minimal;
  LAYERS.sat = sat;

  // ── Clúster de PACIENTES (sin cambios, lo usa drawMap()) ──
  CL = L.markerClusterGroup({showCoverageOnHover:false, maxClusterRadius:48});
  MAP.addLayer(CL);

  // ── NUEVO: clúster de MANZANAS ──
  CL_MAN = L.markerClusterGroup({
  showCoverageOnHover: false,
  // ✅ Radio dinámico: lejos agrupa más (se ve limpio), cerca agrupa menos (se ve el detalle)
  maxClusterRadius: (zoom) => {
    if (zoom < 14) return 100;   // muy lejos → burbujas grandes, no se amontonan
    if (zoom < 16) return 80;    // lejos → burbujas medianas
    return 60;                    // cerca → se abren más
  },
  disableClusteringAtZoom: 17,    // ← 15 → 17: pines individuales solo a zoom 17+
  iconCreateFunction(c) {
    return L.divIcon({
      html: `<div class="cat-cl-man">${c.getChildCount()}</div>`,
      className: 'cat-cl-man-wrap',
      iconSize: L.point(40, 40)
    });
  }
});
   

  // ── NUEVO: clúster de CASAS ──
  CL_CAS = L.markerClusterGroup({
    showCoverageOnHover: false,
    maxClusterRadius: 50,
    disableClusteringAtZoom: 18, 
    iconCreateFunction(c) {
      return L.divIcon({
        html: `<div class="cat-cl-cas">${c.getChildCount()}</div>`,
        className: 'cat-cl-cas-wrap',
        iconSize: L.point(36, 36)
      });
    }
  });

  // 🆕 Cluster de ubicaciones enviadas (dorado)
  CL_REMOTE = L.markerClusterGroup({
    showCoverageOnHover: false,
    maxClusterRadius: 50,
    disableClusteringAtZoom: 17,
    iconCreateFunction(c) {
      return L.divIcon({
        html: `<div class="cat-cl-remote">${c.getChildCount()}</div>`,
        className: 'cat-cl-remote-wrap',
        iconSize: L.point(36, 36)
      });
    }
  });
  MAP.addLayer(CL_REMOTE);

  // ── 🚀 Filtro por zoom: mostrarlos desde más lejos ──
  const applyZoomFilter = () => {
  const z = MAP.getZoom();
  // Manzanas: visibles desde zoom 13 (se ven desde lejos como clúster)
  if (z >= 13) { if (!MAP.hasLayer(CL_MAN)) MAP.addLayer(CL_MAN); }
  else         { if (MAP.hasLayer(CL_MAN))  MAP.removeLayer(CL_MAN); }
  // Casas: solo a zoom 18+ (como pediste, está bien)
  if (z >= 18) { if (!MAP.hasLayer(CL_CAS)) MAP.addLayer(CL_CAS); }
  else         { if (MAP.hasLayer(CL_CAS))  MAP.removeLayer(CL_CAS); }
  // 🆕 Ubicaciones enviadas: desde zoom 14+ (clúster dorado visible)
  if (z >= 14) { if (!MAP.hasLayer(CL_REMOTE)) MAP.addLayer(CL_REMOTE); }
  else         { if (MAP.hasLayer(CL_REMOTE))  MAP.removeLayer(CL_REMOTE); }
};
  applyZoomFilter();
  MAP.on('zoomend', applyZoomFilter);

  // ── Click en el mapa ──
  MAP.on('click', async e => {

    /* ═══════════════════════════════════════════════════════════
       🆕 PRIORIDAD 1: Si el modo INEGI está activo → consultar No. Mza
       ═══════════════════════════════════════════════════════════ */
    if (INEGI_ACTIVE) {
      toast('🔍 Consultando INEGI…');

      const info = await _inegiGetFeatureInfo(e.latlng);

      if (!info || !info.manzana) {
        toast('No se pudo leer la manzana en ese punto', 1);
        return;
      }

      // 🆕 SIN PERSISTENCIA: siempre preguntar a Nominatim en cada click
      const coloniaDetectada = await _reverseGeocodeColonia(e.latlng.lat, e.latlng.lng);

      // 🆕 ¿Ya existe esta manzana? (por colonia detectada + número)
      const existente = coloniaDetectada ? Object.values(CAT_MANZANAS).find(m =>
        m && norm(m.manzana) === norm(info.manzana) &&
             norm(m.colonia) === norm(coloniaDetectada)
      ) : null;

      if (existente) {
        await _inegiAfterManzana(e.latlng, info, existente, false);
        return;
      }

      // 🆕 SIEMPRE abrir el modal con la colonia pre-llenada por Nominatim
      //    (si Nominatim falla, el modal se abre con el campo vacío y el usuario escribe)
      _inegiOpenManzanaCapture(e.latlng, info, coloniaDetectada);
      return;
    }

    
    /* ═══════════════════════════════════════════════════════════
       PRIORIDAD 2: Modo "Agregar Manzana"
       ═══════════════════════════════════════════════════════════ */
    if (CAT_ADD_MODE === 'manzana-click') {
      CAT_ADD_MODE = null;
      const btn = $('#btnAddManzana');
      if (btn) btn.classList.remove('on');
      if (typeof _catOpenManzanaModal === 'function') {
        _catOpenManzanaModal(e.latlng.lat, e.latlng.lng);
      }
      return;
    }

    /* ═══════════════════════════════════════════════════════════
       PRIORIDAD 3: Selector de domicilio (PICK)
       ═══════════════════════════════════════════════════════════ */
    if (!PICK) return;
    const {lat, lng} = e.latlng;
    if (PICK.marker) MAP.removeLayer(PICK.marker);
    PICK.marker = L.marker([lat, lng], {
      draggable: true,
      icon: makePinIcon(),
      autoPan: true
    }).addTo(MAP);
    PICK.lat = lat; PICK.lng = lng;
    const c = $('#pickCoord');
    if (c) c.textContent = lat.toFixed(6) + ', ' + lng.toFixed(6);
  });

  // ── Cargar catastro desde IndexedDB (async, no bloquea el render) ──
  setTimeout(() => {
    if (typeof loadCatastroFromDB === 'function') loadCatastroFromDB();
  }, 0);
}

/* ═══════════════════════════════════════════════════════════════
   🌍 GEOCODIFICACIÓN INVERSA · Detectar nombre de colonia
   ═══════════════════════════════════════════════════════════════
   Usa Nominatim (OpenStreetMap), permitido en el CSP.
   Devuelve '' si no se pudo detectar. NO guarda nada; solo retorna.
   ═══════════════════════════════════════════════════════════════ */
/* ═══════════════════════════════════════════════════════════════
   🌍 GEOCODIFICACIÓN INVERSA · Detectar nombre de colonia
   ═══════════════════════════════════════════════════════════════
   Usa Nominatim (OpenStreetMap). El CSP debe permitir
   https://nominatim.openstreetmap.org en connect-src.
   Cache 24h por coordenada redondeada (~10m) para evitar rate limit.
   ═══════════════════════════════════════════════════════════════ */
/* ═══════════════════════════════════════════════════════════════
   🌍 GEOCODIFICACIÓN INVERSA · Con delay anti-rate-limit + retry
   ═══════════════════════════════════════════════════════════════
   Nominatim (OSM) permite 1 req/seg desde browsers.
   - Delay forzado de 1.1s entre llamadas
   - Retry 1 vez con 800ms si falla (429, 5xx, timeout)
   - Cache SOLO de éxitos (nunca de fracasos)
   - Fallback al último éxito si dos intentos fallan
   ═══════════════════════════════════════════════════════════════ */
const _nominatimCache = new Map();
const _NOMINATIM_TTL = 24 * 3600 * 1000;
let _nominatimLastCall = 0;       // timestamp de la última llamada
let _nominatimLastSuccess = '';   // último éxito para fallback

async function _reverseGeocodeColonia(lat, lng) {
  const cacheKey = `${(+lat).toFixed(4)},${(+lng).toFixed(4)}`;

  // 1️⃣ Cache hit de un éxito previo (mismo punto ±11m)
  const cached = _nominatimCache.get(cacheKey);
  if (cached && (Date.now() - cached.t) < _NOMINATIM_TTL) {
    return cached.v;
  }

  // 2️⃣ Delay anti-rate-limit: mínimo 1.1s entre llamadas
  const sinceLast = Date.now() - _nominatimLastCall;
  if (sinceLast < 1100) {
    await new Promise(r => setTimeout(r, 1100 - sinceLast));
  }

  // 3️⃣ Fetch con retry
  const _doFetch = async () => {
    _nominatimLastCall = Date.now();
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`;
    const resp = await fetch(url, { headers: { 'Accept-Language': 'es' } });
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    return await resp.json();
  };

  let data;
  try {
    data = await _doFetch();
  } catch (e) {
    console.warn('[reverseGeocode] 1er intento falló, retry en 800ms:', e.message);
    await new Promise(r => setTimeout(r, 800));
    try {
      data = await _doFetch();
    } catch (e2) {
      console.warn('[reverseGeocode] 2do intento también falló:', e2.message);
      // NO cachear el fracaso. Devolver el último éxito si existe.
      return _nominatimLastSuccess || '';
    }
  }

  // 4️⃣ Extraer colonia
  const a = data.address || {};
  const candidates = [
    a.suburb,
    a.neighbourhood,
    a.quarter,
    a.residential,
    a.city_district,
    a.town,
    a.village,
    a.hamlet,
  ];
  let v = '';
  for (const c of candidates) {
    const s = String(c || '').trim();
    if (s) { v = s; break; }
  }

  // 5️⃣ Cachear SOLO si hay valor
  if (v) {
    _nominatimCache.set(cacheKey, { v, t: Date.now() });
    _nominatimLastSuccess = v;
  }

  return v;
}
  
async function _inegiGetFeatureInfo(latlng) {
  if (!MAP || !INEGI_ACTIVE) return null;

  // Consulta un punto exacto
  const _tryAt = async (ll) => {
    try {
      const size   = MAP.getSize();
      const bounds = MAP.getBounds();
      const sw     = bounds.getSouthWest();
      const ne     = bounds.getNorthEast();
      const bbox   = `${sw.lat},${sw.lng},${ne.lat},${ne.lng}`;
      const point  = MAP.latLngToContainerPoint(ll);
      const i = Math.round(point.x);
      const j = Math.round(point.y);

      const params = new URLSearchParams({
        SERVICE: 'WMS', VERSION: '1.3.0', REQUEST: 'GetFeatureInfo',
        LAYERS: 'c104', QUERY_LAYERS: 'c104',
        STYLES: '', FORMAT: 'image/png', INFO_FORMAT: 'text/html',
        TRANSPARENT: 'true', CRS: 'EPSG:4326',
        BBOX: bbox, WIDTH: size.x, HEIGHT: size.y,
        I: i, J: j, FEATURE_COUNT: 1
      });
      const targetUrl = `${INEGI_WMS_URL}?${params.toString()}`;
      const proxyUrl  = `/api/inegi-proxy?target=${encodeURIComponent(targetUrl)}`;
      const resp = await fetch(proxyUrl);
      if (!resp.ok) return null;
      const html = await resp.text();

      const doc  = new DOMParser().parseFromString(html, 'text/html');
      const text = (doc.body.textContent || '').replace(/\s+/g, ' ').trim();
      if (!text || /no\s+feature|not\s+found|none/i.test(text)) return null;

      let cvegeo = null, mza = null;
      const m1 = text.match(/Clave\s+Geoestad[íi]stica[^\d]*(\d{13,16})/i);
      if (m1) cvegeo = m1[1];
      if (!cvegeo) {
        const m2 = text.match(/\b(\d{13,16})\b/);
        if (m2) cvegeo = m2[1];
      }
      if (cvegeo && cvegeo.length >= 3) mza = cvegeo.slice(-3);
      if (!mza) return null;
      return { manzana: mza };
    } catch (e) {
      return null;
    }
  };

  // 1️⃣ Intentar en el punto EXACTO del click
  let r = await _tryAt(latlng);
  if (r) return r;

  // 2️⃣ Si falla (click en calle/gap), reintentar con offsets
  //    de ±2, ±4 píxeles para encontrar la manzana más cercana
  const zoom = MAP.getZoom();
  const degreesPerPixel = 360 / (256 * Math.pow(2, zoom));

  const offsets = [
    // ±2px cardinales
    [-2, 0], [2, 0], [0, -2], [0, 2],
    // ±4px cardinales
    [-4, 0], [4, 0], [0, -4], [0, 4],
    // ±3px diagonales
    [-3, -3], [3, -3], [-3, 3], [3, 3],
  ];

  for (const [dx, dy] of offsets) {
    const test = L.latLng(
      latlng.lat + dy * degreesPerPixel,
      latlng.lng + dx * degreesPerPixel
    );
    r = await _tryAt(test);
    if (r) {
      console.log('[INEGI] Manzana encontrada con offset', dx, dy, '→', r.manzana);
      return r;
    }
  }

  console.warn('[INEGI] No se encontró manzana en el punto ni en el entorno');
  return null;
}


  /* ═══════════════════════════════════════════════════════════════
   💾 DEFAULTS INEGI · Persistencia de colonia/sección/área
   ═══════════════════════════════════════════════════════════════
   - Primera vez: modal pregunta y guarda aquí.
   - Siguientes: se crea la manzana directo con estos valores.
   - Al editar una manzana INEGI: se actualizan aquí.
   ═══════════════════════════════════════════════════════════════ */
const CAT_INEGI_DEFAULTS_KEY = 'catInegiDefaults';

function _inegiGetDefaults() {
  try {
    const s = JSON.parse(localStorage.getItem(CAT_INEGI_DEFAULTS_KEY) || 'null');
    if (s && typeof s === 'object') {
      return {
        colonia: String(s.colonia || '').trim(),
        seccion: String(s.seccion || '').trim(),
        area:    String(s.area    || '').trim()
      };
    }
  } catch (e) {}
  return { colonia: '', seccion: '', area: '' };
}

function _inegiSaveDefaults(d) {
  try {
    localStorage.setItem(CAT_INEGI_DEFAULTS_KEY, JSON.stringify({
      colonia: String(d.colonia || '').trim(),
      seccion: String(d.seccion || '').trim(),
      area:    String(d.area    || '').trim()
    }));
  } catch (e) {}
}

function _inegiHasDefaults() {
  const d = _inegiGetDefaults();
  return !!d.colonia;   // colonia es obligatoria → es el "switch"
}

function _inegiClearDefaults() {
  try { localStorage.removeItem(CAT_INEGI_DEFAULTS_KEY); } catch (e) {}
}
  

  /* ═══════════════════════════════════════════════════════════════
   🏘️ MODAL · Captura de manzana INEGI (colonia/sección/área)
   ═══════════════════════════════════════════════════════════════ */
function _inegiOpenManzanaCapture(latlng, info, coloniaDetectada) {
  const mans = Object.values(CAT_MANZANAS);
  const uniq = arr => [...new Set(arr.filter(isReal))]
    .sort((a,b) => a.localeCompare(b, 'es', {numeric:true, sensitivity:'base'}));

  const colOpts  = uniq(mans.map(m => m.colonia));
  const secOpts  = uniq(mans.map(m => m.seccion));
  const areaOpts = uniq(mans.map(m => m.area));

  // 🆕 Prioridad: colonia auto-detectada > defaults guardados > vacío
  const defaults = _inegiGetDefaults();
  const preCol  = coloniaDetectada || defaults.colonia || '';
  const preSec  = defaults.seccion || '';
  const preArea = defaults.area    || '';

  // Guardar info para recuperarla en el botón Guardar
  window._inegiPendingInfo = info;

  openModal(`
    <div class="sheet-head">🏘️ Guardar manzana INEGI<button class="close" data-a="close-modal">✕</button></div>
    <div class="sheet-body">

      <div style="font-size:11.5px;color:var(--muted);text-align:center;margin-bottom:14px;
                  padding:8px 12px;background:var(--cream-2);border-radius:var(--r-sm);border:1px solid var(--border)">
        📍 ${(+latlng.lat).toFixed(6)}, ${(+latlng.lng).toFixed(6)}
      </div>

      <div class="dgrid-2" style="gap:10px;margin-bottom:12px">
        <div class="dfield">
          <div class="lbl">Colonia *</div>
          <input id="inegiManColonia" list="dl-inegi-col" value="${esc(preCol)}"
                 placeholder="Ej. Centro" autocomplete="off">
          <datalist id="dl-inegi-col">${colOpts.map(v => `<option value="${esc(v)}">`).join('')}</datalist>
        </div>
        <div class="dfield">
          <div class="lbl">Sección</div>
          <input id="inegiManSeccion" list="dl-inegi-sec" value="${esc(preSec)}"
                 placeholder="Ej. 3" autocomplete="off">
          <datalist id="dl-inegi-sec">${secOpts.map(v => `<option value="${esc(v)}">`).join('')}</datalist>
        </div>
      </div>

      <div class="dgrid-2" style="gap:10px;margin-bottom:12px">
        <div class="dfield">
          <div class="lbl">Área</div>
          <input id="inegiManArea" list="dl-inegi-area" value="${esc(preArea)}"
                 placeholder="Ej. A" autocomplete="off">
          <datalist id="dl-inegi-area">${areaOpts.map(v => `<option value="${esc(v)}">`).join('')}</datalist>
        </div>
        <div class="dfield">
          <div class="lbl">Manzana *</div>
          <input id="inegiManNum" value="${esc(String(info.manzana))}"
                 inputmode="numeric" readonly
                 style="background:var(--cream-2);font-weight:800">
        </div>
      </div>

      <div style="font-size:11px;color:var(--muted);text-align:center;line-height:1.4;margin-top:8px">
        💡 La colonia y el número de manzana son obligatorios.
      </div>
    </div>
    <div class="sheet-foot">
      <button class="btn g" data-a="close-modal" style="flex:1">Cancelar</button>
      <button class="btn p" data-a="inegi-save-manzana"
        data-lat="${latlng.lat}" data-lng="${latlng.lng}" style="flex:1">💾 Guardar</button>
    </div>
  `, true);

  setTimeout(() => document.getElementById('inegiManColonia')?.focus(), 120);
}

  /* ═══════════════════════════════════════════════════════════════
   🏘️ Post-manzana · importa casas + muestra popup
   (llamada tanto si la manzana ya existía como si se acaba de crear)
   ═══════════════════════════════════════════════════════════════ */
async function _inegiAfterManzana(latlng, info, manzana, esNueva) {
  const imp = await _inegiAutoImport(latlng, info, { manzanaId: manzana.id });

  const manId   = manzana.id;
  const manDb   = CAT_MANZANAS[manId] || manzana || {};
  const casasDb = Object.values(CAT_CASAS).filter(c => c.id_padre === manId);

  casasDb.sort((a, b) => {
    const na = parseInt(String(a.noExterior || '').replace(/\D/g, ''), 10);
    const nb = parseInt(String(b.noExterior || '').replace(/\D/g, ''), 10);
    if (isNaN(na) && isNaN(nb)) return String(a.noExterior || '').localeCompare(String(b.noExterior || ''), 'es');
    if (isNaN(na)) return 1;
    if (isNaN(nb)) return -1;
    return na - nb;
  });

  const casasListHtml = casasDb.length
    ? casasDb.map(c => {
        const tienePac = getCasaPatients(c).length > 0;
        const bg = tienePac ? 'var(--ok)' : 'var(--burgundy)';
        const lbl = tienePac
          ? String((P[getCasaPatients(c)[0]] || {}).nombre || '').slice(0, 14)
          : 'libre';
        return `<button type="button" data-a="cat-go-casa" data-id="${esc(c.id_unico_casa)}"
          style="display:flex;align-items:center;gap:6px;width:100%;
                 padding:5px 9px;margin-bottom:3px;
                 background:${bg};color:#fff;border:0;border-radius:7px;
                 font-weight:800;font-size:11.5px;cursor:pointer;
                 text-align:left;line-height:1.15">
          <span>🏠 No. ${esc(c.noExterior || '—')}</span>
          <span style="font-size:9.5px;opacity:.85;margin-left:auto;
                       overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:100px">
            👤 ${esc(lbl)}
          </span>
        </button>`;
      }).join('')
    : `<div style="font-size:11.5px;color:#888;text-align:center;
                   padding:8px;font-style:italic">
        Aún no hay casas guardadas en esta manzana
      </div>`;

  const statsHtml = imp.ok
    ? `<div style="font-size:10.5px;color:#666;text-align:center;
                   margin:5px 0 8px;padding:5px;background:#f5f5f5;
                   border-radius:6px;line-height:1.4">
        ${esNueva ? '✅ Manzana nueva guardada' : '🔄 Manzana ya existía'}
        ${imp.casasNuevas > 0
          ? ` · <b style="color:#8B2942">+${imp.casasNuevas} casa${imp.casasNuevas>1?'s':''}</b> nuevas`
          : ''}
        <br>Total en esta manzana: <b>${imp.casasTotal || casasDb.length}</b>
      </div>`
    : `<div style="font-size:11px;color:#c0392b;text-align:center;margin:5px 0 8px">
        ⚠️ No se pudo guardar automáticamente
      </div>`;

  const rows = [
    ['Manzana',   manDb.manzana || info.manzana],
    ['Colonia',   manDb.colonia || info.localidad || '—'],
    ['Sección',   manDb.seccion || info.ageb || '—'],
    ['Municipio', info.municipio || info.cve_mun || '—'],
    ['Estado',    info.estado || info.cve_ent || '—'],
    ['CVEGEO',    info.cvegeo],
  ].filter(([, v]) => v);

  L.popup({ maxWidth: 340, minWidth: 260 })
    .setLatLng(latlng)
    .setContent(`
      <div style="font-family:system-ui;font-size:12.5px;line-height:1.4">
        <div style="font-weight:900;color:#0d3333;font-size:15px;margin-bottom:6px">
          🏘️ Manzana <span style="color:#8B2942">${esc(info.manzana)}</span>
        </div>
        <table style="width:100%;border-collapse:collapse;margin-bottom:8px">
          ${rows.map(([k, v]) => `
            <tr>
              <td style="padding:2px 0;color:#666;font-size:10px;
                         text-transform:uppercase;letter-spacing:.3px;
                         font-weight:700;width:78px">${esc(k)}</td>
              <td style="padding:2px 0;font-weight:700;color:#222;
                         font-size:11.5px;word-break:break-word">${esc(v)}</td>
            </tr>
          `).join('')}
        </table>
        ${statsHtml}
        <div style="font-size:10px;font-weight:800;color:#666;
                    text-transform:uppercase;letter-spacing:.3px;
                    margin-bottom:4px">
          🏠 Casas (${casasDb.length}) · toca para ubicar
        </div>
        <div style="max-height:170px;overflow-y:auto;
                    -webkit-overflow-scrolling:touch;
                    margin-bottom:8px;padding-right:2px">
          ${casasListHtml}
        </div>
        <div style="display:flex;gap:6px">
          <button type="button" data-a="copy-mza" data-mza="${esc(info.manzana)}"
            style="flex:1;padding:7px;background:#8B2942;color:#fff;
                   border:0;border-radius:8px;font-weight:800;font-size:11.5px;cursor:pointer">
            📋 Copiar
          </button>
          <button type="button" data-a="inegi-pin-manzana" data-id="${esc(manId)}"
            style="flex:1;padding:7px;background:#0d3333;color:#fff;
                   border:0;border-radius:8px;font-weight:800;font-size:11.5px;cursor:pointer">
            📌 Ver manzana
          </button>
        </div>
      </div>
    `)
    .openOn(MAP);
}
  
/* ═══════════════════════════════════════════════════════════════
   💾 INEGI · Auto-importar manzana + casas al catastro local
   ═══════════════════════════════════════════════════════════════
   Usa las MISMAS funciones que ya existen (catGenIdManzana,
   catGenIdCasa, catSaveManzanas, catSaveCasas, catSync).
   Sincroniza con Firebase automáticamente. Offline-safe.
   ═══════════════════════════════════════════════════════════════ */
async function _inegiAutoImport(latlng, info, opts = {}) {
  if (!info || !info.manzana || !isFinite(latlng.lat)) {
    return { ok: false };
  }

  // ── 1. Determinar la manzana ──
  let manGuardada = null;
  let manNueva = false;
  let manId = opts.manzanaId || null;

  if (manId && CAT_MANZANAS[manId]) {
    // Ya viene creada desde el modal → solo usarla
    manGuardada = CAT_MANZANAS[manId];
  } else {
    // Buscar por cvegeo
    manGuardada = Object.values(CAT_MANZANAS).find(
      m => m && m.cvegeo && String(m.cvegeo) === String(info.cvegeo)
    );
    if (manGuardada) manId = manGuardada.id;
  }

  if (!manGuardada) {
    // ⚠️ No hay manzana → NO crear automáticamente. Devolver señal para
    //    que el caller abra el modal de captura (colonia/sección/área).
    return { ok: false, needsManzana: true, info };
  }

  // ── 2. Guardar las casas (una por cada No.Ext) ──
  const casasNuevas = [];
  const noExts = info.noExteriores || [];

  for (let idx = 0; idx < noExts.length; idx++) {
    const noExt = String(noExts[idx]).trim();
    if (!noExt) continue;

    const casId = catGenIdCasa(manId, noExt);
    if (CAT_CASAS[casId]) continue;   // ya existe → no duplicar

    // Distribución en espiral alrededor del centro de la manzana
    const total = Math.max(1, noExts.length);
    const angle = (idx / total) * Math.PI * 2;
    const radiusDeg = (0.00008 + (idx % 3) * 0.00004);
    const lat = +latlng.lat + Math.cos(angle) * radiusDeg;
    const lng = +latlng.lng + Math.sin(angle) * radiusDeg;

    CAT_CASAS[casId] = {
      id_unico_casa: casId,
      id_padre: manId,
      tipo: 'casa',
      noExterior: noExt,
      lat: +lat.toFixed(6),
      lng: +lng.toFixed(6),
      paciente_id: '',
      pacientes: {},
      origen: 'INEGI',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    casasNuevas.push(CAT_CASAS[casId]);
  }

  if (casasNuevas.length) {
    catSaveCasas();
    for (const c of casasNuevas) {
      try { await catSync('cat_save_casa', c); } catch (e) { /* se encola */ }
    }
  }

  // ── 3. Refrescar catastro en el mapa ──
  try { _catRenderManzanas(); } catch (e) {}
  try { _catRenderCasas(); } catch (e) {}
  try { _catPopulatePanelSelects(); } catch (e) {}

  return {
    ok: true,
    manzanaNueva: manNueva,
    manzana: manGuardada,
    manzanaId: manId,
    casasNuevas: casasNuevas.length,
    casasTotal: Object.values(CAT_CASAS).filter(c => c.id_padre === manId).length,
  };
}

function _initInegiLayers() {
  if (!MAP) return;
  if (INEGI_WMS_LAYERS.length > 0) return;

  // Nombres de capa extraídos del GetCapabilities del INEGI (wms61).
  //
  // NOTA: el WMS del INEGI NO expone una capa de "número de manzana" en
  // texto. c104 solo dibuja los POLÍGONOS (contornos) de las manzanas.
  // Las capas disponibles útiles son:
  //   • c104  → contornos de manzana (a zoom 18+ aparece el número dentro)
  //   • t700  → números de casa (texto)
  //   • c109  → AGEB urbana (sección aproximada)
  //   • c108  → AGEB rural  (sección aproximada)
  const capas = [
    { name: 'c104', label: 'Manzanas' },           // contornos de manzana
    { name: 't700', label: 'Números Exteriores' }, // números de casa
    { name: 'c109', label: 'AGEB Urbana' },        // sección urbana
    { name: 'c108', label: 'AGEB Rural' }          // sección rural
  ];

  capas.forEach(cfg => {
const wmsLayer = L.tileLayer.wms(INEGI_WMS_URL, {
  layers: cfg.name,
  format: 'image/png',
  transparent: true,
  version: '1.3.0',
  attribution: '© INEGI',
  opacity: 1.0,
  maxZoom: 21,
  maxNativeZoom: 20
});
    INEGI_WMS_LAYERS.push(wmsLayer);
  });
  
}
function _toggleInegiMap() {

  // 🆕 Bloquear en modo ahorro
  if (SAVING_MODE) {
    toast('🔋 Modo ahorro activo. Desactívalo para usar INEGI.', 1);
    if (navigator.vibrate) navigator.vibrate([30, 50, 30]);
    return;
  }

  if (!navigator.onLine) {
    toast('📴 Conéctate a internet para usar el mapa INEGI', 1);
    if (navigator.vibrate) navigator.vibrate([30, 50, 30]);
    return;
  }
  
  if (!MAP) {
    initMap();
    if (!MAP) return;
  }

  if (INEGI_WMS_LAYERS.length === 0) {
    _initInegiLayers();
  }

  INEGI_ACTIVE = !INEGI_ACTIVE;
  const btn = $('#btnInegi');
  if (btn) btn.classList.toggle('on', INEGI_ACTIVE);

  if (INEGI_ACTIVE) {
    // Ocultar mapas base (calles, satélite) para que resalte el INEGI
    if (LAYERS.streets && MAP.hasLayer(LAYERS.streets)) MAP.removeLayer(LAYERS.streets);
    if (LAYERS.minimal && MAP.hasLayer(LAYERS.minimal)) MAP.removeLayer(LAYERS.minimal);
    if (LAYERS.sat && MAP.hasLayer(LAYERS.sat)) MAP.removeLayer(LAYERS.sat);

    // Encender capas INEGI
    INEGI_WMS_LAYERS.forEach(layer => layer.addTo(MAP));
    toast('🗺️ Capas INEGI activadas (Manzanas/Secciones)');
  } else {
    // Apagar capas INEGI
    INEGI_WMS_LAYERS.forEach(layer => {
      if (MAP.hasLayer(layer)) MAP.removeLayer(layer);
    });
    // Restaurar capa base por defecto (calles)
    if (LAYERS.streets) LAYERS.streets.addTo(MAP);
    toast('🗺️ Mapa base restaurado');
  }
}
  

const _patientIconCache = {};
function makePatientIcon(est) {
  const key = String(est ?? '0');
  if (_patientIconCache[key]) return _patientIconCache[key];
  const color = EC[est] || '#9e9e9e';
  const icon = L.divIcon({
    className: 'patient-pin',
    html: `<div style="width:18px;height:18px;border-radius:50%;background:${color};border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4)"></div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
    popupAnchor: [0, -11]
  });
  _patientIconCache[key] = icon;
  return icon;
}

  
function drawMap() {
  initMap();
  setTimeout(() => MAP.invalidateSize(), 80);
  CL.clearLayers();
  const bs = [];

  /* 🆕 Límite defensivo: evita crear 20k markers en un solo tick.
     Si el usuario necesita ver más, debe usar filtros para acotar LIST.
     FIX BATERÍA: bajado de 1500 → 800 (los filtros permiten acotar). */
  const MAX_MAP_MARKERS = 800;
  const listForMap = LIST.length > MAX_MAP_MARKERS ? LIST.slice(0, MAX_MAP_MARKERS) : LIST;
  if (LIST.length > MAX_MAP_MARKERS) {
    setTimeout(() => toast(`🗺️ Mostrando ${MAX_MAP_MARKERS} de ${LIST.length} · usa filtros para acotar`, 0), 200);
  }

  listForMap.forEach(id => {
    const p = P[id];
    // 🆕 FIX: chequeo robusto (evita saltar lat=0 por truthy)
    if (p.lat == null || p.lat === '' || !isFinite(+p.lat)) return;
    if (p.lon == null || p.lon === '' || !isFinite(+p.lon)) return;
    const ll = [+p.lat, +p.lon];
    bs.push(ll);
    
    // 🆕 L.marker + divIcon → SÍ clusteriza, reduce 20k → ~50 visibles
    L.marker(ll, { icon: makePatientIcon(p.est), keyboard: false })
      .bindPopup(`
      <b>${esc(p.nombre)}</b><br>
      ${esc(p.calle)} #${esc(p.numExt)}${isReal(p.numInt) ? ' Int '+esc(p.numInt) : ''}<br>
      ${esc(EST[p.est]||'')} ${esc(p.vf||'')}<br>
      <a href="#" data-a="open" data-id="${esc(id)}">Abrir ficha</a> ·
      <a target="_blank" rel="noopener noreferrer" href="https://www.google.com/maps/dir/?api=1&destination=${ll[0]},${ll[1]}">Cómo llegar</a>
    `).addTo(CL);
  });
  if (bs.length) MAP.fitBounds(bs, {padding:[36,36]});

  // 🆕 Dibuja pines dorados si el toggle está activo
  try { _drawRemoteMarkers(); } catch(e) { console.warn('[remote draw]', e); }
}

  
function setView(v, push) {
  const prevView = VIEW;
  // 🆕 Guardar scroll de Home al salir hacia otra vista
  if (prevView === 'list' && v !== 'list') {
    _homeScrollY = window.scrollY || window.pageYOffset || 0;
  }

  
  VIEW = v;
  document.body.classList.toggle('in-prog', v === 'prog');
  document.body.classList.toggle('in-map',  v === 'map');

  // 🆕 FIX BATERÍA: apagar GPS al salir de la vista mapa
  //    Antes el watchPosition seguía activo aunque el usuario se fuera
  //    a Home / Tabla / Programados → consumo constante de GPS.
  if (v !== 'map' && userLocWatch != null) {
    try { navigator.geolocation.clearWatch(userLocWatch); } catch(e){}
    userLocWatch = null;
    if (MAP && userLocLayer) {
      try { MAP.removeLayer(userLocLayer); } catch(e){}
      userLocLayer = null;
    }
    _catUserLatLng = null;
    _catLastWatchLatLng = null;
    _catLastWatchTime = 0;
    if (_catRadiusCircle && MAP) {
      try { MAP.removeLayer(_catRadiusCircle); } catch(e){}
      _catRadiusCircle = null;
    }
    const _bar = $('#radioBar'); if (_bar) _bar.hidden = true;
    const _btn = $('#btnMyLoc'); if (_btn) _btn.classList.remove('on');
  }

  $('#vList').hidden = v !== 'list';
  
  
  $('#mapWrap').hidden = v !== 'map';
  $('#tblWrap').hidden = v !== 'table';
  $('#progWrap').hidden = v !== 'prog';
  $$('#mainTabs button').forEach(b => b.classList.toggle('on', b.dataset.v === v));

  $$('#bnavMain button').forEach(b => {
    const bv = b.dataset.v;
    const active = (bv === 'home' && v === 'list') ||
                   (bv === 'table' && v === 'table') ||
                   (bv === 'prog' && v === 'prog') ||
                   (bv === 'map' && v === 'map');
    b.classList.toggle('on', active);
  });

  if (v === 'map') {
    drawMap();
    // Header oculto → CSS cambia top:104px → 0 → hay que avisar a Leaflet
    setTimeout(() => {
      if (MAP) MAP.invalidateSize();
      // 🆕 Re-render catastro markers (evita que casas nuevas del delta no aparezcan)
      try { _catRenderManzanas(); _catRenderCasas(); } catch(e) {}
      // 🆕 Si el toggle ⭐ está activo, fetch en background y redibuja
      if (SHOW_REMOTE) {
        _fetchRemoteLocations({ silent: true }).then(_drawRemoteMarkers).catch(() => {});
      }
    }, 150);
  }
  if (v === 'table') { TABLE_LIMIT = 500; renderTbl(); }   // 🆕 reset a 500 cada entrada
  if (v === 'prog') { renderProgCal(); drawProgCards(); }
  if (v === 'list') {
    // 🆕 Conservar LIM si venimos de otra vista (no perder "Mostrar más")
    //    Solo resetear a 60 cuando realmente entramos por primera vez
    calc(prevView !== 'list' ? 1 : 0);
    // 🆕 Restaurar scroll al volver a Home desde otra vista
    if (prevView !== 'list' && _homeScrollY > 0) {
      requestAnimationFrame(() => {
        window.scrollTo(0, _homeScrollY);
      });
    }
  }
  

  if (push !== false && v !== prevView) {
    history.pushState({view: v}, '');
  }
}


/* ---------- Toggle "Mi ubicación" en el mapa general ---------- */
function toggleMyLocation() {
  const btn = $('#btnMyLoc');
  const bar = $('#radioBar');

  // === CASO 1: ya está activo → apagar ===
  if (userLocLayer) {
    if (userLocWatch != null) {
      navigator.geolocation.clearWatch(userLocWatch);
      userLocWatch = null;
    }
    if (MAP && userLocLayer && userLocLayer._map) {
      try { MAP.removeLayer(userLocLayer); } catch(e){}
    }
    userLocLayer = null;

    // 🆕 Desactivar radio GPS y filtrar nuevamente todas las casas
    _catUserLatLng = null;
    _catLastWatchLatLng = null;   // 🆕 reset debounce
    _catLastWatchTime = 0;
    if (_catRadiusCircle && MAP) {
      try { MAP.removeLayer(_catRadiusCircle); } catch(e){}
      _catRadiusCircle = null;
    }
    if (bar) bar.hidden = true;
    _catRenderCasas();

    if (btn) btn.classList.remove('on');
    toast('Ubicación oculta');
    return;
  }

  // === CASO 2: no hay geolocalización ===
  if (!navigator.geolocation) {
    toast('Sin geolocalización disponible', 1);
    return;
  }

  // === CASO 3: activar ===
  if (!MAP) {
    initMap();
    if (!MAP) { toast('Mapa no disponible', 1); return; }
  }

  toast('Obteniendo tu ubicación…');
  if (btn) btn.classList.add('on');

  const buildUserLayer = (lat, lng, acc) => {
    if (userLocLayer && userLocLayer._map) {
      try { MAP.removeLayer(userLocLayer); } catch(e){}
    }

    const circle = L.circle([lat, lng], {
      radius: Math.max(15, acc || 20),
      color: '#1e88e5', fillColor: '#1e88e5', fillOpacity: 0.15, weight: 1
    });
    const dot = L.circleMarker([lat, lng], {
      radius: 8, color: '#fff', weight: 3, fillColor: '#1e88e5', fillOpacity: 1
    }).bindPopup('📍 Tu ubicación actual');

    userLocLayer = L.layerGroup([circle, dot]).addTo(MAP);
    userLocLayer._dot = dot;
    userLocLayer._circle = circle;
  };

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      if (!MAP) return;
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      const acc = pos.coords.accuracy;

      buildUserLayer(lat, lng, acc);
      MAP.setView([lat, lng], 17, { animate: true });

      // 🆕 Guardar posición + mostrar barra de radio + dibujar círculo + filtrar casas
      _catUserLatLng = { lat, lng };
      if (bar) bar.hidden = false;
      _catDrawRadiusCircle();
      // Marcar el botón de radio actual como activo
      $$('#radioBar .radio-btn').forEach(b =>
        b.classList.toggle('on', +b.dataset.r === CAT_RADIUS)
      );
      _catRenderCasas();

      toast('📍 Ubicación activa · Radio ' + CAT_RADIUS + ' m');

      // Seguir movimientos del usuario
      userLocWatch = navigator.geolocation.watchPosition(
        (p) => {
          if (!userLocLayer || !MAP) return;
          const nLat = p.coords.latitude;
          const nLng = p.coords.longitude;
          const nAcc = p.coords.accuracy;
          if (userLocLayer._dot)    userLocLayer._dot.setLatLng([nLat, nLng]);
          if (userLocLayer._circle) {
            userLocLayer._circle.setLatLng([nLat, nLng]);
            userLocLayer._circle.setRadius(Math.max(15, nAcc || 20));
          }
          _catUserLatLng = { lat: nLat, lng: nLng };
          _catDrawRadiusCircle();

          // 🆕 Debounce: solo reconstruye casas si te moviste >10 m o pasaron >5 s
          const _now = Date.now();
          const _moved = !_catLastWatchLatLng ||
            catHaversine(_catLastWatchLatLng.lat, _catLastWatchLatLng.lng, nLat, nLng) > 10;
          if (_moved || _now - _catLastWatchTime > 5000) {
            _catLastWatchLatLng = { lat: nLat, lng: nLng };
            _catLastWatchTime = _now;
            _catRenderCasas();
          }
        },
        (err) => console.warn('watchPosition:', err),
        { enableHighAccuracy: true, timeout: 20000, maximumAge: 5000 }
      );
    },
    (err) => {
      if (btn) btn.classList.remove('on');
      if (bar) bar.hidden = true;
      toast('GPS: ' + err.message, 1);
    },
    { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
  );
}
  
  
function pickStart() {
  if (!navigator.geolocation) { toast('Sin geolocalización', 1); return; }
  toast('Obteniendo tu ubicación…');
  navigator.geolocation.getCurrentPosition(pos => _openPickMap(pos.coords.latitude, pos.coords.longitude, true),
    err => {
      toast('GPS: ' + err.message + ' · usando ubicación por defecto', 1);
      _openPickMap(16.748, -93.180, false);
    },
    {enableHighAccuracy:true, timeout:12000, maximumAge:60000});
}

let _pickMapInstance = null;
let _pickMapOnFinish = null;   // ← callback opcional cuando se cierra el mapa
let _pendingConfirmResolve = null;   // ← promise del confirm modal pendiente
let _pendingPINResolve     = null;   // 🆕 promise del modal PIN pendiente
let _pendingPWResolve      = null;   // 🆕 promise del modal Password pendiente
  
  
function _openPickMap(userLat, userLng, hasGPS, onFinish) {
  if (_pickMapInstance) { try { _pickMapInstance.remove(); } catch(e){} _pickMapInstance = null; }
  PICK = { lat: null, lng: null, marker: null };
  _pickMapOnFinish = onFinish || null;   // ← guarda el callback
  const p = P[cur] || {};
  openModal(`
    <div class="sheet-head">📍 Ubicación del domicilio<button class="close" data-a="pick-close">✕</button></div>
    <div class="sheet-body" style="padding:0">
      <div id="pickMap" style="height:60vh;width:100%"></div>
      <div style="padding:10px 14px;font-size:12.5px;color:var(--muted);background:#fff;border-top:1px solid var(--border)">
        ${hasGPS ? '🔵 Círculo azul = tu ubicación actual. ' : ''}
        Toca el mapa para colocar el marcador del domicilio.
        <br><b id="pickCoord" style="color:var(--text);font-family:ui-monospace,monospace">${p.lat ? (+p.lat).toFixed(6)+', '+(+p.lon).toFixed(6) : '—'}</b>
      </div>
    </div>
    <div class="sheet-foot">
      <button class="btn g" data-a="pick-close" style="flex:1">Cancelar</button>
      <button class="btn p" data-a="pick-save-m" style="flex:1">💾 Guardar</button>
    </div>
  `, true);

  const __mv = _modalVersion;
  setTimeout(() => {
    if (__mv !== _modalVersion) return;      // 🆕 modal fue reemplazado/cerrado
    if (!document.getElementById('pickMap')) return;
    if (_pickMapInstance) return;             // 🆕 ya inicializado (doble click)
    const initial = (p.lat && p.lon) ? [+p.lat, +p.lon] : [userLat, userLng];
    const pm = L.map('pickMap', { zoomControl:true }).setView(initial, 19);
    _pickMapInstance = pm;
    
    L.tileLayer.offline('https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png?key=cb1_4no0_1_f130c033decf00e3dfc9fbdf', {
  maxZoom: 20,
  maxNativeZoom: 18,
  attribution: '© <a href="https://carto.com/attributions">CARTO</a> © OpenStreetMap'
}).addTo(pm);
    
    if (hasGPS) {
      L.circleMarker([userLat, userLng], {radius:9, color:'#fff', weight:3,
        fillColor:'#1e88e5', fillOpacity:1}).addTo(pm).bindPopup('Tu ubicación actual');
    }

    let mk = null;

    
   const syncPick = () => {
  if (!mk) return;
  const ll = mk.getLatLng();
  PICK.lat = ll.lat; PICK.lng = ll.lng; PICK.marker = mk;
  const c = document.getElementById('pickCoord');
  if (c) c.textContent = PICK.lat.toFixed(6)+', '+PICK.lng.toFixed(6);
};

if (p.lat && p.lon) {
  mk = L.marker([+p.lat, +p.lon], {
    draggable: true,
    icon: makePinIcon(),
    autoPan: true
  }).addTo(pm);
  mk.on('dragend', syncPick);   // ✅
  syncPick();
}

pm.on('click', e => {
  const {lat, lng} = e.latlng;
  if (mk) pm.removeLayer(mk);
  mk = L.marker([lat, lng], {
    draggable: true,
    icon: makePinIcon(),
    autoPan: true
  }).addTo(pm);
  mk.on('dragend', syncPick);   // ✅
  syncPick();
});

    // invalidar tamaño después de renderizar
    setTimeout(() => pm.invalidateSize(), 100);
  }, 60);
}



/* ============================================================================
   ESCÁNER DE CÓDIGO DE BARRAS (folio del paciente)
   ============================================================================ */
let _scanLocked = false;
let _scanStream = null;
let _scanAbort = false;
let _html5Scanner = null;
let _scanStatusEl = null;

async function startBarcodeScan() {
  if (_scanLocked) {
    // 🆕 FIX: si quedó locked de un intento anterior colgado (cámara prendida),
    //    forzar limpieza al presionar de nuevo "Escanear"
    _stopInvisibleScan();
    _stopVisibleScan();
    toast('Escáner reiniciado', 0);
    return;
  }
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    toast('Cámara no disponible en este dispositivo', 1); return;
  }
  _scanLocked = true;

  if ('BarcodeDetector' in window) {
    await _scanInvisible();
  } else {
    await _scanVisibleFallback();
  }
}

/* --- Modo INVISIBLE: solo notificación, sin modal (Chrome Android) --- */
async function _scanInvisible() {
  _scanAbort = false;
  _showScanStatus();

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: 'environment' },
        width: { ideal: 1280 },
        height: { ideal: 720 }
      },
      audio: false
    });

    // ─── FIX race condition: si cancelaron mientras cargaba ───
    if (_scanAbort) {
      try { stream.getTracks().forEach(t => t.stop()); } catch(e){}
      return;
    }
    _scanStream = stream;

    // ─── FIX: usar el video del preview que YA está en el DOM ───
    const video = document.getElementById('scanPreviewVideo');
    if (!video) {
      try { stream.getTracks().forEach(t => t.stop()); } catch(e){}
      _scanStream = null;
      throw new Error('Preview no disponible');
    }

    video.srcObject = stream;

    // Esperar a que el video tenga datos antes de jugar
    await new Promise((resolve, reject) => {
      if (video.readyState >= 2) return resolve();
      const timer = setTimeout(() => reject(new Error('Video no cargó a tiempo')), 6000);
      video.onloadeddata = () => { clearTimeout(timer); resolve(); };
    });

    await video.play();

if (_scanAbort) { _stopInvisibleScan(); return; }

    let formats = ['code_128','code_39','code_93','ean_13','ean_8','upc_a','upc_e','itf','codabar','qr_code'];
    try {
      const supported = await BarcodeDetector.getSupportedFormats();
      formats = formats.filter(f => supported.includes(f));
    } catch(e){}
    if (!formats.length) formats = ['code_128','code_39','ean_13','qr_code'];

    const detector = new BarcodeDetector({ formats });

    const loop = async () => {
      if (_scanAbort) return;
      try {
        const results = await detector.detect(video);
        if (results && results.length) {
          const code = results[0].rawValue;
          if (code && String(code).trim()) {
            if (navigator.vibrate) navigator.vibrate([40, 30, 40]);
            _stopInvisibleScan();
            _handleScannedCode(code);
            return;
          }
        }
      } catch(e){}
      if (!_scanAbort) setTimeout(loop, 200);
    };
    loop();

  } catch(err) {
    _stopInvisibleScan();
    toast('Cámara: ' + (err.message || err), 1);
  }
}

function _stopInvisibleScan() {
  _scanAbort = true;
  if (_scanStream) {
    try { _scanStream.getTracks().forEach(t => t.stop()); } catch(e){}
    _scanStream = null;
  }
  // 🆕 FIX: parar tracks del video AUNQUE _scanStream sea null (race condition)
  //    Si el usuario canceló mientras cargaba el video, _scanStream ya es null
  //    pero las tracks siguen vivas en video.srcObject → apagarlas igual.
  const pv = document.getElementById('scanPreviewVideo');
  if (pv) {
    try {
      const s = pv.srcObject;
      if (s && typeof s.getTracks === 'function') {
        s.getTracks().forEach(t => { try { t.stop(); } catch(e){} });
      }
    } catch(e){}
    try { pv.srcObject = null; } catch(e){}
  }
  _hideScanStatus();
  _scanLocked = false;
}
function _showScanStatus() {
  _hideScanStatus();
  const overlay = document.createElement('div');
  overlay.id = 'scanStatus';
  overlay.style.cssText = `
    position:fixed;inset:0;z-index:200;
    background:radial-gradient(circle at center,
      rgba(139,41,66,.97) 0%,
      rgba(110,30,51,.98) 55%,
      rgba(50,8,18,.99) 100%);
    display:flex;flex-direction:column;align-items:center;justify-content:center;
    gap:16px;padding:20px;text-align:center;color:#fff;
    animation:_scanFadeIn .3s ease;overflow-y:auto;
  `;

  overlay.innerHTML = `
    <div style="font-size:clamp(22px,6vw,32px);font-weight:900;color:#fff;
      letter-spacing:.3px;line-height:1.15;text-shadow:0 3px 12px rgba(0,0,0,.6);
      max-width:92vw">
      📷 Leyendo código de barras
    </div>

    <div style="font-size:clamp(13px,3.6vw,15.5px);font-weight:600;
      color:#ffdde3;max-width:340px;line-height:1.55;
      text-shadow:0 1px 4px rgba(0,0,0,.4)">
      Apunta la cámara al código de barras del paciente.<br>
      El código se detecta automáticamente.
    </div>

    <div style="position:relative;
      width:min(300px,80vw);height:min(220px,55vw);
      background:#000;border-radius:18px;overflow:hidden;
      border:3px solid #fff;box-shadow:0 12px 40px rgba(0,0,0,.6);margin-top:8px">
      <video id="scanPreviewVideo" playsinline muted
        style="width:100%;height:100%;object-fit:cover;display:block"></video>
      <div style="position:absolute;left:10%;right:10%;height:3px;
        background:linear-gradient(90deg,transparent,#ff2e55,transparent);
        box-shadow:0 0 16px 2px #ff2e55;top:50%;
        animation:_scanLaser 2.2s ease-in-out infinite"></div>
      <div style="position:absolute;inset:16px;pointer-events:none">
        <div style="position:absolute;top:0;left:0;width:28px;height:28px;
          border-top:4px solid #ff2e55;border-left:4px solid #ff2e55;border-radius:6px 0 0 0"></div>
        <div style="position:absolute;top:0;right:0;width:28px;height:28px;
          border-top:4px solid #ff2e55;border-right:4px solid #ff2e55;border-radius:0 6px 0 0"></div>
        <div style="position:absolute;bottom:0;left:0;width:28px;height:28px;
          border-bottom:4px solid #ff2e55;border-left:4px solid #ff2e55;border-radius:0 0 0 6px"></div>
        <div style="position:absolute;bottom:0;right:0;width:28px;height:28px;
          border-bottom:4px solid #ff2e55;border-right:4px solid #ff2e55;border-radius:0 0 6px 0"></div>
      </div>
    </div>

    <div style="display:flex;align-items:center;gap:10px;
      background:rgba(0,0,0,.45);padding:10px 18px;border-radius:999px;
      font-size:13px;font-weight:700;margin-top:4px">
      <span style="display:inline-block;width:16px;height:16px;
        border:2.5px solid #fff;border-top-color:transparent;border-radius:50%;
        animation:_spin 1s linear infinite"></span>
      <span>Buscando código…</span>
    </div>

    <div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:center;margin-top:6px">
      <button id="scanImportBtn" style="
        background:rgba(255,255,255,.18);color:#fff;
        border:1.5px solid rgba(255,255,255,.55);border-radius:999px;
        padding:12px 22px;font-size:13.5px;font-weight:800;cursor:pointer;
        display:inline-flex;align-items:center;gap:8px">
        🖼️ Importar imagen
      </button>
      <button id="scanCancelBtn" style="
        background:#fff;color:#8B2942;border:0;border-radius:999px;
        padding:12px 22px;font-size:13.5px;font-weight:800;cursor:pointer;
        box-shadow:0 6px 20px rgba(0,0,0,.4);
        display:inline-flex;align-items:center;gap:8px">
        ✕ Cancelar
      </button>
    </div>

    <input type="file" id="scanFileInput" accept="image/*" style="display:none">
  `;

  document.body.appendChild(overlay);
  _scanStatusEl = overlay;

  if (!document.getElementById('scanSpinCss')) {
    const st = document.createElement('style');
    st.id = 'scanSpinCss';
    st.textContent = `
      @keyframes _spin{to{transform:rotate(360deg)}}
      @keyframes _scanFadeIn{from{opacity:0}to{opacity:1}}
      @keyframes _scanLaser{0%,100%{top:12%}50%{top:88%}}
    `;
    document.head.appendChild(st);
  }

  overlay.querySelector('#scanCancelBtn').addEventListener('click', () => {
    _stopInvisibleScan();
    toast('Escaneo cancelado');
  });

  // 🆕 Importar imagen desde galería / cámara
  const _importBtn = overlay.querySelector('#scanImportBtn');
  const _fileInput = overlay.querySelector('#scanFileInput');
  if (_importBtn && _fileInput) {
    _importBtn.addEventListener('click', () => _fileInput.click());
    _fileInput.addEventListener('change', (e) => {
  const file = e.target.files && e.target.files[0];
  if (file) _handleImageScan(file);
  e.target.value = '';   // ← reset para permitir misma imagen
});
  }

  return overlay;
}
function _hideScanStatus() {
  if (_scanStatusEl) { _scanStatusEl.remove(); _scanStatusEl = null; }
}

/* --- Modo VISIBLE (fallback): modal con cámara (iOS, Firefox, etc.) --- */
async function _scanVisibleFallback() {
  if (!window.Html5Qrcode) {
    try {
      await new Promise((res, rej) => {
        const s = document.createElement('script');
        s.src = 'https://cdn.jsdelivr.net/npm/html5-qrcode@2.3.8/html5-qrcode.min.js';
        s.onload = res;
        s.onerror = () => rej(new Error('No se pudo cargar librería'));
        document.head.appendChild(s);
      });
    } catch (e) {
      toast('Escáner no disponible en este navegador. Usa Chrome en Android.', 1);
      _scanLocked = false;
      return;
    }
  }

  openModal(`
    <div class="sheet-head">📷 Escanear folio<button class="close" data-a="close-modal">✕</button></div>
    <div class="sheet-body" style="padding:0">
      <div id="scanVideo" style="width:100%;min-height:280px;background:#000"></div>
      <div style="padding:12px 16px;text-align:center;font-size:12.5px;color:var(--muted)">
        Apunta la cámara al código de barras. Se detectará automáticamente.
      </div>
    </div>
    <div class="sheet-foot">
      <button class="btn g" data-a="close-modal" style="flex:1">Cancelar</button>
    </div>
  `, true);

     // 🆕 capturar versión del modal para detectar cierre durante start() async
  const __mvScan = _modalVersion;

  setTimeout(async () => {
    // 🆕 si el modal ya cambió/cerró antes de arrancar → no iniciar
    if (__mvScan !== _modalVersion) { _scanLocked = false; return; }
    const container = document.getElementById('scanVideo');
    if (!container || !window.Html5Qrcode) { _scanLocked = false; return; }
    try {
      const scanner = new Html5Qrcode('scanVideo');
      _html5Scanner = scanner;
      try {
        await scanner.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 300, height: 120 } },
          (code) => {
            if (navigator.vibrate) navigator.vibrate([40, 30, 40]);
            _stopVisibleScan();
            closeModal();
            _handleScannedCode(code);
          },
          () => {}
        );
      } catch (err) {
        if (__mvScan !== _modalVersion) return;
        toast('Cámara: ' + (err.message || err), 1);
        _stopVisibleScan();
        closeModal();
        return;
      }
      // 🆕 FIX CLAVE: si el modal se cerró MIENTRAS start() resolvía,
      //    el scanner ya arrancó con la cámara prendida → apagarla ahora
      if (__mvScan !== _modalVersion || _html5Scanner !== scanner) {
        try { await scanner.stop(); } catch(e){}
        try { scanner.clear(); } catch(e){}
        if (_html5Scanner === scanner) _html5Scanner = null;
      }
    } catch(e) {
      if (__mvScan !== _modalVersion) return;
      toast('Cámara no disponible', 1);
      _stopVisibleScan();
      closeModal();
    }
  }, 250);
}

function _stopVisibleScan() {
  if (_html5Scanner) {
    const sc = _html5Scanner; _html5Scanner = null;
    try { sc.stop().then(() => { try { sc.clear(); } catch(e){} }).catch(()=>{}); } catch(e){}
  }
  _scanLocked = false;
}

/* --- Handler central: qué hacer cuando se lee un código --- */
function _handleScannedCode(code) {
  if (!code) { toast('Código vacío', 1); _scanLocked = false; return; }
  const res = _findPatientByFolio(code);

  // ❌ Sin resultados
  if (res.status === 'not_found') {
    toast('No se encontró paciente con folio ' + code, 1);
    _scanLocked = false;
    return;
  }

  // ⚠️ Varias coincidencias → selector (el usuario elige)
  if (res.status === 'multiple') {
    _scanLocked = false;
    _showScanPicker(code, res.matches);
    return;
  }

  // ✅ Una sola coincidencia → abrir directo (comportamiento actual)
  const pid = res.matches[0];
  const p   = P[pid];
  toast('✓ ' + (p.nombre || 'Paciente') + ' · Folio ' + (p.folio || code));
  setTimeout(() => {
    if (!p.lat && !p.lon && navigator.geolocation) askVisitGPS(pid);
    else openP(pid, 0);
    _scanLocked = false;
  }, 350);
}



  async function _handleImageScan(file) {
  if (!file) return;
  if (!/^image\//.test(file.type)) {
    toast('Selecciona una imagen válida', 1);
    return;
  }

  // Detener cámara y bloquear nuevo escaneo mientras procesamos
  _stopInvisibleScan();
  _scanLocked = true;

  toast('🔍 Analizando imagen…');

  let code = null;

  // ── 1) BarcodeDetector nativo (Chrome / Edge Android) ──
  if ('BarcodeDetector' in window) {
  let bitmap = null;
  try {
    bitmap = await createImageBitmap(file);
    let formats = ['code_128','code_39','code_93','ean_13','ean_8','upc_a','upc_e','itf','codabar','qr_code'];
    try {
      const supported = await BarcodeDetector.getSupportedFormats();
      formats = formats.filter(f => supported.includes(f));
    } catch (e) {}
    if (!formats.length) formats = ['code_128','code_39','ean_13','qr_code'];
    const det = new BarcodeDetector({ formats });
    const results = await det.detect(bitmap);
    if (results && results.length) {
      const v = results[0].rawValue;
      if (v && String(v).trim()) code = String(v).trim();
    }
  } catch (e) {
    console.warn('[image-scan] BarcodeDetector falló:', e);
  } finally {
    try { bitmap && bitmap.close && bitmap.close(); } catch (e) {}
  }
}

  // ── 2) Fallback: Html5Qrcode.scanFile (iOS, Firefox, etc.) ──
  if (!code) {
    if (!window.Html5Qrcode) {
      try {
        await new Promise((res, rej) => {
          const s = document.createElement('script');
          s.src = 'https://cdn.jsdelivr.net/npm/html5-qrcode@2.3.8/html5-qrcode.min.js';
          s.onload = res;
          s.onerror = () => rej(new Error('No se pudo cargar librería'));
          document.head.appendChild(s);
        });
      } catch (e) {
        _scanLocked = false;
        toast('Escáner no disponible. Usa Chrome en Android.', 1);
        return;
      }
    }

    const hiddenId = '__imgscan_' + Date.now();
    const hiddenDiv = document.createElement('div');
    hiddenDiv.id = hiddenId;
    hiddenDiv.style.cssText = 'position:fixed;left:-99999px;top:-99999px;width:1px;height:1px;opacity:0;pointer-events:none;';
    document.body.appendChild(hiddenDiv);

    try {
      const scanner = new Html5Qrcode(hiddenId);
      const res = await scanner.scanFile(file, false);
      if (res && String(res).trim()) code = String(res).trim();
      try { await scanner.clear(); } catch (e) {}
    } catch (e) {
      // html5-qrcode lanza si no encuentra código — silencioso
    } finally {
      try { hiddenDiv.remove(); } catch (e) {}
    }
  }

  if (!code) {
    _scanLocked = false;
    toast('No se encontró código en la imagen', 1);
    return;
  }

  if (navigator.vibrate) navigator.vibrate([40, 30, 40]);
  _handleScannedCode(code);
}

  
  function _showScanPicker(code, ids) {
    const _field = (label, value, opts) => {
      const wide  = !!(opts && opts.wide);
      const muted = !!(opts && opts.muted);
      const s = String(value ?? '').trim();
      if (!s || s.toUpperCase() === 'SN' || s === '-' || s === 'S/N') return '';
      return `<div style="min-width:0;${wide ? 'grid-column:1/-1;' : ''}">
        <div style="font-size:9.5px;font-weight:800;color:var(--muted);text-transform:uppercase;letter-spacing:.3px;line-height:1.2">${esc(label)}</div>
        <div style="font-size:12.5px;color:${muted ? 'var(--muted)' : 'var(--text)'};margin-top:1px;font-weight:${muted ? '500' : '700'};word-break:break-word;line-height:1.35">${esc(s)}</div>
      </div>`;
    };

    const options = ids.map(id => {
      const p = P[id] || {};
      const est      = (p.est && EST[p.est]) ? EST[p.est] : '';
      const estColor = (p.est && EC[p.est])  ? EC[p.est]  : '#888';

      return `<button class="btn g" data-a="scan-pick" data-id="${esc(id)}"
          style="width:100%;margin-bottom:10px;text-align:left;justify-content:flex-start;
          padding:12px 14px;border-radius:12px;display:block">

          <div style="display:flex;align-items:flex-start;gap:8px;margin-bottom:9px">
            <div style="flex:1;min-width:0">
              <div style="font-weight:900;font-size:14.5px;color:var(--text);line-height:1.2;
                overflow-wrap:anywhere;word-break:break-word">${esc(p.nombre || '—')}</div>
              <div style="font-size:11.5px;color:var(--burgundy);margin-top:2px;font-weight:800;
                overflow-wrap:anywhere;word-break:break-word">Folio: ${esc(p.folio || '—')}</div>
            </div>
            ${est ? `<span style="background:${estColor};color:#fff;border-radius:999px;
              padding:2px 9px;font-size:10.5px;font-weight:800;white-space:nowrap;flex:0 0 auto">${esc(est)}</span>` : ''}
          </div>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:7px 12px">
            ${_field('Calle', p.calle)}
            ${_field('Colonia', p.colonia)}
            ${_field('No. exterior', p.numExt)}
            ${_field('No. interior', p.numInt)}
            ${_field('Manzana', p.mz)}
            ${_field('Lote', p.lt)}
            ${_field('Última visita', p.ultimaVisita)}
            ${_field('Tipo', p.tipo)}
            ${_field('Motivo', p.motivo, {wide: true})}
            ${_field('Referencias', p.refs, {wide: true, muted: true})}
          </div>
        </button>`;
    }).join('');

    openModal(`
      <div class="sheet-head">🔍 ${ids.length} coincidencias<button class="close" data-a="scan-pick-cancel">✕</button></div>
      <div class="sheet-body">
        <p style="font-size:13px;color:var(--muted);margin:0 0 14px;line-height:1.5">
          El código <b style="color:var(--text)">"${esc(code)}"</b>
          coincide con <b style="color:var(--text)">${ids.length} pacientes</b>.
          ¿Cuál quieres abrir?
        </p>
        ${options}
      </div>
      <div class="sheet-foot">
        <button class="btn g" data-a="scan-pick-cancel" style="flex:1">Cancelar</button>
      </div>
    `, true);
  }

  
function _findPatientByFolio(code) {
  if (!code) return { status: 'not_found', matches: [] };
  const raw    = String(code).trim();
  const digits = raw.replace(/\D/g, '');

  // ── Paso 1: coincidencia EXACTA en texto crudo ─────────────
  let matches = [];
  for (const id in P) {
    if (String(P[id].folio || '').trim() === raw) matches.push(id);
  }
  if (matches.length === 1) return { status: 'single',   matches };
  if (matches.length  > 1)  return { status: 'multiple', matches };

  // ── Paso 2: coincidencia EXACTA en solo dígitos ────────────
  if (digits) {
    matches = [];
    for (const id in P) {
      if (String(P[id].folio || '').replace(/\D/g, '') === digits) matches.push(id);
    }
    if (matches.length === 1) return { status: 'single',   matches };
    if (matches.length  > 1)  return { status: 'multiple', matches };
  }

  // ── Paso 3: coincidencia por NÚCLEO (quita ceros a los lados) ──
  const core = s => {
    const d = String(s || '').replace(/\D/g, '');   // ← ignora letras: XXXXX424234XXX → 424234
    return d ? d.replace(/^0+/, '').replace(/0+$/, '') : '';
  };
  const targetCore = core(digits);
  if (!targetCore) return { status: 'not_found', matches: [] };

  const exactCore = [];
  const partial   = [];
  for (const id in P) {
    const pc = core(P[id].folio);
    if (!pc) continue;
    if (pc === targetCore) exactCore.push(id);
    else if (pc.length >= 4 && targetCore.length >= 4) {
      if (targetCore.endsWith(pc) || targetCore.startsWith(pc) ||
          pc.endsWith(targetCore) || pc.startsWith(targetCore)) {
        partial.push(id);
      }
    }
  }
  if (exactCore.length === 1) return { status: 'single',   matches: exactCore };
  if (exactCore.length  > 1)  return { status: 'multiple', matches: exactCore };
  if (partial.length   === 1) return { status: 'single',   matches: partial   };
  if (partial.length    > 1)  return { status: 'multiple', matches: partial   };

  // ── Paso 3.5: coincidencia por SUBCADENA (en el MEDIO) ──
  // Cubre XXXX10771714XXXX: el código escaneado está contenido
  // DENTRO del folio más largo (o al revés). Solo corre si steps
  // 1–3 no encontraron nada.
  if (targetCore.length >= 4) {
    const subMatches = [];
    for (const id in P) {
      const pc = core(P[id].folio);
      if (!pc || pc === targetCore) continue;
      // pc contiene a targetCore (targetCore en MEDIO de pc)
      if (pc.length > targetCore.length && pc.includes(targetCore)) {
        subMatches.push(id); continue;
      }
      // targetCore contiene a pc (pc en MEDIO de targetCore)
      if (targetCore.length > pc.length && pc.length >= 4 && targetCore.includes(pc)) {
        subMatches.push(id);
      }
    }
    if (subMatches.length === 1) return { status: 'single',   matches: subMatches };
    if (subMatches.length  > 1)  return { status: 'multiple', matches: subMatches };
  }

  // ── Paso 4 (opcional, fallback agresivo):

  // ── Paso 4 (opcional, fallback agresivo):
  //    algunos lectores agregan 9s de relleno (EAN-13 interno). Sólo si
  //    los pasos 1–3 fallaron, intentamos quitar también 0s y 9s de los
  //    extremos. NO se usa antes para no romper folios que inician/terminan con 9.
  const core9 = s => {
    const d = String(s || '').replace(/\D/g, '');
    return d ? d.replace(/^[09]+/, '').replace(/[09]+$/, '') : '';
  };
  const t9 = core9(digits);
  if (t9 && t9 !== targetCore) {
    const m9 = [];
    for (const id in P) {
      const pc = core9(P[id].folio);
      if (pc && pc === t9) m9.push(id);
    }
    if (m9.length === 1) return { status: 'single',   matches: m9 };
    if (m9.length  > 1)  return { status: 'multiple', matches: m9 };
  }

  return { status: 'not_found', matches: [] };
}
  /* ---------- TABLA TIPO EXCEL ---------- */
function updateTblButtons(){
  const btnCols = $('#btnCols');
  if (btnCols) btnCols.textContent = 'Columnas';
  const btnReset = $('#btnResetSort');
  if (btnReset) {
    const n = TBL.sorts.length;
    btnReset.hidden = n === 0;
    if (n > 0) btnReset.textContent = `Eliminar órdenes (${n})`;
  }
}

function renderTbl(){

  const tbl = $('#tblMain');
  const cnt = $('#tblCnt');
  if (!tbl) return;
  const source = LIST.map(id => P[id]);
  if (cnt) cnt.textContent = source.length + (source.length === 1 ? ' fila' : ' filas');

  if (!source.length) {
    updateTblButtons();
    tbl.innerHTML = '<tbody><tr><td colspan="100" class="tbl-empty">Sin resultados con los filtros actuales</td></tr></tbody>';
    return;
  }

  // 🆕 CASO: el usuario ocultó TODAS las columnas → mensaje amigable (no tabla rota)
  if (!TBL.cols.length) {
    updateTblButtons();
    tbl.innerHTML = '<tbody><tr><td colspan="100" class="tbl-empty" style="cursor:pointer" data-a="tbl-cols">⚠️ No hay columnas visibles.<br><span style="font-size:14px;font-weight:700;color:var(--burgundy);margin-top:6px;display:inline-block">Toca aquí para activar al menos una</span></td></tr></tbody>';
    return;
  }

  
   // ══════════ ENCABEZADOS ORDENABLES (multi-columna · 4 estados) ══════════
  const cols = TBL_COLS.filter(c => TBL.cols.includes(c.k));
  const head = cols.map(c => {
    const idx = TBL.sorts.findIndex(s => s.k === c.k);
    const s = idx >= 0 ? TBL.sorts[idx] : null;
    let arrow = '↕', cls = '';
    if (s) {
      cls = 'sorted';
      if (s.mode === 'asc')  arrow = '▲';
      else if (s.mode === 'desc') arrow = '▼';
      else if (s.mode === 'freq') { arrow = '★'; cls += ' freq'; }
    }
   
    // Numeración EFECTIVA (solo cuenta sorts visibles en orden de array)
const visibleSorts = TBL.sorts.filter(x => TBL.cols.includes(x.k));
const effectiveIdx = visibleSorts.findIndex(x => x.k === c.k);
const priority = (s && visibleSorts.length > 1 && effectiveIdx >= 0)
  ? `<sup style="font-size:9px;opacity:.85;margin-left:3px;font-weight:900">${effectiveIdx+1}</sup>`
  : '';
    
    return `<th data-a="tbl-sort" data-k="${c.k}" class="${cls}"
      title="Clic: ascendente → descendente → frecuencia → sin orden">${esc(c.l)}<span class="arrow">${arrow}</span>${priority}</th>`;
  }).join('');

  // ══════════ ORDENAMIENTO MULTI-COLUMNA CON 4 MODOS ══════════
  const NUMCOLS = new Set(['numExt','numInt','mz','lt','edad','ultimaVisita','nv']);

  // Precalcular mapas de frecuencia para cada columna con modo 'freq'
  const freqMaps = {};
  for (const s of TBL.sorts) {
    if (s.mode !== 'freq') continue;
    const col = TBL_COLS.find(c => c.k === s.k);
    if (!col) continue;
    const counts = {};
    source.forEach(p => {
      const v = String(col.get(p) ?? '').trim();
      if (v === '' || v === '—') return;
      counts[v] = (counts[v] || 0) + 1;
    });
    freqMaps[s.k] = counts;
  }

  // Construir comparadores en el orden de prioridad (primero en la lista = primero en ordenar)
  // ✅ Solo se aplican si la columna está VISIBLE (evita "sort fantasma")
  const comparators = TBL.sorts.map(s => {
    if (!TBL.cols.includes(s.k)) return null;
    const col = TBL_COLS.find(c => c.k === s.k);
    if (!col) return null;

    
    const isNum = NUMCOLS.has(s.k);
    const freq  = freqMaps[s.k];
    return (a, b) => {
      const sa = String(col.get(a) ?? '').trim();
      const sb = String(col.get(b) ?? '').trim();
      const ea = sa === '' || sa === '—';
      const eb = sb === '' || sb === '—';

      // ── MODO FRECUENCIA: valores repetidos primero (mayor → menor), vacíos al final ──
       if (s.mode === 'freq') {
        if (ea && !eb) return 1;
        if (!ea && eb) return -1;
        const ca = freq[sa] || 0, cb = freq[sb] || 0;
        if (ca !== cb) return cb - ca;
        return _cmpStr(sa, sb);
      }

      // ── MODO NUMÉRICO ASC / DESC ──
      if (isNum) {
        const na = parseInt(sa.replace(/\D/g,''), 10);
        const nb = parseInt(sb.replace(/\D/g,''), 10);
        if (isNaN(na) && isNaN(nb)) return 0;
        if (isNaN(na)) return 1;
        if (isNaN(nb)) return -1;
        return (na - nb) * (s.mode === 'desc' ? -1 : 1);
      }

      // ── MODO TEXTO ASC / DESC ──
       return _cmpStr(sa, sb) * (s.mode === 'desc' ? -1 : 1);

    };
  }).filter(Boolean);

  const sorted = source.slice().sort((a, b) => {
    for (const cmp of comparators) {
      const r = cmp(a, b);
      if (r) return r;
    }

        // ✅ Sin orden manual → fallback alfabético por NOMBRE
    return _cmpStr(a.nombre || '', b.nombre || '');
  });
  

  // 🆕 Límite dinámico (botón "Cargar más" incrementa TABLE_LIMIT)
  const sortedLimited = sorted.slice(0, TABLE_LIMIT);

  // Filas
  // 🆕 Mapa objeto-paciente → pid (para recuperar el id de cada fila)
  const idOfPatient = new Map(LIST.map(id => [P[id], id]));
  // 🆕 Helper: #rrggbb → rgba(...,alpha)
  const _hexToRgba = (hex, a) => {
    if (!hex || hex[0] !== '#') return '';
    const r = parseInt(hex.slice(1,3), 16);
    const g = parseInt(hex.slice(3,5), 16);
    const b = parseInt(hex.slice(5,7), 16);
    return `rgba(${r},${g},${b},${a})`;
  };

  // Filas
  const body = sortedLimited.map(p => {
    const tds = cols.map(c => {
      const v = c.get(p);
      if (c.isEst && v && EST[v]) {
        return `<td class="est" style="background:${EC[v]||'#888'}">${esc(EST[v])}</td>`;
      }
      if (['numExt','numInt','edad','ultimaVisita','nv'].includes(c.k)) {
        return `<td class="num">${esc(v || '—')}</td>`;
      }
      return `<td>${esc(v || '—')}</td>`;
    }).join('');
    // 🆕 Fondo de fila según estatus (0.40 = ~3× más fuerte que 0.14, claramente visible)
    const pid      = idOfPatient.get(p) || '';
    const estColor = EC[p.est];
    const rowBg    = estColor ? _hexToRgba(estColor, 0.40) : '';
    const rowStyle = rowBg ? ` style="background:${rowBg}"` : '';
    // 🆕 data-a="row-open" → el doble-tap abre el paciente
    return `<tr data-a="row-open" data-id="${esc(pid)}"${rowStyle}>${tds}</tr>`;
  }).join('');

  // 🆕 Footer con botón "Cargar más" (o mensaje de "todas visibles")
  const remaining = Math.max(0, sorted.length - sortedLimited.length);
  const nextBatch = Math.min(500, remaining);
  let footerRow = '';
  if (remaining > 0) {
    footerRow = `<tr><td colspan="${cols.length}" style="text-align:center;padding:12px 10px;background:var(--cream-2)">
      <div style="display:flex;align-items:center;justify-content:center;gap:12px;flex-wrap:wrap">
        <span style="color:var(--muted);font-size:12px;font-weight:700;font-variant-numeric:tabular-nums">
          Mostrando ${sortedLimited.length.toLocaleString('es-MX')} de ${sorted.length.toLocaleString('es-MX')}
          · faltan ${remaining.toLocaleString('es-MX')}
        </span>
        ${TABLE_LIMIT < TABLE_MAX ? `
          <button data-a="tbl-more" type="button"
            style="background:var(--burgundy);color:#fff;border:0;border-radius:999px;
                   padding:9px 20px;font-size:12.5px;font-weight:800;cursor:pointer;
                   box-shadow:0 3px 10px rgba(139,41,66,.28);white-space:nowrap;
                   display:inline-flex;align-items:center;gap:6px">
            ⬇️ Cargar ${nextBatch} más
          </button>
        ` : `<span style="color:var(--warn);font-size:11.5px;font-weight:700">
          · Tope ${TABLE_MAX} alcanzado · usa filtros o búsqueda
        </span>`}
      </div>
    </td></tr>`;
  } else if (sorted.length > 0) {
    footerRow = `<tr><td colspan="${cols.length}" style="text-align:center;padding:8px;background:var(--cream-2);color:var(--muted);font-size:11.5px;font-weight:700">
      ✓ Mostrando todas las ${sorted.length.toLocaleString('es-MX')} filas
    </td></tr>`;
  }

  tbl.innerHTML = `<thead><tr>${head}</tr></thead><tbody>${body}${footerRow}</tbody>`;
  updateTblButtons();

  // 🆕 Solo resetea scroll al primer render; al "Cargar más" conservamos posición
  const sc = $('#tblScroll');
  if (sc) {
    if (!sc._keepScroll) sc.scrollTop = 0;
    sc._keepScroll = false;
  }
}

function tblColsUI(){
  // 🆕 Usa el patrón .sort-row + .chk que YA tiene CSS en tu app.
  //    Row entera clickeable, estado visual claro, sin checkbox nativo.
  const rows = TBL_COLS.map(c => {
    const on = TBL.cols.includes(c.k);
    return `<div class="sort-row" style="cursor:pointer;user-select:none"
                 data-a="tbl-col-toggle" data-k="${esc(c.k)}">
      <span class="chk ${on?'on':''}">✓</span>
      <span class="lbl">${esc(c.l)}</span>
    </div>`;
  }).join('');
  openModal(`
    <div class="sheet-head">Columnas visibles<button class="close" data-a="close-modal">✕</button></div>
    <div class="sheet-body">
      <p style="font-size:12.5px;color:var(--muted);margin:0 0 12px">
        Marca las columnas que quieres ver en la tabla.
      </p>
      ${rows}
    </div>
    <div class="sheet-foot">
      <button class="btn g" data-a="tbl-col-all" style="flex:1">Todas</button>
      <button class="btn g" data-a="tbl-col-none" style="flex:1">Ninguna</button>
      <button class="btn p" data-a="close-modal" style="flex:1">Listo</button>
    </div>
  `, true);
}

  
  function askSaveOrDiscard(onSave, onDiscard){
  openModal(`
    <div class="sheet-head">⚠️ Cambios sin guardar<button class="close" data-a="close-modal">✕</button></div>
    <div class="sheet-body">
      <p style="text-align:center;font-size:16px;margin:20px 0;font-weight:700">
        Tienes cambios pendientes
      </p>
      <p style="text-align:center;font-size:13px;color:var(--muted);margin:0 0 8px">
        ¿Qué quieres hacer?
      </p>
    </div>
    <div class="sheet-foot" style="flex-direction:column;gap:8px;padding:14px 16px calc(14px + env(safe-area-inset-bottom))">
      <button class="btn p" data-a="as-save" style="width:100%;padding:14px;font-size:14.5px">💾 Guardar cambios</button>
      <button class="btn" data-a="as-discard" style="width:100%;padding:14px;font-size:14.5px;background:#fdeaea;color:var(--err);border-color:#f2c4c4">🗑 Descartar cambios</button>
      <button class="btn g" data-a="as-cancel" style="width:100%;padding:14px;font-size:14.5px">← Seguir editando</button>
    </div>
  `, true);

    
  // Guardar callbacks temporalmente
  ACT['as-save'] = async () => {
    closeModal();
    let ok = true;
    try { ok = await save(true); } catch(e){ ok = false; }
    if (ok) {
      if (onSave) onSave();
    } else {
      // ✅ FIX: si falla, avisar y dejar al usuario decidir
      toast('No se pudo guardar. Revisa tu conexión.', 1);
      // Reabrir el modal de decisión con las mismas opciones
      setTimeout(() => askSaveOrDiscard(onSave, onDiscard), 300);
    }
  };
    
  ACT['as-discard'] = () => { closeModal(); D = 0; if (onDiscard) onDiscard(); };
  ACT['as-cancel'] = () => closeModal();
}

  /* ---------- CONFIRM MODAL (reemplaza al nativo confirm()) ---------- */
function askConfirm(message, title = '⚠️ Confirmar') {
  return new Promise((resolve) => {
    // Si ya había un confirm pendiente, resolverlo como cancelado
    if (_pendingConfirmResolve) {
      try { _pendingConfirmResolve(false); } catch(e){}
    }
    _pendingConfirmResolve = resolve;

    openModal(`
      <div class="sheet-head">${esc(title)}<button class="close" data-a="confirm-no">✕</button></div>
      <div class="sheet-body" style="text-align:center;padding:24px 18px 20px">
        <p style="font-size:15px;margin:0;line-height:1.5;color:var(--text);font-weight:600">
          ${esc(message)}
        </p>
      </div>
      <div class="sheet-foot">
        <button class="btn g" data-a="confirm-no" style="flex:1">Cancelar</button>
        <button class="btn p" data-a="confirm-yes" style="flex:1">ACEPTAR.</button>
      </div>
    `, true);

    ACT['confirm-yes'] = () => {
      const r = _pendingConfirmResolve;
      _pendingConfirmResolve = null;
      closeModal();
      if (r) r(true);
    };
    ACT['confirm-no'] = () => {
      const r = _pendingConfirmResolve;
      _pendingConfirmResolve = null;
      closeModal();
      if (r) r(false);
    };
  });
}

  /* ═══════════════════════════════════════════════════════════════
   🔒 MODAL PIN (4-6 dígitos)
   ═══════════════════════════════════════════════════════════════ */
async function promptPINModal() {
  // 🆕 Info identificadora: usuario + dispositivo + fecha/hora actual (una sola vez, no en vivo)
  const userName = STORE.get(STORE.KEY_N) || 'Brigadista';
  let devInfo = { brand: '', model: '', platform: '' };
  try { devInfo = await getDeviceInfo(); } catch (e) {}
  const deviceLabel = [devInfo.brand, devInfo.model].filter(Boolean).join(' ') || 'Dispositivo';
  const platLabel   = devInfo.platform || '';
    const devIdShort  = (devInfo.deviceId || '').slice(0, 8).toUpperCase();
  const now   = new Date();
  const fecha = now.toLocaleDateString('es-MX', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });
  const hora  = now.toLocaleTimeString('es-MX', {
    hour: '2-digit', minute: '2-digit'
  });

  return new Promise((resolve) => {
    _pendingPINResolve = resolve;   // 🆕 registrar (closeModal lo resuelve como null)

    openModal(`
      <div class="sheet-head">🔒<button class="close" data-a="pin-cancel">✕</button></div>
      <div class="sheet-body" style="text-align:center;padding:24px 20px">

        <!-- 🆕 Tarjeta identificadora -->
        <div style="background:var(--cream-2);border:1px solid var(--border);border-radius:12px;
          padding:12px 14px;margin-bottom:18px;text-align:left;font-size:12.5px;line-height:1.55">
          <div style="display:flex;gap:8px;align-items:center;margin-bottom:5px">
            <b style="color:var(--text)">${esc(userName)}</b>
          </div>
          <div style="display:flex;gap:8px;align-items:center;margin-bottom:5px">
            <span style="color:var(--text)">${esc(deviceLabel)}${platLabel ? ' · ' + esc(platLabel) : ''}</span>
          </div>
          
          <div style="display:flex;gap:8px;align-items:center">
            <span style="color:var(--muted);text-transform:capitalize"> ${esc(devIdShort)} · ${esc(fecha)} · ${esc(hora)}</span>
          </div>
        </div>

    
        <form autocomplete="off" style="margin:0">

          <input type="text" name="username" autocomplete="username" value="brigadista" style="display:none">
          <input id="pinInput" type="password" name="app_pin_local" inputmode="numeric" maxlength="8"
            autocomplete="one-time-code" autocorrect="off" spellcheck="false"
            data-form-type="other"
            style="width:100%;max-width:240px;padding:16px;font-size:28px;letter-spacing:12px;
            text-align:center;border-radius:12px;border:2px solid var(--border);background:#fff;
            font-weight:800;outline:none;margin:0 auto;display:block" placeholder="••••••">
        </form>
      </div>
      <div class="sheet-foot">
        <button class="btn g" data-a="pin-cancel" style="flex:1">Cancelar</button>
        <button class="btn p" data-a="pin-submit" style="flex:1">Continuar</button>
      </div>
    `, true);
    setTimeout(() => document.getElementById('pinInput')?.focus(), 100);

    // 🆕 finish() limpia el resolver ANTES de closeModal para evitar doble resolución
    const finish = (val) => {
      _pendingPINResolve = null;
      closeModal();
      resolve(val);
    };
    const submit = () => finish((document.getElementById('pinInput')?.value || '').trim() || null);
    const cancel = () => finish(null);

    ACT['pin-submit'] = submit;
    ACT['pin-cancel'] = cancel;
    document.getElementById('pinInput')?.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); submit(); }
    });
  });
}

/* ═══════════════════════════════════════════════════════════════
   🔑 MODAL CONTRASEÑA
   ═══════════════════════════════════════════════════════════════ */
function promptPasswordModal() {
  return new Promise((resolve) => {
    _pendingPWResolve = resolve;   // 🆕 registrar (closeModal lo resuelve como null)

    openModal(`
      <div class="sheet-head">🔑 Ingresa tu contraseña<button class="close" data-a="pw-cancel">✕</button></div>
      <div class="sheet-body" style="text-align:center;padding:28px 20px">
        <p style="font-size:14px;color:var(--muted);margin:0 0 18px;line-height:1.5">
          La contraseña descifra tus datos locales.<br>
          <b style="color:var(--err)">Sin ella no se puede recuperar la información.</b>
        </p>
        <form autocomplete="off" style="margin:0">
          <input type="text" name="username" autocomplete="username" value="brigadista" style="display:none">
          <input id="pwInput" type="password" name="app_login_password"
            autocomplete="current-password" autocapitalize="none" autocorrect="off" spellcheck="false"
            data-form-type="other"
            style="width:100%;max-width:280px;padding:14px 16px;font-size:16px;
            border-radius:12px;border:2px solid var(--border);background:#fff;
            outline:none;margin:0 auto;display:block" placeholder="Contraseña">
        </form>
      </div>
      <div class="sheet-foot">
        <button class="btn g" data-a="pw-cancel" style="flex:1">Cancelar</button>
        <button class="btn p" data-a="pw-submit" style="flex:1">Desbloquear</button>
      </div>
    `, true);
    setTimeout(() => document.getElementById('pwInput')?.focus(), 100);

    // 🆕 finish() limpia el resolver ANTES de closeModal para evitar doble resolución
    const finish = (val) => {
      _pendingPWResolve = null;
      closeModal();
      resolve(val);
    };
    const submit = () => finish((document.getElementById('pwInput')?.value || '') || null);
    const cancel = () => finish(null);

    ACT['pw-submit'] = submit;
    ACT['pw-cancel'] = cancel;
    document.getElementById('pwInput')?.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); submit(); }
    });
  });
}

  
function openModal(html, center) {
  _modalVersion++;   // 🆕 invalida cualquier setTimeout de mapa pendiente

  if (_pickMapInstance) {
    try { _pickMapInstance.remove(); } catch(e){}
    _pickMapInstance = null;
  }
  if (_viewMapUserWatch != null) {
    try { navigator.geolocation.clearWatch(_viewMapUserWatch); } catch(e){}
    _viewMapUserWatch = null;
  }
  _viewMapUserLayer = null;
  const r = $('#modalRoot');
  r.innerHTML = `<div class="ovl${center?' center':''}">
    <div class="${center?'sheet':'sheet'}" data-stop>${html}</div>
  </div>`;
}

  function closeModal() {
  _modalVersion++;   // 🆕 invalida cualquier setTimeout de mapa pendiente

  if (_pickMapInstance) { try { _pickMapInstance.remove(); } catch(e){} _pickMapInstance = null; }
  _stopInvisibleScan();
  _stopVisibleScan();
  PICK = null;

  if (_viewMapUserWatch != null) {
    try { navigator.geolocation.clearWatch(_viewMapUserWatch); } catch(e){}
    _viewMapUserWatch = null;
  }
  _viewMapUserLayer = null;
    

  // 🆕 Si había un marker de casa en modo drag, devolverlo al clúster
  if (typeof _catCasaDragging !== 'undefined' && _catCasaDragging) {
    try { _catCasaDragging.restore(); } catch(e){}
    _catCasaDragging = null;
  }

      $('#modalRoot').innerHTML = '';

  // Confirm pendiente → resolver como cancelado
  if (_pendingConfirmResolve) {
    const r = _pendingConfirmResolve;
    _pendingConfirmResolve = null;
    try { r(false); } catch(e){}
  }

  // 🆕 PIN pendiente (tocó overlay / cerró sin elegir) → cancelar
  if (_pendingPINResolve) {
    const r = _pendingPINResolve;
    _pendingPINResolve = null;
    try { r(null); } catch(e){}
  }

  // 🆕 Password pendiente (tocó overlay / cerró sin elegir) → cancelar
  if (_pendingPWResolve) {
    const r = _pendingPWResolve;
    _pendingPWResolve = null;
    try { r(null); } catch(e){}
  }

  // Si veníamos de "Estoy en el domicilio", al cerrar el mapa continuamos el flujo
  if (_pickMapOnFinish) {
    const cb = _pickMapOnFinish;
    _pickMapOnFinish = null;
    setTimeout(cb, 60);
  }
}
  
$('#modalRoot').addEventListener('click', e => {
  const ovl = e.target.closest('.ovl');
  if (!ovl) return;
  if (ovl.dataset.lockClose === '1' && e.target === ovl) return;
  if (e.target === ovl || e.target.closest('[data-a=ovl-close]') || e.target.closest('.close')) closeModal();
});

  function fltUI() {
  const sheet = document.querySelector('#modalRoot .sheet');
  if (sheet) {
    // Modal ya abierto → solo actualizar contenido sin parpadeo
    const body = sheet.querySelector('.sheet-body');
    const st = body ? body.scrollTop : 0;
    sheet.innerHTML = _fltHTML();
    const newBody = sheet.querySelector('.sheet-body');
    if (newBody) newBody.scrollTop = st;
  } else {
    // Modal cerrado → abrir por primera vez
    openModal(_fltHTML());
  }
}
  
/* ---------- FILTROS ---------- */
function _fltHTML() {
  // 1. Base SIN municipio (para poder mostrar todos los municipios disponibles)
  const baseNoMun = Object.values(P).filter(p => {
    for (const [k,, f] of FC) {
      const s = FL.ch[k];
      if (s && s.length && !s.includes(f(p))) return 0;
    }
    if (FL.loc && (FL.loc === 'con') !== !!p.lat) return 0;
    if (FL.foto && (FL.foto === 'con') !== !!p.fachada) return 0;
    return true;
  });
  // 1b. Base CON municipio → colonias/calles/números se recalculan por municipio
  const baseGeo = (FL.municipio && FL.municipio.length)
    ? baseNoMun.filter(p => FL.municipio.some(m => norm(p.municipio) === norm(m)))
    : baseNoMun;

  // 2. Base para ch (estatus/tipo/etc): aplica colonia/calle/num + loc + foto
  const baseCh = baseGeo.filter(p => {
    // 🆕 Mismo fix que pass(): vacío = 'SN'
    if (FL.colonia.length && !FL.colonia.some(c =>
        (isReal(p.colonia) ? norm(p.colonia) : 'SN') === norm(c))) return 0;
    if (FL.calle.length && !FL.calle.some(c =>
        (isReal(p.calle) ? norm(p.calle) : 'SN') === norm(c))) return 0;
    if (FL.num.length && !FL.num.some(n => String(p.numExt||'').replace(/\D/g,'') === String(n).replace(/\D/g,''))) return 0;
    return true;
  });

  // 3. Colonias: sobre baseGeo
  const colCounter = {};
  baseGeo.forEach(p => { const c = isReal(p.colonia) ? p.colonia : 'SN'; colCounter[c] = (colCounter[c]||0)+1; });

   // 4. Manzanas: SOLO de las colonias seleccionadas
  const forMz = FL.colonia.length
    ? baseGeo.filter(p => FL.colonia.some(c => norm(p.colonia) === norm(c)))
    : baseGeo;
  const mzCounter = {};
  forMz.forEach(p => { const m = isReal(p.mz) ? String(p.mz).trim() : 'SN'; mzCounter[m] = (mzCounter[m]||0)+1; });

  // 5. Calles: SOLO de las colonias Y manzanas seleccionadas
  let forCalle = FL.colonia.length
    ? baseGeo.filter(p => FL.colonia.some(c => norm(p.colonia) === norm(c)))
    : baseGeo;
  if (FL.mz.length) {
    forCalle = forCalle.filter(p => FL.mz.some(m => norm(p.mz) === norm(m)));
  }
  const calleCounter = {};
  forCalle.forEach(p => { const c = isReal(p.calle) ? p.calle : 'SN'; calleCounter[c] = (calleCounter[c]||0)+1; });
  
  // 5. Números: SOLO de las calles seleccionadas
  const forNum = FL.calle.length
    ? forCalle.filter(p => FL.calle.some(c => norm(p.calle) === norm(c)))
    : forCalle;
  const numCounter = {};
  forNum.forEach(p => {
    const n = isReal(p.numExt) ? String(p.numExt) : 'SN';
    numCounter[n] = (numCounter[n]||0)+1;
  });


  const sortColFn = (a,b) => {
    if (FL.sortCol === 'numAsc')  return a[1] - b[1];
    if (FL.sortCol === 'numDesc') return b[1] - a[1];
    const r = cmp(a[0], b[0]);
    return FL.sortCol === 'za' ? -r : r;
  };
  const sortCalleFn = (a,b) => {
    if (FL.sortCalle === 'numAsc')  return a[1] - b[1];
    if (FL.sortCalle === 'numDesc') return b[1] - a[1];
    const r = cmp(a[0], b[0]);
    return FL.sortCalle === 'za' ? -r : r;
  };

// ──────────────────────────────────────────────────────────────
// FIX: el ordenamiento NO debe nunca recortar la lista.
// Mostramos TODOS los valores; el orden solo cambia la posición.
// Los valores seleccionados siempre están visibles.
// ──────────────────────────────────────────────────────────────
const colTop   = Object.entries(colCounter).sort(sortColFn);
const mzTop    = Object.entries(mzCounter).sort((a,b) => cmp(a[0], b[0]));
const calleTop = Object.entries(calleCounter).sort(sortCalleFn);
const numTop   = Object.entries(numCounter).sort((a, b) => {
  const r = numVal(a[0]) - numVal(b[0]);
  return FL.sortNum === 'desc' ? -r : r;
});

            
  // 🆕 Contador y chips de Municipio (sobre baseNoMun → ve TODOS los disponibles)
  const munCounter = {};
  baseNoMun.forEach(p => {
    const m = isReal(p.municipio) ? p.municipio : 'SN';
    munCounter[m] = (munCounter[m] || 0) + 1;
  });
  const munTop = Object.entries(munCounter).sort((a,b) => cmp(a[0], b[0]));
  const munChips = munTop.map(([c, n]) =>
    `<button class="chip${(FL.municipio||[]).includes(c)?' on':''}" data-a="fmunicipio" data-v="${esc(c)}">${esc(c)} <span class="n">${n}</span></button>`
  ).join('') || '<span class="chip ghost">sin datos</span>';
  

  // Render individual de un grupo de chips
  const renderChips = (k) => {
  const entry = FC.find(c => c[0] === k);
  if (!entry) return '';
  const [, l, f, lab] = entry;

  // ✅ Base para ESTE grupo: aplicar TODOS los filtros EXCEPTO FL.ch[k]
  //    → los chips ya seleccionados NO desaparecen, puedes seguir seleccionando más
  const baseForK = Object.values(P).filter(p => {
    for (const [k2,, f2] of FC) {
      if (k2 === k) continue;                       // ← saltar el propio filtro
      const s = FL.ch[k2];
      if (s && s.length && !s.includes(f2(p))) return false;
    }
    if (FL.loc  && (FL.loc  === 'con') !== !!p.lat)     return false;
    if (FL.foto && (FL.foto === 'con') !== !!p.fachada) return false;
    if (FL.municipio && FL.municipio.length &&
        !FL.municipio.some(m => norm(p.municipio) === norm(m))) return false;

    
    // 🆕 Mismo fix: comparar 'SN' contra vacíos
if (FL.colonia.length && !FL.colonia.some(c =>
    (isReal(p.colonia) ? norm(p.colonia) : 'SN') === norm(c))) return false;
if (FL.mz.length && !FL.mz.some(m =>
    (isReal(p.mz) ? norm(p.mz) : 'SN') === norm(m))) return false;
if (FL.calle.length && !FL.calle.some(c =>
    (isReal(p.calle) ? norm(p.calle) : 'SN') === norm(c))) return false;
    
    
    if (FL.num.length     && !FL.num.some(n =>
        String(p.numExt||'').replace(/\D/g,'') === String(n).replace(/\D/g,''))) return false;
    return true;

    
  });

  const counter = {};
  baseForK.forEach(p => { const v = f(p); counter[v] = (counter[v]||0)+1; });
  const sel = FL.ch[k] || [];
  const chips = Object.keys(counter).sort((a,b) => cmp(a,b)).map(v =>
    `<button class="chip${sel.includes(v)?' on':''}" data-a="fc" data-k="${k}" data-v="${esc(v)}">${esc(lab?lab(v):v||'—')} <span class="n">${counter[v]}</span></button>`
  ).join('');

  // ✅ Botón "Quitar" cuando hay selección (mismo UX que colonia)
  const clearBtn = sel.length
    ? `<div style="margin-top:8px"><button class="chip ghost" data-a="fc-clear" data-k="${k}">✕ Quitar ${l.toLowerCase()} (${sel.length})</button></div>`
    : '';

  return `<div class="fgroup">
    <div class="flabel">${l}<span class="fhint">${sel.length ? 'toca ✕ para quitar' : 'toca 1 o más'}</span></div>
    <div class="chips">${chips || '<span class="chip ghost">sin datos</span>'}</div>
    ${clearBtn}
  </div>`;
};

   // Orden deseado
const chipsTop = ['ultimaVisita', 'tipo', 'seccion', 'area'].map(renderChips).join('');
  const chipsBottom = ['sexo', 'est', 'vf', 'nv', 'dep', 'motivo'].map(renderChips).join('');
  

  const seg = (k, val, opts) => `<div class="seg">${opts.map(([v,l]) =>
    `<button data-a="fseg" data-k="${k}" data-v="${v}" class="${FL[k]===v?'on':''}">${l}</button>`
  ).join('')}</div>`;

  // Chips de colonia
  const colChips = colTop.map(([c, n]) =>
    `<button class="chip${FL.colonia.includes(c)?' on':''}" data-a="fcol" data-v="${esc(c)}">${esc(c)} <span class="n">${n}</span></button>`
  ).join('') || '<span class="chip ghost">sin datos</span>';

  // Chips de manzana
  const mzChips = mzTop.map(([c, n]) =>
    `<button class="chip${FL.mz.includes(c)?' on':''}" data-a="fmz" data-v="${esc(c)}">${esc(c)} <span class="n">${n}</span></button>`
  ).join('') || '<span class="chip ghost">sin datos</span>';

  // Chips de calle
  const calleChips = calleTop.map(([c, n]) =>
    `<button class="chip${FL.calle.includes(c)?' on':''}" data-a="fcal" data-v="${esc(c)}">${esc(c)} <span class="n">${n}</span></button>`
  ).join('') || '<span class="chip ghost">sin datos</span>';
  
  // Chips de número exterior
  const numChips = numTop.map(([c, n]) =>
    `<button class="chip${FL.num.includes(c)?' on':''}" data-a="fnum-chip" data-v="${esc(c)}">${esc(c)} <span class="n">${n}</span></button>`
  ).join('') || '<span class="chip ghost">sin datos</span>';

  return `
    <div class="sheet-head">Filtros${FL.colonia.length?` · ${FL.colonia.length} colonia(s)`:''}${FL.calle.length?` · ${FL.calle.length} calle(s)`:''}<button class="close">✕</button></div>
    <div class="sheet-body">
      ${chipsTop}

       <div class="fgroup">
        <div class="flabel">🏘️ Colonia
          <button data-a="fsort" data-k="sortCol" data-m="a" style="padding:2px 9px;font-size:10.5px;line-height:1.25;border:1.5px solid var(--burgundy);border-radius:999px;font-weight:800;cursor:pointer;margin-left:auto;${(FL.sortCol==='az'||FL.sortCol==='za') ? 'background:var(--burgundy);color:#fff;' : 'background:#fff;color:var(--burgundy);'}">${FL.sortCol === 'za' ? 'Z-A ↓' : 'A-Z ↑'}</button>
          <button data-a="fsort" data-k="sortCol" data-m="n" style="padding:2px 9px;font-size:10.5px;line-height:1.25;border:1.5px solid var(--burgundy);border-radius:999px;font-weight:800;cursor:pointer;margin-left:4px;${(FL.sortCol==='numAsc'||FL.sortCol==='numDesc') ? 'background:var(--burgundy);color:#fff;' : 'background:#fff;color:var(--burgundy);'}">${FL.sortCol === 'numDesc' ? '9-1 ↓' : '1-9 ↑'}</button>
          <span class="fhint" style="margin-left:6px">${FL.colonia.length?'toca ✕ para quitar':'toca 1 o más'}</span>
        </div>

        
           <div class="chips">${colChips}</div>
        ${FL.colonia.length ? `<div style="margin-top:8px"><button class="chip ghost" data-a="fcol-clear">✕ Quitar colonias (${FL.colonia.length})</button></div>` : ''}
      </div>

      ${FL.colonia.length ? `
        <div class="fgroup">
        <div class="flabel">🔲 Manzana
          <span class="fhint">${FL.mz.length?'toca ✕ para quitar':'toca 1 o más'}</span>
        </div>
        <div class="chips">${mzChips}</div>
        ${FL.mz.length ? `<div style="margin-top:8px"><button class="chip ghost" data-a="fmz-clear">✕ Quitar manzanas (${FL.mz.length})</button></div>` : ''}
      </div>` : ''}

      ${FL.colonia.length ? `
        <div class="fgroup">
        <div class="flabel">🛣️ Calle

        
          <button data-a="fsort" data-k="sortCalle" data-m="a" style="padding:2px 9px;font-size:10.5px;line-height:1.25;border:1.5px solid var(--burgundy);border-radius:999px;font-weight:800;cursor:pointer;margin-left:auto;${(FL.sortCalle==='az'||FL.sortCalle==='za') ? 'background:var(--burgundy);color:#fff;' : 'background:#fff;color:var(--burgundy);'}">${FL.sortCalle === 'za' ? 'Z-A ↓' : 'A-Z ↑'}</button>
          <button data-a="fsort" data-k="sortCalle" data-m="n" style="padding:2px 9px;font-size:10.5px;line-height:1.25;border:1.5px solid var(--burgundy);border-radius:999px;font-weight:800;cursor:pointer;margin-left:4px;${(FL.sortCalle==='numAsc'||FL.sortCalle==='numDesc') ? 'background:var(--burgundy);color:#fff;' : 'background:#fff;color:var(--burgundy);'}">${FL.sortCalle === 'numDesc' ? '9-1 ↓' : '1-9 ↑'}</button>
          <span class="fhint" style="margin-left:6px">solo de las colonias elegidas</span>
        </div>
        <div class="chips">${calleChips}</div>
        ${FL.calle.length ? `<div style="margin-top:8px"><button class="chip ghost" data-a="fcal-clear">✕ Quitar calles (${FL.calle.length})</button></div>` : ''}
      </div>` : ''}
      

      ${FL.calle.length ? `
        <div class="fgroup">
        <div class="flabel">🔢 No. exterior
          <button data-a="fsort" data-k="sortNum" style="padding:2px 9px;font-size:10.5px;line-height:1.25;border:1.5px solid var(--burgundy);border-radius:999px;background:var(--burgundy);color:#fff;font-weight:800;cursor:pointer;margin-left:auto">${FL.sortNum === 'desc' ? '9-1 ↓' : '1-9 ↑'}</button>
          <span class="fhint" style="margin-left:6px">solo de las calles elegidas</span>
        </div>
        <div class="chips">${numChips}</div>
        ${FL.num.length ? `<div style="margin-top:8px"><button class="chip ghost" data-a="fnum-clear">✕ Quitar números (${FL.num.length})</button></div>` : ''}
      </div>` : ''}

      ${chipsBottom}

  <div class="fgroup">
        <div class="flabel">🏙️ Municipio
          <span class="fhint">${(FL.municipio||[]).length ? 'toca ✕ para quitar' : 'toca 1 o más'}</span>
        </div>
        <div class="chips">${munChips}</div>
        ${(FL.municipio||[]).length ? `<div style="margin-top:8px"><button class="chip ghost" data-a="fmunicipio-clear">✕ Quitar municipios (${FL.municipio.length})</button></div>` : ''}
      </div>
      
      <div class="fgroup"><div class="flabel">📍 Ubicación GPS</div>
        ${seg('loc', FL.loc, [['','Todas'],['con','Con ubicación'],['sin','Sin ubicación']])}</div>

      <div class="fgroup"><div class="flabel">📷 Foto de fachada</div>
        ${seg('foto', FL.foto, [['','Todas'],['con','Con foto'],['sin','Sin foto']])}</div>

    
      
    </div>

    
    <div class="sheet-foot">
      <button class="btn g" data-a="fclr">Limpiar todo</button>
      <button class="btn p" data-a="fapply">Ver ${LIST.length} resultados</button>
    </div>
  `;
}

  /* ═══════════════════════════════════════════════════════════════
   💬 WHATSAPP · Mensaje institucional único (pre-llenado)
   ═══════════════════════════════════════════════════════════════ */
function _waAddress(p) {
  const parts = [];
  if (isReal(p.calle))     parts.push(p.calle);
  if (isReal(p.numExt))    parts.push(p.numExt);
  if (isReal(p.numInt))    parts.push('Int. ' + p.numInt);
  if (isReal(p.mz))        parts.push('Mz. ' + p.mz);
  if (isReal(p.lt))        parts.push('Lt. ' + p.lt);
  if (isReal(p.colonia))   parts.push(p.colonia);
  if (isReal(p.municipio)) parts.push(p.municipio);
  return parts.join(', ') || 'su domicilio registrado';
}

// ═══════════════════════════════════════════════════════════════════
// 🆕 URL pública de la página de envío de ubicación
// ✅ Auto-detecta el dominio y la ruta base donde está desplegada la app
//    Sirve para múltiples repos / dominios sin tocar código.
// ═══════════════════════════════════════════════════════════════════
const LOC_BASE = (() => {
  // basePath = todo el pathname SIN el archivo final.

  const basePath = location.pathname.replace(/\/[^/]*$/, '/');
  return location.origin + basePath + 'ubicacion';
})();
  
  

/* 🆕 Construye URL de ubicación: prioriza FOLIO, si no → NOMBRE sin espacios */
function _patientLocationUrl(p) {
  if (!p) return '';
  const folio = String(p.folio || '').trim();
  if (folio && folio.toUpperCase() !== 'SN' && folio !== '-' && folio.length >= 2) {
    return LOC_BASE + '?folio=' + encodeURIComponent(folio);
  }
  const nombre = String(p.nombre || '').trim().replace(/\s+/g, '');
  //                          ↑ antes: nombreCompleto
  if (nombre && nombre.length >= 2) {
    return LOC_BASE + '?nombre=' + encodeURIComponent(nombre);
  }
  return '';
}

/* 🆕 Consulta /api/ubicacion para obtener la MEJOR ubicación de un label.
   Cachea por 5 min (éxito o "no encontrado") para no spamear el endpoint. */
const _locCache = new Map();   // labelLower → { data, exp }
const _LOC_CACHE_TTL = 5 * 60e3;   // 🆕 FIX RED: 60s → 5 min
async function _fetchBestLocation(label) {
  if (!label) return null;
  if (SAVING_MODE) return null;
  const key = String(label).toLowerCase().trim();
  if (!key) return null;
  const cached = _locCache.get(key);
  if (cached && Date.now() < cached.exp) return cached.data;
  try {
    const r = await fetch('/api/ubicacion', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ a: 'location_best_for', label: String(label) })
    });
    if (!r.ok) {
      _locCache.set(key, { data: null, exp: Date.now() + _LOC_CACHE_TTL });
      return null;
    }
    const j = await r.json();
    if (!j || !j.found) {
      _locCache.set(key, { data: null, exp: Date.now() + _LOC_CACHE_TTL });
      return null;
    }
    const lat = +j.lat, lng = +j.lng, acc = +j.acc || 0, at = +j.at || 0;
    if (!isFinite(lat) || !isFinite(lng)) {
      _locCache.set(key, { data: null, exp: Date.now() + _LOC_CACHE_TTL });
      return null;
    }
    const data = { lat, lng, acc, at };
    _locCache.set(key, { data, exp: Date.now() + _LOC_CACHE_TTL });
    return data;
  } catch (e) {
    console.warn('[loc fetch]', e && e.message);
    _locCache.set(key, { data: null, exp: Date.now() + _LOC_CACHE_TTL });
    return null;
  }
}

function _buildWhatsAppMessage(patientId) {
  const p      = P[patientId] || {};
  const nombre = String(p.nombre || '').trim() || 'beneficiario(a)';
  const dir    = _waAddress(p);

  // Otros pacientes registrados con el mismo teléfono
  const otros = [];
  if (isReal(p.tel1)) {
    for (const o of getOtherPatientsWithPhone(p.tel1, patientId)) {
      if (!otros.some(x => x.id === o.id)) otros.push(o);
    }
  }
  if (isReal(p.tel2)) {
    for (const o of getOtherPatientsWithPhone(p.tel2, patientId)) {
      if (!otros.some(x => x.id === o.id)) otros.push(o);
    }
  }

  // URL AL PRINCIPIO — nunca se pierde aunque el mensaje se trunque
  const locUrl = _patientLocationUrl(p);
  const urlBlock = locUrl
    ? `${locUrl}\n\n─────────────\n\n`
    : '';

  // WhatsApp usa *texto* para negrita
  let msg = urlBlock +
    `*Estimado(a) ${nombre}:*\n\n` +
    `Le saluda personal de la Secretaría de Bienestar del Programa de Atención a Adultos Mayores y Personas con Discapacidad. ` +
    `Le contactamos en relación a su expediente activo.\n\n` +
    `Le informo que personal de esta Secretaría acudió al domicilio que se tiene registrado, ` +
    `ubicado en *${dir}*, para dar seguimiento al programa, pero no logramos localizarle.\n\n` +
    `Es indispensable confirmar su residencia y datos de contacto para dar continuidad a las acciones del programa a su favor. ` +
    `Su respuesta es muy importante para evitar afectaciones en los servicios que recibe.\n\n` +
    `Le pido amablemente comunicarse al teléfono de esta brigada o responder a este mensaje a la brevedad posible, ` +
    `Debido a que un servidor de la salud pasará a visitarle nuevamente. ` +
    `La visita se realizará en una fecha programada para su colonia/ manzana.\n\n` +
    `Quedo atento a su respuesta.\n\n` +
    `— Servidor de la Salud · Salud Casa por Casa`;

  // Si hay más pacientes con el mismo teléfono, se mencionan al final
  if (otros.length) {
    msg += `\n\n*Nota:*\n` +
      otros.map(o => `• *${o.nombre}*`).join('\n') +
      `\n\nLe pedimos amablemente hacer llegar este mensaje y aviso a sus familiares., ` +
      `Muchas Gracias, un saludo afectuoso.`;
  }

  return msg;
}
  


/* ---------- TELÉFONO ---------- */
function telUI(n, patientId) {
  // Vibrar al abrir
  if (navigator.vibrate) navigator.vibrate(40);
  
  const clean = String(n).replace(/\D/g,'');
  if (clean.length < 7) { toast('Número inválido', 1); return; }
  const w = clean.length === 10 ? '52'+clean : clean;
  const pid = patientId || cur || '';

  // 🆕 Mensaje institucional único pre-llenado
  const waMsg  = _buildWhatsAppMessage(pid);
  const waLink = `https://wa.me/${w}?text=${encodeURIComponent(waMsg)}`;
  
  openModal(`
    <div class="sheet-head">${esc(clean)}<button class="close" data-a="close-modal">✕</button></div>
    <div class="sheet-body">
      <a class="btn g" style="display:flex;width:100%;margin-bottom:12px" href="tel:${clean}" data-a="vib">📞 Llamar por telefono</a>
      <div style="display:flex;gap:8px;margin-bottom:8px">
        <a class="btn g" style="flex:1;justify-content:center" href="sms:${clean}" data-a="vib">✉️ Enviar SMS</a>
        <a class="btn g" style="flex:1;justify-content:center" target="_blank" rel="noopener noreferrer" href="${waLink}" data-a="vib">💬 WhatsApp</a>
      </div>

      <!-- Copiar + Agregar a contactos, lado a lado -->
      <div style="display:flex;gap:8px">
        <button class="btn g" style="flex:1;justify-content:center" data-a="copy-tel" data-n="${clean}">📋 Copiar</button>
        <button class="btn g" style="flex:1;justify-content:center" data-a="add-contact" data-pid="${esc(pid)}" data-n="${clean}">📇 Agregar contacto</button>
      </div>
    </div>
    <div class="sheet-foot"><button class="btn p" data-a="close-modal" style="flex:1">Cerrar</button></div>
  `, true);
}

/* ═══════════════════════════════════════════════════════════════
   📇 AGREGAR A CONTACTOS · Web Share API + vCard 3.0
   TEL1→CELL (móvil) · TEL2→HOME (casa) · Calle→ADR
   ═══════════════════════════════════════════════════════════════ */
function _buildContactData(patientId, phoneNumber) {
  const p = P[patientId] || {};
  const nombre = String(p.nombre || '').trim() || 'Sin nombre';
  const tipo   = String(p.tipo   || '').trim();
  const nombreCompleto = (tipo ? tipo + ' - ' : '') + nombre;

  // 📞 Teléfonos: tel1 = MÓVIL (CELL), tel2 = CASA (HOME)
  const tel1   = String(p.tel1 || '').replace(/\D/g, '');
  const tel2   = String(p.tel2 || '').replace(/\D/g, '');
  const tapped = String(phoneNumber || '').replace(/\D/g, '');

  let cellPhone = (tel1 && tel1.length >= 7) ? tel1 : '';
  let homePhone = (tel2 && tel2.length >= 7) ? tel2 : '';

  if (tapped && tapped.length >= 7 && tapped !== cellPhone && tapped !== homePhone) {
    if (!cellPhone) cellPhone = tapped;
    else if (!homePhone) homePhone = tapped;
  }
  if (cellPhone && cellPhone === homePhone) homePhone = '';

  // 🏠 Dirección: calle, numExt, colonia, municipio, estado (tal cual, con comas)
  const streetParts = [];
  if (isReal(p.calle))     streetParts.push(p.calle);
  if (isReal(p.numExt))    streetParts.push(p.numExt);
  if (isReal(p.colonia))   streetParts.push(p.colonia);
  if (isReal(p.municipio)) streetParts.push(p.municipio);
  const street = streetParts.join(', ');

  const city    = '';
  const region  = '';
  const country = '';

  // 📝 Notas (solo lo que NO cabe en campos estándar)
  const notes = [];
  if (isReal(p.folio))        notes.push('Folio: '       + p.folio);
  if (isReal(p.curp))         notes.push('CURP: '        + p.curp);
  if (isReal(p.sexo))         notes.push('Sexo: '        + p.sexo);
  if (isReal(p.edad))         notes.push('Edad: '        + p.edad);
  if (isReal(p.dep))          notes.push('Dependencia: ' + p.dep);
  if (isReal(p.seccion))      notes.push('Sección: '     + p.seccion);
  if (isReal(p.area))         notes.push('Área: '        + p.area);
  if (isReal(p.refs))         notes.push('Referencias: ' + p.refs);
  if (isReal(p.motivo))       notes.push('Motivo: '      + p.motivo);
  if (isReal(p.vf))           notes.push('Visita fue: '  + p.vf);
  if (isReal(p.nv))           notes.push('# Visita: '    + p.nv);
  if (isReal(p.ultimaVisita)) notes.push('Última visita: '+ p.ultimaVisita);
  if (isReal(p.diag))         notes.push('Diagnóstico: ' + p.diag);
  if (isReal(p.med))          notes.push('Medicamentos: '+ p.med);
  if (isReal(p.alg))          notes.push('Alergias: '    + p.alg);

  return {
    nombre, nombreCompleto,
    cellPhone, homePhone,
    street, city, region, country,
    notesText: notes.join('\n'),
    phone: tapped || cellPhone || homePhone
  };
}

function _buildVCardText(data) {
  const cleanName = String(data.nombre || '').trim();
  const nParts = cleanName.split(/\s+/);
  const firstName = nParts.length > 1 ? nParts.slice(0, -1).join(' ') : cleanName;
  const lastName  = nParts.length > 1 ? nParts[nParts.length - 1] : '';

  const escV = s => String(s || '')
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/,/g,  '\\,')
    .replace(/;/g,  '\\;');

  const lines = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    'N:'  + escV(lastName) + ';' + escV(firstName) + ';;;',
    'FN:' + escV(data.nombreCompleto)
  ];

  if (data.cellPhone) lines.push('TEL;TYPE=CELL:' + data.cellPhone);
  if (data.homePhone) lines.push('TEL;TYPE=HOME:' + data.homePhone);

  if (data.street || data.city || data.region) {
    const adr = [
      '', '',
      escV(data.street),
      escV(data.city),
      escV(data.region),
      '',
      escV(data.country)
    ].join(';');
    lines.push('ADR;TYPE=HOME:' + adr);
  }

  if (data.notesText) lines.push('NOTE:' + escV(data.notesText));
  lines.push('END:VCARD');
  return lines.join('\r\n');
}

function _downloadVCardText(vcardText, safeName) {
  try {
    const blob = new Blob([vcardText], { type: 'text/vcard;charset=utf-8' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = safeName + '.vcf';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 3000);
    toast('📥 Contacto descargado — ábrelo para agregar');
  } catch (e) {
    toast('No se pudo generar el contacto', 1);
    console.warn('[vcard]', e);
  }
}

function _addToContacts(patientId, phoneNumber) {
  try {
    const data = _buildContactData(patientId, phoneNumber);
    if (!data.phone) { toast('Número inválido', 1); return; }
    if (navigator.vibrate) navigator.vibrate(30);

    const vcard    = _buildVCardText(data);
    const safeName = (data.nombreCompleto || 'contacto')
      .replace(/[^\w\s-]/g, '_').slice(0, 40);

    console.log('[add-contact] data:', data);
    console.log('[add-contact] vcard:\n' + vcard);

    // ── MÉTODO 1: Web Share API ──
    let file = null;
    try {
      file = new File([vcard], safeName + '.vcf', { type: 'text/vcard' });
    } catch (e) { console.warn('[add-contact] File API no disponible'); }

    let canShare = false;
    try {
      canShare = !!(file && navigator.canShare && navigator.canShare({ files: [file] }));
    } catch (e) { canShare = false; }

    console.log('[add-contact] canShare:', canShare, '· navigator.share:', !!navigator.share);

    if (canShare && navigator.share) {
      navigator.share({
        files: [file],
        title: data.nombreCompleto,
        text:  'Guardar contacto'
      }).then(() => {
        toast('✓ Contacto enviado');
      }).catch(err => {
        if (err && err.name === 'AbortError') return;
        console.warn('[add-contact] share falló → descargando', err);
        _downloadVCardText(vcard, safeName);
      });
      return;
    }

    // ── MÉTODO 2: descarga directa ──
    _downloadVCardText(vcard, safeName);

  } catch (e) {
    console.error('[add-contact] error fatal:', e);
    toast('Error: ' + (e.message || 'contacto falló'), 1);
  }
}

  



/* ---------- ACCIONES ---------- */

// 🆕 Estado para detectar el doble-toque en filas de la tabla
let _lastRowTap = { id: '', t: 0 };

/* ═══════════════════════════════════════════════════════════════
   📱 REPORTE WHATSAPP · Salud Casa por Casa
   Construye un mensaje con datos automáticos del día programado
   + campos editables, y lo envía/copia vía WhatsApp.
   ═══════════════════════════════════════════════════════════════ */
function _reportDateStr(ds) {
  if (!ds) return '';
  const p = String(ds).split('-');
  if (p.length !== 3) return ds;
  return p[2] + '/' + p[1] + '/' + p[0];
}

/* 🆕 FIX: lee de IndexedDB primero para que reprogramaciones/visitas
   locales (aún no sincronizadas) se reflejen consistentemente en el reporte.
   Hace merge de IDB → P (sin borrar claves que estén solo en memoria). */
async function _reportHydrateFromIDB() {
  try {
    if (!APP_KEY) return;                          // sin clave no se puede descifrar
    const cached = await OFFDB.getPatientsObject(); // ya viene descifrado
    if (!cached || !Object.keys(cached).length) return;
    // Merge: IDB manda sobre memoria (son los datos persistidos reales)
    // pero respetamos claves que estén solo en memoria (cambios recién hechos)
    for (const id in cached) {
      const fromIdb = cached[id];
      if (!fromIdb) continue;
      const fromMem = P[id];
      // Si no existe en memoria → traerlo
      if (!fromMem) { P[id] = fromIdb; continue; }
      // Si existe en ambos → merge (IDB gana en campos que la memoria no tiene,
      // y en campos donde la memoria está vacía pero IDB tiene valor)
      for (const k in fromIdb) {
        const vMem = fromMem[k];
        const vIdb = fromIdb[k];
        // Preferir memoria si tiene valor (cambios optimistic recientes)
        if (vMem == null || vMem === '' || vMem === 'SN') {
          fromMem[k] = vIdb;
        } else if (k === 'vis' && vIdb && typeof vIdb === 'object') {
          // 🆕 Visitas: unión por vid (la memoria puede tener visitas más nuevas)
          fromMem.vis = fromMem.vis || {};
          for (const vid in vIdb) {
            if (!fromMem.vis[vid]) fromMem.vis[vid] = vIdb[vid];
          }
        }
      }
    }
  } catch (e) {
    console.warn('[report] hydrate IDB falló, usando memoria:', e && e.message);
  }
}

async function _reportBuildAuto() {
  // 🆕 Sincronizar con IndexedDB antes de calcular el reporte
  await _reportHydrateFromIDB();

  const day = PROG_DAY || today();
  const progsHoy = Object.entries(P).filter(([, p]) => p && p.prog_fecha === day);

  // Municipio (el más frecuente)
  const munCount = {};
  for (const [, p] of progsHoy) {
    const m = String(p.municipio || '').trim();
    if (m) munCount[m] = (munCount[m] || 0) + 1;
  }
  let municipio = '', maxM = 0;
  for (const [m, n] of Object.entries(munCount)) if (n > maxM) { maxM = n; municipio = m; }

  // Secciones únicas
  const secSet = new Set();
  for (const [, p] of progsHoy) {
    const s = String(p.seccion || '').trim();
    if (s) secSet.add(s);
  }
  const seccion = [...secSet]
    .sort((a, b) => a.localeCompare(b, 'es', { numeric: true }))
    .join(', ');

  // Zonas (área) únicas
  const areaSet = new Set();
  for (const [, p] of progsHoy) {
    const a = String(p.area || '').trim();
    if (a) areaSet.add(a);
  }
  const zona = [...areaSet]
    .sort((a, b) => a.localeCompare(b, 'es', { numeric: true }))
    .join(', ');

  // Visitas efectivas + agrupación por N (nv)
  let efectivas = 0;
  const porNv = {}; // { '1V': 2, '5V': 1, ... }
  const reprogramacionList = [];

  for (const [, p] of progsHoy) {
    // ¿Fue efectiva HOY?
    let esEfectiva = false;

    // Camino A: tiene visita con fecha = day
    if (p.vis && typeof p.vis === 'object') {
      for (const vid in p.vis) {
        const v = p.vis[vid];
        if (v && v.fecha === day) { esEfectiva = true; break; }
      }
    }
    // Camino B: credencializado (vf)
    if (!esEfectiva && p.vf === 'CREDENCIALIZADO') esEfectiva = true;

    if (esEfectiva) {
      efectivas++;
      // Agrupar por nv (ej. "1V", "2V", "5V")
      const nvRaw = String(p.nv || '').trim().toUpperCase();
      let key = '';
      const m = nvRaw.match(/^(\d+)\s*V?$/);
      if (m) key = m[1] + 'V';
      else if (nvRaw) key = nvRaw;
      else key = '1V'; // fallback
      porNv[key] = (porNv[key] || 0) + 1;
    } else {
      // No fue efectiva → ¿tiene motivo de cierre?
      const mot = String(p.motivo || '').trim().toUpperCase();
      if (!mot) reprogramacionList.push(p);
    }
  }

  // Motivos (contados SOLO entre programados del día)
  let defunciones = 0, rechazaron = 0, cambioDomicilio = 0, domiciliosInc = 0, noLocalizados = 0;
  for (const [, p] of progsHoy) {
    const mot = String(p.motivo || '').trim().toUpperCase();
    if (mot === 'DEFUNCION') defunciones++;
    if (mot === 'NO QUISO EL PROGRAMA') rechazaron++;
    if (mot === 'CAMBIO DE DOMICILIO') cambioDomicilio++;
    if (mot === 'NO SE ENCONTRO A LA PERSONA EN SU DOMICILIO') {
      noLocalizados++;
      domiciliosInc++;
    }
  }

  return {
    day,
    fecha: _reportDateStr(day),
    municipio: municipio ? municipio.toUpperCase() : '',
    facilitador: (STORE.get(STORE.KEY_N) || '').toUpperCase(),
    seccion: seccion || '',
    zona: zona || '',
    efectivas,
    porNv,
    defunciones,
    rechazaron,
    noLocalizados,
    cambioDomicilio,
    domiciliosInc,
    reprogramacion: reprogramacionList.length,
    totalProgramados: progsHoy.length,
  };
}

function _reportIdKey() {
  const u = (STORE.get(STORE.KEY_N) || '').toLowerCase().replace(/\s+/g, '_');
  return u ? ('bRepId_' + u) : 'bRepId_default';
}

function _reportGetId() {
  try { return localStorage.getItem(_reportIdKey()) || ''; } catch { return ''; }
}

function _reportSaveId(id) {
  try {
    if (id != null) localStorage.setItem(_reportIdKey(), String(id));
  } catch {}
}

function _reportNowHHMM() {
  const d = new Date();
  return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0') + ' HRS';
}

async function _reportBuildMsg(cfg, _precomputedAuto) {
  // 🆕 ahora async — acepta `_precomputedAuto` para evitar doble hidratación
  const a = _precomputedAuto || await _reportBuildAuto();
  const c = cfg || {};

  // Líneas por N de visita (ordenadas numéricamente)
  const nvKeys = Object.keys(a.porNv).sort((x, y) => (parseInt(x, 10) || 0) - (parseInt(y, 10) || 0));
  let nvLines = '';
  if (nvKeys.length) {
    nvLines = nvKeys.map(k => {
      const n = parseInt(k, 10) || 1;
      return n + 'ª Visita: ' + a.porNv[k];
    }).join('\n');
  } else {
    nvLines = '1ª Visita: 0\n2ª Visita: 0\n3ª Visita: 0';
  }

  const idLine = c.id ? ('🆔 ID: ' + c.id + '\n') : '';
  const hora = c.hora || '18:00 HRS';

  return (
'PROGRAMA Y OPERATIVO: SALUD CASA POR CASA\n' +
'📅 *Fecha:* ' + a.fecha + '\n' +
'🏘️ *Municipio:* ' + a.municipio + '\n' +
'👤 *Facilitador de la salud:* ' + a.facilitador + '\n' +
idLine +
'📌 *Sección:* ' + a.seccion + '\n' +
'🗺️ *Zona de trabajo:* ' + a.zona + '\n' +
'\n' +
'🕒 *REPORTE* ' + hora + '\n' +
'\n' +
'✅ *Visitas efectivas:* ✅' + a.efectivas + '\n' +
nvLines + '\n' +
'🪦⚰️ Defunciones: ' + a.defunciones + '\n' +
'🙅‍♂️ Personas que rechazaron: ' + a.rechazaron + '\n' +
'🙅🏻‍♂️*No localizados*: ' + a.noLocalizados + '\n' +
'🚨 Inseguridad: ' + (c.inseguridad || 0) + '\n' +
'🚑 Accidentes: ' + (c.accidentes || 0) + '\n' +
'🚌 Problema de transporte: ' + (c.transporte || 0) + '\n' +
'📅 Reprogramación: ' + a.reprogramacion + '\n' +
'🤝 Apoyo a otra zona: ' + (c.apoyo || 0) + '\n' +
'📝 Permisos: ' + (c.permisos || 0) + '\n' +
'💻 Problemas técnicos: ' + (c.tecnicos || 0) + '\n' +
'🏠 *Domicilios incorrectos:* ' + a.domiciliosInc + '\n' +
'🏚️*Cambio de domicilio*: ' + a.cambioDomicilio + '\n' +
'📲 Llamadas al CABI: ' + (c.cabi || 0) +
  ((c.observaciones && String(c.observaciones).trim())
    ? '\n\n📝 Observaciones:\n' + String(c.observaciones).trim()
    : '')
  );
}

async function _reportOpen() {
  // 🆕 mostrar algo mientras se hidrata IDB
  toast('📊 Preparando reporte…', 0, true);
  try {
    const auto = await _reportBuildAuto();
    const defaultId = _reportGetId();
    const defaultHora = '18:00 HRS';

    const initialCfg = {
      id: defaultId,
      hora: defaultHora,
      inseguridad: 0,
      accidentes: 0,
      transporte: 0,
      apoyo: 0,
      permisos: 0,
      tecnicos: 0,
      cabi: 0,
      observaciones: '',
    };

        const initialMsg = await _reportBuildMsg(initialCfg, auto);
    let _msgTouched = false;

  const _inputCss = 'font-size:12.5px;padding:7px 8px;text-align:center';

  openModal(
    '<div class="sheet-head">📱 Reporte WhatsApp<button class="close" data-a="close-modal">✕</button></div>' +
    '<div class="sheet-body">' +

      '<div style="font-size:12.5px;color:var(--muted);margin-bottom:12px;line-height:1.5;padding:8px 10px;background:var(--cream-2);border-radius:var(--r-sm);border:1px solid var(--border)">' +
        '<b style="color:var(--text)">Fecha:</b> ' + esc(auto.fecha) +
        ' · <b style="color:var(--text)">Programados hoy:</b> ' + auto.totalProgramados +
      '</div>' +

      '<div class="dfield" style="margin-bottom:14px">' +
        '<div class="lbl" style="display:flex;align-items:center;gap:6px">' +
          '✏️ Mensaje final (editable) ' +
          '<button type="button" data-a="rep-regen" style="margin-left:auto;padding:3px 10px;font-size:10.5px;border:1.5px solid var(--burgundy);border-radius:999px;background:#fff;color:var(--burgundy);cursor:pointer;font-weight:800">🔄 Regenerar</button>' +
        '</div>' +
        '<textarea id="rep_msg" rows="20" style="font-family:ui-monospace,Menlo,Consolas,monospace;font-size:12.5px;line-height:1.55">' + esc(initialMsg) + '</textarea>' +
      '</div>' +

      '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:10px">' +
        '<div class="dfield"><div class="lbl">🆔 ID</div>' +
          '<input id="rep_id" value="' + esc(defaultId) + '" inputmode="numeric" placeholder="52924" autocomplete="off" style="' + _inputCss + '"></div>' +
        '<div class="dfield"><div class="lbl">🕒 Hora</div>' +
          '<input id="rep_hora" value="' + esc(defaultHora) + '" autocomplete="off" style="' + _inputCss + '"></div>' +
        '<div class="dfield"><div class="lbl">🚨 Inseg.</div>' +
          '<input id="rep_inseguridad" type="number" inputmode="numeric" value="0" style="' + _inputCss + '"></div>' +
        '<div class="dfield"><div class="lbl">🚑 Accident.</div>' +
          '<input id="rep_accidentes" type="number" inputmode="numeric" value="0" style="' + _inputCss + '"></div>' +
      '</div>' +

      '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:10px">' +
        '<div class="dfield"><div class="lbl">🚌 Transp.</div>' +
          '<input id="rep_transporte" type="number" inputmode="numeric" value="0" style="' + _inputCss + '"></div>' +
        '<div class="dfield"><div class="lbl">🤝 Apoyo</div>' +
          '<input id="rep_apoyo" type="number" inputmode="numeric" value="0" style="' + _inputCss + '"></div>' +
        '<div class="dfield"><div class="lbl">📝 Permisos</div>' +
          '<input id="rep_permisos" type="number" inputmode="numeric" value="0" style="' + _inputCss + '"></div>' +
        '<div class="dfield"><div class="lbl">💻 Técnicos</div>' +
          '<input id="rep_tecnicos" type="number" inputmode="numeric" value="0" style="' + _inputCss + '"></div>' +
      '</div>' +

      '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:12px">' +
        '<div class="dfield"><div class="lbl">📲 CABI</div>' +
          '<input id="rep_cabi" type="number" inputmode="numeric" value="0" style="' + _inputCss + '"></div>' +
        '<div></div><div></div><div></div>' +
      '</div>' +

      '<div class="dfield" style="margin-bottom:8px">' +
        '<div class="lbl">📝 Observaciones</div>' +
        '<textarea id="rep_obs" rows="3" placeholder="Escribe observaciones extra…" style="font-size:13px"></textarea>' +
      '</div>' +

    '</div>' +
    '<div class="sheet-foot" style="flex-wrap:nowrap;gap:8px">' +
      '<button class="btn g" data-a="close-modal" style="flex:0 0 auto;min-width:70px">Cancelar</button>' +
      '<button class="btn g" data-a="rep-copy" title="Copiar mensaje" style="flex:0 0 auto;width:48px;min-width:48px;padding:13px 0;background:#fff;color:var(--burgundy);border-color:var(--burgundy)">📋</button>' +
      '<button class="btn p" data-a="rep-send" style="flex:1;min-width:0;background:#25D366;border-color:#25D366">📱 WhatsApp</button>' +
    '</div>',
    true
  );


      const _collectCfg = () => ({
    id: ((document.getElementById('rep_id') || {}).value || '').trim(),
    hora: ((document.getElementById('rep_hora') || {}).value || '').trim() || '18:00 HRS',
    inseguridad: parseInt((document.getElementById('rep_inseguridad') || {}).value || '0', 10) || 0,
    accidentes: parseInt((document.getElementById('rep_accidentes') || {}).value || '0', 10) || 0,
    transporte: parseInt((document.getElementById('rep_transporte') || {}).value || '0', 10) || 0,
    apoyo: parseInt((document.getElementById('rep_apoyo') || {}).value || '0', 10) || 0,
    permisos: parseInt((document.getElementById('rep_permisos') || {}).value || '0', 10) || 0,
    tecnicos: parseInt((document.getElementById('rep_tecnicos') || {}).value || '0', 10) || 0,
    cabi: parseInt((document.getElementById('rep_cabi') || {}).value || '0', 10) || 0,
    observaciones: ((document.getElementById('rep_obs') || {}).value || '').trim(),
  });

  // 🆕 ahora async porque _reportBuildMsg lee de IDB
  const _regenPreview = async () => {
    if (_msgTouched) return;
    const msgEl = document.getElementById('rep_msg');
    if (msgEl) msgEl.value = await _reportBuildMsg(_collectCfg());
  };

  setTimeout(() => {
    const msgEl = document.getElementById('rep_msg');
    if (msgEl) msgEl.addEventListener('input', () => { _msgTouched = true; });

    ['rep_id', 'rep_hora', 'rep_inseguridad', 'rep_accidentes', 'rep_transporte',
     'rep_apoyo', 'rep_permisos', 'rep_tecnicos', 'rep_cabi', 'rep_obs'].forEach(id => {
      const el = document.getElementById(id);
      // 🆕 debounce corto para no regenerar en cada tecla
      if (el) {
        let _t = null;
        el.addEventListener('input', () => {
          clearTimeout(_t);
          _t = setTimeout(() => { _regenPreview().catch(()=>{}); }, 220);
        });
      }
    });
  }, 60);

  ACT['rep-regen'] = async () => {
    _msgTouched = false;
    await _regenPreview();
    toast('✓ Mensaje regenerado');
  };

  ACT['rep-copy'] = async () => {
    const cfg = _collectCfg();
    _reportSaveId(cfg.id);
    // 🆕 Si el usuario NO editó manualmente el textarea → SIEMPRE regenerar.
    //    Solo si editó manualmente respetamos su versión.
    let msg;
    if (_msgTouched) {
      msg = ((document.getElementById('rep_msg') || {}).value || '').trim();
    }
    if (!msg) msg = await _reportBuildMsg(cfg);
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(msg)
        .then(() => toast('✓ Mensaje copiado'))
        .catch(() => toast('No se pudo copiar', 1));
    } else {
      toast('No se pudo copiar', 1);
    }
  };

  ACT['rep-send'] = async () => {
    const cfg = _collectCfg();
    _reportSaveId(cfg.id);
    // 🆕 Mismo criterio: si NO editó manualmente → regenerar con datos frescos
    let msg;
    if (_msgTouched) {
      msg = ((document.getElementById('rep_msg') || {}).value || '').trim();
    }
    if (!msg) msg = await _reportBuildMsg(cfg);
    const url = 'https://wa.me/?text=' + encodeURIComponent(msg);
    try { window.open(url, '_blank', 'noopener'); } catch (e) {}
    closeModal();
    toast('📱 Abriendo WhatsApp…');
  };

    // 🆕 ocultar el toast persistente "Preparando reporte…" sin mostrar uno vacío
    try {
      const _t = document.getElementById('toast');
      if (_t) {
        _t.classList.remove('show');
        clearTimeout(_t._h);
      }
    } catch (e) {}
  } catch (err) {
    
    console.error('[report] error:', err);
    toast('❌ Error al preparar reporte: ' + (err && err.message ? err.message : 'desconocido'), 1);
  }
}
  



  function _generateVisitTexts(p, v) {
  // 1. Extraer datos con normalización para evitar fallos por tipeo
  const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  
  const dep = norm(p.dep);
  const ayuda = norm(p.ayuda);
  const comp = norm(p.comp);
  
  const familiar = String(p.fam || '').trim();
  const nombre = String(p.nombre || '').trim();
  const edad = String(p.edad || _curpEdad(p.curp) || '').trim();
  const sexo = String(p.sexo || _curpSexo(p.curp) || '').trim();
  const tipo = String(p.tipo || '').trim();
  
  const dx = String(p.diag || '').trim();
  const meds = String(p.med || '').trim();
  
  // Textos manuales capturados por el brigadista (¡PRIORIDAD MÁXIMA!)
  const manualInterrogatorio = String(p.enf || '').trim();
  const manualExploracion = String(p.expl || '').trim();
  const manualPlan = String(p.plan || '').trim();
  const manualPronostico = String(p.pron || '').trim();
  const obsVisita = String(v.obs || '').trim();

  // 2. Evaluar Matriz de Complejidad con Normalización
  // 🆕 FIX CRÍTICO: usar comparación EXACTA (no includes) para evitar
  //    que "independiente" matchee por error (contiene "dependiente").
  //    Soportamos ambos valores para compatibilidad con datos legacy.
  //
  // 🆕 FIX PRIORIDAD: el COMPORTAMIENTO (renuente) manda sobre la AYUDA
  //    TÉCNICA (bastón/silla/andadera). Antes, isP3 pisaba a isP2 y siempre
  //    salía "cooperador y receptivo" aunque el combo dijera "renuente".
  const isP4 = (dep === 'dependencia total')
            || (dep === 'dependiente')
            || ayuda.includes('postrado');
  const isP2 = !isP4 && comp.includes('renuente');
  const isP3 = !isP4 && !isP2 && (
                  ayuda.includes('silla') ||
                  ayuda.includes('baston') ||
                  ayuda.includes('andadera') ||
                  ayuda.includes('muleta')
              );

  // --- 3. CONSTRUIR INTERROGATORIO ---
  let encabezado = "";
  if (nombre || edad || sexo) {
    const datosHe = [];
    if (nombre) datosHe.push("Nombre: " + nombre + (tipo ? " - " + tipo : ""));
    if (edad) datosHe.push("Edad: " + edad + " años");
    if (sexo) datosHe.push("Sexo: " + sexo);
    encabezado = "[" + datosHe.join(" | ") + "]\n\n";
  }

  let txtInt = encabezado;
  
  if (manualInterrogatorio) {
    // Si el brigadista escribió, respetamos su texto y agregamos el deslinde
    txtInt += `Paciente valorado en su domicilio dentro del marco de las intervenciones del programa de atención. Al interrogatorio directo/indirecto se recaba la siguiente información:\n\n${manualInterrogatorio}\n\n`;
    if (dx) txtInt += `Diagnósticos de base referidos: ${dx}.\n`;
    if (meds) txtInt += `Tratamiento farmacológico actual: ${meds}.\n\n`;
    
    if (isP2) {
      txtInt += `Deslinde de apego y veracidad: Se establece explícitamente que la veracidad de los antecedentes, apego farmacológico e historial médico no pudieron ser verificados en su totalidad por omisión, renuencia o desconocimiento expreso de las partes. La responsabilidad de lo expresado recae únicamente en el usuario y/o su red de apoyo.`;
    } else {
      txtInt += `Deslinde de apego: Se asienta que la veracidad de los antecedentes patológicos, consumo de medicamentos y hábitos informados dependen exclusivamente de lo expresado de forma verbal por el usuario o su cuidador primario.`;
    }
  } else {
    // Plantillas automáticas
    // 🆕 ORDEN: P4 (encamado) → P2 (renuente) → P3 (ayuda técnica) → P1 (normal)
    if (isP4) {
      txtInt += `Paciente valorado en su domicilio dentro del marco de las intervenciones del programa de atención. Al interrogatorio indirecto: ${familiar ? "(proporcionado por el/la familiar y cuidador(a) primario(a) " + familiar + ") " : "(proporcionado por el cuidador primario presente debido a una limitación en la comunicación/deterioro cognitivo del usuario)."}\n\n`;
      txtInt += `El cuidador refiere que el paciente presenta síndrome de inmovilidad prolongada y dependencia total para las actividades básicas de la vida diaria. Funciones biológicas: apetito disminuido/modificado, patrón de sueño alterado/fragmentado, control de esfínteres alterado (uso de pañal desechable).\n\n`;
      if (dx) txtInt += `Diagnósticos de base referidos: ${dx}.\n`;
      if (meds) txtInt += `Tratamiento farmacológico reportado: ${meds}.\n\n`;
      txtInt += `Deslinde de apego: El cuidador expresa recibir apoyo familiar para los cuidados y administración de medicamentos, manifestando datos de carga del cuidador. Se enfatiza que la veracidad de antecedentes, fechas de diagnóstico y fármacos administrados corresponden únicamente a lo manifestado por el cuidador primario.`;
    
    
 } else if (isP2) {
  txtInt += `Paciente valorado en su domicilio dentro del marco de las intervenciones del programa de atención. Al interrogatorio directo/indirecto, el usuario: ${familiar ? "y/o el/la familiar y cuidador(a) " + familiar + ": " : ": "}\n\n`;
  txtInt += `Se observan renuentes, poco receptivos y evasivos a la entrevista y exploración. Refieren no recordar, desconocer o niegan expresamente fechas de diagnóstico, nombres de medicamentos, dosis o antecedentes patológicos de importancia.\n\n`;
  // 🆕 Mencionar ayuda técnica si la usa (aunque sea renuente)
  if (p.ayuda && !/ninguna/i.test(p.ayuda)) {
    txtInt += `Refiere uso de apoyo técnico para la deambulación: ${p.ayuda}.\n\n`;
  }
  if (dx) txtInt += `Menciona de forma vaga/incompleta antecedentes de: ${dx}.\n`;
  if (meds) txtInt += `Reporta sin certeza consumo de: ${meds}.\n\n`;
  txtInt += `Funciones biológicas (apetito, sueño, diuresis, evacuaciones) referidas como negadas o sin aportar datos fidedignos. Deslinde de apego y veracidad: Se establece explícitamente que la veracidad de los antecedentes, apego farmacológico e historial médico no pudieron ser verificados por omisión, renuencia o desconocimiento expreso de las partes. El usuario y/o red de apoyo manifiestan no contar con carnets, recetas ni reportes médicos impresos para cotejo clínico al momento de la visita. Muestra actitud de suspicacia, apatía y rechazo verbal. Niega síntomas o rechaza verbalizarlos al momento de la entrevista.`;
}
    
    else if (isP3) {
      txtInt += `Paciente valorado en su domicilio dentro del marco de las intervenciones del programa de atención. Al interrogatorio directo/declarativo a la interrogación se observa cooperador y receptivo el usuario${familiar ? ". " + (familiar ? "y/o el/la familiar y cuidador(a) primario(a) " + familiar + " " : "") + ": \"" : ": \""}\n\n`;
      txtInt += `Refiere antecedente de discapacidad motriz/limitación físico-estructural que condiciona el uso de: ${p.ayuda ? p.ayuda + "; " : ""}\n\n`;
      txtInt += `Funciones biológicas: apetito y patrón del sueño conservados; diuresis y evacuaciones intestinales referidas como conservadas/controladas (o con uso de aditamentos).\n\n`;
      if (dx) txtInt += `Diagnósticos de base referidos: ${dx}.\n`;
      if (meds) txtInt += `Esquema farmacológico actual: ${meds}.\n\n`;
      txtInt += `El paciente/cuidador conoce sus diagnósticos de base y esquema farmacológico. Deslinde de apego: Manifiesta contar con red de apoyo familiar presente para la asistencia en las actividades de la vida diaria y acudir a controles médicos. Se asienta que los datos brindados corresponden a lo expresado verbalmente por el usuario y/o cuidador. Adaptado a su grupo etario y capacidad funcional.`;
    } else {
      txtInt += `Paciente valorado en su domicilio dentro del marco de las intervenciones del programa de atención. Al interrogatorio directo/declarativo a la interrogación se observa cooperador y receptivo el usuario${familiar ? ". " + (familiar ? "y/o el/la familiar " + familiar + " " : "") + ": \"" : ": \""}\n\n`;
      txtInt += `Refiere que sus funciones biológicas (apetito, patrón del sueño, diuresis y evacuaciones intestinales) se encuentran conservadas.\n\n`;
      if (dx) txtInt += `Diagnósticos de base informados: ${dx}.\n`;
      if (meds) txtInt += `Tratamiento habitual: ${meds}.\n\n`;
      txtInt += `El paciente manifiesta conocer sus diagnósticos de base y tratamiento habitual. Deslinde de apego: El paciente refiere contar con red de apoyo familiar para su cuidado y manifiesta acudir periódicamente a sus citas de control en su unidad de adscripción. Se asienta que la veracidad de los antecedentes patológicos, consumo de medicamentos y hábitos informados dependen exclusivamente de lo expresado de forma verbal por el usuario. Adaptado a su grupo etario y capacidad funcional actual. Paciente y/o familiar refiere sentirse en condición: Estable.`;
    }
  }

  // --- 4. CONSTRUIR EXPLORACIÓN FÍSICA ---
  const pa = String(v.pa || '').trim();
  const fc = String(v.fc || '').trim();
  const spo2 = String(v.spo2 || '').trim();
  const glu = String(v.glu || '').trim();
  const peso = String(v.peso || '').trim();
  const talla = String(v.talla || '').trim();
  const pant = String(v.pan || '').trim();
  const brazo = String(v.bra || '').trim();
  const abd = String(v.cin || '').trim();
  const temp = String(v.temp || '').trim();
  
  let imc = '';
  if (peso && talla) {
    const w = parseFloat(peso);
    const h = parseFloat(talla) > 3 ? parseFloat(talla)/100 : parseFloat(talla);
    if (w && h) {
      const i = w / (h*h);
      imc = i.toFixed(1) + " (" + (i < 18.5 ? 'Bajo peso' : i < 25 ? 'Normal' : i < 30 ? 'Sobrepeso' : 'Obesidad') + ")";
    }
  }

  let sv = [];
  if (pa) sv.push("PA: " + pa + " mmHg");
  if (fc) sv.push("FC: " + fc + " lpm");
  if (spo2) sv.push("SpO2: " + spo2 + "%");
  if (glu) sv.push("Glucosa: " + glu + " mg/dL");
  if (temp) sv.push("Temp: " + temp + " °C");
  if (peso) sv.push("Peso: " + peso + " kg");
  if (talla) sv.push("Talla: " + talla + " m");
  if (imc) sv.push("IMC: " + imc);
  if (pant) sv.push("Perím. Pantorrilla: " + pant + " cm");
  if (brazo) sv.push("Perím. Brazo: " + brazo + " cm");
  if (abd) sv.push("Perím. Abdominal: " + abd + " cm");

  let bloqueSV = "";
  if (sv.length > 0) bloqueSV = "[SOMATOMETRÍA Y SIGNOS VITALES: " + sv.join(" | ") + "]\n\n";

  let txtExp = bloqueSV;
  
  if (manualExploracion) {
    // Si el brigadista escribió su propia exploración, JAMÁS agregamos el texto predeterminado
    // que podría contradecirlo (ej. "miembros íntegros").
    txtExp += `A la exploración física directa se encuentra lo siguiente:\n\n${manualExploracion}\n\n`;
    
    if (isP2) {
      txtExp += `Nota: Valoración orientada y limitada por la capacidad de cooperación del usuario al momento de la visita (actitud renuente). Se suspende recabación forzada de datos para evitar agitación emocional.`;
    } else {
      txtExp += `Valoración orientada y delimitada estrictamente al grupo etario y grado de movilidad al momento de la visita.`;
    }
  } else {
    // Plantillas automáticas
    // 🆕 ORDEN: P4 → P2 → P3 → P1
    if (isP4) {
      txtExp += `Paciente en su domicilio, en posición decúbito dorsal/lateral en cama, con alteración del estado de alerta / respuesta verbal limitada por su condición de base. Desorientación en tiempo, espacio y persona. Facies de cronicidad / fragilidad / malestar no especificado. Tegumentos con palidez de mucosas, piel adelgazada, turgencia disminuida; se inspeccionan minuciosamente salientes óseas (sacro, talones, trocantéres) observando piel en riesgo por presión. Biotipo y postura anatómica severamente limitados por postración y acortamientos/contracturas articulares. Dinámica ventilatoria espontánea, sin estertores audibles a distancia, sin requerimiento de oxígeno suplementario al momento. Ruidos cardíacos rítmicos pero velados. Abdomen blando. Extremidades hipotróficas, con disminución del tono muscular. Valoración orientada a paciente encamado de riesgo.`;
    
    } else if (isP2) {
  txtExp += `Paciente en domicilio, alerta, con apertura ocular espontánea, con actitud renuente y/o colaboración limitada frente a la exploración física.`;
  // 🆕 Mencionar ayuda técnica si la usa
  if (p.ayuda && !/ninguna/i.test(p.ayuda)) {
    txtExp += ` Se observa uso de dispositivo de apoyo (${p.ayuda}).`;
  }
  txtExp += ` En las tres esferas psicoperceptivas se observa con orientación diferida/no valorable íntegramente por falta de cooperación del usuario. Facies de incomodidad/ansiedad o no característica de proceso patológico agudo evidente a la inspección a distancia. Tegumentos a la inspección general con coloración aparente conservada, sin evidencia a distancia de compromiso hemodinámico agudo o cianosis severa. Exploración segmentaria (tórax, abdomen y extremidades) delimitada y restringida por la negativa o restricción activa del paciente para el contacto físico. Sin evidencia visual a la inspección rápida de dificultad respiratoria severa o sangrado activo. Valoración orientada y limitada estrictamente por la capacidad de cooperación del usuario al momento de la visita. Se suspende recabación forzada de datos para evitar agitación emocional.`;
}
      
    
    else if (isP3) {
      txtExp += `Paciente en domicilio, adaptado a posición, alerta, consciente y orientado en tiempo, espacio y persona. Facies no característica de proceso patológico agudo. Tegumentos con adecuada coloración e hidratación visible; se inspeccionan puntos de presión en zonas de apoyo (isquion, sacro) sin evidencia de lesiones por presión activas o con piel integra. Biotipo constitucional y postura anatómica adaptados a su condición motriz y uso de dispositivo de apoyo (${p.ayuda ? p.ayuda : "asistencia motriz"}). Dinámica ventilatoria espontánea, simétrica, sin signos de dificultad respiratoria. Cabeza, cuello y tórax normolíneos sin alteración aparente; ruidos cardíacos rítmicos y campos pulmonares bien ventilados. Abdomen blando, depresible, no doloroso. Miembros superiores funcionales; miembros pélvicos con restricción de la movilidad activa, alineados a su capacidad motriz. Valoración delimitada a su condición.`;
    } else {
      txtExp += `Paciente en domicilio, alerta, consciente, interactivo y orientado en tiempo, espacio y persona. Facies no característica de proceso patológico agudo. Se observa orientado en las tres esferas psicoperceptivas (Tiempo, Espacio y Persona). A la inspección general, tegumentos con adecuada coloración e hidratación visible, sin signos de deshidratación severa o compromiso agudo. Biotipo constitucional y postura anatómica conservados, con marcha y movilidad ambulatoria autónoma/conservada. Dinámica ventilatoria espontánea, sin signos de dificultad respiratoria ni requerimiento de dispositivos de soporte. Cabeza y cuello morfológicamente íntegros, sin alteración visible. Tórax normolíneo con movimientos respiratorios simétricos; ruidos cardíacos rítmicos; campos pulmonares con murmullo vesicular audible. Abdomen blando, depresible, no doloroso a la palpación superficial, sin datos de abdomen agudo ni visceromegalias aparentes. Miembros pélvicos íntegros, simétricos, sin edema periférico, alineados a su capacidad motriz actual. Valoración orientada y delimitada estrictamente al grupo etario y grado de movilidad al momento de la visita.`;
    }
  }

  if (obsVisita) {
    txtExp += `\n\nHallazgos u observaciones complementarias de la visita: ${obsVisita}`;
  }

  // --- 5. CONSTRUIR PLAN DE CUIDADO ---
  let txtPlan = "";
  if (manualPlan) {
    txtPlan = manualPlan; // Respetar el texto ingresado por el brigadista
  } else {
    // 🆕 ORDEN: P4 → P2 → P3 → P1
    if (isP4) {
      txtPlan += `PLAN Y CUIDADOS: Se capacita exhaustivamente ${familiar ? "al/a la familiar y cuidador(a) primario(a) " + familiar : "al cuidador primario"} en: plan de cambios posturales cada 2 horas, curación/protección de zonas de presión, manejo de la vía oral/sonda e higiene de la piel.\n\n`;
      txtPlan += `AVISO DE RIESGO SOBREVIVIENTE Y DESLINDE LEGAL: Se enfatiza verbalmente y con claridad meridiana al cuidador primario sobre los datos de alarma inmediatos (dificultad respiratoria, fiebre, alteración del estado de conciencia, cianosis, mal olor en heridas). Se deja asentado que por tratarse de una atención de primer nivel, la brigada no sustituye la atención médica hospitalaria. La responsabilidad del monitoreo continuo, el apego al plan de cambios posturales y la movilización inmediata del paciente a una unidad médica ante datos de alarma recae de manera exclusiva en la red de apoyo familiar y cuidador designado, deslindando al personal de enfermería de desenlaces desfavorables propios de la evolución natural de la enfermedad.`;
    } else if (isP2) {
      txtPlan += `PLAN Y CUIDADOS: Pese a la renuencia/limitación, se otorgan recomendaciones verbales generales de promoción de la salud, prevención de riesgos e identificación de datos de alarma.\n\n`;
      txtPlan += `DELIMITACIÓN DE RESPONSABILIDAD Y AVISO DE RIESGO: Se informa explícitamente al paciente ${familiar ? "y a la familia " + familiar : "y/o familiar presente"} sobre la importancia de la revisión médica periódica y los riesgos a la salud derivados de la falta de información clínica, la omisión de tratamientos y el rechazo a la exploración completa. La veracidad de lo expresado y las consecuencias clínicas de la renuencia o negativa de atención son de entera y exclusiva responsabilidad del paciente y/o su red de apoyo familiar, deslindando de cualquier complicación evolutiva al personal de enfermería de la brigada.`;
    } else if (isP3) {
      txtPlan += `PLAN Y CUIDADOS: Intervenciones de enfermería orientadas a la prevención de complicaciones: consejería verbal en higiene postural, técnica de movilización y transferencias, prevención severa de lesiones por presión (movilización/lubricación), cuidado de la piel e hidratación oral.\n\n`;
      txtPlan += `DELIMITACIÓN DE RESPONSABILIDAD: Se concientiza al paciente ${familiar ? "y a su familiar/cuidador(a) " + familiar : "y cuidador primario"} sobre los datos de alarma (zonas de eritema, dolor agudo, signos de infección, alteración respiratoria). La efectividad de la prevención de úlceras y complicaciones circulatorias depende directamente de los cuidados continuos brindados en el hogar por la red de apoyo, deslindando al personal de brigada de eventos sobrevinientes.`;
    } else {
      txtPlan += `PLAN Y CUIDADOS: Se ejecutan intervenciones independientes de enfermería orientadas a la promoción de la salud y prevención primaria. Se proporciona consejería verbal estructurada y sensibilización al paciente sobre: autocuidado, pautas de hidratación, hábitos nutricionales y actividad física.\n\n`;
      txtPlan += `DELIMITACIÓN DE RESPONSABILIDAD: La presente valoración refleja de manera puntual el estado clínico y somatométrico del usuario estrictamente durante la visita domiciliaria. Se orienta de forma clara sobre datos de alarma que ameritan atención médica inmediata. La prevención de complicaciones, el apego farmacológico y la decisión de acudir oportunamente a urgencias ante cualquier cambio clínico posterior es de exclusiva responsabilidad del usuario y su red de apoyo. Se deslinda al personal de brigada de complicaciones derivadas de la omisión de recomendaciones o evolución propia de su patología.`;
    }
  }

  // --- 6. CONSTRUIR PRONÓSTICO ---
  let txtPron = "";
  if (manualPronostico) {
    txtPron = manualPronostico; // Respetar el texto ingresado por el brigadista
  } else {
    // 🆕 ORDEN: P4 → P2 → P3 → P1
    if (isP4) {
      txtPron += `RESERVADO A EVOLUCIÓN Y PRONÓSTICO SOMBRÍO A LARGO PLAZO. Directamente supeditado a la intensidad de los cuidados domiciliarios, prevención estricta de infecciones/úlceras y oportuna intervención médica institucional. Supeditado estrictamente al apego terapéutico, mantenimiento de estilos de vida saludables, autocuidado y seguimiento médico continuo en su unidad de salud correspondiente. Al momento de la visita técnica, no se identifican datos de alarma inmediatos o compromisos hemodinámico agudo evidente a la inspección que sugiera riesgo inminente.`;
    } else if (isP2) {
      txtPron += `RESERVADO A EVOLUCIÓN. Supeditado estrictamente a la disposición del usuario y/o red de apoyo para acudir a valoración médica formal, brindar información clínica fidedigna y apegarse a las recomendaciones de salud. Supeditado estrictamente al apego terapéutico, mantenimiento de estilos de vida saludables, autocuidado y seguimiento médico continuo en su unidad de salud correspondiente. Al momento de la visita técnica, no se identifican datos de alarma inmediatos o compromisos hemodinámico agudo evidente a la inspección que sugiera riesgo inminente.`;
    } else if (isP3) {
      txtPron += `RESERVADO A EVOLUCIÓN Y CAPACIDAD FUNCIONAL. Dependiente de la calidad de los cuidados del cuidador primario, cambios posturales, apego al tratamiento de base y seguimiento médico oportuno. Supeditado estrictamente al apego terapéutico, mantenimiento de estilos de vida saludables, autocuidado y seguimiento médico continuo en su unidad de salud correspondiente. Al momento de la visita técnica, no se identifican datos de alarma inmediatos o compromisos hemodinámico agudo evidente a la inspección que sugiera riesgo inminente.`;
    } else {
      txtPron += `BUENO PARA LA VIDA Y LA FUNCIÓN. Supeditado estrictamente al apego terapéutico, mantenimiento de estilos de vida saludables, autocuidado y seguimiento médico continuo en su unidad de salud correspondiente. Al momento de la visita técnica, no se identifican datos de alarma inmediatos o compromisos hemodinámico agudo evidente a la inspección que sugiera riesgo inminente.`;
    }
  }

  return { interrogatorio: txtInt, exploracion: txtExp, plan: txtPlan, pronostico: txtPron };
}

  

const ACT = {
  scan: () => startBarcodeScan(),
  'reload-page': () => location.reload(),  

   'copy-mza': (t) => {
    const mza = t.dataset.mza || '';
    if (!mza) return;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(mza)
        .then(() => toast('✓ Manzana ' + mza + ' copiada'))
        .catch(() => toast('No se pudo copiar', 1));
    } else {
      toast('Manzana: ' + mza, 0);
    }
  },

  /* 📌 Vuela al centro de la manzana INEGI recién guardada */
  'inegi-pin-manzana': (t) => {
    const id = t.dataset.id;
    const man = id && CAT_MANZANAS[id];
    if (!man || !MAP) { toast('Manzana no encontrada', 1); return; }
    if (!isFinite(+man.lat) || !isFinite(+man.lng)) return;

    MAP.setView([+man.lat, +man.lng], 19, { animate: true });
    toast('🏘️ Manzana ' + (man.manzana || '—'));

    // Cerrar popup actual y abrir el de la manzana (si está en el clúster)
    setTimeout(() => {
      if (!CL_MAN) return;
      let found = null;
      CL_MAN.eachLayer(l => { if (l._catManId === id) found = l; });
      if (found) {
        try { CL_MAN.zoomToShowLayer(found, () => { try { found.openPopup(); } catch(e){} }); }
        catch (e) { try { found.openPopup(); } catch(_){} }
      }
    }, 400);
  },

  /* 🔋 Modo Ahorro: toggle */
  'toggle-saving': () => _setSavingMode(!SAVING_MODE),
          
  'rep-open': () => { _reportOpen().catch(e => { console.error('[rep-open]', e); toast('❌ Error al abrir reporte', 1); }); },
  
  // 🆕 Doble toque sobre una fila de la tabla → mismo flujo que la tarjeta de Home:
  //    • Con GPS        → abre la ficha
  //    • Sin GPS        → modal "¿Estás en el domicilio?"  (askVisitGPS)
  'row-open': (t, e) => {
    const id = t.dataset.id;
    if (!id || !P[id]) return;
    const now = Date.now();
    if (_lastRowTap.id === id && now - _lastRowTap.t < 450) {
      _lastRowTap = { id: '', t: 0 };
      if (navigator.vibrate) navigator.vibrate(15);
      askVisitGPS(id);      // ← MISMA función que usa la tarjeta
    } else {
      _lastRowTap = { id, t: now };
    }
  },

  /* ═══════════════════════════════════════════════════════════
     🏘️ CATASTRO · Handlers de manzanas y casas
     ═══════════════════════════════════════════════════════════ */
  /* ⭐ Toggle ubicaciones enviadas desde ubicacion.html */
  'sent-locations-toggle': async () => {
    SHOW_REMOTE = !SHOW_REMOTE;
    try { localStorage.setItem('bSentLoc', SHOW_REMOTE ? '1' : '0'); } catch {}
    const btn = $('#btnSentLoc');
    if (btn) btn.classList.toggle('on', SHOW_REMOTE);

    if (!MAP) { initMap(); }
    if (SHOW_REMOTE) {
      _drawRemoteMarkers();
      await _fetchRemoteLocations({ force: true, silent: false });
      _drawRemoteMarkers();
      const n = REMOTE_LOCS.size;
      if (n === 0) toast('Aún no hay ubicaciones enviadas', 0);
      else if (navigator.vibrate) navigator.vibrate(15);
    } else {
      _drawRemoteMarkers();
      toast('Ubicaciones ocultas');
    }
  },

  'cat-add-manzana': (t) => {
    if (!MAP) return;
    if (CAT_ADD_MODE === 'manzana-click') {
      // Cancelar modo
      CAT_ADD_MODE = null;
      if (t) t.classList.remove('on');
      toast('Modo cancelado');
    } else {
      CAT_ADD_MODE = 'manzana-click';
      if (t) t.classList.add('on');
      toast('Toca en el mapa donde va la manzana');
    }
  },
    /* 🆕 Guarda la manzana capturada desde el modal INEGI */
  'inegi-save-manzana': async (t) => {
    const lat = +t.dataset.lat;
    const lng = +t.dataset.lng;
    const colonia = ($('#inegiManColonia')||{}).value?.trim() || '';
    const seccion = ($('#inegiManSeccion')||{}).value?.trim() || '';
    const area    = ($('#inegiManArea')   ||{}).value?.trim() || '';
    const manzana = ($('#inegiManNum')    ||{}).value?.trim() || '';

    if (!colonia) { toast('Falta la colonia', 1); return; }
    if (!manzana) { toast('Falta el número de manzana', 1); return; }

    const info = window._inegiPendingInfo;
    if (!info) { toast('Vuelve a tocar el mapa', 1); return; }

    const id = catGenIdManzana(colonia, seccion, area, manzana);
    if (CAT_MANZANAS[id]) {
      toast('Ya existe esa manzana', 1);
      return;
    }

    const now = Date.now();
    CAT_MANZANAS[id] = {
      id, tipo: 'manzana',
      colonia, seccion, area, manzana,
      lat, lng,
      origen: 'INEGI',
      createdAt: now, updatedAt: now,
    };
    catSaveManzanas();
    catSync('cat_save_manzana', CAT_MANZANAS[id]).catch(() => {});

    // 🆕 SIN PERSISTENCIA: NO se guarda en localStorage.
    //    Cada manzana nueva usará Nominatim fresco.

    closeModal();
    toast('✓ Manzana guardada');

    await _inegiAfterManzana({ lat, lng }, info, CAT_MANZANAS[id], true);
    window._inegiPendingInfo = null;
  },
  

  'cat-save-manzana': (t) => {
    _catSaveManzana(+t.dataset.lat, +t.dataset.lng);
  },

  'cat-manzana-edit': (t) => {
    _catOpenManzanaEdit(t.dataset.id);
  },
  'cat-save-manzana-edit': (t) => {
    _catSaveManzanaEdit(t.dataset.id);
  },
  'cat-manzana-del': (t) => {
    _catDeleteManzana(t.dataset.id);
  },

  'cat-manzana-addcasa': (t) => {
    _catOpenCasaModal(t.dataset.id);
  },

'cat-manzana-move': (t) => {
    const manId = t.dataset.id;
    const man = CAT_MANZANAS[manId];
    if (!man) return;

    // 🆕 Preservar ediciones pendientes antes de cerrar
    const preColonia = ($('#catEditManColonia')||{}).value?.trim() || '';
    const preSeccion = ($('#catEditManSeccion')||{}).value?.trim() || '';
    const preArea    = ($('#catEditManArea')   ||{}).value?.trim() || '';
    const preManzana = ($('#catEditManNum')    ||{}).value?.trim() || '';

    closeModal();
    setTimeout(() => {
      _catPickMapForCasa(
        +man.lat, +man.lng, false, man.lat, man.lng,
        (lat, lng) => {
          man.lat = +lat.toFixed(6);
          man.lng = +lng.toFixed(6);
          man.updatedAt = Date.now();
          catSaveManzanas();
          catSync('cat_save_manzana', man).catch(() => {});
          toast('✓ Ubicación de manzana actualizada');
          _catRenderManzanas();
          _catOpenManzanaEdit(manId);
          // 🆕 Restaurar ediciones pendientes
          setTimeout(() => {
            if (preColonia) { const el = document.getElementById('catEditManColonia'); if (el) el.value = preColonia; }
            if (preSeccion) { const el = document.getElementById('catEditManSeccion'); if (el) el.value = preSeccion; }
            if (preArea)    { const el = document.getElementById('catEditManArea');    if (el) el.value = preArea; }
            if (preManzana) { const el = document.getElementById('catEditManNum');     if (el) el.value = preManzana; }
         }, 80);
        },
        man.id, null
      );
    }, 100);
},

  'cat-save-casa': (t) => {
    _catSaveCasa(t.dataset.padre, null, null, 'manzana');
  },

  // Desde el modal de "Nueva casa" — captura GPS y luego guarda
  'cat-casa-new-gps': async (t) => {                    // ✅ async
    const idPadre = t.dataset.id;
    if (!navigator.geolocation) {
      toast('Sin geolocalización — usa el mapa', 1);
      return;
    }
    if (t.disabled) return;
    t.disabled = true;

    const noExtNow = ($('#catCasaNoExt') || {}).value?.trim() || '';
    if (!noExtNow) { toast('Escribe el No.Exterior primero', 1); t.disabled = false; return; }

    toast('Obteniendo GPS…');
    navigator.geolocation.getCurrentPosition(
      async pos => {                                    // ✅ async
        const lat = +pos.coords.latitude.toFixed(6);
        const lng = +pos.coords.longitude.toFixed(6);
        const ok = await _catSaveCasa(idPadre, lat, lng, 'gps');   // ✅ await
        if (!ok) t.disabled = false;                    // ✅ ahora SÍ funciona
      },
      err => {
        toast('GPS: ' + err.message + ' — usa el mapa', 1);
        t.disabled = false;
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
    );
  },

  // Desde el modal de "Nueva casa" — abre mini-mapa y guarda al confirmar
  'cat-casa-new-map': (t) => {
    const idPadre = t.dataset.id;
    const padre = CAT_MANZANAS[idPadre];
    if (!padre) return;

    // 🆕 Capturar NoExt ANTES de cerrar el modal (se pierde al abrir el mapa)
    const noExtNow = ($('#catCasaNoExt') || {}).value?.trim() || '';
    if (!noExtNow) { toast('Escribe el No.Exterior primero', 1); return; }

    const onSave = (lat, lng) => {
      // Reabrir modal, poner NoExt y guardar directo
      _catOpenCasaModal(idPadre);
      setTimeout(() => {
        const inp = document.getElementById('catCasaNoExt');
        if (inp) inp.value = noExtNow;
        if (inp && inp.value.trim()) {
          _catSaveCasa(idPadre, lat, lng, 'map');
        }
      }, 80);
    };
    _catPickMapForCasa(null, null, false, padre.lat, padre.lng, onSave, idPadre, null);
  },

  'cat-casa-edit': (t) => {
    _catOpenCasaEdit(t.dataset.id);
  },
  'cat-save-casa-edit': (t) => {
    _catSaveCasaEdit(t.dataset.id);
  },
'cat-casa-move-mode': (t) => {
    const casaId = t.dataset.id;
    const cas = CAT_CASAS[casaId];
    if (!cas) return;

    // 🆕 Preservar ediciones pendientes
    const preNoExt = ($('#catEditCasaNoExt')||{}).value?.trim() || '';

    closeModal();
    setTimeout(() => {
      _catPickMapForCasa(
        +cas.lat, +cas.lng, false, cas.lat, cas.lng,
        (lat, lng) => {
          cas.lat = +lat.toFixed(6);
          cas.lng = +lng.toFixed(6);
          cas.updatedAt = Date.now();
          catSaveCasas();
          catSync('cat_save_casa', cas).catch(() => {});
          toast('✓ Ubicación de casa actualizada');
          _catRenderCasas();
          _catOpenCasaEdit(casaId);
          // 🆕 Restaurar NoExt si lo había editado
          if (preNoExt) {
            setTimeout(() => {
              const el = document.getElementById('catEditCasaNoExt');
              if (el) el.value = preNoExt;
            }, 80);
          }
        },
        cas.id_padre, casaId   // ← ✅ NUEVO: manzanaId, excludeCasaId
      );
    }, 100);
},
  
  'cat-casa-del': (t) => {
    _catDeleteCasa(t.dataset.id);
  },

  // Abrir ficha del paciente vinculado a una casa
  'cat-casa-open-pac': (t) => {
    const pidDirect = t.dataset.pid;
    if (pidDirect && P[pidDirect]) {
      closeModal();
      setTimeout(() => openP(pidDirect, 0), 120);
      return;
    }
    // Fallback: primer paciente de la casa
    const cas = CAT_CASAS[t.dataset.id];
    if (!cas) return;
    const pids = getCasaPatients(cas);
    if (!pids.length) return;
    closeModal();
    setTimeout(() => openP(pids[0], 0), 120);
  },

  // 🆕 Ir a una casa desde la lista del popup de manzana
  'cat-go-casa': (t) => {
    const casaId = t.dataset.id;
    const cas = CAT_CASAS[casaId];
    if (!cas || !MAP || !CL_CAS) return;

    // 1. Cerrar popup de manzana
    MAP.closePopup();

    // 2. Buscar el marker de la casa
    let found = null;
    CL_CAS.eachLayer(l => { if (l._catCasId === casaId) found = l; });

    const lat = +cas.lat, lng = +cas.lng;

    // 3. Volar a la ubicación con zoom alto (≥ 17 activa el clúster de casas)
    MAP.setView([lat, lng], 19, { animate: true });

    // 4. Esperar que el zoom se aplique y el clúster esté visible,
    //    luego desclusterizar y abrir popup de la casa
    setTimeout(() => {
      if (!found) {
        // Fallback: solo mostrar toast informativo
        toast('Casa No. ' + (cas.noExterior || '—') + ' localizada');
        return;
      }
      try {
        CL_CAS.zoomToShowLayer(found, () => {
          found.openPopup();
        });
      } catch (e) {
        // Si zoomToShowLayer falla (marker huérfano), abrir directo
        try { found.openPopup(); } catch (_) {}
      }
    }, 400);
  },

  // Desvincular TODOS los pacientes de una casa
  'cat-casa-unlink': async (t) => {
    const casaId = t.dataset.id;
    const cas = CAT_CASAS[casaId];
    if (!cas) return;
    const pids = getCasaPatients(cas);
    if (!pids.length) return;
    const ok = await askConfirm(
      `¿Desvincular ${pids.length} paciente${pids.length>1?'s':''} de esta casa?`,
      '🔗 Desvincular'
    );
    if (!ok) return;
    for (const pid of pids) {
      if (P[pid]) P[pid].casa_id = '';
      api('pac_patch', { pid, d: { casa_id: '' } }).catch(() => {});
    }
    cas.pacientes = {};
    if (cas.paciente_id) delete cas.paciente_id;
    cas.updatedAt = Date.now();
    catSaveCasas();
    catSync('cat_save_casa', cas).catch(() => {});
    toast('✓ Casa desvinculada');
    closeModal();
    _catRenderCasas();
  },

  // 🆕 Vincular más pacientes a la casa (abre selector)
  'cat-casa-link-more':    (t) => _catOpenPatientPicker(t.dataset.id),
  'cat-casa-link-patient': (t) => _catOpenPatientPicker(t.dataset.id),
  'cat-casa-pick-patient': async (t) => {
    const casaId = t.dataset.casa;
    const pid = t.dataset.pid;
    if (!casaId || !pid) return;
    await _catPickLink(pid, casaId);
  },

  // 🆕 Desvincular UN paciente específico (desde el popup de la casa)
  'cat-casa-unlink-patient': async (t) => {
    const casaId = t.dataset.id;
    const pid = t.dataset.pid;
    if (!casaId || !pid) return;
    const cas = CAT_CASAS[casaId];
    if (!cas) return;
    const pac = P[pid];
    const ok = await askConfirm(
      `¿Desvincular a "${pac ? pac.nombre : 'el paciente'}" de esta casa?`,
      '🔗 Desvincular'
    );
    if (!ok) return;
    removePatientFromCasa(cas, pid);
    cas.updatedAt = Date.now();
    if (P[pid]) P[pid].casa_id = '';
    catSaveCasas();
    api('pac_patch', { pid, d: { casa_id: '' } }).catch(() => {});
    catSync('cat_save_casa', cas).catch(() => {});
    toast('✓ Paciente desvinculado');
    // Refrescar el popup de la casa si está abierto
    if (MAP && CL_CAS) {
      let found = null;
      CL_CAS.eachLayer(l => { if (l._catCasId === casaId) found = l; });
      if (found) {
        try {
          found.setIcon(makeCasaIcon(cas.noExterior, casaHasPatients(cas)));
          found.setPopupContent(_catCasaPopupHTML(cas));
          found.openPopup();
        } catch(e) {}
      }
    }
    // Refrescar ficha si es el paciente actual
    if (cur === pid && !$('#detail').hidden) {
      setTimeout(() => tab(TAB, true), 100);
    }
  },

  // 🆕 Abrir mini-mapa con ubicación de la casa
  'cat-casa-view-map': (t) => _catViewHouseMap(t.dataset.id),

  // 🆕 Abrir ficha de otro paciente que comparte casa
  'cat-shared-open': (t) => {
    const pid = t.dataset.id;
    if (!pid || !P[pid]) return;
    if (pid === cur) return;
    if (D) {
      askSaveOrDiscard(() => openP(pid, 0), () => openP(pid, 0));
    } else {
      openP(pid, 0);
    }
  },

  /* ═══════════════════════════════════════════════════════════
     🏘️ CATASTRO · Panel de búsqueda + Radio GPS + Vinculación
     ═══════════════════════════════════════════════════════════ */
  'cat-toggle': () => {
    const panel = $('#catPanel');
    const btn = $('#catToggle');
    if (!panel) return;
    if (panel.hidden) {
      panel.hidden = false;
      if (btn) btn.style.display = 'none';
      _catPopulatePanelSelects();
    } else {
      panel.hidden = true;
      if (btn) btn.style.display = '';
    }
  },

  'cat-colonia':  () => _catPopulatePanelSelects(),
  'cat-seccion':  () => _catPopulatePanelSelects(),
  'cat-area':     () => _catPopulatePanelSelects(),
  'cat-manzana':  () => _catPopulatePanelSelects(),
  'cat-noext':    () => _catPopulatePanelSelects(),   // ✅ ahora también cascadea

  'cat-find': () => {
    const col    = ($('#catColonia') ||{}).value?.trim() || '';
    const sec    = ($('#catSeccion') ||{}).value?.trim() || '';
    const area   = ($('#catArea')    ||{}).value?.trim() || '';
    const manzana= ($('#catManzana') ||{}).value?.trim() || '';
    const noExt  = ($('#catNoExt')   ||{}).value?.trim() || '';

    if (!col && !sec && !area && !manzana && !noExt) {
      toast('Elige al menos un filtro', 1);
      return;
    }

    // ── 1) Filtrar MANZANAS por jerarquía (nivel superior) ──
    const manzanasMatch = Object.values(CAT_MANZANAS).filter(m => {
      if (col     && norm(m.colonia) !== norm(col))     return false;
      if (sec     && norm(m.seccion) !== norm(sec))     return false;
      if (area    && norm(m.area)    !== norm(area))    return false;
      if (manzana && norm(m.manzana) !== norm(manzana)) return false;
      return true;
    });

    const closeCatPanel = () => {
      const panel = $('#catPanel'); if (panel) panel.hidden = true;
      const btn = $('#catToggle'); if (btn) btn.style.display = '';
    };

    // ── 2) Si pidió No.Exterior → buscar CASA específica dentro de esas manzanas ──
    if (noExt) {
      if (!manzanasMatch.length) {
        toast('No existe la manzana indicada', 1);
        return;
      }
      const mIds = new Set(manzanasMatch.map(m => m.id));
      const casas = Object.values(CAT_CASAS).filter(c =>
        mIds.has(c.id_padre) && norm(c.noExterior) === norm(noExt)
      );

      if (!casas.length) {
        toast('Sin casa con No. Ext. ' + noExt + ' en esa manzana', 1);
        return;
      }

      closeCatPanel();

      if (casas.length === 1) {
        const c = casas[0];
        if (MAP) {
          MAP.setView([+c.lat, +c.lng], 19, { animate: true });
          setTimeout(() => {
            let found = null;
            CL_CAS.eachLayer(l => { if (l._catCasId === c.id_unico_casa) found = l; });
            if (found) {
              try { CL_CAS.zoomToShowLayer(found, () => { try { found.openPopup(); } catch(e){} }); }
              catch (e) { try { found.openPopup(); } catch(_){} }
            }
          }, 420);
        }
        toast('Casa localizada · No. ' + (c.noExterior || '—'));
        return;
      }

      // Varias casas (raro) → encuadrar todas
      const lats = casas.map(c => +c.lat), lngs = casas.map(c => +c.lng);
      const bounds = L.latLngBounds(
        [Math.min(...lats), Math.min(...lngs)],
        [Math.max(...lats), Math.max(...lngs)]
      );
      if (MAP) MAP.fitBounds(bounds, { padding: [40, 40], maxZoom: 19 });
      toast(casas.length + ' casas encontradas');
      return;
    }

    // ── 3) Sin No.Exterior → navegar a las MANZANAS que coincidan ──
    if (!manzanasMatch.length) {
      toast('Sin manzanas con esos filtros', 1);
      return;
    }

    closeCatPanel();

    if (manzanasMatch.length === 1) {
      const m = manzanasMatch[0];
      if (MAP) {
        MAP.setView([+m.lat, +m.lng], 17, { animate: true });
        setTimeout(() => {
          let found = null;
          if (CL_MAN) CL_MAN.eachLayer(l => { if (l._catManId === m.id) found = l; });
          if (found) {
            try { CL_MAN.zoomToShowLayer(found, () => { try { found.openPopup(); } catch(e){} }); }
            catch (e) { try { found.openPopup(); } catch(_){} }
          }
        }, 420);
      }
      toast('Manzana ' + (m.manzana || '') + ' · ' + (m.colonia || ''));
      return;
    }

    // Varias manzanas → encuadrar todas y asegurar zoom donde se ven
    const lats = manzanasMatch.map(m => +m.lat), lngs = manzanasMatch.map(m => +m.lng);
    const bounds = L.latLngBounds(
      [Math.min(...lats), Math.min(...lngs)],
      [Math.max(...lats), Math.max(...lngs)]
    );
    if (MAP) {
      MAP.fitBounds(bounds, { padding: [50, 50], maxZoom: 17 });
      setTimeout(() => {
        if (MAP.getZoom() < 14) MAP.setZoom(14);
      }, 120);
    }
    toast(manzanasMatch.length + ' manzanas encontradas');
  },

  'cat-clear': () => {
    ['#catColonia','#catSeccion','#catArea','#catManzana'].forEach(s => {
      const el = $(s); if (el) el.value = '';
    });
    const ne = $('#catNoExt'); if (ne) ne.value = '';
    _catPopulatePanelSelects();
    toast('Filtros limpiados');
  },

  // Toggle: Todos los pines ↔ Solo con pacientes
  'cat-toggle-view': () => {
    CAT_MODE = CAT_MODE === 'all' ? 'only-patients' : 'all';
    const btn = $('#catViewBtn');
    if (btn) {
      if (CAT_MODE === 'all') {
        btn.textContent = '👁️ Todos los pines';
        btn.style.background = '';
        btn.style.color = '';
      } else {
        btn.textContent = '👁️ Solo con pacientes';
        btn.style.background = 'var(--burgundy)';
        btn.style.color = '#fff';
      }
    }
    _catRenderCasas();
    toast(CAT_MODE === 'all' ? 'Mostrando todos los pines' : 'Solo casas con pacientes');
  },

  // Cambio de radio GPS
  'cat-radius': (t) => {
    CAT_RADIUS = +t.dataset.r || 100;
    $$('#radioBar .radio-btn').forEach(b =>
      b.classList.toggle('on', +b.dataset.r === CAT_RADIUS)
    );
    _catDrawRadiusCircle();
    _catRenderCasas();
    toast('Radio: ' + CAT_RADIUS + ' m');
  },

  /* ═══════════════════════════════════════════════════════════
     🔗 VINCULACIÓN PACIENTE ↔ CASA (desde ficha del paciente)
     ═══════════════════════════════════════════════════════════ */
  'cat-link-open': (t) => {
    const pid = t.dataset.id || cur;
    if (!pid || !P[pid]) return;
    _catOpenLinkPicker(pid);
  },
  'cat-link-search': (t) => {
    _catDoLinkSearch(t.dataset.id);
  },
  'cat-link-pick': (t) => {
    _catPickLink(t.dataset.id, t.dataset.casa);
  },
  'cat-link-unlink': async (t) => {
    const pid = t.dataset.id || cur;
    if (!pid) return;
    await _catUnlinkPatient(pid);
  },
  
rel: async () => {
  try {
    // Confirmación (es destructivo: borra filtros y re-descarga todo)
    const ok = await askConfirm(
      'Se borrarán filtros, orden de columnas y preferencias locales. ' +
      'Después se descargará la base de datos completa desde el servidor. ¿Continuar?',
      '🔄 Sincronizar todo'
    );
    if (!ok) return;

    // ── 1) Purgar IndexedDB (pacientes viejos + cola de sync) ──
    try {
      const all = await RAW_OFFDB.getPatientsObject();
      for (const id of Object.keys(all)) await RAW_OFFDB.del('patients', id);
    } catch (e) { console.warn('[rel] purge patients', e); }

    try {
      const q = await RAW_OFFDB.getQueue();
      for (const item of q) await RAW_OFFDB.removeFromQueue(item.id);
    } catch (e) { console.warn('[rel] purge queue', e); }

    // ── 2) Borrar SOLO las preferencias (NO credenciales) ──
    try {
      localStorage.removeItem('tblPref');            // columnas/orden tabla
      localStorage.removeItem('bPref');              // filtros FL + búsqueda
      localStorage.removeItem('lastSyncRev');        // revisión de sync
      localStorage.removeItem('lastPacsAt');
      localStorage.removeItem('pacsCache_default');
      localStorage.removeItem('needsFullReload');
      // Contadores de retry de la cola de sync
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const k = localStorage.key(i);
        if (k && k.startsWith('syncRetry_')) localStorage.removeItem(k);
      }
    } catch (e) { console.warn('[rel] purge prefs', e); }

     // ── 3) Resetear estado en MEMORIA (equivalente a "primera vez") ──
    FL = { ch:{}, calle:[], colonia:[], num:[], mz:[], municipio:[],
           loc:'', vis:'', foto:'',
           sortCol:'az', sortCalle:'az', sortNum:'asc' };
    TBL.sorts = [];
    TBL.cols = ['nombre','tipo','colonia','calle','numExt','mz','refs','tel1','tel2'];
    P = {};
    LIST = [];
    LIM = 60;
    cur = '';
    E = 0;
    D = 0;
    TAB = 0;
    VISIT_DRAFT = {};
    PROG_MONTH = new Date();
    PROG_DAY = today();

    // ── 4) Limpiar la UI visible ──
    const qEl = $('#q'); if (qEl) qEl.value = '';
    if (!$('#detail').hidden) $('#detail').hidden = true;
    closeModal();

    // ── 5) Re-descargar TODO desde el servidor ──
    await load('full');

    // ── 6) Volver a Home ──
    setView('list', false);
    window.scrollTo({ top: 0, behavior: 'smooth' });

    toast('✓ Sincronizado · preferencias restablecidas');
  } catch (e) {
    toast(e.message || 'Error al sincronizar', 1);
  }
},


  
  
  flt: () => fltUI(),

    more: () => {
    LIM += 60;
    try { localStorage.setItem('bLim', String(LIM)); } catch {}
    drawCards();
    $('#moreBtn').hidden = LIST.length <= LIM;
  },
  
  'clear-q': () => {
    const el = $('#q');
    if (!el) return;
    el.value = '';
    el.focus();
    clearTimeout(calc._h);
    calc();
  },
  
  open: (t, e) => { e?.preventDefault(); e?.stopPropagation(); closeModal(); askVisitGPS(t.dataset.id); },
  visit: (t, e) => { e?.preventDefault(); e?.stopPropagation(); askVisitGPS(t.dataset.id); },

  
    'ask-save': async (t) => {
    const id = t.dataset.id;
    closeModal();
    openP(id);
    toast('Obteniendo GPS…');

    // Qué hacer al cerrar el mapa de confirmación (guardar o cancelar)
    const finishFlow = () => {
      if (cur !== id) return;
      if (TAB !== 1) { tab(1); }   // mantener tab 1 (Signos vitales)
      setE(true);
    };

    // Abrir el mapa de confirmación con las coordenadas indicadas
    const openConfirmMap = (lat, lng) => {
      if (cur !== id) return;
      _openPickMap(+lat, +lng, true, finishFlow);
    };

    navigator.geolocation.getCurrentPosition(async pos => {
      const d = {
        lat: pos.coords.latitude.toFixed(6),
        lon: pos.coords.longitude.toFixed(6),
        acc: String(Math.round(pos.coords.accuracy))
      };
      try {
        await api('pac_patch', {pid: id, d});
        Object.assign(P[id], d);
        const gi = $('#gi'); if (gi && cur === id) gi.textContent = `${d.lat}, ${d.lon} · ±${d.acc} m`;
              invalidatePacsCache();

        toast('✓ Ubicación capturada. Confirma o ajusta en el mapa.');
        if (VIEW === 'map' && MAP) drawMap();
      } catch (e) { toast('No se pudo guardar la ubicación: ' + e.message, 1); }

      // Abrir mapa para confirmar/editar
      setTimeout(() => openConfirmMap(d.lat, d.lon), 350);
 }, err => {
  toast('GPS: ' + err.message + '. Coloca el marcador manualmente.', 1);
  // Sin GPS, abrir el mapa con posición por defecto para colocar el marcador
  setTimeout(() => openConfirmMap(16.748, -93.180), 350);
}, {enableHighAccuracy:true, timeout:25000, maximumAge:0});
  },
   'ask-skip': (t) => { closeModal(); openP(t.dataset.id, 0); },
  'ask-cancel': () => { closeModal(); },

  
  back: () => { 
  if (D) {
    askSaveOrDiscard(
      () => { history.back(); },
      () => { history.back(); }
    );
    return;
  }
  history.back(); 
},
/* 🏠 Inicio: cierra el detalle y SIEMPRE va a la lista (no importa de dónde vengas) */
'go-home': () => {
  const doHome = () => {
    $('#detail').hidden = true;
    setView('list', false);
    history.replaceState({view: 'list'}, '');
  };
  if (D) {
    askSaveOrDiscard(doHome, doHome);
  } else {
    doHome();
  }
},

  
  edit: () => setE(!E),

  save: async () => {
    
    // 🆕 Guarda con noReopen=true (no reabre el detalle después de guardar)
    const ok = await save(true);
    // 🆕 Si guardó bien → cerrar detalle + history.back() (igual que botón atrás)
    if (ok) closeD();
  },
  
  
  'save-visit': () => saveVisit(),
    'pa-modal': (t) => {
    const cur_val = t.value || '';
    const m = cur_val.match(/^(\d+)\s*\/\s*(\d+)$/);
    const sys = m ? m[1] : '';
    const dia = m ? m[2] : '';
    if (navigator.vibrate) navigator.vibrate(15);
    openModal(`
      <div class="sheet-head">Presión arterial<button class="close" data-a="close-modal">✕</button></div>
      <div class="sheet-body">
        <div style="display:flex;gap:12px;align-items:center;margin:20px 0">
          <div style="flex:1">
            <label style="display:block;font-size:11.5px;font-weight:800;color:var(--muted);text-transform:uppercase;margin-bottom:6px;text-align:center">Sistólica</label>
            <input id="paSys" type="number" inputmode="numeric" value="${sys}" placeholder="120" style="width:100%;padding:16px;font-size:24px;text-align:center;border-radius:12px;border:1.5px solid var(--border);background:#fff;font-weight:800;outline:none">
          </div>
          <div style="font-size:36px;color:var(--muted);padding-top:20px;font-weight:300">/</div>
          <div style="flex:1">
            <label style="display:block;font-size:11.5px;font-weight:800;color:var(--muted);text-transform:uppercase;margin-bottom:6px;text-align:center">Diastólica</label>
            <input id="paDia" type="number" inputmode="numeric" value="${dia}" placeholder="80" style="width:100%;padding:16px;font-size:24px;text-align:center;border-radius:12px;border:1.5px solid var(--border);background:#fff;font-weight:800;outline:none">
          </div>
        </div>
        <div style="font-size:11.5px;color:var(--muted);text-align:center">
          Rango normal: 90–120 / 60–80 mmHg
        </div>
      </div>
      <div class="sheet-foot">
        <button class="btn g" data-a="close-modal" style="flex:1">Cancelar</button>
        <button class="btn p" data-a="pa-save" style="flex:1">✓ Guardar</button>
      </div>
    `, true);
    setTimeout(() => { const el = document.getElementById('paSys'); if (el) el.focus(); }, 150);
  },
  'pa-save': () => {
    const s = (document.getElementById('paSys')||{}).value || '';
    const d = (document.getElementById('paDia')||{}).value || '';
    if (!s || !d) { toast('Completa ambos valores', 1); return; }
    const target = document.querySelector('#dtBody [data-v="pa"]');
    if (target) { target.value = s + '/' + d; D = 1; }
    if (navigator.vibrate) navigator.vibrate(20);
    closeModal();
  },
  'ver-visita': (t) => {
    const vid = t.dataset.vid;
    const v = P[cur] && P[cur].vis && P[cur].vis[vid];
    if (!v) return;
    const visitFotos = photoUrls(v, 'fotos', 'foto');   // ✅ array (nuevo o legacy)
    const rows = [
      ['Fecha', v.fecha],['Estado', v.estado],['Presión arterial', v.pa],
      ['Frec. cardíaca', v.fc],['SpO₂', v.spo2],['Glucosa', v.glu],
      ['Temperatura', v.temp],['Peso (kg)', v.peso],['Talla (m)', v.talla],
      ['Pantorrilla', v.pan],['Brazo', v.bra],['Abdomen', v.cin],
      ['Observaciones', v.obs],
      ['Brigadista', v.por_nombre || v.por || ''],
    ].filter(([k,val]) => isReal(val));
    const btnStyle = 'background:rgba(255,255,255,.15);color:#fff;border:0;width:32px;height:32px;border-radius:10px;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;padding:0';
    openModal(`
      <style>
        .visit-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;padding:14px 16px}
        .visit-cell{background:var(--cream-2);border:1px solid var(--border);border-radius:10px;padding:8px 10px;min-width:0}
        .visit-cell.wide{grid-column:1/-1}
        .visit-cell .vlbl{font-size:9.5px;font-weight:800;color:var(--muted);text-transform:uppercase;letter-spacing:.3px;line-height:1.2}
        .visit-cell .vval{font-size:13.5px;color:var(--text);margin-top:3px;font-weight:700;word-break:break-word;line-height:1.35}
        @media(max-width:380px){
          .visit-grid{gap:6px;padding:12px 10px}
          .visit-cell{padding:6px 8px;border-radius:8px}
          .visit-cell .vlbl{font-size:9px}
          .visit-cell .vval{font-size:12.5px}
        }
      </style>
      <div class="sheet-head">
        <span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">Visita del ${esc(v.fecha||'—')}</span>
        <button data-a="visit-edit" data-vid="${esc(vid)}" title="Editar visita" style="${btnStyle}">${SVG.edit}</button>
        <button data-a="visit-del" data-vid="${esc(vid)}" title="Eliminar visita" style="${btnStyle};background:rgba(239,68,68,.45)">${SVG.trash}</button>
        <button data-a="close-modal" title="Cerrar" style="${btnStyle}">${SVG.close}</button>
      </div>
      <div class="sheet-body" style="padding:0">
        <div class="visit-grid">
          ${rows.map(([k,val]) => `<div class="visit-cell${k==='Observaciones'?' wide':''}">
            <div class="vlbl">${esc(k)}</div>
            <div class="vval">${esc(val)}</div>
          </div>`).join('')}
        </div>
          ${visitFotos.length ? `
          <div style="padding:8px 16px 16px">
            <div class="lbl" style="font-size:11px;color:var(--muted);font-weight:700;letter-spacing:.3px;text-transform:uppercase;margin-bottom:6px">
              Fotos (${visitFotos.length})
            </div>
            <div id="viewVisitPhotosGallery" class="photo-gallery"></div>
          </div>` : ''}
      </div>
      <div class="sheet-foot" style="flex-direction:column;gap:8px">
        <div style="font-size:11px;font-weight:800;color:var(--muted);text-transform:uppercase;letter-spacing:.3px;align-self:flex-start;margin-bottom:-4px">
          Copiar texto clínico
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;width:100%">
          <button class="btn g" data-a="copy-clinical" data-type="int" data-pid="${esc(cur)}" data-vid="${esc(vid)}" style="font-size:12px;padding:10px;justify-content:center;background:#fff;border-color:var(--border-2)"><span style="font-size:14px">📋</span> Interrogatorio</button>
          <button class="btn g" data-a="copy-clinical" data-type="exp" data-pid="${esc(cur)}" data-vid="${esc(vid)}" style="font-size:12px;padding:10px;justify-content:center;background:#fff;border-color:var(--border-2)"><span style="font-size:14px">📋</span> Exploración F.</button>
          <button class="btn g" data-a="copy-clinical" data-type="plan" data-pid="${esc(cur)}" data-vid="${esc(vid)}" style="font-size:12px;padding:10px;justify-content:center;background:#fff;border-color:var(--border-2)"><span style="font-size:14px">📋</span> Plan de Cuidado</button>
          <button class="btn g" data-a="copy-clinical" data-type="pron" data-pid="${esc(cur)}" data-vid="${esc(vid)}" style="font-size:12px;padding:10px;justify-content:center;background:#fff;border-color:var(--border-2)"><span style="font-size:14px">📋</span> Pronóstico</button>
        </div>
        <button class="btn p" data-a="close-modal" style="width:100%">Cerrar</button>
      </div>
    `, true);

    // ✅ Renderizar galería (solo lectura, clickeable para abrir visor)
    if (visitFotos.length) {
      const g = document.getElementById('viewVisitPhotosGallery');
      if (g) renderPhotoGallery(g, visitFotos, {
        editable: false,
        max: 10,
        label: 'VISITA',
        onView: openPhotoViewer,
      });
    }
  },

  'copy-clinical': (t) => {
    const pid = t.dataset.pid;
    const vid = t.dataset.vid;
    const type = t.dataset.type;
    const p = P[pid];
    const v = p && p.vis && p.vis[vid];
    if (!p || !v) { toast('Datos no encontrados', 1); return; }

    const texts = _generateVisitTexts(p, v);
    let textToCopy = '';
    if (type === 'int') textToCopy = texts.interrogatorio;
    if (type === 'exp') textToCopy = texts.exploracion;
    if (type === 'plan') textToCopy = texts.plan;
    if (type === 'pron') textToCopy = texts.pronostico;

    navigator.clipboard.writeText(textToCopy)
      .then(() => toast('✓ Texto copiado al portapapeles'))
      .catch(() => toast('Error al copiar', 1));
  },
  
  'visit-edit': (t) => {
    const vid = t.dataset.vid;
    const v = P[cur] && P[cur].vis && P[cur].vis[vid];
    if (!v) return;
    _pickMapOnFinish = null;
    closeModal();
    setTimeout(() => {
      const btnStyle = 'background:rgba(255,255,255,.15);color:#fff;border:0;width:32px;height:32px;border-radius:10px;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;padding:0';
      // 🆕 Preparar fotos editables
      _visitEditPhotos = [...photoUrls(v, 'fotos', 'foto')];
      openModal(`
        <div class="sheet-head">
          <span style="flex:1">Editar visita</span>
          <button data-a="close-modal" style="${btnStyle}">${SVG.close}</button>
        </div>
        <div class="sheet-body visit-edit-modal">
          <div class="dgrid-2" style="margin-bottom:14px">
            ${F('Fecha', `<input id="ev-fecha" type="date" value="${esc(v.fecha||'')}">`)}
            ${F('Estado', `<select id="ev-estado"><option value="realizada" ${v.estado==='realizada'?'selected':''}>realizada</option><option value="programada" ${v.estado==='programada'?'selected':''}>programada</option></select>`)}
          </div>
          <div class="dgrid-2" style="margin-bottom:14px">
            ${F('Peso (kg)', `<input id="ev-peso" inputmode="decimal" value="${esc(v.peso||'')}">`)}
            ${F('Talla (m)', `<input id="ev-talla" inputmode="decimal" value="${esc(v.talla||'')}">`)}
          </div>
          <div class="dgrid-3" style="margin-bottom:14px">
            ${F('Pantorrilla', `<input id="ev-pan" inputmode="decimal" value="${esc(v.pan||'')}">`)}
            ${F('Brazo', `<input id="ev-bra" inputmode="decimal" value="${esc(v.bra||'')}">`)}
            ${F('Abdomen', `<input id="ev-cin" inputmode="decimal" value="${esc(v.cin||'')}">`)}
          </div>
          <div class="dgrid-3" style="margin-bottom:14px">
            ${F('Presión art.', `<input id="ev-pa" value="${esc(v.pa||'')}" placeholder="120/80">`)}
            ${F('SpO₂', `<input id="ev-spo2" inputmode="decimal" value="${esc(v.spo2||'')}">`)}
            ${F('Frec. cardíaca', `<input id="ev-fc" inputmode="decimal" value="${esc(v.fc||'')}">`)}
          </div>
          <div class="dgrid-3" style="margin-bottom:14px">
            ${F('Glucosa', `<input id="ev-glu" inputmode="decimal" value="${esc(v.glu||'')}">`)}
            ${F('Temp °C', `<input id="ev-temp" inputmode="decimal" value="${esc(v.temp||'')}">`)}
            <div></div>
          </div>
          ${F('Observaciones', `<textarea id="ev-obs" rows="3">${esc(v.obs||'')}</textarea>`, 'wide')}
          <div class="dfield wide" style="margin-top:12px">
            <div class="lbl">Fotos de la visita</div>
            <div id="visitEditPhotosGallery" class="photo-gallery"></div>
          </div>
        </div>
        <div class="sheet-foot">
          <button class="btn g" data-a="close-modal" style="flex:1">Cancelar</button>
          <button class="btn p" data-a="visit-save-edit" data-vid="${esc(vid)}" style="flex:1">Guardar cambios</button>
        </div>
      `, true);

      // 🆕 Init galería con refresh recursivo
      const gal = document.getElementById('visitEditPhotosGallery');
      const refresh = () => {
        renderPhotoGallery(gal, _visitEditPhotos, {
          editable: true,
          max: 10,
          label: 'VISITA',
          onView: openPhotoViewer,
          onAdd: async () => {
            if (_visitEditPhotos.length >= 10) { toast('Máximo 10 fotos', 1); return; }
            const newUrls = await pickAndUploadPhotos(10 - _visitEditPhotos.length);
            if (!newUrls.length) return;
            _visitEditPhotos = [..._visitEditPhotos, ...newUrls];
            refresh();
          },
          onDelete: (url, i) => {
            _visitEditPhotos = _visitEditPhotos.filter((_, j) => j !== i);
            refresh();
            toast(`✓ Foto eliminada · quedan ${_visitEditPhotos.length}`);
          }
        });
      };
      refresh();
    }, 50);
  },
 
  'visit-save-edit': async (t) => {
    const vid = t.dataset.vid;
    const _existingVis = (P[cur] && P[cur].vis && P[cur].vis[vid]) || {};   // 🆕
    const g = id => (document.getElementById('ev-' + id) || {}).value || '';
    const v = {
      fecha: g('fecha'),
      estado: g('estado') || 'realizada',
      peso: g('peso'), talla: g('talla'),
      pan: g('pan'), bra: g('bra'), cin: g('cin'),
      pa: g('pa'), spo2: g('spo2'), fc: g('fc'),
      glu: g('glu'), temp: g('temp'),
      obs: g('obs'),
      // 🆕 Incluir fotos editadas (array + primaria legacy)
      fotos: [..._visitEditPhotos],
      foto: (_visitEditPhotos && _visitEditPhotos[0]) || '',
      // 🆕 Preservar quién creó originalmente la visita (no reatribuir al editor)
      por_nombre: _existingVis.por_nombre || _existingVis.por || STORE.get(STORE.KEY_N) || '',
    };
    // Optimistic
    if (P[cur] && P[cur].vis && P[cur].vis[vid]) {
      P[cur].vis[vid] = { ...P[cur].vis[vid], ...v };
    }
    invalidatePacsCache();
    toast('✓ Visita actualizada');
    closeModal();
    setTimeout(() => tab(2), 60);

    // Background
    api('visit_save', { pid: cur, vid, v })
      .then(r => { if (r && r.offline) toast('📴 Guardado local. Se sincronizará al recuperar señal.', 0); })
      .catch(() => toast('Error al guardar visita', 1));
  },

  'visit-del': async (t) => {
    const vid = t.dataset.vid;
    if (!(await askConfirm('¿Eliminar esta visita? No se puede deshacer.', '🗑 Eliminar visita'))) return;

    // Optimistic: borrar la visita del objeto local
    if (P[cur] && P[cur].vis && P[cur].vis[vid]) {
      delete P[cur].vis[vid];
    }

    // 🆕 Decrementar 1 del valor actual en vez de recalcular desde
    //    Object.keys(P[cur].vis).length.
    //    Motivo: `vis` puede no contener TODAS las visitas reales (paciente
    //    importado, delta incompleto, cache parcial) mientras que
    //    `ultimaVisita` sí tiene el valor histórico correcto.
    //    Recalcular forzaría ultimaVisita a 0 si `vis` estaba vacío.
    const prevNum = parseInt(String(P[cur].ultimaVisita || '0').replace(/\D/g,''), 10) || 0;
    const newNum  = Math.max(0, prevNum - 1);
    P[cur].ultimaVisita = String(newNum);
    P[cur].nv = newNum + 'V';

    invalidatePacsCache();
    toast('✓ Visita eliminada');
    closeModal();
    setTimeout(() => tab(1), 60);

    // Background: borrar la visita + actualizar ultimaVisita/nv en el server
    api('visit_del', { pid: cur, vid })
      .then(r => { if (r && r.offline) toast('📴 Guardado local. Se sincronizará al recuperar señal.', 0); })
      .catch(() => toast('Error al eliminar visita', 1));
    api('pac_patch', { pid: cur, d: { ultimaVisita: String(newNum), nv: newNum + 'V' } })
      .catch(() => {});
  },

  
  
  tab: (t) => { tab(t.dataset.t); },
  
  geo: () => geo(),
  'geo-map': () => pickStart(),

  'gps-paste-apply': async (t) => {
    const inp = document.getElementById('gpsPaste');
    if (!inp) return;
    const raw = (inp.value || '').trim();
    if (!raw) { toast('Pega las coordenadas primero', 1); return; }

    // Acepta: "16.753, -93.115" · "16.753,-93.115" · "16.753 -93.115"
    const m = raw.match(/(-?\d+\.?\d*)\s*[, ]\s*(-?\d+\.?\d*)/);
    if (!m) { toast('Formato inválido. Usa: lat, lon', 1); return; }

    const lat = parseFloat(m[1]);
    const lon = parseFloat(m[2]);
    if (!isFinite(lat) || !isFinite(lon)) { toast('Coordenadas inválidas', 1); return; }
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      toast('Fuera de rango (lat: -90..90, lon: -180..180)', 1);
      return;
    }
    if (!cur || !P[cur]) return;

    try {
      const d = { lat: lat.toFixed(6), lon: lon.toFixed(6), acc: '0' };
      await api('pac_patch', { pid: cur, d });
      Object.assign(P[cur], d);
      invalidatePacsCache();

      // Preservar ediciones pendientes en otros campos (por si las hubiera)
      $$('#dtBody [data-p]').forEach(el => { P[cur][el.dataset.p] = el.value; });

      inp.value = '';
      toast('✓ Ubicación guardada manualmente');
      tab(TAB, true);   // re-render para mostrar "Ver mapa offline"
    } catch (e) {
      toast('Error al guardar: ' + e.message, 1);
    }
  },

  /* 🆕 Ver el mapa del paciente (offline) con punto azul de tu ubicación (GPS on/off) */
  'view-map': (t) => {
    const pid = (t && t.dataset && t.dataset.id) || cur;
    if (!pid || !P[pid] || !P[pid].lat || !P[pid].lon) return;
    const p = P[pid];
    const lat = +p.lat;
    const lon = +p.lon;

    if (navigator.vibrate) navigator.vibrate(15);

    openModal(`
      <div class="sheet-head">📍 Ubicación del paciente<button class="close" data-a="close-modal">✕</button></div>
      <div class="sheet-body" style="padding:0">
        <div id="viewMap" style="height:60vh;width:100%"></div>
        <div style="padding:10px 14px;font-size:12.5px;color:var(--muted);background:#fff;border-top:1px solid var(--border)">
          Coordenadas: <b id="viewCoord" style="color:var(--text);font-family:ui-monospace,monospace">${lat.toFixed(6)}, ${lon.toFixed(6)}</b>
          ${p.acc ? ` · ±${esc(p.acc)} m` : ''}
        </div>
      </div>
      <div class="sheet-foot">
        <a class="btn g" target="_blank" rel="noopener noreferrer" href="https://www.google.com/maps/search/?api=1&query=${String(p.lat).trim()},${String(p.lon).trim()}" style="flex:1;text-decoration:none;justify-content:center">Google Maps</a>
        <button class="btn p" data-a="close-modal" style="flex:1">Cerrar</button>
      </div>
    `, true);

      const __mv = _modalVersion;
    setTimeout(() => {
      if (__mv !== _modalVersion) return;     // 🆕 modal fue reemplazado/cerrado → NO crea mapa ni GPS
      if (_pickMapInstance) return;            // 🆕 doble click
      if (!document.getElementById('viewMap')) return;

      const vm = L.map('viewMap', { zoomControl: true }).setView([lat, lon], 19);
      _pickMapInstance = vm;

      L.tileLayer.offline('https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png?key=cb1_4no0_1_f130c033decf00e3dfc9fbdf', {
        maxZoom: 20,
        maxNativeZoom: 18,
        attribution: '© <a href="https://carto.com/attributions">CARTO</a> © OpenStreetMap'
      }).addTo(vm);

      // Pin del paciente (burgundy)
      L.marker([lat, lon], { icon: makePinIcon() }).addTo(vm);

      setTimeout(() => vm.invalidateSize(), 100);

      // 🆕 Punto azul de TU ubicación (watch → apagado al cerrar el modal)
      if (!navigator.geolocation) return;

      // Por si quedó un watch huérfano
      if (_viewMapUserWatch != null) {
        try { navigator.geolocation.clearWatch(_viewMapUserWatch); } catch(e){}
        _viewMapUserWatch = null;
      }
      _viewMapUserLayer = null;

      const buildUserLayer = (uLat, uLng, uAcc) => {
        if (_viewMapUserLayer && vm.hasLayer(_viewMapUserLayer)) {
          try { vm.removeLayer(_viewMapUserLayer); } catch(e){}
        }
        const circle = L.circle([uLat, uLng], {
          radius: Math.max(15, uAcc || 20),
          color: '#1e88e5', fillColor: '#1e88e5',
          fillOpacity: 0.15, weight: 1, interactive: false
        });
        const dot = L.circleMarker([uLat, uLng], {
          radius: 8, color: '#fff', weight: 3,
          fillColor: '#1e88e5', fillOpacity: 1
        }).bindPopup('📍 Tu ubicación actual');
        _viewMapUserLayer = L.layerGroup([circle, dot]).addTo(vm);
        _viewMapUserLayer._dot = dot;
        _viewMapUserLayer._circle = circle;
      };

      _viewMapUserWatch = navigator.geolocation.watchPosition(
        (pos) => {
          // Si el modal ya se cerró o cambió, no hacer nada
          if (!_pickMapInstance || _pickMapInstance !== vm) return;
          const uLat = pos.coords.latitude;
          const uLng = pos.coords.longitude;
          const uAcc = pos.coords.accuracy;
          if (_viewMapUserLayer && _viewMapUserLayer._dot && _viewMapUserLayer._circle) {
            _viewMapUserLayer._dot.setLatLng([uLat, uLng]);
            _viewMapUserLayer._circle.setLatLng([uLat, uLng]);
            _viewMapUserLayer._circle.setRadius(Math.max(15, uAcc || 20));
          } else {
            buildUserLayer(uLat, uLng, uAcc);
          }
        },
        (err) => { console.warn('[view-map] GPS:', err); },
        { enableHighAccuracy: true, timeout: 20000, maximumAge: 5000 }
      );
    }, 60);
  },

  
  'geo-del': async () => {
    if (!cur) return;
    if (!(await askConfirm('¿Eliminar la ubicación GPS de este paciente?', '🗑 Eliminar ubicación'))) return;
    // Preservar ediciones actuales (por si estaba en modo edición)
    if (E && P[cur]) {
      $$('#dtBody [data-p]').forEach(e => { P[cur][e.dataset.p] = e.value; });
    }
    try {
      await api('pac_patch', {pid: cur, d: {lat: '', lon: '', acc: ''}});
      P[cur].lat = ''; P[cur].lon = ''; P[cur].acc = '';
            invalidatePacsCache();

      toast('✓ Ubicación eliminada');
      const wasEditing = E;
      tab(TAB, true);
      if (wasEditing) setE(true);
      if (VIEW === 'map' && MAP) drawMap();
    } catch (e) { toast(e.message, 1); }
  },
  'tab-prev': () => { const n = Math.max(0, TAB - 1); if (D) D = 0; tab(n); },
  'tab-next': () => { const n = Math.min(3, TAB + 1); if (D) D = 0; tab(n); },

  
  tel: (t) => telUI(t.dataset.n, t.dataset.pid || cur),

  
  'tel-shared': async (t, e) => {
    e?.preventDefault(); e?.stopPropagation();
    const id = t.dataset.id;
    if (!id || !P[id]) return;
    if (id === cur && !$('#detail').hidden) return; // ya está abierto

    // 🆕 Guardar estado del modal "Programar visita" si estaba abierto
    const wasProgModal = !!document.getElementById('progFecha');
    let savedProg = null;
    if (wasProgModal && _progModalId) {
      savedProg = {
        id: _progModalId,
        fecha: (document.getElementById('progFecha')||{}).value || '',
        hora:  (document.getElementById('progHora')||{}).value  || '',
        notas: (document.getElementById('progNotas')||{}).value || ''
      };
    }

       // 🆕 Guardar callback previo (de prog-tel) para restaurarlo en Cancelar
    const prevPickMapCallback = _pickMapOnFinish;
    // 🆕 Desactivar _pickMapOnFinish durante askConfirm para evitar
    // reabrir progModal viejo (bug: modal viejo aparecía encima del nuevo)
    _pickMapOnFinish = null;

    // 🆕 Preguntar al usuario antes de abrir la otra ficha
    const targetName = String(P[id].nombre || '').trim().slice(0, 80) || 'esta persona';
    const ok = await askConfirm(
      `¿Abrir la ficha de ${targetName}? Tiene el mismo número de teléfono.`,
      '📞 Mismo teléfono'
    );

// DESPUÉS
if (!ok) {
  if (savedProg) {
    if (P[savedProg.id]) {
      progModal(savedProg.id, { fecha: savedProg.fecha, hora: savedProg.hora, notas: savedProg.notas });
    } else {
      toast('Paciente ya no existe', 1);
    }
  } else if (prevPickMapCallback) {
    prevPickMapCallback();
  }
  return;
}

    // Confirmó: si hay cambios pendientes, GUARDARLOS antes de cambiar
    if (D && cur && P[cur] && !$('#detail').hidden) {
      try {
        $$('#dtBody [data-p]').forEach(el => { P[cur][el.dataset.p] = el.value; });
        const okSave = await save(true);
        if (!okSave) { toast('No se pudo guardar; cambios pendientes', 1); return; }
      } catch(_) { toast('Error al guardar; abortando cambio', 1); return; }
    } else if (cur && P[cur] && !$('#detail').hidden) {
      // Sin cambios pendientes: solo reflejar DOM → P (no-op si no editaste)
      try { $$('#dtBody [data-p]').forEach(el => { P[cur][el.dataset.p] = el.value; }); } catch(_) {}
    }
    closeModal();
    setTimeout(() => openP(id, 0), 80);
  },

  
  'copy-tel': (t) => {

    
    navigator.clipboard?.writeText(t.dataset.n).then(() => toast('Número copiado')).catch(() => toast('No se pudo copiar', 1));
  },

  'add-contact': (t) => {
    const pid = t.dataset.pid || cur;
    const num = t.dataset.n || '';
    if (!pid || !P[pid]) { toast('Paciente no disponible', 1); return; }
    if (navigator.vibrate) navigator.vibrate(30);
    _addToContacts(pid, num);
  },
  
  'scan-pick': (t) => {
    const id = t.dataset.id;
    if (!id || !P[id]) { closeModal(); return; }
    closeModal();
    const p = P[id];
    toast('✓ ' + (p.nombre || 'Paciente') + ' · Folio ' + (p.folio || ''));
    setTimeout(() => {
      if (!p.lat && !p.lon && navigator.geolocation) askVisitGPS(id);
      else openP(id, 0);
    }, 220);
  },
  'scan-pick-cancel': () => { closeModal(); },
  'stop': () => {},

                 fc: (t) => {
    const k = t.dataset.k, v = t.dataset.v;
    const a = FL.ch[k] = FL.ch[k] || [];
    const i = a.indexOf(v);
    if (i >= 0) a.splice(i, 1); else a.push(v);
    t.classList.toggle('on');
    calc();
    fltUI();
  },
  'fc-clear': (t) => {
    const k = t.dataset.k;
    FL.ch[k] = [];
    calc();
    fltUI();
  },
  fmunicipio: (t) => {
    const v = t.dataset.v;
    FL.municipio = FL.municipio || [];
    const i = FL.municipio.indexOf(v);
    if (i >= 0) FL.municipio.splice(i, 1); else FL.municipio.push(v);
    // Al cambiar municipio, limpiar colonia/calle/num/mz (jerarquía geográfica)
    FL.colonia = [];
    FL.calle = [];
    FL.num = [];
    FL.mz = [];
    calc();
    fltUI();
  },
  'fmunicipio-clear': () => {
    FL.municipio = [];
    FL.colonia = [];
    FL.calle = [];
    FL.num = [];
    FL.mz = [];
    calc();
    fltUI();
  },
  fcol: (t) => {
    const v = t.dataset.v;
    const i = FL.colonia.indexOf(v);
    if (i >= 0) FL.colonia.splice(i, 1); else FL.colonia.push(v);
    // Al cambiar colonias, limpiar calles, números y manzanas que ya no apliquen
    FL.calle = [];
    FL.num = [];
    FL.mz = [];
    calc();
    fltUI();
  },
  fcal: (t) => {
    const v = t.dataset.v;
    const i = FL.calle.indexOf(v);
    if (i >= 0) FL.calle.splice(i, 1); else FL.calle.push(v);
    FL.num = [];
    calc();
    fltUI();
  },
  fmz: (t) => {
    const v = t.dataset.v;
    const i = FL.mz.indexOf(v);
    if (i >= 0) FL.mz.splice(i, 1); else FL.mz.push(v);
    // Al cambiar manzanas, limpiar calles y números que ya no apliquen
    FL.calle = [];
    FL.num = [];
    calc();
    fltUI();
  },
  'fmz-clear': () => {
    FL.mz = []; FL.calle = []; FL.num = [];
    calc();
    fltUI();
  },
  'fnum-chip': (t) => {
    const v = t.dataset.v;
    const i = FL.num.indexOf(v);
    if (i >= 0) FL.num.splice(i, 1); else FL.num.push(v);
    calc();
    fltUI();
  },

  
   fsort: (t) => {
    const k = t.dataset.k;
    const m = t.dataset.m;
    if (k === 'sortNum') {
      FL.sortNum = FL.sortNum === 'desc' ? 'asc' : 'desc';
    } else if (m === 'a') {
      FL[k] = FL[k] === 'az' ? 'za' : 'az';
    } else {
      FL[k] = FL[k] === 'numAsc' ? 'numDesc' : 'numAsc';
    }
    fltUI();
    savePr();
  },

  
  'fcol-clear': () => {
    FL.colonia = []; FL.calle = []; FL.num = []; FL.mz = [];
    calc();
    fltUI();
  },
  'fcal-clear': () => {
    FL.calle = []; FL.num = [];
    calc();
    fltUI();
  },
  'fnum-clear': () => {
    FL.num = [];
    calc();
    fltUI();
  },
  fseg: (t) => {
    const k = t.dataset.k, v = t.dataset.v;
    FL[k] = v;
    const seg = t.parentElement;
    seg.querySelectorAll('button').forEach(b => b.classList.toggle('on', b === t));
    calc();
    fltUI();   // ✅ refresca contadores de Colonia/Calle/Manzana
  },
  
 fclr: () => {
    FL = { ch:{}, calle:[], colonia:[], num:[], mz:[], municipio:[], loc:'', vis:'', foto:'', sortCol:'az', sortCalle:'az', sortNum:'asc' };
    // 🆕 También limpiar el campo de búsqueda
    const q = $('#q');
    if (q) { q.value = ''; }
    calc();
    fltUI();
  },
  
  /* 🆕 Cierra filtro, regresa a Home (vista lista) y hace scroll al tope.
     setView('list', false) internamente llama a calc(), así que la lista
     se re-renderiza con los nuevos filtros aplicados sin empujar history. */
  fapply: () => {
    closeModal();
    setView('list', false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  },
  
    'tbl-sort': (t) => {
    const k = t.dataset.k;
    const idx = TBL.sorts.findIndex(s => s.k === k);
    if (idx < 0) {
      // No está ordenada → la agregamos al final con modo ascendente
      TBL.sorts.push({ k, mode: 'asc' });
    } else {
      const cur = TBL.sorts[idx].mode;
      if (cur === 'asc')       TBL.sorts[idx].mode = 'desc';   // ↑ → ↓
      else if (cur === 'desc') TBL.sorts[idx].mode = 'freq';   // ↓ → ★
      else                     TBL.sorts.splice(idx, 1);       // ★ → sin orden
    }
    saveTBL();
    if (navigator.vibrate) navigator.vibrate(10);
    renderTbl();
  },

  
  'tbl-cols': () => tblColsUI(),

  
    'tbl-col-toggle': (t) => {
    const k = t.dataset.k;
    // 🆕 Ya no leemos t.checked (no hay checkbox). Alternamos por estado.
    if (TBL.cols.includes(k)) {
      TBL.cols = TBL.cols.filter(x => x !== k);
    } else {
      TBL.cols.push(k);
    }
    // 🆕 Actualizar el "chk" visual de la fila tocada (sin re-render del modal)
    const chk = t.querySelector('.chk');
    if (chk) chk.classList.toggle('on', TBL.cols.includes(k));
    saveTBL();
    renderTbl();
  },

    'tbl-col-all':  () => { TBL.cols = TBL_COLS.map(c => c.k); saveTBL(); tblColsUI(); renderTbl(); },
  'tbl-col-none': () => { TBL.cols = [];                       saveTBL(); tblColsUI(); renderTbl(); },

  'tbl-reset': () => {
    TBL.sorts = [];
    saveTBL();
    if (navigator.vibrate) navigator.vibrate(10);
    renderTbl();
    toast('✓ Órdenes eliminados · orden A-Z por nombre');
  },

  /* 🆕 Cargar siguientes 500 filas en la tabla */
  'tbl-more': () => {
    if (TABLE_LIMIT >= TABLE_MAX) {
      toast(`⚠️ Máximo ${TABLE_MAX} filas visibles. Usa búsqueda o filtros para acotar.`, 1);
      return;
    }
    const prevLimit = TABLE_LIMIT;
    TABLE_LIMIT = Math.min(TABLE_LIMIT + 500, TABLE_MAX);

    // Conservar scroll al re-render
    const sc = $('#tblScroll');
    if (sc) sc._keepScroll = true;

    renderTbl();

    // Aviso de rendimiento al pasar de 3000 (una sola vez)
    if (prevLimit === 3000 && TABLE_LIMIT === 3500) {
      toast(`⚠️ ${TABLE_LIMIT} filas visibles · el scroll puede ir lento en celulares`, 1);
    }

    // Auto-scroll a la primera fila nueva (CENTRADA, no oculta bajo sticky header)
    requestAnimationFrame(() => {
      const tblEl = document.getElementById('tblMain');
      if (!tblEl) return;
      const rows = tblEl.querySelectorAll('tbody tr');
      const firstNew = rows[prevLimit];
      if (firstNew && firstNew.scrollIntoView) {
        firstNew.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }
    });
  },
  
  vw: (t) => setView(t.dataset.v),
  
   nav: (t) => {
    const v = t.dataset.v;
    if (v === 'home') {
      const wasHome = (VIEW === 'list');          // 🆕 capturar ANTES de setView
      setView('list');
      if (wasHome) window.scrollTo({ top: 0, behavior: 'smooth' });  // 🆕 solo si ya estaba en Inicio
    }
    else if (v === 'table') setView('table');
    else if (v === 'filter') fltUI();
    else if (v === 'map') setView('map');
    else if (v === 'prog') setView('prog');
  },
  

    out: () => {
    askConfirm('¿Cerrar sesión?', '👋 Cerrar sesión')
      .then(ok => { if (ok) logout(); })
      .catch(() => {});
  },
  
    pick: () => pickStart(),
  myloc: () => toggleMyLocation(),
  'pick-close': () => { if (_pickMapInstance) { try { _pickMapInstance.remove(); } catch(e){} _pickMapInstance = null; } PICK = null; closeModal(); },
  
'pick-save-m': async () => {
  // ✅ Preferir la posición real del marker
  let lat = PICK && PICK.lat, lng = PICK && PICK.lng;
  if (PICK && PICK.marker) {
    const ll = PICK.marker.getLatLng();
    lat = ll.lat; lng = ll.lng;
  }
  if (lat == null) { toast('Toca el mapa primero', 1); return; }
  const d = {
    lat: (+lat).toFixed(6),
    lon: (+lng).toFixed(6),
    acc: (P[cur] && P[cur].acc) ? String(P[cur].acc) : '0'
  };
  
    try {
      await api('pac_patch', {pid: cur, d});
      Object.assign(P[cur], d);
      const gi = $('#gi'); if (gi) gi.textContent = `${d.lat}, ${d.lon} · manual`;
            invalidatePacsCache();

       toast('✓ Ubicación guardada');
      if (_pickMapInstance) { try { _pickMapInstance.remove(); } catch(e){} _pickMapInstance = null; }
           PICK = null;
      closeModal();
      if (VIEW === 'map' && MAP) drawMap();
    } catch (e) { toast(e.message, 1); }
  },
  fit: () => {
    if (!MAP || !CL) return;
    const lls = [];
    LIST.forEach(id => { const p = P[id]; if (+p.lat) lls.push([+p.lat, +p.lon]); });
    if (lls.length) MAP.fitBounds(lls, {padding:[36,36]});
    else toast('Sin ubicaciones');
  },
  layer: () => {
    if (!MAP) return;
    if (!LAYERS.streets || !LAYERS.minimal || !LAYERS.sat) return;

    // 🆕 Ciclo de 3 estilos: Calles → Solo calles → Satélite → Calles…
    const cycle = [LAYERS.streets, LAYERS.minimal, LAYERS.sat];
    const names = ['Calles', 'Solo calles', 'Satélite'];

    // Detectar cuál está activo
    let idx = cycle.findIndex(l => MAP.hasLayer(l));
    if (idx < 0) idx = 0;

    // Quitar el actual
    MAP.removeLayer(cycle[idx]);

    // Activar el siguiente
    const nextIdx = (idx + 1) % cycle.length;
    cycle[nextIdx].addTo(MAP);
    toast(names[nextIdx]);
  },
  // 🆕 Evento para el botón del INEGI
  'toggle-inegi': () => _toggleInegiMap(),
  
'ovl-close': () => closeModal(),
'close-modal': () => closeModal(),
'vib': () => { if (navigator.vibrate) navigator.vibrate(30); },
  up: () => {},

  /* ---------- Programación ---------- */
  'prog-prev': () => {
    PROG_MONTH = new Date(PROG_MONTH.getFullYear(), PROG_MONTH.getMonth() - 1, 1);
    PROG_DAY = `${PROG_MONTH.getFullYear()}-${String(PROG_MONTH.getMonth()+1).padStart(2,'0')}-01`;
    renderProgCal();
    drawProgCards();
  },
  'prog-next': () => {
    PROG_MONTH = new Date(PROG_MONTH.getFullYear(), PROG_MONTH.getMonth() + 1, 1);
    PROG_DAY = `${PROG_MONTH.getFullYear()}-${String(PROG_MONTH.getMonth()+1).padStart(2,'0')}-01`;
    renderProgCal();
    drawProgCards();
  },
  'prog-day': (t) => {
    PROG_DAY = t.dataset.d;
    renderProgCal();
    drawProgCards();
  },
  'prog-tel': (t) => {
  const n = t.dataset.n;
  const id = t.dataset.id;
  const clean = String(n).replace(/\D/g,'');
  if (clean.length < 7) { toast('Número inválido', 1); return; }
  // Guardar estado actual del formulario
  const fecha = (document.getElementById('progFecha')||{}).value || '';
  const hora  = (document.getElementById('progHora')||{}).value  || '';
  const notas = (document.getElementById('progNotas')||{}).value || '';
  // Reabrir el modal de programación al cerrar el de teléfono
  _pickMapOnFinish = () => progModal(id, {fecha, hora, notas});
  telUI(n, id);   // ← ahora pasa el pid
  },
  'prog-new': (t, e) => { e?.preventDefault(); e?.stopPropagation(); progModal(t.dataset.id); },
  'prog-edit': (t, e) => { e?.preventDefault(); e?.stopPropagation(); progModal(t.dataset.id); },
  'prog-save': (t) => { saveProg(t.dataset.id); },
  'prog-remove': (t) => { removeProg(t.dataset.id); },
  'prog-quick': (t) => {
    const f = document.getElementById('progFecha');
    if (f) f.value = t.dataset.d;
    // 🆕 Marcar SOLO este chip como activo (los demás se apagan)
    document.querySelectorAll('[data-a="prog-quick"]').forEach(c =>
      c.classList.toggle('on', c === t)
    );
    if (navigator.vibrate) navigator.vibrate(10);
  },
  'prog-quick-hour': (t) => {
    const f = document.getElementById('progHora');
    if (f) f.value = t.dataset.h;
    // 🆕 Marcar SOLO este chip como activo
    document.querySelectorAll('[data-a="prog-quick-hour"]').forEach(c =>
      c.classList.toggle('on', c === t)
    );
    if (navigator.vibrate) navigator.vibrate(10);
  },

  /* 🎂 Toggle de cumpleaños en el calendario */
  'toggle-bdays': () => {
    SHOW_BIRTHDAYS = !SHOW_BIRTHDAYS;
    renderProgCal();
    if (navigator.vibrate) navigator.vibrate(15);
    toast(SHOW_BIRTHDAYS ? '🎂 Cumpleaños activados' : 'Cumpleaños desactivados');
  },

  /* 🎂 Abrir tarjeta del paciente al tocar la lista de cumpleaños.
     Reutiliza askVisitGPS (misma función que las tarjetas de Home). */
  'bday-open': (t) => {
    const id = t.dataset.id;
    if (!id || !P[id]) { toast('Paciente no disponible', 1); return; }
    closeModal();
    askVisitGPS(id);
  },
};

document.addEventListener('click', e => {
  const t = e.target.closest('[data-a]');
  if (!t) return;
  if (t.tagName === 'INPUT' && t.type !== 'checkbox' && !t.readOnly) return;
  if (t.tagName === 'SELECT' || t.tagName === 'TEXTAREA') return;
  const f = ACT[t.dataset.a];
  if (f) { e.stopPropagation(); f(t, e); }
}, true);
document.addEventListener('change', e => {
  const t = e.target, a = t.dataset.a;

  // 🆕 Sincronización bidireccional Motivo (tab 0) ↔ Estado (tab 1)
  //    Motivo → Estado: al cambiar motivo en tab 0, actualizamos VISIT_DRAFT.estado
  //                     y el select de estado si está en el DOM.
  if (t.matches && t.matches('select[data-p="motivo"]')) {
    const v = String(t.value || '').trim();
    VISIT_DRAFT.estado = v;
    const selEst = document.querySelector('#dtBody [data-v="estado"]');
    if (selEst && selEst !== t) selEst.value = v;
  }
  //    Estado → Motivo: al cambiar estado en tab 1, actualizamos el motivo
  //                     del paciente y el select de motivo si está en el DOM.
  if (t.matches && t.matches('select[data-v="estado"]')) {
    const v = String(t.value || '').trim();
    if (cur && P[cur]) {
      P[cur].motivo = v;
      D = 1;
    }
    const selMot = document.querySelector('#dtBody [data-p="motivo"]');
    if (selMot && selMot !== t) selMot.value = v;
  }

  if (!a) return;
  if (a === 'up') { up(t); return; }
  // 🆕 Los <select> de cascada del catastro necesitan handler en 'change'
  if (a === 'cat-colonia' || a === 'cat-seccion' || a === 'cat-area' || a === 'cat-manzana' || a === 'cat-noext') {
    const f = ACT[a];
    if (f) f(t, e);
  }
});
  
document.addEventListener('input', e => {
  const t = e.target;
  if (t.closest('#dtBody')) {
    D = 1;
    if (t.matches('[data-v=peso],[data-v=talla]')) imc();
    if (t.matches('[data-p=municipio],[data-p=colonia]')) {
      // ✅ NO mutar P — pasar el valor vivo a la función
      updateGeoDatalists(t.dataset.p, t.value);
    }
  }
});

  
let _blockPop = false;
addEventListener('popstate', (event) => {
  const state = event.state;

  // 1) Cambios pendientes en el detalle → modal guardar/descartar
  if (D && !_blockPop) {
    _blockPop = true;
    history.pushState({d:1}, '');
    setTimeout(() => { _blockPop = false; }, 100);
    askSaveOrDiscard(
      () => { _blockPop = false; history.back(); },
      () => { _blockPop = false; history.back(); }
    );
    return;
  }

  closeModal();

  // 2) Detalle abierto → cerrarlo y restaurar la vista del state
  if (!$('#detail').hidden) {
    closeD();
    if (state && state.view && state.view !== VIEW) {
      setView(state.view, false);
    }
    return;
  }

  // 3) Navegación entre vistas (Home / Tabla / Programados / Mapa)
  if (state && state.view) {
    if (state.view !== VIEW) {
      setView(state.view, false);
    }
    return;
  }

  // 4) state === null → el usuario está en Home y presiona Atrás → sale de la PWA
  //    (comportamiento nativo del navegador, no hacemos nada)
});

  
async function _boot() {
  // 🆕 Restaurar SOLO la preferencia del toggle ⭐.
  try {
    SHOW_REMOTE = localStorage.getItem('bSentLoc') === '1';
  } catch (e) {}

  try { _syncSavingBtn(); } catch (e) {}
  
  const t = STORE.get(STORE.KEY_T);
  const hasPw = !!STORE.get(STORE.KEY_PW);
  const hasMK = !!STORE.get('bSaltMK');

  const hasToken = t && (t.t || t._enc);
  if (!hasToken) {
    $('#login').hidden = false;
    $('#lu').focus();
    if (sessionStorage.getItem('bNuke')) {
      sessionStorage.removeItem('bNuke');
      setTimeout(() => toast('🔒 Sesión cerrada por seguridad. Inicia sesión con internet.', 1), 400);
    }
    return;
  }

  if (_clockTampered()) {
    try { STORE.del(STORE.KEY_T); } catch {}
    const loginDiv = document.getElementById('login');
    if (loginDiv) loginDiv.hidden = false;
    try { $('#lu').focus(); } catch {}
    toast('🕐 Cambio en la fecha/hora detectado. Inicia sesión con internet.', 1);
    return;
  }
  try { _clockBumpLocal(); } catch {}

  // 🆕 Forzar re-login si lleva > MAX_OFFLINE_DAYS sin internet
  if (_tooLongOffline()) {
    try { STORE.del(STORE.KEY_T); } catch {}
    T = '';
    const loginDiv = document.getElementById('login');
    if (loginDiv) loginDiv.hidden = false;
    try { $('#lu').focus(); } catch {}
    const daysOffline = Math.floor(
      (_effectiveNow() - (+localStorage.getItem(LAST_SERVER_KEY) || 0)) / (24 * 3600e3)
    );
    toast(`📴 ${daysOffline} días sin internet. Inicia sesión para renovar.`, 1);
    return;
  }

  if (!hasPw || !hasMK) {
    STORE.del(STORE.KEY_T);
    $('#login').hidden = false;
    $('#lu').focus();
    return;
  }
  
  // 🆕 Si token está cifrado → no podemos validar `exp` hasta descifrar
  // después del password. showLockScreen se encarga.
  if (t._enc) {
    // skip — showLockScreen descifra y valida
  } else if (t.exp < Date.now() && navigator.onLine) {
    // Caso 3: token expirado → si hay red, forzar login
    STORE.del(STORE.KEY_T);
    $('#login').hidden = false;
    $('#lu').focus();
    toast('Sesión expirada. Inicia sesión de nuevo.', 1);
    return;
  }

  // Caso 4: todo OK → LOCK SCREEN
  await showLockScreen();

  // Procesar cola pendiente si hay red
  if (navigator.onLine) setTimeout(() => processSyncQueue(), 1500);
}

  
if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', _boot, {once:true});
} else {
  _boot();
}


    // Registrar Service Worker (para offline del mapa y PWA)
  if ('serviceWorker' in navigator) {
    addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js', { scope: '/' })
        .catch(() => {});
    });
  }
  

  

  /* ═══════════════════════════════════════════════════════════════
   📲 WIDGET BRIDGE v2 · empuja la programación de HOY al widget
   - Polling al inicio hasta que P tenga datos (no sobreescribe con [])
   - Reintenta cada 2s por 3 min
   - Envía también en visibilitychange y cada 60s
   ═══════════════════════════════════════════════════════════════ */
function __pushScheduleToWidget() {
  if (!window.WidgetBridge) {
    console.log('[widget push] ⚠ WidgetBridge no existe (¿corriendo en navegador?)');
    return false;
  }
  if (!P || typeof P !== 'object' || Object.keys(P).length === 0) {
    console.log('[widget push] ⏳ P aún vacío, esperando...');
    return false;   // 🔑 NO enviar [] si P no ha cargado
  }

  try {
    const t = (typeof today === 'function') ? today() :
              (() => { const d = new Date();
                return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; })();

    const arr = [];
    for (const id in P) {
      const p = P[id];
      if (!p || p.prog_fecha !== t) continue;
      arr.push({
        id,
        n: p.nombre || '',
        c: p.colonia || '',
        h: p.prog_hora || '',
        tel: String(p.tel1 || p.tel2 || '').replace(/\D/g, '')
      });
    }
    arr.sort((a, b) => a.n.localeCompare(b.n, 'es'));

    WidgetBridge.updateSchedule(JSON.stringify(arr));
    console.log('[widget push] ✅ OK · ' + arr.length + ' programados · ' + JSON.stringify(arr.slice(0, 2)));
    return true;
  } catch (e) {
    console.warn('[widget push] ❌ error:', e);
    return false;
  }
}

/* Polling: reintenta cada 2s hasta 90 intentos (3 minutos) */
let __pushTry = 0;
function __pushLoop() {
  if (__pushScheduleToWidget()) return;   // éxito → detener
  if (__pushTry++ >= 90) {
    console.warn('[widget push] ⛔ desisto tras 3 min. P=' + (typeof P === 'object' ? Object.keys(P).length : '?'));
    return;
  }
  setTimeout(__pushLoop, 2000);
}

/* Abrir paciente desde el widget */
window.__openPatientFromWidget = function (pid) {
  try {
    if (typeof openDetail === 'function') return openDetail(pid);
    if (typeof openD === 'function') return openD(pid);
    if (typeof showDetail === 'function') return showDetail(pid);
    if (typeof cur !== 'undefined' && typeof tab === 'function' && P[pid]) {
      cur = pid;
      tab(0, true);
      const det = document.querySelector('#detail');
      if (det) det.hidden = false;
    }
  } catch (e) { console.warn('[widget open]', e); }
};

/* Arrancar polling al cargar */
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => setTimeout(__pushLoop, 1000));
} else {
  setTimeout(__pushLoop, 1000);
}

/* Re-push al volver a la app */
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') setTimeout(__pushScheduleToWidget, 800);
});

/* Re-push periódico por si dejan la app abierta */
setInterval(__pushScheduleToWidget, 60000);

  
  
})();
