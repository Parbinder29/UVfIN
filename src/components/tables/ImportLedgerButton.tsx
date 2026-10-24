'use client'

import { useMemo, useRef, useState, useTransition } from 'react'
import { AlertCircle, FileSpreadsheet, Link2, Loader2, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { fetchGoogleSheet, importLedgerEntries } from '@/actions/ledger'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { EXPENSE_STATUSES, PAYMENT_METHODS } from '@/lib/constants'
import { formatCurrency, formatDate } from '@/lib/format'
import {
  IMPORT_MAX_BYTES,
  IMPORT_MAX_ROWS,
  parseCSV,
  parseGoogleSheetUrl,
  planSheet,
  planWorkbook,
  readyRows,
  templateHeaders,
  type ChartOfAccounts,
  type ImportRow,
  type LedgerKey,
  type Sheets,
} from '@/lib/import'
import { LEDGERS } from '@/lib/ledger'
import { cn } from '@/lib/utils'

const SHOWN_PROBLEMS = 20
const DESTS: LedgerKey[] = ['expenses', 'earnings']
type Source = 'file' | 'google'

const rowDate = (r: ImportRow) => String(r.values[r.dest ? LEDGERS[r.dest].dateCol : 'date'] ?? '')
const rowParty = (r: ImportRow) => String(r.values[r.dest ? LEDGERS[r.dest].partyCol : 'party'] ?? '')

/**
 * Finance managers: add many entries from Excel, CSV or a Google Sheet, with a
 * preview first. A workbook in the accounts-sheet layout is sorted row by row
 * into Money Spent and Earnings, whichever page the import was opened from.
 */
export function ImportLedgerButton({ ledger }: { ledger: LedgerKey }) {
  const cfg = LEDGERS[ledger]
  const [open, setOpen] = useState(false)
  const [source, setSource] = useState<Source>('file')
  const [link, setLink] = useState('')
  const [sheets, setSheets] = useState<Sheets | null>(null)
  const [sheetName, setSheetName] = useState('')
  const [coa, setCoa] = useState<ChartOfAccounts>(new Map())
  // Dates typed in the preview for rows the sheet has no date for, by row number.
  const [dates, setDates] = useState<Record<number, string>>({})
  const [loadError, setLoadError] = useState<string | null>(null)
  const [reading, setReading] = useState(false)
  const [pending, startTransition] = useTransition()
  const fileInput = useRef<HTMLInputElement>(null)

  const reset = () => {
    setSheets(null)
    setSheetName('')
    setCoa(new Map())
    setDates({})
    setLoadError(null)
    if (fileInput.current) fileInput.current.value = ''
  }

  const plan = useMemo(() => {
    const found = sheets?.find((s) => s.sheet === sheetName)
    return found ? planSheet(found.data, { fallback: ledger, coa, dates }) : null
  }, [sheets, sheetName, coa, dates, ledger])

  const pickSheet = (name: string) => {
    setSheetName(name)
    setDates({})
  }

  const showSheets = (all: Sheets) => {
    if (!all.length) return setLoadError('The spreadsheet is empty.')
    // Start with the tab that has the most entries, using the Chart of Accounts tab if there is one.
    const best = planWorkbook(all, ledger)
    setSheets(all)
    setCoa(best.coa)
    setSheetName(best.sheet)
  }

  const readWorkbook = async (data: ArrayBuffer) => {
    const { default: readExcelFile } = await import('read-excel-file/universal')
    showSheets((await readExcelFile(data)) as unknown as Sheets)
  }

  const onFile = async (file: File | undefined) => {
    reset()
    if (!file) return
    const isCsv = /\.csv$/i.test(file.name)
    if (!isCsv && !/\.xlsx$/i.test(file.name)) {
      return setLoadError('Choose an Excel (.xlsx) or CSV (.csv) file. For an old .xls file, open it in Excel and use Save As → Excel Workbook (.xlsx).')
    }
    if (file.size > IMPORT_MAX_BYTES) return setLoadError('The file is larger than 5 MB. Split it into smaller files.')
    setReading(true)
    try {
      if (isCsv) showSheets([{ sheet: file.name, data: parseCSV(await file.text()) }])
      else await readWorkbook(await file.arrayBuffer())
    } catch {
      setLoadError(`This file could not be read. Make sure it is a real ${isCsv ? 'CSV' : 'Excel (.xlsx)'} file and not password-protected.`)
    } finally {
      setReading(false)
    }
  }

  const onGoogleLink = async () => {
    reset()
    if (!parseGoogleSheetUrl(link)) {
      return setLoadError('Paste the link of a Google Sheet (it starts with https://docs.google.com/spreadsheets/d/).')
    }
    setReading(true)
    try {
      const result = await fetchGoogleSheet(link)
      if (!result.ok || !result.data) return setLoadError(result.ok ? 'The sheet is empty.' : result.error)
      await readWorkbook(Uint8Array.from(atob(result.data), (c) => c.charCodeAt(0)).buffer)
    } catch {
      setLoadError('The Google Sheet could not be read. Please try again.')
    } finally {
      setReading(false)
    }
  }

  const downloadTemplate = async () => {
    const { default: writeExcelFile } = await import('write-excel-file/browser')
    const headers = templateHeaders(cfg)
    const header = headers.map((value) => ({ value, fontWeight: 'bold' as const }))
    const statuses: readonly string[] = cfg.sheetColumns ? EXPENSE_STATUSES : []
    const longest = Math.max(cfg.kinds.length, PAYMENT_METHODS.length, statuses.length)
    const allowed = [
      [cfg.kindLabel, cfg.methodLabel, ...(statuses.length ? ['Status (suggested)'] : [])].map((value) => ({ value, fontWeight: 'bold' as const })),
      ...Array.from({ length: longest }, (_, i) => [cfg.kinds[i] ?? null, PAYMENT_METHODS[i] ?? null, ...(statuses.length ? [statuses[i] ?? null] : [])]),
    ]
    const wide = new Set(['Description', 'Note', 'Item / Party', 'Debit Ledger', 'Credit Ledger'])
    await writeExcelFile([
      { sheet: cfg.title, data: [header], columns: headers.map((h) => ({ width: h === 'Sr No' ? 7 : wide.has(h) ? 32 : 14 })) },
      { sheet: 'Allowed values', data: allowed, columns: [{ width: 36 }, { width: 16 }, { width: 20 }] },
    ]).toFile(`uvfin-${ledger === 'expenses' ? 'money-spent' : 'earnings'}-template.xlsx`)
  }

  const good = plan ? readyRows(plan) : []
  const groups = DESTS.map((dest) => {
    const rows = good.filter((r) => r.dest === dest)
    return { dest, rows, total: rows.reduce((sum, r) => sum + Number(r.values.amount), 0) }
  }).filter((g) => g.rows.length > 0)
  // Rows without a date get a date box; other problems are listed to fix in the sheet.
  const undated = plan?.rows.filter((r) => r.dest && r.missingDate) ?? []
  const bad = plan?.rows.filter((r) => r.dest && !r.missingDate && r.errors.length > 0) ?? []
  const skipped = plan?.rows.filter((r) => r.skip) ?? []
  const tooMany = groups.some((g) => g.rows.length > IMPORT_MAX_ROWS)
  const busy = reading || pending

  const runImport = () =>
    startTransition(async () => {
      const done: string[] = []
      for (const { dest, rows } of groups) {
        const result = await importLedgerEntries(
          dest,
          rows.map((r) => r.values)
        )
        if (!result.ok || !result.data) {
          const before = done.length ? ` (${done.join('; ')} — already saved.)` : ''
          toast.error(`${LEDGERS[dest].title}: ${result.ok ? 'nothing was imported.' : result.error}${before}`)
          return
        }
        const { added, skipped: dupes } = result.data
        done.push(`${LEDGERS[dest].title}: ${added} added${dupes ? `, ${dupes} already in UVfIN` : ''}`)
      }
      toast.success(`${done.join('. ')}.`)
      setOpen(false)
      reset()
    })

  const switchSource = (s: Source) => {
    if (s === source) return
    setSource(s)
    reset()
  }

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <Upload />
        Import
      </Button>
      <Dialog
        open={open}
        onOpenChange={(o) => {
          if (pending) return
          setOpen(o)
          if (!o) reset()
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Import entries</DialogTitle>
            <DialogDescription>
              From an Excel or CSV file, or a Google Sheet. A workbook in the accounts-sheet layout (Debit Ledger, Credit Ledger)
              is sorted automatically: spending goes to Money Spent and money received from customers to Earnings. Transfers and
              unidentified receipts are listed but not imported. Other sheets need <strong>Date</strong>, <strong>Amount</strong>{' '}
              and <strong>{cfg.kindLabel}</strong> columns. Dates are read as day/month/year. You see a preview before anything is
              saved.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div role="group" aria-label="Import from" className="inline-flex rounded-lg border bg-muted/40 p-1">
              {(
                [
                  ['file', 'Excel / CSV file', FileSpreadsheet],
                  ['google', 'Google Sheets', Link2],
                ] as const
              ).map(([value, label, Icon]) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={source === value}
                  disabled={busy}
                  onClick={() => switchSource(value)}
                  className={cn(
                    'inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-50',
                    source === value ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  <Icon className="size-4" />
                  {label}
                </button>
              ))}
            </div>

            {source === 'file' ? (
              <div className="flex flex-wrap items-end gap-3">
                <div className="min-w-56 flex-1 space-y-2">
                  <Label htmlFor="import-file">Spreadsheet file (.xlsx or .csv)</Label>
                  <Input
                    ref={fileInput}
                    id="import-file"
                    type="file"
                    accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
                    disabled={busy}
                    onChange={(e) => onFile(e.target.files?.[0])}
                  />
                </div>
                <Button type="button" variant="ghost" onClick={downloadTemplate}>
                  <FileSpreadsheet />
                  Download template
                </Button>
              </div>
            ) : (
              <form
                className="space-y-2"
                onSubmit={(e) => {
                  e.preventDefault()
                  onGoogleLink()
                }}
              >
                <Label htmlFor="import-link">Google Sheet link</Label>
                <div className="flex flex-wrap gap-2">
                  <Input
                    id="import-link"
                    type="url"
                    inputMode="url"
                    placeholder="https://docs.google.com/spreadsheets/d/…"
                    className="min-w-56 flex-1"
                    value={link}
                    disabled={busy}
                    onChange={(e) => setLink(e.target.value)}
                  />
                  <Button type="submit" variant="secondary" disabled={busy || !link.trim()}>
                    Load sheet
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  The sheet must be shared as &ldquo;Anyone with the link&rdquo; (Viewer). Every tab is read and the one with the
                  entries is picked; you can choose another below. Template: use{' '}
                  <button type="button" className="underline underline-offset-2" onClick={downloadTemplate}>
                    this Excel file
                  </button>{' '}
                  and open it in Google Sheets.
                </p>
              </form>
            )}

            {reading && (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" /> Reading the sheet…
              </p>
            )}

            {loadError && (
              <Alert variant="destructive">
                <AlertCircle />
                <AlertDescription>{loadError}</AlertDescription>
              </Alert>
            )}

            {sheets && sheets.length > 1 && (
              <div className="space-y-2">
                <Label>Tab with the entries</Label>
                <Select value={sheetName} onValueChange={pickSheet}>
                  <SelectTrigger className="w-full sm:w-64">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {sheets.map((s) => (
                      <SelectItem key={s.sheet} value={s.sheet}>
                        {s.sheet}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {coa.size > 0 && (
                  <p className="text-xs text-muted-foreground">Using the workbook&rsquo;s chart of accounts ({coa.size} ledgers) to sort the rows.</p>
                )}
              </div>
            )}

            {plan?.error && (
              <Alert variant="destructive">
                <AlertCircle />
                <AlertDescription>{plan.error}</AlertDescription>
              </Alert>
            )}

            {plan && !plan.error && (
              <div className="space-y-3 text-sm">
                <div className="space-y-1 rounded-lg border bg-muted/40 p-3">
                  {groups.length === 0 && <p>No rows are ready to import yet.</p>}
                  {groups.map((g) => (
                    <p key={g.dest}>
                      <strong>{g.rows.length}</strong> {g.rows.length === 1 ? 'row' : 'rows'} to <strong>{LEDGERS[g.dest].title}</strong>,
                      totalling <strong>{formatCurrency(g.total)}</strong>.
                    </p>
                  ))}
                  {plan.newCategories.length > 0 && (
                    <p>
                      New debit {plan.newCategories.length === 1 ? 'ledger' : 'ledgers'} that will be added:{' '}
                      <strong>{plan.newCategories.join(', ')}</strong>.
                    </p>
                  )}
                  {plan.ignored.length > 0 && <p className="text-muted-foreground">Columns not used: {plan.ignored.join(', ')}.</p>}
                  <p className="text-muted-foreground">
                    Rows already in UVfIN (same date, amount, ledger, party and reference, including a &ldquo;Ref&rdquo; number in the
                    note) are skipped, so loading the same sheet again is safe.
                  </p>
                </div>

                {tooMany && (
                  <Alert variant="destructive">
                    <AlertCircle />
                    <AlertDescription>
                      At most {IMPORT_MAX_ROWS} rows can be imported at once. Split the sheet into smaller ones.
                    </AlertDescription>
                  </Alert>
                )}

                {undated.length > 0 && (
                  <div className="rounded-lg border border-amber-500/50 p-3">
                    <p className="mb-2 font-medium">
                      {undated.length === 1 ? 'This row has' : 'These rows have'} no date in the sheet. Enter one to import{' '}
                      {undated.length === 1 ? 'it' : 'them'}; left blank, {undated.length === 1 ? 'it is' : 'they are'} left out.
                    </p>
                    <ul className="space-y-2">
                      {undated.map((r) => {
                        const others = r.errors.filter((e) => e !== 'Date is missing')
                        return (
                          <li key={r.line} className="flex flex-wrap items-center gap-x-3 gap-y-1">
                            <Input
                              type="date"
                              aria-label={`Date for row ${r.line}`}
                              className="h-8 w-40"
                              value={dates[r.line] ?? ''}
                              disabled={busy}
                              onChange={(e) => setDates((d) => ({ ...d, [r.line]: e.target.value }))}
                            />
                            <span className="min-w-0 flex-1">
                              <span className="font-medium">Row {r.line}:</span> {rowParty(r) || '—'} ·{' '}
                              {Number.isFinite(Number(r.values.amount)) && r.values.amount !== '' ? formatCurrency(Number(r.values.amount)) : 'no amount'}{' '}
                              → {LEDGERS[r.dest!].title}
                              {others.length > 0 && <span className="text-destructive"> ({others.join('; ')})</span>}
                            </span>
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                )}

                {bad.length > 0 && (
                  <div className="rounded-lg border border-destructive/40 p-3">
                    <p className="mb-2 font-medium">Rows with problems (fix them in the sheet and load it again):</p>
                    <ul className="space-y-1 text-muted-foreground">
                      {bad.slice(0, SHOWN_PROBLEMS).map((r) => (
                        <li key={r.line}>
                          <span className="font-medium text-foreground">Row {r.line}</span> ({rowParty(r) || 'no name'}): {r.errors.join('; ')}
                        </li>
                      ))}
                    </ul>
                    {bad.length > SHOWN_PROBLEMS && <p className="mt-1 text-muted-foreground">…and {bad.length - SHOWN_PROBLEMS} more.</p>}
                  </div>
                )}

                {skipped.length > 0 && (
                  <details className="rounded-lg border p-3">
                    <summary className="cursor-pointer font-medium">
                      {skipped.length} {skipped.length === 1 ? 'row is' : 'rows are'} not money spent or earnings and will not be imported
                    </summary>
                    <ul className="mt-2 space-y-1 text-muted-foreground">
                      {skipped.map((r) => (
                        <li key={r.line}>
                          <span className="font-medium text-foreground">Row {r.line}</span> ({rowParty(r) || '—'}
                          {r.values.amount !== '' && Number.isFinite(Number(r.values.amount)) ? `, ${formatCurrency(Number(r.values.amount))}` : ''}): {r.skip}
                        </li>
                      ))}
                    </ul>
                  </details>
                )}

                {good.length > 0 && (
                  <div className="overflow-x-auto rounded-lg border">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="p-2">Date</th>
                          <th className="p-2">Item / Party</th>
                          <th className="p-2">Ledger / Source</th>
                          <th className="p-2">Goes to</th>
                          <th className="p-2 text-right">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {good.slice(0, 8).map((r) => (
                          <tr key={r.line} className="border-t">
                            <td className="p-2 whitespace-nowrap">{formatDate(rowDate(r))}</td>
                            <td className="max-w-40 truncate p-2">{rowParty(r) || '—'}</td>
                            <td className="max-w-40 truncate p-2">{String(r.values[LEDGERS[r.dest!].kindCol])}</td>
                            <td className="p-2 whitespace-nowrap">{LEDGERS[r.dest!].title}</td>
                            <td className="p-2 text-right tabular-nums">{formatCurrency(Number(r.values.amount))}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {good.length > 8 && <p className="border-t p-2 text-xs text-muted-foreground">First 8 of {good.length} rows shown.</p>}
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" disabled={pending} onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="button" disabled={busy || !good.length || tooMany || !!plan?.error} onClick={runImport}>
              {pending && <Loader2 className="animate-spin" />}
              {good.length ? `Import ${good.length} ${good.length === 1 ? 'row' : 'rows'}` : 'Import'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
