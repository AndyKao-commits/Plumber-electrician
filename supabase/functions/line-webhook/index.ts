/**
 * LINE webhook �X reply-only (DEC-007).
 * Phase 1: flow drafts + batch photo upload + todos Flex.
 * Phase 2: attendance clock/switch-site.
 * V1.0: �O�b �� expense_reports / cash_receipt_reports�F�����a�I�ר���.
 * No proactive push / broadcast / timeout reminders.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

type Sb = ReturnType<typeof createClient>

type LineEvent = {
  type?: string
  replyToken?: string
  source?: { type?: string; userId?: string }
  message?: {
    type?: string
    text?: string
    id?: string
    title?: string
    address?: string
    latitude?: number
    longitude?: number
  }
  postback?: { data?: string }
}

type LineWebhookBody = { events?: LineEvent[] }

type Profile = {
  id: string
  organization_id: string
  name: string | null
  line_user_id: string | null
  role: string | null
  access_template: string | null
}

type FlowType = 'photo_upload' | 'todos' | 'attendance' | 'purchase' | 'location'
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
    v === 'purchase' ||
    v === 'location'
  )
}

function flowTypeFromPostbackAction(action: string): FlowType | null {
  if (
    action === 'att_in' ||
    action === 'att_out' ||
    action === 'att_site' ||
    action === 'att_site_pick'
  ) {
    return 'attendance'
  }
  if (
    action === 'photo_site' ||
    action === 'photo_type' ||
    action === 'photo_done' ||
    action === 'photo_cancel'
  ) {
    return 'photo_upload'
  }
  if (
    action === 'cash_kind' ||
    action === 'cash_site' ||
    action === 'cash_misc' ||
    action === 'cash_loc_skip' ||
    action === 'cash_receipt_skip' ||
    action === 'cash_confirm'
  ) {
    return 'purchase'
  }
  if (
    action === 'loc_share' ||
    action === 'loc_site' ||
    action === 'loc_site_pick'
  ) {
    return 'location'
  }
  if (action === 'todo_done' || action === 'todo_view') return 'todos'
  return null
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

const LINE_BRAND = {
  staff: {
    background: '#172C3C',
    surface: '#254657',
    accent: '#9CD9D2',
    primaryAction: '#276C60',
  },
  admin: {
    background: '#222C38',
    surface: '#354353',
    accent: '#E5C58C',
    primaryAction: '#B89552',
  },
  text: '#FFFFFF',
  mutedText: '#CBD5DC',
} as const

function lineTheme(profile?: Profile) {
  const admin = isBossEquivalentProfile(profile)
  return admin ? LINE_BRAND.admin : LINE_BRAND.staff
}

const FLOW_LABELS: Record<FlowType, string> = {
  photo_upload: '�W�ǷӤ�',
  todos: '�ݿ�ƶ�',
  attendance: '�X�ԥ��d',
  purchase: '�O�b',
  location: '�����a�I',
}

const PHOTO_TYPE_LABELS: Record<string, string> = {
  before: '�I�u�e',
  during: '�I�u��',
  after: '�I�u��',
  acceptance: '�禬',
  unclassified: '�|������',
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
          textMsg('�ާ@���ѡA�еy��A�աC����������Z���|�O�d�C'),
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
    return [await buildRoleImagemap(admin, lineUserId)]
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

  if (msgType === 'location') {
    return handleLocationMessage(admin, lineUserId, {
      title: String(event.message?.title ?? '').trim(),
      address: String(event.message?.address ?? '').trim(),
      latitude: Number(event.message?.latitude),
      longitude: Number(event.message?.longitude),
    })
  }

  if (msgType !== 'text') return []

  const bindCode = extractBindCode(text)
  if (bindCode) {
    const result = await handleBind(admin, bindCode, lineUserId)
    if (result.startsWith('�j�w���\')) {
      return [textMsg(result), await buildRoleImagemap(admin, lineUserId)]
    }
    return [textMsg(result)]
  }

  if (isBindingHelpRequest(text)) {
    return [bindingHelpMessage()]
  }

  if (isImagemapPanelRequest(text)) {
    return [await buildRoleImagemap(admin, lineUserId)]
  }

  // Quote cases: view-only (list / detail / export link) �X no LINE editor
  if (/�����޲z|�����ץ�|����/.test(text) && !/����/.test(text)) {
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
  if (intent === 'open_app') {
    return [
      flexMenu({
        altText: '�}�Ҥu�{�ޮa',
        eyebrow: '�}�Һ���',
        title: '�u�{�ޮa',
        body: '�d�ݥX�ԡB����P�u�a�C',
        buttons: [{ label: '�}��', uri: appBaseUrl(), style: 'primary' }],
      }),
    ]
  }
  const profile = await requireProfile(admin, lineUserId)
  if ('error' in profile) {
    if (intent) return [textMsg(profile.error)]
    return []
  }

  const gate = await prepareActiveDraft(admin, profile)

  // Expired: clear notice, then allow starting a new intent in the same turn
  if (gate.age === 'expired') {
    const notice = gate.messages ?? [
      textMsg('�쥻���������ާ@�w�W�L�O�d�ɶ��A��Z�w�M���C'),
    ]
    if (isFlowIntent(intent)) {
      return [...notice, ...(await startFlow(admin, profile, intent))]
    }
    return notice
  }

  // Paused: same feature �� resume prompt path; other feature �� switch guard
  if (gate.age === 'paused' && gate.draft) {
    if (intent === 'cancel') {
      return cancelDraftWithCleanup(admin, gate.draft)
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
          altText: '�S���i�椤���ާ@',
          eyebrow: '�ާ@����',
          title: '�S���i�椤���ާ@',
          body: '�i�q�Ϥ���}�l�\��',
        }),
      ]
    }
    return cancelDraftWithCleanup(admin, gate.draft)
  }

  if (intent === 'resume') {
    if (!gate.draft) return [textMsg('�ثe�S���i�~�򪺾ާ@�C')]
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
  if (gate.draft?.flow_type === 'location') {
    return handleLocationText(admin, profile, gate.draft, text)
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
  if (
    gate.messages &&
    (gate.age === 'expired' || gate.age === 'paused') &&
    action !== 'resume' &&
    action !== 'cancel' &&
    action !== 'switch' &&
    action !== 'photo_cancel'
  ) {
    return gate.messages
  }

  if (action === 'cancel') {
    if (!gate.draft) {
      return [
        flexMenu({
          altText: '�S���i�椤���ާ@',
          eyebrow: '�ާ@����',
          title: '�S���i�椤���ާ@',
          body: '�i�q�Ϥ���}�l�\��',
        }),
      ]
    }
    return cancelDraftWithCleanup(admin, gate.draft)
  }

  if (action === 'resume') {
    if (!gate.draft) return [textMsg('�ثe�S���i�~�򪺾ާ@�C')]
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
      return [textMsg('�L�k���ѭn�������\��C')]
    }
    if (gate.draft) {
      const cleanup = await cleanupDraftMedia(admin, gate.draft)
      if (!cleanup.ok) {
        return [
          flexMenu({
            altText: '�����e�Х��M��',
            eyebrow: '�����\��',
            title: '�|����ƥ��M��',
            body: cleanup.message || '�Х����\�����ثe�ާ@�A����',
            buttons: [
              { label: '�A�ը���', data: 'a=cancel', style: 'primary' },
              { label: '�~��ثe�ާ@', data: 'a=resume', style: 'secondary' },
            ],
          }),
        ]
      }
      await finalizeDraft(admin, gate.draft.id, 'cancelled')
    }
    return startFlow(admin, profile, to)
  }

  // Consistent unfinished-flow guard for feature postbacks
  const targetFlow = flowTypeFromPostbackAction(action)
  if (
    targetFlow &&
    gate.draft &&
    gate.draft.flow_type !== targetFlow &&
    action !== 'todo_done' &&
    action !== 'todo_view'
  ) {
    return switchGuardMessages(gate.draft, targetFlow)
  }
  // Todos are one-shot; if another draft is open, ask before interrupting
  if (
    (action === 'todo_done' || action === 'todo_view') &&
    gate.draft &&
    gate.draft.flow_type !== 'todos'
  ) {
    return switchGuardMessages(gate.draft, 'todos')
  }

  if (action === 'att_in') {
    const draft =
      gate.draft?.flow_type === 'attendance'
        ? gate.draft
        : await createDraft(admin, profile, 'attendance', 'menu', {})
    return clockInLine(admin, profile, draft)
  }

  if (action === 'att_out') {
    const draft =
      gate.draft?.flow_type === 'attendance'
        ? gate.draft
        : await createDraft(admin, profile, 'attendance', 'menu', {})
    return clockOutLine(admin, profile, draft)
  }

  if (action === 'att_site') {
    const draft =
      gate.draft?.flow_type === 'attendance'
        ? gate.draft
        : await createDraft(admin, profile, 'attendance', 'select_site', {})
    return promptAttendanceSite(admin, profile, draft)
  }

  if (action === 'att_site_pick') {
    // Site pick works even without an open attendance draft (after clock-in carousel).
    const draft =
      gate.draft?.flow_type === 'attendance' ? gate.draft : null
    return assignAttendanceSite(admin, profile, draft, params.id || '')
  }

  if (action === 'loc_share') {
    const draft =
      gate.draft?.flow_type === 'location'
        ? gate.draft
        : await createDraft(admin, profile, 'location', 'await_location', {})
    return handoffLocationToWeb(admin, draft)
  }

  if (action === 'loc_site') {
    const draft =
      gate.draft?.flow_type === 'location'
        ? gate.draft
        : await createDraft(admin, profile, 'location', 'select_site', {})
    return promptLocationSites(admin, profile, draft)
  }

  if (action === 'loc_site_pick') {
    if (!gate.draft || gate.draft.flow_type !== 'location') {
      return [textMsg('�Х��I�u�����a�I�v�C')]
    }
    return saveLocationBySite(admin, profile, gate.draft, params.id || '')
  }

  if (action === 'photo_cancel') {
    if (!gate.draft || gate.draft.flow_type !== 'photo_upload') {
      return [textMsg('�ثe�S���i�椤���W�ǷӤ��y�{�C')]
    }
    return cancelDraftWithCleanup(admin, gate.draft)
  }

  if (action === 'cash_kind') {
    if (!gate.draft || gate.draft.flow_type !== 'purchase') {
      return [textMsg('�Х��I�u�O�b�v�C')]
    }
    return selectCashKind(admin, profile, gate.draft, params.k || '')
  }

  if (action === 'cash_site') {
    if (!gate.draft || gate.draft.flow_type !== 'purchase') {
      return [textMsg('�Х��I�u�O�b�v�C')]
    }
    return selectCashSite(admin, profile, gate.draft, params.id || '')
  }

  if (action === 'cash_misc') {
    if (!gate.draft || gate.draft.flow_type !== 'purchase') {
      return [textMsg('�Х��I�u�O�b�v�C')]
    }
    return selectCashMisc(admin, profile, gate.draft)
  }

  if (action === 'cash_loc_skip') {
    if (!gate.draft || gate.draft.flow_type !== 'purchase') {
      return [textMsg('�Х��I�u�O�b�v�C')]
    }
    return skipCashLocation(admin, profile, gate.draft)
  }

  if (action === 'cash_receipt_skip') {
    if (!gate.draft || gate.draft.flow_type !== 'purchase') {
      return [textMsg('�Х��I�u�O�b�v�C')]
    }
    return promptCashConfirm(admin, gate.draft)
  }

  if (action === 'cash_confirm') {
    if (!gate.draft || gate.draft.flow_type !== 'purchase') {
      return [textMsg('�Х��I�u�O�b�v�C')]
    }
    return submitFieldCash(admin, profile, gate.draft)
  }

  // Legacy postback aliases from older rich menus
  if (action === 'pur_mode' || action === 'pur_site' || action === 'pur_site_skip' || action === 'pur_confirm') {
    return [textMsg('���ʥӽФw�אּ�u�O�b�v�C�бq�Ϥ��歫�s�}�l�C')]
  }

  if (action === 'photo_site') {
    if (!gate.draft || gate.draft.flow_type !== 'photo_upload') {
      return [textMsg('�ثe�S���i�椤���W�ǷӤ��y�{�C�Х��I�u�W�ǷӤ��v�C')]
    }
    return selectPhotoSite(admin, profile, gate.draft, params.id || '')
  }

  if (action === 'photo_type') {
    if (!gate.draft || gate.draft.flow_type !== 'photo_upload') {
      return [textMsg('�ثe�S���i�椤���W�ǷӤ��y�{�C')]
    }
    return selectPhotoType(admin, gate.draft, params.t || '')
  }

  if (action === 'photo_done') {
    if (!gate.draft || gate.draft.flow_type !== 'photo_upload') {
      return [textMsg('�ثe�S���i�椤���W�ǷӤ��y�{�C')]
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
  return [textMsg('�L�k�B�z���ާ@�C')]
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

  if (gate.draft?.flow_type === 'purchase') {
    return handleCashReceiptImage(
      admin,
      lineToken,
      profile,
      gate.draft,
      messageId,
    )
  }

  if (!gate.draft || gate.draft.flow_type !== 'photo_upload') {
    return [
      textMsg(
        '�Х��q�Ϥ����I�u�W�ǷӤ��v�A��ܤu�a�P������A�ǹϡC\n�]�����ǹϤ��|�۰ʶ}�l�s�y�{�A�H�K�л\��L�������ާ@�C�^',
      ),
    ]
  }

  const payload = gate.draft.draft_payload || {}
  if (!payload.siteId || !payload.photoType || !payload.batchId) {
    return [
      textMsg('�Х������u�a�P�Ӥ�������ܡA�A�ǰe�Ӥ��C'),
      ...(await resumeDraft(admin, profile, gate.draft)),
    ]
  }

  const result = await storeLineImage(admin, lineToken, profile, messageId, {
    siteId: String(payload.siteId),
    photoType: String(payload.photoType),
    batchId: String(payload.batchId),
  })

  if (!result.ok) {
    const failed = Number(payload.receiveFailed ?? 0) + 1
    await touchDraft(admin, gate.draft.id, {
      current_step: 'receiving',
      draft_payload: { ...payload, receiveFailed: failed },
    })
    return [
      textMsg(`${result.error}\n�]�ثe���ϥ��Ѳ֭p ${failed} �i�F�i�A�ǹϩΫ������W�ǡ^`),
    ]
  }

  const count = Number(payload.photoCount ?? 0) + 1
  await touchDraft(admin, gate.draft.id, {
    current_step: 'receiving',
    draft_payload: { ...payload, photoCount: count },
  })

  return [
    flexMenu({
      altText: `�w���� ${count} �i�Ӥ�`,
      eyebrow: '�W�ǷӤ�',
      title: `�w���� ${count} �i`,
      body: '�i�����~��ǹϡF�ǧ��Ы��u�����W�ǡv�C�Y�n��󦹧�Ы��u�����W�ǡv�C',
      buttons: [
        { label: '�����W��', data: 'a=photo_done', style: 'primary' },
        { label: '�����W��', data: 'a=photo_cancel', style: 'secondary' },
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
    return handoffAttendanceToLiff()
  }

  if (flowType === 'purchase') {
    return handoffExpenseToLiff()
  }

  if (flowType === 'location') {
    return handoffLocationToLiff()
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
    await finalizeDraft(admin, draft.id, 'cancelled')
    return handoffAttendanceToLiff()
  }

  if (draft.flow_type === 'purchase') {
    await finalizeDraft(admin, draft.id, 'cancelled')
    return handoffExpenseToLiff()
  }

  if (draft.flow_type === 'location') {
    await finalizeDraft(admin, draft.id, 'cancelled')
    return handoffLocationToLiff()
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
      altText: '�~��W�ǷӤ�',
      eyebrow: '�W�ǷӤ�',
      title: '�~��W��',
      body: `�u�a�G${payload.siteName || '�X'}\n�����G${
        PHOTO_TYPE_LABELS[String(payload.photoType)] || payload.photoType
      }\n�w���G${payload.photoCount ?? 0} �i\n�Ъ����ǹ�`,
      buttons: [
        { label: '�����W��', data: 'a=photo_done', style: 'primary' },
        { label: '�����W��', data: 'a=photo_cancel', style: 'secondary' },
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
  if (/�����W��|����/.test(text)) return completePhotoBatch(admin, draft)
  if (/�����W��|����/.test(text)) {
    return cancelDraftWithCleanup(admin, draft)
  }
  if (/�~��W��|�~��/.test(text)) return resumeDraft(admin, profile, draft)

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
        altText: '�S���i�Τu�a',
        eyebrow: '�W�ǷӤ�',
        title: '�S���i�Τu�a',
        body: '�Х���u�{�ޮa�إߤu�a',
        buttons: [{ label: '����', data: 'a=cancel', style: 'secondary' }],
      }),
    ]
  }

  await touchDraft(admin, draft.id, { current_step: 'select_site' })

  return siteCarousel({
    altText: '�W�ǷӤ��G�п�ܤu�a',
    eyebrow: '�W�ǷӤ�',
    sites,
    actionPrefix: 'a=photo_site&id=',
    extraButtons: [{ label: '����', data: 'a=cancel', style: 'secondary' }],
  })
}

function promptSelectPhotoType(): LineMessage[] {
  const bubbles = Object.entries(PHOTO_TYPE_LABELS).map(([code, label]) =>
    actionBubble({
      eyebrow: '�W�ǷӤ�',
      title: label,
      body: '�I�U����s��ܦ�����',
      buttons: [
        { label: '���', data: `a=photo_type&t=${code}`, style: 'primary' },
      ],
    }),
  )
  bubbles.push(
    actionBubble({
      eyebrow: '�W�ǷӤ�',
      title: '����',
      body: '�����W�Ǭy�{',
      buttons: [{ label: '�����W��', data: 'a=photo_cancel', style: 'secondary' }],
    }),
  )
  return [
    {
      type: 'flex',
      altText: '�п�ܷӤ�����',
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
  if (!site) return [textMsg('�䤣��u�a�A�Э��s��ܡC'), ...(await promptSelectSite(admin, profile, draft))]

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
    return [textMsg('�Ӥ������L�ġC'), ...promptSelectPhotoType()]
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
      altText: '�жǰe�Ӥ�',
      eyebrow: '�W�ǷӤ�',
      title: '�жǰe�Ӥ�',
      body: `�u�a�G${payload.siteName}\n�����G${PHOTO_TYPE_LABELS[typeCode]}\n�гs��ǹϡ]�i�h�i�^`,
      buttons: [
        { label: '�����W��', data: 'a=photo_done', style: 'primary' },
        { label: '�����W��', data: 'a=photo_cancel', style: 'secondary' },
      ],
    }),
  ]
}

async function completePhotoBatch(admin: Sb, draft: DraftRow): Promise<LineMessage[]> {
  const payload = draft.draft_payload || {}
  const batchId = String(payload.batchId ?? '')
  const expected = Number(payload.photoCount ?? 0)
  if (!batchId || expected <= 0) {
    return [
      flexMenu({
        altText: '�|������Ӥ�',
        eyebrow: '�W�ǷӤ�',
        title: '�|������Ӥ�',
        body: '�Х��ǹϡA�Ψ����W��',
        buttons: [
          { label: '�����W��', data: 'a=photo_cancel', style: 'secondary' },
        ],
      }),
    ]
  }

  const { data: beforeRows, error: beforeError } = await admin
    .from('photo_uploads')
    .select('id, status')
    .eq('batch_id', batchId)
  if (beforeError) {
    console.warn('[line-webhook] list batch failed', beforeError.message)
    return [
      flexMenu({
        altText: '�����W�ǥ���',
        eyebrow: '�W�ǷӤ�',
        title: 'Ū������',
        body: '��Z���O�d�A�еy��A�է����W��',
        buttons: [
          { label: '�����W��', data: 'a=photo_done', style: 'primary' },
          { label: '�����W��', data: 'a=photo_cancel', style: 'secondary' },
        ],
      }),
    ]
  }

  const pendingCount = (beforeRows ?? []).filter((r) => r.status === 'pending').length
  if (pendingCount > 0) {
    const { error } = await admin
      .from('photo_uploads')
      .update({ status: 'linked' })
      .eq('batch_id', batchId)
      .eq('status', 'pending')
    if (error) {
      console.warn('[line-webhook] complete batch failed', error.message)
      return [
        flexMenu({
          altText: '�����W�ǥ���',
          eyebrow: '�W�ǷӤ�',
          title: '�g�J����',
          body: '��Z���O�d�A�еy��A�է����W��',
          buttons: [
            { label: '�����W��', data: 'a=photo_done', style: 'primary' },
            { label: '�����W��', data: 'a=photo_cancel', style: 'secondary' },
          ],
        }),
      ]
    }
  }

  const { data: afterRows } = await admin
    .from('photo_uploads')
    .select('id, status')
    .eq('batch_id', batchId)
  const success = (afterRows ?? []).filter((r) => r.status === 'linked').length
  const stillPending = (afterRows ?? []).filter((r) => r.status === 'pending').length
  const receiveFailed = Number(payload.receiveFailed ?? 0)
  // expected = successfully received into DB; receiveFailed = download/upload failures
  const failed = Math.max(0, expected - success) + Math.max(0, receiveFailed)

  if (stillPending > 0) {
    return [
      flexMenu({
        altText: '�����Ӥ��|������',
        eyebrow: '�W�ǷӤ�',
        title: '�����|���s��',
        body: `���\�G${success} �i\n���ѡG${failed} �i\n�ЦA���@�������W�ǡA�Ψ����í���`,
        buttons: [
          { label: '�����W��', data: 'a=photo_done', style: 'primary' },
          { label: '�����W��', data: 'a=photo_cancel', style: 'secondary' },
        ],
      }),
    ]
  }

  await finalizeDraft(admin, draft.id, 'completed')
  const photosUri = `${appBaseUrl()}/photos`
  return [
    flexMenu({
      altText: '�W�ǧ���',
      eyebrow: '�W�ǷӤ�',
      title: '�W�ǧ���',
      body: `���\�G${success} �i\n���ѡG${failed} �i\n�u�a�G${payload.siteName}\n�����G${
        PHOTO_TYPE_LABELS[String(payload.photoType)] || payload.photoType
      }`,
      buttons: [{ label: '�d�ݷӤ�', uri: photosUri, style: 'primary' }],
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
    return [textMsg('Ū���������ѡA�еy��A�աC')]
  }
  const rows = data ?? []
  if (rows.length === 0) {
    return [
      flexMenu({
        altText: '�|�L�����ץ�',
        eyebrow: '�����޲z',
        title: '�|�L�����ץ�',
        body: '�Ш�u�{�ޮa�إ߳����ץ��A�d��',
        buttons: [
          {
            label: '�}�ҳ���',
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
      eyebrow: '�����ץ�',
      title: String(q.title || '����').slice(0, 40),
      body: `${q.quote_number || ''}\n�Ȥ�G${q.customer_name || '�X'}\n�`�B�GNT$${total.toLocaleString()}\n���A�G${status}${
        q.current_version ? ` �P v${q.current_version}` : ''
      }`,
      buttons: [
        {
          label: '�d�ݲӶ�',
          data: `a=quote_view&id=${q.id}`,
          style: 'primary',
        },
        {
          label: '�}�ҶץX',
          uri: `${appBase}/quotes/${q.id}?export=1`,
          style: 'secondary',
        },
      ],
    })
  })

  return [
    {
      type: 'flex',
      altText: `�����ץ� ${rows.length} ��`,
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
    return [textMsg('�䤣�즹�����ץ�C')]
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
      altText: `���� ${quote.title}`,
      eyebrow: '�����Ӷ�',
      title: String(quote.title).slice(0, 40),
      body: `${quote.quote_number || ''}\n�Ȥ�G${quote.customer_name || '�X'}\n�a�}�G${
        quote.site_address || '�X'
      }\n�p�p NT$${Number(quote.amount_before_tax || 0).toLocaleString()} �P �馩 NT$${Number(
        quote.discount || 0,
      ).toLocaleString()} �P �|�B NT$${Number(quote.tax_amount || 0).toLocaleString()}\n�`�B NT$${Number(
        quote.amount_after_tax || 0,
      ).toLocaleString()}\n\n${lines || '�]�L�Ӷ��^'}`,
      buttons: [
        {
          label: '�ץX�����s��',
          uri: `${appBaseUrl()}/quotes/${quote.id}?export=1`,
          style: 'primary',
        },
        {
          label: '�}�Үץ�',
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
    return [textMsg('Ū���ݿ쥢�ѡA�еy��A�աC')]
  }

  const todos = data ?? []
  if (todos.length === 0) return [textMsg('�ثe�S���ݿ�ƶ�')]

  const appBase = appBaseUrl()
  const bubbles = todos.map((t) => todoBubble(t, appBase, profile))
  return [
    {
      type: 'flex',
      altText: `�ݿ�ƶ� ${todos.length} ��`,
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

type ImagemapPanel = 'staff' | 'manager' | 'binding'

type ImagemapArea = {
  x: number
  y: number
  width: number
  height: number
}

function isBossEquivalentProfile(profile?: Profile | null): boolean {
  if (!profile) return false
  return (
    profile.role === 'boss' ||
    profile.role === 'owner' ||
    profile.access_template === 'owner'
  )
}

function isImagemapPanelRequest(text: string): boolean {
  return /^(�\����|�\�ୱ�O|�u�@���O|�v�Ťu�@���O|�޲z���O|�}�ҿ��|���)$/u.test(
    text.trim(),
  )
}

function isBindingHelpRequest(text: string): boolean {
  return /^(�b���j�w�о�|�j�w�о�|�p��j�w|LINE �j�w�о�)$/iu.test(text.trim())
}

function sixImagemapAreas(): ImagemapArea[] {
  return [
    { x: 0, y: 0, width: 346, height: 520 },
    { x: 346, y: 0, width: 346, height: 520 },
    { x: 692, y: 0, width: 348, height: 520 },
    { x: 0, y: 520, width: 346, height: 520 },
    { x: 346, y: 520, width: 346, height: 520 },
    { x: 692, y: 520, width: 348, height: 520 },
  ]
}

function imagemapBaseUrl(panel: ImagemapPanel): string {
  return `${appBaseUrl()}/line/imagemap/${panel}`
}

function staffImagemap(): LineMessage {
  const areas = sixImagemapAreas()
  const messages = ['�W�ǷӤ�', '�X�ԥ��d', '�����a�I', '�s�W�O�b', '�ݿ�ƶ�']
  const actions: Record<string, unknown>[] = messages.map((text, index) => ({
    type: 'message',
    label: text,
    text,
    area: areas[index],
  }))
  actions.push({
    type: 'uri',
    label: '�ӤH����',
    linkUri: `${appBaseUrl()}/profile`,
    area: areas[5],
  })
  return {
    type: 'imagemap',
    baseUrl: imagemapBaseUrl('staff'),
    altText: '�v�Ťu�@���O�G�W�ǷӤ��B�X�ԥ��d�B�����a�I�B�s�W�O�b�B�ݿ�ƶ��B�ӤH����',
    baseSize: { width: 1040, height: 1040 },
    actions,
  }
}

function managerImagemap(): LineMessage {
  const areas = sixImagemapAreas()
  const links = [
    ['�ӽмf��', '/notifications'],
    ['�ζ��X��', '/team'],
    ['�u�a�޲z', '/sites'],
    ['�u�{����', '/expenses'],
    ['�����޲z', '/quotes'],
    ['�~��޲z', '/salary'],
  ] as const
  return {
    type: 'imagemap',
    baseUrl: imagemapBaseUrl('manager'),
    altText: '�޲z���O�G�ӽмf�֡B�ζ��X�ԡB�u�a�޲z�B�u�{����B�����޲z�B�~��޲z',
    baseSize: { width: 1040, height: 1040 },
    actions: links.map(([label, path], index) => ({
      type: 'uri',
      label,
      linkUri: `${appBaseUrl()}${path}`,
      area: areas[index],
    })),
  }
}

function bindingImagemap(): LineMessage {
  return {
    type: 'imagemap',
    baseUrl: imagemapBaseUrl('binding'),
    altText: '�b���|���j�w�G�j�w�b���B�d�ݸj�w�оǩζi�J�u�{�ޮa����',
    baseSize: { width: 1040, height: 1040 },
    actions: [
      {
        type: 'uri',
        label: '�j�w�b��',
        linkUri: `${appBaseUrl()}/profile`,
        area: { x: 0, y: 0, width: 1040, height: 520 },
      },
      {
        type: 'message',
        label: '�j�w�о�',
        text: '�b���j�w�о�',
        area: { x: 0, y: 520, width: 1040, height: 260 },
      },
      {
        type: 'uri',
        label: '�i�J����',
        linkUri: appBaseUrl(),
        area: { x: 0, y: 780, width: 1040, height: 260 },
      },
    ],
  }
}

async function buildRoleImagemap(
  admin: Sb | null,
  lineUserId: string,
): Promise<LineMessage> {
  if (!admin || !lineUserId) return bindingImagemap()
  const profile = await requireProfile(admin, lineUserId)
  if ('error' in profile) return bindingImagemap()
  return isBossEquivalentProfile(profile) ? managerImagemap() : staffImagemap()
}

function bindingHelpMessage(): LineMessage {
  return flexMenu({
    altText: 'LINE �b���j�w�о�',
    eyebrow: '�b���j�w�о�',
    title: '�|�ӨB�J�����j�w',
    body:
      '1. �n�J�u�{�ޮa����\n2. �i�J�u�ӤH���ߡv\n3. ���� 6 �X LINE �j�w�X\n4. �^��o�̶ǰe�u�j�w��6 �X�v',
    buttons: [
      {
        label: '�e���ӤH����',
        uri: `${appBaseUrl()}/profile`,
        style: 'primary',
      },
    ],
  })
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
  profile?: Profile,
): Record<string, unknown> {
  const detail = (t.detail || '').slice(0, 120) || '�]�L�����^'
  const theme = lineTheme(profile)
  return {
    type: 'bubble',
    styles: {
      body: { backgroundColor: theme.surface },
      footer: { backgroundColor: theme.background },
    },
    body: {
      type: 'box',
      layout: 'vertical',
      contents: [
        { type: 'text', text: '�ݿ�', size: 'xs', color: theme.accent },
        {
          type: 'text',
          text: String(t.title).slice(0, 40),
          weight: 'bold',
          size: 'md',
          wrap: true,
          color: LINE_BRAND.text,
        },
        {
          type: 'text',
          text: detail,
          size: 'sm',
          wrap: true,
          color: LINE_BRAND.mutedText,
        },
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
          color: theme.primaryAction,
          action: {
            type: 'postback',
            label: '�аO����',
            data: `a=todo_done&id=${t.id}`,
            displayText: '�аO����',
          },
        },
        {
          type: 'button',
          style: 'secondary',
          action: {
            type: 'uri',
            label: '�d��',
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
  if (!todoId) return [textMsg('�ݿ�s���L�ġC')]
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
    return [textMsg('�аO�������ѡA�еy��A�աC')]
  }
  if (!data) return [textMsg('�䤣�즹�ݿ�A�εL�v���ާ@�C')]
  return [textMsg(`�w�����G${data.title}\n�����ݿ줤�߷|�P�B��s�C`)]
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
  if (error || !data) return [textMsg('�䤣�즹�ݿ�C')]
  const href = data.href ? `\n�s���G�Ш�u�{�ޮa�}�� ${data.href}` : ''
  return [
    textMsg(
      `�i${data.title}�j\n${data.detail || '�]�L�����^'}\n���A�G${data.status}${href}`,
    ),
  ]
}

function switchGuardMessages(draft: DraftRow, next: FlowType): LineMessage[] {
  const summary = summarizeDraft(draft)
  return [
    flexMenu({
      altText: '���|���������ާ@',
      eyebrow: '�����\��',
      title: '���|���������ާ@',
      body: `${FLOW_LABELS[draft.flow_type]}\n�w��g�G${summary.filled}\n�|�������G${summary.pending}`,
      buttons: [
        {
          label: `������${FLOW_LABELS[next]}`.slice(0, 20),
          data: `a=switch&to=${next}`,
          style: 'primary',
        },
        {
          label: `�~��${FLOW_LABELS[draft.flow_type]}`.slice(0, 20),
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
    const cleanup = await cleanupDraftMedia(admin, draft)
    await finalizeDraft(admin, draft.id, 'expired')
    const extra = cleanup.ok
      ? ''
      : `\n�]�����G�����Ȧs�C�饼��۰ʲM���G${cleanup.message || '�Ш�����Ӥ����ˬd'}�^`
    return {
      draft: null,
      age: 'expired',
      messages: [
        textMsg(`�쥻���������ާ@�w�W�L�O�d�ɶ��A��Z�w�M���C${extra}`),
      ],
    }
  }

  // paused band �X do NOT bump last_activity_at (would reset the idle clock)
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
        altText: '�Ȱ������ާ@',
        eyebrow: '�Ȱ�����',
        title: '���Ȱ������ާ@',
        body: `�����G${FLOW_LABELS[draft.flow_type]}\n�u�a�G${
          draft.draft_payload?.siteName || '�X'
        }\n�w��g�G${summary.filled}\n�̫�ާ@�G${formatTaipei(draft.last_activity_at)}`,
        buttons: [
          { label: '�~��ާ@', data: 'a=resume', style: 'primary' },
          { label: '�����ö}�l�s�\��', data: 'a=cancel', style: 'secondary' },
        ],
      }),
    ],
  }
}

function summarizeDraft(draft: DraftRow): { filled: string; pending: string } {
  const p = draft.draft_payload || {}
  if (draft.flow_type === 'attendance') {
    return {
      filled: p.openShift ? '�W�Z��' : '���',
      pending: p.selectingSite ? '��ܤu�a' : '�������d�ާ@',
    }
  }
  if (draft.flow_type === 'purchase') {
    const filled: string[] = []
    const pending: string[] = []
    if (p.kind === 'expense') filled.push('��X')
    else if (p.kind === 'receipt') filled.push('����')
    else pending.push('��ܤ�X�Φ���')
    if (p.siteName) filled.push('�u�a')
    else if (p.kind) pending.push('��ܤu�a')
    if (p.kind === 'expense') {
      if (p.item) filled.push('����')
      else if (p.siteName) pending.push('��g����')
    } else if (p.kind === 'receipt' && p.sourceNote) {
      filled.push('�ӷ�')
    }
    if (p.amount != null) filled.push('���B')
    else if (p.kind === 'expense' ? p.item : p.siteName) pending.push('��g���B')
    if (Number(p.receiptCount ?? 0) > 0) filled.push(`${p.receiptCount} �i����`)
    if (p.amount != null) pending.push('�T�{�e�X')
    return {
      filled: filled.length ? filled.join('�B') : '�|�L',
      pending: pending.length ? pending.join('�B') : '�T�{�e�X',
    }
  }
  if (draft.flow_type === 'location') {
    return {
      filled: draft.current_step === 'await_location' ? '���ݤ��ɦ�m' : '��覡',
      pending:
        draft.current_step === 'select_site'
          ? '��ܤu�a'
          : draft.current_step === 'await_location'
            ? '���� LINE ��m'
            : '��ܤ��ɦ�m�Τu�a',
    }
  }
  if (draft.flow_type !== 'photo_upload') {
    return { filled: '�i�椤', pending: '�����ާ@' }
  }
  const filled: string[] = []
  const pending: string[] = []
  if (p.siteName) filled.push('�u�a')
  else pending.push('��ܤu�a')
  if (p.photoType) filled.push('�Ӥ�����')
  else if (p.siteName) pending.push('��ܷӤ�����')
  if (Number(p.photoCount ?? 0) > 0) filled.push(`${p.photoCount} �i�Ӥ�`)
  else if (p.photoType) pending.push('�ǰe�Ӥ�')
  if (p.step === 'receiving' || Number(p.photoCount ?? 0) > 0 || p.photoType) {
    pending.push('�T�{�e�X')
  }
  return {
    filled: filled.length ? filled.join('�B') : '�|�L',
    pending: pending.length ? pending.join('�B') : '�T�{�e�X',
  }
}

async function requireProfile(
  admin: Sb | null,
  lineUserId: string,
): Promise<Profile | { error: string }> {
  if (!admin) return { error: '���A���|���]�w��Ʈw�C' }
  if (!lineUserId) return { error: 'Ū����A�� LINE User ID�C' }
  const { data, error } = await admin
    .from('profiles')
    .select('id, organization_id, name, line_user_id, role, access_template')
    .eq('line_user_id', lineUserId)
    .maybeSingle()
  if (error) {
    console.warn('[line-webhook] profile lookup failed', error.message)
    return { error: '�d�߱b���ɥX���C' }
  }
  if (!data) {
    return {
      error: '�|���j�w�C�Х���u�{�ޮa�u�ӤH���ߡv���u�� LINE �j�w�v�C',
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
    throw new Error('�L�k�إ߬y�{��Z')
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

/**
 * Hard-delete a photo batch (DB rows + storage). Used by cancel / expire / switch.
 */
