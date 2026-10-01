'use client'

import { useState } from 'react'
import { MoreHorizontal, Pencil, Plus, Trash2, UserPlus } from 'lucide-react'
import { deleteInvestment } from '@/actions/investments'
import { setInvestorActive } from '@/actions/investors'
import { ConfirmDelete } from '@/components/forms/ConfirmDelete'
import { InvestmentFormDialog } from '@/components/forms/InvestmentFormDialog'
import { InvestorFormDialog } from '@/components/forms/InvestorFormDialog'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { formatCurrency, formatDateTime } from '@/lib/format'
import type { Investment, InvestorSummary } from '@/types'

type InvestorChoice = { id: string; full_name: string; is_active: boolean }

export function AddInvestmentButton({ investors, defaultInvestorId }: { investors: InvestorChoice[]; defaultInvestorId?: string }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus />
        Add Investment
      </Button>
      <InvestmentFormDialog investors={investors} defaultInvestorId={defaultInvestorId} open={open} onOpenChange={setOpen} />
    </>
  )
}

export function InvestmentRowActions({ investment, investors, investorName }: { investment: Investment; investors: InvestorChoice[]; investorName: string }) {
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${investorName} on ${formatDateTime(investment.invested_at)}`}>
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
      <InvestmentFormDialog investors={investors} investment={investment} open={editOpen} onOpenChange={setEditOpen} />
      <ConfirmDelete
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete this investment?"
        description={`${formatCurrency(investment.amount)} from ${investorName} on ${formatDateTime(investment.invested_at)} will be removed from lists and totals. It stays in the database and the audit log.`}
        successMessage="Investment deleted"
        onConfirm={() => deleteInvestment(investment.id)}
      />
    </>
  )
}

export function AddInvestorButton() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <UserPlus />
        Add Investor
      </Button>
      <InvestorFormDialog open={open} onOpenChange={setOpen} />
    </>
  )
}

type InvestorFields = Pick<InvestorSummary, 'id' | 'full_name' | 'email' | 'phone' | 'notes' | 'is_active'>

export function InvestorRowActions({ investor }: { investor: InvestorFields }) {
  const [editOpen, setEditOpen] = useState(false)
  const [toggleOpen, setToggleOpen] = useState(false)
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${investor.full_name}`}>
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setEditOpen(true)}>
            <Pencil />
            Edit
          </DropdownMenuItem>
          <DropdownMenuItem variant={investor.is_active ? 'destructive' : 'default'} onSelect={() => setToggleOpen(true)}>
            {investor.is_active ? 'Deactivate' : 'Reactivate'}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <InvestorFormDialog investor={investor} open={editOpen} onOpenChange={setEditOpen} />
      <ConfirmDelete
        open={toggleOpen}
        onOpenChange={setToggleOpen}
        title={investor.is_active ? `Deactivate ${investor.full_name}?` : `Reactivate ${investor.full_name}?`}
        description={
          investor.is_active
            ? 'They stay in the list with their history and totals, but no new contributions can be recorded for them.'
            : 'They will be able to receive new contributions again.'
        }
        confirmLabel={investor.is_active ? 'Deactivate' : 'Reactivate'}
        destructive={investor.is_active}
        successMessage={investor.is_active ? 'Investor deactivated' : 'Investor reactivated'}
        onConfirm={() => setInvestorActive(investor.id, !investor.is_active)}
      />
    </>
  )
}
