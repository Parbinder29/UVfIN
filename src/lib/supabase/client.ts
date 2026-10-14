import { createBrowserClient } from '@supabase/ssr'
import { getSupabaseEnv } from '@/lib/env'

// Used only for uploading attachments straight to Storage (Vercel limits
// server request bodies to 4.5 MB). RLS and bucket limits still apply, and the
// server re-checks every file before linking it to a record.
export function createClient() {
  const { url, anonKey } = getSupabaseEnv()
  return createBrowserClient(url, anonKey)
}
