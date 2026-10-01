'use client'

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { formatCurrency } from '@/lib/format'
import { ChartTooltip } from './ChartTooltip'

const MAX_SLICES = 7 // slots 1-7 are hues; slot 8 (neutral) is "Other"

/** Part-to-whole donut with a legend table (values + share), so identity is never colour-only. */
export function DonutChart({ data, emptyText = 'No data for this period' }: { data: { name: string; value: number }[]; emptyText?: string }) {
  const sorted = [...data].filter((d) => d.value > 0).sort((a, b) => b.value - a.value)
  const slices =
    sorted.length > MAX_SLICES + 1
      ? [...sorted.slice(0, MAX_SLICES), { name: 'Other', value: sorted.slice(MAX_SLICES).reduce((s, d) => s + d.value, 0) }]
      : sorted
  const total = slices.reduce((s, d) => s + d.value, 0)
  if (!total) return <p className="py-10 text-center text-sm text-muted-foreground">{emptyText}</p>

  const colored = slices.map((d, i) => ({ ...d, fill: d.name === 'Other' && i === slices.length - 1 && sorted.length > slices.length ? 'var(--series-8)' : `var(--series-${i + 1})` }))

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row">
      <div className="h-44 w-44 shrink-0" role="img" aria-label={`Donut chart: ${colored.map((d) => `${d.name} ${formatCurrency(d.value)}`).join(', ')}`}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={colored} dataKey="value" nameKey="name" innerRadius="62%" outerRadius="100%" paddingAngle={1} stroke="var(--card)" strokeWidth={2} isAnimationActive={false}>
              {colored.map((d) => (
                <Cell key={d.name} fill={d.fill} />
              ))}
            </Pie>
            <Tooltip content={<ChartTooltip />} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="w-full space-y-1 text-sm">
        {colored.map((d) => (
          <li key={d.name} className="flex items-center gap-2">
            <span aria-hidden className="size-2.5 shrink-0 rounded-sm" style={{ background: d.fill }} />
            <span className="truncate">{d.name}</span>
            <span className="ml-auto pl-2 tabular-nums">{formatCurrency(d.value)}</span>
            <span className="w-10 text-right text-xs text-muted-foreground tabular-nums">{Math.round((d.value / total) * 100)}%</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
