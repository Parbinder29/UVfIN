'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { getProfileNames, requireManager, requireReader } from '@/lib/auth'
import { ATTACHMENT_MAX_BYTES, PAGE_SIZE } from '@/lib/constants'
import { toCSV } from '@/lib/csv'
import { formatDate } from '@/lib/format'
import { IMPORT_MAX_BYTES, IMPORT_MAX_ROWS, parseGoogleSheetUrl } from '@/lib/import'
import { LEDGERS, LEDGER_SORTS, type LedgerConfig, type LedgerRow } from '@/lib/ledger'
import { parseListParams } from '@/lib/list-params'
import { getLedgerRows } from '@/lib/queries'
import { createClient } from '@/lib/supabase/server'
import { earningSchema, expenseSchema, uuidSchema } from '@/lib/validators'
import { PAYMENT_METHODS } from '@/lib/constants'
import type { ActionResult } from '@/types'
import { caught, dbError, validationError } from './_shared'

const ledgerKey = z.enum(['expenses', 'earnings'])

function revalidate(key: 'expenses' | 'earnings') {
  revalidatePath(LEDGERS[key].path)
  revalidatePath('/dashboard')
  revalidatePath('/audit-log')
}

export async function saveLedgerEntry(key: unknown, id: unknown, input: unknown): Promise<ActionResult<string>> {
  try {
    await requireManager()
    const k = ledgerKey.parse(key)
    const parsed = (k === 'expenses' ? expenseSchema : earningSchema).safeParse(input)
    if (!parsed.success) return validationError(parsed.error)
    const values: Record<string, unknown> = parsed.data

    const supabase = await createClient()
    let savedId: string
    if (id == null) {
      const { data, error } = await supabase.from(k).insert(values).select('id').single()
      if (error || !data) return dbError(error)
      savedId = data.id
    } else {
      const recordId = uuidSchema.parse(id)
      const { data, error } = await supabase
        .from(k)
        .update(values)
        .eq('id', recordId)
        .eq('is_deleted', false)
        .select('id')
      if (error) return dbError(error)
      if (!data?.length) return { ok: false, error: 'Record not found. It may have been deleted.' }
      savedId = recordId
    }
    revalidate(k)
    return { ok: true, data: savedId }
  } catch (e) {
    return caught(e)
  }
}

export async function deleteLedgerEntry(key: unknown, id: unknown): Promise<ActionResult> {
  try {
    await requireManager()
    const k = ledgerKey.parse(key)
    const recordId = uuidSchema.parse(id)
    const supabase = await createClient()
    const { data, error } = await supabase
      .from(k)
      .update({ is_deleted: true })
      .eq('id', recordId)
      .eq('is_deleted', false)
      .select('id')
    if (error) return dbError(error)
    if (!data?.length) return { ok: false, error: 'Record not found. It may already be deleted.' }
    revalidate(k)
    return { ok: true }
  } catch (e) {
    return caught(e)
  }
}

/** Delete several entries at once (soft delete, like single delete). Each one still gets its own audit log entry. */
export async function deleteLedgerEntries(key: unknown, ids: unknown): Promise<ActionResult<number>> {
  try {
    await requireManager()
    const k = ledgerKey.parse(key)
    const list = z.array(uuidSchema).min(1).max(PAGE_SIZE).safeParse(ids)
    if (!list.success) return { ok: false, error: `Select between 1 and ${PAGE_SIZE} rows.` }
    const supabase = await createClient()
    const { data, error } = await supabase
      .from(k)
      .update({ is_deleted: true })
      .in('id', [...new Set(list.data)])
      .eq('is_deleted', false)
      .select('id')
    if (error) return dbError(error)
    if (!data?.length) return { ok: false, error: 'Those records were not found. They may already be deleted.' }
    revalidate(k)
    return { ok: true, data: data.length }
  } catch (e) {
    return caught(e)
  }
}

/** Same day, amount, category/source, payee/client and reference: treated as already recorded. */
function entryKey(cfg: LedgerConfig, r: Record<string, unknown>): string {
  const t = (v: unknown) => String(v ?? '').trim().toLowerCase()
  return [r[cfg.dateCol], Number(r.amount).toFixed(2), t(r[cfg.kindCol]), t(r[cfg.partyCol]), t(r.reference_no)].join('|')
}

