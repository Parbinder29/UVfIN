import 'server-only'
import { cache } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Profile } from '@/types'

export interface CurrentUser {
  id: string
  email: string
  profile: Profile | null
}

/** The signed-in user and their profile, verified with Supabase Auth. Cached per request. */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, full_name, role')
    .eq('id', user.id)
    .maybeSingle()

  return { id: user.id, email: user.email ?? '', profile: (profile as Profile | null) ?? null }
})

/** For pages: signed in with a profile, otherwise redirect. */
export async function requireUser() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  if (!user.profile) redirect('/no-access')
  return { ...user, profile: user.profile }
}

export class AuthError extends Error {}

/**
 * For server actions that write data. Throws unless the caller is a finance
 * manager. RLS enforces the same rule in the database; this is the second lock.
 */
export async function requireManager() {
  const user = await getCurrentUser()
  if (!user?.profile) throw new AuthError('You are not signed in.')
  if (user.profile.role !== 'finance_manager') throw new AuthError('Only finance managers can make changes.')
  return { ...user, profile: user.profile }
}

/** For server actions that only read (e.g. CSV export). */
export async function requireReader() {
  const user = await getCurrentUser()
  if (!user?.profile) throw new AuthError('You are not signed in.')
  return { ...user, profile: user.profile }
}

/** Map of profile id to name, for "Added By" / "Who" columns. Only 3 rows exist. */
export const getProfileNames = cache(async (): Promise<Record<string, string>> => {
  const supabase = await createClient()
  const { data } = await supabase.from('profiles').select('id, full_name').limit(100)
  return Object.fromEntries((data ?? []).map((p) => [p.id, p.full_name]))
})
