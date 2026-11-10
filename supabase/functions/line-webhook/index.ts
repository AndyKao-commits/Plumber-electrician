const DEFAULT_APP_URL = 'https://plumber-electrician-seven.vercel.app'

type LineEvent = {
  type?: string
  replyToken?: string
  source?: { type?: string; userId?: string }
  message?: { type?: string; text?: string }
}

type LineWebhookBody = { events?: LineEvent[] }

Deno.serve(async (req) => {
  if (req.method === 'GET' || req.method === 'HEAD') {
    return new Response('ok', { status: 200 })
  }
  if (req.method !== 'POST') {
    return new Response('method not allowed', { status: 405 })
  }

  const token = Deno.env.get('LINE_CHANNEL_ACCESS_TOKEN')
  const secret = Deno.env.get('LINE_CHANNEL_SECRET')
  const appUrl = (Deno.env.get('APP_PUBLIC_URL') || DEFAULT_APP_URL).replace(/\/$/, '')
  const rawBody = await req.text()
  const signature = req.headers.get('x-line-signature') ?? ''

  if (!secret) return json({ ok: false, error: 'LINE_CHANNEL_SECRET not set' }, 500)
  if (!(await verifyLineSignature(rawBody, signature, secret))) {
    return json({ ok: false, error: 'invalid signature' }, 401)
  }
  if (!token) return json({ ok: true, replied: 0, reason: 'no_token' })

  let body: LineWebhookBody
  try {
    body = JSON.parse(rawBody) as LineWebhookBody
  } catch {
    return json({ ok: false, error: 'invalid json' }, 400)
  }

  let replied = 0
  for (const event of body.events ?? []) {
    if (!event.replyToken) continue
    if (event.type !== 'message' && event.type !== 'follow' && event.type !== 'postback') continue
    if (await replyMenu(token, event.replyToken, appUrl)) replied += 1
  }
  return json({ ok: true, replied })
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
  const items = [
    { label: '上下班打卡', path: '/attendance' },
    { label: '切換工地', path: '/sites' },
    { label: '施工回報', path: '/sites' },
    { label: '材料採購', path: '/purchases' },
    { label: '我的出勤', path: '/attendance' },
    { label: '工程系統', path: '/' },
  ]
  const messages = [{
    type: 'text',
    text: '工程管家入口（僅回覆、不主動推播）。請點選下方按鈕開啟系統：',
    quickReply: {
      items: items.map((item) => ({
        type: 'action',
        action: { type: 'uri', label: item.label.slice(0, 20), uri: `${appUrl}${item.path}` },
      })),
    },
  }]
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
