import { EARNING_SOURCES, EXPENSE_CATEGORIES, PAYMENT_METHODS } from '@/lib/constants'
import { LEDGERS, type LedgerConfig } from '@/lib/ledger'
import { earningSchema, expenseSchema } from '@/lib/validators'

// Turns the rows of a spreadsheet (Excel, CSV or Google Sheets) into ledger
// entries. Runs in the browser for the preview; the server action validates
// every row again before anything is saved.
//
// A workbook in the accounts-sheet layout (Debit Ledger + Credit Ledger) is
// sorted row by row: spending goes to Money Spent, money received from
// customers goes to Earnings, and transfers, unidentified receipts and funds
// put in by people are listed as not imported. A Chart of Accounts tab, if
// the workbook has one, tells which ledgers are banks, income or expenses.

/** Most rows one import may add. Keeps the request under the 1 MB action limit. */
export const IMPORT_MAX_ROWS = 1000

/** Largest file (or Google Sheet download) accepted. */
export const IMPORT_MAX_BYTES = 5 * 1024 * 1024

export type SheetData = unknown[][]
export type Sheets = { sheet: string; data: SheetData }[]

export type LedgerKey = 'expenses' | 'earnings'

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
const ALIASES: Record<Field, string[]> = {
  serial: ['sr no', 'sr', 's no', 'sl no', 'serial no', 'no'],
  date: ['date', 'expense date', 'earning date', 'transaction date', 'txn date', 'value date'],
  amount: ['amount', 'amount inr', 'amount rs', 'value', 'total'],
  kind: ['debit ledger', 'ledger', 'expense head', 'head', 'category', 'expense category', 'type', 'source', 'earning source'],
  party: [
    'item / party', 'item', 'party', 'particulars', 'payee', 'paid to', 'vendor', 'supplier',
    'client', 'client name', 'customer', 'received from',
  ],
  description: ['description', 'details', 'note', 'notes', 'narration', 'remarks'],
  payment_method: ['payment method', 'paid via', 'via', 'method', 'mode', 'payment mode'],
  reference_no: ['reference no', 'reference', 'ref no', 'ref', 'reference number', 'transaction id', 'utr'],
  paid_by: ['paid by'],
  paid_from: ['credit ledger', 'paid from'],
  status: ['status'],
}

/** Column titles that only an Earnings sheet uses, so a sheet without a Credit Ledger can still be told apart. */
const EARNINGS_TITLES = ['source', 'earning source', 'client', 'client name', 'customer', 'received from', 'earning date']
const EXPENSES_TITLES = ['debit ledger', 'expense head', 'expense category', 'item / party', 'payee', 'paid to', 'vendor', 'supplier', 'paid by', 'expense date']

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

// --- Chart of Accounts -------------------------------------------------------

/** Ledger name → its type ("Bank", "Expense", "Liability", …), read from a Chart of Accounts tab. */
export type ChartOfAccounts = Map<string, string>

/** Finds a tab with "Ledger Name" (or "Account") and "Type" columns, in any workbook. */
export function readChartOfAccounts(sheets: Sheets): ChartOfAccounts {
  const coa: ChartOfAccounts = new Map()
  const nameTitles = ['ledgername', 'ledger', 'accountname', 'account', 'accounthead', 'head']
  const typeTitles = ['type', 'accounttype', 'ledgertype', 'group', 'nature']
  for (const { data } of sheets) {
    for (let h = 0; h < Math.min(data.length, 10); h++) {
      const titles = data[h].map((c) => norm(text(c)))
      const nameCol = titles.findIndex((t) => nameTitles.includes(t))
      const typeCol = titles.findIndex((t) => typeTitles.includes(t))
      // A ledger table has no Date or Amount; that's what tells it from the entries.
      if (nameCol === -1 || typeCol === -1 || titles.includes('date') || titles.includes('amount')) continue
      for (const row of data.slice(h + 1)) {
        const name = text(row[nameCol])
        const type = text(row[typeCol])
        if (name && type) coa.set(norm(name), type)
      }
      break
    }
  }
  return coa
}

