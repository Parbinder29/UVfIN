// Edit these lists to change the options shown in the forms and filters.

export const EXPENSE_CATEGORIES = [
  'Salaries',
  'Rent',
  'Utilities',
  'Marketing',
  'Software & Tools',
  'Travel',
  'Office Supplies',
  'Taxes',
  'Vendor Payments',
  'Maintenance',
  'Miscellaneous',
] as const

export const EARNING_SOURCES = [
  'Product Sales',
  'Services',
  'Client Projects',
  'Commissions',
  'Interest',
  'Other',
] as const

export const PAYMENT_METHODS = ['Cash', 'Bank Transfer', 'UPI', 'Cheque', 'Card', 'Other'] as const

export const PAGE_SIZE = 25

/** Hard cap for CSV exports so a single export can't pull an unbounded table. */
export const EXPORT_LIMIT = 10000

export const ATTACHMENT_MAX_BYTES = 5 * 1024 * 1024
export const ATTACHMENT_TYPES = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
} as const

export const SECTION_LABELS: Record<string, string> = {
  expenses: 'Money Spent',
  earnings: 'Earnings',
  investors: 'Investors',
  investments: 'Investments',
}

export const ACTION_LABELS: Record<string, string> = {
  INSERT: 'Created',
  UPDATE: 'Updated',
  SOFT_DELETE: 'Deleted',
}

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number]
export type EarningSource = (typeof EARNING_SOURCES)[number]
export type PaymentMethod = (typeof PAYMENT_METHODS)[number]
