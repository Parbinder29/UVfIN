# Backups and keep-alive

The Supabase free plan has **no automatic backups**, so make your own. Pick at least one of the methods below. Method 2 is the most complete.

## 1. CSV export from the app (anyone, weekly)

On **Money Spent**, **Earnings** and **Investments**, set the date range to **All Time** and click **Export CSV**. Each export includes every matching row, up to 10,000 per file. Save the three files in a dated folder on the company drive, for example `UVfIN-Backups/2026-10-05/`.

The CSVs are readable records, but you can't restore from them automatically. Use method 2 for real restores.

## 2. Full database dump with `pg_dump` (monthly, by the admin)

You need PostgreSQL's `pg_dump` (installed with PostgreSQL, or through the Supabase CLI) and the database password from setup.

1. Supabase → **Connect** (top bar) → **Session pooler** → copy the URI. It looks like
   `postgresql://postgres.<ref>:[YOUR-PASSWORD]@aws-0-ap-south-1.pooler.supabase.com:5432/postgres`
2. Run it in a terminal, typing the password when asked rather than putting it in the command:

```bash
pg_dump "postgresql://postgres.<ref>@aws-0-ap-south-1.pooler.supabase.com:5432/postgres" \
  --schema=public --no-owner --no-privileges -F c -f uvfin-$(date +%F).dump
```

3. Store the `.dump` file somewhere private (it contains all financial data).

To restore into a fresh project, run the migrations first, then:

```bash
pg_restore --data-only --no-owner -d "<new project URI>" uvfin-2026-10-05.dump
```

Alternative without a terminal: Supabase → **Table Editor** → each table → **Export → CSV**.

## 3. Attachments

Supabase → **Storage → attachments** shows the folders `expenses/` and `earnings/`. Download them occasionally. They count against the 1 GB free limit, which is why uploads are capped at 5 MB.

## 4. Keep the project awake

Free Supabase projects **pause after about 7 days with no activity**, and the app then shows "Something went wrong". To avoid it:

- Someone signs in to UVfIN at least once a week (simplest), **or**
- Set up a free scheduled ping, for example a [cron-job.org](https://cron-job.org) job every 3 days that opens your app's `/login` page. That request reaches Vercel but doesn't always count as database activity, so a weekly sign-in is still the reliable option.

If it does pause: Supabase dashboard → the project → **Restore project**. No data is lost.

## 5. Suggested routine

| When | What | Who |
|---|---|---|
| Weekly | Sign in. Export the 3 CSVs | Finance member |
| Monthly | `pg_dump` + download attachments | Admin |
| Each quarter | Test a restore into a scratch project | Admin |
