import 'server-only'
import type { PostgrestError } from '@supabase/supabase-js'
import type { ZodError } from 'zod'
import { AuthError } from '@/lib/auth'
import type { ActionResult } from '@/types'

/** Turn a database error into a message that is safe to show. Never leaks SQL details. */
export function dbError(error: PostgrestError | null, fallback = 'Something went wrong. Please try again.'): ActionResult<never> {
  if (!error) return { ok: false, error: fallback }
  // Log only the code, never row data.
  console.error('db error', error.code)
  if (error.code === '42501') return { ok: false, error: 'You are not allowed to make this change.' }
  if (error.message?.includes('Investor is inactive')) return { ok: false, error: 'That investor is inactive. Reactivate them first.' }
  if (error.message?.includes('Deleted records cannot be changed')) return { ok: false, error: 'This record was deleted and can no longer be changed.' }
  if (error.code === '23514') return { ok: false, error: 'One of the values is not allowed.' }
  if (error.code === '23503') return { ok: false, error: 'A linked record no longer exists.' }
  return { ok: false, error: fallback }
}

export function validationError(error: ZodError): ActionResult<never> {
  return { ok: false, error: 'Please fix the highlighted fields.', fieldErrors: error.flatten().fieldErrors as Record<string, string[]> }
}

export function caught(e: unknown): ActionResult<never> {
  if (e instanceof AuthError) return { ok: false, error: e.message }
  console.error('action failed')
  return { ok: false, error: 'Something went wrong. Please try again.' }
}
