'use client'

import { useState } from 'react'
import { MoreHorizontal, Pencil, Plus, Trash2 } from 'lucide-react'
import { deleteLedgerEntry } from '@/actions/ledger'
import { ConfirmDelete } from '@/components/forms/ConfirmDelete'
import { LedgerFormDialog } from '@/components/forms/LedgerFormDialog'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { formatCurrency, formatDate } from '@/lib/format'
import { LEDGERS, type LedgerRow } from '@/lib/ledger'

type Key = 'expenses' | 'earnings'

export function AddLedgerButton({ ledger }: { ledger: Key }) {
  const [open, setOpen] = useState(false)
  const cfg = LEDGERS[ledger]
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus />
        Add {cfg.singular}
      </Button>
      <LedgerFormDialog cfg={cfg} open={open} onOpenChange={setOpen} />
    </>
  )
}

export function LedgerRowActions({ ledger, row }: { ledger: Key; row: LedgerRow }) {
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const cfg = LEDGERS[ledger]
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${row.party ?? cfg.singular} on ${formatDate(row.date)}`}>
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setEditOpen(true)}>
            <Pencil />
            Edit
          </DropdownMenuItem>
          <DropdownMenuItem variant="destructive" onSelect={() => setDeleteOpen(true)}>
            <Trash2 />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <LedgerFormDialog cfg={cfg} row={row} open={editOpen} onOpenChange={setEditOpen} />
      <ConfirmDelete
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={`Delete this ${cfg.singular.toLowerCase()}?`}
        description={`${formatCurrency(row.amount)} on ${formatDate(row.date)}${row.party ? ` (${row.party})` : ''} will be removed from lists and totals. It stays in the database and the audit log.`}
        successMessage={`${cfg.singular} deleted`}
        onConfirm={() => deleteLedgerEntry(ledger, row.id)}
      />
    </>
  )
}
