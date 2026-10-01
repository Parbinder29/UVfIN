'use client'

import { Fragment, useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ACTION_LABELS, SECTION_LABELS } from '@/lib/constants'
import { formatCurrency, formatDate, formatDateTime } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { AuditEntry } from '@/types'

const HIDDEN = new Set(['id', 'created_at', 'updated_at', 'created_by'])
const FIELD_LABELS: Record<string, string> = {
  expense_date: 'Date',
  earning_date: 'Date',
  invested_at: 'Date & time',
  amount: 'Amount',
  category: 'Category',
  source: 'Source',
  payee: 'Payee',
  client_name: 'Client',
  description: 'Description',
  payment_method: 'Payment method',
  reference_no: 'Reference no',
  attachment_path: 'Attachment',
  is_deleted: 'Deleted',
  is_active: 'Active',
  full_name: 'Name',
  email: 'Email',
  phone: 'Phone',
  notes: 'Notes',
  investor_id: 'Investor',
}

const show = (v: unknown) => (v === null || v === undefined || v === '' ? '—' : typeof v === 'object' ? JSON.stringify(v) : String(v))

function actionBadge(entry: AuditEntry) {
  const label =
    entry.table_name === 'investors' && entry.action === 'SOFT_DELETE' ? 'Deactivated' : (ACTION_LABELS[entry.action] ?? entry.action)
  const cls =
    entry.action === 'INSERT'
      ? 'bg-accent text-accent-foreground'
      : entry.action === 'SOFT_DELETE'
        ? 'bg-destructive/15 text-destructive'
        : 'bg-secondary text-secondary-foreground'
  return <Badge className={cls}>{label}</Badge>
}

function Changes({ entry, investorNames }: { entry: AuditEntry; investorNames: Record<string, string> }) {
  const oldD = entry.old_data ?? {}
  const newD = entry.new_data ?? {}
  const keys = Array.from(new Set([...Object.keys(oldD), ...Object.keys(newD)])).filter((k) => !HIDDEN.has(k))
  const changed = entry.action === 'INSERT' ? keys.filter((k) => newD[k] !== null && newD[k] !== '' && k !== 'is_deleted') : keys.filter((k) => JSON.stringify(oldD[k]) !== JSON.stringify(newD[k]))
  const fmt = (k: string, v: unknown) => {
    if (v === null || v === undefined || v === '') return '—'
    if (k === 'investor_id' && typeof v === 'string') return investorNames[v] ?? v
    if (k === 'amount') return formatCurrency(Number(v))
    if (k === 'invested_at') return formatDateTime(String(v))
    if (k === 'expense_date' || k === 'earning_date') return formatDate(String(v))
    if (k === 'attachment_path') return 'File attached'
    if (typeof v === 'boolean') return v ? 'Yes' : 'No'
    return show(v)
  }
  if (!changed.length) return <p className="text-sm text-muted-foreground">No visible field changed.</p>
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left text-xs text-muted-foreground">
          <th className="py-1 pr-4 font-medium">Field</th>
          {entry.action !== 'INSERT' && <th className="py-1 pr-4 font-medium">Before</th>}
          <th className="py-1 font-medium">{entry.action === 'INSERT' ? 'Value' : 'After'}</th>
        </tr>
      </thead>
      <tbody>
        {changed.map((k) => (
          <tr key={k} className="align-top">
            <td className="py-1 pr-4 font-medium whitespace-nowrap">{FIELD_LABELS[k] ?? k}</td>
            {entry.action !== 'INSERT' && <td className="py-1 pr-4 break-all text-destructive line-through decoration-1">{fmt(k, oldD[k])}</td>}
            <td className="py-1 break-all">{fmt(k, newD[k])}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export function AuditTable({ rows, names, investorNames }: { rows: AuditEntry[]; names: Record<string, string>; investorNames: Record<string, string> }) {
  const [open, setOpen] = useState<Set<number>>(new Set())
  const toggle = (id: number) =>
    setOpen((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-10"><span className="sr-only">Expand</span></TableHead>
          <TableHead>When</TableHead>
          <TableHead>Who</TableHead>
          <TableHead>Section</TableHead>
          <TableHead>Action</TableHead>
          <TableHead>Record</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((e) => {
          const isOpen = open.has(e.id)
          const d = (e.new_data ?? e.old_data ?? {}) as Record<string, unknown>
          const summary = show(d.payee ?? d.client_name ?? d.full_name ?? (d.investor_id ? investorNames[String(d.investor_id)] : null) ?? d.category ?? d.source)
          return (
            <Fragment key={e.id}>
              <TableRow className={cn(isOpen && 'border-b-0 bg-muted/40')}>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => toggle(e.id)}
                    aria-expanded={isOpen}
                    aria-controls={`audit-${e.id}`}
                    aria-label={isOpen ? 'Hide changes' : 'View changes'}
                  >
                    {isOpen ? <ChevronDown /> : <ChevronRight />}
                  </Button>
                </TableCell>
                <TableCell className="whitespace-nowrap">{formatDateTime(e.changed_at)}</TableCell>
                <TableCell className="whitespace-nowrap">{e.changed_by ? (names[e.changed_by] ?? 'Unknown user') : 'System'}</TableCell>
                <TableCell>{SECTION_LABELS[e.table_name] ?? e.table_name}</TableCell>
                <TableCell>{actionBadge(e)}</TableCell>
                <TableCell className="max-w-56 truncate text-muted-foreground">{summary}</TableCell>
              </TableRow>
              {isOpen && (
                <TableRow id={`audit-${e.id}`} className="bg-muted/40 hover:bg-muted/40">
                  <TableCell />
                  <TableCell colSpan={5} className="whitespace-normal">
                    <Changes entry={e} investorNames={investorNames} />
                  </TableCell>
                </TableRow>
              )}
            </Fragment>
          )
        })}
      </TableBody>
    </Table>
  )
}
