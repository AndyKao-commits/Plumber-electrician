// Supabase Edge Function: push pending notification_outbox rows via LINE Messaging API.
// Secrets: LINE_CHANNEL_ACCESS_TOKEN
// Deploy: supabase functions deploy line-push
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const token = Deno.env.get('LINE_CHANNEL_ACCESS_TOKEN')
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!supabaseUrl || !serviceKey) {
      return json({ ok: false, error: 'missing supabase env' }, 500)
    }

    const admin = createClient(supabaseUrl, serviceKey)
    const body = (await req.json().catch(() => ({}))) as {
      recipientIds?: string[]
      title?: string
      body?: string
      eventType?: string
    }

    let query = admin
      .from('notification_outbox')
      .select('id, line_user_id, title, body, href, status')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(50)

    if (body.recipientIds?.length) {
      query = query.in('recipient_profile_id', body.recipientIds)
    }

    const { data: rows, error } = await query
    if (error) return json({ ok: false, error: error.message }, 500)

    if (!token) {
      // Mark skipped so outbox does not pile up when LINE is not configured
      const ids = (rows ?? []).map((r) => r.id)
      if (ids.length) {
        await admin
          .from('notification_outbox')
          .update({
            status: 'skipped',
            error: 'LINE_CHANNEL_ACCESS_TOKEN not set',
            processed_at: new Date().toISOString(),
          })
          .in('id', ids)
      }
      return json({ ok: true, sent: 0, skipped: ids.length, reason: 'no_token' })
    }

    let sent = 0
    let failed = 0
    for (const row of rows ?? []) {
      const lineUserId = String(row.line_user_id ?? '')
      if (!lineUserId) {
        await mark(admin, row.id, 'skipped', 'missing line_user_id')
        continue
      }
      const text = [row.title, row.body].filter(Boolean).join('\n')
      const res = await fetch('https://api.line.me/v2/bot/message/push', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          to: lineUserId,
          messages: [{ type: 'text', text: text.slice(0, 4000) }],
        }),
      })
      if (!res.ok) {
        const errText = await res.text()
        await mark(admin, row.id, 'failed', errText.slice(0, 500))
        failed += 1
        continue
      }
      await mark(admin, row.id, 'sent', null)
      sent += 1
    }

    return json({ ok: true, sent, failed })
  } catch (err) {
    return json({ ok: false, error: String(err) }, 500)
  }
})

async function mark(
  admin: ReturnType<typeof createClient>,
  id: string,
  status: 'sent' | 'failed' | 'skipped',
  error: string | null,
) {
  await admin
    .from('notification_outbox')
    .update({
      status,
      error,
      processed_at: new Date().toISOString(),
    })
    .eq('id', id)
}

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
