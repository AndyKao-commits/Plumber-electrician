/**
 * Boss / account-permission holders create teammate Auth users.
 * Account may be phone digits or a custom login id.
 * Default password = account. Sets must_change_password.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

const AUTH_LOGIN_EMAIL_DOMAIN = 'login.eg.local'
const LOGIN_ID_RE = /^[a-z][a-z0-9._-]{2,31}$/
const PHONE_LOGIN_RE = /^[0-9]{8,15}$/

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers':
        'authorization, x-client-info, apikey, content-type',
    },
  })
}

function normalizePhoneDigits(raw: string): string {
  let s = String(raw || '').trim().replace(/[\s\-()]/g, '')
  if (s.startsWith('+886')) s = `0${s.slice(4)}`
  else if (s.startsWith('886') && s.length >= 11) s = `0${s.slice(3)}`
  return s.replace(/\D/g, '')
}

function assertAccount(raw: string): { loginId: string; phone: string | null } {
  const trimmed = String(raw || '').trim()
  if (!trimmed) throw new Error('請填寫帳號')
  const digits = normalizePhoneDigits(trimmed)
  if (PHONE_LOGIN_RE.test(digits) && !/[a-zA-Z@]/.test(trimmed)) {
    if (digits.length < 6) throw new Error('帳號至少 6 碼（同時作為預設密碼）')
    return { loginId: digits, phone: digits }
  }
  const id = trimmed.toLowerCase()
  if (id.includes('@')) {
    throw new Error('帳號請填電話或自訂帳號，勿填 Email')
  }
  if (!LOGIN_ID_RE.test(id)) {
    throw new Error(
      '帳號可為電話，或 3–32 碼自訂帳號（開頭英文字母，僅小寫英文、數字、. _ -）',
    )
  }
  if (id.length < 6) throw new Error('帳號至少 6 碼（同時作為預設密碼）')
  return { loginId: id, phone: null }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return json({ ok: true })
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405)

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  if (!supabaseUrl || !anonKey || !serviceKey) {
    return json({ error: 'server misconfigured' }, 500)
  }

  const authHeader = req.headers.get('Authorization') ?? ''
  if (!authHeader.startsWith('Bearer ')) {
    return json({ error: '未登入' }, 401)
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  })
  const admin = createClient(supabaseUrl, serviceKey)

  const {
    data: { user: actorAuth },
    error: authError,
  } = await userClient.auth.getUser()
  if (authError || !actorAuth) return json({ error: '登入已失效' }, 401)

  const { data: actor, error: actorError } = await admin
    .from('profiles')
    .select(
      'id, organization_id, name, role, access_template, features, permission_overrides',
    )
    .eq('id', actorAuth.id)
    .maybeSingle()
  if (actorError || !actor) return json({ error: '找不到管理者資料' }, 403)

  const featureBase = {
    ...((actor.features as Record<string, boolean> | null) ?? {}),
  }
  const overrides =
    (actor.permission_overrides as Record<string, boolean> | null) ?? {}
  const allowed =
    actor.role === 'boss' ||
    actor.role === 'owner' ||
    overrides.account === true ||
    (overrides.account !== false && featureBase.account === true)
  if (!allowed) return json({ error: '無權使用帳號管理' }, 403)

  let body: {
    name?: string
    account?: string
    /** @deprecated use account */
    phone?: string
    roleGroupName?: string | null
  }
  try {
    body = await req.json()
  } catch {
    return json({ error: '無效的請求內容' }, 400)
  }

  const name = String(body.name ?? '').trim()
  if (!name) return json({ error: '請填寫姓名' }, 400)

  let loginId: string
  let phone: string | null
  try {
    const resolved = assertAccount(String(body.account ?? body.phone ?? ''))
    loginId = resolved.loginId
    phone = resolved.phone
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : '帳號無效' }, 400)
  }

  const authEmail = `${loginId}@${AUTH_LOGIN_EMAIL_DOMAIN}`

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: authEmail,
    password: loginId,
    email_confirm: true,
    user_metadata: { name, login_id: loginId },
  })
  if (createError || !created.user) {
    const msg = createError?.message || '建立帳號失敗'
    if (/already|registered|exists/i.test(msg)) {
      return json({ error: '此帳號已註冊過' }, 409)
    }
    return json({ error: msg }, 400)
  }

  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .insert({
      id: created.user.id,
      organization_id: actor.organization_id,
      name,
      role: 'employee',
      email: authEmail,
      phone,
      login_id: loginId,
      finance_authorized: false,
      must_change_password: true,
      account_status: 'active',
      role_group_name: body.roleGroupName?.trim() || null,
      access_template: 'member',
    })
    .select(
      'id, organization_id, name, role, email, login_id, phone, must_change_password, created_at',
    )
    .single()

  if (profileError) {
    await admin.auth.admin.deleteUser(created.user.id)
    return json({ error: profileError.message || '建立個人資料失敗' }, 400)
  }

  await admin.from('audit_logs').insert({
    organization_id: actor.organization_id,
    actor_id: actor.id,
    actor_name: actor.name,
    action: 'account.create',
    target_type: 'profile',
    target_id: created.user.id,
    result: 'ok',
    after_json: JSON.stringify(profile),
  }).then(() => undefined, () => undefined)

  return json({
    ok: true,
    user: profile,
    message: `已建立 ${name}（帳號 ${loginId}）。預設密碼與帳號相同，首次登入需更改密碼。`,
  })
})
