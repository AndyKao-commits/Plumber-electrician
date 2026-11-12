/**
 * Boss / account-permission holders delete a teammate account.
 * Requires confirmName to match the target profile name exactly.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

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

  let body: { targetUserId?: string; confirmName?: string }
  try {
    body = await req.json()
  } catch {
    return json({ error: '無效的請求內容' }, 400)
  }

  const targetUserId = String(body.targetUserId ?? '').trim()
  const confirmName = String(body.confirmName ?? '').trim()
  if (!targetUserId) return json({ error: '缺少目標帳號' }, 400)
  if (!confirmName) return json({ error: '請填寫被刪除者姓名以確認' }, 400)

  const { data: target, error: targetError } = await admin
    .from('profiles')
    .select('id, organization_id, name, role, login_id, phone, email')
    .eq('id', targetUserId)
    .maybeSingle()
  if (targetError || !target) return json({ error: '找不到要刪除的帳號' }, 404)
  if (target.organization_id !== actor.organization_id) {
    return json({ error: '不可刪除其他公司的帳號' }, 403)
  }
  if (target.id === actor.id) return json({ error: '不可刪除自己的帳號' }, 400)
  if (target.role === 'boss' || target.role === 'owner') {
    return json({ error: '不可刪除老闆帳號' }, 400)
  }
  if (confirmName !== String(target.name ?? '').trim()) {
    return json({ error: '姓名不符，請輸入被刪除者正確姓名' }, 400)
  }

  // Purge profile first (hard delete when possible; otherwise soft-clear login fields).
  // profiles.id is no longer FK-bound to auth.users, so Auth can be fully deleted even
  // when a soft-kept profile shell remains for attendance / audit history.
  const { data: purged, error: purgeError } = await userClient.rpc(
    'admin_purge_member_profile',
    {
      p_target_id: targetUserId,
      p_confirm_name: confirmName,
    },
  )
  if (purgeError) {
    return json(
      { error: purgeError.message || '刪除個人資料失敗' },
      400,
    )
  }

  const mode =
    purged && typeof purged === 'object' && 'mode' in purged
      ? String((purged as { mode: string }).mode)
      : 'unknown'
  const name = String(target.name)

  const { error: authDeleteError } = await admin.auth.admin.deleteUser(
    targetUserId,
  )
  if (authDeleteError && !/not\s*found|user.*exist/i.test(authDeleteError.message)) {
    return json({
      ok: true,
      mode,
      id: targetUserId,
      name,
      message:
        mode === 'hard'
          ? `已刪除「${name}」的個人資料，但登入帳號清除失敗：${authDeleteError.message}`
          : `已停用「${name}」並清除登入欄位，但 Auth 刪除失敗：${authDeleteError.message}`,
    })
  }

  return json({
    ok: true,
    mode,
    id: targetUserId,
    name,
    message:
      mode === 'hard'
        ? `已刪除帳號「${name}」`
        : `已刪除「${name}」的登入帳號（歷史出勤／紀錄仍保留，App 內不再顯示）`,
  })
})
