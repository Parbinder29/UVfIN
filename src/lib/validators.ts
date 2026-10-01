import { z } from 'zod'
import { EARNING_SOURCES, EXPENSE_CATEGORIES, PAYMENT_METHODS } from '@/lib/constants'

// Shared by the browser forms and the server actions, so both sides apply
// exactly the same rules.

const requiredText = (label: string, max: number) =>
  z.string().trim().min(1, `${label} is required`).max(max, `${label} must be at most ${max} characters`)

/** Optional free text: trimmed, empty becomes null. */
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Must be at most ${max} characters`)
    .optional()
    .nullable()
    .transform((v) => (v ? v : null))

const amount = z.coerce
  .number({ invalid_type_error: 'Enter an amount' })
  .positive('Amount must be greater than zero')
  .max(999_999_999_999, 'Amount is too large')
  .refine((n) => Math.round(n * 100) === Number((n * 100).toFixed(6)), 'Use at most 2 decimal places')

const isoDate = z
  .string()
  .min(1, 'Date is required')
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a valid date')
  .refine((s) => !Number.isNaN(Date.parse(`${s}T00:00:00Z`)) && new Date(`${s}T00:00:00Z`).toISOString().startsWith(s), 'Use a valid date')
  .refine((s) => s >= '2000-01-01' && s <= '2100-12-31', 'Date is out of range')

const paymentMethod = z
  .union([z.enum(PAYMENT_METHODS), z.literal(''), z.null()])
  .optional()
  .transform((v) => (v ? v : null))

export const uuidSchema = z.string().uuid()

export const expenseSchema = z.object({
  expense_date: isoDate,
  amount,
  category: z.enum(EXPENSE_CATEGORIES, { errorMap: () => ({ message: 'Choose a category' }) }),
  payee: requiredText('Payee', 200),
  description: optionalText(1000),
  payment_method: paymentMethod,
  reference_no: optionalText(100),
})

export const earningSchema = z.object({
  earning_date: isoDate,
  amount,
  source: z.enum(EARNING_SOURCES, { errorMap: () => ({ message: 'Choose a source' }) }),
  client_name: optionalText(200),
  description: optionalText(1000),
  payment_method: paymentMethod,
  reference_no: optionalText(100),
})

export const investorSchema = z.object({
  full_name: requiredText('Name', 200),
  email: z
    .union([z.string().trim().email('Enter a valid email').max(200), z.literal(''), z.null()])
    .optional()
    .transform((v) => (v ? v.toLowerCase() : null)),
  phone: z
    .union([z.string().trim().regex(/^[0-9+()\-\s]{5,30}$/, 'Enter a valid phone number'), z.literal(''), z.null()])
    .optional()
    .transform((v) => (v ? v : null)),
  notes: optionalText(1000),
  is_active: z.boolean().default(true),
})

export const investmentSchema = z.object({
  investor_id: z.string().uuid('Choose an investor'),
  amount,
  // Sent by the browser as a full ISO timestamp (local time converted to UTC).
  invested_at: z
    .string()
    .min(1, 'Date and time are required')
    .refine((s) => !Number.isNaN(Date.parse(s)), 'Use a valid date and time')
    .refine((s) => {
      const t = Date.parse(s)
      return t >= Date.parse('2000-01-01T00:00:00Z') && t <= Date.now() + 366 * 24 * 3600 * 1000
    }, 'Date is out of range')
    .transform((s) => new Date(s).toISOString()),
  payment_method: paymentMethod,
  reference_no: optionalText(100),
  notes: optionalText(1000),
})

/** Browser form version: the date-time is wall-clock time in the company time zone. */
export const investmentFormSchema = investmentSchema.extend({
  invested_at: z
    .string()
    .min(1, 'Date and time are required')
    .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, 'Use a valid date and time'),
})

export const loginSchema = z.object({
  email: z.string().trim().email('Enter a valid email address').max(200),
  password: z.string().min(1, 'Password is required').max(200),
})

export type ExpenseInput = z.input<typeof expenseSchema>
export type EarningInput = z.input<typeof earningSchema>
export type InvestorInput = z.input<typeof investorSchema>
export type InvestmentInput = z.input<typeof investmentSchema>
export type LoginInput = z.input<typeof loginSchema>
