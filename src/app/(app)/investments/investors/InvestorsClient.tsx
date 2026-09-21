// @ts-nocheck
'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, formatDate } from '@/lib/format'
import { toCSV, downloadCSV, generateFilename } from '@/lib/csv'
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
import { Loader2, Plus, Edit, Trash2, Download, Search, UserPlus, Users } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { investorSchema, type InvestorFormData } from '@/lib/validators'
import { toast } from 'sonner'
import Link from 'next/link'

interface InvestorsClientProps {
  user: { id: string; email: string }
  profile: { full_name: string; role: 'finance_manager' | 'director' }
}

export function InvestorsClient({ profile }: InvestorsClientProps) {
  const isManager = profile.role === 'finance_manager'
  const [investors, setInvestors] = useState<Array<{
    id: string
    full_name: string
    email: string | null
    phone: string | null
    notes: string | null
    is_active: boolean
    created_by: string
    profiles: { full_name: string } | null
    created_at: string
    total_invested: number
    contribution_count: number
  }>>([])
  const [totalCount, setTotalCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const pageSize = 25

  const [filters, setFilters] = useState({
    isActive: '',
    search: '',
  })

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingInvestor, setEditingInvestor] = useState<typeof investors[0] | null>(null)
  const [dialogLoading, setDialogLoading] = useState(false)

  const form = useForm<InvestorFormData>({
    resolver: zodResolver(investorSchema),
    defaultValues: {
      full_name: '',
      email: '',
      phone: '',
      notes: '',
      is_active: true,
    },
  })

  const fetchInvestors = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    try {
      const { data, count, error } = await supabase.functions.invoke('get-investors', {
        body: {
          isActive: filters.isActive === '' ? undefined : filters.isActive === 'true',
          search: filters.search || undefined,
          page,
          pageSize,
        },
      })

      if (error) throw error
      setInvestors(data || [])
      setTotalCount(count || 0)
    } catch (err) {
      console.error('Failed to fetch investors:', err)
      toast.error('Failed to load investors')
    } finally {
      setLoading(false)
    }
  }, [filters, page])

  useEffect(() => {
    fetchInvestors()
  }, [fetchInvestors])

  const handleFilterChange = (key: string, value: string) => {
    setFilters(f => ({ ...f, [key]: value }))
    setPage(1)
  }

  const openAddDialog = () => {
    setEditingInvestor(null)
    form.reset({
      full_name: '',
      email: '',
      phone: '',
      notes: '',
      is_active: true,
    })
    setDialogOpen(true)
  }

  const openEditDialog = (investor: typeof investors[0]) => {
    setEditingInvestor(investor)
    form.setValues({
      full_name: investor.full_name,
      email: investor.email || '',
      phone: investor.phone || '',
      notes: investor.notes || '',
      is_active: investor.is_active,
    })
    setDialogOpen(true)
  }

  const handleSubmit = async (data: InvestorFormData) => {
    setDialogLoading(true)
    const supabase = createClient()

    try {
      let result
      if (editingInvestor) {
        result = await supabase.functions.invoke('update-investor', {
          body: { id: editingInvestor.id, ...data },
        })
      } else {
        result = await supabase.functions.invoke('create-investor', {
          body: data,
        })
      }

      if (result.error) throw result.error
      toast.success(editingInvestor ? 'Investor updated' : 'Investor created')
      setDialogOpen(false)
      fetchInvestors()
    } catch (err: any) {
      toast.error(err.message || 'Failed to save investor')
    } finally {
      setDialogLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Deactivate this investor? This will not delete their contributions.')) return
    const supabase = createClient()
    try {
      const { error } = await supabase.functions.invoke('delete-investor', { body: { id } })
      if (error) throw error
      toast.success('Investor deactivated')
      fetchInvestors()
    } catch (err: any) {
      toast.error(err.message || 'Failed to deactivate investor')
    }
  }

  const handleExport = () => {
    const csv = toCSV(investors, [
      { key: 'full_name', label: 'Name' },
      { key: 'email', label: 'Email' },
      { key: 'phone', label: 'Phone' },
      { key: 'is_active', label: 'Active' },
      { key: 'total_invested', label: 'Total Invested' },
      { key: 'contribution_count', label: 'Contributions' },
      { key: 'profiles.full_name', label: 'Added By' },
      { key: 'created_at', label: 'Created' },
    ])
    downloadCSV(csv, generateFilename('investors'))
  }

  const totalInvested = investors.reduce((sum, i) => sum + Number(i.total_invested), 0)
  const activeInvestors = investors.filter(i => i.is_active).length

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Investors</h1>
            <p className="text-muted-foreground">Manage investor profiles</p>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <Card><CardContent className="pt-6"><div className="h-8 w-3/4 animate-pulse bg-muted" /><div className="mt-4 h-12 w-1/2 animate-pulse bg-muted" /></CardContent></Card>
          <Card><CardContent className="pt-6"><div className="h-8 w-3/4 animate-pulse bg-muted" /><div className="mt-4 h-12 w-1/2 animate-pulse bg-muted" /></CardContent></Card>
          <Card><CardContent className="pt-6"><div className="h-8 w-3/4 animate-pulse bg-muted" /><div className="mt-4 h-12 w-1/2 animate-pulse bg-muted" /></CardContent></Card>
        </div>
        <Card><CardContent className="pt-6"><div className="h-64 animate-pulse bg-muted" /></CardContent></Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Investors</h1>
          <p className="text-muted-foreground">Manage investor profiles</p>
        </div>
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 w-full lg:w-auto">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Link href="/investments/investors/[id]" className="hidden">
              <Button variant="outline" asChild>
                <UserPlus className="mr-2 h-4 w-4" />Back to Investments
              </Button>
            </Link>
          </div>
          {isManager && (
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button><Plus className="mr-2 h-4 w-4" />Add Investor</Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[500px]">
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                    <DialogHeader>
                      <DialogTitle>{editingInvestor ? 'Edit Investor' : 'Add Investor'}</DialogTitle>
                    </DialogHeader>
                    <FormField
                      control={form.control}
                      name="full_name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Full Name</FormLabel>
                          <FormControl><Input placeholder="Investor name" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email (optional)</FormLabel>
                          <FormControl><Input type="email" placeholder="email@example.com" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="phone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Phone (optional)</FormLabel>
                          <FormControl><Input placeholder="+91 98765 43210" {...field} /></FormControl>
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
                    <FormField
                      control={form.control}
                      name="is_active"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Status</FormLabel>
                          <Select onValueChange={v => field.onChange(v === 'true')} defaultValue={field.value ? 'true' : 'false'}>
                            <FormControl>
                              <SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="true">Active</SelectItem>
                              <SelectItem value="false">Inactive</SelectItem>
                            </SelectContent>
                          </Select>
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
          <Button variant="outline" onClick={handleExport} disabled={investors.length === 0}>
            <Download className="mr-2 h-4 w-4" />Export CSV
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Invested</CardTitle>
            <Users className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalInvested)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Investors</CardTitle>
            <UserPlus className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeInvestors} / {investors.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Largest Contributor</CardTitle>
            <Users className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {investors.length > 0
                ? investors.reduce((max, i) => i.total_invested > max.total_invested ? i : max).full_name
                : '-'}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <CardTitle>Investors</CardTitle>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-2">
                <Label htmlFor="filter-search" className="text-sm font-medium">Search:</Label>
                <Input id="filter-search" placeholder="Name, email, phone..." value={filters.search} onChange={e => handleFilterChange('search', e.target.value)} className="w-[200px]" />
              </div>
              <Select value={filters.isActive} onValueChange={v => handleFilterChange('isActive', v)}>
                <SelectTrigger className="w-[160px]"><SelectValue placeholder="All Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Status</SelectItem>
                  <SelectItem value="true">Active</SelectItem>
                  <SelectItem value="false">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Total Invested</TableHead>
                  <TableHead className="text-right">Contributions</TableHead>
                  <TableHead>Added By</TableHead>
                  <TableHead>Created</TableHead>
                  {isManager && <TableHead className="w-24">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {investors.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={isManager ? 9 : 8} className="text-center py-8 text-muted-foreground">No investors found</TableCell>
                  </TableRow>
                ) : (
                  investors.map(investor => (
                    <TableRow key={investor.id}>
                      <TableCell className="font-medium">
                        <Link href={`/investments/investors/${investor.id}`} className="hover:underline">
                          {investor.full_name}
                        </Link>
                      </TableCell>
                      <TableCell>{investor.email || '-'}</TableCell>
                      <TableCell>{investor.phone || '-'}</TableCell>
                      <TableCell>
                        <span className={cn(
                          'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium',
                          investor.is_active
                            ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                            : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'
                        )}>
                          {investor.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-medium">{formatCurrency(investor.total_invested)}</TableCell>
                      <TableCell className="text-right">{investor.contribution_count}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{investor.profiles?.full_name || '-'}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{formatDate(investor.created_at)}</TableCell>
                      {isManager && (
                        <TableCell>
                          <div className="flex items-center gap-1 justify-end">
                            <Button variant="ghost" size="icon" onClick={() => openEditDialog(investor)}><Edit className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="icon" onClick={() => handleDelete(investor.id)} className="text-destructive hover:text-destructive"><Trash2 className="h-4 w-4" /></Button>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))
                )}
              </TableBody>
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
    </div>
  )
}

import { cn } from '@/lib/utils'