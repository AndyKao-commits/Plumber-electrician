/**
 * LINE webhook — reply-only (DEC-007).
 * Phase 1: flow drafts + batch photo upload + todos Flex.
 * Phase 2: attendance clock/switch-site + purchase apply.
 * No proactive push / broadcast / timeout reminders.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

type Sb = ReturnType<typeof createClient>

type LineEvent = {
  type?: string
  replyToken?: string
  source?: { type?: string; userId?: string }
  message?: { type?: string; text?: string; id?: string }
  postback?: { data?: string }
}

type LineWebhookBody = { events?: LineEvent[] }

type Profile = {
  id: string
  organization_id: string
  name: string | null
  line_user_id: string | null
  role: string | null
}

type FlowType = 'photo_upload' | 'todos' | 'attendance' | 'purchase'
type FlowStatus =
  | 'idle'
  | 'collecting'
  | 'awaiting_confirmation'
  | 'processing'
  | 'completed'
  | 'cancelled'
  | 'paused'
  | 'expired'

function isFlowIntent(v: string | null | undefined): v is FlowType {
  return (
    v === 'photo_upload' ||
    v === 'todos' ||
    v === 'attendance' ||
    v === 'purchase'
  )
}

type DraftRow = {
  id: string
  organization_id: string
  profile_id: string
  line_user_id: string
  flow_type: FlowType
  flow_status: FlowStatus
  current_step: string | null
  draft_payload: Record<string, unknown>
  last_activity_at: string
  paused_at: string | null
  expires_at: string | null
}

type LineMessage = Record<string, unknown>

const PAUSE_AFTER_MS = 30 * 60 * 1000
const EXPIRE_AFTER_MS = 24 * 60 * 60 * 1000

const FLOW_LABELS: Record<FlowType, string> = {
  photo_upload: '上傳照片',
  todos: '待辦事項',
  attendance: '出勤打卡',
  purchase: '採購申請',
}

const PURCHASE_PREAPPROVAL_NTD = 3000
const EMERGENCY_SINGLE_LIMIT_NTD = 5000
const EMERGENCY_DAILY_LIMIT_NTD = 10_000

const PHOTO_TYPE_LABELS: Record<string, string> = {
  before: '施工前',
  during: '施工中',
  after: '施工後',
  acceptance: '驗收',
  unclassified: '尚未分類',
}

Deno.serve(async (req) => {
  const token = Deno.env.get('LINE_CHANNEL_ACCESS_TOKEN') ?? ''
  const secret = Deno.env.get('LINE_CHANNEL_SECRET') ?? ''
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

  if (req.method === 'GET' || req.method === 'HEAD') {
    return json({
      ok: true,
      mode: 'reply_flow_phase2',
      hasToken: token.length > 0,
      hasSecret: secret.length > 0,
      hasServiceKey: serviceKey.length > 0,
    })
  }

  if (req.method !== 'POST') {
    return new Response('method not allowed', { status: 405 })
  }

  const rawBody = await req.text()
  const signature = req.headers.get('x-line-signature') ?? ''

  if (!secret) {
    return json({ ok: false, error: 'LINE_CHANNEL_SECRET not set' }, 500)
  }
  if (!(await verifyLineSignature(rawBody, signature, secret))) {
    return json({ ok: false, error: 'invalid signature' }, 401)
  }

  let body: LineWebhookBody
  try {
    body = JSON.parse(rawBody) as LineWebhookBody
  } catch {
    return json({ ok: false, error: 'invalid json' }, 400)
  }

  if (!token) {
    return json({ ok: true, replied: 0, reason: 'no_token' })
  }

  const admin =
    supabaseUrl && serviceKey
      ? createClient(supabaseUrl, serviceKey, {
          auth: { persistSession: false, autoRefreshToken: false },
        })
      : null

  let replied = 0
  for (const event of body.events ?? []) {
    if (!event.replyToken) continue
    try {
      const messages = await handleEvent(admin, token, event)
      if (messages.length > 0 && (await replyMessages(token, event.replyToken, messages))) {
        replied += 1
      }
    } catch (err) {
      console.warn('[line-webhook] event threw', String(err).slice(0, 300))
      try {
        await replyMessages(token, event.replyToken, [
          textMsg('操作失敗，請稍後再試。未完成的草稿仍會保留。'),
        ])
        replied += 1
      } catch {
        // never crash webhook
      }
    }
  }

  return json({ ok: true, replied })
})

async function handleEvent(
  admin: Sb | null,
  lineToken: string,
  event: LineEvent,
): Promise<LineMessage[]> {
  const lineUserId = String(event.source?.userId ?? '').trim()

  if (event.type === 'follow') {
    return [
      textMsg(
        '歡迎加入。請用下方圖文選單操作。\n綁定：工程管家「今日團隊」→ 用 LINE 綁定。\n上傳照片／待辦事項可直接從選單進入。',
      ),
    ]
  }

  if (event.type === 'postback') {
    return handlePostback(admin, lineToken, lineUserId, String(event.postback?.data ?? ''))
  }

  if (event.type !== 'message') return []

  const msgType = String(event.message?.type ?? '')
  const text = String(event.message?.text ?? '').trim()

  if (msgType === 'image') {
    return handleImageEvent(admin, lineToken, lineUserId, String(event.message?.id ?? ''))
  }

  if (msgType !== 'text') return []

  const bindCode = extractBindCode(text)
  if (bindCode) {
    return [textMsg(await handleBind(admin, bindCode, lineUserId))]
  }

  // Quote cases: view-only (list / detail / export link) — no LINE editor
  if (/報價管理|報價案件|報價/.test(text) && !/採購/.test(text)) {
    const profile = await requireProfile(admin, lineUserId)
    if ('error' in profile) return [textMsg(profile.error)]
    return buildQuotesLineMessages(admin, profile)
  }

  return handleTextCommand(admin, lineUserId, text)
}

async function handleTextCommand(
  admin: Sb | null,
  lineUserId: string,
  text: string,
): Promise<LineMessage[]> {
  const intent = parseMenuIntent(text)
  const profile = await requireProfile(admin, lineUserId)
  if ('error' in profile) {
    if (intent) return [textMsg(profile.error)]
    return []
  }

  const gate = await prepareActiveDraft(admin, profile)

  // Expired: clear notice, then allow starting a new intent in the same turn
  if (gate.age === 'expired') {
    const notice = gate.messages ?? [
      textMsg('原本未完成的操作已超過保留時間，草稿已清除。'),
    ]
    if (isFlowIntent(intent)) {
      return [...notice, ...(await startFlow(admin, profile, intent))]
    }
    return notice
  }

  // Paused: same feature → resume prompt path; other feature → switch guard
  if (gate.age === 'paused' && gate.draft) {
    if (intent === 'cancel') {
      await finalizeDraft(admin, gate.draft.id, 'cancelled')
      return [
        flexMenu({
          altText: '已取消目前操作',
          eyebrow: '操作取消',
          title: '已取消',
          body: '請再點圖文選單開始新功能',
        }),
      ]
    }
    if (intent === 'resume' || intent === gate.draft.flow_type) {
      return resumeDraft(admin, profile, gate.draft)
    }
    if (isFlowIntent(intent)) {
      return switchGuardMessages(gate.draft, intent)
    }
    return gate.messages ?? []
  }

  if (intent === 'cancel') {
    if (!gate.draft) {
      return [
        flexMenu({
          altText: '沒有進行中的操作',
          eyebrow: '操作取消',
          title: '沒有進行中的操作',
          body: '可從圖文選單開始功能',
        }),
      ]
    }
    await finalizeDraft(admin, gate.draft.id, 'cancelled')
    return [
      flexMenu({
        altText: '已取消目前操作',
        eyebrow: '操作取消',
        title: '已取消',
        body: '可再從圖文選單開始新功能',
      }),
    ]
  }

  if (intent === 'resume') {
    if (!gate.draft) return [textMsg('目前沒有可繼續的操作。')]
    return resumeDraft(admin, profile, gate.draft)
  }

  if (isFlowIntent(intent)) {
    if (gate.draft && gate.draft.flow_type !== intent) {
      return switchGuardMessages(gate.draft, intent)
    }
    if (gate.draft && gate.draft.flow_type === intent) {
      return resumeDraft(admin, profile, gate.draft)
    }
    return startFlow(admin, profile, intent)
  }

  // In-flow free text
  if (gate.draft?.flow_type === 'photo_upload') {
    return handlePhotoText(admin, profile, gate.draft, text)
  }
  if (gate.draft?.flow_type === 'attendance') {
    return handleAttendanceText(admin, profile, gate.draft, text)
  }
  if (gate.draft?.flow_type === 'purchase') {
    return handlePurchaseText(admin, profile, gate.draft, text)
  }

  // Silent for unrelated chatter (rich menu handles entry)
  return []
}

async function handlePostback(
  admin: Sb | null,
  lineToken: string,
  lineUserId: string,
  data: string,
): Promise<LineMessage[]> {
  const params = parsePostbackData(data)
  const action = params.a || ''
  const profile = await requireProfile(admin, lineUserId)
  if ('error' in profile) return [textMsg(profile.error)]

  const gate = await prepareActiveDraft(admin, profile)
  if (gate.messages && action !== 'resume' && action !== 'cancel' && action !== 'switch') {
    // expired/paused prompts already returned when needed
    if (gate.age === 'expired' || gate.age === 'paused') return gate.messages
  }
  if (gate.messages && (gate.age === 'expired' || gate.age === 'paused') && action !== 'resume' && action !== 'cancel' && action !== 'switch') {
    return gate.messages
  }

  if (action === 'cancel') {
    if (gate.draft) await finalizeDraft(admin, gate.draft.id, 'cancelled')
    return [
      flexMenu({
        altText: '已取消目前操作',
        eyebrow: '操作取消',
        title: '已取消',
        body: '可再從圖文選單開始新功能',
      }),
    ]
  }

  if (action === 'resume') {
    if (!gate.draft) return [textMsg('目前沒有可繼續的操作。')]
    if (gate.draft.flow_status === 'paused') {
      await touchDraft(admin, gate.draft.id, {
        flow_status: 'collecting',
        paused_at: null,
        expires_at: null,
      })
      gate.draft.flow_status = 'collecting'
    }
    return resumeDraft(admin, profile, gate.draft)
  }

  if (action === 'switch') {
    const to = params.to as FlowType
    if (!isFlowIntent(to)) {
      return [textMsg('無法辨識要切換的功能。')]
    }
    if (gate.draft) await finalizeDraft(admin, gate.draft.id, 'cancelled')
    return startFlow(admin, profile, to)
  }

  if (action === 'att_in') {
    const draft =
      gate.draft?.flow_type === 'attendance'
        ? gate.draft
        : await createDraft(admin, profile, 'attendance', 'menu', {})
    return clockInLine(admin, profile, draft)
  }

  if (action === 'att_out') {
    if (!gate.draft || gate.draft.flow_type !== 'attendance') {
      return [textMsg('請先點「出勤打卡」。')]
    }
    return clockOutLine(admin, profile, gate.draft)
  }

  if (action === 'att_site') {
    if (!gate.draft || gate.draft.flow_type !== 'attendance') {
      return [textMsg('請先點「出勤打卡」。')]
    }
    return promptAttendanceSite(admin, profile, gate.draft)
  }

  if (action === 'att_site_pick') {
    if (!gate.draft || gate.draft.flow_type !== 'attendance') {
      return [textMsg('請先點「出勤打卡」。')]
    }
    return assignAttendanceSite(admin, profile, gate.draft, params.id || '')
  }

  if (action === 'att_done') {
    if (gate.draft?.flow_type === 'attendance') {
      await finalizeDraft(admin, gate.draft.id, 'completed')
    }
    return [
      flexMenu({
        altText: '已結束出勤選單',
        eyebrow: '出勤打卡',
        title: '已結束',
        body: '出勤選單已關閉，可再從圖文選單開始',
      }),
    ]
  }

  if (action === 'photo_cancel') {
    if (gate.draft) await finalizeDraft(admin, gate.draft.id, 'cancelled')
    return [
      flexMenu({
        altText: '已取消上傳',
        eyebrow: '上傳照片',
        title: '已取消上傳',
        body: '可再從圖文選單重新開始',
      }),
    ]
  }

  if (action === 'pur_mode') {
    if (!gate.draft || gate.draft.flow_type !== 'purchase') {
      return [textMsg('請先點「採購申請」。')]
    }
    return selectPurchaseMode(admin, gate.draft, params.m || '')
  }

  if (action === 'pur_site') {
    if (!gate.draft || gate.draft.flow_type !== 'purchase') {
      return [textMsg('請先點「採購申請」。')]
    }
    return selectPurchaseSite(admin, profile, gate.draft, params.id || '')
  }

  if (action === 'pur_site_skip') {
    if (!gate.draft || gate.draft.flow_type !== 'purchase') {
      return [textMsg('請先點「採購申請」。')]
    }
    return promptPurchaseConfirm(admin, gate.draft)
  }

  if (action === 'pur_confirm') {
    if (!gate.draft || gate.draft.flow_type !== 'purchase') {
      return [textMsg('請先點「採購申請」。')]
    }
    return submitPurchase(admin, profile, gate.draft)
  }

  if (action === 'photo_site') {
    if (!gate.draft || gate.draft.flow_type !== 'photo_upload') {
      return [textMsg('目前沒有進行中的上傳照片流程。請先點「上傳照片」。')]
    }
    return selectPhotoSite(admin, profile, gate.draft, params.id || '')
  }

  if (action === 'photo_type') {
    if (!gate.draft || gate.draft.flow_type !== 'photo_upload') {
      return [textMsg('目前沒有進行中的上傳照片流程。')]
    }
    return selectPhotoType(admin, gate.draft, params.t || '')
  }

  if (action === 'photo_done') {
    if (!gate.draft || gate.draft.flow_type !== 'photo_upload') {
      return [textMsg('目前沒有進行中的上傳照片流程。')]
    }
    return completePhotoBatch(admin, gate.draft)
  }

  if (action === 'todo_done') {
    return completeTodo(admin, profile, params.id || '')
  }

  if (action === 'todo_view') {
    return viewTodo(admin, profile, params.id || '')
  }

  if (action === 'quote_view') {
    return viewQuoteOnLine(admin, profile, params.id || '')
  }

  void lineToken
  return [textMsg('無法處理此操作。')]
}

async function handleImageEvent(
  admin: Sb | null,
  lineToken: string,
  lineUserId: string,
  messageId: string,
): Promise<LineMessage[]> {
  const profile = await requireProfile(admin, lineUserId)
  if ('error' in profile) return [textMsg(profile.error)]

  const gate = await prepareActiveDraft(admin, profile)
  if (gate.messages && (gate.age === 'paused' || gate.age === 'expired')) {
    return gate.messages
  }

  if (!gate.draft || gate.draft.flow_type !== 'photo_upload') {
    return [
      textMsg(
        '請先從圖文選單點「上傳照片」，選擇工地與類型後再傳圖。\n（直接傳圖不會自動開始新流程，以免覆蓋其他未完成操作。）',
      ),
    ]
  }

  const payload = gate.draft.draft_payload || {}
  if (!payload.siteId || !payload.photoType || !payload.batchId) {
    return [
      textMsg('請先完成工地與照片類型選擇，再傳送照片。'),
      ...(await resumeDraft(admin, profile, gate.draft)),
    ]
  }

  const result = await storeLineImage(admin, lineToken, profile, messageId, {
    siteId: String(payload.siteId),
    photoType: String(payload.photoType),
    batchId: String(payload.batchId),
  })

  if (!result.ok) {
    return [textMsg(result.error)]
  }

  const count = Number(payload.photoCount ?? 0) + 1
  await touchDraft(admin, gate.draft.id, {
    current_step: 'receiving',
    draft_payload: { ...payload, photoCount: count },
  })

  return [
    flexMenu({
      altText: `已加入第 ${count} 張照片`,
      eyebrow: '上傳照片',
      title: `已加入第 ${count} 張`,
      body: '可繼續傳圖，或點下方按鈕完成／取消',
      buttons: [
        { label: '繼續上傳', data: 'a=resume', style: 'primary' },
        { label: '完成上傳', data: 'a=photo_done', style: 'secondary' },
        { label: '取消上傳', data: 'a=photo_cancel', style: 'secondary' },
      ],
    }),
  ]
}

async function startFlow(
  admin: Sb,
  profile: Profile,
  flowType: FlowType,
): Promise<LineMessage[]> {
  if (flowType === 'todos') {
    const draft = await createDraft(admin, profile, 'todos', 'listing', {})
    const msgs = await buildTodosMessages(admin, profile)
    await finalizeDraft(admin, draft.id, 'completed')
    return msgs
  }

  if (flowType === 'attendance') {
    const draft = await createDraft(admin, profile, 'attendance', 'menu', {})
    return promptAttendanceMenu(admin, profile, draft)
  }

  if (flowType === 'purchase') {
    const draft = await createDraft(admin, profile, 'purchase', 'select_mode', {})
    return promptPurchaseMode()
  }

  const draft = await createDraft(admin, profile, 'photo_upload', 'select_site', {})
  return promptSelectSite(admin, profile, draft)
}

async function resumeDraft(
  admin: Sb,
  profile: Profile,
  draft: DraftRow,
): Promise<LineMessage[]> {
  await touchDraft(admin, draft.id, {
    flow_status: draft.flow_status === 'paused' ? 'collecting' : draft.flow_status,
    paused_at: null,
  })

  if (draft.flow_type === 'todos') {
    const msgs = await buildTodosMessages(admin, profile)
    await finalizeDraft(admin, draft.id, 'completed')
    return msgs
  }

  if (draft.flow_type === 'attendance') {
    return promptAttendanceMenu(admin, profile, draft)
  }

  if (draft.flow_type === 'purchase') {
    return resumePurchase(admin, profile, draft)
  }

  const step = draft.current_step || 'select_site'
  const payload = draft.draft_payload || {}
  if (step === 'select_site' || !payload.siteId) {
    return promptSelectSite(admin, profile, draft)
  }
  if (step === 'select_type' || !payload.photoType) {
    return promptSelectPhotoType()
  }
  return [
    flexMenu({
      altText: '繼續上傳照片',
      eyebrow: '上傳照片',
      title: '繼續上傳',
      body: `工地：${payload.siteName || '—'}\n類型：${
        PHOTO_TYPE_LABELS[String(payload.photoType)] || payload.photoType
      }\n已收：${payload.photoCount ?? 0} 張\n請直接傳圖`,
      buttons: [
        { label: '完成上傳', data: 'a=photo_done', style: 'primary' },
        { label: '取消上傳', data: 'a=photo_cancel', style: 'secondary' },
      ],
    }),
  ]
}

async function handlePhotoText(
  admin: Sb,
  profile: Profile,
  draft: DraftRow,
  text: string,
): Promise<LineMessage[]> {
  if (/完成上傳|完成/.test(text)) return completePhotoBatch(admin, draft)
  if (/取消上傳|取消/.test(text)) {
    await finalizeDraft(admin, draft.id, 'cancelled')
    return [
      flexMenu({
        altText: '已取消上傳',
        eyebrow: '上傳照片',
        title: '已取消上傳',
        body: '可再從圖文選單重新開始',
      }),
    ]
  }
  if (/繼續上傳|繼續/.test(text)) return resumeDraft(admin, profile, draft)

  const type = photoTypeFromInput(text)
  if (type && (draft.current_step === 'select_type' || draft.draft_payload?.siteId)) {
    return selectPhotoType(admin, draft, type)
  }

  // Numeric site selection 1-N
  const num = Number(text)
  if (Number.isInteger(num) && num >= 1 && draft.current_step === 'select_site') {
    const sites = await listSites(admin, profile.organization_id)
    const site = sites[num - 1]
    if (site) return selectPhotoSite(admin, profile, draft, site.id)
  }

  return resumeDraft(admin, profile, draft)
}

async function promptSelectSite(
  admin: Sb,
  profile: Profile,
  draft: DraftRow,
): Promise<LineMessage[]> {
  const sites = await listSites(admin, profile.organization_id)
  if (sites.length === 0) {
    await finalizeDraft(admin, draft.id, 'cancelled')
    return [
      flexMenu({
        altText: '沒有可用工地',
        eyebrow: '上傳照片',
        title: '沒有可用工地',
        body: '請先到工程管家建立工地',
        buttons: [{ label: '取消', data: 'a=cancel', style: 'secondary' }],
      }),
    ]
  }

  await touchDraft(admin, draft.id, { current_step: 'select_site' })

  return siteCarousel({
    altText: '上傳照片：請選擇工地',
    eyebrow: '上傳照片',
    sites,
    actionPrefix: 'a=photo_site&id=',
    extraButtons: [{ label: '取消', data: 'a=cancel', style: 'secondary' }],
  })
}

function promptSelectPhotoType(): LineMessage[] {
  const bubbles = Object.entries(PHOTO_TYPE_LABELS).map(([code, label]) =>
    actionBubble({
      eyebrow: '上傳照片',
      title: label,
      body: '點下方按鈕選擇此類型',
      buttons: [
        { label: '選擇', data: `a=photo_type&t=${code}`, style: 'primary' },
      ],
    }),
  )
  bubbles.push(
    actionBubble({
      eyebrow: '上傳照片',
      title: '取消',
      body: '結束上傳流程',
      buttons: [{ label: '取消上傳', data: 'a=photo_cancel', style: 'secondary' }],
    }),
  )
  return [
    {
      type: 'flex',
      altText: '請選擇照片類型',
      contents: {
        type: 'carousel',
        contents: bubbles.slice(0, 12),
      },
    },
  ]
}

async function selectPhotoSite(
  admin: Sb,
  profile: Profile,
  draft: DraftRow,
  siteId: string,
): Promise<LineMessage[]> {
  const sites = await listSites(admin, profile.organization_id)
  const site = sites.find((s) => s.id === siteId)
  if (!site) return [textMsg('找不到工地，請重新選擇。'), ...(await promptSelectSite(admin, profile, draft))]

  await touchDraft(admin, draft.id, {
    current_step: 'select_type',
    draft_payload: {
      ...draft.draft_payload,
      siteId: site.id,
      siteName: site.name,
    },
  })
  return promptSelectPhotoType()
}

async function selectPhotoType(
  admin: Sb,
  draft: DraftRow,
  typeCode: string,
): Promise<LineMessage[]> {
  if (!PHOTO_TYPE_LABELS[typeCode]) {
    return [textMsg('照片類型無效。'), ...promptSelectPhotoType()]
  }
  const batchId = crypto.randomUUID()
  const payload = {
    ...draft.draft_payload,
    photoType: typeCode,
    batchId,
    photoCount: 0,
  }
  await touchDraft(admin, draft.id, {
    current_step: 'receiving',
    flow_status: 'collecting',
    draft_payload: payload,
  })
  return [
    flexMenu({
      altText: '請傳送照片',
      eyebrow: '上傳照片',
      title: '請傳送照片',
      body: `工地：${payload.siteName}\n類型：${PHOTO_TYPE_LABELS[typeCode]}\n請連續傳圖（可多張）`,
      buttons: [
        { label: '完成上傳', data: 'a=photo_done', style: 'primary' },
        { label: '取消上傳', data: 'a=photo_cancel', style: 'secondary' },
      ],
    }),
  ]
}

async function completePhotoBatch(admin: Sb, draft: DraftRow): Promise<LineMessage[]> {
  const payload = draft.draft_payload || {}
  const batchId = String(payload.batchId ?? '')
  const count = Number(payload.photoCount ?? 0)
  if (!batchId || count <= 0) {
    return [
      flexMenu({
        altText: '尚未收到照片',
        eyebrow: '上傳照片',
        title: '尚未收到照片',
        body: '請先傳圖，或取消上傳',
        buttons: [
          { label: '取消上傳', data: 'a=photo_cancel', style: 'secondary' },
        ],
      }),
    ]
  }

  // Mark batch photos linked (site already set on insert)
  const { error } = await admin
    .from('photo_uploads')
    .update({ status: 'linked' })
    .eq('batch_id', batchId)
    .eq('status', 'pending')
  if (error) {
    console.warn('[line-webhook] complete batch failed', error.message)
    return [
      flexMenu({
        altText: '完成上傳失敗',
        eyebrow: '上傳照片',
        title: '寫入失敗',
        body: '草稿仍保留，請稍後再試完成上傳',
        buttons: [
          { label: '完成上傳', data: 'a=photo_done', style: 'primary' },
          { label: '取消上傳', data: 'a=photo_cancel', style: 'secondary' },
        ],
      }),
    ]
  }

  await finalizeDraft(admin, draft.id, 'completed')
  const photosUri = `${appBaseUrl()}/photos`
  return [
    flexMenu({
      altText: '上傳完成',
      eyebrow: '上傳照片',
      title: '上傳完成',
      body: `成功：${count} 張\n失敗：0 張\n工地：${payload.siteName}\n類型：${
        PHOTO_TYPE_LABELS[String(payload.photoType)] || payload.photoType
      }`,
      buttons: [{ label: '查看照片', uri: photosUri, style: 'primary' }],
    }),
  ]
}

async function buildQuotesLineMessages(
  admin: Sb,
  profile: Profile,
): Promise<LineMessage[]> {
  const { data, error } = await admin
    .from('quotations')
    .select(
      'id, title, quote_number, customer_name, site_address, amount_after_tax, workflow_status, current_version, updated_at',
    )
    .eq('organization_id', profile.organization_id)
    .order('updated_at', { ascending: false })
    .limit(10)
  if (error) {
    console.warn('[line-webhook] quotes query failed', error.message)
    return [textMsg('讀取報價失敗，請稍後再試。')]
  }
  const rows = data ?? []
  if (rows.length === 0) {
    return [
      flexMenu({
        altText: '尚無報價案件',
        eyebrow: '報價管理',
        title: '尚無報價案件',
        body: '請到工程管家建立報價案件後再查看',
        buttons: [
          {
            label: '開啟報價',
            uri: `${appBaseUrl()}/quotes`,
            style: 'primary',
          },
        ],
      }),
    ]
  }

  const appBase = appBaseUrl()
  const bubbles = rows.map((q) => {
    const status = String(q.workflow_status || 'editing')
    const total = Number(q.amount_after_tax || 0)
    return actionBubble({
      eyebrow: '報價案件',
      title: String(q.title || '報價').slice(0, 40),
      body: `${q.quote_number || ''}\n客戶：${q.customer_name || '—'}\n總額：NT$${total.toLocaleString()}\n狀態：${status}${
        q.current_version ? ` · v${q.current_version}` : ''
      }`,
      buttons: [
        {
          label: '查看細項',
          data: `a=quote_view&id=${q.id}`,
          style: 'primary',
        },
        {
          label: '開啟匯出',
          uri: `${appBase}/quotes/${q.id}?export=1`,
          style: 'secondary',
        },
      ],
    })
  })

  return [
    {
      type: 'flex',
      altText: `報價案件 ${rows.length} 筆`,
      contents: {
        type: 'carousel',
        contents: bubbles.slice(0, 10),
      },
    },
  ]
}

async function viewQuoteOnLine(
  admin: Sb,
  profile: Profile,
  quoteId: string,
): Promise<LineMessage[]> {
  const { data: quote, error } = await admin
    .from('quotations')
    .select(
      'id, title, quote_number, customer_name, site_address, amount_after_tax, amount_before_tax, discount, tax_amount, workflow_status, current_version',
    )
    .eq('id', quoteId)
    .eq('organization_id', profile.organization_id)
    .maybeSingle()
  if (error || !quote) {
    return [textMsg('找不到此報價案件。')]
  }
  const { data: items } = await admin
    .from('quotation_items')
    .select('line_no, kind, description, qty, unit, unit_price, amount')
    .eq('quotation_id', quoteId)
    .order('line_no', { ascending: true })
    .limit(20)
  const lines = (items ?? [])
    .map(
      (i) =>
        `${i.line_no}. ${i.description} ${i.qty}${i.unit} NT$${Number(i.amount).toLocaleString()}`,
    )
    .join('\n')
  return [
    flexMenu({
      altText: `報價 ${quote.title}`,
      eyebrow: '報價細項',
      title: String(quote.title).slice(0, 40),
      body: `${quote.quote_number || ''}\n客戶：${quote.customer_name || '—'}\n地址：${
        quote.site_address || '—'
      }\n小計 NT$${Number(quote.amount_before_tax || 0).toLocaleString()} · 折扣 NT$${Number(
        quote.discount || 0,
      ).toLocaleString()} · 稅額 NT$${Number(quote.tax_amount || 0).toLocaleString()}\n總額 NT$${Number(
        quote.amount_after_tax || 0,
      ).toLocaleString()}\n\n${lines || '（無細項）'}`,
      buttons: [
        {
          label: '匯出報價連結',
          uri: `${appBaseUrl()}/quotes/${quote.id}?export=1`,
          style: 'primary',
        },
        {
          label: '開啟案件',
          uri: `${appBaseUrl()}/quotes/${quote.id}`,
          style: 'secondary',
        },
      ],
    }),
  ]
}

async function buildTodosMessages(admin: Sb, profile: Profile): Promise<LineMessage[]> {
  const { data, error } = await admin
    .from('notices')
    .select('id, title, detail, status, href, created_at')
    .eq('user_id', profile.id)
    .eq('organization_id', profile.organization_id)
    .eq('kind', 'todo')
    .eq('status', 'open')
    .order('created_at', { ascending: false })
    .limit(10)

  if (error) {
    console.warn('[line-webhook] todos query failed', error.message)
    return [textMsg('讀取待辦失敗，請稍後再試。')]
  }

  const todos = data ?? []
  if (todos.length === 0) return [textMsg('目前沒有待辦事項')]

  const appBase = appBaseUrl()
  const bubbles = todos.map((t) => todoBubble(t, appBase))
  return [
    {
      type: 'flex',
      altText: `待辦事項 ${todos.length} 筆`,
      contents: {
        type: 'carousel',
        contents: bubbles,
      },
    },
  ]
}

function appBaseUrl(): string {
  const fromEnv = (Deno.env.get('APP_BASE_URL') ?? '').trim().replace(/\/$/, '')
  return fromEnv || 'https://plumber-electrician-seven.vercel.app'
}

function todoViewUri(
  href: string | null | undefined,
  appBase: string,
): string {
  const raw = (href || '/todos').trim()
  if (/^https?:\/\//i.test(raw)) return raw
  const path = raw.startsWith('/') ? raw : `/${raw}`
  return `${appBase}${path}`
}

function todoBubble(
  t: {
    id: string
    title: string
    detail: string | null
    href: string | null
    created_at: string
  },
  appBase: string,
): Record<string, unknown> {
  const detail = (t.detail || '').slice(0, 120) || '（無說明）'
  return {
    type: 'bubble',
    body: {
      type: 'box',
      layout: 'vertical',
      contents: [
        { type: 'text', text: '待辦', size: 'xs', color: '#888888' },
        {
          type: 'text',
          text: String(t.title).slice(0, 40),
          weight: 'bold',
          size: 'md',
          wrap: true,
        },
        { type: 'text', text: detail, size: 'sm', wrap: true, color: '#555555' },
      ],
      spacing: 'sm',
    },
    footer: {
      type: 'box',
      layout: 'vertical',
      spacing: 'sm',
      contents: [
        {
          type: 'button',
          style: 'primary',
          color: '#1B3A4B',
          action: {
            type: 'postback',
            label: '標記完成',
            data: `a=todo_done&id=${t.id}`,
            displayText: '標記完成',
          },
        },
        {
          type: 'button',
          style: 'secondary',
          action: {
            type: 'uri',
            label: '查看',
            uri: todoViewUri(t.href, appBase),
          },
        },
      ],
    },
  }
}

async function completeTodo(
  admin: Sb,
  profile: Profile,
  todoId: string,
): Promise<LineMessage[]> {
  if (!todoId) return [textMsg('待辦編號無效。')]
  const { data, error } = await admin
    .from('notices')
    .update({ status: 'done', unread: false })
    .eq('id', todoId)
    .eq('user_id', profile.id)
    .eq('organization_id', profile.organization_id)
    .eq('kind', 'todo')
    .select('id, title')
    .maybeSingle()
  if (error) {
    console.warn('[line-webhook] complete todo failed', error.message)
    return [textMsg('標記完成失敗，請稍後再試。')]
  }
  if (!data) return [textMsg('找不到此待辦，或無權限操作。')]
  return [textMsg(`已完成：${data.title}\n網站待辦中心會同步更新。`)]
}

async function viewTodo(
  admin: Sb,
  profile: Profile,
  todoId: string,
): Promise<LineMessage[]> {
  const { data, error } = await admin
    .from('notices')
    .select('id, title, detail, href, status, created_at')
    .eq('id', todoId)
    .eq('user_id', profile.id)
    .eq('organization_id', profile.organization_id)
    .maybeSingle()
  if (error || !data) return [textMsg('找不到此待辦。')]
  const href = data.href ? `\n連結：請到工程管家開啟 ${data.href}` : ''
  return [
    textMsg(
      `【${data.title}】\n${data.detail || '（無說明）'}\n狀態：${data.status}${href}`,
    ),
  ]
}

function switchGuardMessages(draft: DraftRow, next: FlowType): LineMessage[] {
  const summary = summarizeDraft(draft)
  return [
    flexMenu({
      altText: '有尚未完成的操作',
      eyebrow: '切換功能',
      title: '有尚未完成的操作',
      body: `${FLOW_LABELS[draft.flow_type]}\n已填寫：${summary.filled}\n尚未完成：${summary.pending}`,
      buttons: [
        {
          label: `取消並${FLOW_LABELS[next]}`.slice(0, 20),
          data: `a=switch&to=${next}`,
          style: 'primary',
        },
        {
          label: `繼續${FLOW_LABELS[draft.flow_type]}`.slice(0, 20),
          data: 'a=resume',
          style: 'secondary',
        },
      ],
    }),
  ]
}

/**
 * Load active draft and apply passive timeout rules on next user action.
 */
