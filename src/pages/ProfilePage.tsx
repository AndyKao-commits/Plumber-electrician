import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { hasFeature } from '@/domain/featureAccess'
import { useUser, userKeys } from '@/hooks/useUser'
import { isFormalMode } from '@/lib/dataMode'
import { toUserMessage } from '@/lib/errors'
import { isLineLoginConfigured, startLineBindLogin } from '@/lib/lineLogin'
import { localDb } from '@/lib/localDb'
import { supabaseRepos } from '@/lib/supabaseRepos'

export function ProfilePage() {
  const {
    user,
    isFormalMode: formalFromHook,
    bindLineUserId,
    isBindingLine,
    bindLineError,
    createLineBindCode,
    isCreatingLineBindCode,
    createLineBindCodeError,
    refetch,
  } = useUser()
  const formal = isFormalMode() || formalFromHook
  const queryClient = useQueryClient()
  const isBoss = user?.role === 'boss'
  const canManageAccounts = hasFeature(user, 'account')

  const [name, setName] = useState('')
  const [nickname, setNickname] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [jobTitle, setJobTitle] = useState('')
  const [hiredAt, setHiredAt] = useState('')
  const [notes, setNotes] = useState('')
  const [saved, setSaved] = useState(false)
  const [lineDraft, setLineDraft] = useState<string | null>(null)
  const [bindCode, setBindCode] = useState<string | null>(null)
  const [bindExpiresAt, setBindExpiresAt] = useState<string | null>(null)
  const [showFallback, setShowFallback] = useState(false)
  const [lineLoginError, setLineLoginError] = useState<string | null>(null)
  const [lineFlash, setLineFlash] = useState<string | null>(null)
  const lineUserId = lineDraft ?? user?.lineUserId ?? ''
  const lineLoginReady = isLineLoginConfigured()

  const directoryQuery = useQuery({
    queryKey: [...userKeys.directory(), 'formal'],
    enabled: Boolean(user && isBoss),
    queryFn: async () => {
      if (!user) return []
      if (formal) return supabaseRepos.listOrgProfiles(user)
      return localDb.getUsers()
    },
  })

  useEffect(() => {
    if (!user) return
    setName(user.name ?? '')
    setNickname(user.nickname ?? '')
    setBirthDate(user.birthDate ?? '')
    setJobTitle(user.jobTitle ?? '')
    setHiredAt(user.hiredAt ?? '')
    setNotes(user.notes ?? '')
  }, [user])

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('尚未登入')
      const input = {
        name,
        nickname,
        birthDate: birthDate || null,
        jobTitle,
        hiredAt: hiredAt || null,
        notes,
      }
      return formal
        ? supabaseRepos.updateProfile(user, user.id, input)
        : localDb.updateProfile(user, user.id, input)
    },
    onSuccess: (next) => {
      queryClient.setQueryData(userKeys.me(), next)
      setSaved(true)
    },
  })

  const statusMutation = useMutation({
    mutationFn: async (input: {
      targetUserId: string
      accountStatus: 'active' | 'disabled'
    }) => {
      if (!user) throw new Error('尚未登入')
      return formal
        ? supabaseRepos.updateProfile(user, input.targetUserId, {
            accountStatus: input.accountStatus,
          })
        : localDb.updateProfile(user, input.targetUserId, {
            accountStatus: input.accountStatus,
          })
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: userKeys.directory() })
      void directoryQuery.refetch()
    },
  })

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setSaved(false)
    await saveMutation.mutateAsync()
  }

  async function onBindLine(event: FormEvent) {
    event.preventDefault()
    setLineFlash(null)
    try {
      const next = await bindLineUserId(lineUserId.trim() || null)
      setLineDraft(next.lineUserId ?? '')
      setLineFlash(next.lineUserId ? 'LINE 綁定已儲存' : '已解除 LINE 綁定')
      await refetch()
    } catch (err) {
      setLineFlash(null)
      setLineLoginError(err instanceof Error ? err.message : '綁定失敗')
    }
  }

  async function onCreateBindCode() {
    setLineFlash(null)
    const result = await createLineBindCode()
    setBindCode(result.code)
    setBindExpiresAt(result.expiresAt)
    setLineFlash('綁定碼已產生，請在 LINE 傳送')
  }

  function onLineLoginBind() {
    setLineLoginError(null)
    try {
      startLineBindLogin()
    } catch (err) {
      setLineLoginError(err instanceof Error ? err.message : '無法啟動 LINE 綁定')
    }
  }

  if (!user) return <div className="empty">請先登入</div>

  const hiredLocked = Boolean(user.hiredAt) && !isBoss

  return (
    <div className="stack fade-up">
      <section className="panel stack">
        <strong>個人中心</strong>
        {user.roleGroupName ? (
          <p className="muted" style={{ margin: 0 }}>
            身分組：{user.roleGroupName}
          </p>
        ) : null}
      </section>

      {formal ? (
        <section className="panel stack">
          <strong>個人 LINE 綁定</strong>
          <p className="muted" style={{ margin: 0, fontSize: '0.9rem' }}>
            綁定後可用圖文選單做出勤與定位（不主動推播）。
          </p>
          {lineFlash ? (
            <p style={{ color: 'var(--ok)', margin: 0 }}>{lineFlash}</p>
          ) : null}
          {user.lineUserId ? (
            <div className="stack">
              <span className="badge ok">已綁定 LINE</span>
              <button
                className="btn btn-ghost"
                type="button"
                disabled={isBindingLine}
                onClick={() => {
                  setLineDraft('')
                  setBindCode(null)
                  setLineFlash(null)
                  void bindLineUserId(null)
                    .then(() => {
                      setLineDraft(null)
                      setLineFlash('已解除 LINE 綁定')
                      return refetch()
                    })
                    .catch((err) =>
                      setLineLoginError(
                        err instanceof Error ? err.message : '解除失敗',
                      ),
                    )
                }}
              >
                {isBindingLine ? '處理中…' : '解除綁定'}
              </button>
            </div>
          ) : (
            <div className="stack">
              <button
                className="btn btn-primary"
                type="button"
                disabled={!lineLoginReady}
                onClick={onLineLoginBind}
              >
                用 LINE 綁定
              </button>
              {!lineLoginReady ? (
                <p className="muted" style={{ margin: 0, fontSize: '0.88rem' }}>
                  尚未設定 LINE Login，請用下方進階方式。
                </p>
              ) : null}
              {lineLoginError ? (
                <p style={{ color: 'var(--danger)', margin: 0 }}>{lineLoginError}</p>
              ) : null}

              <button
                className="btn btn-ghost"
                type="button"
                onClick={() => setShowFallback((v) => !v)}
                style={{ alignSelf: 'flex-start' }}
              >
                {showFallback ? '收合進階' : '進階：綁定碼／User ID'}
              </button>

              {showFallback ? (
                <div className="stack">
                  <ol className="muted" style={{ margin: 0, paddingLeft: '1.2rem' }}>
                    <li>按「產生綁定碼」</li>
                    <li>對官方帳號傳送：綁定 代碼</li>
                    <li>成功後按「重新整理」</li>
                  </ol>
                  <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                    <button
                      className="btn btn-steel"
                      type="button"
                      disabled={isCreatingLineBindCode}
                      onClick={() => void onCreateBindCode()}
                    >
                      {isCreatingLineBindCode ? '產生中…' : '產生綁定碼'}
                    </button>
                    <button
                      className="btn btn-ghost"
                      type="button"
                      onClick={() => void refetch()}
                    >
                      重新整理
                    </button>
                  </div>
                  {createLineBindCodeError ? (
                    <p style={{ color: 'var(--danger)', margin: 0 }}>
                      {createLineBindCodeError.message}
                    </p>
                  ) : null}
                  {bindCode ? (
                    <div className="site-link stack">
                      <p className="muted" style={{ margin: 0 }}>
                        請在 LINE 傳送：
                      </p>
                      <strong style={{ fontSize: '1.4rem', letterSpacing: '0.12em' }}>
                        綁定 {bindCode}
                      </strong>
                      {bindExpiresAt ? (
                        <p className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>
                          有效至{' '}
                          {new Date(bindExpiresAt).toLocaleString('zh-TW', {
                            timeZone: 'Asia/Taipei',
                          })}
                          （台北時間）
                        </p>
                      ) : null}
                    </div>
                  ) : null}

                  <form className="stack" onSubmit={(e) => void onBindLine(e)}>
                    <div className="field">
                      <label htmlFor="line-user-id">手動貼上 LINE User ID</label>
                      <input
                        id="line-user-id"
                        value={lineUserId}
                        onChange={(e) => setLineDraft(e.target.value)}
                        placeholder="Uxxxxxxxx…"
                        autoComplete="off"
                      />
                    </div>
                    {bindLineError ? (
                      <p style={{ color: 'var(--danger)', margin: 0 }}>
                        {bindLineError.message}
                      </p>
                    ) : null}
                    <button className="btn btn-ghost" type="submit" disabled={isBindingLine}>
                      {isBindingLine ? '儲存中…' : '儲存綁定'}
                    </button>
                  </form>
                </div>
              ) : null}
            </div>
          )}
        </section>
      ) : null}

      <form className="panel stack" onSubmit={(e) => void onSubmit(e)}>
        <strong>個人資料</strong>
        <div className="field">
          <label htmlFor="pf-name">姓名</label>
          <input
            id="pf-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>
        <div className="field">
          <label htmlFor="pf-nick">暱稱</label>
          <input
            id="pf-nick"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
          />
        </div>
        <div className="grid-2">
          <div className="field">
            <label htmlFor="pf-birth">生日</label>
            <input
              id="pf-birth"
              type="date"
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="pf-hired">到職日</label>
            <input
              id="pf-hired"
              type="date"
              value={hiredAt}
              onChange={(e) => setHiredAt(e.target.value)}
              disabled={hiredLocked}
            />
            {hiredLocked ? (
              <p className="muted" style={{ margin: '4px 0 0', fontSize: '0.85rem' }}>
                已鎖定。若需更正請聯絡老闆。
              </p>
            ) : !isBoss ? (
              <p className="muted" style={{ margin: '4px 0 0', fontSize: '0.85rem' }}>
                首次儲存後不可自行修改。
              </p>
            ) : null}
          </div>
        </div>
        <div className="field">
          <label htmlFor="pf-job">工種／職稱</label>
          <input
            id="pf-job"
            value={jobTitle}
            onChange={(e) => setJobTitle(e.target.value)}
            placeholder="例如：水電、泥作"
          />
        </div>
        <div className="field">
          <label htmlFor="pf-notes">備註</label>
          <input
            id="pf-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>
        <p className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>
          帳號狀態：{user.accountStatus === 'disabled' ? '停用' : '啟用'}
        </p>
        <button
          className="btn btn-primary"
          type="submit"
          disabled={saveMutation.isPending}
        >
          {saveMutation.isPending ? '儲存中…' : '儲存個人資料'}
        </button>
        {saveMutation.error ? (
          <p style={{ color: 'var(--danger)', margin: 0 }}>
            {toUserMessage(saveMutation.error)}
          </p>
        ) : null}
        {saved ? <p className="muted" style={{ margin: 0 }}>已儲存</p> : null}
      </form>

      {canManageAccounts ? (
        <section className="panel stack">
          <div className="row between">
            <strong>帳號與管理</strong>
            <Link className="btn btn-steel" to="/access">
              {isBoss ? '開帳／權限' : '協助註冊'}
            </Link>
          </div>
          {!isBoss ? (
            <p className="muted" style={{ margin: 0, fontSize: '0.9rem' }}>
              可協助註冊新帳號（預設密碼與帳號相同）。
            </p>
          ) : (
            (directoryQuery.data ?? [])
              .filter((m) => m.id !== user.id)
              .map((m) => (
                <div key={m.id} className="row between" style={{ gap: 8 }}>
                  <div>
                    <strong style={{ margin: 0 }}>{m.name}</strong>
                    <p className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>
                      {m.roleGroupName || m.jobTitle || '未填工種'} ·{' '}
                      {m.accountStatus === 'disabled' ? '停用' : '啟用'}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    disabled={statusMutation.isPending}
                    onClick={() =>
                      void statusMutation.mutateAsync({
                        targetUserId: m.id,
                        accountStatus:
                          m.accountStatus === 'disabled' ? 'active' : 'disabled',
                      })
                    }
                  >
                    {m.accountStatus === 'disabled' ? '啟用' : '停用'}
                  </button>
                </div>
              ))
          )}
        </section>
      ) : null}
    </div>
  )
}
