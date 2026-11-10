// Supabase Edge Function: LINE Messaging API webhook (reply-only).
// Secrets (Supabase Edge Function Secrets only):
//   LINE_CHANNEL_ACCESS_TOKEN
//   LINE_CHANNEL_SECRET
// Optional env: APP_PUBLIC_URL (default production Vercel URL)
// Never log or echo secrets. Deploy: bash scripts/deploy-line-webhook.sh

const DEFAULT_APP_URL = 'https://plumber-electrician-seven.vercel.app'

type LineEvent = {
  type?: string
  replyToken?: string
  source?: { type?: string; userId?: string }
  message?: { type?: string; text?: string }
}

type LineWebhookBody = {
  events?: LineEvent[]
}

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

  if (!secret) {
    return json({ ok: false, error: 'LINE_CHANNEL_SECRET not set' }, 500)
  }

  const valid = await verifyLineSignature(rawBody, signature, secret)
  if (!valid) {
    return json({ ok: false, error: 'invalid signature' }, 401)
  }

  if (!token) {
    // Acknowledge webhook so LINE does not retry forever; cannot reply without token
    return json({ ok: true, replied: 0, reason: 'no_token' })
  }

  let body: LineWebhookBody
  try {
    body = JSON.parse(rawBody) as LineWebhookBody
  } catch {
    return json({ ok: false, error: 'invalid json' }, 400)
  }

  const events = body.events ?? []
  let replied = 0

  for (const event of events) {
    const replyToken = event.replyToken
    if (!replyToken) continue

    const shouldReply =
      event.type === 'message' ||
      event.type === 'follow' ||
      event.type === 'postback'

    if (!shouldReply) continue

    const ok = await replyMenu(token, replyToken, appUrl)
    if (ok) replied += 1
  }

  return json({ ok: true, replied })
})

async function verifyLineSignature(
  body: string,
  signature: string,
  channelSecret: string,
): Promise<boolean> {
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
    return timingSafeEqual(digest, signature)
  } catch {
    return false
  }
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let out = 0
  for (let i = 0; i < a.length; i += 1) {
    out |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return out === 0
}

async function replyMenu(
  token: string,
  replyToken: string,
  appUrl: string,
): Promise<boolean> {
  const items = [
    { label: '上下班打卡', path: '/attendance' },
    { label: '切換工地', path: '/sites' },
    { label: '施工回報', path: '/sites' },
    { label: '材料採購', path: '/purchases' },
    { label: '我的出勤', path: '/attendance' },
    { label: '工程系統', path: '/' },
  ]

  const messages = [
    {
      type: 'text',
      text: '工程管家入口（僅回覆、不主動推播）。請點選下方按鈕開啟系統：',
      quickReply: {
        items: items.map((item) => ({
          type: 'action',
          action: {
            type: 'uri',
            label: item.label.slice(0, 20),
            uri: `${appUrl}${item.path}`,
          },
        })),
      },
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
      // Do not echo body (may contain sensitive bits); keep status only
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
