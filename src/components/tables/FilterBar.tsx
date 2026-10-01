'use client'

import { useState } from 'react'
import { Loader2, Search, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DATE_PRESETS, PRESET_LABELS } from '@/lib/dates'
import { useUpdateParams } from './useUpdateParams'

const ALL = '__all__'

interface Option {
  value: string
  label: string
}

export interface FilterBarProps {
  searchPlaceholder?: string
  kindLabel?: string
  kinds?: readonly string[]
  methods?: readonly string[]
  investors?: Option[]
  showAmount?: boolean
  defaultPreset?: string
}

function SelectFilter({
  id,
  label,
  value,
  options,
  onChange,
  allLabel,
}: {
  id: string
  label: string
  value: string
  options: Option[]
  onChange: (v: string | null) => void
  allLabel: string
}) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id} className="text-xs text-muted-foreground">
        {label}
      </Label>
      <Select value={value || ALL} onValueChange={(v) => onChange(v === ALL ? null : v)}>
        <SelectTrigger id={id} className="w-full sm:w-44">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>{allLabel}</SelectItem>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

export function FilterBar({
  searchPlaceholder = 'Search…',
  kindLabel,
  kinds,
  methods,
  investors,
  showAmount = true,
  defaultPreset = 'all',
}: FilterBarProps) {
  const { update, pending, searchParams } = useUpdateParams()
  const get = (k: string) => searchParams.get(k) ?? ''
  const [q, setQ] = useState(get('q'))
  const [min, setMin] = useState(get('min'))
  const [max, setMax] = useState(get('max'))
  const preset = get('range') || defaultPreset

  const hasFilters = ['q', 'range', 'from', 'to', 'kind', 'method', 'investor', 'min', 'max'].some((k) => searchParams.has(k))

  return (
    <div className="space-y-3 rounded-lg border bg-card p-3">
      <form
        className="flex gap-2"
        role="search"
        onSubmit={(e) => {
          e.preventDefault()
          update({ q: q.trim() || null, min: min || null, max: max || null })
        }}
      >
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            aria-label="Search"
            value={q}
            maxLength={100}
            onChange={(e) => setQ(e.target.value)}
            placeholder={searchPlaceholder}
            className="pl-8"
          />
        </div>
        <Button type="submit" variant="secondary" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" /> : <Search />}
          <span className="hidden sm:inline">Search</span>
        </Button>
      </form>

      <div className="flex flex-wrap items-end gap-3">
        <SelectFilter
          id="f-range"
          label="Date range"
          value={preset === 'all' ? '' : preset}
          allLabel={PRESET_LABELS.all}
          options={DATE_PRESETS.filter((p) => p !== 'all').map((p) => ({ value: p, label: PRESET_LABELS[p] }))}
          onChange={(v) => update({ range: v ?? 'all', from: null, to: null })}
        />
        {preset === 'custom' && (
          <>
            <div className="grid gap-1.5">
              <Label htmlFor="f-from" className="text-xs text-muted-foreground">
                From
              </Label>
              <Input id="f-from" type="date" className="w-full sm:w-40" defaultValue={get('from')} onChange={(e) => update({ from: e.target.value || null })} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="f-to" className="text-xs text-muted-foreground">
                To
              </Label>
              <Input id="f-to" type="date" className="w-full sm:w-40" defaultValue={get('to')} onChange={(e) => update({ to: e.target.value || null })} />
            </div>
          </>
        )}
        {kinds && kindLabel && (
          <SelectFilter
            id="f-kind"
            label={kindLabel}
            value={get('kind')}
            allLabel={kindLabel === 'Category' ? 'All categories' : `All ${kindLabel.toLowerCase()}s`}
            options={kinds.map((k) => ({ value: k, label: k }))}
            onChange={(v) => update({ kind: v })}
          />
        )}
        {investors && (
          <SelectFilter
            id="f-investor"
            label="Investor"
            value={get('investor')}
            allLabel="All investors"
            options={investors}
            onChange={(v) => update({ investor: v })}
          />
        )}
        {methods && (
          <SelectFilter
            id="f-method"
            label="Payment method"
            value={get('method')}
            allLabel="All methods"
            options={methods.map((m) => ({ value: m, label: m }))}
            onChange={(v) => update({ method: v })}
          />
        )}
        {showAmount && (
          <form
            className="flex items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              update({ min: min || null, max: max || null, q: q.trim() || null })
            }}
          >
            <div className="grid gap-1.5">
              <Label htmlFor="f-min" className="text-xs text-muted-foreground">
                Min amount
              </Label>
              <Input id="f-min" type="number" inputMode="decimal" min={0} step="0.01" className="w-28" value={min} onChange={(e) => setMin(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="f-max" className="text-xs text-muted-foreground">
                Max amount
              </Label>
              <Input id="f-max" type="number" inputMode="decimal" min={0} step="0.01" className="w-28" value={max} onChange={(e) => setMax(e.target.value)} />
            </div>
            <Button type="submit" variant="outline">
              Apply
            </Button>
          </form>
        )}
        {hasFilters && (
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setQ('')
              setMin('')
              setMax('')
              update({ q: null, range: null, from: null, to: null, kind: null, method: null, investor: null, min: null, max: null })
            }}
          >
            <X />
            Clear
          </Button>
        )}
      </div>
    </div>
  )
}
