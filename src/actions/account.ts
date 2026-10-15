'use server'

import { redirect } from 'next/navigation'
import { requireReader } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { changePasswordSchema } from '@/lib/validators'
import type { ActionResult } from '@/types'
import { caught, validationError } from './_shared'

/**
 * Change your own password. The current password is checked first, so a
 * session left open on someone else's computer can't be used to take over the
 * account. Afterwards every other device is signed out.
 */
export async function changePassword(input: unknown): Promise<ActionResult> {
  try {
    const user = await requireReader()
    const parsed = changePasswordSchema.safeParse(input)
    if (!parsed.success) return validationError(parsed.error)
    if (!user.email) return { ok: false, error: 'Your account has no email address. Ask the administrator.' }

    const supabase = await createClient()
    const check = await supabase.auth.signInWithPassword({ email: user.email, password: parsed.data.current })
    if (check.error) {
      if (check.error.status === 429) return { ok: false, error: 'Too many attempts. Please wait a few minutes and try again.' }
      if (check.error.code === 'invalid_credentials') {
        return { ok: false, error: 'Your current password is not correct.', fieldErrors: { current: ['Your current password is not correct.'] } }
      }
      console.error('Password check failed', { code: check.error.code, status: check.error.status })
      return { ok: false, error: 'Your password could not be changed right now. Please try again.' }
    }

    const { error } = await supabase.auth.updateUser({ password: parsed.data.next })
    if (error) {
      console.error('Password change failed', { code: error.code, status: error.status })
      if (error.code === 'same_password') return { ok: false, error: 'Choose a password different from the current one.' }
      if (error.code === 'weak_password') return { ok: false, error: 'Supabase says this password is too weak. Try a longer one.' }
      if (error.code === 'reauthentication_needed') {
        return { ok: false, error: '"Secure password change" is turned on in Supabase. Ask the administrator to turn it off, or to reset your password.' }
      }
      return { ok: false, error: 'Your password could not be changed right now. Please try again.' }
    }

    // Sessions on other devices end; this one stays signed in.
    await supabase.auth.signOut({ scope: 'others' })
    return { ok: true }
  } catch (e) {
    return caught(e)
  }
}

/** Sign out on every device, including this one. */
export async function signOutEverywhere() {
  const supabase = await createClient()
  await supabase.auth.signOut({ scope: 'global' })
  redirect('/login')
}
