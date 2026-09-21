# Backup Strategy for UVfIN

Since Supabase Free tier doesn't include automated backups, you must implement your own backup strategy.

## 1. Automated CSV Exports (Application-Level)

The app has built-in CSV export on every data page:
- **Money Spent** → Export filtered expenses
- **Earnings** → Export filtered earnings
- **Investments** → Export filtered contributions
- **Investors** → Export investor list with totals
- **Audit Log** → Export audit trail

**Schedule**: Manual weekly exports recommended. Assign to one Finance Manager.

### Export Checklist (Weekly)
- [ ] Money Spent (All Time)
- [ ] Earnings (All Time)
- [ ] Investments (All Time)
- [ ] Investors (All)
- [ ] Audit Log (All Time)

Store exports in secure cloud storage (Google Drive, OneDrive, etc.) with date-organized folders:
```
/UVfIN-Backups/
  /2024-01-15/
    expenses.csv
    earnings.csv
    investments.csv
    investors.csv
    audit-log.csv
```

## 2. Database-Level Backups (Supabase SQL)

### Option A: Supabase Dashboard (Manual)

1. Go to **Database** → **Backups** (only shows if you have backups enabled on paid plans)
2. On Free tier: Use **SQL Editor** to run:

```sql
-- Full data dump (run in SQL Editor, then copy output)
-- For each table:
COPY (SELECT * FROM public.expenses) TO STDOUT WITH CSV HEADER;
COPY (SELECT * FROM public.earnings) TO STDOUT WITH CSV HEADER;
COPY (SELECT * FROM public.investors) TO STDOUT WITH CSV HEADER;
COPY (SELECT * FROM public.investments) TO STDOUT WITH CSV HEADER;
COPY (SELECT * FROM public.profiles) TO STDOUT WITH CSV HEADER;
COPY (SELECT * FROM public.audit_log) TO STDOUT WITH CSV HEADER;
```

### Option B: pg_dump via CLI (Recommended for automation)

**Prerequisites:**
- PostgreSQL client tools installed (`pg_dump`)
- Supabase database password (from project settings)

```bash
# Get connection string from Supabase: Settings → Database → Connection string → URI
# Format: postgresql://postgres:[PASSWORD]@db.[REF].supabase.co:5432/postgres

# Full backup
pg_dump "postgresql://postgres:YOUR_PASSWORD@db.YOUR_REF.supabase.co:5432/postgres" \
  --no-owner --no-acl --clean --if-exists \
  > uvfin-backup-$(date +%Y%m%d).sql

# Data only (smaller, faster)
pg_dump "postgresql://postgres:YOUR_PASSWORD@db.YOUR_REF.supabase.co:5432/postgres" \
  --data-only --no-owner --no-acl \
  > uvfin-data-backup-$(date +%Y%m%d).sql

# Specific tables only
pg_dump "postgresql://postgres:YOUR_PASSWORD@db.YOUR_REF.supabase.co:5432/postgres" \
  --data-only --no-owner --no-acl \
  -t expenses -t earnings -t investors -t investments -t profiles -t audit_log \
  > uvfin-core-data-$(date +%Y%m%d).sql
```

### Option C: GitHub Actions Automated Backup (Free)

Create `.github/workflows/backup.yml`:

```yaml
name: Daily Database Backup

on:
  schedule:
    - cron: '0 2 * * *'  # Daily at 2 AM UTC
  workflow_dispatch:  # Manual trigger

jobs:
  backup:
    runs-on: ubuntu-latest
    env:
      PGPASSWORD: ${{ secrets.SUPABASE_DB_PASSWORD }}
    steps:
      - name: Install PostgreSQL client
        run: sudo apt-get update && sudo apt-get install -y postgresql-client

      - name: Dump database
        run: |
          pg_dump "postgresql://postgres:${PGPASSWORD}@db.${{ secrets.SUPABASE_REF }}.supabase.co:5432/postgres" \
            --data-only --no-owner --no-acl \
            -t expenses -t earnings -t investors -t investments -t profiles -t audit_log \
            > backup-$(date +%Y%m%d).sql

      - name: Compress
        run: gzip backup-$(date +%Y%m%d).sql

      - name: Upload to GitHub Artifacts
        uses: actions/upload-artifact@v4
        with:
          name: db-backup
          path: backup-*.sql.gz
          retention-days: 30
```

