// Edit these lists to change the options shown in the forms and filters.

/** Debit ledgers for Money Spent, as used in the company's accounts sheet. */
export const EXPENSE_CATEGORIES = [
  'Office Equipment',
  'Furniture & Fixtures',
  'Networking & Wifi Equipment',
  'Telephone, Internet & SIM Charges',
  'Repairs & Maintenance - Electrical',
  'Carpentry & Woodwork Expenses',
  'Office Interior, Painting & Decor',
  'Signage, Flex & Branding Expenses',
  'Advertising & Business Promotion',
  'Printing & Stationery',
  'Office & Miscellaneous Expenses',
  'Advance to Suppliers',
  'Bank Charges',
  'Suspense - Unidentified Payments',
  'Salaries & Wages',
  'Rent',
  'Electricity & Water',
  'Software & Subscriptions',
  'Travel & Conveyance',
  'Professional & Legal Fees',
  'Taxes & Duties',
] as const

/** Suggestions for the Status column of Money Spent (any text up to 50 characters is allowed). */
export const EXPENSE_STATUSES = ['Existing', 'New', 'New - Provisional', 'Confirmed'] as const

export const EARNING_SOURCES = [
  'Product Sales',
  'Services',
  'Client Projects',
  'Commissions',
  'Interest',
  'Other',
] as const

export const PAYMENT_METHODS = ['Cash', 'UPI', 'NEFT', 'IMPS', 'RTGS', 'Bank Transfer', 'Cheque', 'Card', 'Other'] as const

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
