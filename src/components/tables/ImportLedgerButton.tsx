'use client'

import { useRef, useState, useTransition } from 'react'
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
  parseLedgerSheet,
  templateHeaders,
  type ParsedSheet,
  type Sheets,
} from '@/lib/import'
import { LEDGERS } from '@/lib/ledger'
import { cn } from '@/lib/utils'

const SHOWN_PROBLEMS = 20
type Source = 'file' | 'google'

/** Finance managers: add many entries from Excel, CSV or a Google Sheet, with a preview first. */
export function ImportLedgerButton({ ledger }: { ledger: 'expenses' | 'earnings' }) {
  const cfg = LEDGERS[ledger]
  const [open, setOpen] = useState(false)
  const [source, setSource] = useState<Source>('file')
  const [link, setLink] = useState('')
  const [sheets, setSheets] = useState<Sheets | null>(null)
  const [sheetName, setSheetName] = useState('')
  const [parsed, setParsed] = useState<ParsedSheet | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [reading, setReading] = useState(false)
  const [pending, startTransition] = useTransition()
  const fileInput = useRef<HTMLInputElement>(null)

  const reset = () => {
    setSheets(null)
    setSheetName('')
    setParsed(null)
    setLoadError(null)
    if (fileInput.current) fileInput.current.value = ''
  }

  const pickSheet = (all: Sheets, name: string) => {
    setSheetName(name)
    const found = all.find((s) => s.sheet === name)
    setParsed(found ? parseLedgerSheet(cfg, found.data) : null)
  }

  const showSheets = (all: Sheets) => {
    if (!all.length) return setLoadError('The spreadsheet is empty.')
    setSheets(all)
    // Start with the first sheet that looks like a ledger.
    const first = all.find((s) => !parseLedgerSheet(cfg, s.data).error) ?? all[0]
    pickSheet(all, first.sheet)
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
      if (isCsv) {
        showSheets([{ sheet: file.name, data: parseCSV(await file.text()) }])
      } else {
        const { default: readExcelFile } = await import('read-excel-file/universal')
        showSheets((await readExcelFile(await file.arrayBuffer())) as unknown as Sheets)
      }
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
      if (!result.ok || result.data == null) return setLoadError(result.ok ? 'The sheet is empty.' : result.error)
      showSheets([{ sheet: 'Google Sheet', data: parseCSV(result.data) }])
    } catch {
      setLoadError('Google Sheets could not be reached. Please try again.')
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

  const good = parsed?.rows.filter((r) => r.errors.length === 0) ?? []
  const bad = parsed?.rows.filter((r) => r.errors.length > 0) ?? []
  const total = good.reduce((sum, r) => sum + Number(r.values.amount), 0)
  const tooMany = good.length > IMPORT_MAX_ROWS
  const busy = reading || pending

  const runImport = () =>
    startTransition(async () => {
      const result = await importLedgerEntries(
        ledger,
        good.map((r) => r.values)
      )
      if (!result.ok || !result.data) {
        toast.error(result.ok ? 'Nothing was imported.' : result.error)
        return
      }
      const { added, skipped } = result.data
      const skippedNote = skipped ? ` ${skipped} already in UVfIN ${skipped === 1 ? 'was' : 'were'} skipped.` : ''
      if (added) toast.success(`${added} ${added === 1 ? 'entry' : 'entries'} added.${skippedNote}`)
      else toast.info(`Nothing new to add.${skippedNote}`)
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
            <DialogTitle>Import {cfg.title}</DialogTitle>
            <DialogDescription>
              From an Excel or CSV file, or a Google Sheet, with these columns:{' '}
              {templateHeaders(cfg).map((h, i) => (
                <span key={h}>
                  {i > 0 && ', '}
                  {['Date', 'Amount', 'Amount (₹)', cfg.kindLabel].includes(h) || (cfg.partyRequired && h === cfg.partyLabel) ? <strong>{h}</strong> : h}
                </span>
              ))}
              . Bold ones are required. Dates are read as day/month/year. You see a preview before anything is saved.
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
                  The sheet must be shared as &ldquo;Anyone with the link&rdquo; (Viewer). The tab open in the link is the one
                  imported. Template: use{' '}
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
                <Label>Sheet</Label>
                <Select value={sheetName} onValueChange={(v) => pickSheet(sheets, v)}>
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
              </div>
            )}

            {parsed?.error && (
              <Alert variant="destructive">
                <AlertCircle />
                <AlertDescription>{parsed.error}</AlertDescription>
              </Alert>
            )}

            {parsed && !parsed.error && (
              <div className="space-y-3 text-sm">
                <div className="rounded-lg border bg-muted/40 p-3">
                  <p>
                    <strong>{good.length}</strong> {good.length === 1 ? 'row is' : 'rows are'} ready to import, totalling{' '}
                    <strong>{formatCurrency(total)}</strong>.
                    {bad.length > 0 && (
                      <>
                        {' '}
                        <strong className="text-destructive">{bad.length}</strong> {bad.length === 1 ? 'row has' : 'rows have'} problems
                        and will be left out.
                      </>
                    )}
                  </p>
                  {parsed.ignored.length > 0 && (
                    <p className="mt-1 text-muted-foreground">Columns not used: {parsed.ignored.join(', ')}.</p>
                  )}
                  <p className="mt-1 text-muted-foreground">
                    Rows already in UVfIN (same date, amount, {cfg.kindLabel.toLowerCase()}, {cfg.partyLabel.toLowerCase()} and
                    reference, including a &ldquo;Ref&rdquo; number in the {cfg.descriptionLabel.toLowerCase()}) are skipped.
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

                {bad.length > 0 && (
                  <div className="rounded-lg border border-destructive/40 p-3">
                    <p className="mb-2 font-medium">Rows with problems (fix them in the sheet and load it again):</p>
                    <ul className="space-y-1 text-muted-foreground">
                      {bad.slice(0, SHOWN_PROBLEMS).map((r) => (
                        <li key={r.line}>
                          <span className="font-medium text-foreground">Row {r.line}:</span> {r.errors.join('; ')}
                        </li>
                      ))}
                    </ul>
                    {bad.length > SHOWN_PROBLEMS && <p className="mt-1 text-muted-foreground">…and {bad.length - SHOWN_PROBLEMS} more.</p>}
                  </div>
                )}

                {good.length > 0 && (
                  <div className="overflow-x-auto rounded-lg border">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="p-2">Date</th>
                          <th className="p-2">{cfg.partyLabel}</th>
                          <th className="p-2">{cfg.kindLabel}</th>
                          <th className="p-2 text-right">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {good.slice(0, 5).map((r) => (
                          <tr key={r.line} className="border-t">
                            <td className="p-2 whitespace-nowrap">{formatDate(String(r.values[cfg.dateCol]))}</td>
                            <td className="max-w-40 truncate p-2">{String(r.values[cfg.partyCol] ?? '') || '—'}</td>
                            <td className="p-2">{String(r.values[cfg.kindCol])}</td>
                            <td className="p-2 text-right tabular-nums">{formatCurrency(Number(r.values.amount))}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {good.length > 5 && <p className="border-t p-2 text-xs text-muted-foreground">First 5 of {good.length} rows shown.</p>}
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" disabled={pending} onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="button" disabled={busy || !good.length || tooMany || !!parsed?.error} onClick={runImport}>
              {pending && <Loader2 className="animate-spin" />}
              {good.length ? `Import ${good.length} ${good.length === 1 ? 'row' : 'rows'}` : 'Import'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
