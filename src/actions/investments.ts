'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { getProfileNames, requireManager, requireReader } from '@/lib/auth'
import { PAYMENT_METHODS } from '@/lib/constants'
import { toCSV } from '@/lib/csv'
import { formatDateTime } from '@/lib/format'
import { parseListParams } from '@/lib/list-params'
import { INVESTMENT_SORTS, getInvestments, getInvestorSummaries } from '@/lib/queries'
import { createClient } from '@/lib/supabase/server'
import { investmentSchema, uuidSchema } from '@/lib/validators'
import type { ActionResult, Investment } from '@/types'
import { caught, dbError, validationError } from './_shared'

function revalidate() {
  revalidatePath('/investments', 'layout')
  revalidatePath('/dashboard')
  revalidatePath('/audit-log')
}

export async function saveInvestment(id: unknown, input: unknown): Promise<ActionResult> {
  try {
    await requireManager()
    const parsed = investmentSchema.safeParse(input)
    if (!parsed.success) return validationError(parsed.error)
    const supabase = await createClient()
    if (id == null) {
      const { error } = await supabase.from('investments').insert(parsed.data)
      if (error) return dbError(error)
    } else {
      const { data, error } = await supabase
        .from('investments')
        .update(parsed.data)
        .eq('id', uuidSchema.parse(id))
        .eq('is_deleted', false)
        .select('id')
      if (error) return dbError(error)
      if (!data?.length) return { ok: false, error: 'Investment not found. It may have been deleted.' }
    }
    revalidate()
    return { ok: true }
  } catch (e) {
    return caught(e)
  }
}

export async function deleteInvestment(id: unknown): Promise<ActionResult> {
  try {
    await requireManager()
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('investments')
      .update({ is_deleted: true })
      .eq('id', uuidSchema.parse(id))
      .eq('is_deleted', false)
      .select('id')
    if (error) return dbError(error)
    if (!data?.length) return { ok: false, error: 'Investment not found. It may already be deleted.' }
    revalidate()
    return { ok: true }
  } catch (e) {
    return caught(e)
  }
}

export async function exportInvestments(params: unknown): Promise<ActionResult<string>> {
  try {
    await requireReader()
    const raw = z.record(z.string()).parse(params ?? {})
    const filters = parseListParams(raw, { sortable: INVESTMENT_SORTS, defaultSort: 'date', methods: PAYMENT_METHODS })
    const [{ rows }, investors, names] = await Promise.all([
      getInvestments(filters, { exportAll: true }),
      getInvestorSummaries(),
      getProfileNames(),
    ])
    const investorNames = Object.fromEntries(investors.map((i) => [i.id, i.full_name]))
    const csv = toCSV<Investment>(rows, [
      { label: 'Date & Time', value: (r) => formatDateTime(r.invested_at) },
      { label: 'Investor', value: (r) => investorNames[r.investor_id] ?? '' },
      { label: 'Amount', value: (r) => r.amount },
      { label: 'Payment Method', value: (r) => r.payment_method },
      { label: 'Reference No', value: (r) => r.reference_no },
      { label: 'Notes', value: (r) => r.notes },
      { label: 'Added By', value: (r) => names[r.created_by] ?? '' },
    ])
    return { ok: true, data: csv }
  } catch (e) {
    return caught(e)
  }
}
