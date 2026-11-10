import { useTeam } from '@/hooks/useTeam'

export function TeamPage() {
  const { data: team = [], isLoading } = useTeam()

  return (
    <div className="stack fade-up">
      <section className="panel stack">
        <strong>今日團隊</strong>
        <p className="muted" style={{ margin: 0 }}>
          全員可看今日到班與工程參與；個人打卡明細、更正原因、效率與薪資保密。
        </p>
      </section>

      <section className="stack">
        {isLoading ? <div className="empty">載入中…</div> : null}
        {team.map((member) => (
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
