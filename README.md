# UVfIN

**UV** + **f**inance + **IN**: the internal finance dashboard for **UVIN Group** ([uvingroup.com](https://uvingroup.com)).

Two finance members record everything that goes out and comes in by hand. The director can see everything and change nothing.

## Features

- **Money Spent**: every expenditure, with payee, category, payment method, reference, an optional receipt (PDF/JPG/PNG, 5 MB) and who added it.
- **Earnings**: every incoming payment, with source and client.
- **Investments**: investors (members), each contribution with **date and time**, totals per investor, and a detail page with full history.
- **Dashboard**: total earnings, money spent, net balance and investments for any date range, plus a "this month" figure on each. Charts for monthly earnings vs spent, spending by category, earnings by source and investments over time. Shows the 10 most recent entries.
- **Audit log**: every create, edit and delete, with who did it and a before/after view. It is written by the database itself and can't be edited.
- Search, filters (date range, category/source, payment method, investor, min/max amount), sortable columns, 25 rows per page, a total for the filtered rows, and **CSV export** of the filtered rows.
- Light and dark mode, mobile layout, INR formatting (configurable).

## Roles

| Role | Can |
|---|---|
| `finance_manager` (2 people) | Add, edit and delete (soft delete) in every section, manage investors, export CSV, view the audit log |
| `director` (1 person) | View everything and export CSV. No write controls are shown, and the database rejects writes anyway |

There is no sign-up page. The administrator creates accounts in Supabase.

## Stack

Next.js 16 (App Router, TypeScript), Tailwind CSS 4, shadcn/ui, lucide-react, Recharts, react-hook-form + zod, and Supabase (Postgres, Row Level Security, Auth, Storage) via `@supabase/ssr`. Hosted on Vercel. Everything runs on free tiers.

## Security model (short version)

See [SECURITY.md](SECURITY.md) for the full list.

- **Database is the gatekeeper.** Row Level Security on every table. Only finance managers can insert or update. **Nobody** can delete or truncate (privileges are revoked). The audit log and profiles are read-only.
- The database sets `created_by`/`created_at` itself, freezes deleted rows, and only lets contributions go to active investors.
- Server actions re-check the role and validate input with zod before every write. The UI hides write controls from the director.
- Only the public anon/publishable key is used. The service-role key is never needed.
- Strict security headers (CSP, HSTS, no framing). Search input is sanitised. CSV exports are protected against spreadsheet formula injection. Uploaded files are checked by content on the server.

## Local setup

```bash
npm install
# create .env.local with NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY
npm run dev                  # http://localhost:3000
```

You need a Supabase project with the migrations applied first. See [docs/SUPABASE_SETUP.md](docs/SUPABASE_SETUP.md).

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build / serve |
| `npm run lint` | ESLint |
| `cd supabase/tests && npm install && npm test` | Applies all migrations to a throwaway Postgres and checks the RLS and permission rules (no Supabase account needed) |

## Configuration

| Variable | Default | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | required | Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | required | anon or publishable key, never the secret key |
| `NEXT_PUBLIC_CURRENCY` | `INR` | ISO 4217 code |
| `NEXT_PUBLIC_LOCALE` | `en-IN` | number and date formatting |
| `NEXT_PUBLIC_TIMEZONE` | `Asia/Kolkata` | used for "this month", date filters and investment times |

To change categories, earning sources or payment methods, edit `src/lib/constants.ts`.

## Docs

- [docs/SUPABASE_SETUP.md](docs/SUPABASE_SETUP.md): create the database, users and roles
- [docs/DEPLOY_VERCEL.md](docs/DEPLOY_VERCEL.md): publish it, plus an optional `finance.uvingroup.com` domain
- [docs/BACKUP.md](docs/BACKUP.md): backups and keeping the free project awake

## Project layout

```
supabase/migrations/   001_init, 002_rls, 003_storage, 004_hardening (run in order)
supabase/seed.sql      template for the 3 profile rows
supabase/tests/        database security tests
src/proxy.ts           session refresh + login redirect (Next 16's name for middleware)
src/actions/           server actions (all writes, CSV export, signed attachment links)
src/lib/               auth, Supabase clients, queries, validators, formatting, CSV
src/app/(auth)/login   login page
src/app/(app)/         dashboard, money-spent, earnings, investments, audit-log
src/components/        layout, tables, forms, charts, ui (shadcn)
```
