'use client'

import { Loader2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useUpdateParams } from '@/components/tables/useUpdateParams'
import { DATE_PRESETS, PRESET_LABELS } from '@/lib/dates'

export function RangePicker({ preset, from, to }: { preset: string; from: string | null; to: string | null }) {
  const { update, pending } = useUpdateParams()
  return (
    <div className="flex flex-wrap items-end gap-2">
      {pending && <Loader2 className="mb-2.5 size-4 animate-spin text-muted-foreground" aria-label="Loading" />}
      <div className="grid gap-1.5">
        <Label htmlFor="d-range" className="text-xs text-muted-foreground">
          Date range
        </Label>
        <Select value={preset} onValueChange={(v) => update({ range: v, from: null, to: null })}>
          <SelectTrigger id="d-range" className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {DATE_PRESETS.map((p) => (
              <SelectItem key={p} value={p}>
                {PRESET_LABELS[p]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {preset === 'custom' && (
        <>
          <div className="grid gap-1.5">
            <Label htmlFor="d-from" className="text-xs text-muted-foreground">From</Label>
            <Input id="d-from" type="date" className="w-40" defaultValue={from ?? ''} onChange={(e) => update({ from: e.target.value || null })} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="d-to" className="text-xs text-muted-foreground">To</Label>
            <Input id="d-to" type="date" className="w-40" defaultValue={to ?? ''} onChange={(e) => update({ to: e.target.value || null })} />
          </div>
        </>
      )}
    </div>
  )
}
