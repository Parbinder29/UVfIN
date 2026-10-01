import { Card, CardContent } from '@/components/ui/card'
import { formatCurrency } from '@/lib/format'
import type { InvestorSummary } from '@/types'

export function SummaryStrip({ investors }: { investors: InvestorSummary[] }) {
  const total = investors.reduce((s, i) => s + i.total_invested, 0)
  const contributors = investors.filter((i) => i.contribution_count > 0)
  const largest = contributors.reduce<InvestorSummary | null>((best, i) => (!best || i.total_invested > best.total_invested ? i : best), null)
  const items = [
    { label: 'Total invested (all time)', value: formatCurrency(total) },
    { label: 'Investors', value: `${investors.length} (${investors.filter((i) => i.is_active).length} active)` },
    { label: 'Largest contributor', value: largest ? `${largest.full_name} · ${formatCurrency(largest.total_invested)}` : '—' },
  ]
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {items.map((i) => (
        <Card key={i.label} className="py-4">
          <CardContent className="px-4">
            <p className="text-xs text-muted-foreground">{i.label}</p>
            <p className="mt-1 truncate text-lg font-semibold tabular-nums" title={i.value}>
              {i.value}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
