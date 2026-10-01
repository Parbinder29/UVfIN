import Link from 'next/link'
import { InvestorShareChart } from '@/components/charts/InvestorShareChart'
import { InvestmentsNav } from '@/components/investments/InvestmentsNav'
import { SummaryStrip } from '@/components/investments/SummaryStrip'
import { EmptyState } from '@/components/shared/EmptyState'
import { PageHeader } from '@/components/shared/PageHeader'
import { AddInvestorButton, InvestorRowActions } from '@/components/tables/InvestmentControls'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { requireUser } from '@/lib/auth'
import { formatCurrency, formatDateTime } from '@/lib/format'
import { getInvestorSummaries } from '@/lib/queries'

export const metadata = { title: 'Investors · UVfIN' }

export default async function InvestorsPage() {
  const user = await requireUser()
  const isManager = user.profile.role === 'finance_manager'
  const investors = await getInvestorSummaries()
  const total = investors.reduce((s, i) => s + i.total_invested, 0)

  return (
    <div className="space-y-4">
      <PageHeader title="Investors" description="The members who invest in UVIN Group, with their totals.">
        {isManager && <AddInvestorButton />}
      </PageHeader>
      <InvestmentsNav active="investors" />
      <SummaryStrip investors={investors} />

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="rounded-lg border bg-card xl:col-span-2">
          {investors.length === 0 ? (
            <EmptyState title="No investors yet" description={isManager ? 'Add the first investor to start recording contributions.' : undefined} />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Contributions</TableHead>
                  <TableHead className="text-right">Total Invested</TableHead>
                  <TableHead>Last Contribution</TableHead>
                  {isManager && <TableHead><span className="sr-only">Actions</span></TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {investors.map((i) => (
                  <TableRow key={i.id}>
                    <TableCell className="font-medium">
                      <Link href={`/investments/investors/${i.id}`} className="hover:underline">
                        {i.full_name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      <div className="max-w-48 truncate">{i.email || '—'}</div>
                      {i.phone && <div>{i.phone}</div>}
                    </TableCell>
                    <TableCell>{i.is_active ? <Badge className="bg-accent text-accent-foreground">Active</Badge> : <Badge variant="outline">Inactive</Badge>}</TableCell>
                    <TableCell className="text-right tabular-nums">{i.contribution_count}</TableCell>
                    <TableCell className="text-right font-medium tabular-nums whitespace-nowrap">{formatCurrency(i.total_invested)}</TableCell>
                    <TableCell className="whitespace-nowrap">{i.last_invested_at ? formatDateTime(i.last_invested_at) : '—'}</TableCell>
                    {isManager && (
                      <TableCell className="text-right">
                        <InvestorRowActions investor={i} />
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={4}>All investors</TableCell>
                  <TableCell className="text-right tabular-nums whitespace-nowrap">{formatCurrency(total)}</TableCell>
                  <TableCell colSpan={isManager ? 2 : 1} />
                </TableRow>
              </TableFooter>
            </Table>
          )}
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Share per investor</CardTitle>
          </CardHeader>
          <CardContent>
            <InvestorShareChart data={investors.filter((i) => i.total_invested > 0).map((i) => ({ name: i.full_name, value: i.total_invested }))} />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
