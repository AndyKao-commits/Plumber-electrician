import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

const DEFAULT_APP_URL = 'https://plumber-electrician-seven.vercel.app'

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
  const appUrl = (Deno.env.get('APP_PUBLIC_URL') || DEFAULT_APP_URL).replace(/\/$/, '')
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

  if (req.method === 'GET' || req.method === 'HEAD') {
    return json({
      ok: true,
      mode: 'reply_only',
      hasToken: token.length > 0,
      hasSecret: secret.length > 0,
      hasServiceKey: serviceKey.length > 0,
      appUrl,
    })
  }

  if (req.method !== 'POST') {
    return new Response('method not allowed', { status: 405 })
  }

  const rawBody = await req.text()
  const signature = req.headers.get('x-line-signature') ?? ''

  if (!secret) {
    console.warn('[line-webhook] LINE_CHANNEL_SECRET not set')
    return json({ ok: false, error: 'LINE_CHANNEL_SECRET not set' }, 500)
  }

  if (!(await verifyLineSignature(rawBody, signature, secret))) {
    console.warn('[line-webhook] invalid signature')
    return json({ ok: false, error: 'invalid signature' }, 401)
  }

  if (!token) {
    console.warn('[line-webhook] LINE_CHANNEL_ACCESS_TOKEN not set')
    return json({ ok: true, replied: 0, reason: 'no_token' })
  }

  let body: LineWebhookBody
  try {
    body = JSON.parse(rawBody) as LineWebhookBody
  } catch {
    return json({ ok: false, error: 'invalid json' }, 400)
  }

  const admin =
    supabaseUrl && serviceKey
      ? createClient(supabaseUrl, serviceKey, {
          auth: { persistSession: false, autoRefreshToken: false },
        })
      : null

  const events = body.events ?? []
  console.info('[line-webhook] events', events.length, events.map((e) => e.type).join(','))

  let replied = 0
  let failed = 0
  for (const event of events) {
    if (!event.replyToken) continue
    if (event.type !== 'message' && event.type !== 'follow' && event.type !== 'postback') {
      continue
    }

    const lineUserId = String(event.source?.userId ?? '').trim()
    const text = String(event.message?.text ?? '').trim()
    const bindCode = extractBindCode(text)

    let replyText: string
    if (bindCode) {
      console.info('[line-webhook] bind attempt', bindCode)
      replyText = await handleBind(admin, bindCode, lineUserId)
    } else if (event.type === 'follow') {
      replyText =
        menuText(appUrl) +
        '\n\n若要綁定個人帳號：到系統「今日團隊」產生綁定碼，再傳「綁定 代碼」。'
    } else {
      replyText =
        menuText(appUrl) +
        '\n\n綁定個人帳號：系統產生綁定碼後，傳「綁定 代碼」給我（也可只傳 6 碼）。'
    }

    const ok = await replyTextMessage(token, event.replyToken, replyText)
    if (ok) replied += 1
    else failed += 1
  }

  return json({ ok: true, replied, failed, eventCount: events.length })
})

/** Accept「綁定 ABC123」「綁定：abc123」「ABC123」etc. */
function extractBindCode(text: string): string | null {
  const normalized = text
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/[：:]/g, ' ')
    .trim()

  const withKeyword = normalized.match(/(?:綁定|bind)\s*([A-Za-z0-9]{6})\b/i)
  if (withKeyword?.[1]) return withKeyword[1].toUpperCase()

  const bare = normalized.match(/^([A-Za-z0-9]{6})$/i)
  if (bare?.[1]) return bare[1].toUpperCase()

  // Fallback: any 6 alnum after 綁定 even with junk in between
  const loose = normalized.match(/(?:綁定|bind)[^A-Za-z0-9]*([A-Za-z0-9]{6})/i)
  if (loose?.[1]) return loose[1].toUpperCase()

  return null
}

async function handleBind(
  admin: ReturnType<typeof createClient> | null,
  code: string,
  lineUserId: string,
): Promise<string> {
  if (!admin) {
    return '綁定失敗：伺服器尚未設定資料庫金鑰。請稍後再試或聯絡管理員。'
  }
  if (!lineUserId) {
    return '綁定失敗：讀不到你的 LINE User ID。'
  }

  const { data, error } = await admin.rpc('consume_line_bind_code', {
    p_code: code,
    p_line_user_id: lineUserId,
  })

  if (error) {
    console.warn('[line-webhook] consume failed', error.message, error.code)
    // Surface safe hint so operators can tell SQL/RPC missing vs other failures
    const hint = error.message?.includes('consume_line_bind_code')
      ? '（請確認已執行 line_bind_code SQL）'
      : ''
    return `綁定失敗：系統錯誤${hint}。代碼 ${code}`
  }

  const result = (typeof data === 'string' ? JSON.parse(data) : data) as {
    ok?: boolean
    error?: string
    name?: string
  } | null

  if (!result?.ok) {
    const err = result?.error ?? 'unknown'
    console.warn('[line-webhook] consume rejected', err, code)
    if (err === 'code_not_found_or_expired') {
      return `綁定失敗：代碼 ${code} 無效或已過期。請回系統重新產生後再傳一次。`
    }
    if (err === 'invalid_code') {
      return `綁定失敗：代碼格式不正確（${code}）。`
    }
    return `綁定失敗（${err}）。代碼 ${code}。請回系統重新產生綁定碼。`
  }

  const name = result.name ? `，${result.name}` : ''
  return `綁定成功${name}！你的 LINE 已連結系統帳號。`
}

function menuText(appUrl: string) {
  return [
    '工程管家入口（僅回覆、不主動推播）',
    '',
    `上下班打卡：${appUrl}/attendance`,
    `切換工地：${appUrl}/sites`,
    `施工回報：${appUrl}/sites`,
    `材料採購：${appUrl}/purchases`,
    `我的出勤：${appUrl}/attendance`,
    `工程系統：${appUrl}/`,
  ].join('\n')
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

async function replyTextMessage(token: string, replyToken: string, text: string) {
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
      console.warn('[line-webhook] reply failed', res.status, (await res.text()).slice(0, 300))
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
