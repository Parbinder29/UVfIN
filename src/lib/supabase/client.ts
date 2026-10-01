import { createBrowserClient } from '@supabase/ssr'

// Used only for uploading attachments straight to Storage (Vercel limits
// server request bodies to 4.5 MB). RLS and bucket limits still apply, and the
// server re-checks every file before linking it to a record.
export function createClient() {
  return createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
}
