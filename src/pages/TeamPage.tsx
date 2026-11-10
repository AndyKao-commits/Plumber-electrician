import { useTeam } from '@/hooks/useTeam'
import { dataModeLabel } from '@/lib/dataMode'

export function TeamPage() {
  const { members, isLoading, error } = useTeam()

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
