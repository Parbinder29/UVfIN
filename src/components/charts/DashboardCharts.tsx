'use client'

import { Area, AreaChart, Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { formatCompactCurrency, formatMonth } from '@/lib/format'
import { ChartTooltip } from './ChartTooltip'

type Month = { month: string; earnings: number; spent: number; invested: number }

const axis = { stroke: 'var(--muted-foreground)', fontSize: 12, tickLine: false, axisLine: false } as const

function Empty() {
  return <p className="flex h-full items-center justify-center text-sm text-muted-foreground">No data for this period</p>
}

export function EarningsVsSpentChart({ data }: { data: Month[] }) {
  if (!data.some((d) => d.earnings || d.spent)) return <div className="h-72"><Empty /></div>
  return (
    <div className="h-72" role="img" aria-label="Bar chart of monthly earnings and money spent">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} barGap={2} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis dataKey="month" tickFormatter={formatMonth} {...axis} />
          <YAxis tickFormatter={formatCompactCurrency} width={72} {...axis} />
          <Tooltip cursor={{ fill: 'var(--muted)', opacity: 0.6 }} content={<ChartTooltip labelFormatter={formatMonth} />} />
          <Legend iconType="square" iconSize={10} wrapperStyle={{ fontSize: 12 }} formatter={(value) => <span className="text-foreground">{value}</span>} />
          <Bar dataKey="earnings" name="Earnings" fill="var(--series-1)" radius={[4, 4, 0, 0]} maxBarSize={28} isAnimationActive={false} />
          <Bar dataKey="spent" name="Money Spent" fill="var(--series-2)" radius={[4, 4, 0, 0]} maxBarSize={28} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export function InvestmentsOverTimeChart({ data }: { data: Month[] }) {
  if (!data.some((d) => d.invested)) return <div className="h-64"><Empty /></div>
  // Running total, so the line shows how capital has built up over the period.
  const series = data.reduce<{ month: string; cumulative: number }[]>(
    (acc, d) => [...acc, { month: d.month, cumulative: (acc.at(-1)?.cumulative ?? 0) + d.invested }],
    []
  )
  return (
    <div className="h-64" role="img" aria-label="Area chart of cumulative investments over time">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={series} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis dataKey="month" tickFormatter={formatMonth} {...axis} />
          <YAxis tickFormatter={formatCompactCurrency} width={72} {...axis} />
          <Tooltip cursor={{ stroke: 'var(--muted-foreground)', strokeDasharray: '3 3' }} content={<ChartTooltip labelFormatter={formatMonth} />} />
          <Area type="monotone" dataKey="cumulative" name="Cumulative invested" stroke="var(--series-1)" strokeWidth={2} fill="var(--series-1)" fillOpacity={0.15} dot={false} activeDot={{ r: 4 }} isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
