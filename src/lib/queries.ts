import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { EXPORT_LIMIT, PAGE_SIZE } from '@/lib/constants'
import { endOfDayExclusiveInTz, startOfDayInTz } from '@/lib/dates'
import { TIMEZONE } from '@/lib/env'
import { ledgerSortColumn, type LedgerConfig, type LedgerRow } from '@/lib/ledger'
import type { ListFilters } from '@/lib/list-params'
import type { AuditEntry, Investment, InvestorSummary } from '@/types'

type Paging = { page: number } | { exportAll: true }

const range = (p: Paging): [number, number] =>
  'exportAll' in p ? [0, EXPORT_LIMIT - 1] : [(p.page - 1) * PAGE_SIZE, p.page * PAGE_SIZE - 1]

const orFilter = (cols: readonly string[], q: string) => cols.map((c) => `${c}.ilike."%${q}%"`).join(',')

// ---------------------------------------------------------------- ledgers

export async function getLedgerRows(cfg: LedgerConfig, f: ListFilters, paging: Paging) {
  const supabase = await createClient()
  const cols = `id, ${cfg.dateCol}, amount, ${cfg.kindCol}, ${cfg.partyCol}, description, payment_method, reference_no, attachment_path, created_by, created_at`

  let query = supabase.from(cfg.table).select(cols, { count: 'exact' }).eq('is_deleted', false)
  if (f.from) query = query.gte(cfg.dateCol, f.from)
  if (f.to) query = query.lte(cfg.dateCol, f.to)
  if (f.kind) query = query.eq(cfg.kindCol, f.kind)
  if (f.method) query = query.eq('payment_method', f.method)
  if (f.min != null) query = query.gte('amount', f.min)
  if (f.max != null) query = query.lte('amount', f.max)
  if (f.q) query = query.or(orFilter(cfg.searchCols, f.q))

  const [start, end] = range(paging)
  const { data, count, error } = await query
    .order(ledgerSortColumn(cfg, f.sort), { ascending: f.dir === 'asc', nullsFirst: false })
    .order('created_at', { ascending: false })
    .range(start, end)

  if (error) throw new Error(`Could not load ${cfg.title.toLowerCase()}.`)

  const rows: LedgerRow[] = ((data ?? []) as unknown as Record<string, unknown>[]).map((r) => ({
    id: r.id as string,
    date: r[cfg.dateCol] as string,
    amount: Number(r.amount),
    kind: r[cfg.kindCol] as string,
    party: (r[cfg.partyCol] as string | null) ?? null,
    description: r.description as string | null,
    payment_method: r.payment_method as string | null,
    reference_no: r.reference_no as string | null,
    attachment_path: r.attachment_path as string | null,
    created_by: r.created_by as string,
  }))
  return { rows, count: count ?? 0 }
}

export async function getFilteredTotal(
  table: 'expenses' | 'earnings' | 'investments',
  f: ListFilters
): Promise<number> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('filtered_total', {
    p_table: table,
    p_from: f.from,
    p_to: f.to,
    p_kind: f.kind,
    p_method: f.method,
    p_min: f.min,
    p_max: f.max,
    p_search: f.q || null,
    p_investor: f.investor,
    p_tz: TIMEZONE,
  })
  if (error) throw new Error('Could not calculate the total.')
  return Number(data ?? 0)
}

// ---------------------------------------------------------------- investments

export const INVESTMENT_SORTS = ['date', 'amount', 'method'] as const

export async function getInvestments(f: ListFilters, paging: Paging) {
  const supabase = await createClient()
  let query = supabase
    .from('investments')
    .select('id, investor_id, amount, invested_at, payment_method, reference_no, notes, created_by, created_at', {
      count: 'exact',
    })
    .eq('is_deleted', false)
  if (f.from) query = query.gte('invested_at', startOfDayInTz(f.from))
  if (f.to) query = query.lt('invested_at', endOfDayExclusiveInTz(f.to))
  if (f.investor) query = query.eq('investor_id', f.investor)
  if (f.method) query = query.eq('payment_method', f.method)
  if (f.min != null) query = query.gte('amount', f.min)
  if (f.max != null) query = query.lte('amount', f.max)
  if (f.q) query = query.or(orFilter(['reference_no', 'notes'], f.q))

  const sortCol = f.sort === 'amount' ? 'amount' : f.sort === 'method' ? 'payment_method' : 'invested_at'
  const [start, end] = range(paging)
  const { data, count, error } = await query
    .order(sortCol, { ascending: f.dir === 'asc', nullsFirst: false })
    .order('created_at', { ascending: false })
    .range(start, end)
  if (error) throw new Error('Could not load investments.')
  return {
    rows: (data ?? []).map((r) => ({ ...r, amount: Number(r.amount) })) as Investment[],
    count: count ?? 0,
  }
}

export async function getInvestorSummaries(opts: { activeOnly?: boolean } = {}) {
  const supabase = await createClient()
  let query = supabase
    .from('investor_summary')
    .select('id, full_name, email, phone, notes, is_active, created_by, created_at, total_invested, contribution_count, last_invested_at')
    .order('full_name')
    .limit(1000)
  if (opts.activeOnly) query = query.eq('is_active', true)
  const { data, error } = await query
  if (error) throw new Error('Could not load investors.')
  return (data ?? []).map((r) => ({
    ...r,
    total_invested: Number(r.total_invested),
    contribution_count: Number(r.contribution_count),
  })) as InvestorSummary[]
}