async function deletePhotoBatch(
  admin: Sb,
  batchId: string,
): Promise<{ deleted: number; failed: number; error?: string }> {
  if (!batchId) return { deleted: 0, failed: 0 }
  const { data: rows, error: loadError } = await admin
    .from('photo_uploads')
    .select('id, storage_path')
    .eq('batch_id', batchId)
  if (loadError) {
    console.warn('[line-webhook] load batch failed', loadError.message)
    return { deleted: 0, failed: 0, error: '�L�kŪ���ݧR�Ӥ�' }
  }
  const list = rows ?? []
  if (list.length === 0) return { deleted: 0, failed: 0 }

  const paths = list
    .map((r) => String(r.storage_path || ''))
    .filter(Boolean)
  if (paths.length > 0) {
    const { error: storageError } = await admin.storage
      .from('site-photos')
      .remove(paths)
    if (storageError) {
      console.warn('[line-webhook] storage remove failed', storageError.message)
      return {
        deleted: 0,
        failed: list.length,
        error: '�����ɮקR�����ѡA�ЦA���@���u�����W�ǡv����',
      }
    }
  }

  const ids = list.map((r) => String(r.id))
  const { error: delError } = await admin
    .from('photo_uploads')
    .delete()
    .in('id', ids)
  if (delError) {
    console.warn('[line-webhook] photo row delete failed', delError.message)
    return {
      deleted: 0,
      failed: list.length,
      error: '�Ӥ���ƧR�����ѡA�ЦA���@���u�����W�ǡv����',
    }
  }
  return { deleted: ids.length, failed: 0 }
}

