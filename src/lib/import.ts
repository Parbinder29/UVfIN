import { PAYMENT_METHODS } from '@/lib/constants'
import type { LedgerConfig } from '@/lib/ledger'
import { earningSchema, expenseSchema } from '@/lib/validators'

// Turns the rows of a spreadsheet (Excel, CSV or Google Sheets) into ledger
// entries. Runs in the browser for the preview; the server action validates
// every row again before anything is saved.

/** Most rows one import may add. Keeps the request under the 1 MB action limit. */
export const IMPORT_MAX_ROWS = 1000

/** Largest file (or Google Sheet download) accepted. */
export const IMPORT_MAX_BYTES = 5 * 1024 * 1024

export type SheetData = unknown[][]
export type Sheets = { sheet: string; data: SheetData }[]

type Field = 'date' | 'amount' | 'kind' | 'party' | 'description' | 'payment_method' | 'reference_no'

/** Accepted column titles, compared case-insensitively with spaces and punctuation ignored. */
function aliases(cfg: LedgerConfig): Record<Field, string[]> {
  return {
    date: ['date', `${cfg.singular} date`, 'transaction date', 'txn date'],
    amount: ['amount', 'amount inr', 'amount rs', 'value', 'total'],
    kind: cfg.key === 'expenses' ? ['category', 'expense category', 'type'] : ['source', 'earning source', 'type'],
    party:
      cfg.key === 'expenses'
        ? ['payee', 'paid to', 'vendor', 'supplier']
        : ['client', 'client name', 'customer', 'received from'],
    description: ['description', 'details', 'notes', 'narration', 'remarks'],
    payment_method: ['payment method', 'method', 'mode', 'payment mode'],
    reference_no: ['reference no', 'reference', 'ref no', 'ref', 'reference number', 'transaction id', 'utr'],
  }
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')

/** Column titles for the template, in order. Required ones first. */
export function templateHeaders(cfg: LedgerConfig): string[] {
  return ['Date', 'Amount', cfg.kindLabel, cfg.partyLabel, 'Description', 'Payment Method', 'Reference No']
}

// --- CSV ---------------------------------------------------------------------

/** Parse CSV text (RFC 4180: quoted cells, "" escapes, line breaks inside quotes). */
export function parseCSV(input: string): SheetData {
  const s = input.replace(/^﻿/, '')
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (quoted) {
      if (c === '"' && s[i + 1] === '"') {
        cell += '"'
        i++
      } else if (c === '"') quoted = false
      else cell += c
    } else if (c === '"') quoted = true
    else if (c === ',') {
      row.push(cell)
      cell = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && s[i + 1] === '\n') i++
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
    } else cell += c
  }
  if (cell || row.length) {
    row.push(cell)
    rows.push(row)
  }
  return rows
}

// --- Cell values -------------------------------------------------------------

const pad = (n: number) => String(n).padStart(2, '0')
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']

/** Excel dates arrive as Date objects (UTC), serial numbers or text. Text is read day-first (Indian style). */
function toIsoDate(v: unknown): string {
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    return `${v.getUTCFullYear()}-${pad(v.getUTCMonth() + 1)}-${pad(v.getUTCDate())}`
  }
  if (typeof v === 'number' && v > 20000 && v < 80000) {
    // Excel serial day number (days since 1899-12-30).
    return toIsoDate(new Date(Date.UTC(1899, 11, 30) + Math.floor(v) * 86400000))
  }
  const s = String(v ?? '').trim()
  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/)
  if (m) return `${m[1]}-${pad(+m[2])}-${pad(+m[3])}`
  m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/)
  if (m) return `${m[3]}-${pad(+m[2])}-${pad(+m[1])}`
  // "14 Oct 2026", "14-Oct-2026", "14 October, 2026" (also what UVfIN's CSV export writes).
  m = s.match(/^(\d{1,2})[-\s/]([a-z]{3})[a-z]*[-\s/,]+(\d{4})$/i)
  if (m && MONTHS.includes(m[2].toLowerCase())) return `${m[3]}-${pad(MONTHS.indexOf(m[2].toLowerCase()) + 1)}-${pad(+m[1])}`
  return s
}

/** Numbers pass through. Text like "₹1,20,000.50" or "Rs. 500" is cleaned up. */
function toAmount(v: unknown): unknown {
  if (typeof v === 'number') return v
  const s = String(v ?? '').trim()
  if (!s) return ''
  const cleaned = s.replace(/^(rs\.?|inr|₹)\s*/i, '').replace(/,/g, '').trim()
  return /^-?\d+(\.\d+)?$/.test(cleaned) ? Number(cleaned) : s
}

/** Matches an allowed option ignoring case, so "rent" becomes "Rent". Unknown values are kept, to fail validation. */
function matchOption(v: unknown, options: readonly string[]): string {
  const s = String(v ?? '').trim()
  return options.find((o) => norm(o) === norm(s)) ?? s
}

