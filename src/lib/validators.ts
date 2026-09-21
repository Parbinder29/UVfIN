import { z } from 'zod'
import { EXPENSE_CATEGORIES, EARNING_SOURCES, PAYMENT_METHODS, INVESTMENT_PAYMENT_METHODS } from '@/lib/constants'

export const expenseSchema = z.object({
  expense_date: z.string().min(1, 'Date is required'),
  amount: z.coerce.number().positive('Amount must be positive'),
  category: z.enum(EXPENSE_CATEGORIES),
  payee: z.string().min(1, 'Payee is required'),
  description: z.string().optional(),
  payment_method: z.enum(PAYMENT_METHODS).optional(),
  reference_no: z.string().optional(),
})

export const earningSchema = z.object({
  earning_date: z.string().min(1, 'Date is required'),
  amount: z.coerce.number().positive('Amount must be positive'),
  source: z.enum(EARNING_SOURCES),
  client_name: z.string().optional(),
  description: z.string().optional(),
  payment_method: z.enum(PAYMENT_METHODS).optional(),
  reference_no: z.string().optional(),
})

export const investorSchema = z.object({
  full_name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  phone: z.string().optional(),
  notes: z.string().optional(),
  is_active: z.boolean().default(true),
})

export const investmentSchema = z.object({
  investor_id: z.string().uuid('Invalid investor'),
  amount: z.coerce.number().positive('Amount must be positive'),
  invested_at: z.string().min(1, 'Date and time is required'),
  payment_method: z.enum(INVESTMENT_PAYMENT_METHODS).optional(),
  reference_no: z.string().optional(),
  notes: z.string().optional(),
})

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
})

export type ExpenseFormData = z.infer<typeof expenseSchema>
export type EarningFormData = z.infer<typeof earningSchema>
export type InvestorFormData = z.infer<typeof investorSchema>
export type InvestmentFormData = z.infer<typeof investmentSchema>
export type LoginFormData = z.infer<typeof loginSchema>