# Progress

- [x] Phase 1: Scaffold (Next.js 16, Tailwind 4, shadcn/ui, deps, git)
- [x] Phase 2: Database (migrations 001-004, storage, seed template, DB security tests)
- [x] Phase 3: Supabase clients, proxy, login/logout, role-aware layout
- [x] Phase 4: Shared building blocks (constants, format, dates, zod, filters, sort, pagination, CSV, dialogs)
- [x] Phase 5: Money Spent, Earnings, Investments, Investors (+ detail page), attachments
- [x] Phase 6: Dashboard (SQL aggregation function) and Audit Log (expandable diffs)
- [x] Phase 7: Polish (dark mode, mobile nav, skeletons, empty/error states, a11y labels, security headers)
- [x] Phase 8: Docs (README, SECURITY, SUPABASE_SETUP, DEPLOY_VERCEL, BACKUP)

## Verification
- `npm run lint` and `npm run build`: pass.
- `supabase/tests`: 33 database checks pass (director writes rejected, no hard deletes, audit user correct, anon sees nothing, and more).
- Browser run against a local Postgres + PostgREST stand-in: manager add/edit/delete/search/export, director read-only on every page, totals match records, investment time and zone correct, mobile and dark mode render.
- Not yet run against a real Supabase project (attachment upload to Storage needs one).