**Required GitHub Secrets:**
- `SUPABASE_DB_PASSWORD` - Your Supabase database password
- `SUPABASE_REF` - Your project reference (e.g., `abcdefghijklmnop`)

> **Note**: GitHub Actions artifacts expire after 30 days on free plan. For longer retention, upload to cloud storage (see Option D).

### Option D: Upload to Cloud Storage (AWS S3 / Google Cloud / Azure)

```bash
# Example: Upload to AWS S3 (requires AWS CLI configured)
pg_dump "postgresql://postgres:$PGPASSWORD@db.$SUPABASE_REF.supabase.co:5432/postgres" \
  --data-only --no-owner --no-acl | gzip | \
  aws s3 cp - s3://your-bucket/uvfin/backup-$(date +%Y%m%d).sql.gz
```

## 3. Storage Bucket Backups (Attachments)

Attachments are stored in Supabase Storage bucket `attachments`.

### List and Download All Files

```bash
# Using Supabase CLI (install: npm i -g supabase)
supabase storage ls attachments --project-ref YOUR_REF

# Download all (requires Supabase CLI v2+)
supabase storage cp -r attachments s3://your-bucket/uvfin/attachments/
```

### Or via Dashboard
1. Go to **Storage** → `attachments`
2. Select all → Download

## 4. Restore Procedures

### From CSV Exports
1. Log in as Finance Manager
2. Use "Add" forms to re-enter data (tedious but works)
3. Or write a custom import script using Server Actions

### From SQL Dump
```bash
# Restore to Supabase (requires database password)
psql "postgresql://postgres:PASSWORD@db.REF.supabase.co:5432/postgres" < uvfin-backup-20240115.sql
```

### From pg_dump Data-Only
```bash
# Safer - only restores data, preserves schema
psql "postgresql://postgres:PASSWORD@db.REF.supabase.co:5432/postgres" < uvfin-data-backup-20240115.sql
```

## 5. Recommended Backup Schedule

| Frequency | Method | Retention |
|-----------|--------|-----------|
| **Daily** | GitHub Actions pg_dump (data-only) | 30 days |
| **Weekly** | Manual CSV exports (all pages) | 1 year |
| **Monthly** | Full pg_dump + Storage sync | 2 years |
| **Before major changes** | Manual SQL dump | Keep until verified |

## 6. Free Tier Considerations

### Supabase Free Tier Limits
- **Database size**: 500 MB (monitor in Dashboard → Database → Size)
- **Storage**: 1 GB (monitor in Storage)
- **Project pauses** after ~7 days of inactivity

### Keep-Alive Strategy
To prevent project pause (which stops backups from running):

1. **Manual**: Log in weekly
2. **Automated**: Set up a free cron job (cron-job.org, uptimerobot.com) to ping your Vercel URL:
   ```
   https://your-app.vercel.app/api/keep-alive
   ```

   Create `src/app/api/keep-alive/route.ts`:
   ```typescript
   export async function GET() {
     return new Response('OK', { status: 200 })
   }
   ```

3. **GitHub Actions**: The daily backup workflow itself keeps the project active

## 7. Verification Checklist

After each backup, verify:
- [ ] SQL file is not empty (> 1 KB)
- [ ] CSV exports open correctly in Excel/Google Sheets
- [ ] Row counts match expectations
- [ ] Backup can be restored (test quarterly on a separate Supabase project)

## 8. Disaster Recovery Plan

| Scenario | Recovery Time | Steps |
|----------|---------------|-------|
| Accidental delete (soft) | < 1 min | Un-delete via Audit Log or Admin SQL |
| Accidental hard delete | < 30 min | Restore from latest pg_dump |
| Supabase project deleted | < 2 hours | 1. Create new Supabase project 2. Run migrations 3. Restore pg_dump 4. Update Vercel env vars |
| Vercel deployment broken | < 15 min | Re-deploy from GitHub main branch |

---

**Remember**: The best backup is the one you've tested restoring. Do a test restore quarterly!