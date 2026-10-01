'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { getProfileNames, requireManager, requireReader } from '@/lib/auth'
import { ATTACHMENT_MAX_BYTES } from '@/lib/constants'
import { toCSV } from '@/lib/csv'
import { formatDate } from '@/lib/format'
import { LEDGERS, LEDGER_SORTS, type LedgerRow } from '@/lib/ledger'
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
    const csv = toCSV<LedgerRow>(rows, [
      { label: 'Date', value: (r) => formatDate(r.date) },
      { label: cfg.partyLabel, value: (r) => r.party },
      { label: cfg.kindLabel, value: (r) => r.kind },
      { label: 'Description', value: (r) => r.description },
      { label: 'Payment Method', value: (r) => r.payment_method },
      { label: 'Reference No', value: (r) => r.reference_no },
      { label: 'Amount', value: (r) => r.amount },
      { label: 'Attachment', value: (r) => (r.attachment_path ? 'Yes' : '') },
      { label: 'Added By', value: (r) => names[r.created_by] ?? '' },
    ])
    return { ok: true, data: csv }
  } catch (e) {
    return caught(e)
  }
}