/**
 * Add many entries at once (spreadsheet import). Every row is validated again
 * here. Rows that match an existing entry, or an earlier row of the same
 * import, are skipped, so importing the same sheet twice doesn't double the
 * totals. The rest go in as one insert: all or nothing.
 */
export async function importLedgerEntries(
  key: unknown,
  input: unknown
): Promise<ActionResult<{ added: number; skipped: number }>> {
  try {
    await requireManager()
    const k = ledgerKey.parse(key)
    const cfg = LEDGERS[k]
    const list = z.array(z.unknown()).min(1).max(IMPORT_MAX_ROWS).safeParse(input)
    if (!list.success) return { ok: false, error: `Import between 1 and ${IMPORT_MAX_ROWS} rows at a time.` }

    const schema = k === 'expenses' ? expenseSchema : earningSchema
    const rows: Record<string, unknown>[] = []
    for (const [i, raw] of list.data.entries()) {
      const parsed = schema.safeParse(raw)
      if (!parsed.success) return { ok: false, error: `Row ${i + 1} of the import is not valid. Fix it and try again.` }
      rows.push(parsed.data)
    }

    const supabase = await createClient()
    const dates = rows.map((r) => String(r[cfg.dateCol])).sort()
    const { data: existing, error: readError } = await supabase
      .from(k)
      .select(`${cfg.dateCol}, amount, ${cfg.kindCol}, ${cfg.partyCol}, reference_no`)
      .eq('is_deleted', false)
      .gte(cfg.dateCol, dates[0])
      .lte(cfg.dateCol, dates[dates.length - 1])
      .limit(50000)
    if (readError) return dbError(readError)
    const seen = new Set((existing ?? []).map((r) => entryKey(cfg, r as Record<string, unknown>)))
    const fresh = rows.filter((r) => {
      const rowKey = entryKey(cfg, r)
      if (seen.has(rowKey)) return false
      seen.add(rowKey)
      return true
    })

    if (fresh.length) {
      const { error } = await supabase.from(k).insert(fresh)
      if (error) return dbError(error)
      revalidate(k)
    }
    return { ok: true, data: { added: fresh.length, skipped: rows.length - fresh.length } }
  } catch (e) {
    return caught(e)
  }
}

/**
 * Download one tab of a Google Sheet as CSV. Done on the server because the
 * browser's security policy only allows requests to this site and Supabase.
 * Only docs.google.com export links are ever requested, built from the id.
 */
export async function fetchGoogleSheet(link: unknown): Promise<ActionResult<string>> {
  try {
    await requireManager()
    const sheet = parseGoogleSheetUrl(z.string().max(2000).parse(link))
    if (!sheet) return { ok: false, error: 'Paste the link of a Google Sheet (it starts with https://docs.google.com/spreadsheets/d/).' }

    const notShared =
      'Google did not share this sheet. In Google Sheets, click Share → General access → "Anyone with the link" (Viewer), then try again.'
    let res: Response
    try {
      res = await fetch(`https://docs.google.com/spreadsheets/d/${sheet.id}/export?format=csv&gid=${sheet.gid}`, {
        cache: 'no-store',
        redirect: 'follow',
        signal: AbortSignal.timeout(15000),
      })
    } catch {
      return { ok: false, error: 'Google Sheets did not respond. Please try again.' }
    }
    const finalHost = new URL(res.url).hostname
    const fromGoogleData = finalHost === 'docs.google.com' || finalHost.endsWith('.googleusercontent.com')
    if (res.status === 404) return { ok: false, error: 'That sheet or tab was not found. Check the link.' }
    if (!res.ok || !fromGoogleData || !res.headers.get('content-type')?.includes('text/csv')) {
      await res.body?.cancel()
      return { ok: false, error: notShared }
    }

    // Read at most IMPORT_MAX_BYTES, whatever the server claims the size is.
    const reader = res.body!.getReader()
    const chunks: Uint8Array[] = []
    let size = 0
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > IMPORT_MAX_BYTES) {
        await reader.cancel()
        return { ok: false, error: 'The sheet is larger than 5 MB. Split it into smaller sheets.' }
      }
      chunks.push(value)
    }
    return { ok: true, data: new TextDecoder().decode(Buffer.concat(chunks)) }
  } catch (e) {
    return caught(e)
  }
}

