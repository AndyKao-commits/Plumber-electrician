import { useEffect, useMemo, useState } from 'react'
import { buildMonthGrid } from '@/domain/attendanceCalendar'
import { isBossLike } from '@/domain/roleGroups'
import {
  PAY_TYPE_LABELS,
  SALARY_CATEGORIES,
  SALARY_CATEGORY_COLORS,
  SALARY_CATEGORY_LABELS,
  SALARY_STATUS_LABELS,
  canConfirmSalaryEntry,
  currentTaipeiPeriod,
  defaultSettlementPeriod,
  summarizeSalaryMonth,
} from '@/domain/salary'
import type { PayType, SalaryEntry, SalaryEntryCategory } from '@/domain/types'
import { useSalaryPeriod } from '@/hooks/useSalary'
import { useUser, userKeys } from '@/hooks/useUser'
import { useQuery } from '@tanstack/react-query'
import { isFormalMode } from '@/lib/dataMode'
import { localDb } from '@/lib/localDb'
import {
  downloadSalarySlipExcel,
  downloadSalarySlipPdf,
} from '@/lib/salarySlipExport'
import { supabaseRepos } from '@/lib/supabaseRepos'
import { taipeiDateString } from '@/lib/time'

export function SalaryAdminPage() {
  const { user } = useUser()
  const formal = isFormalMode()
  const now = currentTaipeiPeriod()
  const [year, setYear] = useState(now.year)
  const [month, setMonth] = useState(now.month)
  const [selectedUserId, setSelectedUserId] = useState('')
  const [selectedDay, setSelectedDay] = useState<string | null>(null)

  const directoryQuery = useQuery({
    queryKey: [...userKeys.directory(), 'salary'],
    enabled: Boolean(user && isBossLike(user)),
    queryFn: async () => {
      if (!user) return []
      return formal
        ? supabaseRepos.listOrgProfiles(user)
        : localDb
            .getUsers()
            .filter((u) => u.organizationId === user.organizationId)
    },
  })

  const members = directoryQuery.data ?? []
  const activeUserId = selectedUserId || members[0]?.id || ''
  const activeMember = members.find((m) => m.id === activeUserId)

  const {
    setting,
    entries,
    payments,
    allEntries,
    allPayments,
    upsertSetting,
    createEntry,
    updateEntryStatus,
    correctEntry,
    createPayment,
    syncDailyWages,
    isSaving,
    isLoading,
  } = useSalaryPeriod(year, month, activeUserId || undefined)

  const [payType, setPayType] = useState<PayType>('daily')
  const [baseAmount, setBaseAmount] = useState('')
  const [effectiveFrom, setEffectiveFrom] = useState(taipeiDateString())

  const [category, setCategory] = useState<SalaryEntryCategory>('other_bonus')
  const [amount, setAmount] = useState('')
  const [title, setTitle] = useState('')
  const [entryDate, setEntryDate] = useState(taipeiDateString())
  const [formError, setFormError] = useState<string | null>(null)

  const defaultSettle = defaultSettlementPeriod()
  const [payAmount, setPayAmount] = useState('')
  const [paidOn, setPaidOn] = useState(taipeiDateString())
  const [paySettleYear, setPaySettleYear] = useState(defaultSettle.year)
  const [paySettleMonth, setPaySettleMonth] = useState(defaultSettle.month)
  const [syncMsg, setSyncMsg] = useState<string | null>(null)

  useEffect(() => {
    if (!setting) return
    setPayType(setting.payType)
    setBaseAmount(String(setting.baseAmount))
    setEffectiveFrom(setting.effectiveFrom)
  }, [setting?.id, setting?.payType, setting?.baseAmount, setting?.effectiveFrom])

  useEffect(() => {
    if (!activeMember || !activeUserId) return
    if (setting?.payType !== 'daily') return
    void syncDailyWages({
      userId: activeUserId,
      userName: activeMember.name,
      year,
      month,
    })
      .then((r) => {
        if (r.created > 0) setSyncMsg(`已依打卡產生 ${r.created} 筆待確認日薪`)
      })
      .catch(() => undefined)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeUserId, year, month, setting?.payType, setting?.baseAmount])

  const summary = useMemo(
    () => summarizeSalaryMonth(entries, payments),
    [entries, payments],
  )

  const teamRows = useMemo(() => {
    return members.map((m) => {
      const e = allEntries.filter((x) => x.userId === m.id)
      const p = allPayments.filter((x) => x.employeeId === m.id)
      const s = summarizeSalaryMonth(e, p)
      return { userId: m.id, name: m.name, ...s }
    })
  }, [members, allEntries, allPayments])

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
  if (!isBossLike(user)) {
    return <div className="empty">僅老闆可進入薪資管理</div>
  }

  return (
    <div className="stack fade-up">
      <section className="panel stack">
        <strong>薪資管理</strong>
        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
          >
            {[now.year, now.year - 1].map((y) => (
              <option key={y} value={y}>
                {y} 年
              </option>
            ))}
          </select>
          <select
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
          >
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <option key={m} value={m}>
                {m} 月
              </option>
            ))}
          </select>
        </div>
      </section>

      <section className="panel stack">
        <strong>
          {year}/{month} 尚未支付
        </strong>
        {teamRows.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>
            尚無成員
          </p>
        ) : (
          teamRows.map((r) => (
            <button
              key={r.userId}
              type="button"
              className="site-link"
              style={{ textAlign: 'left', width: '100%' }}
              onClick={() => setSelectedUserId(r.userId)}
            >
              <div className="row between">
                <strong style={{ margin: 0 }}>{r.name}</strong>
                <span className="badge">
                  尚未支付 NT${r.unpaidTotal.toLocaleString()}
                </span>
              </div>
              <p className="muted" style={{ margin: '6px 0 0' }}>
                應領 {r.confirmedTotal.toLocaleString()} · 實領{' '}
                {r.paidTotal.toLocaleString()} · 出工 {r.workDays} 天
              </p>
            </button>
          ))
        )}
      </section>

      {activeMember ? (
        <>
          <section className="panel stack">
            <strong>{activeMember.name} · 薪資設定</strong>
            <div className="field">
              <label>方式</label>
              <select
                value={payType}
                onChange={(e) => setPayType(e.target.value as PayType)}
              >
                {(Object.keys(PAY_TYPE_LABELS) as PayType[]).map((t) => (
                  <option key={t} value={t}>
                    {PAY_TYPE_LABELS[t]}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>基準金額（日薪＝一天）</label>
              <input
                inputMode="numeric"
                value={baseAmount}
                onChange={(e) => setBaseAmount(e.target.value)}
              />
            </div>
            <div className="field">
              <label>生效日</label>
              <input
                type="date"
                value={effectiveFrom}
                onChange={(e) => setEffectiveFrom(e.target.value)}
              />
            </div>
            <p className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>
              日薪：打卡當日工時加總，&gt;4 小時整天、其餘半天，自動進待確認。月薪不自動產薪。
            </p>
            <button
              type="button"
              className="btn btn-steel"
              disabled={isSaving}
              onClick={() =>
                void upsertSetting({
                  userId: activeMember.id,
                  payType,
                  baseAmount: Number(baseAmount),
                  effectiveFrom,
                }).catch((e) => setFormError((e as Error).message))
              }
            >
              儲存設定
            </button>
            {syncMsg ? (
              <p className="muted" style={{ margin: 0 }}>
                {syncMsg}
              </p>
            ) : null}
          </section>

          <section className="panel stack">
            <div className="row between">
              <strong>
                {activeMember.name} · {year}/{month}
              </strong>
              <div className="row" style={{ gap: 6 }}>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() =>
                    downloadSalarySlipExcel(
                      {
                        employeeName: activeMember.name,
                        year,
                        month,
                        setting,
                        entries,
                        payments,
                      },
                      `薪資單_${activeMember.name}_${year}-${month}`,
                    )
                  }
                >
                  匯出 Excel
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() =>
                    void downloadSalarySlipPdf(
                      {
                        employeeName: activeMember.name,
                        year,
                        month,
                        setting,
                        entries,
                        payments,
                      },
                      `薪資單_${activeMember.name}_${year}-${month}`,
                    )
                  }
                >
                  匯出 PDF
                </button>
              </div>
            </div>
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
                <p>尚未支付</p>
                <h3>NT${summary.unpaidTotal.toLocaleString()}</h3>
              </div>
            </div>
            {summary.pendingTotal ? (
              <p className="muted" style={{ margin: 0 }}>
                另有待確認 NT${summary.pendingTotal.toLocaleString()}
              </p>
            ) : null}
          </section>

          <section className="panel stack">
            <strong>明細日曆</strong>
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
                const sum = list.reduce((s, e) => s + e.amount, 0)
                return (
                  <button
                    key={cell.day}
                    type="button"
                    className={`attendance-cal-day${selectedDay === cell.day ? ' selected' : ''}${list.length ? ' has-work' : ''}`}
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
                    {list.length ? (
                      <span style={{ fontSize: 9, lineHeight: 1 }}>
                        {sum >= 1000 ? `${Math.round(sum / 1000)}k` : sum}
                      </span>
                    ) : null}
                  </button>
                )
              })}
            </div>
            <p className="muted" style={{ margin: 0, fontSize: '0.8rem' }}>
              填色＝已確認；框線＝待確認。顏色依項目類別。
            </p>
            {selectedDay ? (
              <div className="stack" style={{ gap: 8 }}>
                <strong>{selectedDay}</strong>
                {dayEntries.length === 0 ? (
                  <div className="empty">當日無薪資項目</div>
                ) : (
                  dayEntries.map((e) => (
                    <SalaryEntryCard
                      key={e.id}
                      entry={e}
                      busy={isSaving}
                      onConfirm={() =>
                        void updateEntryStatus({
                          id: e.id,
                          status: 'confirmed',
                        }).catch((err) =>
                          setFormError((err as Error).message),
                        )
                      }
                      onCancel={() =>
                        void updateEntryStatus({
                          id: e.id,
                          status: 'cancelled',
                          reason: '取消',
                        }).catch((err) =>
                          setFormError((err as Error).message),
                        )
                      }
                      onCorrect={(nextAmount, reason) =>
                        void correctEntry({
                          id: e.id,
                          amount: nextAmount,
                          reason,
                        }).catch((err) =>
                          setFormError((err as Error).message),
                        )
                      }
                    />
                  ))
                )}
              </div>
            ) : null}
          </section>

          <section className="panel stack">
            <strong>
              支付 {paySettleYear}/{paySettleMonth} 月薪資
            </strong>
            <p className="muted" style={{ margin: 0, fontSize: '0.88rem' }}>
              結算月是薪水所屬月份；支付日是實際給錢的日子（例如支付 10 月薪 ·
              11/5）。
            </p>
            <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
              <select
                value={paySettleYear}
                onChange={(e) => setPaySettleYear(Number(e.target.value))}
              >
                {[now.year, now.year - 1].map((y) => (
                  <option key={y} value={y}>
                    {y} 年
                  </option>
                ))}
              </select>
              <select
                value={paySettleMonth}
                onChange={(e) => setPaySettleMonth(Number(e.target.value))}
              >
                {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                  <option key={m} value={m}>
                    {m} 月
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>實付金額</label>
              <input
                inputMode="numeric"
                value={payAmount}
                onChange={(e) => setPayAmount(e.target.value)}
                placeholder="例如 15000"
              />
            </div>
            <div className="field">
              <label>支付日</label>
              <input
                type="date"
                value={paidOn}
                onChange={(e) => setPaidOn(e.target.value)}
              />
            </div>
            <button
              type="button"
              className="btn btn-primary btn-block"
              disabled={isSaving || !payAmount}
              onClick={() => {
                setFormError(null)
                void createPayment({
                  employeeId: activeMember.id,
                  employeeName: activeMember.name,
                  settlementYear: paySettleYear,
                  settlementMonth: paySettleMonth,
                  amount: Number(payAmount),
                  paidOn,
                })
                  .then(() => setPayAmount(''))
                  .catch((e) => setFormError((e as Error).message))
              }}
            >
              確認支付 {paySettleMonth} 月薪資
            </button>
            {payments.length > 0 ? (
              <div className="stack" style={{ gap: 6 }}>
                <strong style={{ fontSize: '0.95rem' }}>本月結算之付款</strong>
                {payments.map((p) => (
                  <div key={p.id} className="site-link">
                    <div className="row between">
                      <span>
                        {p.paidOn} · NT${p.amount.toLocaleString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </section>

          <section className="panel stack">
            <strong>新增其他項目（待確認）</strong>
            <div className="field">
              <label>日期</label>
              <input
                type="date"
                value={entryDate}
                onChange={(e) => setEntryDate(e.target.value)}
              />
            </div>
            <div className="field">
              <label>類別</label>
              <select
                value={category}
                onChange={(e) =>
                  setCategory(e.target.value as SalaryEntryCategory)
                }
              >
                {SALARY_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {SALARY_CATEGORY_LABELS[c]}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>名稱</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="例如：案件分紅"
              />
            </div>
            <div className="field">
              <label>金額</label>
              <input
                inputMode="numeric"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
            <button
              type="button"
              className="btn btn-steel btn-block"
              disabled={isSaving || isLoading}
              onClick={() => {
                setFormError(null)
                void createEntry({
                  userId: activeMember.id,
                  userName: activeMember.name,
                  entryDate,
                  category,
                  amount: Number(amount),
                  title: title || SALARY_CATEGORY_LABELS[category],
                  status: 'pending',
                })
                  .then(() => {
                    setAmount('')
                    setTitle('')
                  })
                  .catch((e) => setFormError((e as Error).message))
              }}
            >
              新增待確認項目
            </button>
          </section>
        </>
      ) : null}

      {formError ? (
        <p style={{ color: 'var(--danger)', margin: 0 }}>{formError}</p>
      ) : null}
    </div>
  )
}

function SalaryEntryCard(props: {
  entry: SalaryEntry
  busy: boolean
  onConfirm: () => void
  onCancel: () => void
  onCorrect: (amount: number, reason: string) => void
}) {
  const { entry: e, busy } = props
  const [correcting, setCorrecting] = useState(false)
  const [amt, setAmt] = useState(String(e.amount))
  const [reason, setReason] = useState('')
  const color = SALARY_CATEGORY_COLORS[e.category]
  const pending = e.status === 'pending'

  return (
    <div
      className="site-link stack"
      style={{
        borderColor: pending ? color : undefined,
        borderWidth: pending ? 2 : undefined,
        borderStyle: pending ? 'solid' : undefined,
      }}
    >
      <div className="row between">
        <strong style={{ margin: 0, color }}>
          {e.title} · NT${e.amount.toLocaleString()}
        </strong>
        <span className="badge">{SALARY_STATUS_LABELS[e.status]}</span>
      </div>
      <p className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>
        {SALARY_CATEGORY_LABELS[e.category]}
        {e.dayFraction === 0.5
          ? ' · 半天'
          : e.dayFraction === 1
            ? ' · 整天'
            : ''}
        {e.note ? ` · ${e.note}` : ''}
      </p>
      <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
        {canConfirmSalaryEntry(e.status) ? (
          <button
            type="button"
            className="btn btn-steel"
            disabled={busy}
            onClick={props.onConfirm}
          >
            確認
          </button>
        ) : null}
        {e.status !== 'cancelled' ? (
          <button
            type="button"
            className="btn btn-ghost"
            disabled={busy}
            onClick={props.onCancel}
          >
            取消
          </button>
        ) : null}
        {e.status === 'confirmed' || e.status === 'paid' ? (
          <button
            type="button"
            className="btn btn-ghost"
            disabled={busy}
            onClick={() => setCorrecting((v) => !v)}
          >
            更正金額
          </button>
        ) : null}
      </div>
      {correcting ? (
        <div className="stack">
          <input
            inputMode="numeric"
            value={amt}
            onChange={(ev) => setAmt(ev.target.value)}
          />
          <input
            value={reason}
            onChange={(ev) => setReason(ev.target.value)}
            placeholder="更正原因"
          />
          <button
            type="button"
            className="btn btn-primary"
            disabled={busy}
            onClick={() => {
              props.onCorrect(Number(amt), reason)
              setCorrecting(false)
            }}
          >
            儲存更正
          </button>
        </div>
      ) : null}
    </div>
  )
}