async function cleanupDraftMedia(
  admin: Sb,
  draft: DraftRow,
): Promise<{ ok: boolean; message?: string }> {
  const payload = draft.draft_payload || {}
  if (draft.flow_type === 'photo_upload') {
    const batchId = String(payload.batchId ?? '')
    if (!batchId) return { ok: true }
    const result = await deletePhotoBatch(admin, batchId)
    if (result.failed > 0 || result.error) {
      return {
        ok: false,
        message:
          result.error ||
          `�|�� ${result.failed} �i�Ӥ�����R���A�ЦA���u�����W�ǡv����`,
      }
    }
    return { ok: true }
  }
  if (draft.flow_type === 'purchase') {
    const paths = Array.isArray(payload.receiptPaths)
      ? (payload.receiptPaths as string[]).filter(Boolean)
      : []
    if (paths.length === 0) return { ok: true }
    const { error: storageError } = await admin.storage
      .from('site-photos')
      .remove(paths)
    if (storageError) {
      console.warn('[line-webhook] receipt cleanup failed', storageError.message)
      return { ok: false, message: '���ڷӤ��R�����ѡA�ЦA�����@������' }
    }
    await admin.from('photo_uploads').delete().in('storage_path', paths)
    return { ok: true }
  }
  return { ok: true }
}

