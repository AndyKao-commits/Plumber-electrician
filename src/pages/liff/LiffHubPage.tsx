import { Link } from 'react-router-dom'
import { LiffFrame } from '@/components/LiffFrame'

/** Landing when LIFF Endpoint opens `/liff` without a subpath. */
export function LiffHubPage() {
  return (
    <LiffFrame title="現場操作" showClose liffEntry="hub">
      <section className="panel stack">
        <p className="muted" style={{ margin: 0 }}>
          請選擇要做的事：
        </p>
        <Link className="btn btn-primary" to="/liff/attendance" style={{ textAlign: 'center' }}>
          出勤打卡
        </Link>
        <Link className="btn btn-steel" to="/liff/location" style={{ textAlign: 'center' }}>
          紀錄地點
        </Link>
        <Link className="btn btn-steel" to="/liff/expense" style={{ textAlign: 'center' }}>
          記帳
        </Link>
      </section>
    </LiffFrame>
  )
}
