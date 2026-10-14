'use client'

import { createContext, useContext, useState } from 'react'
import { Trash2, X } from 'lucide-react'
import { deleteLedgerEntries } from '@/actions/ledger'
import { ConfirmDelete } from '@/components/forms/ConfirmDelete'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { formatCurrency } from '@/lib/format'
import { LEDGERS } from '@/lib/ledger'

type Key = 'expenses' | 'earnings'

interface Selection {
  ledger: Key
  rows: { id: string; amount: number }[]
  selected: Set<string>
  toggle: (id: string, on: boolean) => void
  setAll: (on: boolean) => void
  clear: () => void
}

const SelectionContext = createContext<Selection | null>(null)

function useSelection() {
  const ctx = useContext(SelectionContext)
  if (!ctx) throw new Error('Ledger selection controls must be inside <LedgerSelection>.')
  return ctx
}

/**
 * Lets a finance manager tick rows on the current page and delete them
 * together. Wrap it in key={row ids} so the selection resets when the page,
 * filters or sort change.
 */
export function LedgerSelection({
  ledger,
  rows,
  children,
}: {
  ledger: Key
  rows: { id: string; amount: number }[]
  children: React.ReactNode
}) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set())
  const value: Selection = {
    ledger,
    rows,
    selected,
    toggle: (id, on) =>
      setSelected((prev) => {
        const next = new Set(prev)
        if (on) next.add(id)
        else next.delete(id)
        return next
      }),
    setAll: (on) => setSelected(on ? new Set(rows.map((r) => r.id)) : new Set()),
    clear: () => setSelected(new Set()),
  }
  return <SelectionContext.Provider value={value}>{children}</SelectionContext.Provider>
}

export function SelectAllCheckbox() {
  const { rows, selected, setAll } = useSelection()
  const all = rows.length > 0 && selected.size === rows.length
  return (
    <Checkbox
      aria-label="Select all rows on this page"
      checked={all ? true : selected.size > 0 ? 'indeterminate' : false}
      onCheckedChange={() => setAll(!all)}
    />
  )
}

export function RowCheckbox({ id, label }: { id: string; label: string }) {
  const { selected, toggle } = useSelection()
  return <Checkbox aria-label={`Select ${label}`} checked={selected.has(id)} onCheckedChange={(c) => toggle(id, c === true)} />
}

/** Shown above the table while rows are ticked. */
export function SelectionBar() {
  const { ledger, rows, selected, clear } = useSelection()
  const [confirmOpen, setConfirmOpen] = useState(false)
  if (selected.size === 0) return null

  const cfg = LEDGERS[ledger]
  const n = selected.size
  const noun = n === 1 ? cfg.singular.toLowerCase() : `${cfg.singular.toLowerCase()} entries`
  const total = rows.filter((r) => selected.has(r.id)).reduce((s, r) => s + r.amount, 0)

  return (
    <div
      role="region"
      aria-label="Selected rows"
      className="flex flex-wrap items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-sm"
    >
      <span>
        <strong>{n}</strong> selected · <span className="tabular-nums">{formatCurrency(total)}</span>
      </span>
      <div className="ml-auto flex gap-2">
        <Button variant="ghost" size="sm" onClick={clear}>
          <X />
          Clear
        </Button>
        <Button variant="destructive" size="sm" onClick={() => setConfirmOpen(true)}>
          <Trash2 />
          Delete {n}
        </Button>
      </div>
      <ConfirmDelete
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={`Delete ${n} ${noun}?`}
        description={`${n} ${n === 1 ? 'entry' : 'entries'} totalling ${formatCurrency(total)} will be removed from lists and totals. They stay in the database and the audit log.`}
        confirmLabel={`Delete ${n}`}
        successMessage={`${n} ${n === 1 ? 'entry' : 'entries'} deleted`}
        // The refreshed page has different row ids, which resets the selection.
        onConfirm={() => deleteLedgerEntries(ledger, [...selected])}
      />
    </div>
  )
}
