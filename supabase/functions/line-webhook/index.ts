import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

type LineEvent = {
  type?: string
  replyToken?: string
  source?: { type?: string; userId?: string }
  message?: { type?: string; text?: string }
}

type LineWebhookBody = { events?: LineEvent[] }

Deno.serve(async (req) => {
  const token = Deno.env.get('LINE_CHANNEL_ACCESS_TOKEN') ?? ''
  const secret = Deno.env.get('LINE_CHANNEL_SECRET') ?? ''
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

  if (req.method === 'GET' || req.method === 'HEAD') {
    return json({
      ok: true,
      mode: 'reply_only_bind',
      hasToken: token.length > 0,
      hasSecret: secret.length > 0,
      hasServiceKey: serviceKey.length > 0,
    })
  }

  if (req.method !== 'POST') {
    return new Response('method not allowed', { status: 405 })
  }

  const rawBody = await req.text()
  const signature = req.headers.get('x-line-signature') ?? ''

  if (!secret) {
    return json({ ok: false, error: 'LINE_CHANNEL_SECRET not set' }, 500)
  }
  if (!(await verifyLineSignature(rawBody, signature, secret))) {
    return json({ ok: false, error: 'invalid signature' }, 401)
  }

  let body: LineWebhookBody
  try {
    body = JSON.parse(rawBody) as LineWebhookBody
  } catch {
    return json({ ok: false, error: 'invalid json' }, 400)
  }

  // Rich menu handles navigation — do not spam menu replies on「你好」etc.
  // Only reply for bind codes (and a short tip on follow).
  if (!token) {
    return json({ ok: true, replied: 0, reason: 'no_token' })
  }

  const admin =
    supabaseUrl && serviceKey
      ? createClient(supabaseUrl, serviceKey, {
          auth: { persistSession: false, autoRefreshToken: false },
        })
      : null

  let replied = 0
  for (const event of body.events ?? []) {
    if (!event.replyToken) continue

    if (event.type === 'follow') {
      const ok = await replyText(
        token,
        event.replyToken,
        '歡迎加入。請用下方圖文選單操作。\n若要綁定系統帳號：到工程管家「今日團隊」按「用 LINE 綁定」。',
      )
      if (ok) replied += 1
      continue
    }

    if (event.type !== 'message') continue
    const text = String(event.message?.text ?? '').trim()
    const bindCode = extractBindCode(text)
    if (!bindCode) {
      // Silent: rich menu is the primary UX
      continue
    }

    const lineUserId = String(event.source?.userId ?? '').trim()
    const reply = await handleBind(admin, bindCode, lineUserId)
    if (await replyText(token, event.replyToken, reply)) replied += 1
  }

  return json({ ok: true, replied })
})

function extractBindCode(text: string): string | null {
  const normalized = text
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/[：:]/g, ' ')
    .trim()
  const withKeyword = normalized.match(/(?:綁定|bind)\s*([A-Za-z0-9]{6})\b/i)
  if (withKeyword?.[1]) return withKeyword[1].toUpperCase()
  const bare = normalized.match(/^([A-Za-z0-9]{6})$/i)
  if (bare?.[1]) return bare[1].toUpperCase()
  const loose = normalized.match(/(?:綁定|bind)[^A-Za-z0-9]*([A-Za-z0-9]{6})/i)
  if (loose?.[1]) return loose[1].toUpperCase()
  return null
}

async function handleBind(
  admin: ReturnType<typeof createClient> | null,
  code: string,
  lineUserId: string,
): Promise<string> {
  if (!admin) return '綁定失敗：伺服器尚未設定資料庫金鑰。'
  if (!lineUserId) return '綁定失敗：讀不到你的 LINE User ID。'

  const { data, error } = await admin.rpc('consume_line_bind_code', {
    p_code: code,
    p_line_user_id: lineUserId,
  })
  if (error) {
    console.warn('[line-webhook] consume failed', error.message)
    return `綁定失敗：系統錯誤。代碼 ${code}`
  }

  const result = (typeof data === 'string' ? JSON.parse(data) : data) as {
    ok?: boolean
    error?: string
    name?: string
  } | null

  if (!result?.ok) {
    const err = result?.error ?? 'unknown'
    if (err === 'code_not_found_or_expired') {
      return `綁定失敗：代碼 ${code} 無效或已過期。請回系統重新產生。`
    }
    return `綁定失敗（${err}）。代碼 ${code}`
  }

  const name = result.name ? `，${result.name}` : ''
  return `綁定成功${name}！可用圖文選單進入系統。`
}

async function verifyLineSignature(body: string, signature: string, channelSecret: string) {
  if (!signature) return false
  try {
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(channelSecret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    )
    const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body))
    const digest = btoa(String.fromCharCode(...new Uint8Array(mac)))
    if (digest.length !== signature.length) return false
    let out = 0
    for (let i = 0; i < digest.length; i++) out |= digest.charCodeAt(i) ^ signature.charCodeAt(i)
    return out === 0
  } catch {
    return false
  }
}

async function replyText(token: string, replyToken: string, text: string) {
  try {
    const res = await fetch('https://api.line.me/v2/bot/message/reply', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        replyToken,
        messages: [{ type: 'text', text: text.slice(0, 4000) }],
      }),
    })
    if (!res.ok) {
      console.warn('[line-webhook] reply failed', res.status)
      return false
    }
    return true
  } catch (err) {
    console.warn('[line-webhook] reply threw', String(err).slice(0, 200))
    return false
  }
}

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}
