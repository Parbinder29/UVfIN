import Link from 'next/link'
import { ArrowDownRight, ArrowUpRight, Landmark, Scale, TrendingUp, Wallet } from 'lucide-react'
import { EarningsVsSpentChart, InvestmentsOverTimeChart } from '@/components/charts/DashboardCharts'
import { DonutChart } from '@/components/charts/DonutChart'
import { RangePicker } from '@/components/dashboard/RangePicker'
import { EmptyState } from '@/components/shared/EmptyState'
import { PageHeader } from '@/components/shared/PageHeader'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { getProfileNames, requireUser } from '@/lib/auth'
import { SECTION_LABELS } from '@/lib/constants'
import { PRESET_LABELS } from '@/lib/dates'
import { formatCurrency, formatDate, formatDateTime } from '@/lib/format'
import { parseListParams } from '@/lib/list-params'
import { getDashboardSummary, getRecentActivity } from '@/lib/queries'
import { cn } from '@/lib/utils'

export const metadata = { title: 'Dashboard · UVfIN' }

const SECTION_PATHS = { expenses: '/money-spent', earnings: '/earnings', investments: '/investments' } as const

export default async function DashboardPage(props: PageProps<'/dashboard'>) {
  await requireUser()
  const f = parseListParams(await props.searchParams, { sortable: [], defaultSort: 'date', defaultPreset: 'this-month' })
  const [s, activity, names] = await Promise.all([getDashboardSummary(f.from, f.to), getRecentActivity(), getProfileNames()])
  const net = s.total_earnings - s.total_spent
  const monthNet = s.month_earnings - s.month_spent
  const rangeLabel =
    f.preset === 'custom' ? `${f.from ? formatDate(f.from) : 'start'} – ${f.to ? formatDate(f.to) : 'today'}` : PRESET_LABELS[f.preset]

  const kpis = [
    { label: 'Total Earnings', value: s.total_earnings, month: s.month_earnings, icon: TrendingUp, href: '/earnings' },
    { label: 'Total Money Spent', value: s.total_spent, month: s.month_spent, icon: Wallet, href: '/money-spent' },
    { label: 'Net Balance', value: net, month: monthNet, icon: Scale, signed: true },
    { label: 'Total Investments', value: s.total_invested, month: s.month_invested, icon: Landmark, href: '/investments' },
  ]

  return (
    <div className="space-y-6">
      <PageHeader title="Dashboard" description={`Overview for ${rangeLabel}. Net balance = earnings − money spent.`}>
        <RangePicker preset={f.preset} from={f.from} to={f.to} />
      </PageHeader>

      <section aria-label="Key figures" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((k) => {
          const Icon = k.icon
          const negative = k.signed && k.value < 0
          return (
            <Card key={k.label} className="gap-2">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardDescription>{k.label}</CardDescription>
                <Icon className="size-4 text-muted-foreground" aria-hidden />
              </CardHeader>
              <CardContent>
                <p className={cn('text-2xl font-semibold tabular-nums', negative && 'text-destructive')}>
                  {k.signed && k.value > 0 && <ArrowUpRight className="mr-1 inline size-5 text-success" aria-label="positive" />}
                  {negative && <ArrowDownRight className="mr-1 inline size-5" aria-label="negative" />}
                  {formatCurrency(k.value)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  This month: <span className="font-medium text-foreground tabular-nums">{formatCurrency(k.month)}</span>
                </p>
              </CardContent>
            </Card>
          )
        })}
      </section>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Earnings vs Money Spent by month</CardTitle>
          </CardHeader>
          <CardContent>
            <EarningsVsSpentChart data={s.by_month} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Investments over time</CardTitle>
            <CardDescription>Cumulative within the selected range</CardDescription>
          </CardHeader>
          <CardContent>
            <InvestmentsOverTimeChart data={s.by_month} />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Money spent by category</CardTitle>
          </CardHeader>
          <CardContent>
            <DonutChart data={s.by_category} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Earnings by source</CardTitle>
          </CardHeader>
          <CardContent>
            <DonutChart data={s.by_source} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent activity</CardTitle>
          <CardDescription>The latest 10 entries across all sections</CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          {activity.length === 0 ? (
            <EmptyState title="Nothing recorded yet" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6">Date</TableHead>
                  <TableHead>Section</TableHead>
                  <TableHead>Details</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="pr-6">Added By</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activity.map((a) => (
                  <TableRow key={`${a.section}-${a.id}`}>
                    <TableCell className="pl-6 whitespace-nowrap">{a.section === 'investments' ? formatDateTime(a.date) : formatDate(a.date)}</TableCell>
                    <TableCell>
                      <Link href={SECTION_PATHS[a.section]}>
                        <Badge variant="outline">{SECTION_LABELS[a.section]}</Badge>
                      </Link>
                    </TableCell>
                    <TableCell>
                      <span className="font-medium">{a.label}</span>
                      <span className="text-muted-foreground"> · {a.detail}</span>
                    </TableCell>
                    <TableCell className={cn('text-right font-medium tabular-nums whitespace-nowrap', a.amount < 0 && 'text-destructive')}>
                      {a.amount < 0 ? '−' : '+'}
                      {formatCurrency(Math.abs(a.amount))}
                    </TableCell>
                    <TableCell className="pr-6 whitespace-nowrap">{names[a.created_by] ?? '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
