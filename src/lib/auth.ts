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

/**
 * The signed-in user and their profile. The session token's signature and
 * expiry are verified (getClaims), which with Supabase's asymmetric signing
 * keys happens here without a round trip to Supabase Auth. Cached per request.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  const claims = data?.claims
  if (!claims?.sub) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, full_name, role')
    .eq('id', claims.sub)
    .maybeSingle()

  return { id: claims.sub, email: typeof claims.email === 'string' ? claims.email : '', profile: (profile as Profile | null) ?? null }
})

/** For pages: signed in with a profile, otherwise redirect. */
export async function requireUser() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  if (!user.profile) redirect('/no-access')
  return { ...user, profile: user.profile }
}

/**
 * requireUser(), with the page's data loading at the same time instead of
 * after it (RLS guards the data either way). A redirect to /login or
 * /no-access still wins over any error from the data.
 */
export async function requireUserWith<T>(data: Promise<T>) {
  data.catch(() => {})
  const user = await requireUser()
  return [user, await data] as const
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
