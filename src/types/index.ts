export interface Profile {
  id: string
  full_name: string
  role: 'finance_manager' | 'director'
  created_at: string
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
  is_deleted: boolean
  created_by: string
  created_at: string
  updated_at: string
  profiles?: Profile
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
  is_deleted: boolean
  created_by: string
  created_at: string
  updated_at: string
  profiles?: Profile
}

export interface Investor {
  id: string
  full_name: string
  email: string | null
  phone: string | null
  notes: string | null
  is_active: boolean
  created_by: string
  created_at: string
  updated_at: string
  total_invested?: number
  contribution_count?: number
}

export interface Investment {
  id: string
  investor_id: string
  amount: number
  invested_at: string
  payment_method: string | null
  reference_no: string | null
  notes: string | null
  is_deleted: boolean
  created_by: string
  created_at: string
  updated_at: string
  investors?: Investor
  profiles?: Profile
}

export interface AuditLog {
  id: number
  table_name: string
  record_id: string | null
  action: 'INSERT' | 'UPDATE' | 'SOFT_DELETE'
  old_data: Record<string, unknown> | null
  new_data: Record<string, unknown> | null
  changed_by: string | null
  changed_at: string
  profiles?: Profile
}

export interface KPIData {
  totalEarnings: number
  totalExpenses: number
  netBalance: number
  totalInvestments: number
  earningsThisMonth: number
  expensesThisMonth: number
  investmentsThisMonth: number
}

export interface ChartDataPoint {
  month: string
  earnings: number
  expenses: number
}

export interface CategoryChartData {
  name: string
  value: number
}

export interface InvestorChartData {
  name: string
  value: number
}

export interface RecentActivityItem {
  id: string
  type: 'expense' | 'earning' | 'investment'
  date: string
  amount: number
  description: string
  categoryOrSource: string
}