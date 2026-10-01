// Only the two public Supabase values are ever used. The service_role key is
// never read by this app and must never be added to the environment.
export function getSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anonKey) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. Copy .env.example to .env.local and fill them in.'
    )
  }
  return { url, anonKey }
}

export const CURRENCY = process.env.NEXT_PUBLIC_CURRENCY || 'INR'
export const LOCALE = process.env.NEXT_PUBLIC_LOCALE || 'en-IN'
export const TIMEZONE = process.env.NEXT_PUBLIC_TIMEZONE || 'Asia/Kolkata'
