/**
 * /api/inegi-proxy.js
 * Proxy para evitar CORS al consultar GetFeatureInfo del WMS de INEGI
 * desde el navegador.
 */
export async function onRequest(context) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  // Preflight
  if (context.request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  // 1. Leer la URL destino desde ?target=
  const url = new URL(context.request.url);
  const target = url.searchParams.get('target');
  if (!target) {
    return new Response('Falta el parámetro "target"', {
      status: 400,
      headers: corsHeaders,
    });
  }

  // 2. Seguridad: solo permitir el dominio del INEGI
if (!/^https:\/\/gaia\.inegi\.org\.mx\/(NLB\/tunnel\/wms\/|geoserver\/)/.test(target)) {
  return new Response('Ruta no permitida', { status: 403, headers: corsHeaders });
}

  // 3. Hacer la petición a INEGI desde el servidor (sin CORS)
  try {
    const inegiRes = await fetch(target, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ExcelBrigadas/1.0)' },
    });
    const body = await inegiRes.text();

    return new Response(body, {
      status: inegiRes.status,
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=60',
      },
    });
  } catch (err) {
    return new Response('Error al contactar INEGI: ' + err.message, {
      status: 502,
      headers: corsHeaders,
    });
  }
}
