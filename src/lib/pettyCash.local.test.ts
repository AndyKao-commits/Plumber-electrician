import { describe, expect, it } from 'vitest'
import { localDb } from './localDb'

function boss() {
  const u = localDb.getUsers().find((x) => x.role === 'boss')
  if (!u) throw new Error('no boss')
  return u
}

function worker() {
  const u = localDb.getUsers().find((x) => x.role === 'employee')
  if (!u) throw new Error('no worker')
  return u
}

describe('localDb PET-001 petty cash', () => {
  it('approve does not credit; disburse credits once', () => {
    const b = boss()
    const w = worker()
    const account = localDb.listPettyCashAccounts()[0]
    const before = account.balance
    const req = localDb.requestPettyCashTopUp(w, {
      accountId: account.id,
      amount: 500,
      reason: `測試補充-${Date.now()}`,
    })
    expect(req.status).toBe('pending_approval')
    localDb.approvePettyCashTopUp(b, req.id)
    expect(localDb.listPettyCashAccounts()[0].balance).toBe(before)
    expect(() => localDb.disbursePettyCashTopUp(w, { requestId: req.id })).toThrow(
      /僅 Owner/,
    )
    localDb.disbursePettyCashTopUp(b, { requestId: req.id })
    expect(localDb.listPettyCashAccounts()[0].balance).toBe(before + 500)
    expect(
      localDb.listPettyCashRequests().find((r) => r.id === req.id)?.status,
    ).toBe('disbursed')
    expect(() =>
      localDb.disbursePettyCashTopUp(b, { requestId: req.id }),
    ).toThrow(/已撥款/)
  })
})
