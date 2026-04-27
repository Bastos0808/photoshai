/**
 * Cloudflare Worker — Proxy OpenAI Images API
 *
 * SETUP:
 * 1. Cole este código no editor do Cloudflare Worker
 * 2. Em Settings → Variables → Secrets, adicione:
 *    Nome: OPENAI_API_KEY
 *    Valor: sua chave sk-...
 * 3. Clique em Deploy
 * 4. Copie a URL do worker (ex: https://openai-proxy.SEU-USUARIO.workers.dev)
 * 5. Cole essa URL em ⚙️ Configurações → API Keys → OpenAI Worker URL
 *
 * A sua API Key NUNCA sai do Cloudflare — o browser não tem acesso a ela.
 */

export default {
  async fetch(request, env) {

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return corsResponse(null, 204)
    }

    if (request.method !== 'POST') {
      return corsResponse({ error: 'Apenas POST é permitido.' }, 405)
    }

    // Parse body
    let body
    try {
      body = await request.json()
    } catch {
      return corsResponse({ error: 'Body JSON inválido.' }, 400)
    }

    // Só permite modelos de imagem da OpenAI
    const ALLOWED_MODELS = ['dall-e-3', 'gpt-image-1', 'dall-e-2']
    if (!ALLOWED_MODELS.includes(body.model)) {
      return corsResponse({ error: `Modelo não permitido: ${body.model}` }, 400)
    }

    // Checa se a secret está configurada
    if (!env.OPENAI_API_KEY) {
      return corsResponse({ error: 'Secret OPENAI_API_KEY não configurada no Worker.' }, 500)
    }

    // Forward para OpenAI
    let openaiResp
    try {
      openaiResp = await fetch('https://api.openai.com/v1/images/generations', {
        method:  'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify(body),
      })
    } catch (e) {
      return corsResponse({ error: `Falha ao contactar OpenAI: ${e.message}` }, 502)
    }

    const data = await openaiResp.json()
    return corsResponse(data, openaiResp.status)
  }
}

/* ── helpers ── */
function corsHeaders() {
  return {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age':       '86400',
  }
}

function corsResponse(data, status = 200) {
  const body = data === null ? null : JSON.stringify(data)
  return new Response(body, {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders(),
    },
  })
}
