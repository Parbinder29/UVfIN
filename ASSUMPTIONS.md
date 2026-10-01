# Assumptions

Decisions made where the brief was open. Change any of them if they're wrong.

## Platform
- **Next.js 16 renamed `middleware.ts` to `proxy.ts`.** The session refresh and login redirect live in `src/proxy.ts` and `src/lib/supabase/middleware.ts`.
- shadcn/ui components are copied into `src/components/ui` (the standard shadcn approach). `cn()` lives in `src/lib/utils.ts`.
- Next.js was upgraded from 16.3.5 to 16.3.8 to fix a critical advisory (GHSA-vcvr-r3jv-pc5j).

## Data and rules
- Migrations 001 to 003 were kept as written. All changes are in a new `004_hardening.sql`, so a database that already ran 001 to 003 can simply run 004.
- **Deleting an investor = deactivating** (`is_active = false`). Their history and totals stay. New contributions to inactive investors are blocked. The audit log shows this as "Deactivated".
- **Deleted records are final through the app.** Once soft-deleted, a row can't be edited or restored by users. An admin can restore it in the SQL editor if needed.
- **Attachments are evidence**: they can be added or replaced (the record points to the new file), but files are never overwritten or deleted.
- Attachment types are PDF, JPG and PNG (the brief's list). WEBP from the earlier draft was dropped.
- Payment methods: Cash, Bank Transfer, UPI, Cheque, Card, Other, shared by all sections.
- Amounts: positive, at most 2 decimals, below 1 trillion.

## Time
- One **company time zone** (`NEXT_PUBLIC_TIMEZONE`, default `Asia/Kolkata`) is used for "this month", date filters, the dashboard and investment times. The investment form takes date and time in that zone and stores UTC.
- Date-only fields (expense/earning dates) are shown exactly as entered, with no time-zone shift.

## UI
- Native date and date-time inputs are used instead of a calendar popover. They're accessible and work well on phones.
- List filters live in the URL, so pages are server-rendered and a filtered view can be bookmarked or shared.
- Dashboard default range is **This Month**. List pages default to **All Time**.
- The "Investments over time" chart shows the cumulative total within the selected range.
- Donut charts show the top 7 slices plus "Other".
- CSV export covers every row matching the filters, capped at 10,000 rows per export.
- Audit log has no CSV export (not required by the brief).

## Not built (out of scope per brief)
Payment gateways, bank sync, multi-currency, invoicing/GST, payroll, email notifications, multi-company, mobile app, public sign-up, AI features.
