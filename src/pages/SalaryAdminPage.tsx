import { useMemo, useState } from 'react'
import {
  PAY_TYPE_LABELS,
  SALARY_CATEGORIES,
  SALARY_CATEGORY_LABELS,
  SALARY_STATUS_LABELS,
  currentTaipeiPeriod,
  summarizeSalaryMonth,
} from '@/domain/salary'
import type { PayType, SalaryEntryCategory } from '@/domain/types'
import { useSalaryPeriod } from '@/hooks/useSalary'
import { useUser, userKeys } from '@/hooks/useUser'
import { useQuery } from '@tanstack/react-query'
import { isFormalMode } from '@/lib/dataMode'
import { localDb } from '@/lib/localDb'
import { supabaseRepos } from '@/lib/supabaseRepos'
import { taipeiDateString } from '@/lib/time'

export function SalaryAdminPage() {
  const { user } = useUser()
  const formal = isFormalMode()
  const now = currentTaipeiPeriod()
  const [year, setYear] = useState(now.year)
  const [month, setMonth] = useState(now.month)
  const [selectedUserId, setSelectedUserId] = useState('')

  const directoryQuery = useQuery({
    queryKey: [...userKeys.directory(), 'salary'],
    enabled: Boolean(user && user.role === 'boss'),
    queryFn: async () => {
      if (!user) return []
      return formal
        ? supabaseRepos.listOrgProfiles(user)
        : localDb.getUsers().filter((u) => u.organizationId === user.organizationId)
    },
  })

  const members = directoryQuery.data ?? []
  const activeUserId = selectedUserId || members[0]?.id || ''
  const activeMember = members.find((m) => m.id === activeUserId)

  const {
    setting,
    entries,
    allEntries,
    attendance,
    upsertSetting,
    createEntry,
    updateEntryStatus,
    correctEntry,
    isSaving,
  } = useSalaryPeriod(year, month, activeUserId || undefined)

  const [payType, setPayType] = useState<PayType>('monthly')
  const [baseAmount, setBaseAmount] = useState('')
  const [effectiveFrom, setEffectiveFrom] = useState(taipeiDateString())
  const [settingNote, setSettingNote] = useState('')

  const [category, setCategory] = useState<SalaryEntryCategory>('other_bonus')
  const [amount, setAmount] = useState('')
  const [title, setTitle] = useState('')
  const [entryDate, setEntryDate] = useState(taipeiDateString())
  const [entryNote, setEntryNote] = useState('')
  const [formError, setFormError] = useState<string | null>(null)

  const teamSummary = useMemo(() => {
    const byUser = new Map<
      string,
      { name: string; confirmed: number; pending: number; paid: number }
    >()
    for (const m of members) {
      byUser.set(m.id, {
        name: m.name,
        confirmed: 0,
        pending: 0,
        paid: 0,
      })
    }
    for (const e of allEntries) {
      const cur = byUser.get(e.userId) ?? {
        name: e.userName,
        confirmed: 0,
        pending: 0,
        paid: 0,
      }
      const s = summarizeSalaryMonth([e])
      cur.confirmed += s.confirmedTotal
      cur.pending += s.pendingTotal
      cur.paid += s.paidTotal
      byUser.set(e.userId, cur)
    }
    return [...byUser.entries()].map(([id, v]) => ({ userId: id, ...v }))
  }, [allEntries, members])

  if (!user) return <div className="empty">請先登入</div>
  if (user.role !== 'boss') {
    return <div className="empty">僅老闆可進入薪資管理</div>
  }

  return (
    <div className="stack fade-up">
      <section className="panel stack">
        <strong>薪資管理</strong>
        <div className="grid-2">
          <div className="field">
            <label htmlFor="sa-year">年</label>
            <input
              id="sa-year"
              type="number"
              value={year}
              onChange={(e) => setYear(Number(e.target.value) || now.year)}
            />
          </div>
          <div className="field">
            <label htmlFor="sa-month">月</label>
            <input
              id="sa-month"
              type="number"
              min={1}
              max={12}
              value={month}
              onChange={(e) => setMonth(Number(e.target.value) || now.month)}
            />
          </div>
        </div>
      </section>

      <section className="panel stack">
        <strong>
          {year} 年 {month} 月 · 全員摘要
        </strong>
        {teamSummary.length === 0 ? (
          <div className="empty">尚無名冊</div>
        ) : (
          teamSummary.map((row) => (
            <button
              key={row.userId}
              type="button"
              className="site-link"
              style={{ textAlign: 'left', width: '100%' }}
              onClick={() => setSelectedUserId(row.userId)}
            >
              <strong>{row.name}</strong>
              <p style={{ margin: '4px 0 0' }}>
                已確認 NT${row.confirmed.toLocaleString()} · 待確認 NT$
                {row.pending.toLocaleString()} · 已支付 NT$
                {row.paid.toLocaleString()}
              </p>
            </button>
          ))
        )}
      </section>

      <section className="panel stack">
        <strong>選擇員工</strong>
        <div className="field">
          <label htmlFor="sa-user">員工</label>
          <select
            id="sa-user"
            value={activeUserId}
            onChange={(e) => setSelectedUserId(e.target.value)}
          >
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>
        {setting ? (
          <p className="muted" style={{ margin: 0 }}>
            目前設定：{PAY_TYPE_LABELS[setting.payType]} NT$
            {setting.baseAmount.toLocaleString()}（自 {setting.effectiveFrom}）
          </p>
        ) : (
          <p className="muted" style={{ margin: 0 }}>
            尚未設定薪資基準
          </p>
        )}
      </section>

      <section className="panel stack">
        <strong>設定薪資基準</strong>
        <form
          className="stack"
          onSubmit={(e) => {
            e.preventDefault()
            if (!activeUserId) return
            setFormError(null)
            void upsertSetting({
              userId: activeUserId,
              payType,
              baseAmount: Number(baseAmount) || 0,
              effectiveFrom,
              note: settingNote,
            }).catch((err) => setFormError((err as Error).message))
          }}
        >
          <div className="grid-2">
            <div className="field">
              <label htmlFor="pay-type">方式</label>
              <select
                id="pay-type"
                value={payType}
                onChange={(e) => setPayType(e.target.value as PayType)}
              >
                <option value="monthly">月薪</option>
                <option value="daily">日薪</option>
                <option value="hourly">時薪</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="pay-base">基準金額（元）</label>
              <input
                id="pay-base"
                type="number"
                min={0}
                step={1}
                value={baseAmount}
                onChange={(e) => setBaseAmount(e.target.value)}
                required
              />
            </div>
          </div>
          <div className="field">
            <label htmlFor="pay-from">生效日</label>
            <input
              id="pay-from"
              type="date"
              value={effectiveFrom}
              onChange={(e) => setEffectiveFrom(e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="pay-note">備註</label>
            <input
              id="pay-note"
              value={settingNote}
              onChange={(e) => setSettingNote(e.target.value)}
            />
          </div>
          <button className="btn btn-steel" type="submit" disabled={isSaving}>
            儲存薪資設定
          </button>
        </form>
      </section>

      <section className="panel stack">
        <strong>新增薪資項目</strong>
        <form
          className="stack"
          onSubmit={(e) => {
            e.preventDefault()
            if (!activeMember) return
            setFormError(null)
            void createEntry({
              userId: activeMember.id,
              userName: activeMember.name,
              entryDate,
              category,
              amount: Number(amount) || 0,
              title: title || SALARY_CATEGORY_LABELS[category],
              note: entryNote,
              status: 'pending',
            })
              .then(() => {
                setAmount('')
                setTitle('')
                setEntryNote('')
              })
              .catch((err) => setFormError((err as Error).message))
          }}
        >
          <div className="grid-2">
            <div className="field">
              <label htmlFor="ent-cat">類別</label>
              <select
                id="ent-cat"
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
              <label htmlFor="ent-amt">金額</label>
              <input
                id="ent-amt"
                type="number"
                step={1}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
            </div>
          </div>
          <div className="grid-2">
            <div className="field">
              <label htmlFor="ent-date">日期</label>
              <input
                id="ent-date"
                type="date"
                value={entryDate}
                onChange={(e) => setEntryDate(e.target.value)}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="ent-title">名稱</label>
              <input
                id="ent-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={SALARY_CATEGORY_LABELS[category]}
              />
            </div>
          </div>
          <div className="field">
            <label htmlFor="ent-note">說明</label>
            <input
              id="ent-note"
              value={entryNote}
              onChange={(e) => setEntryNote(e.target.value)}
            />
          </div>
          <button className="btn btn-steel" type="submit" disabled={isSaving}>
            新增待確認項目
          </button>
        </form>
        {formError ? (
          <p style={{ color: 'var(--danger)', margin: 0 }}>{formError}</p>
        ) : null}
      </section>

      <section className="panel stack">
        <strong>
          {activeMember?.name ?? '員工'} · {year}/{month} 明細
        </strong>
        {entries.length === 0 ? (
          <div className="empty">尚無項目</div>
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
                {e.note ? ` · ${e.note}` : ''}
              </p>
              <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                {e.status === 'pending' || e.status === 'draft' ? (
                  <>
                    <button
                      type="button"
                      className="btn btn-steel"
                      disabled={isSaving}
                      onClick={() =>
                        void updateEntryStatus({
                          id: e.id,
                          status: 'confirmed',
                        })
                      }
                    >
                      確認
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      disabled={isSaving}
                      onClick={() =>
                        void updateEntryStatus({
                          id: e.id,
                          status: 'cancelled',
                          reason: '退回',
                        })
                      }
                    >
                      取消
                    </button>
                  </>
                ) : null}
                {e.status === 'confirmed' ? (
                  <button
                    type="button"
                    className="btn btn-steel"
                    disabled={isSaving}
                    onClick={() =>
                      void updateEntryStatus({ id: e.id, status: 'paid' })
                    }
                  >
                    標記已支付
                  </button>
                ) : null}
                {e.status === 'confirmed' || e.status === 'paid' ? (
                  <button
                    type="button"
                    className="btn btn-ghost"
                    disabled={isSaving}
                    onClick={() => {
                      const next = window.prompt(
                        '更正後金額（整數元）',
                        String(e.amount),
                      )
                      if (next == null) return
                      const reason = window.prompt('更正原因（必填）')
                      if (!reason) return
                      void correctEntry({
                        id: e.id,
                        amount: Number(next),
                        reason,
                      }).catch((err) =>
                        setFormError((err as Error).message),
                      )
                    }}
                  >
                    更正金額
                  </button>
                ) : null}
              </div>
            </div>
          ))
        )}
      </section>

      <section className="panel stack">
        <strong>該月出勤</strong>
        {attendance.length === 0 ? (
          <div className="empty">尚無出勤</div>
        ) : (
          attendance.map((a) => (
            <div key={a.id} className="site-link">
              <p style={{ margin: 0 }}>
                {a.clockInAt.slice(0, 16).replace('T', ' ')}
                {a.clockOutAt
                  ? ` → ${a.clockOutAt.slice(11, 16)}`
                  : ' → 尚未下班'}
              </p>
            </div>
          ))
        )}
      </section>
    </div>
  )
}
