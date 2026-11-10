// Supabase Edge Function: process notification_outbox via LINE Messaging API.
// Secret (Supabase Edge Function Secrets only): LINE_CHANNEL_ACCESS_TOKEN
// Never log or echo the token. Deploy: supabase functions deploy line-push --project-ref rhpzvqvkmllbdtkpouwn
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const MAX_ATTEMPTS = 5
const BATCH = 50

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
      eventType?: string
      forceRetry?: boolean
    }

    const nowIso = new Date().toISOString()

    // Eligible: pending, or failed with attempts < MAX and next_retry_at due
    let query = admin
      .from('notification_outbox')
      .select(
        'id, line_user_id, title, body, href, status, attempts, next_retry_at, recipient_profile_id',
      )
      .in('status', ['pending', 'failed'])
      .lt('attempts', MAX_ATTEMPTS)
      .order('created_at', { ascending: true })
      .limit(BATCH)

    if (body.recipientIds?.length) {
      query = query.in('recipient_profile_id', body.recipientIds)
    }

    const { data: rows, error } = await query
    if (error) return json({ ok: false, error: sanitizeError(error.message) }, 500)

    const due = (rows ?? []).filter((row) => {
      if (row.status === 'pending') return true
      if (!row.next_retry_at) return true
      return new Date(row.next_retry_at).getTime() <= Date.now()
    })

    if (!token) {
      // Do not burn attempts forever; mark skipped until secret is configured
      for (const row of due) {
        await admin
          .from('notification_outbox')
          .update({
            status: 'skipped',
            error: 'LINE_CHANNEL_ACCESS_TOKEN not set',
            processed_at: nowIso,
            last_attempt_at: nowIso,
          })
          .eq('id', row.id)
      }
      return json({
        ok: true,
        sent: 0,
        failed: 0,
        skipped: due.length,
        reason: 'no_token',
      })
    }

    let sent = 0
    let failed = 0
    let skipped = 0

    for (const row of due) {
      const lineUserId = String(row.line_user_id ?? '').trim()
      const attempts = Number(row.attempts ?? 0) + 1

      if (!lineUserId) {
        await admin
          .from('notification_outbox')
          .update({
            status: 'skipped',
            error: 'missing line_user_id',
            attempts,
            processed_at: nowIso,
            last_attempt_at: nowIso,
            next_retry_at: null,
          })
          .eq('id', row.id)
        skipped += 1
        continue
      }

      try {
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
          const errText = sanitizeError(await res.text())
          const exhausted = attempts >= MAX_ATTEMPTS
          await admin
            .from('notification_outbox')
            .update({
              status: exhausted ? 'failed' : 'pending',
              error: errText || `LINE HTTP ${res.status}`,
              attempts,
              processed_at: nowIso,
              last_attempt_at: nowIso,
              // Keep retryable: backoff 2^attempts minutes (cap 60)
              next_retry_at: exhausted
                ? null
                : new Date(
                    Date.now() + Math.min(60, 2 ** attempts) * 60_000,
                  ).toISOString(),
            })
            .eq('id', row.id)
          failed += 1
          continue
        }

        await admin
          .from('notification_outbox')
          .update({
            status: 'sent',
            error: null,
            attempts,
            processed_at: nowIso,
            last_attempt_at: nowIso,
            next_retry_at: null,
          })
          .eq('id', row.id)
        sent += 1
      } catch (err) {
        const exhausted = attempts >= MAX_ATTEMPTS
        await admin
          .from('notification_outbox')
          .update({
            status: exhausted ? 'failed' : 'pending',
            error: sanitizeError(String(err)),
            attempts,
            processed_at: nowIso,
            last_attempt_at: nowIso,
            next_retry_at: exhausted
              ? null
              : new Date(
                  Date.now() + Math.min(60, 2 ** attempts) * 60_000,
                ).toISOString(),
          })
          .eq('id', row.id)
        failed += 1
      }
    }

    return json({ ok: true, sent, failed, skipped, maxAttempts: MAX_ATTEMPTS })
  } catch (err) {
    return json({ ok: false, error: sanitizeError(String(err)) }, 500)
  }
})

/** Strip credentials before persisting or returning errors. */
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