async function prepareActiveDraft(
  admin: Sb | null,
  profile: Profile,
): Promise<{
  draft: DraftRow | null
  age: 'fresh' | 'paused' | 'expired' | 'none'
  messages?: LineMessage[]
}> {
  if (!admin) return { draft: null, age: 'none' }
  const draft = await getActiveDraft(admin, profile.line_user_id || '')
  if (!draft) return { draft: null, age: 'none' }

  const age = classifyAge(draft.last_activity_at)
  if (age === 'fresh') return { draft, age }

  if (age === 'expired') {
    await finalizeDraft(admin, draft.id, 'expired')
    return {
      draft: null,
      age: 'expired',
      messages: [textMsg('原本未完成的操作已超過保留時間，草稿已清除。')],
    }
  }

  // paused band — do NOT bump last_activity_at (would reset the idle clock)
  if (draft.flow_status !== 'paused') {
    const { error } = await admin
      .from('line_flow_drafts')
      .update({
        flow_status: 'paused',
        paused_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', draft.id)
    if (error) console.warn('[line-webhook] mark paused failed', error.message)
    draft.flow_status = 'paused'
  }

  const summary = summarizeDraft(draft)
  return {
    draft,
    age: 'paused',
    messages: [
      flexMenu({
        altText: '暫停中的操作',
        eyebrow: '暫停提醒',
        title: '有暫停中的操作',
        body: `類型：${FLOW_LABELS[draft.flow_type]}\n工地：${
          draft.draft_payload?.siteName || '—'
        }\n已填寫：${summary.filled}\n最後操作：${formatTaipei(draft.last_activity_at)}`,
        buttons: [
          { label: '繼續操作', data: 'a=resume', style: 'primary' },
          { label: '取消並開始新功能', data: 'a=cancel', style: 'secondary' },
        ],
      }),
    ],
  }
}

function summarizeDraft(draft: DraftRow): { filled: string; pending: string } {
  const p = draft.draft_payload || {}
  if (draft.flow_type === 'attendance') {
    return {
      filled: p.openShift ? '上班中' : '選單',
      pending: p.selectingSite ? '選擇工地' : '完成打卡操作',
    }
  }
  if (draft.flow_type === 'purchase') {
    const filled: string[] = []
    const pending: string[] = []
    if (p.mode) filled.push(p.mode === 'emergency' ? '緊急' : '一般')
    else pending.push('選擇類型')
    if (p.title) filled.push('品名')
    else if (p.mode) pending.push('填寫品名')
    if (p.goodsAmount != null) filled.push('金額')
    else if (p.title) pending.push('填寫金額')
    if (p.siteName) filled.push('工地')
    if (p.title && p.goodsAmount != null) pending.push('確認送出')
    return {
      filled: filled.length ? filled.join('、') : '尚無',
      pending: pending.length ? pending.join('、') : '確認送出',
    }
  }
  if (draft.flow_type !== 'photo_upload') {
    return { filled: '進行中', pending: '完成操作' }
  }
  const filled: string[] = []
  const pending: string[] = []
  if (p.siteName) filled.push('工地')
  else pending.push('選擇工地')
  if (p.photoType) filled.push('照片類型')
  else if (p.siteName) pending.push('選擇照片類型')
  if (Number(p.photoCount ?? 0) > 0) filled.push(`${p.photoCount} 張照片`)
  else if (p.photoType) pending.push('傳送照片')
  if (p.step === 'receiving' || Number(p.photoCount ?? 0) > 0 || p.photoType) {
    pending.push('確認送出')
  }
  return {
    filled: filled.length ? filled.join('、') : '尚無',
    pending: pending.length ? pending.join('、') : '確認送出',
  }
}

async function requireProfile(
  admin: Sb | null,
  lineUserId: string,
): Promise<Profile | { error: string }> {
  if (!admin) return { error: '伺服器尚未設定資料庫。' }
  if (!lineUserId) return { error: '讀不到你的 LINE User ID。' }
  const { data, error } = await admin
    .from('profiles')
    .select('id, organization_id, name, line_user_id, role')
    .eq('line_user_id', lineUserId)
    .maybeSingle()
  if (error) {
    console.warn('[line-webhook] profile lookup failed', error.message)
    return { error: '查詢帳號時出錯。' }
  }
  if (!data) {
    return {
      error: '尚未綁定系統帳號。請先到工程管家「今日團隊」按「用 LINE 綁定」。',
    }
  }
  return data as Profile
}

async function getActiveDraft(admin: Sb, lineUserId: string): Promise<DraftRow | null> {
  const { data, error } = await admin
    .from('line_flow_drafts')
    .select(
      'id, organization_id, profile_id, line_user_id, flow_type, flow_status, current_step, draft_payload, last_activity_at, paused_at, expires_at',
    )
    .eq('line_user_id', lineUserId)
    .in('flow_status', ['collecting', 'awaiting_confirmation', 'processing', 'paused'])
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) {
    console.warn('[line-webhook] get draft failed', error.message)
    return null
  }
  if (!data) return null
  return {
    ...(data as DraftRow),
    draft_payload: (data.draft_payload as Record<string, unknown>) || {},
  }
}

async function createDraft(
  admin: Sb,
  profile: Profile,
  flowType: FlowType,
  step: string,
  payload: Record<string, unknown>,
): Promise<DraftRow> {
  const { data, error } = await admin
    .from('line_flow_drafts')
    .insert({
      organization_id: profile.organization_id,
      profile_id: profile.id,
      line_user_id: profile.line_user_id,
      flow_type: flowType,
      flow_status: 'collecting',
      current_step: step,
      draft_payload: payload,
      last_activity_at: new Date().toISOString(),
    })
    .select(
      'id, organization_id, profile_id, line_user_id, flow_type, flow_status, current_step, draft_payload, last_activity_at, paused_at, expires_at',
    )
    .single()
  if (error) {
    console.warn('[line-webhook] create draft failed', error.message)
    throw new Error('無法建立流程草稿')
  }
  return {
    ...(data as DraftRow),
    draft_payload: (data.draft_payload as Record<string, unknown>) || {},
  }
}

async function touchDraft(
  admin: Sb,
  draftId: string,
  patch: Partial<{
    flow_status: FlowStatus
    current_step: string | null
    draft_payload: Record<string, unknown>
    paused_at: string | null
    expires_at: string | null
  }>,
): Promise<void> {
  const { error } = await admin
    .from('line_flow_drafts')
    .update({
      ...patch,
      last_activity_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', draftId)
  if (error) console.warn('[line-webhook] touch draft failed', error.message)
}

async function finalizeDraft(
  admin: Sb,
  draftId: string,
  status: 'completed' | 'cancelled' | 'expired',
): Promise<void> {
  const { error } = await admin
    .from('line_flow_drafts')
    .update({
      flow_status: status,
      current_step: null,
      draft_payload: {},
      paused_at: null,
      expires_at: null,
      last_activity_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', draftId)
  if (error) console.warn('[line-webhook] finalize draft failed', error.message)
}

async function listSites(
  admin: Sb,
  organizationId: string,
): Promise<Array<{ id: string; name: string }>> {
  // project_status enum: active | pending_close | closed | warranty (no "archived")
  const { data, error } = await admin
    .from('sites')
    .select('id, name, status')
    .eq('organization_id', organizationId)
    .in('status', ['active', 'pending_close', 'warranty'])
    .order('updated_at', { ascending: false })
    .limit(10)
  if (error) {
    console.warn('[line-webhook] list sites failed', error.message)
    return []
  }
  return (data ?? []).map((s) => ({ id: String(s.id), name: String(s.name) }))
}

async function storeLineImage(
  admin: Sb | null,
  lineToken: string,
  profile: Profile,
  messageId: string,
  meta: { siteId: string; photoType: string; batchId: string },
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!admin) return { ok: false, error: '收圖失敗：伺服器尚未設定資料庫。' }
  if (!messageId) return { ok: false, error: '收圖失敗：缺少訊息編號。' }

  try {
    const contentRes = await fetch(`https://api-data.line.me/v2/bot/message/${messageId}/content`, {
      headers: { Authorization: `Bearer ${lineToken}` },
    })
    if (!contentRes.ok) {
      return { ok: false, error: '收圖失敗：無法向 LINE 下載照片。' }
    }

    const contentType = contentRes.headers.get('content-type') || 'image/jpeg'
    const bytes = new Uint8Array(await contentRes.arrayBuffer())
    if (bytes.byteLength === 0) return { ok: false, error: '收圖失敗：檔案是空的。' }
    if (bytes.byteLength > 15 * 1024 * 1024) {
      return { ok: false, error: '收圖失敗：檔案超過 15MB。' }
    }

    const ext = contentType.includes('png')
      ? 'png'
      : contentType.includes('webp')
        ? 'webp'
        : 'jpg'
    const path = `${profile.organization_id}/${profile.id}/${crypto.randomUUID()}.${ext}`

    const { error: uploadError } = await admin.storage.from('site-photos').upload(path, bytes, {
      contentType,
      upsert: false,
    })
    if (uploadError) {
      console.warn('[line-webhook] storage upload failed', uploadError.message)
      return { ok: false, error: '收圖失敗：無法存入雲端。' }
    }

    const { error: insertError } = await admin.from('photo_uploads').insert({
      organization_id: profile.organization_id,
      uploaded_by: profile.id,
      site_id: meta.siteId,
      storage_path: path,
      content_type: contentType,
      byte_size: bytes.byteLength,
      line_message_id: messageId,
      source: 'line',
      status: 'pending',
      batch_id: meta.batchId,
      photo_type: meta.photoType,
    })
    if (insertError) {
      console.warn('[line-webhook] insert failed', insertError.message)
      return { ok: false, error: '收圖失敗：寫入資料庫失敗。草稿仍保留，可再傳一次。' }
    }
    return { ok: true }
  } catch (err) {
    console.warn('[line-webhook] image threw', String(err).slice(0, 200))
    return { ok: false, error: '收圖失敗：系統例外，請稍後再試。' }
  }
}

function classifyAge(lastActivityAt: string): 'fresh' | 'paused' | 'expired' {
  const t = new Date(lastActivityAt).getTime()
  if (Number.isNaN(t)) return 'expired'
  const age = Date.now() - t
  if (age <= PAUSE_AFTER_MS) return 'fresh'
  if (age <= EXPIRE_AFTER_MS) return 'paused'
  return 'expired'
}

function parseMenuIntent(text: string): FlowType | 'cancel' | 'resume' | null {
  const t = text.trim()
  if (!t) return null
  if (/^(取消操作|取消流程|取消)$/.test(t)) return 'cancel'
  if (/^(繼續操作|繼續)$/.test(t)) return 'resume'
  if (/上傳照片|傳送照片|傳照片|施工照片/.test(t)) return 'photo_upload'
  if (/待辦事項|我的待辦|^待辦$/.test(t)) return 'todos'
  if (/出勤打卡|上下班|上班打卡|下班打卡|切換工地/.test(t)) return 'attendance'
  if (/採購申請|材料採購|^採購$/.test(t)) return 'purchase'
  return null
}

function parsePostbackData(data: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const part of data.split('&')) {
    const [k, ...rest] = part.split('=')
    if (!k) continue
    out[decodeURIComponent(k)] = decodeURIComponent(rest.join('=') || '')
  }
  return out
}

function photoTypeFromInput(input: string): string | null {
  const t = input.trim()
  if (PHOTO_TYPE_LABELS[t]) return t
  const entry = Object.entries(PHOTO_TYPE_LABELS).find(([, label]) => label === t)
  return entry ? entry[0] : null
}

function textMsg(text: string): LineMessage {
  return { type: 'text', text: text.slice(0, 4000) }
}

type FlexButton = {
  label: string
  data?: string
  uri?: string
  style?: 'primary' | 'secondary'
}

/** Single-card Flex menu (same visual language as 待辦). */
function flexMenu(input: {
  altText: string
  eyebrow: string
  title: string
  body: string
  buttons?: FlexButton[]
}): LineMessage {
  return {
    type: 'flex',
    altText: input.altText.slice(0, 400),
    contents: actionBubble(input),
  }
}

function actionBubble(input: {
  eyebrow: string
  title: string
  body: string
  buttons?: FlexButton[]
}): Record<string, unknown> {
  const buttons = (input.buttons ?? []).slice(0, 4).map((b, i) => {
    const style = b.style ?? (i === 0 ? 'primary' : 'secondary')
    const action = b.uri
      ? { type: 'uri', label: b.label.slice(0, 20), uri: b.uri }
      : {
          type: 'postback',
          label: b.label.slice(0, 20),
          data: String(b.data ?? '').slice(0, 300),
          displayText: b.label.slice(0, 20),
        }
    return {
      type: 'button',
      style,
      color: style === 'primary' ? '#1B3A4B' : undefined,
      action,
    }
  })

  const bubble: Record<string, unknown> = {
    type: 'bubble',
    body: {
      type: 'box',
      layout: 'vertical',
      spacing: 'sm',
      contents: [
        {
          type: 'text',
          text: input.eyebrow.slice(0, 20) || '操作',
          size: 'xs',
          color: '#888888',
        },
        {
          type: 'text',
          text: input.title.slice(0, 40),
          weight: 'bold',
          size: 'md',
          wrap: true,
        },
        {
          type: 'text',
          text: input.body.slice(0, 400) || ' ',
          size: 'sm',
          wrap: true,
          color: '#555555',
        },
      ],
    },
  }
  if (buttons.length > 0) {
    bubble.footer = {
      type: 'box',
      layout: 'vertical',
      spacing: 'sm',
      contents: buttons,
    }
  }
  return bubble
}

/** Site picker as Flex carousel (one card per site). */
function siteCarousel(input: {
  altText: string
  eyebrow: string
  sites: Array<{ id: string; name: string }>
  actionPrefix: string
  extraButtons?: FlexButton[]
}): LineMessage[] {
  if (input.sites.length === 0) {
    return [
      flexMenu({
        altText: input.altText,
        eyebrow: input.eyebrow,
        title: '沒有可用工地',
        body: '請先到工程管家建立工地。',
        buttons: input.extraButtons?.length
          ? input.extraButtons
          : [{ label: '取消', data: 'a=cancel', style: 'secondary' }],
      }),
    ]
  }

  const bubbles = input.sites.slice(0, 10).map((s) =>
    actionBubble({
      eyebrow: input.eyebrow,
      title: s.name.slice(0, 40),
      body: '點下方按鈕選擇此工地',
      buttons: [
        {
          label: '選擇',
          data: `${input.actionPrefix}${s.id}`,
          style: 'primary',
        },
      ],
    }),
  )

  if (input.extraButtons?.length) {
    bubbles.push(
      actionBubble({
        eyebrow: input.eyebrow,
        title: '其他選項',
        body: '不指定工地或取消',
        buttons: input.extraButtons,
      }),
    )
  }

  return [
    {
      type: 'flex',
      altText: input.altText.slice(0, 400),
      contents: {
        type: 'carousel',
        contents: bubbles.slice(0, 12),
      },
    },
  ]
}

function formatTaipei(iso: string): string {
  try {
    return new Intl.DateTimeFormat('zh-TW', {
      timeZone: 'Asia/Taipei',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(new Date(iso))
  } catch {
    return iso
  }
}

function extractBindCode(text: string): string | null {
  const normalized = text
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/[：:]/g, ' ')
    .trim()
  const withKeyword = normalized.match(/(?:綁定|bind)\s*([A-Za-z0-9]{6})\b/i)
  if (withKeyword?.[1]) return withKeyword[1].toUpperCase()
  const bare = normalized.match(/^([A-Za-z0-9]{6})$/i)
  if (bare?.[1]) return bare[1].toUpperCase()
  const loose = normalized.match(/(?:綁定|bind)[^A-Za-z0-9]*([A-Za-z0-9]{6})/i)
  if (loose?.[1]) return loose[1].toUpperCase()
  return null
}

async function handleBind(
  admin: Sb | null,
  code: string,
  lineUserId: string,
): Promise<string> {
  if (!admin) return '綁定失敗：伺服器尚未設定資料庫金鑰。'
  if (!lineUserId) return '綁定失敗：讀不到你的 LINE User ID。'

  const { data, error } = await admin.rpc('consume_line_bind_code', {
    p_code: code,
    p_line_user_id: lineUserId,
  })
  if (error) {
    console.warn('[line-webhook] consume failed', error.message)
    return `綁定失敗：系統錯誤。代碼 ${code}`
  }

  const result = (typeof data === 'string' ? JSON.parse(data) : data) as {
    ok?: boolean
    error?: string
    name?: string
  } | null

  if (!result?.ok) {
    const err = result?.error ?? 'unknown'
    if (err === 'code_not_found_or_expired') {
      return `綁定失敗：代碼 ${code} 無效或已過期。請回系統重新產生。`
    }
    return `綁定失敗（${err}）。代碼 ${code}`
  }

  const name = result.name ? `，${result.name}` : ''
  return `綁定成功${name}！可用圖文選單操作上傳照片與待辦。`
}

// ----- Phase 2: attendance -----

async function getOpenAttendance(
  admin: Sb,
  userId: string,
): Promise<{
  id: string
  clock_in_at: string
  site_id: string | null
} | null> {
  const { data, error } = await admin
    .from('attendance')
    .select('id, clock_in_at, site_id')
    .eq('user_id', userId)
    .eq('status', 'clocked_in')
    .maybeSingle()
  if (error) {
    console.warn('[line-webhook] open attendance failed', error.message)
    return null
  }
  return data
}

async function promptAttendanceMenu(
  admin: Sb,
  profile: Profile,
  draft: DraftRow,
): Promise<LineMessage[]> {
  const open = await getOpenAttendance(admin, profile.id)
  await touchDraft(admin, draft.id, {
    current_step: 'menu',
    draft_payload: {
      ...draft.draft_payload,
      openShift: Boolean(open),
      selectingSite: false,
    },
  })

  if (open) {
    const siteLabel = open.site_id
      ? (await listSites(admin, profile.organization_id)).find((s) => s.id === open.site_id)
          ?.name || '未知工地'
      : '尚未補登工地'
    return [
      flexMenu({
        altText: '出勤打卡：上班中',
        eyebrow: '出勤打卡',
        title: '目前上班中',
        body: `上班時間：${formatTaipei(open.clock_in_at)}\n工地：${siteLabel}`,
        buttons: [
          { label: '下班打卡', data: 'a=att_out', style: 'primary' },
          { label: '切換工地', data: 'a=att_site', style: 'secondary' },
          { label: '取消', data: 'a=cancel', style: 'secondary' },
        ],
      }),
    ]
  }

  return [
    flexMenu({
      altText: '出勤打卡：未上班',
      eyebrow: '出勤打卡',
      title: '目前未上班',
      body: '請選擇要進行的操作',
      buttons: [
        { label: '一鍵上班', data: 'a=att_in', style: 'primary' },
        { label: '取消', data: 'a=cancel', style: 'secondary' },
      ],
    }),
  ]
}

async function handleAttendanceText(
  admin: Sb,
  profile: Profile,
  draft: DraftRow,
  text: string,
): Promise<LineMessage[]> {
  if (/一鍵上班|上班/.test(text)) return clockInLine(admin, profile, draft)
  if (/下班/.test(text)) return clockOutLine(admin, profile, draft)
  if (/切換工地|補登工地/.test(text)) {
    return promptAttendanceSite(admin, profile, draft)
  }
  const num = Number(text)
  if (
    Number.isInteger(num) &&
    num >= 1 &&
    draft.current_step === 'select_site'
  ) {
    const sites = await listSites(admin, profile.organization_id)
    const site = sites[num - 1]
    if (site) return assignAttendanceSite(admin, profile, draft, site.id)
  }
  return promptAttendanceMenu(admin, profile, draft)
}

async function clockInLine(
  admin: Sb,
  profile: Profile,
  draft: DraftRow,
): Promise<LineMessage[]> {
  const open = await getOpenAttendance(admin, profile.id)
  if (open) {
    return [
      textMsg('你已在上班中，請先下班或切換工地。'),
      ...(await promptAttendanceMenu(admin, profile, draft)),
    ]
  }

  const now = new Date().toISOString()
  const { data, error } = await admin
    .from('attendance')
    .insert({
      organization_id: profile.organization_id,
      user_id: profile.id,
      status: 'clocked_in',
      clock_in_at: now,
    })
    .select('id, clock_in_at')
    .single()
  if (error) {
    console.warn('[line-webhook] clock in failed', error.message)
    return [textMsg('上班打卡失敗，請稍後再試。草稿仍保留。')]
  }

  await touchDraft(admin, draft.id, {
    current_step: 'after_clock_in',
    draft_payload: { openShift: true, attendanceId: data.id },
  })

  return [
    flexMenu({
      altText: '已上班',
      eyebrow: '出勤打卡',
      title: '已上班',
      body: `時間：${formatTaipei(String(data.clock_in_at))}\n可補登工地，或稍後再切換。`,
      buttons: [
        { label: '補登工地', data: 'a=att_site', style: 'primary' },
        { label: '結束', data: 'a=att_done', style: 'secondary' },
      ],
    }),
  ]
}

async function clockOutLine(
  admin: Sb,
  profile: Profile,
  draft: DraftRow,
): Promise<LineMessage[]> {
  const open = await getOpenAttendance(admin, profile.id)
  if (!open) {
    await finalizeDraft(admin, draft.id, 'cancelled')
    return [textMsg('目前沒有進行中的班次。')]
  }

  const now = new Date().toISOString()
  const { error } = await admin
    .from('attendance')
    .update({ status: 'clocked_out', clock_out_at: now })
    .eq('id', open.id)
    .eq('user_id', profile.id)
  if (error) {
    console.warn('[line-webhook] clock out failed', error.message)
    return [textMsg('下班打卡失敗，請稍後再試。')]
  }

  await finalizeDraft(admin, draft.id, 'completed')
  return [
    flexMenu({
      altText: '已下班',
      eyebrow: '出勤打卡',
      title: '已下班',
      body: `時間：${formatTaipei(now)}`,
    }),
  ]
}

async function promptAttendanceSite(
  admin: Sb,
  profile: Profile,
  draft: DraftRow,
): Promise<LineMessage[]> {
  const open = await getOpenAttendance(admin, profile.id)
  if (!open) {
    return [
      flexMenu({
        altText: '請先上班',
        eyebrow: '出勤打卡',
        title: '請先上班',
        body: '選擇工地前需先完成上班打卡',
        buttons: [{ label: '回出勤選單', data: 'a=resume', style: 'primary' }],
      }),
    ]
  }

  const sites = await listSites(admin, profile.organization_id)
  await touchDraft(admin, draft.id, {
    current_step: 'select_site',
    draft_payload: { ...draft.draft_payload, openShift: true, selectingSite: true },
  })

  return siteCarousel({
    altText: '請選擇工地',
    eyebrow: '切換工地',
    sites,
    actionPrefix: 'a=att_site_pick&id=',
    extraButtons: [{ label: '取消', data: 'a=cancel', style: 'secondary' }],
  })
}

async function assignAttendanceSite(
  admin: Sb,
  profile: Profile,
  draft: DraftRow,
  siteId: string,
): Promise<LineMessage[]> {
  const open = await getOpenAttendance(admin, profile.id)
  if (!open) return [textMsg('請先上班再選擇工地。')]

  const sites = await listSites(admin, profile.organization_id)
  const site = sites.find((s) => s.id === siteId)
  if (!site) {
    return [
      textMsg('找不到工地。'),
      ...(await promptAttendanceSite(admin, profile, draft)),
    ]
  }

  const { error } = await admin
    .from('attendance')
    .update({ site_id: site.id, job_type: 'project' })
    .eq('id', open.id)
    .eq('user_id', profile.id)
  if (error) {
    console.warn('[line-webhook] assign site failed', error.message)
    return [textMsg('更新工地失敗，請稍後再試。')]
  }

  await finalizeDraft(admin, draft.id, 'completed')
  return [
    flexMenu({
      altText: `已切換工地：${site.name}`,
      eyebrow: '出勤打卡',
      title: '已切換工地',
      body: site.name,
    }),
  ]
}

// ----- Phase 2: purchase -----

function promptPurchaseMode(): LineMessage[] {
  return [
    flexMenu({
      altText: '採購申請',
      eyebrow: '採購申請',
      title: '選擇採購類型',
      body:
        '一般：最終應付 ≥ NT$3,000 需核准\n緊急：單次 ≤ NT$5,000、每日 ≤ NT$10,000\n申請人不可自行核准',
      buttons: [
        { label: '一般採購', data: 'a=pur_mode&m=normal', style: 'primary' },
        { label: '緊急採購', data: 'a=pur_mode&m=emergency', style: 'secondary' },
        { label: '取消', data: 'a=cancel', style: 'secondary' },
      ],
    }),
  ]
}

async function selectPurchaseMode(
  admin: Sb,
  draft: DraftRow,
  mode: string,
): Promise<LineMessage[]> {
  if (mode !== 'normal' && mode !== 'emergency') {
    return [textMsg('類型無效。'), ...promptPurchaseMode()]
  }
  await touchDraft(admin, draft.id, {
    current_step: 'enter_title',
    draft_payload: { mode },
  })
  return [
    flexMenu({
      altText: '請輸入採購品名',
      eyebrow: '採購申請',
      title: mode === 'emergency' ? '緊急採購：輸入品名' : '一般採購：輸入品名',
      body: '直接以文字回覆品名／說明（至少 2 字）',
      buttons: [{ label: '取消', data: 'a=cancel', style: 'secondary' }],
    }),
  ]
}

async function handlePurchaseText(
  admin: Sb,
  profile: Profile,
  draft: DraftRow,
  text: string,
): Promise<LineMessage[]> {
  const step = draft.current_step || 'select_mode'
  const payload = draft.draft_payload || {}

  if (step === 'select_mode') {
    if (/一般/.test(text)) return selectPurchaseMode(admin, draft, 'normal')
    if (/緊急/.test(text)) return selectPurchaseMode(admin, draft, 'emergency')
    return promptPurchaseMode()
  }

  if (step === 'enter_title') {
    const title = text.trim()
    if (title.length < 2) {
      return [
        flexMenu({
          altText: '品名太短',
          eyebrow: '採購申請',
          title: '品名太短',
          body: '請再輸入一次（至少 2 字）',
          buttons: [{ label: '取消', data: 'a=cancel', style: 'secondary' }],
        }),
      ]
    }
    await touchDraft(admin, draft.id, {
      current_step: 'enter_amount',
      draft_payload: { ...payload, title },
    })
    return [
      flexMenu({
        altText: '請輸入金額',
        eyebrow: '採購申請',
        title: '請輸入金額',
        body: `品名：${title}\n請以文字回覆數字（新台幣，例如 2800）`,
        buttons: [{ label: '取消', data: 'a=cancel', style: 'secondary' }],
      }),
    ]
  }

  if (step === 'enter_amount') {
    const amount = Number(String(text).replace(/[,，元$NTD\s]/gi, ''))
    if (!Number.isFinite(amount) || amount < 0) {
      return [
        flexMenu({
          altText: '金額無效',
          eyebrow: '採購申請',
          title: '金額無效',
          body: '請輸入數字（例如 2800）',
          buttons: [{ label: '取消', data: 'a=cancel', style: 'secondary' }],
        }),
      ]
    }
    if (payload.mode === 'emergency' && amount > EMERGENCY_SINGLE_LIMIT_NTD) {
      return [
        flexMenu({
          altText: '超過緊急單次上限',
          eyebrow: '採購申請',
          title: '超過緊急單次上限',
          body: `單次上限 NT$${EMERGENCY_SINGLE_LIMIT_NTD.toLocaleString()}，請重新輸入金額`,
          buttons: [{ label: '取消', data: 'a=cancel', style: 'secondary' }],
        }),
      ]
    }
    await touchDraft(admin, draft.id, {
      current_step: 'select_site',
      draft_payload: { ...payload, goodsAmount: amount },
    })
    return promptPurchaseSite(admin, profile, {
      ...draft,
      draft_payload: { ...payload, goodsAmount: amount },
      current_step: 'select_site',
    })
  }

  if (step === 'select_site') {
    const num = Number(text)
    if (Number.isInteger(num) && num >= 1) {
      const sites = await listSites(admin, profile.organization_id)
      const site = sites[num - 1]
      if (site) return selectPurchaseSite(admin, profile, draft, site.id)
    }
    if (/跳過|不指定/.test(text)) return promptPurchaseConfirm(admin, draft)
    return promptPurchaseSite(admin, profile, draft)
  }

  if (step === 'confirm') {
    if (/確認|送出|是/.test(text)) return submitPurchase(admin, profile, draft)
    if (/取消/.test(text)) {
      await finalizeDraft(admin, draft.id, 'cancelled')
      return [
        flexMenu({
          altText: '已取消採購申請',
          eyebrow: '採購申請',
          title: '已取消',
          body: '可再從圖文選單重新申請',
        }),
      ]
    }
    return promptPurchaseConfirm(admin, draft)
  }

  return resumePurchase(admin, profile, draft)
}

async function promptPurchaseSite(
  admin: Sb,
  profile: Profile,
  draft: DraftRow,
): Promise<LineMessage[]> {
  const sites = await listSites(admin, profile.organization_id)
  return siteCarousel({
    altText: '採購：選擇工地',
    eyebrow: '採購申請',
    sites: sites.slice(0, 9),
    actionPrefix: 'a=pur_site&id=',
    extraButtons: [
      { label: '不指定工地', data: 'a=pur_site_skip', style: 'primary' },
      { label: '取消', data: 'a=cancel', style: 'secondary' },
    ],
  })
}

async function selectPurchaseSite(
  admin: Sb,
  profile: Profile,
  draft: DraftRow,
  siteId: string,
): Promise<LineMessage[]> {
  const sites = await listSites(admin, profile.organization_id)
  const site = sites.find((s) => s.id === siteId)
  if (!site) {
    return [
      textMsg('找不到工地。'),
      ...(await promptPurchaseSite(admin, profile, draft)),
    ]
  }
  const next = {
    ...draft,
    draft_payload: {
      ...draft.draft_payload,
      siteId: site.id,
      siteName: site.name,
    },
  }
  await touchDraft(admin, draft.id, {
    current_step: 'confirm',
    draft_payload: next.draft_payload,
  })
  return promptPurchaseConfirm(admin, { ...next, current_step: 'confirm' })
}

async function promptPurchaseConfirm(
  admin: Sb,
  draft: DraftRow,
): Promise<LineMessage[]> {
  const p = draft.draft_payload || {}
  const amount = Number(p.goodsAmount ?? 0)
  const mode = String(p.mode || 'normal')
  const needsApproval = mode === 'normal' && amount >= PURCHASE_PREAPPROVAL_NTD
  await touchDraft(admin, draft.id, {
    current_step: 'confirm',
    draft_payload: p,
  })
  return [
    flexMenu({
      altText: '請確認採購',
      eyebrow: '採購申請',
      title: '請確認採購',
      body: `類型：${mode === 'emergency' ? '緊急' : '一般'}\n品名：${
        p.title || '—'
      }\n金額：NT$${amount.toLocaleString()}\n工地：${p.siteName || '不指定'}\n${
        needsApproval ? '送出後需老闆／管理員核准' : '可直接成立（免事前核准）'
      }`,
      buttons: [
        { label: '確認送出', data: 'a=pur_confirm', style: 'primary' },
        { label: '取消', data: 'a=cancel', style: 'secondary' },
      ],
    }),
  ]
}

async function resumePurchase(
  admin: Sb,
  profile: Profile,
  draft: DraftRow,
): Promise<LineMessage[]> {
  const step = draft.current_step || 'select_mode'
  if (step === 'select_mode') return promptPurchaseMode()
  if (step === 'enter_title') {
    return [
      flexMenu({
        altText: '請輸入採購品名',
        eyebrow: '採購申請',
        title: '請輸入品名／說明',
        body: '直接以文字回覆品名（至少 2 字）',
        buttons: [{ label: '取消', data: 'a=cancel', style: 'secondary' }],
      }),
    ]
  }
  if (step === 'enter_amount') {
    return [
      flexMenu({
        altText: '請輸入金額',
        eyebrow: '採購申請',
        title: '請輸入金額',
        body: '直接以文字回覆數字（新台幣，例如 2800）',
        buttons: [{ label: '取消', data: 'a=cancel', style: 'secondary' }],
      }),
    ]
  }
  if (step === 'select_site') return promptPurchaseSite(admin, profile, draft)
  return promptPurchaseConfirm(admin, draft)
}

async function emergencyUsedToday(
  admin: Sb,
  userId: string,
  businessDate: string,
): Promise<number> {
  const { data, error } = await admin
    .from('emergency_limit_events')
    .select('amount_delta, event_type')
    .eq('employee_id', userId)
    .eq('business_date', businessDate)
  if (error) {
    console.warn('[line-webhook] emergency used failed', error.message)
    return 0
  }
  let sum = 0
  for (const row of data ?? []) {
    sum += Number(row.amount_delta) || 0
  }
  return sum
}

function taipeiBusinessDate(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

async function submitPurchase(
  admin: Sb,
  profile: Profile,
  draft: DraftRow,
): Promise<LineMessage[]> {
  const p = draft.draft_payload || {}
  const mode = String(p.mode || '')
  const title = String(p.title || '').trim()
  const goodsAmount = Number(p.goodsAmount ?? NaN)
  if (mode !== 'normal' && mode !== 'emergency') {
    return [textMsg('採購類型缺失，請重新申請。')]
  }
  if (title.length < 2 || !Number.isFinite(goodsAmount) || goodsAmount < 0) {
    return [textMsg('資料不完整，請重新申請。')]
  }

  const finalPayable = Math.round(goodsAmount * 100) / 100
  const businessDate = taipeiBusinessDate()
  const needsApproval = mode === 'normal' && finalPayable >= PURCHASE_PREAPPROVAL_NTD

  if (mode === 'emergency') {
    if (finalPayable > EMERGENCY_SINGLE_LIMIT_NTD) {
      return [
        textMsg(
          `超過緊急單次上限 NT$${EMERGENCY_SINGLE_LIMIT_NTD.toLocaleString()}`,
        ),
      ]
    }
    const used = await emergencyUsedToday(admin, profile.id, businessDate)
    if (used + finalPayable > EMERGENCY_DAILY_LIMIT_NTD) {
      return [
        textMsg(
          `超過緊急每日上限（已用 NT$${used.toLocaleString()}／上限 NT$${EMERGENCY_DAILY_LIMIT_NTD.toLocaleString()}）`,
        ),
      ]
    }
  }

  const { data, error } = await admin
    .from('purchases')
    .insert({
      organization_id: profile.organization_id,
      user_id: profile.id,
      site_id: p.siteId ? String(p.siteId) : null,
      mode,
      status: needsApproval ? 'pending_approval' : 'purchased',
      title,
      goods_amount: finalPayable,
      discount: 0,
      tax: 0,
      shipping: 0,
      other_buyer_fees: 0,
      final_payable: finalPayable,
      business_date: businessDate,
    })
    .select('id, status, final_payable, title')
    .single()

  if (error) {
    console.warn('[line-webhook] create purchase failed', error.message)
    return [textMsg('建立採購失敗，草稿仍保留，請稍後再試「確認送出」。')]
  }

  if (mode === 'emergency') {
    const { error: evErr } = await admin.from('emergency_limit_events').insert({
      organization_id: profile.organization_id,
      employee_id: profile.id,
      business_date: businessDate,
      event_type: 'RESERVE',
      amount_delta: finalPayable,
      purchase_id: data.id,
      reason: 'LINE 緊急採購占額',
      created_by: profile.id,
    })
    if (evErr) {
      console.warn('[line-webhook] emergency reserve failed', evErr.message)
      // purchase already created; still report partial success
    }
  }

  if (needsApproval) {
    const { data: approvers } = await admin
      .from('profiles')
      .select('id')
      .eq('organization_id', profile.organization_id)
      .in('role', ['boss', 'owner', 'admin'])
      .neq('id', profile.id)

    for (const a of approvers ?? []) {
      await admin.from('notices').insert({
        organization_id: profile.organization_id,
        user_id: a.id,
        kind: 'todo',
        title: `採購待核准：${title}`,
        detail: `最終應付 NT$${finalPayable.toLocaleString()}（LINE 申請）`,
        status: 'open',
        unread: true,
        href: '/purchases',
      })
    }
  }

  await finalizeDraft(admin, draft.id, 'completed')
  const purchasesUri = `${appBaseUrl()}/purchases`
  if (needsApproval) {
    return [
      flexMenu({
        altText: '已送出採購（待核准）',
        eyebrow: '採購申請',
        title: '已送出（待核准）',
        body: `「${data.title}」\n金額 NT$${Number(data.final_payable).toLocaleString()}\n不可自行核准；老闆／管理員會在系統待辦看到`,
        buttons: [{ label: '查看採購', uri: purchasesUri, style: 'primary' }],
      }),
    ]
  }
  return [
    flexMenu({
      altText: '已建立採購',
      eyebrow: '採購申請',
      title: '已建立採購',
      body: `「${data.title}」\n金額 NT$${Number(data.final_payable).toLocaleString()}\n狀態：${data.status}`,
      buttons: [{ label: '查看採購', uri: purchasesUri, style: 'primary' }],
    }),
  ]
}

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

async function replyMessages(token: string, replyToken: string, messages: LineMessage[]) {
  try {
    const res = await fetch('https://api.line.me/v2/bot/message/reply', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        replyToken,
        messages: messages.slice(0, 5),
      }),
    })
    if (!res.ok) {
      console.warn('[line-webhook] reply failed', res.status, await res.text().catch(() => ''))
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
