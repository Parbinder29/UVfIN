// @ts-nocheck
'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatDate, formatDateTime } from '@/lib/format'
import { toCSV, downloadCSV, generateFilename } from '@/lib/csv'
import {
  Card, CardContent, CardHeader, CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { PaginationWrapper } from '@/components/ui/pagination-wrapper'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Loader2, Download, Search, Eye, ChevronDown } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface AuditLogClientProps {
  user: { id: string; email: string }
  profile: { full_name: string; role: 'finance_manager' | 'director' }
}

interface AuditLogEntry {
  id: number
  table_name: string
  record_id: string | null
  action: string
  old_data: Record<string, unknown> | null
  new_data: Record<string, unknown> | null
  changed_by: string | null
  changed_at: string
  profiles: { full_name: string } | null
}

interface FunctionResponse<T> {
  data: T | null
  error: { message: string } | null
  count?: number
}

const ACTION_COLORS: Record<string, string> = {
  INSERT: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  UPDATE: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  SOFT_DELETE: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
}

const TABLE_LABELS: Record<string, string> = {
  expenses: 'Money Spent',
  earnings: 'Earnings',
  investors: 'Investors',
  investments: 'Investments',
}

export function AuditLogClient({ profile }: AuditLogClientProps) {
  const [logs, setLogs] = useState<AuditLogEntry[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const pageSize = 25

  const [filters, setFilters] = useState({
    tableName: '',
    action: '',
    changedBy: '',
    startDate: '',
    endDate: '',
  })

  const [expandedId, setExpandedId] = useState<number | null>(null)

  const fetchLogs = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    try {
      const response = await supabase.functions.invoke('get-audit-log', {
        body: {
          tableName: filters.tableName || undefined,
          action: filters.action || undefined,
          changedBy: filters.changedBy || undefined,
          startDate: filters.startDate || undefined,
          endDate: filters.endDate || undefined,
          page,
          pageSize,
        },
      })

      if (response.error) throw response.error
      const result = response.data as FunctionResponse<AuditLogEntry[]> | null
      setLogs(result?.data || [])
      setTotalCount(result?.count || 0)
    } catch (err) {
      console.error('Failed to fetch audit log:', err)
      toast.error('Failed to load audit log')
    } finally {
      setLoading(false)
    }
  }, [filters, page])

  // eslint-disable-next-line react-hooks/exhaustive-deps, react-hooks/set-state-in-effect
  useEffect(() => {
    fetchLogs()
  }, [fetchLogs])

  const handleFilterChange = (key: string, value: string) => {
    setFilters(f => ({ ...f, [key]: value }))
    setPage(1)
  }

  const handleExport = () => {
    const csv = toCSV(logs as unknown as Record<string, unknown>[], [
      { key: 'changed_at', label: 'When' },
      { key: 'profiles.full_name', label: 'Who' },
      { key: 'table_name', label: 'Section' },
      { key: 'action', label: 'Action' },
      { key: 'record_id', label: 'Record ID' },
    ])
    downloadCSV(csv, generateFilename('audit-log'))
  }

  const formatJson = (data: Record<string, unknown> | null) => {
    if (!data) return '-'
    return Object.entries(data)
      .filter(([key]) => !['id', 'created_at', 'updated_at', 'created_by'].includes(key))
      .map(([key, value]) => `${key}: ${value}`)
      .join(', ')
  }

  const getDiff = (oldData: Record<string, unknown> | null, newData: Record<string, unknown> | null): Array<{ field: string; old: unknown; new: unknown; changed: boolean }> => {
    if (!oldData && !newData) return []
    const keys = new Set([...Object.keys(oldData || {}), ...Object.keys(newData || {})])
    return Array.from(keys)
      .filter(k => !['id', 'created_at', 'updated_at', 'created_by'].includes(k))
      .map(key => ({
        field: key,
        old: oldData?.[key] ?? '-',
        new: newData?.[key] ?? '-',
        changed: oldData?.[key] !== newData?.[key],
      }))
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Audit Log</h1>
            <p className="text-muted-foreground">View all changes to financial data</p>
          </div>
        </div>
        <Card><CardContent className="pt-6"><div className="h-64 animate-pulse bg-muted" /></CardContent></Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Audit Log</h1>
          <p className="text-muted-foreground">View all changes to financial data</p>
        </div>
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 w-full lg:w-auto">
          <Button variant="outline" onClick={handleExport} disabled={logs.length === 0}>
            <Download className="mr-2 h-4 w-4" />Export CSV
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <CardTitle>Change History</CardTitle>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-2">
                <Label htmlFor="filter-table" className="text-sm font-medium">Section:</Label>
                <Select value={filters.tableName} onValueChange={v => handleFilterChange('tableName', v)}>
                  <SelectTrigger id="filter-table" className="w-[160px]"><SelectValue placeholder="All Sections" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All Sections</SelectItem>
                    <SelectItem value="expenses">Money Spent</SelectItem>
                    <SelectItem value="earnings">Earnings</SelectItem>
                    <SelectItem value="investors">Investors</SelectItem>
                    <SelectItem value="investments">Investments</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Select value={filters.action} onValueChange={v => handleFilterChange('action', v)}>
                <SelectTrigger className="w-[160px]"><SelectValue placeholder="All Actions" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Actions</SelectItem>
                  <SelectItem value="INSERT">Created</SelectItem>
                  <SelectItem value="UPDATE">Updated</SelectItem>
                  <SelectItem value="SOFT_DELETE">Deleted</SelectItem>
                </SelectContent>
              </Select>
              <Input type="date" placeholder="From" value={filters.startDate} onChange={e => handleFilterChange('startDate', e.target.value)} className="w-[140px]" />
              <span className="text-muted-foreground">to</span>
              <Input type="date" placeholder="To" value={filters.endDate} onChange={e => handleFilterChange('endDate', e.target.value)} className="w-[140px]" />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Who</TableHead>
                  <TableHead>Section</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Record ID</TableHead>
                  <TableHead>Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No audit entries found</TableCell>
                  </TableRow>
                ) : (
                  logs.map(log => (
                    <TableRow key={log.id}>
                      <TableCell className="text-sm whitespace-nowrap">{formatDateTime(log.changed_at)}</TableCell>
                      <TableCell className="text-sm">{log.profiles?.full_name || 'System'}</TableCell>
                      <TableCell>
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                          {TABLE_LABELS[log.table_name] || log.table_name}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className={cn(
                          'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium',
                          ACTION_COLORS[log.action] || 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'
                        )}>
                          {log.action}
                        </span>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{log.record_id?.slice(0, 8) || '-'}</TableCell>
                      <TableCell>
                        <Collapsible open={expandedId === log.id} onOpenChange={open => setExpandedId(open ? log.id : null)}>
                          // @ts-ignore
                          <CollapsibleTrigger className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground cursor-pointer p-1">
                            <Eye className="h-3.5 w-3.5" />
                            <span>View changes</span>
                            <ChevronDown className="h-3.5 w-3.5" />
                          </CollapsibleTrigger>
                          // @ts-ignore
                          <CollapsibleContent className="mt-2 p-3 bg-muted/50 rounded border text-sm">
                            {log.action === 'INSERT' ? (
                              <div>
                                <p className="font-medium mb-2">New Record:</p>
                                <pre className="whitespace-pre-wrap font-mono text-xs">{JSON.stringify(log.new_data, null, 2)}</pre>
                              </div>
                            ) : log.action === 'SOFT_DELETE' ? (
                              <div>
                                <p className="font-medium mb-2">Deleted Record:</p>
                                <pre className="whitespace-pre-wrap font-mono text-xs">{JSON.stringify(log.old_data, null, 2)}</pre>
                              </div>
                            ) : (
                              <div>
                                <p className="font-medium mb-2">Changes:</p>
                                <div className="space-y-1 max-h-64 overflow-y-auto">
                                  {getDiff(log.old_data, log.new_data).map((diff, i) => (
                                    <div key={i} className={cn(
                                      'flex items-start gap-2 p-2 rounded text-xs font-mono',
                                      diff.changed ? 'bg-yellow-50 dark:bg-yellow-900/30' : 'bg-transparent'
                                    )}>
                                      <span className="font-medium min-w-[120px]">{diff.field}:</span>
                                      <span className="text-red-600 dark:text-red-400 line-through">- {diff.old}</span>
                                      <span className="text-green-600 dark:text-green-400">+ {diff.new}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </CollapsibleContent>
                        </Collapsible>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          {totalCount > pageSize && (
            <PaginationWrapper
              totalPages={Math.ceil(totalCount / pageSize)}
              currentPage={page}
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