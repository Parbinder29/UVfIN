import { EARNING_SOURCES, EXPENSE_CATEGORIES } from '@/lib/constants'

/** Money Spent and Earnings share one implementation, configured here. */
export interface LedgerConfig {
  key: 'expenses' | 'earnings'
  table: 'expenses' | 'earnings'
  title: string
  singular: string
  path: string
  dateCol: 'expense_date' | 'earning_date'
  kindCol: 'category' | 'source'
  kindLabel: string
  kinds: readonly string[]
  partyCol: 'payee' | 'client_name'
  partyLabel: string
  partyRequired: boolean
  searchCols: readonly string[]
}

export const LEDGERS: Record<'expenses' | 'earnings', LedgerConfig> = {
  expenses: {
    key: 'expenses',
    table: 'expenses',
    title: 'Money Spent',
    singular: 'Expense',
    path: '/money-spent',
    dateCol: 'expense_date',
    kindCol: 'category',
    kindLabel: 'Category',
    kinds: EXPENSE_CATEGORIES,
    partyCol: 'payee',
    partyLabel: 'Payee',
    partyRequired: true,
    searchCols: ['payee', 'description', 'reference_no'],
  },
  earnings: {
    key: 'earnings',
    table: 'earnings',
    title: 'Earnings',
    singular: 'Earning',
    path: '/earnings',
    dateCol: 'earning_date',
    kindCol: 'source',
    kindLabel: 'Source',
    kinds: EARNING_SOURCES,
    partyCol: 'client_name',
    partyLabel: 'Client',
    partyRequired: false,
    searchCols: ['client_name', 'description', 'reference_no'],
  },
}

/** Logical sort keys exposed in the URL, mapped to real columns per ledger. */
export const LEDGER_SORTS = ['date', 'amount', 'kind', 'party', 'method'] as const

export function ledgerSortColumn(cfg: LedgerConfig, sort: string): string {
  switch (sort) {
    case 'amount':
      return 'amount'
    case 'kind':
      return cfg.kindCol
    case 'party':
      return cfg.partyCol
    case 'method':
      return 'payment_method'
    default:
      return cfg.dateCol
  }
}

/** Uniform row shape for the shared ledger table. */
export interface LedgerRow {
  id: string
  date: string
  amount: number
  kind: string
  party: string | null
  description: string | null
  payment_method: string | null
  reference_no: string | null
  attachment_path: string | null
  created_by: string
}