// --- Sorting rows into Money Spent / Earnings ---------------------------------

type LedgerClass = 'spend' | 'bank' | 'income' | 'suspense' | 'funding' | 'unknown'

const KNOWN_SPEND = new Set(EXPENSE_CATEGORIES.map(norm))
const INCOME_WORDS = /razorpay|paytm|phonepe|stripe|payment gateway|sales|revenue|income|turnover|fees? received|commission received|interest received|receipts? from customers?|\bsettlement/i
const SPEND_WORDS = /expense|charges|\bfees?\b|rent|salar|wages|purchase|equipment|furniture|fixtures|repairs?|maintenance|stationery|advertis|promotion|travel|conveyance|subscription|software|electricity|utilities|insurance|advance to|deposit paid/i
const BANK_WORDS = /\bbank\b|\bcash\b|wallet|current a\/?c|savings a\/?c|\bod a\/?c/i
const SUSPENSE_WORDS = /suspense|unidentified|unknown|unclassified/i
const FUNDING_WORDS = /capital|equity|\bloan\b|investor|share application|director|partner|proprietor|drawings/i

/** What kind of account a ledger is: from its name first, then the Chart of Accounts. */
function ledgerClass(name: string, coa: ChartOfAccounts): LedgerClass {
  if (!name) return 'unknown'
  if (KNOWN_SPEND.has(norm(name))) return name.match(SUSPENSE_WORDS) ? 'suspense' : 'spend'
  if (SUSPENSE_WORDS.test(name)) return 'suspense'
  // "Income Tax", "GST paid": taxes are spending even though the name says income.
  if (/\btax|\btds\b|\bgst\b/i.test(name)) return 'spend'
  if (INCOME_WORDS.test(name)) return 'income'
  const type = coa.get(norm(name))
  if (type) {
    if (/bank|cash/i.test(type)) return 'bank'
    if (/income|revenue|sales/i.test(type)) return 'income'
    if (/expense|asset|purchase/i.test(type)) return 'spend'
    if (/liabilit|equity|capital|loan|partner|director/i.test(type)) return 'funding'
  }
  if (SPEND_WORDS.test(name)) return 'spend'
  if (BANK_WORDS.test(name)) return 'bank'
  if (FUNDING_WORDS.test(name)) return 'funding'
  return 'unknown'
}

/** Where a row with these debit and credit ledgers belongs, or why it is left out. */
function route(debit: string, credit: string, coa: ChartOfAccounts): { dest: LedgerKey } | { skip: string } {
  const d = ledgerClass(debit, coa)
  const c = ledgerClass(credit, coa)
  if (d === 'spend' || d === 'suspense') return { dest: 'expenses' }
  if (d === 'bank') {
    if (c === 'income') return { dest: 'earnings' }
    if (c === 'bank') return { skip: `Transfer between the company's own accounts (${credit} → ${debit}).` }
    if (c === 'suspense') return { skip: `Money received, sender not yet known (${credit}). Add it under Earnings or Investments once you know what it is.` }
    return { skip: `Money put into ${debit} by ${credit || 'someone'}. If it is an investment, add it under Investments.` }
  }
  if (d === 'income') return { skip: `Reduces income (${debit}), e.g. a refund. Not money spent.` }
  if (d === 'funding') return { skip: `Repayment to ${debit}. Not money spent.` }
  // A ledger we can't place: if the money left a bank, a wallet or a person's pocket, it was spent.
  if (c === 'bank' || c === 'funding' || c === 'unknown' || c === 'suspense') return { dest: 'expenses' }
  return { skip: `Could not tell what "${debit}" is. Add it by hand.` }
}