const MAGIC: Record<string, (b: Uint8Array) => boolean> = {
  pdf: (b) => b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46,
  png: (b) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47,
  jpg: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
}

/**
 * Link a file the browser uploaded to Storage to a record. The file is
 * downloaded and checked here (size and real file type) before it is linked.
 */
export async function attachLedgerFile(key: unknown, id: unknown, path: unknown): Promise<ActionResult> {
  try {
    await requireManager()
    const k = ledgerKey.parse(key)
    const recordId = uuidSchema.parse(id)
    const p = z
      .string()
      .regex(/^(expenses|earnings)\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.(pdf|jpg|png)$/)
      .parse(path)
    const [folder, folderId] = p.split('/')
    if (folder !== k || folderId !== recordId) return { ok: false, error: 'Invalid attachment.' }

    const supabase = await createClient()
    const { data: blob, error: dlError } = await supabase.storage.from('attachments').download(p)
    if (dlError || !blob) return { ok: false, error: 'Upload not found. Please try again.' }
    if (blob.size > ATTACHMENT_MAX_BYTES) return { ok: false, error: 'File is larger than 5 MB.' }
    const head = new Uint8Array(await blob.slice(0, 8).arrayBuffer())
    const ext = p.split('.').pop()!
    if (!MAGIC[ext]?.(head)) return { ok: false, error: 'File content does not match a PDF, JPG or PNG.' }

    const { data, error } = await supabase
      .from(k)
      .update({ attachment_path: p })
      .eq('id', recordId)
      .eq('is_deleted', false)
      .select('id')
    if (error) return dbError(error)
    if (!data?.length) return { ok: false, error: 'Record not found.' }
    revalidate(k)
    return { ok: true }
  } catch (e) {
    return caught(e)
  }
}

/** CSV of every row matching the current filters (both roles). */
export async function exportLedger(key: unknown, params: unknown): Promise<ActionResult<string>> {
  try {
    await requireReader()
    const k = ledgerKey.parse(key)
    const cfg = LEDGERS[k]
    const raw = z.record(z.string()).parse(params ?? {})
    const filters = parseListParams(raw, { sortable: LEDGER_SORTS, defaultSort: 'date', kinds: cfg.kinds, methods: PAYMENT_METHODS })
    const [{ rows }, names] = await Promise.all([getLedgerRows(cfg, filters, { exportAll: true }), getProfileNames()])
    const added = (r: LedgerRow) => names[r.created_by] ?? ''
    const attachment = (r: LedgerRow) => (r.attachment_path ? 'Yes' : '')
    // Money Spent exports in the company's accounts-sheet layout, so it can be imported straight back.
    const csv = cfg.sheetColumns
      ? toCSV<LedgerRow & { sr: number }>(rows.map((r, i) => ({ ...r, sr: i + 1 })), [
          { label: 'Sr No', value: (r) => r.sr },
          { label: 'Item / Party', value: (r) => r.party },
          { label: 'Date', value: (r) => formatDate(r.date) },
          { label: 'Amount (₹)', value: (r) => r.amount },
          { label: 'Paid Via', value: (r) => r.payment_method },
          { label: 'Paid By', value: (r) => r.paid_by },
          { label: 'Debit Ledger', value: (r) => r.kind },
          { label: 'Credit Ledger', value: (r) => r.paid_from },
          { label: 'Note', value: (r) => r.description },
          { label: 'Status', value: (r) => r.status },
          { label: 'Reference No', value: (r) => r.reference_no },
          { label: 'Attachment', value: attachment },
          { label: 'Added By', value: added },
        ])
      : toCSV<LedgerRow>(rows, [
      { label: 'Date', value: (r) => formatDate(r.date) },
      { label: cfg.partyLabel, value: (r) => r.party },
      { label: cfg.kindLabel, value: (r) => r.kind },
      { label: 'Description', value: (r) => r.description },
      { label: 'Payment Method', value: (r) => r.payment_method },
      { label: 'Reference No', value: (r) => r.reference_no },
      { label: 'Amount', value: (r) => r.amount },
      { label: 'Attachment', value: attachment },
      { label: 'Added By', value: added },
    ])
    return { ok: true, data: csv }
  } catch (e) {
    return caught(e)
  }
}