async function cancelDraftWithCleanup(
  admin: Sb,
  draft: DraftRow,
): Promise<LineMessage[]> {
  const cleanup = await cleanupDraftMedia(admin, draft)
  if (!cleanup.ok) {
    return [
      flexMenu({
        altText: '����������',
        eyebrow: FLOW_LABELS[draft.flow_type],
        title: '�R��������',
        body: cleanup.message || '������ƥ���M���A�ЦA�դ@������',
        buttons: [
          {
            label: draft.flow_type === 'photo_upload' ? '�A�ը����W��' : '�A�ը���',
            data:
              draft.flow_type === 'photo_upload' ? 'a=photo_cancel' : 'a=cancel',
            style: 'primary',
          },
          { label: '�~��ާ@', data: 'a=resume', style: 'secondary' },
        ],
      }),
    ]
  }
  await finalizeDraft(admin, draft.id, 'cancelled')
  if (draft.flow_type === 'photo_upload') {
    return [
      flexMenu({
        altText: '�w�����çR���Ӥ�',
        eyebrow: '�W�ǷӤ�',
        title: '�w�����çR���Ӥ�',
        body: '���妸�Ӥ���ƻP�����ɮפw�M���A�i�A�q�Ϥ��歫�s�}�l',
      }),
    ]
  }
  return [
    flexMenu({
      altText: '�w�����ثe�ާ@',
      eyebrow: '�ާ@����',
      title: '�w����',
      body: '�i�A�q�Ϥ���}�l�s�\��',
    }),
  ]
}

