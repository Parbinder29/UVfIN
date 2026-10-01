# Deploy UVfIN to Vercel (free)

Do `SUPABASE_SETUP.md` first.

## 1. Code on GitHub

The code is in a GitHub repository (for example `Parbinder29/UVfIN`). Keep the repository **private** if you can. It contains no secrets, but there's no reason to publish an internal finance tool.

## 2. Import into Vercel

1. Sign in at <https://vercel.com> with your GitHub account.
2. Click **Add New… → Project**, find the UVfIN repository and click **Import**.
3. Leave the build settings as Vercel detects them (Next.js).
4. Open **Environment Variables** and add:

| Name | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | your Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | your anon / publishable key |
| `NEXT_PUBLIC_CURRENCY` | `INR` (optional) |
| `NEXT_PUBLIC_LOCALE` | `en-IN` (optional) |
| `NEXT_PUBLIC_TIMEZONE` | `Asia/Kolkata` (optional) |

Do **not** add a service role or secret key.

5. Click **Deploy**. When it finishes, Vercel shows your address, for example `https://uvfin.vercel.app`.

## 3. Tell Supabase the new address

Supabase → **Authentication → URL Configuration** → **Site URL** = your Vercel address. Click **Save**.

## 4. Check it

- Open the Vercel address. You should land on the login page.
- Sign in as a finance member: Add buttons are visible.
- Sign in as the director: no Add, Edit or Delete controls anywhere.

## 5. Optional: use `finance.uvingroup.com`

1. Vercel → your project → **Settings → Domains** → add `finance.uvingroup.com`.
2. Vercel shows a **CNAME** record (usually `cname.vercel-dns.com`). In the DNS settings where `uvingroup.com` is managed, add:
   - Type `CNAME`, Name `finance`, Value `cname.vercel-dns.com`.
3. Wait for Vercel to show the domain as valid (HTTPS is automatic).
4. Update the Supabase **Site URL** to `https://finance.uvingroup.com`.

## 6. Updates

Every push to the main branch redeploys automatically. Pull requests get their own preview link. Previews use the same database, so treat preview data as real.

## Security notes

- Vercel serves only HTTPS. The app also sends strict security headers (CSP, HSTS, no framing, nosniff) from `next.config.ts`.
- If you ever suspect a key leaked, open Supabase → **Project Settings → API**, rotate the keys, and update the Vercel variables.