export async function getInvestorSummary(id: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('investor_summary')
    .select('id, full_name, email, phone, notes, is_active, created_by, created_at, total_invested, contribution_count, last_invested_at')
    .eq('id', id)
    .maybeSingle()
  if (error) throw new Error('Could not load investor.')
  return data
    ? ({ ...data, total_invested: Number(data.total_invested), contribution_count: Number(data.contribution_count) } as InvestorSummary)
    : null
}

// ---------------------------------------------------------------- audit log

export const AUDIT_TABLES = ['expenses', 'earnings', 'investors', 'investments'] as const
export const AUDIT_ACTIONS = ['INSERT', 'UPDATE', 'SOFT_DELETE'] as const

export async function getAuditLog(
  f: { table: string | null; action: string | null; user: string | null; from: string | null; to: string | null },
  page: number
) {
  const supabase = await createClient()
  let query = supabase
    .from('audit_log')
    .select('id, table_name, record_id, action, old_data, new_data, changed_by, changed_at', { count: 'exact' })
  if (f.table) query = query.eq('table_name', f.table)
  if (f.action) query = query.eq('action', f.action)
  if (f.user) query = query.eq('changed_by', f.user)
  if (f.from) query = query.gte('changed_at', startOfDayInTz(f.from))
  if (f.to) query = query.lt('changed_at', endOfDayExclusiveInTz(f.to))
  const { data, count, error } = await query
    .order('changed_at', { ascending: false })
    .order('id', { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)
  if (error) throw new Error('Could not load the audit log.')
  return { rows: (data ?? []) as AuditEntry[], count: count ?? 0 }
}

// ---------------------------------------------------------------- dashboard

export interface DashboardSummary {
  total_earnings: number
  total_spent: number
  total_invested: number
  month_earnings: number
  month_spent: number
  month_invested: number
  by_category: { name: string; value: number }[]
  by_source: { name: string; value: number }[]
  by_month: { month: string; earnings: number; spent: number; invested: number }[]
}

export async function getDashboardSummary(from: string | null, to: string | null): Promise<DashboardSummary> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('dashboard_summary', { p_from: from, p_to: to, p_tz: TIMEZONE })
  if (error || !data) throw new Error('Could not load the dashboard.')
  const d = data as Record<string, unknown>
  const num = (k: string) => Number(d[k] ?? 0)
  const list = (k: string) => ((d[k] as { name: string; value: number }[]) ?? []).map((x) => ({ name: x.name, value: Number(x.value) }))
  return {
    total_earnings: num('total_earnings'),
    total_spent: num('total_spent'),
    total_invested: num('total_invested'),
    month_earnings: num('month_earnings'),
    month_spent: num('month_spent'),
    month_invested: num('month_invested'),
    by_category: list('by_category'),
    by_source: list('by_source'),
    by_month: ((d.by_month as DashboardSummary['by_month']) ?? []).map((m) => ({
      month: m.month,
      earnings: Number(m.earnings),
      spent: Number(m.spent),
      invested: Number(m.invested),
    })),
  }
}

export interface ActivityItem {
  id: string
  section: 'expenses' | 'earnings' | 'investments'
  date: string
  label: string
  detail: string
  amount: number
  created_by: string
  created_at: string
}

/** Latest 10 entries across all three sections, newest first. */
export async function getRecentActivity(): Promise<ActivityItem[]> {
  const supabase = await createClient()
  const [ex, ea, iv, investors] = await Promise.all([
    supabase.from('expenses').select('id, expense_date, amount, category, payee, created_by, created_at').eq('is_deleted', false).order('created_at', { ascending: false }).limit(10),
    supabase.from('earnings').select('id, earning_date, amount, source, client_name, created_by, created_at').eq('is_deleted', false).order('created_at', { ascending: false }).limit(10),
    supabase.from('investments').select('id, invested_at, amount, investor_id, created_by, created_at').eq('is_deleted', false).order('created_at', { ascending: false }).limit(10),
    supabase.from('investors').select('id, full_name').limit(1000),
  ])
  if (ex.error || ea.error || iv.error) throw new Error('Could not load recent activity.')
  const names = Object.fromEntries((investors.data ?? []).map((i) => [i.id, i.full_name]))
  const items: ActivityItem[] = [
    ...(ex.data ?? []).map((r) => ({ id: r.id, section: 'expenses' as const, date: r.expense_date, label: r.payee, detail: r.category, amount: -Number(r.amount), created_by: r.created_by, created_at: r.created_at })),
    ...(ea.data ?? []).map((r) => ({ id: r.id, section: 'earnings' as const, date: r.earning_date, label: r.client_name || r.source, detail: r.source, amount: Number(r.amount), created_by: r.created_by, created_at: r.created_at })),
    ...(iv.data ?? []).map((r) => ({ id: r.id, section: 'investments' as const, date: r.invested_at, label: names[r.investor_id] ?? 'Investor', detail: 'Investment', amount: Number(r.amount), created_by: r.created_by, created_at: r.created_at })),
  ]
  return items.sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 10)
}
