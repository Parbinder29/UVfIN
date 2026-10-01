import { exportLedger } from '@/actions/ledger'
import { AttachmentLink } from '@/components/shared/AttachmentLink'
import { EmptyState } from '@/components/shared/EmptyState'
import { PageHeader } from '@/components/shared/PageHeader'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { getProfileNames, requireUser } from '@/lib/auth'
import { PAYMENT_METHODS } from '@/lib/constants'
import { formatCurrency, formatDate } from '@/lib/format'
import { LEDGERS, LEDGER_SORTS } from '@/lib/ledger'
import { parseListParams } from '@/lib/list-params'
import { getFilteredTotal, getLedgerRows } from '@/lib/queries'
import { ExportButton } from './ExportButton'
import { FilterBar } from './FilterBar'
import { AddLedgerButton, LedgerRowActions } from './LedgerControls'
import { PaginationBar } from './PaginationBar'
import { SortHeader } from './SortHeader'

/** Shared server-rendered page for Money Spent and Earnings. */
export async function LedgerPage({
  ledger,
  searchParams,
}: {
  ledger: 'expenses' | 'earnings'
  searchParams: Record<string, string | string[] | undefined>
}) {
  const user = await requireUser()
  const isManager = user.profile.role === 'finance_manager'
  const cfg = LEDGERS[ledger]
  const filters = parseListParams(searchParams, { sortable: LEDGER_SORTS, defaultSort: 'date', kinds: cfg.kinds, methods: PAYMENT_METHODS })

  const [{ rows, count }, total, names] = await Promise.all([
    getLedgerRows(cfg, filters, { page: filters.page }),
    getFilteredTotal(cfg.table, filters),
    getProfileNames(),
  ])

  const exportAction = exportLedger.bind(null, ledger)

  return (
    <div className="space-y-4">
      <PageHeader
        title={cfg.title}
        description={ledger === 'expenses' ? 'Every expenditure, with full details.' : 'Every source of incoming money.'}
      >
        <ExportButton filename={ledger === 'expenses' ? 'money-spent' : 'earnings'} action={exportAction} />
        {isManager && <AddLedgerButton ledger={ledger} />}
      </PageHeader>

      <FilterBar
        searchPlaceholder={`Search ${cfg.partyLabel.toLowerCase()}, description or reference…`}
        kindLabel={cfg.kindLabel}
        kinds={cfg.kinds}
        methods={PAYMENT_METHODS}
      />

      <div className="rounded-lg border bg-card">
        {rows.length === 0 ? (
          <EmptyState
            title={count === 0 && filters.page === 1 ? `No ${cfg.title.toLowerCase()} found` : 'No rows on this page'}
            description={isManager ? `Try different filters, or add a new ${cfg.singular.toLowerCase()}.` : 'Try different filters.'}
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead><SortHeader label="Date" sortKey="date" /></TableHead>
                <TableHead><SortHeader label={cfg.partyLabel} sortKey="party" /></TableHead>
                <TableHead><SortHeader label={cfg.kindLabel} sortKey="kind" /></TableHead>
                <TableHead>Description</TableHead>
                <TableHead><SortHeader label="Payment Method" sortKey="method" /></TableHead>
                <TableHead>Reference No</TableHead>
                <TableHead className="text-right"><SortHeader label="Amount" sortKey="amount" align="right" /></TableHead>
                <TableHead>Attachment</TableHead>
                <TableHead>Added By</TableHead>
                {isManager && <TableHead><span className="sr-only">Actions</span></TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="whitespace-nowrap">{formatDate(r.date)}</TableCell>
                  <TableCell className="max-w-48 truncate font-medium" title={r.party ?? ''}>{r.party || '—'}</TableCell>
                  <TableCell><Badge variant="secondary">{r.kind}</Badge></TableCell>
                  <TableCell className="max-w-64 truncate text-muted-foreground" title={r.description ?? ''}>{r.description || '—'}</TableCell>
                  <TableCell>{r.payment_method || '—'}</TableCell>
                  <TableCell className="max-w-32 truncate">{r.reference_no || '—'}</TableCell>
                  <TableCell className="text-right font-medium tabular-nums whitespace-nowrap">{formatCurrency(r.amount)}</TableCell>
                  <TableCell>{r.attachment_path ? <AttachmentLink path={r.attachment_path} /> : <span className="text-muted-foreground">—</span>}</TableCell>
                  <TableCell className="whitespace-nowrap">{names[r.created_by] ?? '—'}</TableCell>
                  {isManager && (
                    <TableCell className="text-right">
                      <LedgerRowActions ledger={ledger} row={r} />
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={6}>Total of {count} filtered {count === 1 ? 'row' : 'rows'}</TableCell>
                <TableCell className="text-right tabular-nums whitespace-nowrap">{formatCurrency(total)}</TableCell>
                <TableCell colSpan={isManager ? 3 : 2} />
              </TableRow>
            </TableFooter>
          </Table>
        )}
      </div>
      <PaginationBar page={filters.page} count={count} />
    </div>
  )
}
