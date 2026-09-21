# Supabase Setup Guide for UVfIN

This guide walks you through setting up the Supabase project for UVfIN from scratch.

## 1. Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign in (or create a free account)
2. Click **"New Project"**
3. Choose your organization
4. Fill in:
   - **Name**: `uvfin` (or your preferred name)
   - **Database Password**: Generate a strong password (save it!)
   - **Region**: Choose closest to your users (e.g., `ap-south-1` for India)
5. Click **"Create new project"**
6. Wait 2-3 minutes for provisioning

## 2. Get Project Credentials

1. In your Supabase dashboard, go to **Settings** → **API**
2. Copy these values:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon (public) key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## 3. Run Database Migrations

1. In Supabase dashboard, go to **SQL Editor**
2. Click **"New query"**
3. Run each migration file **in order** (copy-paste the entire content):

### 3.1 Run `001_init.sql`
```sql
-- Copy entire content from supabase/migrations/001_init.sql
```

Click **Run** (or Ctrl+Enter)

### 3.2 Run `002_rls.sql`
```sql
-- Copy entire content from supabase/migrations/002_rls.sql
```

Click **Run**

### 3.3 Run `003_storage.sql`
```sql
-- Copy entire content from supabase/migrations/003_storage.sql
```

Click **Run**

> **Note**: If you get "relation already exists" errors, that's fine - it means the migration already ran.

## 4. Create Auth Users

1. Go to **Authentication** → **Users**
2. Click **"Add user"** → **"Create new user"**
3. Create 3 users (one for each role):

| Email | Password | Role |
|-------|----------|------|
| `finance1@uvingroup.com` | (set a strong password) | Finance Manager |
| `finance2@uvingroup.com` | (set a strong password) | Finance Manager |
| `director@uvingroup.com` | (set a strong password) | Director |

**Important**: Check **"Auto confirm user"** for each user so they can log in immediately without email confirmation.

4. Copy the **User UUID** for each created user (you'll need these for the seed file)

## 5. Seed the Profiles Table

1. Go to **SQL Editor** → **New query**
2. Open `supabase/seed.sql` from the project
3. Replace the placeholder UUIDs with the actual User UUIDs from step 4:

```sql
-- Example (replace with actual UUIDs):
INSERT INTO public.profiles (id, full_name, role) VALUES
  ('<AUTH_USER_UUID_FINANCE_1>', 'Finance Member 1', 'finance_manager'),
  ('<AUTH_USER_UUID_FINANCE_2>', 'Finance Member 2', 'finance_manager'),
  ('<AUTH_USER_UUID_DIRECTOR>', 'Director Name', 'director')
ON CONFLICT (id) DO UPDATE SET
  full_name = EXCLUDED.full_name,
  role = EXCLUDED.role;
```

4. Click **Run**

## 6. Configure Auth Settings

1. Go to **Authentication** → **Settings**
2. Under **Site URL**: Add your local dev URL: `http://localhost:3000`
3. Under **Redirect URLs**: Add:
   - `http://localhost:3000/auth/callback`
   - (Later: `https://your-vercel-app.vercel.app/auth/callback`)
4. **Disable public sign-ups**:
   - Go to **Authentication** → **Providers**
   - Find **Email** provider
   - Turn OFF **"Enable signup"**
   - This ensures only admin-created accounts can access the app

## 7. Configure Storage (Attachments)

The `003_storage.sql` migration creates the bucket. Verify:
1. Go to **Storage** in the sidebar
2. You should see `attachments` bucket (private)
3. Policies should allow:
   - Both roles can read (view/download)
   - Only `finance_manager` can upload

## 8. Create Local Environment File

Copy `.env.example` to `.env.local` and fill in:

```bash
cp .env.example .env.local
```

Edit `.env.local`:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
NEXT_PUBLIC_CURRENCY=INR
NEXT_PUBLIC_LOCALE=en-IN
```

## 9. Test Locally

```bash
npm run dev
```

Open `http://localhost:3000` - you should be redirected to `/login`

Log in with one of the accounts you created.

## 10. Verify RLS Works

1. Log in as a **Finance Manager** - you should see Add/Edit/Delete buttons
2. Log in as **Director** - you should see NO write buttons, and direct API calls should fail

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "Invalid login credentials" | Check email/password, ensure user is confirmed |
| "Row Level Security policy violation" | Check RLS policies ran correctly, verify user has profile row |
| "Bucket not found" | Run `003_storage.sql` migration |
| Redirect loop on login | Check middleware.ts, ensure `/auth/callback` route exists |
| Charts not loading | Check browser console for Recharts errors |

## Free Tier Limits

- **Database**: 500 MB
- **Storage**: 1 GB
- **Bandwidth**: 2 GB/month
- **Auth**: Unlimited users
- **Projects pause** after ~7 days of inactivity (log in weekly or set up a cron ping)

---

**Next step**: See `docs/DEPLOY_VERCEL.md` for deployment instructions.