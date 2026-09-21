# UVfIN - Finance Management Dashboard

Internal finance dashboard for **UVIN Group** (uvingroup.com).

## Overview

UVfIN is a production-ready finance management application where:
- **2 Finance Members** can create, edit, and manage all financial records
- **1 Director** has read-only access to everything

### Core Sections
1. **Money Spent** - Track all expenditures with categories, payees, attachments
2. **Earnings** - Track all income sources with clients, payment methods
3. **Investments** - Manage investors and their contributions with date/time
4. **Dashboard** - KPIs, charts, recent activity overview
5. **Audit Log** - Complete change history with diffs

## Tech Stack

- **Framework**: Next.js 16 (App Router, TypeScript, `src/` directory)
- **Styling**: Tailwind CSS + shadcn/ui + lucide-react
- **Charts**: Recharts
- **Forms**: react-hook-form + zod validation
- **Database/Auth/Storage**: Supabase (PostgreSQL + RLS + Auth + Storage)
- **Deployment**: Vercel + GitHub

## Features

- ✅ Role-based access control (Finance Manager / Director)
- ✅ Row Level Security enforced in database
- ✅ Soft deletes with audit trail
- ✅ CSV export on all data pages
- ✅ Date range filtering with presets
- ✅ Search, sort, pagination
- ✅ Attachment uploads (Supabase Storage)
- ✅ Light/Dark mode
- ✅ Responsive design (mobile sidebar)
- ✅ Currency formatting (INR default, configurable)
- ✅ Loading skeletons & error handling

## Getting Started

### Prerequisites
- Node.js 18+
- npm/pnpm/yarn
- Supabase account (free tier)
- Vercel account (free tier) for deployment

### Local Development

1. **Clone and install**
```bash
git clone <your-repo-url>
cd uvfin
npm install
```

2. **Set up Supabase** (see `docs/SUPABASE_SETUP.md`)
   - Create project
   - Run migrations
   - Create auth users
   - Seed profiles

3. **Configure environment**
```bash
cp .env.example .env.local
```
Edit `.env.local` with your Supabase credentials.

4. **Run development server**
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000)

### Available Scripts

```bash
npm run dev      # Start dev server
npm run build    # Production build
npm run start    # Start production server
npm run lint     # Run ESLint
```

## Project Structure

```
uvfin/
├─ supabase/
│  ├─ migrations/     # SQL migrations (001_init, 002_rls, 003_storage)
│  └─ seed.sql        # Profile seed template
├─ src/
│  ├─ app/
│  │  ├─ (auth)/login/
│  │  ├─ (app)/
│  │  │  ├─ dashboard/
│  │  │  ├─ money-spent/
│  │  │  ├─ earnings/
│  │  │  ├─ investments/
│  │  │  └─ audit-log/
│  │  ├─ auth/callback/
│  │  └─ layout.tsx
│  ├─ components/
│  │  ├─ ui/          # shadcn/ui components
│  │  └─ layout/      # Sidebar, Header
│  ├─ lib/
│  │  ├─ supabase/    # Client/Server/Middleware clients
│  │  ├─ auth.ts      # Auth helpers
│  │  ├─ constants.ts # Categories, sources, payment methods
│  │  ├─ format.ts    # Currency/date formatting
│  │  ├─ validators.ts# Zod schemas
│  │  └─ csv.ts       # CSV export utilities
│  ├─ actions/        # Server Actions (CRUD)
│  └─ types/
├─ docs/              # Setup & deployment guides
├─ .env.example
└─ package.json
```

## Documentation

- [`docs/SUPABASE_SETUP.md`](docs/SUPABASE_SETUP.md) - Step-by-step Supabase setup
- [`docs/DEPLOY_VERCEL.md`](docs/DEPLOY_VERCEL.md) - Vercel deployment guide
- [`docs/BACKUP.md`](docs/BACKUP.md) - Backup strategy for free tier

## Deployment

See [`docs/DEPLOY_VERCEL.md`](docs/DEPLOY_VERCEL.md) for complete deployment instructions.

Quick steps:
1. Push to GitHub
2. Import in Vercel
3. Add environment variables
4. Update Supabase Auth redirect URLs
5. (Optional) Configure custom domain

## Security

- All writes go through Server Actions with role verification
- Row Level Security on every table
- No service role key exposed
- Security headers in `next.config.ts`
- No public sign-up (admin-only user creation)

## Free Tier Constraints

- Supabase: 500 MB database, 1 GB storage
- Vercel: 100 GB bandwidth/month
- No paid services used
- Project pauses after ~7 days inactivity (see `docs/BACKUP.md` for keep-alive)

## License

Private - UVIN Group internal use only.