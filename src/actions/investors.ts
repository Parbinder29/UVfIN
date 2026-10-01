'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireManager } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { investorSchema, uuidSchema } from '@/lib/validators'
import type { ActionResult } from '@/types'
import { caught, dbError, validationError } from './_shared'

function revalidate() {
  revalidatePath('/investments', 'layout')
  revalidatePath('/dashboard')
  revalidatePath('/audit-log')
}

export async function saveInvestor(id: unknown, input: unknown): Promise<ActionResult> {
  try {
    await requireManager()
    const parsed = investorSchema.safeParse(input)
    if (!parsed.success) return validationError(parsed.error)
    const supabase = await createClient()
    if (id == null) {
      const { error } = await supabase.from('investors').insert(parsed.data)
      if (error) return dbError(error)
    } else {
      const { data, error } = await supabase.from('investors').update(parsed.data).eq('id', uuidSchema.parse(id)).select('id')
      if (error) return dbError(error)
      if (!data?.length) return { ok: false, error: 'Investor not found.' }
    }
    revalidate()
    return { ok: true }
  } catch (e) {
    return caught(e)
  }
}

/** Investors are never deleted (contributions point at them); they are deactivated. */
export async function setInvestorActive(id: unknown, active: unknown): Promise<ActionResult> {
  try {
    await requireManager()
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('investors')
      .update({ is_active: z.boolean().parse(active) })
      .eq('id', uuidSchema.parse(id))
      .select('id')
    if (error) return dbError(error)
    if (!data?.length) return { ok: false, error: 'Investor not found.' }
    revalidate()
    return { ok: true }
  } catch (e) {
    return caught(e)
  }
}
