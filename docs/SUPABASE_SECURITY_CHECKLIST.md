# Supabase security checklist

Work through this list once after setup (see `SUPABASE_SETUP.md`), and again every few months. Tick each box as you go.

> Never type real passwords, keys or emails into files in this project. Run one-off SQL straight in the Supabase **SQL Editor**.

## 1. Strong passwords for every account (urgent)

- [ ] Change each user's password if it is short or easy to guess. Newer dashboards have no button for this, so use **SQL Editor → New query**, put in the password and email, and click **Run**:

  ```sql
  update auth.users
  set encrypted_password = extensions.crypt('NEW-PASSWORD', extensions.gen_salt('bf')),
      updated_at = now()
  where email = 'their@email.com'
  returning email;
  ```

  The email appears in the results if it worked. Delete the saved query afterwards so the password isn't left in it. This skips the password rules in step 4, so use a strong password.
- [ ] Use 16+ random characters, generated and stored in a password manager.
- [ ] Each person gets their own password, never shared.

## 2. Run every database script

- [ ] **SQL Editor → New query**: confirm `001` to `005` in `supabase/migrations/` have all been run, in order.
- [ ] If `005_search_path.sql` is new to you, paste all of it and click **Run**.

## 3. Block strangers from creating accounts

- [ ] **Authentication → Sign In / Providers → User Signups**: **Allow new users to sign up** is **off**, then **Save**.

## 4. Enforce strong passwords

**Authentication → Sign In / Providers → Email**:

- [ ] **Minimum password length**: 12
- [ ] **Password requirements**: lowercase, uppercase, digits and symbols
- [ ] **Prevent use of leaked passwords**: on (Pro plan only; skip it on Free)

## 5. Security Advisor

- [ ] **Advisors → Security Advisor → Rerun linter**.
- [ ] It shows no errors. These 4 warnings are expected and safe, so leave them:
  - **Signed-In Users Can Execute SECURITY DEFINER Function** for `current_app_role()`, `has_finance_access()` and `is_finance_manager()`. The access rules call these on every request, and each only reports on the person asking. Removing access locks everyone out.
  - **Leaked Password Protection Disabled**: a Pro plan feature.
- [ ] Anything else: fix it before going live.

## 6. Confirm the protections are on

- [ ] **Database → Tables**: every table shows **RLS enabled**.
- [ ] **Storage**: the `attachments` bucket is **Private**.
- [ ] **Table Editor → profiles**: only your 3 people, with the right roles. Delete any row you don't recognise.
- [ ] **Authentication → Users**: only your 3 people. Delete anyone else.

## 7. Protect the keys

- [ ] The app and Vercel use only the **Project URL** and the **anon / Publishable** key.
- [ ] The **`service_role`** key and any **Secret key** (`sb_secret_…`) are never in the app, Vercel, chat, email or any file.
- [ ] If a key or the database password may have been shared: **Project Settings → API**, rotate it, then update the values in Vercel and redeploy.

## 8. Protect the accounts that control everything

- [ ] Two-factor authentication is on for your **Supabase**, **Vercel** and **GitHub** logins, with recovery codes saved in your password manager.
- [ ] Use **Google Authenticator** (publisher Google LLC) or **Microsoft Authenticator** (Microsoft Corporation). They are free. Look-alike apps that ask for a subscription are not the real ones.
- [ ] Only people who need it are members of the Supabase organisation and the Vercel project.

## 9. Leave these at the defaults

- [ ] **Authentication → Rate Limits**: unchanged (they slow down password guessing).
- [ ] **Project Settings → Data API**: exposed schemas are only `public`.

## 10. Routine

- [ ] **Monthly**: check **Authentication → Users** and **profiles** for unknown accounts.
- [ ] **Monthly**: rerun the Security Advisor. Only the 4 warnings from step 5 should appear.
- [ ] **When someone leaves**: in **Table Editor → profiles**, delete their row. They lose all access at once and see only the "No access yet" page. Their name then shows blank in "Added By" columns, but the audit log keeps every change. Then reset their password in **Authentication → Users** to a random one nobody knows. Don't delete the user itself: their records point to it, so the delete fails. Change any shared passwords they knew.
- [ ] Follow `BACKUP.md` for backups and restore tests.
