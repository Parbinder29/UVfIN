// @ts-nocheck
'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, formatDate, formatDateTime, getDateRangePresets, DateRangePreset } from '@/lib/format'
import { toCSV, downloadCSV, generateFilename } from '@/lib/csv'
import { INVESTMENT_PAYMENT_METHODS } from '@/lib/constants'
import {
  Card, CardContent, CardHeader, CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog'
import { Form, FormField, FormItem, FormLabel, FormControl, FormDescription, FormMessage } from '@/components/ui/form'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableFooter } from '@/components/ui/table'
import { Pagination } from '@/components/ui/pagination'
import { Loader2, Plus, Edit, Trash2, Download, Search } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { investmentSchema, type InvestmentFormData } from '@/lib/validators'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import Link from 'next/link'

interface InvestmentsClientProps {
  user: { id: string; email: string }
  profile: { full_name: string; role: 'finance_manager' | 'director' }
}

export function InvestmentsClient({ profile }: InvestmentsClientProps) {
  const isManager = profile.role === 'finance_manager'
  const [investments, setInvestments] = useState<Array<{
    id: string
    investor_id: string
    amount: number
    invested_at: string
    payment_method: string | null
    reference_no: string | null
    notes: string | null
    is_deleted: boolean
    created_by: string
    investors: { full_name: string } | null
    profiles: { full_name: string } | null
    created_at: string
  }>>([])
  const [investors, setInvestors] = useState<Array<{ id: string; full_name: string }>>([])
  const [totalCount, setTotalCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const pageSize = 25

  const [filters, setFilters] = useState({
    investorId: '',
    startDate: '',
    endDate: '',
    paymentMethod: '',
    minAmount: '',
    maxAmount: '',
    search: '',
  })
  const [dateRange, setDateRange] = useState<DateRangePreset>(getDateRangePresets()[0])
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingInvestment, setEditingInvestment] = useState<typeof investments[0] | null>(null)
  const [dialogLoading, setDialogLoading] = useState(false)

  const form = useForm<InvestmentFormData>({
    resolver: zodResolver(investmentSchema),
    defaultValues: {
      investor_id: '',
      amount: '',
      invested_at: new Date().toISOString().slice(0, 16),
      payment_method: INVESTMENT_PAYMENT_METHODS[0],
      reference_no: '',
      notes: '',
    },
  })

  const fetchInvestors = useCallback(async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    try {
      const { data, error } = await supabase.functions.invoke('get-investors-for-select')
      if (error) throw error
      setInvestors(data || [])
    } catch (err) {
      console.error('Failed to fetch investors:', err)
    }
  }, [])

  const fetchInvestments = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    try {
      let startDate = filters.startDate || undefined
      let endDate = filters.endDate || undefined

      if (dateRange.label === 'Custom') {
        startDate = customStart || undefined
        endDate = customEnd || undefined
      } else if (dateRange.start && dateRange.end) {
        startDate = dateRange.start.toISOString().split('T')[0]
        endDate = dateRange.end.toISOString().split('T')[0]
      }

      const { data, count, error } = await supabase.functions.invoke('get-investments', {
        body: {
          investorId: filters.investorId || undefined,
          startDate,
          endDate,
          paymentMethod: filters.paymentMethod || undefined,
          minAmount: filters.minAmount ? Number(filters.minAmount) : undefined,
          maxAmount: filters.maxAmount ? Number(filters.maxAmount) : undefined,
          search: filters.search || undefined,
          page,
          pageSize,
        },
      })

      if (error) throw error
      setInvestments(data || [])
      setTotalCount(count || 0)
    } catch (err) {
      console.error('Failed to fetch investments:', err)
      toast.error('Failed to load investments')
    } finally {
      setLoading(false)
    }
  }, [filters, dateRange, customStart, customEnd, page])

  useEffect(() => {
    fetchInvestors()
  }, [fetchInvestors])

  useEffect(() => {
    fetchInvestments()
  }, [fetchInvestments])

  const handlePresetChange = (value: string) => {
    const preset = getDateRangePresets().find(p => p.label === value)
    if (preset) {
      setDateRange(preset)
      setCustomStart('')
      setCustomEnd('')
      setFilters(f => ({ ...f, startDate: '', endDate: '' }))
      setPage(1)
    }
  }

  const handleFilterChange = (key: string, value: string) => {
    setFilters(f => ({ ...f, [key]: value }))
    setPage(1)
  }

  const openAddDialog = () => {
    setEditingInvestment(null)
    form.reset({
      investor_id: investors[0]?.id || '',
      amount: '',
      invested_at: new Date().toISOString().slice(0, 16),
      payment_method: INVESTMENT_PAYMENT_METHODS[0],
      reference_no: '',
      notes: '',
    })
    setDialogOpen(true)
  }

  const openEditDialog = (investment: typeof investments[0]) => {
    setEditingInvestment(investment)
    const d = new Date(investment.invested_at)
    const offset = d.getTimezoneOffset() * 60000
    const local = new Date(d.getTime() - offset)
    form.setValues({
      investor_id: investment.investor_id,
      amount: investment.amount.toString(),
      invested_at: local.toISOString().slice(0, 16),
      payment_method: investment.payment_method || INVESTMENT_PAYMENT_METHODS[0],
      reference_no: investment.reference_no || '',
      notes: investment.notes || '',
    })
    setDialogOpen(true)
  }

  const handleSubmit = async (data: InvestmentFormData) => {
    setDialogLoading(true)
    const supabase = createClient()

    try {
      let result
      if (editingInvestment) {
        result = await supabase.functions.invoke('update-investment', {
          body: { id: editingInvestment.id, ...data },
        })
      } else {
        result = await supabase.functions.invoke('create-investment', {
          body: data,
        })
      }

      if (result.error) throw result.error
      toast.success(editingInvestment ? 'Investment updated' : 'Investment created')
      setDialogOpen(false)
      fetchInvestments()
    } catch (err: any) {
      toast.error(err.message || 'Failed to save investment')
    } finally {
      setDialogLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this investment?')) return
    const supabase = createClient()
    try {
      const { error } = await supabase.functions.invoke('delete-investment', { body: { id } })
      if (error) throw error
      toast.success('Investment deleted')
      fetchInvestments()
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete investment')
    }
  }

  const handleExport = () => {
    const csv = toCSV(investments, [
      { key: 'invested_at', label: 'Date & Time' },
      { key: 'investors.full_name', label: 'Investor' },
      { key: 'amount', label: 'Amount' },
      { key: 'payment_method', label: 'Payment Method' },
      { key: 'reference_no', label: 'Reference No' },
      { key: 'notes', label: 'Notes' },
      { key: 'profiles.full_name', label: 'Added By' },
    ])
    downloadCSV(csv, generateFilename('investments'))
  }

  const filteredTotal = investments.reduce((sum, i) => sum + Number(i.amount), 0)
  const totalInvested = investments.reduce((sum, i) => sum + Number(i.amount), 0)
  const uniqueInvestors = new Set(investments.map(i => i.investor_id)).size

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Investments</h1>
            <p className="text-muted-foreground">Track all investment contributions</p>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map(i => (
            <Card key={i}><CardContent className="pt-6"><div className="h-8 w-3/4 animate-pulse bg-muted" /><div className="mt-4 h-12 w-1/2 animate-pulse bg-muted" /></CardContent></Card>
          ))}
        </div>
        <Card><CardContent className="pt-6"><div className="h-64 animate-pulse bg-muted" /></CardContent></Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Investments</h1>
          <p className="text-muted-foreground">Track all investment contributions</p>
        </div>
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 w-full lg:w-auto">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Label htmlFor="date-range" className="text-sm font-medium">Date Range:</Label>
            <Select value={dateRange.label} onValueChange={handlePresetChange}>
              <SelectTrigger id="date-range" className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {getDateRangePresets().map(p => (
                  <SelectItem key={p.label} value={p.label}>{p.label}</SelectItem>
                ))}
                <SelectItem value="Custom">Custom</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {dateRange.label === 'Custom' && (
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Input type="datetime-local" value={customStart} onChange={e => setCustomStart(e.target.value)} className="w-[180px]" placeholder="Start" />
              <span className="text-muted-foreground">to</span>
              <Input type="datetime-local" value={customEnd} onChange={e => setCustomEnd(e.target.value)} className="w-[180px]" placeholder="End" />
              <Button variant="outline" size="sm" onClick={() => { setFilters(f => ({ ...f, startDate: customStart, endDate: customEnd })); setPage(1); }}>
                <Search className="mr-2 h-4 w-4" /> Apply
              </Button>
            </div>
          )}
          {isManager && (
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button><Plus className="mr-2 h-4 w-4" />Add Investment</Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[500px]">
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                    <DialogHeader>
                      <DialogTitle>{editingInvestment ? 'Edit Investment' : 'Add Investment'}</DialogTitle>
                    </DialogHeader>
                    <FormField
                      control={form.control}
                      name="investor_id"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Investor</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger><SelectValue placeholder="Select investor" /></SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {investors.map(inv => <SelectItem key={inv.id} value={inv.id}>{inv.full_name}</SelectItem>)}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="amount"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Amount (₹)</FormLabel>
                          <FormControl>
                            <Input type="number" step="0.01" min="0.01" placeholder="0.00" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="invested_at"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Date & Time</FormLabel>
                          <FormControl>
                            <Input type="datetime-local" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="payment_method"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Payment Method</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger><SelectValue placeholder="Select method" /></SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {INVESTMENT_PAYMENT_METHODS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="reference_no"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Reference No (optional)</FormLabel>
                          <FormControl><Input placeholder="Transaction / Cheque #" {...field} /></FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="notes"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Notes (optional)</FormLabel>
                          <FormControl><Input placeholder="Additional details..." {...field} /></FormControl>
                        </FormItem>
                      )}
                    />
                    <DialogFooter className="gap-2">
                      <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                      <Button type="submit" disabled={dialogLoading}>
                        {dialogLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Save'}
                      </Button>
                    </DialogFooter>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          )}
          <Button variant="outline" onClick={handleExport} disabled={investments.length === 0}>
            <Download className="mr-2 h-4 w-4" />Export CSV
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Invested</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalInvested)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Unique Investors</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{uniqueInvestors}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Contributions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{investments.length}</div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="list" className="space-y-4">
        <TabsList>
          <TabsTrigger value="list">All Contributions</TabsTrigger>
          <TabsTrigger value="investors" asChild>
            <Link href="/investments/investors">
              <span className="flex items-center gap-2">Investors <span className="text-muted-foreground">({investors.length})</span></span>
            </Link>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="list">
          <Card>
            <CardHeader className="pb-2">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <CardTitle>Contributions</CardTitle>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="filter-search" className="text-sm font-medium">Search:</Label>
                    <Input id="filter-search" placeholder="Investor, ref, notes..." value={filters.search} onChange={e => handleFilterChange('search', e.target.value)} className="w-[200px]" />
                  </div>
                  <Select value={filters.investorId} onValueChange={v => handleFilterChange('investorId', v)}>
                    <SelectTrigger className="w-[180px]"><SelectValue placeholder="All Investors" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">All Investors</SelectItem>
                      {investors.map(inv => <SelectItem key={inv.id} value={inv.id}>{inv.full_name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={filters.paymentMethod} onValueChange={v => handleFilterChange('paymentMethod', v)}>
                    <SelectTrigger className="w-[160px]"><SelectValue placeholder="All Methods" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">All Methods</SelectItem>
                      {INVESTMENT_PAYMENT_METHODS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Input type="number" placeholder="Min Amount" value={filters.minAmount} onChange={e => handleFilterChange('minAmount', e.target.value)} className="w-[120px]" step="0.01" />
                  <Input type="number" placeholder="Max Amount" value={filters.maxAmount} onChange={e => handleFilterChange('maxAmount', e.target.value)} className="w-[120px]" step="0.01" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date & Time</TableHead>
                      <TableHead>Investor</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Payment Method</TableHead>
                      <TableHead>Reference No</TableHead>
                      <TableHead>Notes</TableHead>
                      <TableHead>Added By</TableHead>
                      {isManager && <TableHead className="w-24">Actions</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {investments.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={isManager ? 8 : 7} className="text-center py-8 text-muted-foreground">No investments found</TableCell>
                      </TableRow>
                    ) : (
                      investments.map(investment => (
                        <TableRow key={investment.id}>
                          <TableCell>{formatDateTime(investment.invested_at)}</TableCell>
                          <TableCell className="font-medium">{investment.investors?.full_name || '-'}</TableCell>
                          <TableCell className="text-right font-medium text-blue-600 dark:text-blue-400">{formatCurrency(investment.amount)}</TableCell>
                          <TableCell>{investment.payment_method || '-'}</TableCell>
                          <TableCell>{investment.reference_no || '-'}</TableCell>
                          <TableCell className="text-muted-foreground max-w-[200px] truncate">{investment.notes || '-'}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{investment.profiles?.full_name || '-'}</TableCell>
                          {isManager && (
                            <TableCell>
                              <div className="flex items-center gap-1 justify-end">
                                <Button variant="ghost" size="icon" onClick={() => openEditDialog(investment)}><Edit className="h-4 w-4" /></Button>
                                <Button variant="ghost" size="icon" onClick={() => handleDelete(investment.id)} className="text-destructive hover:text-destructive"><Trash2 className="h-4 w-4" /></Button>
                              </div>
                            </TableCell>
                          )}
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                  <TableFooter>
                    <TableRow>
                      <TableCell colSpan={2} className="font-medium text-right">Filtered Total:</TableCell>
                      <TableCell className="font-bold text-blue-600 dark:text-blue-400">{formatCurrency(filteredTotal)}</TableCell>
                      <TableCell colSpan={isManager ? 4 : 3} />
                    </TableRow>
                  </TableFooter>
                </Table>
              </div>
              {totalCount > pageSize && (
                <Pagination
                  total={Math.ceil(totalCount / pageSize)}
                  page={page}
                  onPageChange={setPage}
                  className="mt-4"
                  showControls
                  showPageNumbers
                  siblingCount={1}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="investors">
          <p className="text-center text-muted-foreground py-8">Navigate to the Investors tab to manage investor profiles.</p>
        </TabsContent>
      </Tabs>
    </div>
  )
}