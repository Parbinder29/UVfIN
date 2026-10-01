import Link from 'next/link'
import { exportInvestments } from '@/actions/investments'
import { SummaryStrip } from '@/components/investments/SummaryStrip'
import { InvestmentsNav } from '@/components/investments/InvestmentsNav'
import { EmptyState } from '@/components/shared/EmptyState'
import { PageHeader } from '@/components/shared/PageHeader'
import { ExportButton } from '@/components/tables/ExportButton'
import { FilterBar } from '@/components/tables/FilterBar'
import { AddInvestmentButton, InvestmentRowActions } from '@/components/tables/InvestmentControls'
import { PaginationBar } from '@/components/tables/PaginationBar'
import { SortHeader } from '@/components/tables/SortHeader'
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { getProfileNames, requireUser } from '@/lib/auth'
import { PAYMENT_METHODS } from '@/lib/constants'
import { formatCurrency, formatDateTime } from '@/lib/format'
import { parseListParams } from '@/lib/list-params'
import { INVESTMENT_SORTS, getFilteredTotal, getInvestments, getInvestorSummaries } from '@/lib/queries'

export const metadata = { title: 'Investments · UVfIN' }

export default async function InvestmentsPage(props: PageProps<'/investments'>) {
  const user = await requireUser()
  const isManager = user.profile.role === 'finance_manager'
  const filters = parseListParams(await props.searchParams, { sortable: INVESTMENT_SORTS, defaultSort: 'date', methods: PAYMENT_METHODS })

  const [{ rows, count }, total, investors, names] = await Promise.all([
    getInvestments(filters, { page: filters.page }),
    getFilteredTotal('investments', filters),
    getInvestorSummaries(),
    getProfileNames(),
  ])
  const investorNames = Object.fromEntries(investors.map((i) => [i.id, i.full_name]))
  const choices = investors.map((i) => ({ id: i.id, full_name: i.full_name, is_active: i.is_active }))

  return (
    <div className="space-y-4">
      <PageHeader title="Investments" description="Every contribution made by an investor, with date and time.">
        <ExportButton filename="investments" action={exportInvestments} />
        {isManager && <AddInvestmentButton investors={choices} />}
      </PageHeader>
      <InvestmentsNav active="investments" />
      <SummaryStrip investors={investors} />
      <FilterBar
        searchPlaceholder="Search reference or notes…"
        investors={investors.map((i) => ({ value: i.id, label: i.full_name }))}
        methods={PAYMENT_METHODS}
      />
      <div className="rounded-lg border bg-card">
        {rows.length === 0 ? (
          <EmptyState title="No investments found" description={isManager ? 'Try different filters, or add an investment.' : 'Try different filters.'} />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead><SortHeader label="Date & Time" sortKey="date" /></TableHead>
                <TableHead>Investor</TableHead>
                <TableHead className="text-right"><SortHeader label="Amount" sortKey="amount" align="right" /></TableHead>
                <TableHead><SortHeader label="Payment Method" sortKey="method" /></TableHead>
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
                  <TableCell className="font-medium">
                    <Link className="hover:underline" href={`/investments/investors/${r.investor_id}`}>
                      {investorNames[r.investor_id] ?? 'Unknown'}
                    </Link>
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums whitespace-nowrap">{formatCurrency(r.amount)}</TableCell>
                  <TableCell>{r.payment_method || '—'}</TableCell>
                  <TableCell className="max-w-32 truncate">{r.reference_no || '—'}</TableCell>
                  <TableCell className="max-w-64 truncate text-muted-foreground" title={r.notes ?? ''}>{r.notes || '—'}</TableCell>
                  <TableCell className="whitespace-nowrap">{names[r.created_by] ?? '—'}</TableCell>
                  {isManager && (
                    <TableCell className="text-right">
                      <InvestmentRowActions investment={r} investors={choices} investorName={investorNames[r.investor_id] ?? 'Unknown'} />
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={2}>Total of {count} filtered {count === 1 ? 'row' : 'rows'}</TableCell>
                <TableCell className="text-right tabular-nums whitespace-nowrap">{formatCurrency(total)}</TableCell>
                <TableCell colSpan={isManager ? 5 : 4} />
              </TableRow>
            </TableFooter>
          </Table>
        )}
      </div>
      <PaginationBar page={filters.page} count={count} />
    </div>
  )
}
