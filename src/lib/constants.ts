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

export const PAYMENT_METHODS = [
  'Cash',
  'Bank Transfer',
  'UPI',
  'Cheque',
  'Card',
  'Other',
] as const

export const INVESTMENT_PAYMENT_METHODS = [
  'Bank Transfer',
  'UPI',
  'Cheque',
  'Cash',
  'Other',
] as const

export type ExpenseCategory = typeof EXPENSE_CATEGORIES[number]
export type EarningSource = typeof EARNING_SOURCES[number]
export type PaymentMethod = typeof PAYMENT_METHODS[number]
export type InvestmentPaymentMethod = typeof INVESTMENT_PAYMENT_METHODS[number]