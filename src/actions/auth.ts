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
    // Same message for every failure so the form can't be used to discover accounts.
    if (error.status === 429) return { ok: false, error: 'Too many attempts. Please wait a few minutes and try again.' }
    return { ok: false, error: 'Invalid email or password.' }
  }
  // Fixed destination: no user-controlled redirect target, so no open redirect.
  redirect('/dashboard')
}

export async function logout() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}