const METHOD_ALIASES: Record<string, string> = {
  bank: 'Bank Transfer',
  banktransfer: 'Bank Transfer',
  neft: 'Bank Transfer',
  rtgs: 'Bank Transfer',
  imps: 'Bank Transfer',
  netbanking: 'Bank Transfer',
  creditcard: 'Card',
  debitcard: 'Card',
}

function toMethod(v: unknown): string {
  const s = String(v ?? '').trim()
  if (!s) return ''
  return METHOD_ALIASES[norm(s)] ?? matchOption(s, PAYMENT_METHODS)
}

/** Plain text. Undoes the leading quote UVfIN's CSV export adds in front of formula-like text. */
const text = (v: unknown) => {
  if (v instanceof Date) return toIsoDate(v)
  const s = String(v ?? '').trim()
  return /^'\s*[=+\-@]/.test(s) ? s.slice(1) : s
}

// --- Sheet -------------------------------------------------------------------

export interface ImportRow {
  /** Row number as shown in the spreadsheet. */
  line: number
  values: Record<string, unknown>
  errors: string[]
}

export interface ParsedSheet {
  rows: ImportRow[]
  /** Columns in the file that are not used. */
  ignored: string[]
  /** A problem with the sheet as a whole (e.g. no header row). */
  error?: string
}

export function parseLedgerSheet(cfg: LedgerConfig, data: SheetData): ParsedSheet {
  const lookup = new Map<string, Field>()
  for (const [field, list] of Object.entries(aliases(cfg)) as [Field, string[]][]) {
    for (const a of list) lookup.set(norm(a), field)
  }

  // The header is the first row (of the first 10) that names both Date and Amount,
  // so a title line above the table is fine.
  const headerIndex = data.slice(0, 10).findIndex((row) => {
    const fields = row.map((c) => lookup.get(norm(text(c))))
    return fields.includes('date') && fields.includes('amount')
  })
  if (headerIndex === -1) {
    return { rows: [], ignored: [], error: 'No header row found. The first row of the table needs columns named "Date" and "Amount".' }
  }

  const columns = new Map<Field, number>()
  const ignored: string[] = []
  data[headerIndex].forEach((c, i) => {
    const title = text(c)
    const field = lookup.get(norm(title))
    if (field && !columns.has(field)) columns.set(field, i)
    else if (title) ignored.push(title)
  })
  if (!columns.has('kind')) return { rows: [], ignored, error: `The sheet needs a "${cfg.kindLabel}" column.` }
  if (cfg.partyRequired && !columns.has('party')) return { rows: [], ignored, error: `The sheet needs a "${cfg.partyLabel}" column.` }

  const schema = cfg.key === 'expenses' ? expenseSchema : earningSchema
  const cell = (row: unknown[], f: Field) => (columns.has(f) ? row[columns.get(f)!] : null)

  const rows: ImportRow[] = []
  data.slice(headerIndex + 1).forEach((row, i) => {
    if (row.every((c) => c == null || String(c).trim() === '')) return
    const values: Record<string, unknown> = {
      [cfg.dateCol]: toIsoDate(cell(row, 'date')),
      amount: toAmount(cell(row, 'amount')),
      [cfg.kindCol]: matchOption(cell(row, 'kind'), cfg.kinds),
      [cfg.partyCol]: text(cell(row, 'party')),
      description: text(cell(row, 'description')),
      payment_method: toMethod(cell(row, 'payment_method')),
      reference_no: text(cell(row, 'reference_no')),
    }
    const result = schema.safeParse(values)
    const errors = result.success
      ? []
      : result.error.issues.map((issue) => {
          const field = String(issue.path[0])
          if (field === cfg.kindCol) return `${cfg.kindLabel} "${values[field]}" is not one of: ${cfg.kinds.join(', ')}`
          if (field === 'payment_method') return `Payment method "${values[field]}" is not one of: ${PAYMENT_METHODS.join(', ')}`
          return issue.message
        })
    rows.push({ line: headerIndex + i + 2, values: result.success ? result.data : values, errors })
  })
  return { rows, ignored }
}

// --- Google Sheets ---------------------------------------------------------

/**
 * Reads the spreadsheet id and tab (gid) from a Google Sheets link, e.g.
 * https://docs.google.com/spreadsheets/d/<id>/edit#gid=123. Returns null for anything else.
 */
export function parseGoogleSheetUrl(input: string): { id: string; gid: string } | null {
  let url: URL
  try {
    url = new URL(input.trim())
  } catch {
    return null
  }
  if (url.protocol !== 'https:' || url.hostname !== 'docs.google.com') return null
  const m = url.pathname.match(/^\/spreadsheets\/d\/([a-zA-Z0-9_-]{20,100})(\/|$)/)
  if (!m) return null
  const gid = (url.hash.match(/gid=(\d+)/) ?? url.search.match(/gid=(\d+)/))?.[1] ?? '0'
  return { id: m[1], gid }
}