/** Earnings source from the ledger and party names; "Other" when nothing fits. */
function earningSource(...names: string[]): string {
  const s = names.join(' ')
  if (/service|consult/i.test(s)) return 'Services'
  if (/project/i.test(s)) return 'Client Projects'
  if (/commission/i.test(s)) return 'Commissions'
  if (/interest/i.test(s)) return 'Interest'
  if (/product|goods|\bsales\b/i.test(s)) return 'Product Sales'
  return 'Other'
}

/** A debit ledger that matches a known category (ignoring case and punctuation) takes its spelling; otherwise it's kept as a new one. */
function expenseCategory(v: string): string {
  return matchOption(v, EXPENSE_CATEGORIES)
}

// --- Sheet -------------------------------------------------------------------

export interface ImportRow {
  /** Row number as shown in the spreadsheet. */
  line: number
  /** Where the row goes; null when it is left out (see skip) or can't be read. */
  dest: LedgerKey | null
  values: Record<string, unknown>
  errors: string[]
  /** Why a readable row is deliberately not imported (transfer, unknown receipt, …). */
  skip?: string
  /** The sheet has no date for this row; it can be typed in the preview. */
  missingDate: boolean
}

export interface ImportPlan {
  rows: ImportRow[]
  /** Columns in the file that are not used. */
  ignored: string[]
  /** Debit ledgers not in the category list; they are added as new categories. */
  newCategories: string[]
  /** A problem with the sheet as a whole (e.g. no header row). */
  error?: string
}

/**
 * Read one tab and sort its rows. `fallback` is the page the import was
 * opened from; it decides where rows go when the sheet doesn't say.
 * `dates` holds dates typed in the preview for rows that have none, by line.
 */
