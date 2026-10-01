# Supabase setup (step by step, no coding needed)

This sets up the free database, logins and file storage for UVfIN. It takes about 20 minutes.

## 1. Create the project

1. Go to <https://supabase.com>, sign in, and click **New project**.
2. Name: `uvfin`. Region: **Mumbai (ap-south-1)** if your team is in India.
3. Click **Generate a password**, then save that database password in your password manager. You need it only for backups.
4. Click **Create new project** and wait until the dashboard finishes loading.

## 2. Run the database scripts (in order)

1. In the left sidebar open **SQL Editor** and click **New query**.
2. Open `supabase/migrations/001_init.sql` from this repository, copy **all** of it, paste it into the editor, and click **Run**. You should see "Success. No rows returned".
3. Repeat with a **new query** for each of these, in this exact order:
   - `002_rls.sql`
   - `003_storage.sql`
   - `004_hardening.sql`

Each script runs once. If a script fails, stop and read the error. Don't run the next one until it succeeds.

What they do: 001 creates the tables and the automatic audit log, 002 turns on row-level security, 003 creates the private `attachments` bucket, and 004 adds the extra security locks and the reporting functions the dashboard uses.

## 3. Turn off public sign-up

1. Go to **Authentication → Sign In / Providers** (called **Providers** on older dashboards).
2. Under **User Signups**, turn **Allow new users to sign up** off and click **Save**.
3. Open the **Email** provider and make sure it is enabled (it's needed to sign in).

With this off, nobody can create an account by themselves. Only you, in the dashboard, can.

## 4. Create the three users

1. Go to **Authentication → Users → Add user → Create new user**.
2. Create each account with a strong password (12+ characters) and tick **Auto Confirm User**:

| Person | Role in UVfIN |
|---|---|
| Finance member 1 | finance_manager |
| Finance member 2 | finance_manager |
| Director | director |

3. After creating each one, click the user and copy their **User UID** (looks like `3f1c…-…`).

## 5. Give each user their role

1. Open `supabase/seed.sql`, copy it into a **new query** in the SQL Editor.
2. Remove the `-- ` at the start of the three `insert` blocks.
3. Replace each `<…_AUTH_UUID>` with the matching User UID from step 4, and replace the names.
4. Click **Run**.

A user who can log in but has no row here sees a "No access yet" page and can't see any data.

## 6. Copy the two keys the app needs

Go to **Project Settings → API** (or **Data API / API Keys** on newer dashboards) and copy:

| Supabase shows | Put it in |
|---|---|
| Project URL | `NEXT_PUBLIC_SUPABASE_URL` |
| `anon` `public` key (or the **Publishable key**, `sb_publishable_…`) | `NEXT_PUBLIC_SUPABASE_ANON_KEY` |

**Never** copy the `service_role` key or a **Secret key** (`sb_secret_…`) anywhere. UVfIN doesn't use it, and anyone who has it can bypass every security rule.

## 7. Set the site URL

Go to **Authentication → URL Configuration**:

- **Site URL**: `http://localhost:3000` for now. Change it to your Vercel address after deploying (see `DEPLOY_VERCEL.md`).

UVfIN signs in with email and password only, so no redirect URLs are needed.

## 8. Recommended extra security settings

- **Authentication → Sign In / Providers → Email**: set **Minimum password length** to 12 and tick the lowercase, uppercase, digits and symbols requirement.
- **Authentication → Rate Limits**: keep the defaults. They slow down password guessing.
- **Project Settings → General**: keep the project's **Data API** limited to the `public` schema (the default).

## 9. Check it worked

- **Storage**: there is a bucket called `attachments`, marked **Private**.
- **Table Editor → profiles**: three rows, with the right roles.
- **Database → Tables**: each table shows **RLS enabled**.

## Troubleshooting

| Problem | Fix |
|---|---|
| "Invalid email or password" | Check the password, and that **Auto Confirm User** was ticked |
| "No access yet" after login | The user has no row in `profiles`. Redo step 5 |
| Dashboard shows "Something went wrong" | `004_hardening.sql` was not run, or the project is paused (resume it in the dashboard) |
| `004_hardening.sql` says a constraint already exists | It was already run. Nothing to do |

Free plan: 500 MB database, 1 GB file storage. Projects **pause after about a week with no activity**. See `BACKUP.md` for keeping it awake.
