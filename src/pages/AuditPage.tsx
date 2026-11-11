import { useQuery } from '@tanstack/react-query'
import { AUDIT_ACTION_LABELS, type AuditAction } from '@/domain/auditLog'
import { isFormalMode } from '@/lib/dataMode'
import { localDb } from '@/lib/localDb'
import { supabaseRepos } from '@/lib/supabaseRepos'
import { useUser } from '@/hooks/useUser'
import { formatTaipei } from '@/lib/time'

export function AuditPage() {
  const { user } = useUser()
  const formal = isFormalMode()
  const { data: logs = [] } = useQuery({
    queryKey: ['audit-logs'],
    enabled: Boolean(user),
    queryFn: async () =>
      formal
        ? supabaseRepos.listAuditLogs()
        : localDb.listAuditLogs(80),
  })

  if (user?.role !== 'boss') {
    return (
      <div className="stack fade-up">
        <section className="panel">
          <p className="muted" style={{ margin: 0 }}>
            僅老闆可查看操作紀錄。
          </p>
        </section>
      </div>
    )
  }

  return (
    <div className="stack fade-up">
      <section className="panel stack">
        <strong>操作紀錄（V1.0）</strong>
        <p className="muted" style={{ margin: 0 }}>
          支出／收款審核、待辦指派、案件與 LINE 綁定等重要操作留痕。
        </p>
      </section>
      <section className="panel stack">
        {logs.length === 0 ? <div className="empty">尚無紀錄</div> : null}
        {logs.map((log) => (
          <div key={log.id} className="site-link">
            <div className="row between">
              <strong>
                {AUDIT_ACTION_LABELS[log.action as AuditAction] || log.action}
              </strong>
              <span className="muted" style={{ fontSize: '0.85rem' }}>
                {formatTaipei(log.createdAt, 'MM/dd HH:mm')}
              </span>
            </div>
            <p style={{ margin: 0 }}>
              {log.actorName} · {log.targetType}/{log.targetId.slice(0, 8)} ·{' '}
              {log.result}
            </p>
          </div>
        ))}
      </section>
    </div>
  )
}
