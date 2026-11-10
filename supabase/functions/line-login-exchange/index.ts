// Exchange LINE Login authorization code → LINE user id (for binding only).
// Secrets (Supabase Edge Function Secrets):
//   LINE_LOGIN_CHANNEL_ID
//   LINE_LOGIN_CHANNEL_SECRET
// Does NOT create app sessions. App login remains Email/password (DEC-004).

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method === 'GET' || req.method === 'HEAD') {
    const id = Deno.env.get('LINE_LOGIN_CHANNEL_ID') ?? ''
    const secret = Deno.env.get('LINE_LOGIN_CHANNEL_SECRET') ?? ''
    return json({
      ok: true,
      hasChannelId: id.length > 0,
      hasChannelSecret: secret.length > 0,
    })
  }

  if (req.method !== 'POST') {
    return json({ ok: false, error: 'method not allowed' }, 405)
  }

  const channelId = Deno.env.get('LINE_LOGIN_CHANNEL_ID') ?? ''
  const channelSecret = Deno.env.get('LINE_LOGIN_CHANNEL_SECRET') ?? ''
  if (!channelId || !channelSecret) {
    return json({ ok: false, error: 'LINE Login secrets not configured' }, 500)
  }

  let payload: { code?: string; redirectUri?: string }
  try {
    payload = (await req.json()) as { code?: string; redirectUri?: string }
  } catch {
    return json({ ok: false, error: 'invalid json' }, 400)
  }

  const code = String(payload.code ?? '').trim()
  const redirectUri = String(payload.redirectUri ?? '').trim()
  if (!code || !redirectUri) {
    return json({ ok: false, error: 'code and redirectUri required' }, 400)
  }

  try {
    const tokenRes = await fetch('https://api.line.me/oauth2/v2.1/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
        client_id: channelId,
        client_secret: channelSecret,
      }),
    })
    const tokenJson = (await tokenRes.json()) as {
      access_token?: string
      id_token?: string
      error?: string
      error_description?: string
    }
    if (!tokenRes.ok || !tokenJson.access_token) {
      console.warn('[line-login-exchange] token failed', tokenRes.status, tokenJson.error)
      return json(
        {
          ok: false,
          error: 'token_exchange_failed',
          detail: String(tokenJson.error_description || tokenJson.error || tokenRes.status).slice(0, 200),
        },
        400,
      )
    }

    const profileRes = await fetch('https://api.line.me/v2/profile', {
      headers: { Authorization: `Bearer ${tokenJson.access_token}` },
    })
    const profile = (await profileRes.json()) as {
      userId?: string
      displayName?: string
      message?: string
    }
    if (!profileRes.ok || !profile.userId) {
      console.warn('[line-login-exchange] profile failed', profileRes.status)
      return json({ ok: false, error: 'profile_failed' }, 400)
    }

    return json({
      ok: true,
      lineUserId: profile.userId,
      displayName: profile.displayName ?? null,
    })
  } catch (err) {
    console.warn('[line-login-exchange] threw', String(err).slice(0, 200))
    return json({ ok: false, error: 'exchange_threw' }, 500)
  }
})

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
