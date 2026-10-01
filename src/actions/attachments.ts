'use server'

import { z } from 'zod'
import { requireReader } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import type { ActionResult } from '@/types'
import { caught } from './_shared'

const pathSchema = z.string().regex(/^(expenses|earnings)\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.(pdf|jpg|png)$/)

/** A short-lived link to view a private attachment (both roles). */
export async function getAttachmentUrl(path: unknown): Promise<ActionResult<string>> {
  try {
    await requireReader()
    const p = pathSchema.safeParse(path)
    if (!p.success) return { ok: false, error: 'Invalid attachment.' }
    const supabase = await createClient()
    const { data, error } = await supabase.storage.from('attachments').createSignedUrl(p.data, 60)
    if (error || !data) return { ok: false, error: 'Could not open the attachment.' }
    return { ok: true, data: data.signedUrl }
  } catch (e) {
    return caught(e)
  }
}
