/** Money helpers: avoid float drift; round half-up to 2 decimals (NTD cents). */

export function roundMoney(value: number, decimals = 2): number {
  const factor = 10 ** decimals
  return Math.round((value + Number.EPSILON) * factor) / factor
}

export function moneyEquals(a: number, b: number, decimals = 2): boolean {
  return roundMoney(a, decimals) === roundMoney(b, decimals)
}
