import { useEffect, useMemo, useState } from 'react'
import {
  ADVANCE_STATUS_LABELS,
  sumAdvanceAmounts,
} from '@/domain/employeeAdvances'
import {
  MISC_EXPENSE_EXAMPLES,
  MISC_SITE_LABEL,
  MISC_SITE_VALUE,
  RECEIPT_STATUS_LABELS,
  buildCashLedger,
  computeCaseFinance,
  computeSiteReceiptProgress,
  filterCashLedger,
  pickAutoQuoteId,
  receiptConfirmOverContractWarning,
  sumAcceptedContractForSite,
  summarizeLedger,
  type LedgerEntryKind,
} from '@/domain/fieldFinance'
import { useFieldFinance } from '@/hooks/useFieldFinance'
import { useQuotes } from '@/hooks/useQuotes'
import { useSites } from '@/hooks/useSites'
import { useUser } from '@/hooks/useUser'
import { selectOpenSites } from '@/domain/siteStatus'
import {
  downloadCashLedgerExcel,
  downloadCashLedgerPdf,
} from '@/lib/cashLedgerExport'
import { formatTaipei, taipeiDateString } from '@/lib/time'

function currentMonth(): string {
  return taipeiDateString().slice(0, 7)
}

export function ExpensesPage() {
  const { user } = useUser()
  const { sites } = useSites()
  const openSites = useMemo(() => selectOpenSites(sites), [sites])
  const { quotes } = useQuotes(user?.id)
  const {
    expenses,
    receipts,
    advances,
    createExpense,
    isCreatingExpense,
    createExpenseError,
    reviewExpense,
    cancelExpense,
    createReceipt,
    isCreatingReceipt,
    createReceiptError,
    confirmReceipt,
    confirmReceiptError,
    linkReceiptQuote,
    cancelReceipt,
    createAdvance,
    isCreatingAdvance,
    createAdvanceError,
    settleAdvances,
    isSettlingAdvances,
    settleAdvancesError,
    cancelAdvance,
  } = useFieldFinance(user?.id)

  const [siteId, setSiteId] = useState('')
  const [item, setItem] = useState('')
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [locationText, setLocationText] = useState('')
  const [receiptFiles, setReceiptFiles] = useState<File[]>([])
  const [receiptAmount, setReceiptAmount] = useState('')
  const [sourceNote, setSourceNote] = useState('')
  const [receivedOn, setReceivedOn] = useState(taipeiDateString())
  const [quotationId, setQuotationId] = useState('')
  const [proofFiles, setProofFiles] = useState<File[]>([])
  const [advItem, setAdvItem] = useState('')
  const [advAmount, setAdvAmount] = useState('')
  const [advNote, setAdvNote] = useState('')
  const [advFiles, setAdvFiles] = useState<File[]>([])
  const [selectedAdvanceIds, setSelectedAdvanceIds] = useState<string[]>([])
  const [settleNote, setSettleNote] = useState('')
  const [exporting, setExporting] = useState(false)

  const [filterMonth, setFilterMonth] = useState(currentMonth)
  const [filterKind, setFilterKind] = useState<LedgerEntryKind | 'all'>('all')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [filterSiteId, setFilterSiteId] = useState<string>('all')
  const [progressSiteId, setProgressSiteId] = useState('')

  const selectedSite =
    siteId === MISC_SITE_VALUE
      ? MISC_SITE_VALUE
      : siteId && sites.some((s) => s.id === siteId)
        ? siteId
        : (sites[0]?.id ?? MISC_SITE_VALUE)
  const isMisc = selectedSite === MISC_SITE_VALUE

  const isBoss = user?.role === 'boss'

  const siteQuotes = useMemo(() => {
    if (isMisc || !selectedSite) return []
    return (quotes ?? []).filter(
      (q) =>
        q.projectId === selectedSite &&
        q.workflowStatus === 'accepted' &&
        !q.deletedAt,
    )
  }, [quotes, selectedSite, isMisc])

  useEffect(() => {
    if (isMisc) {
      setQuotationId('')
      return
    }
    const auto = pickAutoQuoteId(quotes ?? [], selectedSite)
    if (auto) setQuotationId(auto)
    else if (!siteQuotes.some((q) => q.id === quotationId)) setQuotationId('')
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to site/quote list
  }, [selectedSite, isMisc, siteQuotes.map((q) => q.id).join('|')])

  const acceptedContract = useMemo(
    () =>
      (quotes ?? [])
        .filter((q) => q.workflowStatus === 'accepted' && !q.deletedAt)
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
  const openAdvances = advances.filter((a) => a.status === 'open')
  const selectedTotal = sumAdvanceAmounts(advances, selectedAdvanceIds)

  const ledgerAll = useMemo(
    () =>
      buildCashLedger({
        expenses: visibleExpenses,
        receipts: visibleReceipts,
        expenseDate: (iso) => taipeiDateString(iso),
      }),
    [visibleExpenses, visibleReceipts],
  )

  const ledgerFiltered = useMemo(
    () =>
      filterCashLedger(ledgerAll, {
        month: filterMonth || null,
        kind: filterKind,
        status: filterStatus,
        siteId: filterSiteId,
      }),
    [ledgerAll, filterMonth, filterKind, filterStatus, filterSiteId],
  )

  const ledgerSummary = useMemo(
    () => summarizeLedger(ledgerFiltered),
    [ledgerFiltered],
  )

  const progressSite =
    progressSiteId && sites.some((s) => s.id === progressSiteId)
      ? progressSiteId
      : (openSites[0]?.id ?? sites[0]?.id ?? '')

  const siteProgress = useMemo(() => {
    if (!progressSite) return null
    return computeSiteReceiptProgress({
      siteId: progressSite,
      receipts,
      contractAmount: sumAcceptedContractForSite(quotes ?? [], progressSite),
    })
  }, [progressSite, receipts, quotes])

  const siteReceiptRows = useMemo(() => {
    if (!progressSite) return []
    return receipts
      .filter((r) => r.siteId === progressSite && r.status !== 'cancelled')
      .sort((a, b) => {
        const sa = a.siteSequenceNo ?? 9999
        const sb = b.siteSequenceNo ?? 9999
        if (sa !== sb) return sa - sb
        return a.receivedOn.localeCompare(b.receivedOn)
      })
  }, [receipts, progressSite])

  function toggleAdvance(id: string) {
    setSelectedAdvanceIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    )
  }

  async function onConfirmReceipt(id: string) {
    const row = receipts.find((r) => r.id === id)
    if (!row) return
    if (row.reportedBy === user?.id) {
      window.alert('不可確認自己回報的收款，請用另一位老闆帳號，或請員工回報後再確認。')
      return
    }
    if (row.siteId) {
      const contract = sumAcceptedContractForSite(quotes ?? [], row.siteId)
      const already = receipts
        .filter((r) => r.siteId === row.siteId && r.status === 'confirmed')
        .reduce((s, r) => s + r.amount, 0)
      const warn = receiptConfirmOverContractWarning({
        contractAmount: contract,
        alreadyConfirmedTotal: already,
        confirmingAmount: row.amount,
      })
      if (warn && !window.confirm(`${warn}\n\n仍要確認嗎？`)) return
    }
    try {
      await confirmReceipt({ id, decision: 'confirm' })
    } catch (e) {
      window.alert((e as Error).message || '確認失敗')
    }
  }

  async function exportExcel() {
    downloadCashLedgerExcel(ledgerFiltered, `收支簿_${filterMonth || '全部'}`, {
      title: '收支簿',
      periodLabel: filterMonth ? `${filterMonth}（篩選結果）` : '全部期間',
    })
  }

  async function exportPdf() {
    setExporting(true)
    try {
      await downloadCashLedgerPdf(
        ledgerFiltered,
        `收支簿_${filterMonth || '全部'}`,
        {
          title: '收支簿',
          periodLabel: filterMonth ? `${filterMonth}（篩選結果）` : '全部期間',
          generatedAtLabel: formatTaipei(new Date(), 'yyyy/MM/dd HH:mm'),
        },
      )
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="stack fade-up">
      <section className="panel stack">
        <strong>收支簿</strong>
        <p className="muted" style={{ margin: 0 }}>
          預設本月；明細含全部狀態。收款以工地累計第幾次，報價可後補。
        </p>
      </section>

      <section className="panel stack">
        <strong>期間摘要</strong>
        <div className="grid-2">
          <div className="site-link">
            <p>支出合計（篩選）</p>
            <h3>NT${ledgerSummary.expenseTotal.toLocaleString()}</h3>
          </div>
          <div className="site-link">
            <p>收款合計（篩選）</p>
            <h3>NT${ledgerSummary.receiptTotal.toLocaleString()}</h3>
          </div>
          <div className="site-link">
            <p>淨額（收−支）</p>
            <h3>NT${ledgerSummary.net.toLocaleString()}</h3>
          </div>
          <div className="site-link">
            <p>筆數</p>
            <h3>{ledgerSummary.count}</h3>
          </div>
        </div>
        <div className="grid-2">
          <div className="site-link">
            <p>組織已確認／待審支出</p>
            <h3>
              {summary.confirmedExpenseTotal.toLocaleString()} /{' '}
              {summary.pendingExpenseTotal.toLocaleString()}
            </h3>
          </div>
          <div className="site-link">
            <p>組織已確認／待確認收款</p>
            <h3>
              {summary.confirmedReceiptTotal.toLocaleString()} /{' '}
              {summary.pendingReceiptTotal.toLocaleString()}
            </h3>
          </div>
        </div>
      </section>

      <section className="panel stack">
        <strong>篩選／匯出</strong>
        <div className="grid-2">
          <div className="field">
            <label htmlFor="led-month">月份</label>
            <input
              id="led-month"
              type="month"
              value={filterMonth}
              onChange={(e) => setFilterMonth(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="led-kind">類型</label>
            <select
              id="led-kind"
              value={filterKind}
              onChange={(e) =>
                setFilterKind(e.target.value as LedgerEntryKind | 'all')
              }
            >
              <option value="all">全部</option>
              <option value="expense">支出</option>
              <option value="receipt">收款</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="led-status">狀態</label>
            <select
              id="led-status"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <option value="all">全部狀態</option>
              <option value="pending_review">支出待審核</option>
              <option value="pending_confirm">收款待確認</option>
              <option value="confirmed">已確認</option>
              <option value="returned">已退回</option>
              <option value="cancelled">已取消</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="led-site">工地</label>
            <select
              id="led-site"
              value={filterSiteId}
              onChange={(e) => setFilterSiteId(e.target.value)}
            >
              <option value="all">全部工地</option>
              <option value="">雜項</option>
              {sites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => setFilterMonth(currentMonth())}
          >
            回到本月
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => setFilterMonth('')}
          >
            全部期間
          </button>
          <button type="button" className="btn btn-steel" onClick={() => void exportExcel()}>
            匯出 Excel
          </button>
          <button
            type="button"
            className="btn btn-steel"
            disabled={exporting}
            onClick={() => void exportPdf()}
          >
            {exporting ? '匯出中…' : '匯出 PDF'}
          </button>
        </div>
      </section>

      <section className="panel stack">
        <strong>明細</strong>
        {confirmReceiptError ? (
          <p style={{ color: 'var(--danger)', margin: 0 }}>
            {(confirmReceiptError as Error).message}
          </p>
        ) : null}
        {ledgerFiltered.length === 0 ? (
          <div className="empty">此篩選無明細</div>
        ) : (
          ledgerFiltered.map((row) => {
            const isExpense = row.kind === 'expense'
            const rawId = row.id.replace(/^(exp|rc):/, '')
            const exp = isExpense
              ? visibleExpenses.find((e) => e.id === rawId)
              : null
            const rc = !isExpense
              ? visibleReceipts.find((r) => r.id === rawId)
              : null
            return (
              <div key={row.id} className="site-link stack">
                <div className="row between" style={{ alignItems: 'flex-start' }}>
                  <div className="stack" style={{ gap: 4 }}>
                    <strong>
                      {isExpense ? '支出' : '收款'} · {row.item}
                      {row.sequenceLabel ? ` · ${row.sequenceLabel}` : ''} · NT$
                      {row.amount.toLocaleString()}
                    </strong>
                    <p style={{ margin: 0 }}>
                      {row.date} · {row.siteName} · {row.reportedByName}
                      {row.hasProof ? ' · 有憑證' : ''}
                      {rc?.quotationId ? ' · 已關聯報價' : ''}
                    </p>
                  </div>
                  <span className="badge">{row.statusLabel}</span>
                </div>
                {isBoss && exp?.status === 'pending_review' ? (
                  <div className="row">
                    <button
                      className="btn btn-steel"
                      type="button"
                      onClick={() =>
                        void reviewExpense({ id: exp.id, decision: 'confirm' })
                      }
                    >
                      確認
                    </button>
                    <button
                      className="btn btn-ghost"
                      type="button"
                      onClick={() =>
                        void reviewExpense({
                          id: exp.id,
                          decision: 'return',
                          note: '請補資料',
                        })
                      }
                    >
                      退回
                    </button>
                  </div>
                ) : null}
                {isBoss && rc?.status === 'pending_confirm' ? (
                  <div className="row">
                    <button
                      className="btn btn-steel"
                      type="button"
                      onClick={() => void onConfirmReceipt(rc.id)}
                    >
                      確認收款
                    </button>
                    <button
                      className="btn btn-ghost"
                      type="button"
                      onClick={() =>
                        void confirmReceipt({
                          id: rc.id,
                          decision: 'return',
                          note: '請補證明',
                        })
                      }
                    >
                      退回
                    </button>
                  </div>
                ) : null}
                {isBoss && rc && !rc.quotationId && rc.siteId ? (
                  <div className="field">
                    <label htmlFor={`link-q-${rc.id}`}>後補關聯報價</label>
                    <select
                      id={`link-q-${rc.id}`}
                      defaultValue=""
                      onChange={(e) => {
                        const v = e.target.value
                        if (!v) return
                        void linkReceiptQuote({ id: rc.id, quotationId: v })
                      }}
                    >
                      <option value="">選擇報價…</option>
                      {(quotes ?? [])
                        .filter(
                          (q) =>
                            q.projectId === rc.siteId &&
                            q.workflowStatus === 'accepted' &&
                            !q.deletedAt,
                        )
                        .map((q) => (
                          <option key={q.id} value={q.id}>
                            {q.quoteNumber} · {q.title} · NT$
                            {Number(q.amountAfterTax || 0).toLocaleString()}
                          </option>
                        ))}
                    </select>
                  </div>
                ) : null}
                {isBoss && exp && exp.status !== 'cancelled' ? (
                  <button
                    type="button"
                    className="btn btn-danger"
                    onClick={() => {
                      if (
                        !window.confirm(
                          `確定刪除支出「${exp.item}」NT$${exp.amount.toLocaleString()}？`,
                        )
                      ) {
                        return
                      }
                      void cancelExpense({ id: exp.id })
                    }}
                  >
                    刪除支出
                  </button>
                ) : null}
                {isBoss && rc && rc.status !== 'cancelled' ? (
                  <button
                    type="button"
                    className="btn btn-danger"
                    onClick={() => {
                      if (
                        !window.confirm(
                          `確定刪除收款 NT$${rc.amount.toLocaleString()}？`,
                        )
                      ) {
                        return
                      }
                      void cancelReceipt({ id: rc.id })
                    }}
                  >
                    刪除收款
                  </button>
                ) : null}
              </div>
            )
          })
        )}
      </section>

      {progressSite ? (
        <section className="panel stack">
          <strong>工地收款進度</strong>
          <div className="field">
            <label htmlFor="prog-site">工地</label>
            <select
              id="prog-site"
              value={progressSite}
              onChange={(e) => setProgressSiteId(e.target.value)}
            >
              {sites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          {siteProgress ? (
            <div className="grid-2">
              <div className="site-link">
                <p>累計已收（已確認）</p>
                <h3>NT${siteProgress.confirmedTotal.toLocaleString()}</h3>
              </div>
              <div className="site-link">
                <p>待確認</p>
                <h3>NT${siteProgress.pendingTotal.toLocaleString()}</h3>
              </div>
              {siteProgress.contractAmount > 0 ? (
                <>
                  <div className="site-link">
                    <p>合約總額</p>
                    <h3>NT${siteProgress.contractAmount.toLocaleString()}</h3>
                  </div>
                  <div className="site-link">
                    <p>
                      尚欠／進度
                      {siteProgress.overReceived ? '（超收）' : ''}
                    </p>
                    <h3>
                      NT$
                      {(siteProgress.remaining ?? 0).toLocaleString()} ·{' '}
                      {siteProgress.progressPct ?? 0}%
                    </h3>
                  </div>
                </>
              ) : (
                <div className="site-link">
                  <p>合約</p>
                  <h3>尚未有已接受報價</h3>
                </div>
              )}
            </div>
          ) : null}
          <p className="muted" style={{ margin: 0 }}>
            下一次確認將為第 {siteProgress?.nextSequence ?? 1} 次（以工地連續編號）
          </p>
          {siteReceiptRows.length === 0 ? (
            <div className="empty">此工地尚無收款</div>
          ) : (
            siteReceiptRows.map((r) => (
              <div key={r.id} className="site-link">
                <strong>
                  {r.siteSequenceNo != null
                    ? `第 ${r.siteSequenceNo} 次`
                    : '待確認'}{' '}
                  · NT${r.amount.toLocaleString()} ·{' '}
                  {RECEIPT_STATUS_LABELS[r.status]}
                </strong>
                <p style={{ margin: 0 }}>
                  {r.receivedOn} · {r.reportedByName}
                  {r.sourceNote ? ` · ${r.sourceNote}` : ''}
                </p>
              </div>
            ))
          )}
        </section>
      ) : null}

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
              {openSites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          {isMisc ? (
            <div className="field">
              <label htmlFor="exp-loc">地點（自行輸入）</label>
              <input
                id="exp-loc"
                value={locationText}
                onChange={(e) => setLocationText(e.target.value)}
                placeholder="例如：中油忠孝站"
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
            <label htmlFor="exp-receipts">收據／憑證照片</label>
            <input
              id="exp-receipts"
              type="file"
              accept="image/*"
              multiple
              onChange={(e) =>
                setReceiptFiles(Array.from(e.target.files ?? []))
              }
            />
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
        <p className="muted" style={{ margin: 0 }}>
          填金額與日期即可；不一定要有報價。單一已接受報價會自動帶入。
        </p>
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
              receivedOn,
              quotationId: isMisc ? null : quotationId || null,
              proofFiles,
            }).then(() => {
              setReceiptAmount('')
              setSourceNote('')
              setReceivedOn(taipeiDateString())
              setProofFiles([])
            })
          }}
        >
          {isMisc ? (
            <div className="field">
              <label htmlFor="rc-loc">地點（自行輸入）</label>
              <input
                id="rc-loc"
                value={locationText}
                onChange={(e) => setLocationText(e.target.value)}
              />
            </div>
          ) : null}
          <div className="grid-2">
            <div className="field">
              <label htmlFor="rc-on">收款日期</label>
              <input
                id="rc-on"
                type="date"
                value={receivedOn}
                onChange={(e) => setReceivedOn(e.target.value)}
                required
              />
            </div>
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
          </div>
          {!isMisc ? (
            <div className="field">
              <label htmlFor="rc-quote">關聯報價（選填）</label>
              <select
                id="rc-quote"
                value={quotationId}
                onChange={(e) => setQuotationId(e.target.value)}
              >
                <option value="">不關聯（可後補）</option>
                {siteQuotes.map((q) => (
                  <option key={q.id} value={q.id}>
                    {q.quoteNumber} · {q.title} · NT$
                    {Number(q.amountAfterTax || 0).toLocaleString()}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          <div className="field">
            <label htmlFor="rc-src">備註（口頭約定等）</label>
            <input
              id="rc-src"
              value={sourceNote}
              onChange={(e) => setSourceNote(e.target.value)}
              placeholder="例如：先收三萬"
            />
          </div>
          <div className="field">
            <label htmlFor="rc-proof">收款憑證照片</label>
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
        <strong>登記代墊</strong>
        <form
          className="stack"
          onSubmit={(e) => {
            e.preventDefault()
            void createAdvance({
              siteId: isMisc ? null : selectedSite,
              misc: isMisc,
              locationText: isMisc ? locationText : null,
              item: advItem,
              amount: Number(advAmount) || 0,
              note: advNote,
              receiptFiles: advFiles,
            }).then(() => {
              setAdvItem('')
              setAdvAmount('')
              setAdvNote('')
              setAdvFiles([])
            })
          }}
        >
          <div className="grid-2">
            <div className="field">
              <label htmlFor="adv-item">代墊項目</label>
              <input
                id="adv-item"
                value={advItem}
                onChange={(e) => setAdvItem(e.target.value)}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="adv-amt">金額</label>
              <input
                id="adv-amt"
                type="number"
                min="1"
                value={advAmount}
                onChange={(e) => setAdvAmount(e.target.value)}
                required
              />
            </div>
          </div>
          <div className="field">
            <label htmlFor="adv-note">備註</label>
            <input
              id="adv-note"
              value={advNote}
              onChange={(e) => setAdvNote(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="adv-receipt">收據照片</label>
            <input
              id="adv-receipt"
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => setAdvFiles(Array.from(e.target.files ?? []))}
            />
          </div>
          {createAdvanceError ? (
            <p style={{ color: 'var(--danger)', margin: 0 }}>
              {(createAdvanceError as Error).message}
            </p>
          ) : null}
          <button
            className="btn btn-steel"
            type="submit"
            disabled={isCreatingAdvance || (!isMisc && sites.length === 0)}
          >
            {isCreatingAdvance ? '登記中…' : '登記代墊'}
          </button>
        </form>
      </section>

      <section className="panel stack">
        <strong>{isBoss ? '代墊核銷（老闆）' : '我的代墊'}</strong>
        {advances.length === 0 ? (
          <div className="empty">尚無代墊紀錄</div>
        ) : (
          <>
            {isBoss && openAdvances.length > 0 ? (
              <div className="stack" style={{ gap: 8 }}>
                <p style={{ margin: 0 }}>
                  已選 {selectedAdvanceIds.length} 筆 · 合計 NT$
                  {selectedTotal.toLocaleString()}
                </p>
                <div className="field">
                  <label htmlFor="settle-note">核銷備註</label>
                  <input
                    id="settle-note"
                    value={settleNote}
                    onChange={(e) => setSettleNote(e.target.value)}
                  />
                </div>
                {settleAdvancesError ? (
                  <p style={{ color: 'var(--danger)', margin: 0 }}>
                    {(settleAdvancesError as Error).message}
                  </p>
                ) : null}
                <button
                  type="button"
                  className="btn btn-steel"
                  disabled={
                    isSettlingAdvances || selectedAdvanceIds.length === 0
                  }
                  onClick={() =>
                    void settleAdvances({
                      advanceIds: selectedAdvanceIds,
                      note: settleNote || null,
                    }).then(() => {
                      setSelectedAdvanceIds([])
                      setSettleNote('')
                    })
                  }
                >
                  {isSettlingAdvances
                    ? '核銷中…'
                    : `核銷選取（轉成支出 NT$${selectedTotal.toLocaleString()}）`}
                </button>
              </div>
            ) : null}
            {advances.map((a) => (
              <div key={a.id} className="site-link stack">
                <div className="row between" style={{ alignItems: 'flex-start' }}>
                  <div className="stack" style={{ gap: 4 }}>
                    {isBoss && a.status === 'open' ? (
                      <label
                        className="row"
                        style={{ gap: 8, alignItems: 'center' }}
                      >
                        <input
                          type="checkbox"
                          checked={selectedAdvanceIds.includes(a.id)}
                          onChange={() => toggleAdvance(a.id)}
                        />
                        <strong>
                          {a.employeeName} · {a.item} · NT$
                          {a.amount.toLocaleString()}
                        </strong>
                      </label>
                    ) : (
                      <strong>
                        {a.employeeName} · {a.item} · NT$
                        {a.amount.toLocaleString()}
                      </strong>
                    )}
                    <p style={{ margin: 0 }}>
                      {a.siteName}
                      {a.locationText ? `（${a.locationText}）` : ''} ·{' '}
                      {formatTaipei(a.reportedAt, 'MM/dd HH:mm')}
                      {a.note ? ` · ${a.note}` : ''}
                    </p>
                  </div>
                  <span className="badge">{ADVANCE_STATUS_LABELS[a.status]}</span>
                </div>
                {isBoss && a.status !== 'cancelled' ? (
                  <button
                    type="button"
                    className="btn btn-danger"
                    onClick={() => {
                      if (
                        !window.confirm(
                          `確定刪除代墊「${a.item}」NT$${a.amount.toLocaleString()}？`,
                        )
                      ) {
                        return
                      }
                      void cancelAdvance({ id: a.id })
                    }}
                  >
                    刪除代墊
                  </button>
                ) : null}
              </div>
            ))}
          </>
        )}
      </section>
    </div>
  )
}
