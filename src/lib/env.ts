// Only the two public Supabase values are ever used. The service_role key is
// never read by this app and must never be added to the environment.
export function hasSupabaseEnv(): boolean {
  return !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
}

export function getSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anonKey) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. Add them to .env.local (or to the Vercel Environment Variables).'
    )
  }
  // Only the origin: a URL pasted with a path (e.g. ".../rest/v1/") makes every
  // auth request a 404 "Invalid path specified in request URL".
  return { url: new URL(url.trim()).origin, anonKey: anonKey.trim() }
}

export const CURRENCY = process.env.NEXT_PUBLIC_CURRENCY || 'INR'
export const LOCALE = process.env.NEXT_PUBLIC_LOCALE || 'en-IN'
export const TIMEZONE = process.env.NEXT_PUBLIC_TIMEZONE || 'Asia/Kolkata'
