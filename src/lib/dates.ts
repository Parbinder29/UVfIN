import { TIMEZONE } from '@/lib/env'

export const DATE_PRESETS = ['this-month', 'last-month', 'this-quarter', 'this-year', 'all', 'custom'] as const
export type DatePreset = (typeof DATE_PRESETS)[number]

export const PRESET_LABELS: Record<DatePreset, string> = {
  'this-month': 'This Month',
  'last-month': 'Last Month',
  'this-quarter': 'This Quarter',
  'this-year': 'This Year',
  all: 'All Time',
  custom: 'Custom',
}

const pad = (n: number) => String(n).padStart(2, '0')
const ymd = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`
const lastDay = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate()

/** Today's date (YYYY-MM-DD) in the company time zone. */
export function todayInTz(tz = TIMEZONE, now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
}

export function presetRange(preset: DatePreset, now = new Date()): { from: string | null; to: string | null } {
  const [y, m] = todayInTz(TIMEZONE, now).split('-').map(Number)
  switch (preset) {
    case 'this-month':
      return { from: ymd(y, m, 1), to: ymd(y, m, lastDay(y, m)) }
    case 'last-month': {
      const ly = m === 1 ? y - 1 : y
      const lm = m === 1 ? 12 : m - 1
      return { from: ymd(ly, lm, 1), to: ymd(ly, lm, lastDay(ly, lm)) }
    }
    case 'this-quarter': {
      const qs = Math.floor((m - 1) / 3) * 3 + 1
      return { from: ymd(y, qs, 1), to: ymd(y, qs + 2, lastDay(y, qs + 2)) }
    }
    case 'this-year':
      return { from: ymd(y, 1, 1), to: ymd(y, 12, 31) }
    default:
      return { from: null, to: null }
  }
}

/** Offset in minutes of `tz` from UTC at the given instant. */
function tzOffsetMinutes(tz: string, at: Date): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(at)
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value)
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'))
  return Math.round((asUtc - at.getTime()) / 60000)
}

/** The UTC instant at which `date` (YYYY-MM-DD) starts in the company time zone. */
export function startOfDayInTz(date: string, tz = TIMEZONE): string {
  const [y, m, d] = date.split('-').map(Number)
  const guess = new Date(Date.UTC(y, m - 1, d))
  const offset = tzOffsetMinutes(tz, guess)
  return new Date(guess.getTime() - offset * 60000).toISOString()
}

/** The UTC instant at which the day after `date` starts (exclusive upper bound). */
export function endOfDayExclusiveInTz(date: string, tz = TIMEZONE): string {
  const [y, m, d] = date.split('-').map(Number)
  const next = new Date(Date.UTC(y, m - 1, d + 1))
  return startOfDayInTz(next.toISOString().slice(0, 10), tz)
}

/** "YYYY-MM-DDTHH:mm" wall-clock time in the company time zone -> UTC ISO string. */
export function zonedLocalToISO(local: string, tz = TIMEZONE): string {
  const [date, time] = local.split('T')
  const [y, m, d] = date.split('-').map(Number)
  const [hh, mm] = time.split(':').map(Number)
  const guess = new Date(Date.UTC(y, m - 1, d, hh, mm))
  const offset = tzOffsetMinutes(tz, new Date(guess.getTime() - tzOffsetMinutes(tz, guess) * 60000))
  return new Date(guess.getTime() - offset * 60000).toISOString()
}

/** UTC ISO string -> "YYYY-MM-DDTHH:mm" wall-clock time in the company time zone. */
export function isoToZonedLocal(iso: string, tz = TIMEZONE): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(new Date(iso))
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '00'
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`
}
