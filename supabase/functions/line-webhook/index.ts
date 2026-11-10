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

  if (req.method === 'GET' || req.method === 'HEAD') {
    return json({
      ok: true,
      mode: 'reply_only',
      hasToken: token.length > 0,
      hasSecret: secret.length > 0,
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

  const events = body.events ?? []
  console.info('[line-webhook] events', events.length, events.map((e) => e.type).join(','))

  let replied = 0
  let failed = 0
  for (const event of events) {
    if (!event.replyToken) continue
    if (event.type !== 'message' && event.type !== 'follow' && event.type !== 'postback') {
      continue
    }
    const ok = await replyMenu(token, event.replyToken, appUrl)
    if (ok) replied += 1
    else failed += 1
  }

  return json({ ok: true, replied, failed, eventCount: events.length })
})

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

async function replyMenu(token: string, replyToken: string, appUrl: string) {
  const lines = [
    '工程管家入口（僅回覆、不主動推播）',
    '',
    `上下班打卡：${appUrl}/attendance`,
    `切換工地：${appUrl}/sites`,
    `施工回報：${appUrl}/sites`,
    `材料採購：${appUrl}/purchases`,
    `我的出勤：${appUrl}/attendance`,
    `工程系統：${appUrl}/`,
  ]

  const messages = [
    {
      type: 'text',
      text: lines.join('\n').slice(0, 4000),
    },
  ]

  try {
    const res = await fetch('https://api.line.me/v2/bot/message/reply', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ replyToken, messages }),
    })
    if (!res.ok) {
      const errText = (await res.text()).slice(0, 300)
      console.warn('[line-webhook] reply failed', res.status, errText)
      return false
    }
    console.info('[line-webhook] reply ok')
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
