'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { loginSchema } from '@/lib/validators'
import type { ActionResult } from '@/types'

export async function login(input: unknown): Promise<ActionResult> {
  const parsed = loginSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'Enter your email and password.' }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword(parsed.data)
  if (error) {
    // Never log the email or password. The code and status show up in the
    // Vercel function logs so a setup problem can be told apart from a typo.
    console.error('Login failed', { code: error.code, status: error.status, message: error.message })
    if (error.status === 429) return { ok: false, error: 'Too many attempts. Please wait a few minutes and try again.' }
    // Wrong email, wrong password and unconfirmed accounts all get the same
    // message so the form can't be used to discover accounts.
    if (error.code === 'invalid_credentials' || error.code === 'email_not_confirmed') {
      return { ok: false, error: 'Invalid email or password.' }
    }
    // Anything else (bad Supabase URL or key, email sign-in turned off,
    // Supabase unreachable) is a setup problem, the same for every account.
    return { ok: false, error: 'Sign-in is not working right now because of a setup problem. Please tell the administrator.' }
  }
  // Fixed destination: no user-controlled redirect target, so no open redirect.
  redirect('/dashboard')
}

export async function logout() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}
