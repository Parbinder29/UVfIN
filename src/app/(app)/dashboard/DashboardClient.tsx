'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  PieChart, Pie, Cell,
  AreaChart, Area,
} from 'recharts'
import { formatCurrency, formatDate, getDateRangePresets, DateRangePreset } from '@/lib/format'
import { Building2, TrendingUp, TrendingDown, Minus, Wallet, ArrowUpRight, ArrowDownRight, MinusIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { format, subMonths, startOfMonth, endOfMonth, eachMonthOfInterval } from 'date-fns'

interface DashboardClientProps {
  user: { id: string; email: string }
  profile: { full_name: string; role: 'finance_manager' | 'director' }
}

const COLORS = ['#0ea5e9', '#f97316', '#22c55e', '#eab308', '#a855f7', '#ec4899', '#14b8a6', '#f43f5e']

export function DashboardClient({ profile }: DashboardClientProps) {
  const [kpis, setKpis] = useState<{
    totalEarnings: number
    totalExpenses: number
    netBalance: number
    totalInvestments: number
    earningsThisMonth: number
    expensesThisMonth: number
    investmentsThisMonth: number
  } | null>(null)
  const [monthlyData, setMonthlyData] = useState<Array<{ month: string; earnings: number; expenses: number }>>([])
  const [expenseCategories, setExpenseCategories] = useState<Array<{ name: string; value: number }>>([])
  const [earningSources, setEarningSources] = useState<Array<{ name: string; value: number }>>([])
  const [investmentTrend, setInvestmentTrend] = useState<Array<{ month: string; value: number }>>([])
  const [recentActivity, setRecentActivity] = useState<Array<{
    id: string
    type: 'expense' | 'earning' | 'investment'
    date: string
    amount: number
    description: string
    categoryOrSource: string
  }>>([])
  const [dateRange, setDateRange] = useState<DateRangePreset>(getDateRangePresets()[0])
  const [loading, setLoading] = useState(true)
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')

  const presets = getDateRangePresets()

  const fetchData = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    try {
      let startDate: string | null = null
      let endDate: string | null = null

      if (dateRange.label === 'Custom') {
        startDate = customStart
        endDate = customEnd
      } else if (dateRange.start && dateRange.end) {
        startDate = dateRange.start.toISOString().split('T')[0]
        endDate = dateRange.end.toISOString().split('T')[0]
      }

      // Build query filters
      const expenseQuery = supabase.from('expenses').select('*').eq('is_deleted', false)
      const earningQuery = supabase.from('earnings').select('*').eq('is_deleted', false)
      const investmentQuery = supabase.from('investments').select('*').eq('is_deleted', false)

      if (startDate) {
        expenseQuery.gte('expense_date', startDate)
        earningQuery.gte('earning_date', startDate)
        investmentQuery.gte('invested_at', startDate)
      }
      if (endDate) {
        expenseQuery.lte('expense_date', endDate)
        earningQuery.lte('earning_date', endDate)
        investmentQuery.lte('invested_at', endDate)
      }

      const [expenses, earnings, investments] = await Promise.all([
        expenseQuery,
        earningQuery,
        investmentQuery,
      ])

      // Calculate KPIs
      const totalExpenses = expenses.data?.reduce((sum, e) => sum + Number(e.amount), 0) || 0
      const totalEarnings = earnings.data?.reduce((sum, e) => sum + Number(e.amount), 0) || 0
      const totalInvestments = investments.data?.reduce((sum, i) => sum + Number(i.amount), 0) || 0

      // This month calculations
      const now = new Date()
      const thisMonthStart = startOfMonth(now).toISOString().split('T')[0]
      const thisMonthEnd = endOfMonth(now).toISOString().split('T')[0]

      const [thisMonthExpenses, thisMonthEarnings, thisMonthInvestments] = await Promise.all([
        supabase.from('expenses').select('amount').eq('is_deleted', false).gte('expense_date', thisMonthStart).lte('expense_date', thisMonthEnd),
        supabase.from('earnings').select('amount').eq('is_deleted', false).gte('earning_date', thisMonthStart).lte('earning_date', thisMonthEnd),
        supabase.from('investments').select('amount').eq('is_deleted', false).gte('invested_at', thisMonthStart).lte('invested_at', thisMonthEnd),
      ])

      const earningsThisMonth = thisMonthEarnings.data?.reduce((sum, e) => sum + Number(e.amount), 0) || 0
      const expensesThisMonth = thisMonthExpenses.data?.reduce((sum, e) => sum + Number(e.amount), 0) || 0
      const investmentsThisMonth = thisMonthInvestments.data?.reduce((sum, i) => sum + Number(i.amount), 0) || 0

      setKpis({
        totalEarnings,
        totalExpenses,
        netBalance: totalEarnings - totalExpenses,
        totalInvestments,
        earningsThisMonth,
        expensesThisMonth,
        investmentsThisMonth,
      })

      // Monthly chart data (last 12 months)
      const months = eachMonthOfInterval({ start: subMonths(now, 11), end: now })
      const monthlyMap = new Map<string, { earnings: number; expenses: number }>()
      
      months.forEach(m => {
        const key = format(m, 'MMM yyyy')
        monthlyMap.set(key, { earnings: 0, expenses: 0 })
      })

      expenses.data?.forEach(e => {
        const key = format(new Date(e.expense_date), 'MMM yyyy')
        const existing = monthlyMap.get(key) || { earnings: 0, expenses: 0 }
        existing.expenses += Number(e.amount)
        monthlyMap.set(key, existing)
      })

      earnings.data?.forEach(e => {
        const key = format(new Date(e.earning_date), 'MMM yyyy')
        const existing = monthlyMap.get(key) || { earnings: 0, expenses: 0 }
        existing.earnings += Number(e.amount)
        monthlyMap.set(key, existing)
      })

      setMonthlyData(Array.from(monthlyMap.entries()).map(([month, data]) => ({
        month,
        ...data,
      })))

      // Expense categories
      const expenseCatMap = new Map<string, number>()
      expenses.data?.forEach(e => {
        expenseCatMap.set(e.category, (expenseCatMap.get(e.category) || 0) + Number(e.amount))
      })
      setExpenseCategories(Array.from(expenseCatMap.entries()).map(([name, value]) => ({ name, value })))

      // Earning sources
      const earningSrcMap = new Map<string, number>()
      earnings.data?.forEach(e => {
        earningSrcMap.set(e.source, (earningSrcMap.get(e.source) || 0) + Number(e.amount))
      })
      setEarningSources(Array.from(earningSrcMap.entries()).map(([name, value]) => ({ name, value })))

      // Investment trend
      const invMap = new Map<string, number>()
      investments.data?.forEach(i => {
        const key = format(new Date(i.invested_at), 'MMM yyyy')
        invMap.set(key, (invMap.get(key) || 0) + Number(i.amount))
      })
      setInvestmentTrend(Array.from(invMap.entries()).map(([month, value]) => ({ month, value })).sort((a, b) => a.month.localeCompare(b.month)))

      // Recent activity
      const allActivity = [
        ...(expenses.data || []).map(e => ({
          id: e.id,
          type: 'expense' as const,
          date: e.expense_date,
          amount: Number(e.amount),
          description: e.payee,
          categoryOrSource: e.category,
        })),
        ...(earnings.data || []).map(e => ({
          id: e.id,
          type: 'earning' as const,
          date: e.earning_date,
          amount: Number(e.amount),
          description: e.client_name || e.source,
          categoryOrSource: e.source,
        })),
        ...(investments.data || []).map(i => ({
          id: i.id,
          type: 'investment' as const,
          date: i.invested_at.split('T')[0],
          amount: Number(i.amount),
          description: i.investors?.full_name || 'Investment',
          categoryOrSource: 'Investment',
        })),
      ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 10)

      setRecentActivity(allActivity)
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }, [dateRange, customStart, customEnd])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handlePresetChange = (value: string) => {
    const preset = presets.find(p => p.label === value)
    if (preset) {
      setDateRange(preset)
      setCustomStart('')
      setCustomEnd('')
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
            <p className="text-muted-foreground">Welcome back, {profile.full_name}</p>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map(i => (
            <Card key={i}><CardContent className="pt-6"><Skeleton className="h-8 w-3/4" /><Skeleton className="mt-4 h-12 w-1/2" /></CardContent></Card>
          ))}
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map(i => (
            <Card key={`chart-${i}`}><CardContent className="pt-6"><Skeleton className="h-64 w-full" /></CardContent></Card>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">Welcome back, {profile.full_name}</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Label htmlFor="date-range" className="text-sm font-medium">Date Range:</Label>
            <Select value={dateRange.label} onValueChange={handlePresetChange}>
              <SelectTrigger id="date-range" className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {presets.map(p => (
                  <SelectItem key={p.label} value={p.label}>{p.label}</SelectItem>
                ))}
                <SelectItem value="Custom">Custom</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {dateRange.label === 'Custom' && (
            <div className="flex items-center gap-2">
              <Input
                type="date"
                value={customStart}
                onChange={e => setCustomStart(e.target.value)}
                className="w-[140px]"
                placeholder="Start"
              />
              <span className="text-muted-foreground">to</span>
              <Input
                type="date"
                value={customEnd}
                onChange={e => setCustomEnd(e.target.value)}
                className="w-[140px]"
                placeholder="End"
              />
            </div>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KPICard
          title="Total Earnings"
          value={formatCurrency(kpis?.totalEarnings || 0)}
          subtitle={`This month: ${formatCurrency(kpis?.earningsThisMonth || 0)}`}
          icon={<ArrowUpRight className="h-5 w-5 text-green-500" />}
        />
        <KPICard
          title="Total Money Spent"
          value={formatCurrency(kpis?.totalExpenses || 0)}
          subtitle={`This month: ${formatCurrency(kpis?.expensesThisMonth || 0)}`}
          icon={<ArrowDownRight className="h-5 w-5 text-red-500" />}
        />
        <KPICard
          title="Net Balance"
          value={formatCurrency(kpis?.netBalance || 0)}
          subtitle={kpis && kpis.netBalance >= 0 ? 'Positive' : 'Negative'}
          icon={kpis && kpis.netBalance >= 0 ? <TrendingUp className="h-5 w-5 text-green-500" /> : <TrendingDown className="h-5 w-5 text-red-500" />}
        />
        <KPICard
          title="Total Investments"
          value={formatCurrency(kpis?.totalInvestments || 0)}
          subtitle={`This month: ${formatCurrency(kpis?.investmentsThisMonth || 0)}`}
          icon={<Wallet className="h-5 w-5 text-blue-500" />}
        />
      </div>

      {/* Charts */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="md:col-span-2 lg:col-span-2">
          <CardHeader>
            <CardTitle>Monthly Earnings vs Expenses</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" tickFormatter={v => formatCurrency(v)} />
                  <YAxis dataKey="month" type="category" width={80} />
                  <Tooltip
                    formatter={(value: number) => [formatCurrency(value), '']}
                    labelFormatter={v => v}
                  />
                  <Legend />
                  <Bar dataKey="earnings" name="Earnings" fill="#22c55e" radius={[0, 4, 4, 0]} />
                  <Bar dataKey="expenses" name="Expenses" fill="#ef4444" radius={[4, 0, 0, 4]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Expenses by Category</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={expenseCategories}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="value"
                    nameKey="name"
                    label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {expenseCategories.map((_, i) => (
                      <Cell key={`cell-${i}`} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => [formatCurrency(value), '']} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Earnings by Source</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={earningSources}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="value"
                    nameKey="name"
                    label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {earningSources.map((_, i) => (
                      <Cell key={`cell-${i}`} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => [formatCurrency(value), '']} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Investments Over Time</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={investmentTrend}>
                  <defs>
                    <linearGradient id="colorInvestments" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis tickFormatter={v => formatCurrency(v)} />
                  <Tooltip formatter={(value: number) => [formatCurrency(value), '']} />
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke="#0ea5e9"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorInvestments)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b text-left text-sm text-muted-foreground">
                    <th className="pb-3 font-medium">Date</th>
                    <th className="pb-3 font-medium">Type</th>
                    <th className="pb-3 font-medium">Description</th>
                    <th className="pb-3 font-medium">Category/Source</th>
                    <th className="pb-3 font-medium text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {recentActivity.map(item => (
                    <tr key={item.id} className="border-b last:border-0">
                      <td className="py-3 text-sm">{formatDate(item.date)}</td>
                      <td className="py-3">
                        <span className={cn(
                          'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium',
                          item.type === 'expense' && 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
                          item.type === 'earning' && 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
                          item.type === 'investment' && 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                        )}>
                          {item.type.charAt(0).toUpperCase() + item.type.slice(1)}
                        </span>
                      </td>
                      <td className="py-3 text-sm">{item.description}</td>
                      <td className="py-3 text-sm text-muted-foreground">{item.categoryOrSource}</td>
                      <td className="py-3 text-sm font-medium text-right">
                        {item.type === 'expense' ? '-' : '+'}{formatCurrency(item.amount)}
                      </td>
                    </tr>
                  ))}
                  {recentActivity.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-muted-foreground">No activity found</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function KPICard({ title, value, subtitle, icon }: {
  title: string
  value: string
  subtitle: string
  icon: React.ReactNode
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <div className="text-muted-foreground">{icon}</div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </CardContent>
    </Card>
  )
}