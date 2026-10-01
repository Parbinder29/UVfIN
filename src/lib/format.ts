import { CURRENCY, LOCALE, TIMEZONE } from '@/lib/env'

const currencyFmt = new Intl.NumberFormat(LOCALE, { style: 'currency', currency: CURRENCY, maximumFractionDigits: 2 })
const compactFmt = new Intl.NumberFormat(LOCALE, { style: 'currency', currency: CURRENCY, notation: 'compact', maximumFractionDigits: 1 })

/** The one place money is formatted. */
export function formatCurrency(amount: number | string | null | undefined): string {
  const n = Number(amount ?? 0)
  return currencyFmt.format(Number.isFinite(n) ? n : 0)
}

/** Short axis labels. For INR uses K / L (lakh) / Cr (crore), which read unambiguously. */
export function formatCompactCurrency(amount: number): string {
  if (CURRENCY !== 'INR') return compactFmt.format(amount)
  const abs = Math.abs(amount)
  const short = (n: number, unit: string) => `₹${Number(n.toFixed(1)).toLocaleString(LOCALE)}${unit}`
  if (abs >= 1e7) return short(amount / 1e7, 'Cr')
  if (abs >= 1e5) return short(amount / 1e5, 'L')
  if (abs >= 1e3) return short(amount / 1e3, 'K')
  return `₹${amount}`
}

/** Format a date-only value (YYYY-MM-DD) without shifting it across time zones. */
export function formatDate(date: string | null | undefined): string {
  if (!date) return ''
  const [y, m, d] = date.slice(0, 10).split('-').map(Number)
  return new Intl.DateTimeFormat(LOCALE, { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(
    new Date(Date.UTC(y, m - 1, d))
  )
}

/** Format a timestamp in the company time zone, with time. */
export function formatDateTime(value: string | null | undefined): string {
  if (!value) return ''
  return new Intl.DateTimeFormat(LOCALE, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: TIMEZONE,
  }).format(new Date(value))
}

export function formatMonth(yyyyMm: string): string {
  const [y, m] = yyyyMm.split('-').map(Number)
  return new Intl.DateTimeFormat(LOCALE, { month: 'short', year: '2-digit', timeZone: 'UTC' }).format(
    new Date(Date.UTC(y, m - 1, 1))
  )
}
