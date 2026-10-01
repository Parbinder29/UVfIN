import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, Mail, Phone } from 'lucide-react'
import { EmptyState } from '@/components/shared/EmptyState'
import { PageHeader } from '@/components/shared/PageHeader'
import { AddInvestmentButton, InvestmentRowActions, InvestorRowActions } from '@/components/tables/InvestmentControls'
import { PaginationBar } from '@/components/tables/PaginationBar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { getProfileNames, requireUser } from '@/lib/auth'
import { formatCurrency, formatDateTime } from '@/lib/format'
import { parseListParams } from '@/lib/list-params'
import { INVESTMENT_SORTS, getInvestments, getInvestorSummary } from '@/lib/queries'
import { uuidSchema } from '@/lib/validators'

export const metadata = { title: 'Investor · UVfIN' }

export default async function InvestorDetailPage(props: PageProps<'/investments/investors/[id]'>) {
  const user = await requireUser()
  const isManager = user.profile.role === 'finance_manager'
  const { id } = await props.params
  if (!uuidSchema.safeParse(id).success) notFound()

  const investor = await getInvestorSummary(id)
  if (!investor) notFound()

  const filters = { ...parseListParams(await props.searchParams, { sortable: INVESTMENT_SORTS, defaultSort: 'date' }), investor: id }
  const [{ rows, count }, names] = await Promise.all([getInvestments(filters, { page: filters.page }), getProfileNames()])
  const self = [{ id: investor.id, full_name: investor.full_name, is_active: investor.is_active }]

  return (
    <div className="space-y-4">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href="/investments/investors">
          <ArrowLeft />
          All investors
        </Link>
      </Button>
      <PageHeader title={investor.full_name} description="Full contribution history.">
        {isManager && investor.is_active && <AddInvestmentButton investors={self} defaultInvestorId={investor.id} />}
        {isManager && <InvestorRowActions investor={investor} />}
      </PageHeader>

      <div className="grid gap-3 sm:grid-cols-4">
        <Card className="py-4">
          <CardContent className="px-4">
            <p className="text-xs text-muted-foreground">Total invested</p>
            <p className="mt-1 text-lg font-semibold tabular-nums">{formatCurrency(investor.total_invested)}</p>
          </CardContent>
        </Card>
        <Card className="py-4">
          <CardContent className="px-4">
            <p className="text-xs text-muted-foreground">Contributions</p>
            <p className="mt-1 text-lg font-semibold tabular-nums">{investor.contribution_count}</p>
          </CardContent>
        </Card>
        <Card className="py-4">
          <CardContent className="px-4">
            <p className="text-xs text-muted-foreground">Status</p>
            <p className="mt-1">{investor.is_active ? <Badge className="bg-accent text-accent-foreground">Active</Badge> : <Badge variant="outline">Inactive</Badge>}</p>
          </CardContent>
        </Card>
        <Card className="py-4">
          <CardContent className="space-y-1 px-4 text-sm">
            <p className="flex items-center gap-2 truncate"><Mail className="size-4 text-muted-foreground" aria-label="Email" />{investor.email || '—'}</p>
            <p className="flex items-center gap-2"><Phone className="size-4 text-muted-foreground" aria-label="Phone" />{investor.phone || '—'}</p>
          </CardContent>
        </Card>
      </div>
      {investor.notes && <p className="rounded-lg border bg-card p-4 text-sm whitespace-pre-wrap text-muted-foreground">{investor.notes}</p>}

      <div className="rounded-lg border bg-card">
        {rows.length === 0 ? (
          <EmptyState title="No contributions yet" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date & Time</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Payment Method</TableHead>
                <TableHead>Reference No</TableHead>
                <TableHead>Notes</TableHead>
                <TableHead>Added By</TableHead>
                {isManager && <TableHead><span className="sr-only">Actions</span></TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="whitespace-nowrap">{formatDateTime(r.invested_at)}</TableCell>
                  <TableCell className="text-right font-medium tabular-nums whitespace-nowrap">{formatCurrency(r.amount)}</TableCell>
                  <TableCell>{r.payment_method || '—'}</TableCell>
                  <TableCell>{r.reference_no || '—'}</TableCell>
                  <TableCell className="max-w-64 truncate text-muted-foreground" title={r.notes ?? ''}>{r.notes || '—'}</TableCell>
                  <TableCell className="whitespace-nowrap">{names[r.created_by] ?? '—'}</TableCell>
                  {isManager && (
                    <TableCell className="text-right">
                      <InvestmentRowActions investment={r} investors={self} investorName={investor.full_name} />
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
      <PaginationBar page={filters.page} count={count} />
    </div>
  )
}
