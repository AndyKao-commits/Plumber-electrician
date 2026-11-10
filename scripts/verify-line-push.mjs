#!/usr/bin/env node
/**
 * Post-deploy verification for line-push (project rhpzvqvkmllbdtkpouwn).
 *
 * Required env:
 *   SUPABASE_SERVICE_ROLE_KEY  — schema + outbox checks (never commit)
 * Optional:
 *   SUPABASE_ANON_KEY          — JWT invoke path (authenticated client)
 *   SUPABASE_URL               — default https://rhpzvqvkmllbdtkpouwn.supabase.co
 *   TEST_EMAIL / TEST_PASSWORD — live bind / purchase / quote path (optional)
 *
 * Never reads or prints LINE_CHANNEL_ACCESS_TOKEN.
 */
import { createClient } from '@supabase/supabase-js'

const URL =
  process.env.SUPABASE_URL?.trim() ||
  'https://rhpzvqvkmllbdtkpouwn.supabase.co'
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
const ANON = process.env.SUPABASE_ANON_KEY?.trim()

if (!SERVICE) {
  console.error('Missing SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const admin = createClient(URL, SERVICE, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const results = []
function ok(name, detail = '') {
  results.push({ name, pass: true, detail })
  console.log(`PASS  ${name}${detail ? ` — ${detail}` : ''}`)
}
function fail(name, detail = '') {
  results.push({ name, pass: false, detail })
  console.error(`FAIL  ${name}${detail ? ` — ${detail}` : ''}`)
}

async function verifySqlRetryColumns() {
  // Select fails if 20261110_line_outbox_retry.sql columns are missing
  const probe = await admin
    .from('notification_outbox')
    .select('id, attempts, next_retry_at, last_attempt_at, status')
    .limit(1)
  if (probe.error) {
    fail(
      'sql:20261110_line_outbox_retry',
      /attempts|next_retry_at|last_attempt_at/i.test(probe.error.message)
        ? `missing columns: ${probe.error.message}`
        : probe.error.message,
    )
    return false
  }
  ok('sql:20261110_line_outbox_retry', 'attempts/next_retry_at/last_attempt_at selectable')
  return true
}

async function invokeLinePush(jwt, body = {}) {
  const res = await fetch(`${URL}/functions/v1/line-push`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${jwt}`,
      apikey: ANON || SERVICE,
    },
    body: JSON.stringify(body),
  })
  const text = await res.text()
  let json
  try {
    json = JSON.parse(text)
  } catch {
    json = { raw: text }
  }
  return { status: res.status, json }
}

async function testUnboundDoesNotBlock() {
  // Insert outbox row with empty line_user_id should be skipped by function;
  // enqueue_line_notifications skips unbound — verify RPC returns 0 and no throw.
  const { data: profiles, error } = await admin
    .from('profiles')
    .select('id, organization_id, line_user_id')
    .limit(5)
  if (error) {
    fail('unbound:enqueue', error.message)
    return
  }
  const unbound = (profiles ?? []).find((p) => !String(p.line_user_id ?? '').trim())
  if (!unbound) {
    ok('unbound:enqueue', 'no unbound profile in sample; skip live enqueue')
    return
  }
  // Use service role to call enqueue as security definer needs auth.uid org —
  // instead insert a synthetic pending row then invoke function with service JWT path.
  const { data: row, error: insErr } = await admin
    .from('notification_outbox')
    .insert({
      organization_id: unbound.organization_id,
      event_type: 'purchase.approved',
      recipient_profile_id: unbound.id,
      line_user_id: '',
      title: '[verify] unbound skip',
      body: 'should skip',
      status: 'pending',
    })
    .select('id')
    .single()
  if (insErr) {
    fail('unbound:insert', insErr.message)
    return
  }
  const { status, json } = await invokeLinePush(SERVICE, {
    recipientIds: [unbound.id],
  })
  if (status !== 200 || !json?.ok) {
    fail('unbound:invoke', `HTTP ${status} ${JSON.stringify(json)}`)
  } else {
    ok('unbound:invoke', `skipped=${json.skipped ?? '?'} sent=${json.sent ?? 0}`)
  }
  const { data: after } = await admin
    .from('notification_outbox')
    .select('status, error')
    .eq('id', row.id)
    .single()
  if (after?.status === 'skipped') {
    ok('unbound:status', after.error || 'skipped')
  } else {
    fail('unbound:status', JSON.stringify(after))
  }
}

async function testBadTokenDoesNotBlockMainFlow() {
  // Simulate invalid LINE user id → LINE API fails → outbox pending/failed, no throw.
  const { data: profiles, error } = await admin
    .from('profiles')
    .select('id, organization_id')
    .limit(1)
  if (error || !profiles?.length) {
    fail('bad-token:setup', error?.message || 'no profiles')
    return
  }
  const p = profiles[0]
  const { data: row, error: insErr } = await admin
    .from('notification_outbox')
    .insert({
      organization_id: p.organization_id,
      event_type: 'quote.published',
      recipient_profile_id: p.id,
      line_user_id: 'U_INVALID_VERIFY_TOKEN_PATH',
      title: '[verify] bad line user',
      body: 'expect fail/retry not block',
      status: 'pending',
      attempts: 0,
    })
    .select('id')
    .single()
  if (insErr) {
    fail('bad-token:insert', insErr.message)
    return
  }
  const { status, json } = await invokeLinePush(SERVICE, {
    recipientIds: [p.id],
  })
  // Function itself must return 200 ok even when LINE push fails
  if (status !== 200 || json?.ok !== true) {
    fail('bad-token:invoke', `HTTP ${status} ${JSON.stringify(json)}`)
  } else {
    ok(
      'bad-token:invoke-nonblocking',
      `failed=${json.failed ?? 0} skipped=${json.skipped ?? 0} reason=${json.reason ?? 'n/a'}`,
    )
  }
  const { data: after } = await admin
    .from('notification_outbox')
    .select('status, attempts, error, next_retry_at')
    .eq('id', row.id)
    .single()
  if (
    after &&
    (after.status === 'pending' || after.status === 'failed' || after.status === 'skipped') &&
    after.status !== 'sent'
  ) {
    ok(
      'bad-token:outbox',
      `status=${after.status} attempts=${after.attempts} err=${String(after.error ?? '').slice(0, 80)}`,
    )
  } else {
    fail('bad-token:outbox', JSON.stringify(after))
  }
}

async function testEventEnqueueShapes() {
  // Confirms RPC exists for the product events (binding is profile update, not outbox).
  const events = [
    'purchase.approved',
    'purchase.rejected',
    'quote.published',
  ]
  for (const eventType of events) {
    // Calling with empty recipients must return 0 without error when org context exists.
    // Service role has no auth.uid → expect exception or we skip.
    const { error } = await admin.rpc('enqueue_line_notifications', {
      p_recipient_ids: [],
      p_event_type: eventType,
      p_title: `[verify] ${eventType}`,
      p_body: '',
      p_href: null,
      p_payload: { eventType },
    })
    if (error && /無法決定組織|organization/i.test(error.message)) {
      ok(`event:${eventType}:rpc`, 'RPC present (org context required under service role)')
    } else if (error) {
      fail(`event:${eventType}:rpc`, error.message)
    } else {
      ok(`event:${eventType}:rpc`, 'empty recipients => 0')
    }
  }
}

async function testBindColumnWritable() {
  const { data: profiles, error } = await admin
    .from('profiles')
    .select('id, line_user_id')
    .limit(1)
  if (error || !profiles?.length) {
    fail('bind:column', error?.message || 'no profiles')
    return
  }
  const id = profiles[0].id
  const marker = `VERIFY_${Date.now()}`
  const { error: upErr } = await admin
    .from('profiles')
    .update({ line_user_id: marker })
    .eq('id', id)
  if (upErr) {
    fail('bind:write', upErr.message)
    return
  }
  const { data: after, error: readErr } = await admin
    .from('profiles')
    .select('line_user_id')
    .eq('id', id)
    .single()
  if (readErr || after?.line_user_id !== marker) {
    fail('bind:readback', readErr?.message || String(after?.line_user_id))
  } else {
    ok('bind:line_user_id', 'profile.line_user_id writable')
  }
  // restore previous
  await admin
    .from('profiles')
    .update({ line_user_id: profiles[0].line_user_id })
    .eq('id', id)
}

async function testOptionalAuthFlows() {
  const email = process.env.TEST_EMAIL?.trim()
  const password = process.env.TEST_PASSWORD?.trim()
  if (!ANON || !email || !password) {
    ok(
      'auth-flows:skipped',
      'set SUPABASE_ANON_KEY + TEST_EMAIL + TEST_PASSWORD for bind/approve/quote E2E',
    )
    return
  }
  const client = createClient(URL, ANON, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data: sign, error } = await client.auth.signInWithPassword({ email, password })
  if (error || !sign.session) {
    fail('auth:login', error?.message || 'no session')
    return
  }
  ok('auth:login', email)
  const jwt = sign.session.access_token
  const userId = sign.session.user.id

  const marker = `U_VERIFY_${Date.now()}`
  const { error: bindErr } = await client
    .from('profiles')
    .update({ line_user_id: marker })
    .eq('id', userId)
  if (bindErr) fail('bind:self', bindErr.message)
  else ok('bind:self', 'authenticated self-update of line_user_id')

  for (const eventType of ['purchase.approved', 'purchase.rejected', 'quote.published']) {
    const { data: count, error: enqErr } = await client.rpc('enqueue_line_notifications', {
      p_recipient_ids: [userId],
      p_event_type: eventType,
      p_title: `[verify] ${eventType}`,
      p_body: 'smoke',
      p_href: '/purchases',
      p_payload: { eventType },
    })
    if (enqErr) fail(`enqueue:${eventType}`, enqErr.message)
    else ok(`enqueue:${eventType}`, `rows=${count}`)
  }

  const { status, json } = await invokeLinePush(jwt, { recipientIds: [userId] })
  if (status === 200 && json?.ok) {
    ok('line-push:auth-invoke', JSON.stringify({
      sent: json.sent,
      failed: json.failed,
      skipped: json.skipped,
      reason: json.reason,
    }))
  } else {
    fail('line-push:auth-invoke', `HTTP ${status} ${JSON.stringify(json)}`)
  }
}

const sqlOk = await verifySqlRetryColumns()
await testBindColumnWritable()
await testEventEnqueueShapes()
if (sqlOk) {
  await testUnboundDoesNotBlock()
  await testBadTokenDoesNotBlockMainFlow()
}
await testOptionalAuthFlows()

const failed = results.filter((r) => !r.pass)
console.log('\n---')
console.log(`passed=${results.filter((r) => r.pass).length} failed=${failed.length}`)
process.exit(failed.length ? 1 : 0)
