import { useState, type FormEvent } from 'react'
import { useTeam } from '@/hooks/useTeam'
import { useUser } from '@/hooks/useUser'
import { dataModeLabel } from '@/lib/dataMode'
import { isLineLoginConfigured, startLineBindLogin } from '@/lib/lineLogin'

export function TeamPage() {
  const { members, isLoading, error } = useTeam()
  const {
    user,
    isFormalMode,
    bindLineUserId,
    isBindingLine,
    bindLineError,
    createLineBindCode,
    isCreatingLineBindCode,
    createLineBindCodeError,
    refetch,
  } = useUser()
  const [lineDraft, setLineDraft] = useState<string | null>(null)
  const [bindCode, setBindCode] = useState<string | null>(null)
  const [bindExpiresAt, setBindExpiresAt] = useState<string | null>(null)
  const [showFallback, setShowFallback] = useState(false)
  const [lineLoginError, setLineLoginError] = useState<string | null>(null)
  const lineUserId = lineDraft ?? user?.lineUserId ?? ''
  const lineLoginReady = isLineLoginConfigured()

  async function onBindLine(event: FormEvent) {
    event.preventDefault()
    const next = await bindLineUserId(lineUserId.trim() || null)
    setLineDraft(next.lineUserId ?? '')
  }

  async function onCreateBindCode() {
    const result = await createLineBindCode()
    setBindCode(result.code)
    setBindExpiresAt(result.expiresAt)
  }

  function onLineLoginBind() {
    setLineLoginError(null)
    try {
      startLineBindLogin()
    } catch (err) {
      setLineLoginError(err instanceof Error ? err.message : '無法啟動 LINE 綁定')
    }
  }

  return (
    <div className="stack fade-up">
      <section className="panel stack">
        <div className="row between">
          <strong>今日團隊</strong>
          <span className="badge steel">{dataModeLabel()}</span>
        </div>
        <p className="muted" style={{ margin: 0 }}>
          僅顯示今日到班狀態與目前工地；不顯示他人完整打卡時間、GPS、備註或薪資。
        </p>
      </section>

      {isFormalMode ? (
        <section className="panel stack">
          <strong>個人 LINE 綁定</strong>
          <p className="muted" style={{ margin: 0 }}>
            登入仍用 Email／密碼。綁定 LINE 後，圖文選單操作可對應到你的系統帳號。
            傳訊給官方帳號不會再刷功能選單（請用圖文選單）。
          </p>

          {user?.lineUserId ? (
            <div className="site-link stack">
              <strong style={{ margin: 0 }}>已綁定</strong>
              <p className="muted" style={{ margin: 0, wordBreak: 'break-all' }}>
                {user.lineUserId}
              </p>
              <button
                className="btn btn-ghost"
                type="button"
                disabled={isBindingLine}
                onClick={() => {
                  setLineDraft('')
                  setBindCode(null)
                  void bindLineUserId(null).then(() => setLineDraft(null))
                }}
              >
                解除綁定
              </button>
            </div>
          ) : (
            <div className="stack">
              <button
                className="btn btn-steel"
                type="button"
                disabled={!lineLoginReady}
                onClick={onLineLoginBind}
              >
                用 LINE 綁定
              </button>
              {!lineLoginReady ? (
                <p className="muted" style={{ margin: 0, fontSize: '0.88rem' }}>
                  尚未設定 `VITE_LINE_LOGIN_CHANNEL_ID`（Vercel 環境變數）。可先用下方備援綁定碼。
                </p>
              ) : (
                <p className="muted" style={{ margin: 0, fontSize: '0.88rem' }}>
                  會開啟 LINE 授權頁；授權後只寫入綁定，不會改系統登入方式。
                </p>
              )}
              {lineLoginError ? (
                <p style={{ color: 'var(--danger)', margin: 0 }}>{lineLoginError}</p>
              ) : null}

              <button
                className="btn btn-ghost"
                type="button"
                onClick={() => setShowFallback((v) => !v)}
                style={{ alignSelf: 'flex-start' }}
              >
                {showFallback ? '收合備援綁定碼' : '備援：用綁定碼'}
              </button>

              {showFallback ? (
                <div className="stack">
                  <ol className="muted" style={{ margin: 0, paddingLeft: '1.2rem' }}>
                    <li>按「產生綁定碼」</li>
                    <li>對官方帳號傳送：綁定 代碼</li>
                    <li>收到成功後按「重新整理」</li>
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
                    <button className="btn btn-ghost" type="button" onClick={() => void refetch()}>
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
                      <p className="muted" style={{ margin: 0 }}>請在 LINE 傳送：</p>
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
                      <label htmlFor="line-user-id">或手動貼上 LINE User ID</label>
                      <input
                        id="line-user-id"
                        value={lineUserId}
                        onChange={(e) => setLineDraft(e.target.value)}
                        placeholder="Uxxxxxxxx…"
                        autoComplete="off"
                      />
                    </div>
                    {bindLineError ? (
                      <p style={{ color: 'var(--danger)', margin: 0 }}>{bindLineError.message}</p>
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

      <section className="stack">
        {isLoading ? <div className="empty">載入中…</div> : null}
        {error ? (
          <div className="empty" style={{ color: 'var(--danger)' }}>
            {(error as Error).message}
          </div>
        ) : null}
        {!isLoading && !error && members.length === 0 ? (
          <div className="empty">尚無團隊成員</div>
        ) : null}
        {members.map((member) => (
          <div key={member.userId} className="site-link">
            <div className="row between">
              <h3 style={{ margin: 0 }}>{member.name}</h3>
              <span className={`badge ${member.clockedIn ? 'ok' : 'steel'}`}>
                {member.clockedIn ? '已到班' : '未到班'}
              </span>
            </div>
            <p>
              {member.clockedIn
                ? member.siteName || '尚未選擇工地'
                : '今天尚未上班打卡'}
            </p>
          </div>
        ))}
      </section>
    </div>
  )
}
