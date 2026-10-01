export type UserRole = 'finance_manager' | 'director'

export interface Profile {
  id: string
  full_name: string
  role: UserRole
}

export interface Expense {
  id: string
  expense_date: string
  amount: number
  category: string
  payee: string
  description: string | null
  payment_method: string | null
  reference_no: string | null
  attachment_path: string | null
  created_by: string
  created_at: string
}

export interface Earning {
  id: string
  earning_date: string
  amount: number
  source: string
  client_name: string | null
  description: string | null
  payment_method: string | null
  reference_no: string | null
  attachment_path: string | null
  created_by: string
  created_at: string
}

export interface InvestorSummary {
  id: string
  full_name: string
  email: string | null
  phone: string | null
  notes: string | null
  is_active: boolean
  created_by: string
  created_at: string
  total_invested: number
  contribution_count: number
  last_invested_at: string | null
}

export interface Investment {
  id: string
  investor_id: string
  amount: number
  invested_at: string
  payment_method: string | null
  reference_no: string | null
  notes: string | null
  created_by: string
  created_at: string
}

export interface AuditEntry {
  id: number
  table_name: string
  record_id: string | null
  action: 'INSERT' | 'UPDATE' | 'SOFT_DELETE'
  old_data: Record<string, unknown> | null
  new_data: Record<string, unknown> | null
  changed_by: string | null
  changed_at: string
}

export type ActionResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string[] | undefined> }
