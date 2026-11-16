import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { buildMonthGrid } from '@/domain/attendanceCalendar'
import {
  PAY_TYPE_LABELS,
  SALARY_CATEGORY_COLORS,
  SALARY_CATEGORY_LABELS,
  SALARY_STATUS_LABELS,
  currentTaipeiPeriod,
  summarizeSalaryMonth,
  summarizeUnpaidAcrossMonths,
} from '@/domain/salary'
import type { SalaryEntry } from '@/domain/types'
import { useSalaryPeriod } from '@/hooks/useSalary'
import { useUser } from '@/hooks/useUser'
import { useQueries } from '@tanstack/react-query'
import { isFormalMode } from '@/lib/dataMode'
import { localDb } from '@/lib/localDb'
import { supabaseRepos } from '@/lib/supabaseRepos'

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
  const formal = isFormalMode()
  const now = currentTaipeiPeriod()
  const [year, setYear] = useState(now.year)
  const [month, setMonth] = useState(now.month)
  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const [view, setView] = useState<'home' | 'month'>('home')

  const { setting, entries, payments, isLoading } = useSalaryPeriod(
    year,
    month,
    user?.id,
  )
  const summary = useMemo(
    () => summarizeSalaryMonth(entries, payments),
    [entries, payments],
  )
  const options = monthOptions(now.year, now.month)

  const historyQueries = useQueries({
    queries: options.map((o) => ({
      queryKey: ['salary', 'balance', user?.id, o.year, o.month],
      enabled: Boolean(user?.id),
      queryFn: async () => {
        if (!user) return { year: o.year, month: o.month, entries: [], payments: [] }
        const [ents, pays] = await Promise.all([
          formal
            ? supabaseRepos.listSalaryEntries(user, {
                year: o.year,
                month: o.month,
                userId: user.id,
              })
            : Promise.resolve(
                localDb.listSalaryEntries({
                  year: o.year,
                  month: o.month,
                  userId: user.id,
                }),
              ),
          formal
            ? supabaseRepos.listSalaryPayments(user, {
                year: o.year,
                month: o.month,
                employeeId: user.id,
              })
            : Promise.resolve(
                localDb.listSalaryPayments({
                  year: o.year,
                  month: o.month,
                  employeeId: user.id,
                }),
              ),
        ])
        return { year: o.year, month: o.month, entries: ents, payments: pays }
      },
    })),
  })

  const unpaidOverview = useMemo(() => {
    const months = historyQueries
      .map((q) => q.data)
      .filter(Boolean)
      .map((d) => ({
        year: d!.year,
        month: d!.month,
        summary: summarizeSalaryMonth(d!.entries, d!.payments),
      }))
    return summarizeUnpaidAcrossMonths(months)
  }, [historyQueries])

  const grid = useMemo(() => buildMonthGrid(year, month - 1), [year, month])
  const byDay = useMemo(() => {
    const map = new Map<string, SalaryEntry[]>()
    for (const e of entries) {
      if (e.status === 'cancelled') continue
      const list = map.get(e.entryDate) ?? []
      list.push(e)
      map.set(e.entryDate, list)
    }
    return map
  }, [entries])
  const dayEntries = selectedDay ? byDay.get(selectedDay) ?? [] : []

  if (!user) return <div className="empty">請先登入</div>

  if (view === 'home') {
    return (
      <div className="stack fade-up">
        <section className="panel stack">
          <div className="row between">
            <strong>我的薪資</strong>
            <Link className="btn btn-ghost" to="/profile">
              個人資料
            </Link>
          </div>
          <div className="site-link">
            <p>目前累計尚未領到</p>
            <h2 style={{ margin: '8px 0 0' }}>
              NT${unpaidOverview.unpaidTotal.toLocaleString()}
            </h2>
            <p className="muted" style={{ margin: '8px 0 0', fontSize: '0.85rem' }}>
              僅計已確認應領 − 已付款；待確認另計
            </p>
          </div>
        </section>

        <section className="panel stack">
          <strong>各月明細</strong>
          {unpaidOverview.months.length === 0 ? (
            <div className="empty">尚無薪資紀錄</div>
          ) : (
            unpaidOverview.months.map((m) => (
              <button
                key={`${m.year}-${m.month}`}
                type="button"
                className="site-link"
                style={{ textAlign: 'left', width: '100%' }}
                onClick={() => {
                  setYear(m.year)
                  setMonth(m.month)
                  setView('month')
                }}
              >
                <div className="row between">
                  <strong style={{ margin: 0 }}>
                    {m.year} 年 {m.month} 月
                  </strong>
                  <span className="badge">
                    {m.unpaidTotal > 0
                      ? `尚未收到 NT$${m.unpaidTotal.toLocaleString()}`
                      : m.unpaidTotal < 0
                        ? `溢付 NT$${Math.abs(m.unpaidTotal).toLocaleString()}`
                        : '已結清'}
                  </span>
                </div>
                <p className="muted" style={{ margin: '6px 0 0' }}>
                  出工 {m.workDays} 天 · 應領 {m.confirmedTotal.toLocaleString()} ·
                  實領 {m.paidTotal.toLocaleString()}
                </p>
              </button>
            ))
          )}
        </section>
      </div>
    )
  }

  return (
    <div className="stack fade-up">
      <section className="panel stack">
        <div className="row between">
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => setView('home')}
          >
            ← 累計總覽
          </button>
          <Link className="btn btn-ghost" to="/attendance">
            出勤
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
              setSelectedDay(null)
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
            <p>出工天數</p>
            <h3>{summary.workDays}</h3>
          </div>
          <div className="site-link">
            <p>應領</p>
            <h3>NT${summary.confirmedTotal.toLocaleString()}</h3>
          </div>
          <div className="site-link">
            <p>實領</p>
            <h3>NT${summary.paidTotal.toLocaleString()}</h3>
          </div>
          <div className="site-link">
            <p>尚未收到</p>
            <h3>NT${summary.unpaidTotal.toLocaleString()}</h3>
          </div>
        </div>
        {payments[0] ? (
          <p className="muted" style={{ margin: 0 }}>
            最近支付：{payments.map((p) => `${p.paidOn} NT$${p.amount.toLocaleString()}`).join('、')}
          </p>
        ) : null}
        <p className="muted" style={{ margin: 0 }}>
          設定：
          {setting
            ? `${PAY_TYPE_LABELS[setting.payType]} NT$${setting.baseAmount.toLocaleString()}`
            : '尚未設定'}
          {summary.pendingTotal
            ? ` · 待確認 NT$${summary.pendingTotal.toLocaleString()}`
            : ''}
        </p>
      </section>

      <section className="panel stack">
        <strong>明細日曆</strong>
        {isLoading ? <div className="empty">載入中…</div> : null}
        <div className="attendance-cal">
          {['日', '一', '二', '三', '四', '五', '六'].map((d) => (
            <div key={d} className="attendance-cal-head">
              {d}
            </div>
          ))}
          {grid.map((cell, idx) => {
            if (!cell.day) {
              return (
                <div key={`e-${idx}`} className="attendance-cal-day muted" />
              )
            }
            const list = byDay.get(cell.day) ?? []
            const hasPending = list.some((e) => e.status === 'pending')
            const color =
              list[0] != null
                ? SALARY_CATEGORY_COLORS[list[0].category]
                : undefined
            return (
              <button
                key={cell.day}
                type="button"
                className={`attendance-cal-day${selectedDay === cell.day ? ' selected' : ''}`}
                style={
                  list.length
                    ? {
                        borderColor: hasPending ? color : 'transparent',
                        borderWidth: hasPending ? 2 : 1,
                        background: hasPending
                          ? 'transparent'
                          : color
                            ? `color-mix(in srgb, ${color} 22%, white)`
                            : undefined,
                        color: hasPending ? color : undefined,
                      }
                    : undefined
                }
                onClick={() => setSelectedDay(cell.day)}
              >
                <span className="cal-num">{Number(cell.day.slice(8))}</span>
              </button>
            )
          })}
        </div>
        {selectedDay ? (
          <div className="stack">
            <strong>{selectedDay}</strong>
            {dayEntries.length === 0 ? (
              <div className="empty">當日無項目</div>
            ) : (
              dayEntries.map((e) => (
                <div key={e.id} className="site-link stack">
                  <div className="row between">
                    <strong style={{ color: SALARY_CATEGORY_COLORS[e.category] }}>
                      {e.title} · NT${e.amount.toLocaleString()}
                    </strong>
                    <span className="badge">
                      {SALARY_STATUS_LABELS[e.status]}
                    </span>
                  </div>
                  <p className="muted" style={{ margin: 0 }}>
                    {SALARY_CATEGORY_LABELS[e.category]}
                  </p>
                </div>
              ))
            )}
          </div>
        ) : null}
      </section>
    </div>
  )
}