async function storeLineImage(
  admin: Sb | null,
  lineToken: string,
  profile: Profile,
  messageId: string,
  meta: { siteId: string | null; photoType: string; batchId: string },
): Promise<{ ok: true; path: string } | { ok: false; error: string }> {
  if (!admin) return { ok: false, error: '���ϥ��ѡG���A���|���]�w��Ʈw�C' }
  if (!messageId) return { ok: false, error: '���ϥ��ѡG�ʤְT���s���C' }

  try {
    const contentRes = await fetch(`https://api-data.line.me/v2/bot/message/${messageId}/content`, {
      headers: { Authorization: `Bearer ${lineToken}` },
    })
    if (!contentRes.ok) {
      return { ok: false, error: '���ϥ��ѡG�L�k�V LINE �U���Ӥ��C' }
    }

    const contentType = contentRes.headers.get('content-type') || 'image/jpeg'
    const bytes = new Uint8Array(await contentRes.arrayBuffer())
    if (bytes.byteLength === 0) return { ok: false, error: '���ϥ��ѡG�ɮ׬O�Ū��C' }
    if (bytes.byteLength > 15 * 1024 * 1024) {
      return { ok: false, error: '���ϥ��ѡG�ɮ׶W�L 15MB�C' }
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
      return { ok: false, error: '���ϥ��ѡG�L�k�s�J���ݡC' }
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
      return { ok: false, error: '���ϥ��ѡG�g�J��Ʈw���ѡC��Z���O�d�A�i�A�Ǥ@���C' }
    }
    return { ok: true, path }
  } catch (err) {
    console.warn('[line-webhook] image threw', String(err).slice(0, 200))
    return { ok: false, error: '���ϥ��ѡG�t�Ψҥ~�A�еy��A�աC' }
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

function parseMenuIntent(
  text: string,
): FlowType | 'cancel' | 'resume' | 'open_app' | null {
  const t = text.trim()
  if (!t) return null
  if (/^(�����ާ@|�����y�{|����)$/.test(t)) return 'cancel'
  if (/^(�~��ާ@|�~��)$/.test(t)) return 'resume'
  if (/�i�J�u�a|�u�{�t��|�u�{�ޮa�D��|^�D��$/.test(t)) return 'open_app'
  if (/�W�ǷӤ�|�ǰe�Ӥ�|�ǷӤ�|�I�u�Ӥ�/.test(t)) return 'photo_upload'
  if (/�ݿ�ƶ�|�ڪ��ݿ�|^�ݿ�$/.test(t)) return 'todos'
  if (/�X�ԥ��d|�W�U�Z|�W�Z���d|�U�Z���d|�����u�a/.test(t)) return 'attendance'
  if (/�����a�I|�O���a�I|���I���d|����/.test(t)) return 'location'
  if (/^�O�b$|��X|����|���ʥӽ�|���Ʊ���|^����$|��X������|��X\/����/.test(t))
    return 'purchase'
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

/** Single-card Flex menu (same visual language as �ݿ�). */
function flexMenu(input: {
  altText: string
  eyebrow: string
  title: string
  body: string
  buttons?: FlexButton[]
  profile?: Profile
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
  profile?: Profile
}): Record<string, unknown> {
  const theme = lineTheme(input.profile)
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
      color: style === 'primary' ? theme.primaryAction : undefined,
      action,
    }
  })

  const bubble: Record<string, unknown> = {
    type: 'bubble',
    styles: {
      body: { backgroundColor: theme.surface },
      footer: { backgroundColor: theme.background },
    },
    body: {
      type: 'box',
      layout: 'vertical',
      spacing: 'sm',
      contents: [
        {
          type: 'text',
          text: input.eyebrow.slice(0, 20) || '�ާ@',
          size: 'xs',
          color: theme.accent,
        },
        {
          type: 'text',
          text: input.title.slice(0, 40),
          weight: 'bold',
          size: 'md',
          wrap: true,
          color: LINE_BRAND.text,
        },
        {
          type: 'text',
          text: input.body.slice(0, 400) || ' ',
          size: 'sm',
          wrap: true,
          color: LINE_BRAND.mutedText,
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
  profile?: Profile
}): LineMessage[] {
  if (input.sites.length === 0) {
    return [
      flexMenu({
        altText: input.altText,
        eyebrow: input.eyebrow,
        title: '�S���i�Τu�a',
        body: '�Х���u�{�ޮa�إߤu�a�C',
        profile: input.profile,
        buttons: input.extraButtons?.length
          ? input.extraButtons
          : [{ label: '����', data: 'a=cancel', style: 'secondary' }],
      }),
    ]
  }

  const bubbles = input.sites.slice(0, 10).map((s) =>
    actionBubble({
      eyebrow: input.eyebrow,
      title: s.name.slice(0, 40),
      body: ' ',
      profile: input.profile,
      buttons: [
        {
          label: '���',
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
        title: '��L�ﶵ',
        body: '�����w�u�a�Ψ���',
        profile: input.profile,
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

function formatTaipeiTime(iso: string): string {
  try {
    return new Intl.DateTimeFormat('zh-TW', {
      timeZone: 'Asia/Taipei',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(new Date(iso))
  } catch {
    return iso
  }
}

function taipeiDateKey(iso: string): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(iso))
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? ''
  return `${value('year')}-${value('month')}-${value('day')}`
}

function taipeiDayEndIso(iso: string): string {
  return new Date(`${taipeiDateKey(iso)}T23:59:59+08:00`).toISOString()
}

function extractBindCode(text: string): string | null {
  const normalized = text
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/[�G:]/g, ' ')
    .trim()
  const withKeyword = normalized.match(/(?:�j�w|bind)\s*([A-Za-z0-9]{6})\b/i)
  if (withKeyword?.[1]) return withKeyword[1].toUpperCase()
  const bare = normalized.match(/^([A-Za-z0-9]{6})$/i)
  if (bare?.[1]) return bare[1].toUpperCase()
  const loose = normalized.match(/(?:�j�w|bind)[^A-Za-z0-9]*([A-Za-z0-9]{6})/i)
  if (loose?.[1]) return loose[1].toUpperCase()
  return null
}

async function handleBind(
  admin: Sb | null,
  code: string,
  lineUserId: string,
): Promise<string> {
  if (!admin) return '�j�w���ѡG���A���|���]�w��Ʈw���_�C'
  if (!lineUserId) return '�j�w���ѡGŪ����A�� LINE User ID�C'

  const { data, error } = await admin.rpc('consume_line_bind_code', {
    p_code: code,
    p_line_user_id: lineUserId,
  })
  if (error) {
    console.warn('[line-webhook] consume failed', error.message)
    return `�j�w���ѡG�t�ο��~�C�N�X ${code}`
  }

  const result = (typeof data === 'string' ? JSON.parse(data) : data) as {
    ok?: boolean
    error?: string
    name?: string
  } | null

  if (!result?.ok) {
    const err = result?.error ?? 'unknown'
    if (err === 'code_not_found_or_expired') {
      return `�j�w���ѡG�N�X ${code} �L�ĩΤw�L���C�Ц^�t�έ��s���͡C`
    }
    return `�j�w���ѡ]${err}�^�C�N�X ${code}`
  }

  const name = result.name ? `�A${result.name}` : ''
  return `�j�w���\${name}�I�i�ιϤ���ާ@�W�ǷӤ��P�ݿ�C`
}

// ----- Location footprints (���I���d������) -----

/**
 * Prefer dedicated LIFF apps (Endpoint = exact page) to avoid double redirect.
 * Fallbacks: shared LIFF_ID with path, then plain site URL.
 */
function locationLiffUri(): string {
  const dedicated = (Deno.env.get('LIFF_ID_LOCATION') ?? '').trim()
  if (dedicated) return `https://liff.line.me/${dedicated}`
  const shared = (Deno.env.get('LIFF_ID') ?? '').trim()
  if (shared) return `https://liff.line.me/${shared}/location`
  return `${appBaseUrl()}/liff/location`
}

function attendanceLiffUri(): string {
  const dedicated = (Deno.env.get('LIFF_ID_ATTENDANCE') ?? '').trim()
  if (dedicated) return `https://liff.line.me/${dedicated}`
  const shared = (Deno.env.get('LIFF_ID') ?? '').trim()
  if (shared) return `https://liff.line.me/${shared}/attendance`
  return `${appBaseUrl()}/liff/attendance`
}

function expenseLiffUri(): string {
  const dedicated = (Deno.env.get('LIFF_ID_EXPENSE') ?? '').trim()
  if (dedicated) return `https://liff.line.me/${dedicated}`
  const shared = (Deno.env.get('LIFF_ID') ?? '').trim()
  if (shared) return `https://liff.line.me/${shared}/expense`
  return `${appBaseUrl()}/liff/expense`
}

/** Prefer LIFF page over multi-step chat for attendance. */
function handoffAttendanceToLiff(): LineMessage[] {
  return [
    flexMenu({
      altText: '�X�ԥ��d',
      eyebrow: '�X��',
      title: '�X�ԥ��d',
      body: '�}�ҫ�Y�i�@��W�U�Z�C',
      buttons: [
        { label: '�}�ҥX��', uri: attendanceLiffUri(), style: 'primary' },
      ],
    }),
  ]
}

/** Prefer LIFF GPS page �X opens and starts locating immediately. */
function handoffLocationToLiff(): LineMessage[] {
  return [
    flexMenu({
      altText: '�����a�I',
      eyebrow: '�a�I',
      title: '�����a�I',
      body: '�}�ҫ�|�۰ʩw��C',
      buttons: [
        { label: '�}�ҩw��', uri: locationLiffUri(), style: 'primary' },
      ],
    }),
  ]
}

/** One-page expense/receipt form instead of multi-step chat. */
function handoffExpenseToLiff(): LineMessage[] {
  return [
    flexMenu({
      altText: '�O�b',
      eyebrow: '�O�b',
      title: '�O�b',
      body: '�@������B�e�X�A���Τ@�B�B��J�C',
      buttons: [
        { label: '�}�ҰO�b', uri: expenseLiffUri(), style: 'primary' },
      ],
    }),
  ]
}

/** Close LINE draft and send URI to LIFF GPS page (no further LINE confirm). */
async function handoffLocationToWeb(
  admin: Sb,
  draft: DraftRow,
): Promise<LineMessage[]> {
  await finalizeDraft(admin, draft.id, 'completed')
  return handoffLocationToLiff()
}

async function promptLocationMethod(_draft: DraftRow): Promise<LineMessage[]> {
  return [
    flexMenu({
      altText: '�n�p������ثe��m�H',
      eyebrow: '�����a�I',
      title: '�n�p������ثe��m�H',
      body: '�~���]�ʮɥi�H��d�U����F���|�۰ʤW�U�Z�C��u���ɥثe��m�v��A��������\�w��Y�i�C',
      buttons: [
        { label: '���ɥثe��m', data: 'a=loc_share', style: 'primary' },
        { label: '��ܤu�a', data: 'a=loc_site', style: 'secondary' },
        { label: '����', data: 'a=cancel', style: 'secondary' },
      ],
    }),
  ]
}

async function handleLocationText(
  admin: Sb,
  profile: Profile,
  draft: DraftRow,
  text: string,
): Promise<LineMessage[]> {
  if (/����|�ثe��m|�w��/.test(text)) {
    return handoffLocationToWeb(admin, draft)
  }
  if (/��ܤu�a|�u�a/.test(text)) {
    return promptLocationSites(admin, profile, draft)
  }
  if (/����/.test(text)) {
    await finalizeDraft(admin, draft.id, 'cancelled')
    return [textMsg('�w�����a�I�����C')]
  }
  return promptLocationMethod(draft)
}

async function handleLocationMessage(
  admin: Sb | null,
  lineUserId: string,
  loc: {
    title: string
    address: string
    latitude: number
    longitude: number
  },
): Promise<LineMessage[]> {
  const profile = await requireProfile(admin, lineUserId)
  if ('error' in profile) return [textMsg(profile.error)]
  if (!admin) return [textMsg('���A���|���]�w��Ʈw�C')]

  const gate = await prepareActiveDraft(admin, profile)
  if (gate.messages && (gate.age === 'paused' || gate.age === 'expired')) {
    return gate.messages
  }
  if (gate.draft && gate.draft.flow_type !== 'location') {
    return switchGuardMessages(gate.draft, 'location')
  }
  let draft = gate.draft
  if (!draft || draft.flow_type !== 'location') {
    draft = await createDraft(admin, profile, 'location', 'await_location', {})
  }

  if (
    !Number.isFinite(loc.latitude) ||
    !Number.isFinite(loc.longitude)
  ) {
    return [
      textMsg('Ū���즳�Įy�СA�Ч��u�a�ΦA���ɤ@����m�C'),
      ...(await promptLocationMethod(draft)),
    ]
  }

  const open = await getOpenAttendance(admin, profile.id)
  const label = loc.title || loc.address || '�ثe��m'
  const now = new Date().toISOString()
  const { error } = await admin.from('location_checkins').insert({
    organization_id: profile.organization_id,
    user_id: profile.id,
    recorded_at: now,
    source: 'line_location',
    site_id: null,
    label,
    address: loc.address || null,
    latitude: loc.latitude,
    longitude: loc.longitude,
    attendance_id: open?.id ?? null,
  })
  if (error) {
    console.warn('[line-webhook] location insert failed', error.message)
    return [textMsg('�a�I�������ѡA�еy��A�աC')]
  }

  await finalizeDraft(admin, draft.id, 'completed')
  return [
    flexMenu({
      altText: '�a�I��������',
      eyebrow: '�����a�I',
      title: '�a�I��������',
      body: `�ɶ��G${formatTaipei(now)}\n��m���u�a�G${label}`,
    }),
  ]
}

async function promptLocationSites(
  admin: Sb,
  profile: Profile,
  draft: DraftRow,
): Promise<LineMessage[]> {
  const sites = await listSites(admin, profile.organization_id)
  await touchDraft(admin, draft.id, {
    current_step: 'select_site',
    draft_payload: { ...(draft.draft_payload || {}) },
  })
  if (sites.length === 0) {
    return [
      flexMenu({
        altText: '�S���i�Τu�a',
        eyebrow: '�����a�I',
        title: '�S���i�Τu�a',
        body: '�Ч�Ρu���ɥثe��m�v�A�Υ�������إߤu�a�C',
        buttons: [
          { label: '���ɥثe��m', data: 'a=loc_share', style: 'primary' },
          { label: '����', data: 'a=cancel', style: 'secondary' },
        ],
      }),
    ]
  }
  return siteCarousel({
    altText: '�п�ܤu�a',
    eyebrow: '�����a�I',
    sites,
    actionPrefix: 'a=loc_site_pick&id=',
    extraButtons: [{ label: '����', data: 'a=cancel', style: 'secondary' }],
  })
}

async function saveLocationBySite(
  admin: Sb,
  profile: Profile,
  draft: DraftRow,
  siteId: string,
): Promise<LineMessage[]> {
  const sites = await listSites(admin, profile.organization_id)
  const site = sites.find((s) => s.id === siteId)
  if (!site) return [textMsg('�䤣��Ӥu�a�A�Э��s��ܡC')]

  const open = await getOpenAttendance(admin, profile.id)
  const now = new Date().toISOString()
  const { error } = await admin.from('location_checkins').insert({
    organization_id: profile.organization_id,
    user_id: profile.id,
    recorded_at: now,
    source: 'line_site',
    site_id: site.id,
    label: site.name,
    address: null,
    latitude: null,
    longitude: null,
    attendance_id: open?.id ?? null,
  })
  if (error) {
    console.warn('[line-webhook] location site insert failed', error.message)
    return [textMsg('�a�I�������ѡA�еy��A�աC')]
  }

  await finalizeDraft(admin, draft.id, 'completed')
  return [
    flexMenu({
      altText: '�a�I��������',
      eyebrow: '�����a�I',
      title: '�a�I��������',
      body: `�ɶ��G${formatTaipei(now)}\n��m���u�a�G${site.name}`,
    }),
  ]
}

// ----- Phase 2: attendance -----

async function getOpenAttendance(
  admin: Sb,
  userId: string,
): Promise<{
  id: string
  clock_in_at: string
  site_id: string | null
  note: string | null
} | null> {
  const { data, error } = await admin
    .from('attendance')
    .select('id, clock_in_at, site_id, note')
    .eq('user_id', userId)
    .eq('status', 'clocked_in')
    .maybeSingle()
  if (error) {
    console.warn('[line-webhook] open attendance failed', error.message)
    return null
  }

  if (data && taipeiDateKey(data.clock_in_at) < taipeiDateKey(new Date().toISOString())) {
    const { error: closeError } = await admin
      .from('attendance')
      .update({
        status: 'clocked_out',
        clock_out_at: taipeiDayEndIso(data.clock_in_at),
        note: `${data.note ? `${data.note} ` : ''}[���۰ʤU�Z]`,
      })
      .eq('id', data.id)
      .eq('user_id', userId)
      .eq('status', 'clocked_in')
    if (closeError) {
      console.warn('[line-webhook] attendance auto-close failed', closeError.message)
    }
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
          ?.name || '�����u�a'
      : '�|���n�O�u�a'
    return [
      flexMenu({
        altText: '�X�ԥ��d�G�W�Z��',
        profile,
        eyebrow: '�X�ԥ��d',
        title: '�ثe�W�Z��',
        body: `�W�Z�ɶ��G${formatTaipei(open.clock_in_at)}\n�ثe�u�a�G${siteLabel}\n�����u�a�|�s�W�@����X����`,
        buttons: [
          { label: '�U�Z���d', data: 'a=att_out', style: 'primary' },
          { label: '�����u�a', data: 'a=att_site', style: 'secondary' },
          { label: '����', data: 'a=cancel', style: 'secondary' },
        ],
      }),
    ]
  }

  return [
    flexMenu({
      altText: '�X�ԥ��d�G���W�Z',
      profile,
      eyebrow: '�X�ԥ��d',
      title: '�ثe���W�Z',
      body: '�п�ܭn�i�檺�ާ@',
      buttons: [
        { label: '�@��W�Z', data: 'a=att_in', style: 'primary' },
        { label: '����', data: 'a=cancel', style: 'secondary' },
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
  if (/�@��W�Z|�W�Z/.test(text)) return clockInLine(admin, profile, draft)
  if (/�U�Z/.test(text)) return clockOutLine(admin, profile, draft)
  if (/�����u�a|�ɵn�u�a/.test(text)) {
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
      textMsg('�A�w�b�W�Z���A�Х��U�Z�Τ����u�a�C'),
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
    return [textMsg('�W�Z���d���ѡA�еy��A�աC��Z���O�d�C')]
  }

  // Clock-in itself finishes the draft �X site pick is optional and must not block other LINE features.
  await finalizeDraft(admin, draft.id, 'completed')

  const timeLabel = formatTaipeiTime(String(data.clock_in_at))
  const sites = await listSites(admin, profile.organization_id)
  if (sites.length === 0) {
    return [
      textMsg(
        `�W�Z���d�����U${timeLabel}\n�ثe�S���i��u�a�A�i�y�������إ߫�A�����C`,
      ),
    ]
  }

  return [
    textMsg(
      `�W�Z���d�����U${timeLabel}\n�p�n�n�O�ثe�u�a�A�Ъ�����ܡG`,
    ),
    ...siteCarousel({
      altText: '��ܥثe�u�a',
      profile,
      eyebrow: '�X�ԥ��d',
      sites,
      actionPrefix: 'a=att_site_pick&id=',
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
    return [textMsg('�ثe�S���i�椤���Z���C')]
  }

  const now = new Date().toISOString()
  const { error } = await admin
    .from('attendance')
    .update({ status: 'clocked_out', clock_out_at: now })
    .eq('id', open.id)
    .eq('user_id', profile.id)
  if (error) {
    console.warn('[line-webhook] clock out failed', error.message)
    return [textMsg('�U�Z���d���ѡA�еy��A�աC')]
  }

  await finalizeDraft(admin, draft.id, 'completed')
  return [
    flexMenu({
      altText: '�U�Z���d����',
      profile,
      eyebrow: '�X�ԥ��d',
      title: '�U�Z���d����',
      body: `�ɶ��G${formatTaipei(now)}\n���Ѫ��X�Ԭ����w�O�s�C`,
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
        altText: '�Х��W�Z',
        profile,
        eyebrow: '�X�ԥ��d',
        title: '�Х��W�Z',
        body: '��ܤu�a�e�ݥ������W�Z���d',
        buttons: [{ label: '�^�X�Կ��', data: 'a=resume', style: 'primary' }],
      }),
    ]
  }

  const sites = await listSites(admin, profile.organization_id)
  await touchDraft(admin, draft.id, {
    current_step: 'select_site',
    draft_payload: { ...draft.draft_payload, openShift: true, selectingSite: true },
  })

  return siteCarousel({
    altText: '�п�ܤu�a',
    profile,
    eyebrow: '�����u�a',
    sites,
    actionPrefix: 'a=att_site_pick&id=',
    extraButtons: [{ label: '����', data: 'a=cancel', style: 'secondary' }],
  })
}

async function assignAttendanceSite(
  admin: Sb,
  profile: Profile,
  draft: DraftRow | null,
  siteId: string,
): Promise<LineMessage[]> {
  const open = await getOpenAttendance(admin, profile.id)
  if (!open) return [textMsg('�Х��W�Z�A��ܤu�a�C')]

  const sites = await listSites(admin, profile.organization_id)
  const site = sites.find((s) => s.id === siteId)
  if (!site) {
    return [
      textMsg('�䤣��u�a�C'),
      ...(draft
        ? await promptAttendanceSite(admin, profile, draft)
        : siteCarousel({
            altText: '�п�ܤu�a',
            eyebrow: '�X�ԥ��d',
            sites,
            actionPrefix: 'a=att_site_pick&id=',
          })),
    ]
  }

  const now = new Date().toISOString()
  const { error } = await admin
    .from('attendance')
    .update({ site_id: site.id, job_type: 'project' })
    .eq('id', open.id)
    .eq('user_id', profile.id)
  if (error) {
    console.warn('[line-webhook] assign site failed', error.message)
    return [textMsg('��s�u�a���ѡA�еy��A�աC')]
  }

  // Append a visit record every time (never only overwrite attendance.site_id).
  const { error: visitError } = await admin.from('location_checkins').insert({
    organization_id: profile.organization_id,
    user_id: profile.id,
    recorded_at: now,
    source: 'attendance_site',
    site_id: site.id,
    label: site.name,
    attendance_id: open.id,
  })
  if (visitError) {
    console.warn('[line-webhook] attendance visit insert failed', visitError.message)
    return [
      textMsg(
        `�u�a���w��s���u${site.name}�v�A����X�����g�J���ѡA�ЦA��@���Ψ�����ɵn�C`,
      ),
    ]
  }

  if (draft) await finalizeDraft(admin, draft.id, 'completed')
  return [
    flexMenu({
      altText: `�w�n�O�u�a�G${site.name}`,
      profile,
      eyebrow: '�X�ԥ��d',
      title: '�w�n�O�u�a��X',
      body: `�u�a�G${site.name}\n�ɶ��G${formatTaipei(now)}\n�]�C���������|�s�W�@����X�����^`,
    }),
  ]
}

// ----- V1.0: field cash (expense / receipt) �X flow_type remains "purchase" for menu/DB -----

function promptCashKind(): LineMessage[] {
  return [
    flexMenu({
      altText: '�O�b',
      eyebrow: '�O�b',
      title: '��ܦ^������',
      body: '�g�J�{����X�Φ��ڦ^���]�D�±��ʳ�^�C���F����]�w���e���p�B��X�i�۰ʽT�{�C',
      buttons: [
        { label: '��X�^��', data: 'a=cash_kind&k=expense', style: 'primary' },
        { label: '���ڦ^��', data: 'a=cash_kind&k=receipt', style: 'secondary' },
        { label: '����', data: 'a=cancel', style: 'secondary' },
      ],
    }),
  ]
}

async function selectCashKind(
  admin: Sb,
  profile: Profile,
  draft: DraftRow,
  kind: string,
): Promise<LineMessage[]> {
  if (kind !== 'expense' && kind !== 'receipt') {
    return [textMsg('�����L�ġC'), ...promptCashKind()]
  }
  await touchDraft(admin, draft.id, {
    current_step: 'select_site',
    draft_payload: { kind, receiptPaths: [], receiptCount: 0 },
  })
  return promptCashSiteFor(admin, profile, {
    ...draft,
    current_step: 'select_site',
    draft_payload: { kind, receiptPaths: [], receiptCount: 0 },
  })
}

async function promptCashSiteFor(
  admin: Sb,
  profile: Profile,
  draft: DraftRow,
): Promise<LineMessage[]> {
  const sites = await listSitesForProfile(admin, profile)
  const miscBtn = {
    label: '�����]�[�o���\�����^',
    data: 'a=cash_misc',
    style: 'primary' as const,
  }
  if (sites.length === 0) {
    return [
      flexMenu({
        altText: '����k��',
        profile,
        eyebrow: '�O�b',
        title: '�S���i��u�a',
        body: '�i�飼�����]�[�o�B�R���B���ơB�{�ɤ䴩�^�A�νЦ���b���������u�a�v���C',
        buttons: [
          miscBtn,
          { label: '����', data: 'a=cancel', style: 'secondary' },
        ],
      }),
    ]
  }
  return siteCarousel({
    altText: '��ܤu�a������',
    profile,
    eyebrow: '�O�b',
    sites: sites.slice(0, 9),
    actionPrefix: 'a=cash_site&id=',
    extraButtons: [
      miscBtn,
      { label: '����', data: 'a=cancel', style: 'secondary' },
    ],
  })
}

async function selectCashMisc(
  admin: Sb,
  profile: Profile,
  draft: DraftRow,
): Promise<LineMessage[]> {
  void profile
  const kind = String(draft.draft_payload?.kind || '')
  const nextPayload = {
    ...draft.draft_payload,
    misc: true,
    siteId: null,
    siteName: '�����]�L�u�a�^',
    locationText: null,
  }
  if (kind === 'expense') {
    await touchDraft(admin, draft.id, {
      current_step: 'enter_item',
      draft_payload: nextPayload,
    })
    return [
      flexMenu({
        altText: '�п�J��������',
        eyebrow: '��X�^��',
        title: '�����G��J����',
        body: '�Ҧp�G�[�o���R�������ơ��{�ɤ䴩\n�����H��r�^��',
        buttons: [{ label: '����', data: 'a=cancel', style: 'secondary' }],
      }),
    ]
  }
  await touchDraft(admin, draft.id, {
    current_step: 'enter_location',
    draft_payload: nextPayload,
  })
  return promptCashLocation(draft, nextPayload)
}

function promptCashLocation(
  draft: DraftRow,
  payload?: Record<string, unknown>,
): LineMessage[] {
  const p = payload || draft.draft_payload || {}
  const kindLabel = p.kind === 'receipt' ? '���ڦ^��' : '��X�^��'
  return [
    flexMenu({
      altText: '�п�J�a�I�]�i���L�^',
      eyebrow: kindLabel,
      title: '�����G�a�I�]�i��^',
      body: '�i��J�a�I��r�]�Ҧp�G���o�������^�A�Φ^�Сu���L�v',
      buttons: [
        { label: '���L', data: 'a=cash_loc_skip', style: 'primary' },
        { label: '����', data: 'a=cancel', style: 'secondary' },
      ],
    }),
  ]
}

async function skipCashLocation(
  admin: Sb,
  profile: Profile,
  draft: DraftRow,
): Promise<LineMessage[]> {
  void profile
  const payload = { ...(draft.draft_payload || {}), locationText: null }
  const kind = String(payload.kind || '')
  if (kind === 'expense') {
    await touchDraft(admin, draft.id, {
      current_step: 'enter_amount',
      draft_payload: payload,
    })
    return [
      flexMenu({
        altText: '�п�J���B',
        eyebrow: '��X�^��',
        title: '�п�J���B',
        body: `���ءG${payload.item || '�X'}\n�ХH��r�^�мƦr�]�s�x���A�Ҧp 800�^`,
        buttons: [{ label: '����', data: 'a=cancel', style: 'secondary' }],
      }),
    ]
  }
  await touchDraft(admin, draft.id, {
    current_step: 'enter_amount',
    draft_payload: payload,
  })
  return [
    flexMenu({
      altText: '�п�J���ڪ��B',
      eyebrow: '���ڦ^��',
      title: '�п�J���B',
      body: '�i��G���Ǩӷ�������r�F�Ϊ�����J�Ʀr���B�]�Ҧp 5000�^',
      buttons: [{ label: '����', data: 'a=cancel', style: 'secondary' }],
    }),
  ]
}

async function selectCashSite(
  admin: Sb,
  profile: Profile,
  draft: DraftRow,
  siteId: string,
): Promise<LineMessage[]> {
  const sites = await listSitesForProfile(admin, profile)
  const site = sites.find((s) => s.id === siteId)
  if (!site) {
    return [
      textMsg('�䤣��u�a�εL�v���C'),
      ...(await promptCashSiteFor(admin, profile, draft)),
    ]
  }
  const kind = String(draft.draft_payload?.kind || '')
  const nextPayload = {
    ...draft.draft_payload,
    misc: false,
    siteId: site.id,
    siteName: site.name,
    locationText: null,
  }
  if (kind === 'expense') {
    await touchDraft(admin, draft.id, {
      current_step: 'enter_item',
      draft_payload: nextPayload,
    })
    return [
      flexMenu({
        altText: '�п�J��X����',
        eyebrow: '��X�^��',
        title: '�п�J��X����',
        body: `�u�a�G${site.name}\n�����H��r�^�ж��ئW�١]�Ҧp�G�������ơ^`,
        buttons: [{ label: '����', data: 'a=cancel', style: 'secondary' }],
      }),
    ]
  }
  await touchDraft(admin, draft.id, {
    current_step: 'enter_amount',
    draft_payload: nextPayload,
  })
  return [
    flexMenu({
      altText: '�п�J���ڪ��B',
      eyebrow: '���ڦ^��',
      title: '�п�J���B',
      body: `�u�a�G${site.name}\n�i��G���Ǩӷ�������r�F�Ϊ�����J�Ʀr���B�]�Ҧp 5000�^`,
      buttons: [{ label: '����', data: 'a=cancel', style: 'secondary' }],
    }),
  ]
}

async function handlePurchaseText(
  admin: Sb,
  profile: Profile,
  draft: DraftRow,
  text: string,
): Promise<LineMessage[]> {
  const step = draft.current_step || 'select_kind'
  const payload = draft.draft_payload || {}

  if (step === 'select_kind' || step === 'select_mode') {
    if (/��X/.test(text)) return selectCashKind(admin, profile, draft, 'expense')
    if (/����/.test(text)) return selectCashKind(admin, profile, draft, 'receipt')
    return promptCashKind()
  }

  if (step === 'select_site') {
    if (/����|�[�o|�R��|����|�{�ɤ䴩|�L�u�a/.test(text)) {
      return selectCashMisc(admin, profile, draft)
    }
    const num = Number(text)
    if (Number.isInteger(num) && num >= 1) {
      const sites = await listSitesForProfile(admin, profile)
      const site = sites[num - 1]
      if (site) return selectCashSite(admin, profile, draft, site.id)
    }
    return promptCashSiteFor(admin, profile, draft)
  }

  if (step === 'enter_item') {
    const item = text.trim()
    if (item.length < 2) {
      return [
        flexMenu({
          altText: '���ؤӵu',
          eyebrow: '��X�^��',
          title: '���ؤӵu',
          body: '�ЦA��J�@���]�ܤ� 2 �r�^',
          buttons: [{ label: '����', data: 'a=cancel', style: 'secondary' }],
        }),
      ]
    }
    const nextPayload = { ...payload, item }
    if (payload.misc) {
      await touchDraft(admin, draft.id, {
        current_step: 'enter_location',
        draft_payload: nextPayload,
      })
      return promptCashLocation(
        { ...draft, current_step: 'enter_location', draft_payload: nextPayload },
        nextPayload,
      )
    }
    await touchDraft(admin, draft.id, {
      current_step: 'enter_amount',
      draft_payload: nextPayload,
    })
    return [
      flexMenu({
        altText: '�п�J���B',
        eyebrow: '��X�^��',
        title: '�п�J���B',
        body: `���ءG${item}\n�ХH��r�^�мƦr�]�s�x���A�Ҧp 800�^`,
        buttons: [{ label: '����', data: 'a=cancel', style: 'secondary' }],
      }),
    ]
  }

  if (step === 'enter_location') {
    if (/^(���L|����|�L)$/.test(text.trim())) {
      return skipCashLocation(admin, profile, draft)
    }
    const locationText = text.trim()
    if (locationText.length < 1) return promptCashLocation(draft)
    const nextPayload = { ...payload, locationText }
    await touchDraft(admin, draft.id, {
      current_step: 'enter_amount',
      draft_payload: nextPayload,
    })
    if (payload.kind === 'expense') {
      return [
        flexMenu({
          altText: '�п�J���B',
          eyebrow: '��X�^��',
          title: '�п�J���B',
          body: `���ءG${payload.item || '�X'}\n�a�I�G${locationText}\n�ХH��r�^�мƦr�]�Ҧp 800�^`,
          buttons: [{ label: '����', data: 'a=cancel', style: 'secondary' }],
        }),
      ]
    }
    return [
      flexMenu({
        altText: '�п�J���ڪ��B',
        eyebrow: '���ڦ^��',
        title: '�п�J���B',
        body: `�a�I�G${locationText}\n�i��G���Ǩӷ������F�Ϊ�����J�Ʀr�]�Ҧp 5000�^`,
        buttons: [{ label: '����', data: 'a=cancel', style: 'secondary' }],
      }),
    ]
  }

  if (step === 'enter_amount') {
    const asAmount = Number(String(text).replace(/[,�A��$NTD\s]/gi, ''))
    if (Number.isFinite(asAmount) && asAmount > 0) {
      const amount = Math.round(asAmount * 100) / 100
      await touchDraft(admin, draft.id, {
        current_step: 'attach_receipt',
        draft_payload: { ...payload, amount },
      })
      return promptAttachReceipt({
        ...draft,
        current_step: 'attach_receipt',
        draft_payload: { ...payload, amount },
      })
    }
    if (payload.kind === 'receipt' && text.trim().length >= 1) {
      await touchDraft(admin, draft.id, {
        current_step: 'enter_amount',
        draft_payload: { ...payload, sourceNote: text.trim() },
      })
      return [
        flexMenu({
          altText: '�п�J���ڪ��B',
          eyebrow: '���ڦ^��',
          title: '�п�J���B',
          body: `�ӷ��G${text.trim()}\n�ХH��r�^�мƦr�]�Ҧp 5000�^`,
          buttons: [{ label: '����', data: 'a=cancel', style: 'secondary' }],
        }),
      ]
    }
    return [
      flexMenu({
        altText: '���B�L��',
        eyebrow: '�O�b',
        title: '���B�L��',
        body: '�п�J�j�� 0 ���Ʀr�]�Ҧp 800�^',
        buttons: [{ label: '����', data: 'a=cancel', style: 'secondary' }],
      }),
    ]
  }

  if (step === 'attach_receipt') {
    if (/���L|����|�L����/.test(text)) return promptCashConfirm(admin, draft)
    if (/�T�{|�e�X|�O/.test(text)) return submitFieldCash(admin, profile, draft)
    return promptAttachReceipt(draft)
  }

  if (step === 'confirm') {
    if (/�T�{|�e�X|�O/.test(text)) return submitFieldCash(admin, profile, draft)
    if (/����/.test(text)) {
      await finalizeDraft(admin, draft.id, 'cancelled')
      return [
        flexMenu({
          altText: '�w����',
          eyebrow: '�O�b',
          title: '�w����',
          body: '�i�A�q�Ϥ��歫�s�^��',
        }),
      ]
    }
    return promptCashConfirm(admin, draft)
  }

  return resumePurchase(admin, profile, draft)
}

function promptAttachReceipt(draft: DraftRow): LineMessage[] {
  const p = draft.draft_payload || {}
  const count = Number(p.receiptCount ?? 0)
  return [
    flexMenu({
      altText: '�W�Ǧ��ڷӤ��]�i��^',
      eyebrow: p.kind === 'receipt' ? '���ڦ^��' : '��X�^��',
      title: '�W�Ǧ��ڡ����ҡ]�i��^',
      body: `���B�GNT$${Number(p.amount || 0).toLocaleString()}\n�w���G${count} �i\n�i�����ǹϡF�θ��L��T�{�e�X`,
      buttons: [
        { label: '���L�A�h�T�{', data: 'a=cash_receipt_skip', style: 'primary' },
        { label: '����', data: 'a=cancel', style: 'secondary' },
      ],
    }),
  ]
}

async function handleCashReceiptImage(
  admin: Sb | null,
  lineToken: string,
  profile: Profile,
  draft: DraftRow,
  messageId: string,
): Promise<LineMessage[]> {
  const step = draft.current_step || ''
  const payload = draft.draft_payload || {}
  if (step !== 'attach_receipt' && step !== 'confirm') {
    return [
      textMsg('�Х����������B�u�a�P���B�A�A��u�W�Ǧ��ڡv�B�J�A�ǹϡC'),
      ...(await resumePurchase(admin!, profile, draft)),
    ]
  }
  if (!payload.misc && !payload.siteId) {
    return [textMsg('�ʤ֤u�a�A�Э��s�}�l�C')]
  }
  const batchId = String(payload.batchId || crypto.randomUUID())
  const result = await storeLineImage(admin, lineToken, profile, messageId, {
    siteId: payload.siteId ? String(payload.siteId) : null,
    photoType: 'unclassified',
    batchId,
  })
  if (!result.ok) return [textMsg(result.error)]

  const paths = Array.isArray(payload.receiptPaths)
    ? [...(payload.receiptPaths as string[])]
    : []
  paths.push(result.path)
  const count = paths.length
  await touchDraft(admin!, draft.id, {
    current_step: 'attach_receipt',
    draft_payload: {
      ...payload,
      batchId,
      receiptPaths: paths,
      receiptCount: count,
      receiptPhotoPath: paths[0] ?? null,
    },
  })
  return [
    flexMenu({
      altText: `�w�[�J�� ${count} �i����`,
      eyebrow: '�O�b',
      title: `�w�[�J�� ${count} �i����`,
      body: '�i�~��ǹϡA�θ��L���T�{�e�X',
      buttons: [
        { label: '�h�T�{�e�X', data: 'a=cash_receipt_skip', style: 'primary' },
        { label: '����', data: 'a=cancel', style: 'secondary' },
      ],
    }),
  ]
}

async function promptCashConfirm(
  admin: Sb,
  draft: DraftRow,
): Promise<LineMessage[]> {
  const p = draft.draft_payload || {}
  await touchDraft(admin, draft.id, {
    current_step: 'confirm',
    draft_payload: p,
  })
  const kindLabel = p.kind === 'receipt' ? '����' : '��X'
  const locLine = p.locationText ? `\n�a�I�G${p.locationText}` : ''
  return [
    flexMenu({
      altText: `�нT�{${kindLabel}`,
      eyebrow: '�O�b',
      title: `�нT�{${kindLabel}`,
      body: `�����G${kindLabel}\n�k�ݡG${p.siteName || '�X'}${locLine}\n${
        p.kind === 'expense' ? `���ءG${p.item || '�X'}` : `�ӷ��G${p.sourceNote || '�X'}`
      }\n���B�GNT$${Number(p.amount || 0).toLocaleString()}\n���ڡG${
        Number(p.receiptCount ?? 0)
      } �i`,
      buttons: [
        { label: '�T�{�e�X', data: 'a=cash_confirm', style: 'primary' },
        { label: '����', data: 'a=cancel', style: 'secondary' },
      ],
    }),
  ]
}

async function resumePurchase(
  admin: Sb,
  profile: Profile,
  draft: DraftRow,
): Promise<LineMessage[]> {
  const step = draft.current_step || 'select_kind'
  if (step === 'select_kind' || step === 'select_mode') return promptCashKind()
  if (step === 'select_site') return promptCashSiteFor(admin, profile, draft)
  if (step === 'enter_item') {
    return [
      flexMenu({
        altText: '�п�J��X����',
        eyebrow: '��X�^��',
        title: '�п�J��X����',
        body: draft.draft_payload?.misc
          ? '�Ҧp�G�[�o���R�������ơ��{�ɤ䴩'
          : '�����H��r�^�ж��ئW��',
        buttons: [{ label: '����', data: 'a=cancel', style: 'secondary' }],
      }),
    ]
  }
  if (step === 'enter_location') return promptCashLocation(draft)
  if (step === 'enter_amount') {
    return [
      flexMenu({
        altText: '�п�J���B',
        eyebrow: '�O�b',
        title: '�п�J���B',
        body: '�����H��r�^�мƦr�]�s�x���^',
        buttons: [{ label: '����', data: 'a=cancel', style: 'secondary' }],
      }),
    ]
  }
  if (step === 'attach_receipt') return promptAttachReceipt(draft)
  return promptCashConfirm(admin, draft)
}

async function listSitesForProfile(
  admin: Sb,
  profile: Profile,
): Promise<Array<{ id: string; name: string }>> {
  const all = await listSites(admin, profile.organization_id)
  if (profile.role === 'boss' || profile.role === 'owner' || profile.role === 'admin') {
    return all
  }
  const { data, error } = await admin
    .from('site_members')
    .select('site_id')
    .eq('user_id', profile.id)
    .eq('organization_id', profile.organization_id)
  if (error) {
    // Table not applied yet / query failed �� bootstrap open access
    console.warn('[line-webhook] site_members failed; show all sites', error.message)
    return all
  }
  const allowed = new Set((data ?? []).map((r) => String(r.site_id)))
  if (allowed.size > 0) {
    return all.filter((s) => allowed.has(s.id))
  }
  // No personal rows: if org never assigned anyone, keep open access
  const { count, error: countError } = await admin
    .from('site_members')
    .select('site_id', { count: 'exact', head: true })
    .eq('organization_id', profile.organization_id)
  if (countError) {
    console.warn('[line-webhook] site_members count failed', countError.message)
    return all
  }
  if ((count ?? 0) === 0) return all
  return []
}

async function submitFieldCash(
  admin: Sb,
  profile: Profile,
  draft: DraftRow,
): Promise<LineMessage[]> {
  const p = draft.draft_payload || {}
  const kind = String(p.kind || '')
  const isMisc = Boolean(p.misc) || !p.siteId
  const siteId = isMisc ? null : String(p.siteId || '')
  const siteName = isMisc
    ? '�����]�L�u�a�^'
    : String(p.siteName || '')
  const locationText = p.locationText ? String(p.locationText).trim() || null : null
  const amount = Number(p.amount ?? NaN)
  if (kind !== 'expense' && kind !== 'receipt') {
    return [textMsg('�����ʥ��A�Э��s�}�l�C')]
  }
  if (!isMisc && (!siteId || !siteName)) return [textMsg('�Х���ܤu�a�������C')]
  if (!Number.isFinite(amount) || amount <= 0) {
    return [textMsg('���B�L�ġA�Э��s�}�l�C')]
  }

  const receiptPhotoPath = p.receiptPhotoPath
    ? String(p.receiptPhotoPath)
    : Array.isArray(p.receiptPaths) && p.receiptPaths[0]
      ? String(p.receiptPaths[0])
      : null

  let threshold = 3000
  const { data: settings } = await admin
    .from('org_spend_settings')
    .select('report_review_threshold_ntd')
    .eq('organization_id', profile.organization_id)
    .maybeSingle()
  if (settings?.report_review_threshold_ntd != null) {
    threshold = Number(settings.report_review_threshold_ntd)
  }

  const expensesUri = `${appBaseUrl()}/expenses`
  const placeLabel = locationText ? `${siteName}�]${locationText}�^` : siteName

  if (kind === 'expense') {
    const item = String(p.item || '').trim()
    if (item.length < 2) return [textMsg('��X���دʥ��A�Э��s�}�l�C')]
    const needsReview = amount >= threshold
    const now = new Date().toISOString()
    const { data, error } = await admin
      .from('expense_reports')
      .insert({
        organization_id: profile.organization_id,
        site_id: siteId,
        site_name: siteName,
        location_text: locationText,
        item,
        amount,
        note: null,
        receipt_photo_path: receiptPhotoPath,
        status: needsReview ? 'pending_review' : 'confirmed',
        reported_by: profile.id,
        reported_by_name: profile.name || 'LINE',
        reviewed_by: needsReview ? null : profile.id,
        reviewed_at: needsReview ? null : now,
        review_note: needsReview
          ? null
          : `�p�B�K�f�]���e NT$${threshold.toLocaleString()}�^`,
      })
      .select('id, status, amount, item')
      .single()
    if (error) {
      console.warn('[line-webhook] expense insert failed', error.message)
      return [textMsg('�إߤ�X�^�����ѡA�еy��A�աu�T�{�e�X�v�C')]
    }
    if (needsReview) {
      const { data: bosses } = await admin
        .from('profiles')
        .select('id')
        .eq('organization_id', profile.organization_id)
        .in('role', ['boss', 'owner'])
        .neq('id', profile.id)
      for (const b of bosses ?? []) {
        await admin.from('notices').insert({
          organization_id: profile.organization_id,
          user_id: b.id,
          kind: 'todo',
          title: `��X�ݼf�֡G${item}`,
          detail: `NT$${amount.toLocaleString()} �P ${placeLabel}�]LINE�^`,
          status: 'open',
          unread: true,
          href: '/expenses',
        })
      }
    }
    await finalizeDraft(admin, draft.id, 'completed')
    return [
      flexMenu({
        altText: needsReview ? '�w�e�X��X�]�ݼf�֡^' : '�w�إߤ�X',
        eyebrow: '��X�^��',
        title: needsReview ? '�w�e�X�]�ݼf�֡^' : '�w�إߡ]�p�B�K�f�^',
        body: `�u${data.item}�v\n���B NT$${Number(data.amount).toLocaleString()}\n�k�ݡG${placeLabel}\n���A�G${data.status}`,
        buttons: [{ label: '�d�ݦ���', uri: expensesUri, style: 'primary' }],
      }),
    ]
  }

  const { data, error } = await admin
    .from('cash_receipt_reports')
    .insert({
      organization_id: profile.organization_id,
      site_id: siteId,
      site_name: siteName,
      location_text: locationText,
      amount,
      source_note: p.sourceNote ? String(p.sourceNote) : null,
      proof_photo_path: receiptPhotoPath,
      status: 'pending_confirm',
      reported_by: profile.id,
      reported_by_name: profile.name || 'LINE',
    })
    .select('id, status, amount')
    .single()
  if (error) {
    console.warn('[line-webhook] receipt insert failed', error.message)
    return [textMsg('�إߦ��ڦ^�����ѡA�еy��A�աu�T�{�e�X�v�C')]
  }
  const { data: bosses } = await admin
    .from('profiles')
    .select('id')
    .eq('organization_id', profile.organization_id)
    .in('role', ['boss', 'owner'])
    .neq('id', profile.id)
  for (const b of bosses ?? []) {
    await admin.from('notices').insert({
      organization_id: profile.organization_id,
      user_id: b.id,
      kind: 'todo',
      title: `���ګݽT�{�GNT$${amount.toLocaleString()}`,
      detail: `${placeLabel}�]LINE�^`,
      status: 'open',
      unread: true,
      href: '/expenses',
    })
  }
  await finalizeDraft(admin, draft.id, 'completed')
  return [
    flexMenu({
      altText: '�w�e�X���ڡ]�ݽT�{�^',
      eyebrow: '���ڦ^��',
      title: '�w�e�X�]�ݦ���T�{�^',
      body: `���B NT$${Number(data.amount).toLocaleString()}\n���A�G${data.status}`,
      buttons: [{ label: '�d�ݦ���', uri: expensesUri, style: 'primary' }],
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

