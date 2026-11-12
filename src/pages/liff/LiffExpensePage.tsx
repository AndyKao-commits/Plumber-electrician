import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { LiffFrame } from '@/components/LiffFrame'
import {
  MISC_EXPENSE_EXAMPLES,
  MISC_SITE_LABEL,
  MISC_SITE_VALUE,
  pickAutoQuoteId,
} from '@/domain/fieldFinance'
import { selectOpenSites } from '@/domain/siteStatus'
import { useFieldFinance } from '@/hooks/useFieldFinance'
import { useQuotes } from '@/hooks/useQuotes'
import { useSites } from '@/hooks/useSites'
import { useUser } from '@/hooks/useUser'
import { taipeiDateString } from '@/lib/time'

type Kind = 'expense' | 'receipt'

export function LiffExpensePage() {
  const { user } = useUser()
  const { sites } = useSites()
  const openSites = useMemo(() => selectOpenSites(sites), [sites])
  const { quotes } = useQuotes(user?.id)
  const {
    createExpense,
    isCreatingExpense,
    createExpenseError,
    createReceipt,
    isCreatingReceipt,
    createReceiptError,
  } = useFieldFinance(user?.id)

  const [kind, setKind] = useState<Kind>('expense')
  const [siteId, setSiteId] = useState(MISC_SITE_VALUE)
  const [item, setItem] = useState('')
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [locationText, setLocationText] = useState('')
  const [receivedOn, setReceivedOn] = useState(taipeiDateString())
  const [quotationId, setQuotationId] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [doneMsg, setDoneMsg] = useState<string | null>(null)

  const isMisc = siteId === MISC_SITE_VALUE
  const busy = isCreatingExpense || isCreatingReceipt
  const err =
    kind === 'expense' ? createExpenseError : createReceiptError

  const siteQuotes = useMemo(() => {
    if (isMisc || !siteId) return []
    return (quotes ?? []).filter(
      (q) =>
        q.projectId === siteId &&
        q.workflowStatus === 'accepted' &&
        !q.deletedAt,
    )
  }, [quotes, siteId, isMisc])

  useEffect(() => {
    if (isMisc || kind !== 'receipt') {
      setQuotationId('')
      return
    }
    const auto = pickAutoQuoteId(quotes ?? [], siteId)
    setQuotationId(auto || '')
  }, [siteId, isMisc, kind, quotes])

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setDoneMsg(null)
    const n = Number(amount)
    if (!Number.isFinite(n) || n <= 0) return

    if (kind === 'expense') {
      await createExpense({
        siteId: isMisc ? null : siteId,
        misc: isMisc,
        locationText: isMisc ? locationText : null,
        item: item.trim(),
        amount: n,
        note: note.trim() || null,
        receiptFiles: file ? [file] : [],
      })
      setDoneMsg(`已送出支出 NT$${n.toLocaleString()}`)
    } else {
      await createReceipt({
        siteId: isMisc ? null : siteId,
        misc: isMisc,
        locationText: isMisc ? locationText : null,
        amount: n,
        sourceNote: note.trim() || item.trim() || null,
        receivedOn,
        quotationId: isMisc ? null : quotationId || null,
        proofFiles: file ? [file] : [],
      })
      setDoneMsg(`已送出收款 NT$${n.toLocaleString()}（待老闆確認）`)
    }
    setItem('')
    setAmount('')
    setNote('')
    setLocationText('')
    setReceivedOn(taipeiDateString())
    setFile(null)
  }

  return (
    <LiffFrame title="記帳" liffEntry="expense">
      {doneMsg ? (
        <section className="panel stack">
          <span className="badge ok">完成</span>
          <strong style={{ margin: 0 }}>{doneMsg}</strong>
          <p className="muted" style={{ margin: 0 }}>
            可關閉回聊天室，或再記一筆。
          </p>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => setDoneMsg(null)}
          >
            再記一筆
          </button>
        </section>
      ) : (
        <form className="panel stack" onSubmit={(e) => void onSubmit(e)}>
          <div className="row" style={{ gap: 8 }}>
            <button
              type="button"
              className={`btn ${kind === 'expense' ? 'btn-primary' : 'btn-ghost'}`}
              style={{ flex: 1 }}
              onClick={() => setKind('expense')}
            >
              支出
            </button>
            <button
              type="button"
              className={`btn ${kind === 'receipt' ? 'btn-primary' : 'btn-ghost'}`}
              style={{ flex: 1 }}
              onClick={() => setKind('receipt')}
            >
              收款
            </button>
          </div>

          <div className="field">
            <label htmlFor="liff-exp-site">工地</label>
            <select
              id="liff-exp-site"
              value={siteId}
              onChange={(e) => setSiteId(e.target.value)}
            >
              <option value={MISC_SITE_VALUE}>{MISC_SITE_LABEL}</option>
              {openSites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          {isMisc ? (
            <div className="field">
              <label htmlFor="liff-exp-loc">地點（選填）</label>
              <input
                id="liff-exp-loc"
                value={locationText}
                onChange={(e) => setLocationText(e.target.value)}
                placeholder="例如：超商、加油站"
              />
            </div>
          ) : null}

          {kind === 'receipt' ? (
            <div className="field">
              <label htmlFor="liff-exp-on">收款日期</label>
              <input
                id="liff-exp-on"
                type="date"
                value={receivedOn}
                onChange={(e) => setReceivedOn(e.target.value)}
                required
              />
            </div>
          ) : null}

          <div className="field">
            <label htmlFor="liff-exp-amt">金額</label>
            <input
              id="liff-exp-amt"
              type="number"
              inputMode="numeric"
              min={1}
              step={1}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="例如 120"
              required
            />
          </div>

          {kind === 'receipt' && !isMisc ? (
            <div className="field">
              <label htmlFor="liff-exp-quote">關聯報價（選填）</label>
              <select
                id="liff-exp-quote"
                value={quotationId}
                onChange={(e) => setQuotationId(e.target.value)}
              >
                <option value="">不關聯（可後補）</option>
                {siteQuotes.map((q) => (
                  <option key={q.id} value={q.id}>
                    {q.quoteNumber} · {q.title}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          <div className="field">
            <label htmlFor="liff-exp-item">
              {kind === 'expense' ? '項目' : '說明（選填）'}
            </label>
            <input
              id="liff-exp-item"
              value={item}
              onChange={(e) => setItem(e.target.value)}
              placeholder={
                kind === 'expense'
                  ? MISC_EXPENSE_EXAMPLES.join('／')
                  : '例如：先收三萬'
              }
              required={kind === 'expense'}
            />
          </div>

          <div className="field">
            <label htmlFor="liff-exp-note">備註（選填）</label>
            <input
              id="liff-exp-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>

          <div className="field">
            <label htmlFor="liff-exp-file">發票／證明（選填）</label>
            <input
              id="liff-exp-file"
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </div>

          {err ? (
            <p style={{ color: 'var(--danger)', margin: 0 }}>
              {(err as Error).message}
            </p>
          ) : null}

          <button type="submit" className="clock-btn in" disabled={busy}>
            {busy ? '送出中…' : kind === 'expense' ? '送出支出' : '送出收款'}
          </button>
        </form>
      )}
    </LiffFrame>
  )
}
