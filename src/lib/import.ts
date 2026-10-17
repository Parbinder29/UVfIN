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

type Field =
  | 'serial'
  | 'date'
  | 'amount'
  | 'kind'
  | 'party'
  | 'description'
  | 'payment_method'
  | 'reference_no'
  | 'paid_by'
  | 'paid_from'
  | 'status'

/** Accepted column titles, compared case-insensitively with spaces and punctuation ignored. */
function aliases(cfg: LedgerConfig): Partial<Record<Field, string[]>> {
  const common = {
    serial: ['sr no', 'sr', 's no', 'sl no', 'serial no', 'no'],
    date: ['date', `${cfg.singular} date`, 'transaction date', 'txn date'],
    amount: ['amount', 'amount inr', 'amount rs', 'value', 'total'],
    description: ['description', 'details', 'note', 'notes', 'narration', 'remarks'],
    payment_method: ['payment method', 'paid via', 'via', 'method', 'mode', 'payment mode'],
    reference_no: ['reference no', 'reference', 'ref no', 'ref', 'reference number', 'transaction id', 'utr'],
  }
  if (cfg.key === 'expenses') {
    return {
      ...common,
      kind: ['debit ledger', 'ledger', 'expense head', 'head', 'category', 'expense category', 'type'],
      party: ['item / party', 'item', 'party', 'particulars', 'payee', 'paid to', 'vendor', 'supplier'],
      paid_by: ['paid by'],
      paid_from: ['credit ledger', 'paid from'],
      status: ['status'],
    }
  }
  return {
    ...common,
    kind: ['source', 'earning source', 'type'],
    party: ['client', 'client name', 'customer', 'received from'],
  }
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')

/** Column titles for the template, in order. Money Spent uses the company's accounts sheet layout. */
export function templateHeaders(cfg: LedgerConfig): string[] {
  if (cfg.sheetColumns) {
    return ['Sr No', 'Item / Party', 'Date', 'Amount (₹)', 'Paid Via', 'Paid By', 'Debit Ledger', 'Credit Ledger', 'Note', 'Status']
  }
  return ['Date', 'Amount', cfg.kindLabel, cfg.partyLabel, 'Description', 'Payment Method', 'Reference No']
}

/** "Provisional. Ref 288101. ..." → "288101", so rows that differ only by reference aren't treated as duplicates. */
function refFromNote(note: string): string {
  return note.match(/\bRefs?\b\.?\s*(?:no\.?\s*)?([A-Za-z0-9][A-Za-z0-9/-]*)/i)?.[1] ?? ''
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
    else if (title && !/^entries$/i.test(title)) ignored.push(title)
  })
  if (!columns.has('kind')) return { rows: [], ignored, error: `The sheet needs a "${cfg.kindLabel}" column.` }
  if (cfg.partyRequired && !columns.has('party')) return { rows: [], ignored, error: `The sheet needs a "${cfg.partyLabel}" column.` }

  const schema = cfg.key === 'expenses' ? expenseSchema : earningSchema
  const cell = (row: unknown[], f: Field) => (columns.has(f) ? row[columns.get(f)!] : null)

  const rows: ImportRow[] = []
  data.slice(headerIndex + 1).forEach((row, i) => {
    // A row with only a serial number (or nothing) is a blank line.
    if (row.every((c, idx) => idx === columns.get('serial') || c == null || String(c).trim() === '')) return
    const description = text(cell(row, 'description'))
    const values: Record<string, unknown> = {
      [cfg.dateCol]: toIsoDate(cell(row, 'date')),
      amount: toAmount(cell(row, 'amount')),
      [cfg.kindCol]: matchOption(cell(row, 'kind'), cfg.kinds),
      [cfg.partyCol]: text(cell(row, 'party')),
      description,
      payment_method: toMethod(cell(row, 'payment_method')),
      reference_no: text(cell(row, 'reference_no')) || refFromNote(description),
    }
    if (cfg.sheetColumns) {
      values.paid_by = text(cell(row, 'paid_by'))
      values.paid_from = text(cell(row, 'paid_from'))
      values.status = text(cell(row, 'status'))
    }
    const kind = String(values[cfg.kindCol])
    // A debit to a bank account is money coming in, or moving between own accounts.
    if (cfg.key === 'expenses' && !cfg.kinds.includes(kind) && /^bank\b/i.test(kind)) {
      rows.push({
        line: headerIndex + i + 2,
        values,
        errors: [`Debit Ledger "${kind}" is money coming into a bank account or a transfer between accounts, not money spent. Leave it out, or add it under Earnings or Investments.`],
      })
      return
    }
    const result = schema.safeParse(values)
    const errors = result.success
      ? []
      : result.error.issues.map((issue) => {
          const field = String(issue.path[0])
          if (field === cfg.kindCol) {
            if (!kind) return `${cfg.kindLabel} is empty`
            return cfg.kinds.length > 12
              ? `${cfg.kindLabel} "${kind}" is not in the list (see the template's "Allowed values" tab)`
              : `${cfg.kindLabel} "${kind}" is not one of: ${cfg.kinds.join(', ')}`
          }
          if (field === 'payment_method') return `${cfg.methodLabel} "${values[field]}" is not one of: ${PAYMENT_METHODS.join(', ')}`
          if (field === cfg.dateCol && !values[field]) return 'Date is missing'
          if (field === 'amount' && values[field] === '') return 'Amount is missing'
          return issue.message
        })
    rows.push({ line: headerIndex + i + 2, values: result.success ? result.data : values, errors: [...new Set(errors)] })
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