export function planSheet(
  data: SheetData,
  opts: { fallback: LedgerKey; coa?: ChartOfAccounts; dates?: Record<number, string> }
): ImportPlan {
  const coa = opts.coa ?? new Map()
  const lookup = new Map<string, Field>()
  for (const [field, list] of Object.entries(ALIASES) as [Field, string[]][]) {
    for (const a of list) lookup.set(norm(a), field)
  }
  const empty = { rows: [], ignored: [], newCategories: [] }

  // The header is the first row (of the first 10) that names both Date and Amount,
  // so a title line above the table is fine.
  const headerIndex = data.slice(0, 10).findIndex((row) => {
    const fields = row.map((c) => lookup.get(norm(text(c))))
    return fields.includes('date') && fields.includes('amount')
  })
  if (headerIndex === -1) {
    return { ...empty, error: 'No header row found. The first row of the table needs columns named "Date" and "Amount".' }
  }

  const columns = new Map<Field, number>()
  const ignored: string[] = []
  const titles = data[headerIndex].map((c) => text(c))
  titles.forEach((title, i) => {
    const field = lookup.get(norm(title))
    if (field && !columns.has(field)) columns.set(field, i)
    else if (title && !/^entries$/i.test(title)) ignored.push(title)
  })
  if (!columns.has('kind')) return { ...empty, ignored, error: 'The sheet needs a "Debit Ledger" (or "Category" / "Source") column.' }

  // With a Credit Ledger column every row is sorted on its own. Without one,
  // the column titles say which ledger the whole sheet is for.
  const accountsLayout = columns.has('paid_from')
  const has = (list: string[]) => titles.some((t) => list.some((a) => norm(a) === norm(t)))
  const sheetLedger: LedgerKey = has(EARNINGS_TITLES) && !has(EXPENSES_TITLES) ? 'earnings' : has(EXPENSES_TITLES) && !has(EARNINGS_TITLES) ? 'expenses' : opts.fallback
  if (!accountsLayout && sheetLedger === 'expenses' && !columns.has('party')) {
    return { ...empty, ignored, error: `The sheet needs an "${LEDGERS.expenses.partyLabel}" column.` }
  }

  const cell = (row: unknown[], f: Field) => (columns.has(f) ? row[columns.get(f)!] : null)
  const rows: ImportRow[] = []
  const newCategories = new Set<string>()

  data.slice(headerIndex + 1).forEach((row, i) => {
    // A row with only a serial number (or nothing) is a blank line.
    if (row.every((c, idx) => idx === columns.get('serial') || c == null || String(c).trim() === '')) return
    const line = headerIndex + i + 2
    const debit = text(cell(row, 'kind'))
    const credit = text(cell(row, 'paid_from'))
    const party = text(cell(row, 'party'))
    const description = text(cell(row, 'description'))
    const sheetDate = toIsoDate(cell(row, 'date'))
    const missingDate = !sheetDate
    const date = sheetDate || opts.dates?.[line] || ''
    const common = {
      amount: toAmount(cell(row, 'amount')),
      description,
      payment_method: toMethod(cell(row, 'payment_method')),
      reference_no: text(cell(row, 'reference_no')) || refFromNote(description),
    }

    let dest: LedgerKey
    if (accountsLayout) {
      const r = route(debit, credit, coa)
      if ('skip' in r) {
        rows.push({ line, dest: null, values: { date, amount: common.amount, party: party || description, debit, credit }, errors: [], skip: r.skip, missingDate })
        return
      }
      dest = r.dest
    } else {
      dest = sheetLedger
      // A debit to a bank account is money coming in, or moving between own accounts.
      if (dest === 'expenses' && ledgerClass(debit, coa) === 'bank') {
        rows.push({
          line, dest: null, values: { date, amount: common.amount, party, debit, credit }, errors: [], missingDate,
          skip: `Debit Ledger "${debit}" is money coming into a bank account or a transfer between accounts, not money spent.`,
        })
        return
      }
    }

    const values: Record<string, unknown> =
      dest === 'expenses'
        ? {
            expense_date: date,
            ...common,
            category: expenseCategory(debit),
            payee: party || description,
            paid_by: text(cell(row, 'paid_by')),
            paid_from: credit,
            status: text(cell(row, 'status')),
          }
        : {
            earning_date: date,
            ...common,
            source: accountsLayout ? earningSource(credit, party) : matchOption(debit, EARNING_SOURCES),
            client_name: party,
          }

    const cfg = LEDGERS[dest]
    const result = (dest === 'expenses' ? expenseSchema : earningSchema).safeParse(values)
    const errors = result.success
      ? []
      : result.error.issues.map((issue) => {
          const field = String(issue.path[0])
          if (field === cfg.kindCol) {
            if (!debit) return `${cfg.kindLabel} is empty`
            return `${cfg.kindLabel} "${debit}" is not one of: ${cfg.kinds.join(', ')}`
          }
          if (field === cfg.partyCol) return `${cfg.partyLabel} is empty`
          if (field === 'payment_method') return `${cfg.methodLabel} "${values[field]}" is not one of: ${PAYMENT_METHODS.join(', ')}`
          if (field === cfg.dateCol && !values[field]) return 'Date is missing'
          if (field === 'amount' && values[field] === '') return 'Amount is missing'
          return issue.message
        })
    if (dest === 'expenses' && result.success && !KNOWN_SPEND.has(norm(String(values.category)))) {
      newCategories.add(String(values.category))
    }
    rows.push({ line, dest, values: result.success ? result.data : values, errors: [...new Set(errors)], missingDate })
  })
  return { rows, ignored, newCategories: [...newCategories] }
}

/** Rows that will be imported. */
export const readyRows = (plan: ImportPlan) => plan.rows.filter((r) => r.dest && r.errors.length === 0)

/**
 * Plan every tab and pick the one with the most importable rows, so the
 * entries tab of a full accounts workbook is found on its own.
 */
export function planWorkbook(sheets: Sheets, fallback: LedgerKey) {
  const coa = readChartOfAccounts(sheets)
  let best = sheets[0]?.sheet ?? ''
  let bestCount = -1
  for (const s of sheets) {
    const plan = planSheet(s.data, { fallback, coa })
    const count = plan.error ? -1 : plan.rows.filter((r) => r.dest).length
    if (count > bestCount) {
      best = s.sheet
      bestCount = count
    }
  }
  return { coa, sheet: best }
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
