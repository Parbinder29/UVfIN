'use client'

import type { TooltipContentProps } from 'recharts'
import { formatCurrency } from '@/lib/format'

/** Shared tooltip: text uses text tokens; a swatch carries series identity. */
export function ChartTooltip({ active, payload, label, labelFormatter }: Partial<TooltipContentProps<number, string>> & { labelFormatter?: (l: string) => string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-md border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md">
      {label != null && label !== '' && <p className="mb-1 font-medium">{labelFormatter ? labelFormatter(String(label)) : String(label)}</p>}
      <ul className="space-y-0.5">
        {payload.map((p) => (
          <li key={String(p.dataKey ?? p.name)} className="flex items-center gap-2">
            <span aria-hidden className="size-2.5 rounded-sm" style={{ background: (p.payload as { fill?: string })?.fill ?? p.color }} />
            <span className="text-muted-foreground">{p.name}</span>
            <span className="ml-auto pl-3 font-medium tabular-nums">{formatCurrency(Number(p.value))}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
