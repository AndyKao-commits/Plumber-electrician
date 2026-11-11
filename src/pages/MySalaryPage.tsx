import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  PAY_TYPE_LABELS,
  SALARY_CATEGORY_LABELS,
  SALARY_STATUS_LABELS,
  currentTaipeiPeriod,
  summarizeSalaryMonth,
} from '@/domain/salary'
import { useSalaryPeriod } from '@/hooks/useSalary'
import { useUser } from '@/hooks/useUser'
import { formatTaipei } from '@/lib/time'

function monthOptions(fromYear: number, fromMonth: number, count = 12) {
  const out: Array<{ year: number; month: number; label: string }> = []
  let y = fromYear
  let m = fromMonth
  for (let i = 0; i < count; i++) {
    out.push({ year: y, month: m, label: `${y} 年 ${m} 月` })
    m -= 1
    if (m < 1) {
      m = 12
      y -= 1
    }
  }
  return out
}

export function MySalaryPage() {
  const { user } = useUser()
  const now = currentTaipeiPeriod()
  const [year, setYear] = useState(now.year)
  const [month, setMonth] = useState(now.month)
  const { setting, entries, attendance, isLoading } = useSalaryPeriod(
    year,
    month,
    user?.id,
  )
  const summary = useMemo(() => summarizeSalaryMonth(entries), [entries])
  const options = monthOptions(now.year, now.month)

  if (!user) return <div className="empty">請先登入</div>

  return (
    <div className="stack fade-up">
      <section className="panel stack">
        <div className="row between">
          <div>
            <strong>我的薪資與出勤</strong>
          </div>
          <Link className="btn btn-ghost" to="/profile">
            個人資料
          </Link>
        </div>
        <div className="field">
          <label htmlFor="sal-month">月份</label>
          <select
            id="sal-month"
            value={`${year}-${month}`}
            onChange={(e) => {
              const [y, m] = e.target.value.split('-').map(Number)
              setYear(y)
              setMonth(m)
            }}
          >
            {options.map((o) => (
              <option key={o.label} value={`${o.year}-${o.month}`}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </section>

      <section className="panel stack">
        <strong>
          {year} 年 {month} 月
        </strong>
        <div className="grid-2">
          <div className="site-link">
            <p>已確認累積</p>
            <h3>NT${summary.confirmedTotal.toLocaleString()}</h3>
          </div>
          <div className="site-link">
            <p>待確認</p>
            <h3>NT${summary.pendingTotal.toLocaleString()}</h3>
          </div>
          <div className="site-link">
            <p>已支付</p>
            <h3>NT${summary.paidTotal.toLocaleString()}</h3>
          </div>
          <div className="site-link">
            <p>薪資設定</p>
            <h3>
              {setting
                ? `${PAY_TYPE_LABELS[setting.payType]} ${setting.baseAmount.toLocaleString()}`
                : '尚未設定'}
            </h3>
          </div>
        </div>
      </section>

      <section className="panel stack">
        <strong>薪資明細</strong>
        {isLoading ? (
          <div className="empty">載入中…</div>
        ) : entries.length === 0 ? (
          <div className="empty">本月尚無薪資項目</div>
        ) : (
          entries.map((e) => (
            <div key={e.id} className="site-link stack">
              <div className="row between">
                <strong>
                  {e.title} · NT${e.amount.toLocaleString()}
                </strong>
                <span className="badge">{SALARY_STATUS_LABELS[e.status]}</span>
              </div>
              <p style={{ margin: 0 }}>
                {e.entryDate} · {SALARY_CATEGORY_LABELS[e.category]}
                {e.siteName ? ` · ${e.siteName}` : ''}
                {e.note ? ` · ${e.note}` : ''}
              </p>
            </div>
          ))
        )}
      </section>

      <section className="panel stack">
        <div className="row between">
          <strong>當月出勤摘要</strong>
          <Link to="/attendance">看出勤頁</Link>
        </div>
        {attendance.length === 0 ? (
          <div className="empty">本月尚無出勤</div>
        ) : (
          attendance.map((a) => (
            <div key={a.id} className="site-link">
              <p style={{ margin: 0 }}>
                {formatTaipei(a.clockInAt, 'MM/dd HH:mm')}
                {a.clockOutAt
                  ? ` → ${formatTaipei(a.clockOutAt, 'HH:mm')}`
                  : ' → 尚未下班'}
                {a.status === 'clocked_in' ? '（進行中）' : ''}
              </p>
            </div>
          ))
        )}
      </section>
    </div>
  )
}
