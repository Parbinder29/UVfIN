'use client'

import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useUpdateParams } from '@/components/tables/useUpdateParams'
import { ACTION_LABELS, SECTION_LABELS } from '@/lib/constants'

const ALL = '__all__'

export function AuditFilters({ users }: { users: { id: string; name: string }[] }) {
  const { update, searchParams } = useUpdateParams()
  const get = (k: string) => searchParams.get(k) ?? ''
  const select = (id: string, label: string, key: string, options: [string, string][], allLabel: string) => (
    <div className="grid gap-1.5">
      <Label htmlFor={id} className="text-xs text-muted-foreground">{label}</Label>
      <Select value={get(key) || ALL} onValueChange={(v) => update({ [key]: v === ALL ? null : v })}>
        <SelectTrigger id={id} className="w-full sm:w-40"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>{allLabel}</SelectItem>
          {options.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  )
  const hasFilters = ['section', 'action', 'user', 'from', 'to'].some((k) => searchParams.has(k))
  return (
    <div className="flex flex-wrap items-end gap-3 rounded-lg border bg-card p-3">
      {select('a-section', 'Section', 'section', Object.entries(SECTION_LABELS), 'All sections')}
      {select('a-action', 'Action', 'action', Object.entries(ACTION_LABELS), 'All actions')}
      {select('a-user', 'User', 'user', users.map((u) => [u.id, u.name]), 'All users')}
      <div className="grid gap-1.5">
        <Label htmlFor="a-from" className="text-xs text-muted-foreground">From</Label>
        <Input id="a-from" type="date" className="w-40" defaultValue={get('from')} onChange={(e) => update({ from: e.target.value || null })} />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="a-to" className="text-xs text-muted-foreground">To</Label>
        <Input id="a-to" type="date" className="w-40" defaultValue={get('to')} onChange={(e) => update({ to: e.target.value || null })} />
      </div>
      {hasFilters && (
        <Button variant="ghost" onClick={() => update({ section: null, action: null, user: null, from: null, to: null })}>
          <X />
          Clear
        </Button>
      )}
    </div>
  )
}
