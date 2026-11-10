import { useState, type FormEvent } from 'react'
import { useTeam } from '@/hooks/useTeam'
import { useUser } from '@/hooks/useUser'
import { dataModeLabel } from '@/lib/dataMode'

export function TeamPage() {
  const { members, isLoading, error } = useTeam()
  const {
    user,
    isFormalMode,
    bindLineUserId,
    isBindingLine,
    bindLineError,
  } = useUser()
  const [lineDraft, setLineDraft] = useState<string | null>(null)
  const lineUserId = lineDraft ?? user?.lineUserId ?? ''

  async function onBindLine(event: FormEvent) {
    event.preventDefault()
    const next = await bindLineUserId(lineUserId.trim() || null)
    setLineDraft(next.lineUserId ?? '')
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
          <strong>LINE 帳號綁定</strong>
          <p className="muted" style={{ margin: 0 }}>
            登入憑證仍是 Email／密碼（DEC-004）。此處只儲存 `line_user_id`，供採購／報價／出勤通知推播。
            未設定 Channel Token 時推播會略過，不影響主流程。
          </p>
          <form className="stack" onSubmit={(e) => void onBindLine(e)}>
            <div className="field">
              <label htmlFor="line-user-id">LINE User ID</label>
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
            <div className="row" style={{ gap: 8 }}>
              <button className="btn btn-steel" type="submit" disabled={isBindingLine}>
                {isBindingLine ? '儲存中…' : '儲存綁定'}
              </button>
              <button
                className="btn btn-ghost"
                type="button"
                disabled={isBindingLine || !user?.lineUserId}
                onClick={() => {
                  setLineDraft('')
                  void bindLineUserId(null).then(() => setLineDraft(null))
                }}
              >
                解除綁定
              </button>
            </div>
            {user?.lineUserId ? (
              <p className="muted" style={{ margin: 0 }}>
                目前已綁定：{user.lineUserId}
              </p>
            ) : (
              <p className="muted" style={{ margin: 0 }}>尚未綁定</p>
            )}
          </form>
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
