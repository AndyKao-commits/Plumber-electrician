import { useTeam } from '@/hooks/useTeam'

export function TeamPage() {
  const { members, isLoading, error } = useTeam()

  return (
    <div className="stack fade-up">
      <section className="panel stack">
        <strong>今日團隊</strong>
        <p className="muted" style={{ margin: 0, fontSize: '0.9rem' }}>
          今日出勤與最後位置。LINE 綁定請到「個人中心」。
        </p>
      </section>

      <section className="stack">
        {isLoading ? <div className="empty">載入中…</div> : null}
        {error ? (
          <div className="empty" style={{ color: 'var(--danger)' }}>
            {(error as Error).message}
          </div>
        ) : null}
        {!isLoading && !error && members.length === 0 ? (
          <div className="empty">今天尚無出勤成員</div>
        ) : null}
        {members.map((member) => (
          <div key={member.userId} className="site-link stack">
            <div className="row between">
              <h3 style={{ margin: 0 }}>{member.name}</h3>
              <span className={`badge ${member.clockedIn ? 'ok' : 'steel'}`}>
                {member.clockedIn ? '上班中' : '已下班'}
              </span>
            </div>
            {member.clockedIn ? (
              <>
                <p style={{ margin: 0 }}>
                  最後地點：{member.lastLocation?.trim() || '尚未紀錄'}
                </p>
                <p className="muted" style={{ margin: 0 }}>
                  {member.lastLocationAt
                    ? `最後紀錄：${new Date(member.lastLocationAt).toLocaleTimeString(
                        'zh-TW',
                        { timeZone: 'Asia/Taipei', hour: '2-digit', minute: '2-digit' },
                      )}`
                    : member.clockInAt
                      ? `上班時間：${new Date(member.clockInAt).toLocaleTimeString(
                          'zh-TW',
                          {
                            timeZone: 'Asia/Taipei',
                            hour: '2-digit',
                            minute: '2-digit',
                          },
                        )}`
                      : '尚未紀錄'}
                </p>
              </>
            ) : (
              <>
                <p style={{ margin: 0 }}>
                  最後地點：{member.lastLocation?.trim() || '尚未紀錄'}
                </p>
                <p className="muted" style={{ margin: 0 }}>
                  {member.clockOutAt
                    ? `下班時間：${new Date(member.clockOutAt).toLocaleTimeString(
                        'zh-TW',
                        { timeZone: 'Asia/Taipei', hour: '2-digit', minute: '2-digit' },
                      )}`
                    : '已下班'}
                </p>
              </>
            )}
          </div>
        ))}
      </section>
    </div>
  )
}
