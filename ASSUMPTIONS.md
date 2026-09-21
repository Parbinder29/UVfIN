# Assumptions Made During Development

## 1. Authentication & Users
- **No email confirmation flow**: Users are created by admin in Supabase dashboard with "Auto confirm" checked. No "forgot password" or email verification flows built.
- **Exactly 3 users**: 2 Finance Managers + 1 Director. No support for additional users without manual Supabase dashboard work.
- **Password reset**: Handled entirely in Supabase dashboard by admin.

## 2. Currency & Localization
- **Default currency**: INR (₹) with `en-IN` locale
- **Configurable**: Via `NEXT_PUBLIC_CURRENCY` and `NEXT_PUBLIC_LOCALE` env vars
- **No multi-currency support**: Single currency for entire app

## 3. Data Model
- **Categories/Sources/Payment Methods**: Hardcoded in `src/lib/constants.ts` - easy to modify but require code change + redeploy
- **Investment time precision**: Stored as `timestamptz` (date + time), displayed in local time
- **Attachment storage**: Single `attachments` bucket, organized by table prefix (`expenses/`, `earnings/`)
- **File size limit**: 5 MB per file (enforced client-side, should add server-side)

## 4. UI/UX Decisions
- **Sidebar collapse**: Icon-only mode on desktop, drawer on mobile
- **Date pickers**: Native `<input type="date">` and `<input type="datetime-local">` - no external date picker library
- **Charts**: Recharts with vertical bar chart for monthly comparison, donut charts for categories/sources, area chart for investments
- **Pagination**: 25 rows per page, client-side page state
- **Empty states**: Friendly messages with icons
- **Loading states**: Skeleton loaders for all data sections

## 5. Security
- **RLS policies**: Enforced at database level, not just UI
- **Server Actions**: All mutations validate role server-side
- **No service role key**: Only anon key used
- **Audit log**: Trigger-based, captures INSERT/UPDATE/SOFT_DELETE with old/new JSON

## 6. Free Tier Optimizations
- **Pagination**: All lists paginated (25/page)
- **Select columns**: Explicit column selection, no `SELECT *`
- **Indexes**: Created on date columns, foreign keys, audit log
- **Attachments**: 5 MB max, private bucket

## 7. Not Implemented (Out of Scope)
- Payment gateways / bank sync
- Multi-currency conversion
- Invoicing / GST filing
- Payroll
- Email notifications
- Multi-company support
- Mobile app
- Public sign-up
- AI features

## 8. Technical Choices
- **Server Components by default**: Data fetching in Server Components, interactive parts as Client Components
- **Server Actions for mutations**: Instead of API routes
- **@supabase/ssr**: For cookie-based session management
- **Middleware**: Session refresh + route protection
- **shadcn/ui**: Copied components (not npm package) for full customization
- **zod**: Validation on both client and server

## 9. Known Limitations
- **Investor detail page**: Not implemented (route exists in sidebar but no page)
- **Attachment preview/download**: Basic link only, no inline preview
- **Bulk operations**: No bulk delete/edit/import
- **Advanced filtering**: No saved filters, no column visibility toggle
- **Real-time updates**: No Supabase Realtime subscriptions
- **Audit log pagination**: Basic pagination only, no infinite scroll

## 10. Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Required | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Required | Supabase anon key |
| `NEXT_PUBLIC_CURRENCY` | `INR` | ISO currency code |
| `NEXT_PUBLIC_LOCALE` | `en-IN` | BCP 47 locale tag |