// DEPRECATED under DEC-007 reply-only: do not actively push LINE messages.
// Kept deployed so old clients that still invoke it get a safe no-op.
// Prefer supabase/functions/line-webhook for user-initiated replies.
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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!supabaseUrl || !serviceKey) {
      return json({ ok: false, error: 'missing supabase env', mode: 'reply_only' }, 500)
    }

    const admin = createClient(supabaseUrl, serviceKey)
    const nowIso = new Date().toISOString()

    const { data: rows, error } = await admin
      .from('notification_outbox')
      .select('id')
      .in('status', ['pending', 'failed'])
      .limit(100)

    if (error) {
      return json({ ok: false, error: sanitizeError(error.message), mode: 'reply_only' }, 500)
    }

    for (const row of rows ?? []) {
      await admin
        .from('notification_outbox')
        .update({
          status: 'skipped',
          error: 'reply_only: proactive LINE push disabled (DEC-007)',
          processed_at: nowIso,
          last_attempt_at: nowIso,
          next_retry_at: null,
        })
        .eq('id', row.id)
    }

    return json({
      ok: true,
      sent: 0,
      failed: 0,
      skipped: (rows ?? []).length,
      mode: 'reply_only',
      reason: 'proactive_push_disabled',
    })
  } catch (err) {
    return json({ ok: false, error: sanitizeError(String(err)), mode: 'reply_only' }, 500)
  }
})

function sanitizeError(text: string): string {
  return text
    .replace(/Bearer\s+[A-Za-z0-9._\-/=+]+/gi, 'Bearer [REDACTED]')
    .replace(/LINE_CHANNEL_ACCESS_TOKEN\s*[:=]\s*\S+/gi, 'LINE_CHANNEL_ACCESS_TOKEN=[REDACTED]')
    .replace(/eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/g, '[REDACTED_JWT]')
    .slice(0, 500)
}

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
