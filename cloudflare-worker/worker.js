/**
 * Cloudflare Worker — Proxy OpenAI API (imagens + chat)
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
 * O mesmo Worker serve para geração de imagens E para o Diretor de Arte com GPT.
 */

const IMAGE_MODELS = new Set(['dall-e-3', 'gpt-image-1', 'dall-e-2'])
const CHAT_MODELS  = new Set(['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'])

export default {
  async fetch(request, env) {

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return corsResponse(null, 204)
    }

    // Health check
    if (request.method === 'GET') {
      return corsResponse({ status: 'ok', message: 'PhotosHAI OpenAI Worker está no ar! ✅' }, 200)
    }

    if (request.method !== 'POST') {
      return corsResponse({ error: 'Apenas POST é permitido.' }, 405)
    }

    let body
    try {
      body = await request.json()
    } catch {
      return corsResponse({ error: 'Body JSON inválido.' }, 400)
    }

    if (!env.OPENAI_API_KEY) {
      return corsResponse({ error: 'Secret OPENAI_API_KEY não configurada no Worker.' }, 500)
    }

    const model = body.model || ''

    // Roteamento por tipo de modelo
    let endpoint
    if (IMAGE_MODELS.has(model)) {
      endpoint = 'https://api.openai.com/v1/images/generations'
    } else if (CHAT_MODELS.has(model)) {
      endpoint = 'https://api.openai.com/v1/chat/completions'
    } else {
      return corsResponse({ error: `Modelo não permitido: ${model}` }, 400)
    }

    let openaiResp
    try {
      openaiResp = await fetch(endpoint, {
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
