# UVfIN security

## Layers

1. **Postgres Row Level Security** (`002_rls.sql`, `004_hardening.sql`)
   - Every table has RLS on. Reads need a `profiles` row. Inserts and updates need `role = finance_manager`.
   - `DELETE`, `TRUNCATE`, `TRIGGER` and `REFERENCES` are revoked from `authenticated`. `anon` has no table, sequence or function access.
   - `profiles` and `audit_log` can't be written through the API.
   - A trigger forces `created_by = auth.uid()` and fixes `created_at`, so records can't be attributed to someone else.
   - Soft-deleted rows are frozen. Contributions can only be recorded against active investors.
   - Text length and amount limits are enforced with `CHECK` constraints.
   - Reporting functions and the `investor_summary` view are `SECURITY INVOKER`, so RLS still applies.
2. **Audit trail**: `SECURITY DEFINER` triggers write every insert, update and soft delete with the acting user. Nobody can edit or delete audit rows.
3. **Storage**: the `attachments` bucket is private, limited to 5 MB and PDF/JPG/PNG. Only managers can upload, and only under `expenses/` or `earnings/`. Nobody can overwrite or delete a file through the API, so receipts stay as evidence. Files are opened through 60-second signed URLs.
4. **Server**: every write is a server action that first verifies the session with `auth.getUser()`, re-checks the role and validates the input with zod (the same schemas the forms use). Database errors are mapped to safe messages.
5. **Edge (proxy)**: refreshes the session and redirects signed-out visitors to `/login`. Auth-cookie responses carry no-cache headers.
6. **Browser**: CSP (`frame-ancestors 'none'`, `object-src 'none'`, `connect-src` limited to the Supabase project), HSTS, `X-Frame-Options: DENY`, `nosniff`, a strict referrer policy, a locked-down Permissions-Policy, and `noindex`.

## Input handling

- Free-text search is stripped of characters with meaning in PostgREST filters or `LIKE` patterns.
- Sort columns, filters and IDs from the URL are checked against allow-lists or UUID format.
- CSV cells starting with `= + - @` are prefixed so spreadsheets don't run them as formulas.
- Uploads are re-checked on the server by size and file signature (magic bytes) before being linked to a record.
- Login gives the same error for unknown emails and wrong passwords, redirects only to a fixed path, and relies on Supabase Auth rate limits.

## Keys

Only `NEXT_PUBLIC_SUPABASE_URL` and the anon/publishable key are used. Never add the service-role/secret key to the app or to Vercel.

## Testing

`cd supabase/tests && npm install && npm test` applies all migrations to a throwaway Postgres and checks that the director can't write, that nobody can hard-delete, that the audit trail records the right user, and that anonymous users see nothing.
