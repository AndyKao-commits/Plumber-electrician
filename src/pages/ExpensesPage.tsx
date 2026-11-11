import { useMemo, useState } from 'react'
import {
  EXPENSE_STATUS_LABELS,
  MISC_EXPENSE_EXAMPLES,
  MISC_SITE_LABEL,
  MISC_SITE_VALUE,
  RECEIPT_STATUS_LABELS,
  computeCaseFinance,
} from '@/domain/fieldFinance'
import { useFieldFinance } from '@/hooks/useFieldFinance'
import { useQuotes } from '@/hooks/useQuotes'
import { useSites } from '@/hooks/useSites'
import { useUser } from '@/hooks/useUser'
import { formatTaipei } from '@/lib/time'

export function ExpensesPage() {
  const { user } = useUser()
  const { sites } = useSites()
  const { quotes } = useQuotes(user?.id)
  const {
    expenses,
    receipts,
    createExpense,
    isCreatingExpense,
    createExpenseError,
    reviewExpense,
    createReceipt,
    isCreatingReceipt,
    createReceiptError,
    confirmReceipt,
  } = useFieldFinance(user?.id)

  const [siteId, setSiteId] = useState('')
  const [item, setItem] = useState('')
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [locationText, setLocationText] = useState('')
  const [receiptFiles, setReceiptFiles] = useState<File[]>([])
  const [receiptAmount, setReceiptAmount] = useState('')
  const [sourceNote, setSourceNote] = useState('')
  const [proofFiles, setProofFiles] = useState<File[]>([])

  const selectedSite =
    siteId === MISC_SITE_VALUE
      ? MISC_SITE_VALUE
      : siteId && sites.some((s) => s.id === siteId)
        ? siteId
        : (sites[0]?.id ?? MISC_SITE_VALUE)
  const isMisc = selectedSite === MISC_SITE_VALUE

  const isBoss = user?.role === 'boss'

  const acceptedContract = useMemo(
    () =>
      (quotes ?? [])
        .filter((q) => q.workflowStatus === 'accepted')
        .reduce((s, q) => s + Number(q.amountAfterTax || 0), 0),
    [quotes],
  )

  const summary = useMemo(
    () =>
      computeCaseFinance({
        acceptedContractAmount: acceptedContract,
        confirmedExpenseTotal: expenses
          .filter((e) => e.status === 'confirmed')
          .reduce((s, e) => s + e.amount, 0),
        pendingExpenseTotal: expenses
          .filter((e) => e.status === 'pending_review')
          .reduce((s, e) => s + e.amount, 0),
        confirmedReceiptTotal: receipts
          .filter((e) => e.status === 'confirmed')
          .reduce((s, e) => s + e.amount, 0),
        pendingReceiptTotal: receipts
          .filter((e) => e.status === 'pending_confirm')
          .reduce((s, e) => s + e.amount, 0),
      }),
    [acceptedContract, expenses, receipts],
  )

  const visibleExpenses = isBoss
    ? expenses
    : expenses.filter((e) => e.reportedBy === user?.id)
  const visibleReceipts = isBoss
    ? receipts
    : receipts.filter((e) => e.reportedBy === user?.id)

  return (
    <div className="stack fade-up">
      <section className="panel stack">
        <strong>支出／收款（V1.0）</strong>
        <p className="muted" style={{ margin: 0 }}>
          員工回報 → 老闆審核／確認。僅「已確認」計入正式統計；不可自審自己的回報。
        </p>
      </section>

      <section className="panel stack">
        <strong>組織統計</strong>
        <div className="grid-2">
          <div className="site-link">
            <p>有效合約</p>
            <h3>NT${summary.acceptedContractAmount.toLocaleString()}</h3>
          </div>
          <div className="site-link">
            <p>案件餘額（合約−已確認支出）</p>
            <h3>NT${summary.caseBalance.toLocaleString()}</h3>
          </div>
          <div className="site-link">
            <p>已確認／待審核支出</p>
            <h3>
              {summary.confirmedExpenseTotal.toLocaleString()} /{' '}
              {summary.pendingExpenseTotal.toLocaleString()}
            </h3>
          </div>
          <div className="site-link">
            <p>已確認／待確認收款</p>
            <h3>
              {summary.confirmedReceiptTotal.toLocaleString()} /{' '}
              {summary.pendingReceiptTotal.toLocaleString()}
            </h3>
          </div>
        </div>
      </section>

      <section className="panel stack">
        <strong>回報支出</strong>
        <form
          className="stack"
          onSubmit={(e) => {
            e.preventDefault()
            if (!selectedSite) return
            void createExpense({
              siteId: isMisc ? null : selectedSite,
              misc: isMisc,
              locationText: isMisc ? locationText : null,
              item,
              amount: Number(amount) || 0,
              note,
              receiptFiles,
            }).then(() => {
              setItem('')
              setAmount('')
              setNote('')
              setLocationText('')
              setReceiptFiles([])
            })
          }}
        >
          <div className="field">
            <label htmlFor="exp-site">工地／案件</label>
            <select
              id="exp-site"
              value={selectedSite}
              onChange={(e) => setSiteId(e.target.value)}
            >
              <option value={MISC_SITE_VALUE}>{MISC_SITE_LABEL}</option>
              {sites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <p className="muted" style={{ margin: '4px 0 0', fontSize: '0.85rem' }}>
              加油、買飯、飲料、臨時支援等請選雜項。
            </p>
          </div>
          {isMisc ? (
            <div className="field">
              <label htmlFor="exp-loc">地點（自行輸入）</label>
              <input
                id="exp-loc"
                value={locationText}
                onChange={(e) => setLocationText(e.target.value)}
                placeholder="例如：中油忠孝站、工地附近超商"
              />
            </div>
          ) : null}
          <div className="grid-2">
            <div className="field">
              <label htmlFor="exp-item">支出項目</label>
              <input
                id="exp-item"
                value={item}
                onChange={(e) => setItem(e.target.value)}
                placeholder={MISC_EXPENSE_EXAMPLES.join('／')}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="exp-amt">金額</label>
              <input
                id="exp-amt"
                type="number"
                min="1"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
            </div>
          </div>
          <div className="field">
            <label htmlFor="exp-note">備註</label>
            <input
              id="exp-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="exp-receipts">收據／憑證照片（可多選）</label>
            <input
              id="exp-receipts"
              type="file"
              accept="image/*"
              multiple
              onChange={(e) =>
                setReceiptFiles(Array.from(e.target.files ?? []))
              }
            />
            {receiptFiles.length > 0 ? (
              <p className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>
                已選 {receiptFiles.length} 張（第一張寫入支出回報）
              </p>
            ) : null}
          </div>
          {createExpenseError ? (
            <p style={{ color: 'var(--danger)', margin: 0 }}>
              {(createExpenseError as Error).message}
            </p>
          ) : null}
          <button
            className="btn btn-steel"
            type="submit"
            disabled={isCreatingExpense || (!isMisc && sites.length === 0)}
          >
            {isCreatingExpense ? '送出中…' : '送出待審核'}
          </button>
        </form>
      </section>

      <section className="panel stack">
        <strong>回報收款</strong>
        <form
          className="stack"
          onSubmit={(e) => {
            e.preventDefault()
            if (!selectedSite) return
            void createReceipt({
              siteId: isMisc ? null : selectedSite,
              misc: isMisc,
              locationText: isMisc ? locationText : null,
              amount: Number(receiptAmount) || 0,
              sourceNote,
              proofFiles,
            }).then(() => {
              setReceiptAmount('')
              setSourceNote('')
              setProofFiles([])
            })
          }}
        >
          <p className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>
            工地／雜項與上方「回報支出」共用；雜項收款同樣可填地點。
          </p>
          {isMisc ? (
            <div className="field">
              <label htmlFor="rc-loc">地點（自行輸入）</label>
              <input
                id="rc-loc"
                value={locationText}
                onChange={(e) => setLocationText(e.target.value)}
                placeholder="例如：客戶住處、臨時會合點"
              />
            </div>
          ) : null}
          <div className="grid-2">
            <div className="field">
              <label htmlFor="rc-amt">收到金額</label>
              <input
                id="rc-amt"
                type="number"
                min="1"
                value={receiptAmount}
                onChange={(e) => setReceiptAmount(e.target.value)}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="rc-src">來源／備註</label>
              <input
                id="rc-src"
                value={sourceNote}
                onChange={(e) => setSourceNote(e.target.value)}
              />
            </div>
          </div>
          <div className="field">
            <label htmlFor="rc-proof">收款憑證照片（可多選，取第一張）</label>
            <input
              id="rc-proof"
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => setProofFiles(Array.from(e.target.files ?? []))}
            />
          </div>
          {createReceiptError ? (
            <p style={{ color: 'var(--danger)', margin: 0 }}>
              {(createReceiptError as Error).message}
            </p>
          ) : null}
          <button
            className="btn btn-steel"
            type="submit"
            disabled={isCreatingReceipt || (!isMisc && sites.length === 0)}
          >
            {isCreatingReceipt ? '送出中…' : '送出待確認'}
          </button>
        </form>
      </section>

      <section className="panel stack">
        <strong>支出清單</strong>
        {visibleExpenses.length === 0 ? (
          <div className="empty">尚無支出回報</div>
        ) : (
          visibleExpenses.map((e) => (
            <div key={e.id} className="site-link stack">
              <div className="row between">
                <strong>
                  {e.item} · NT${e.amount.toLocaleString()}
                </strong>
                <span className="badge">{EXPENSE_STATUS_LABELS[e.status]}</span>
              </div>
              <p style={{ margin: 0 }}>
                {e.siteName}
                {e.locationText ? `（${e.locationText}）` : ''} ·{' '}
                {e.reportedByName} · {formatTaipei(e.reportedAt, 'MM/dd HH:mm')}
                {e.receiptPhotoPath ? ' · 已附收據' : ''}
              </p>
              {isBoss && e.status === 'pending_review' ? (
                <div className="row">
                  <button
                    className="btn btn-steel"
                    type="button"
                    onClick={() =>
                      void reviewExpense({ id: e.id, decision: 'confirm' })
                    }
                  >
                    確認
                  </button>
                  <button
                    className="btn btn-ghost"
                    type="button"
                    onClick={() =>
                      void reviewExpense({
                        id: e.id,
                        decision: 'return',
                        note: '請補資料',
                      })
                    }
                  >
                    退回
                  </button>
                </div>
              ) : null}
            </div>
          ))
        )}
      </section>

      <section className="panel stack">
        <strong>收款清單</strong>
        {visibleReceipts.length === 0 ? (
          <div className="empty">尚無收款回報</div>
        ) : (
          visibleReceipts.map((r) => (
            <div key={r.id} className="site-link stack">
              <div className="row between">
                <strong>NT${r.amount.toLocaleString()}</strong>
                <span className="badge">{RECEIPT_STATUS_LABELS[r.status]}</span>
              </div>
              <p style={{ margin: 0 }}>
                {r.siteName}
                {r.locationText ? `（${r.locationText}）` : ''} ·{' '}
                {r.reportedByName} · {formatTaipei(r.reportedAt, 'MM/dd HH:mm')}
                {r.sourceNote ? ` · ${r.sourceNote}` : ''}
              </p>
              {isBoss && r.status === 'pending_confirm' ? (
                <div className="row">
                  <button
                    className="btn btn-steel"
                    type="button"
                    onClick={() =>
                      void confirmReceipt({ id: r.id, decision: 'confirm' })
                    }
                  >
                    確認收款
                  </button>
                  <button
                    className="btn btn-ghost"
                    type="button"
                    onClick={() =>
                      void confirmReceipt({
                        id: r.id,
                        decision: 'return',
                        note: '請補證明',
                      })
                    }
                  >
                    退回
                  </button>
                </div>
              ) : null}
            </div>
          ))
        )}
      </section>
    </div>
  )
}
