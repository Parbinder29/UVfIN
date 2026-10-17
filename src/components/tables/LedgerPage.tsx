import { exportLedger } from '@/actions/ledger'
import { AttachmentLink } from '@/components/shared/AttachmentLink'
import { EmptyState } from '@/components/shared/EmptyState'
import { PageHeader } from '@/components/shared/PageHeader'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { getProfileNames, requireUserWith } from '@/lib/auth'
import { PAYMENT_METHODS } from '@/lib/constants'
import { formatCurrency, formatDate } from '@/lib/format'
import { LEDGERS, LEDGER_SORTS } from '@/lib/ledger'
import { parseListParams } from '@/lib/list-params'
import { getFilteredTotal, getLedgerRows } from '@/lib/queries'
import { ExportButton } from './ExportButton'
import { FilterBar } from './FilterBar'
import { ImportLedgerButton } from './ImportLedgerButton'
import { AddLedgerButton, LedgerRowActions } from './LedgerControls'
import { LedgerSelection, RowCheckbox, SelectAllCheckbox, SelectionBar } from './LedgerSelection'
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
  const cfg = LEDGERS[ledger]
  const filters = parseListParams(searchParams, { sortable: LEDGER_SORTS, defaultSort: 'date', kinds: cfg.kinds, methods: PAYMENT_METHODS })

  const [user, [{ rows, count }, total, names]] = await requireUserWith(
    Promise.all([getLedgerRows(cfg, filters, { page: filters.page }), getFilteredTotal(cfg.table, filters), getProfileNames()])
  )
  const isManager = user.profile.role === 'finance_manager'
  const sheet = cfg.sheetColumns

  const exportAction = exportLedger.bind(null, ledger)

  return (
    <div className="space-y-4">
      <PageHeader
        title={cfg.title}
        description={ledger === 'expenses' ? 'Every expenditure, with full details.' : 'Every source of incoming money.'}
      >
        <ExportButton filename={ledger === 'expenses' ? 'money-spent' : 'earnings'} action={exportAction} />
        {isManager && <ImportLedgerButton ledger={ledger} />}
        {isManager && <AddLedgerButton ledger={ledger} />}
      </PageHeader>

      <FilterBar
        searchPlaceholder={`Search ${cfg.partyLabel.toLowerCase()}, ${cfg.descriptionLabel.toLowerCase()} or reference…`}
        kindLabel={cfg.kindLabel}
        kinds={cfg.kinds}
        methods={PAYMENT_METHODS}
      />

      <LedgerSelection key={rows.map((r) => r.id).join()} ledger={ledger} rows={rows.map((r) => ({ id: r.id, amount: r.amount }))}>
        {isManager && <SelectionBar />}
        <div className="rounded-lg border bg-card">
        {rows.length === 0 ? (
          <EmptyState
            title={count === 0 && filters.page === 1 ? `No ${cfg.title.toLowerCase()} found` : 'No rows on this page'}
            description={isManager ? `Try different filters, or add a new ${cfg.singular.toLowerCase()}.` : 'Try different filters.'}
          />
        ) : (
          <Table>
            <TableHeader>
              {sheet ? (
                // Money Spent: same column order as the company's accounts sheet.
                <TableRow>
                  {isManager && <TableHead className="w-10"><SelectAllCheckbox /></TableHead>}
                  <TableHead><SortHeader label={cfg.partyLabel} sortKey="party" /></TableHead>
                  <TableHead><SortHeader label="Date" sortKey="date" /></TableHead>
                  <TableHead className="text-right"><SortHeader label="Amount (₹)" sortKey="amount" align="right" /></TableHead>
                  <TableHead><SortHeader label={cfg.methodLabel} sortKey="method" /></TableHead>
                  <TableHead>Paid By</TableHead>
                  <TableHead><SortHeader label={cfg.kindLabel} sortKey="kind" /></TableHead>
                  <TableHead>Credit Ledger</TableHead>
                  <TableHead>{cfg.descriptionLabel}</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Attachment</TableHead>
                  <TableHead>Added By</TableHead>
                  {isManager && <TableHead><span className="sr-only">Actions</span></TableHead>}
                </TableRow>
              ) : (
                <TableRow>
                  {isManager && <TableHead className="w-10"><SelectAllCheckbox /></TableHead>}
                  <TableHead><SortHeader label="Date" sortKey="date" /></TableHead>
                  <TableHead><SortHeader label={cfg.partyLabel} sortKey="party" /></TableHead>
                  <TableHead><SortHeader label={cfg.kindLabel} sortKey="kind" /></TableHead>
                  <TableHead>{cfg.descriptionLabel}</TableHead>
                  <TableHead><SortHeader label={cfg.methodLabel} sortKey="method" /></TableHead>
                  <TableHead>Reference No</TableHead>
                  <TableHead className="text-right"><SortHeader label="Amount" sortKey="amount" align="right" /></TableHead>
                  <TableHead>Attachment</TableHead>
                  <TableHead>Added By</TableHead>
                  {isManager && <TableHead><span className="sr-only">Actions</span></TableHead>}
                </TableRow>
              )}
            </TableHeader>
            <TableBody>
              {rows.map((r) => {
                const select = isManager && (
                  <TableCell>
                    <RowCheckbox id={r.id} label={`${r.party || cfg.singular} on ${formatDate(r.date)}, ${formatCurrency(r.amount)}`} />
                  </TableCell>
                )
                const party = <TableCell className="max-w-48 truncate font-medium" title={r.party ?? ''}>{r.party || '—'}</TableCell>
                const date = <TableCell className="whitespace-nowrap">{formatDate(r.date)}</TableCell>
                const amount = <TableCell className="text-right font-medium tabular-nums whitespace-nowrap">{formatCurrency(r.amount)}</TableCell>
                const kind = <TableCell><Badge variant="secondary" className="max-w-56 truncate" title={r.kind}>{r.kind}</Badge></TableCell>
                const note = <TableCell className="max-w-64 truncate text-muted-foreground" title={r.description ?? ''}>{r.description || '—'}</TableCell>
                const tail = (
                  <>
                    <TableCell>{r.attachment_path ? <AttachmentLink path={r.attachment_path} /> : <span className="text-muted-foreground">—</span>}</TableCell>
                    <TableCell className="whitespace-nowrap">{names[r.created_by] ?? '—'}</TableCell>
                    {isManager && (
                      <TableCell className="text-right">
                        <LedgerRowActions ledger={ledger} row={r} />
                      </TableCell>
                    )}
                  </>
                )
                return sheet ? (
                  <TableRow key={r.id}>
                    {select}
                    {party}
                    {date}
                    {amount}
                    <TableCell>{r.payment_method || '—'}</TableCell>
                    <TableCell className="max-w-32 truncate">{r.paid_by || '—'}</TableCell>
                    {kind}
                    <TableCell className="max-w-48 truncate" title={r.paid_from ?? ''}>{r.paid_from || '—'}</TableCell>
                    {note}
                    <TableCell className="whitespace-nowrap">{r.status ? <Badge variant="outline">{r.status}</Badge> : '—'}</TableCell>
                    {tail}
                  </TableRow>
                ) : (
                  <TableRow key={r.id}>
                    {select}
                    {date}
                    {party}
                    {kind}
                    {note}
                    <TableCell>{r.payment_method || '—'}</TableCell>
                    <TableCell className="max-w-32 truncate">{r.reference_no || '—'}</TableCell>
                    {amount}
                    {tail}
                  </TableRow>
                )
              })}
            </TableBody>
            <TableFooter>
              <TableRow>
                {/* Cells before Amount, then Amount, then the rest. */}
                <TableCell colSpan={(isManager ? 1 : 0) + (sheet ? 2 : 6)}>Total of {count} filtered {count === 1 ? 'row' : 'rows'}</TableCell>
                <TableCell className="text-right tabular-nums whitespace-nowrap">{formatCurrency(total)}</TableCell>
                <TableCell colSpan={(isManager ? 1 : 0) + (sheet ? 8 : 2)} />
              </TableRow>
            </TableFooter>
          </Table>
        )}
        </div>
      </LedgerSelection>
      <PaginationBar page={filters.page} count={count} />
    </div>
  )
}
