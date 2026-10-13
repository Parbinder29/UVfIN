'use client'

import { useRef, useState, useTransition } from 'react'
import { AlertCircle, FileSpreadsheet, Loader2, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { importLedgerEntries } from '@/actions/ledger'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { PAYMENT_METHODS } from '@/lib/constants'
import { formatCurrency, formatDate } from '@/lib/format'
import { IMPORT_MAX_ROWS, parseLedgerSheet, templateHeaders, type ParsedSheet } from '@/lib/import'
import { LEDGERS } from '@/lib/ledger'

const MAX_FILE_BYTES = 5 * 1024 * 1024
const SHOWN_PROBLEMS = 20

type Sheets = { sheet: string; data: unknown[][] }[]

/** Finance managers: add many entries from an Excel (.xlsx) file, with a preview first. */
export function ImportLedgerButton({ ledger }: { ledger: 'expenses' | 'earnings' }) {
  const cfg = LEDGERS[ledger]
  const [open, setOpen] = useState(false)
  const [sheets, setSheets] = useState<Sheets | null>(null)
  const [sheetName, setSheetName] = useState('')
  const [parsed, setParsed] = useState<ParsedSheet | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const [reading, setReading] = useState(false)
  const [pending, startTransition] = useTransition()
  const fileInput = useRef<HTMLInputElement>(null)

  const reset = () => {
    setSheets(null)
    setSheetName('')
    setParsed(null)
    setFileError(null)
    if (fileInput.current) fileInput.current.value = ''
  }

  const pickSheet = (all: Sheets, name: string) => {
    setSheetName(name)
    const found = all.find((s) => s.sheet === name)
    setParsed(found ? parseLedgerSheet(cfg, found.data) : null)
  }

  const onFile = async (file: File | undefined) => {
    reset()
    if (!file) return
    if (!/\.xlsx$/i.test(file.name)) return setFileError('Choose an Excel file ending in .xlsx. For an old .xls or .csv file, open it in Excel and use Save As → Excel Workbook (.xlsx).')
    if (file.size > MAX_FILE_BYTES) return setFileError('The file is larger than 5 MB. Split it into smaller files.')
    setReading(true)
    try {
      const { default: readExcelFile } = await import('read-excel-file/universal')
      const all = (await readExcelFile(await file.arrayBuffer())) as unknown as Sheets
      setSheets(all)
      // Start with the first sheet that looks like a ledger.
      const first = all.find((s) => !parseLedgerSheet(cfg, s.data).error) ?? all[0]
      pickSheet(all, first.sheet)
    } catch {
      setFileError('This file could not be read. Make sure it is a real Excel (.xlsx) file and not password-protected.')
    } finally {
      setReading(false)
    }
  }

  const downloadTemplate = async () => {
    const { default: writeExcelFile } = await import('write-excel-file/browser')
    const header = templateHeaders(cfg).map((value) => ({ value, fontWeight: 'bold' as const }))
    const longest = Math.max(cfg.kinds.length, PAYMENT_METHODS.length)
    const allowed = [
      [{ value: cfg.kindLabel, fontWeight: 'bold' as const }, { value: 'Payment Method', fontWeight: 'bold' as const }],
      ...Array.from({ length: longest }, (_, i) => [cfg.kinds[i] ?? null, PAYMENT_METHODS[i] ?? null]),
    ]
    await writeExcelFile([
      { sheet: cfg.title, data: [header], columns: templateHeaders(cfg).map((h) => ({ width: h === 'Description' ? 40 : 18 })) },
      { sheet: 'Allowed values', data: allowed, columns: [{ width: 22 }, { width: 18 }] },
    ]).toFile(`uvfin-${ledger === 'expenses' ? 'money-spent' : 'earnings'}-template.xlsx`)
  }

  const good = parsed?.rows.filter((r) => r.errors.length === 0) ?? []
  const bad = parsed?.rows.filter((r) => r.errors.length > 0) ?? []
  const total = good.reduce((sum, r) => sum + Number(r.values.amount), 0)
  const tooMany = good.length > IMPORT_MAX_ROWS

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

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <Upload />
        Import Excel
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
            <DialogTitle>Import {cfg.title} from Excel</DialogTitle>
            <DialogDescription>
              Columns: <strong>Date</strong>, <strong>Amount</strong>, <strong>{cfg.kindLabel}</strong>
              {cfg.partyRequired ? (
                <>
                  , <strong>{cfg.partyLabel}</strong>
                </>
              ) : (
                `, ${cfg.partyLabel}`
              )}
              , and optionally Description, Payment Method, Reference No. Dates are read as day/month/year. You see a preview
              before anything is saved.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-56 flex-1 space-y-2">
                <Label htmlFor="import-file">Excel file (.xlsx)</Label>
                <Input
                  ref={fileInput}
                  id="import-file"
                  type="file"
                  accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  disabled={reading || pending}
                  onChange={(e) => onFile(e.target.files?.[0])}
                />
              </div>
              <Button type="button" variant="ghost" onClick={downloadTemplate}>
                <FileSpreadsheet />
                Download template
              </Button>
            </div>

            {reading && (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" /> Reading the file…
              </p>
            )}

            {fileError && (
              <Alert variant="destructive">
                <AlertCircle />
                <AlertDescription>{fileError}</AlertDescription>
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
                  <p className="mt-1 text-muted-foreground">Rows already in UVfIN (same date, amount, {cfg.kindLabel.toLowerCase()}, {cfg.partyLabel.toLowerCase()} and reference) are skipped.</p>
                </div>

                {tooMany && (
                  <Alert variant="destructive">
                    <AlertCircle />
                    <AlertDescription>
                      At most {IMPORT_MAX_ROWS} rows can be imported at once. Split the file into smaller ones.
                    </AlertDescription>
                  </Alert>
                )}

                {bad.length > 0 && (
                  <div className="rounded-lg border border-destructive/40 p-3">
                    <p className="mb-2 font-medium">Rows with problems (fix them in Excel and import again):</p>
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
            <Button type="button" disabled={pending || !good.length || tooMany || !!parsed?.error} onClick={runImport}>
              {pending && <Loader2 className="animate-spin" />}
              {good.length ? `Import ${good.length} ${good.length === 1 ? 'row' : 'rows'}` : 'Import'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
