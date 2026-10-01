'use client'

import { DonutChart } from './DonutChart'

export function InvestorShareChart({ data }: { data: { name: string; value: number }[] }) {
  return <DonutChart data={data} emptyText="No contributions yet" />
}
