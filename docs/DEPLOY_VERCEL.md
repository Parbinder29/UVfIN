# Deploy UVfIN to Vercel

## Prerequisites

- GitHub account
- Vercel account (free)
- Supabase project already set up (see `docs/SUPABASE_SETUP.md`)

## 1. Push to GitHub

```bash
# Initialize git if not already done
git init
git add .
git commit -m "Initial commit: UVfIN finance dashboard"

# Create repo on GitHub (via web or CLI)
# Then push:
git remote add origin https://github.com/YOUR_USERNAME/uvfin.git
git branch -M main
git push -u origin main
```

## 2. Import to Vercel

1. Go to [vercel.com](https://vercel.com) and sign in
2. Click **"Add New..."** → **"Project"**
3. Import your GitHub repo `uvfin`
4. Vercel auto-detects Next.js - keep defaults:
   - **Framework Preset**: Next.js
   - **Build Command**: `npm run build`
   - **Output Directory**: `.next`
   - **Install Command**: `npm install`
5. Click **"Deploy"** (but don't wait - we need env vars first)

## 3. Add Environment Variables

In Vercel project settings → **Environment Variables**, add:

| Name | Value | Environment |
|------|-------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://your-project-ref.supabase.co` | Production, Preview, Development |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `your-anon-key` | Production, Preview, Development |
| `NEXT_PUBLIC_CURRENCY` | `INR` | All |
| `NEXT_PUBLIC_LOCALE` | `en-IN` | All |

Click **Save** for each.

## 4. Redeploy

1. Go to **Deployments** tab
2. Click **"..."** on latest deployment → **"Redeploy"**
3. Wait for build to complete

## 5. Configure Supabase Auth for Production

1. In Supabase dashboard → **Authentication** → **Settings**
2. Update **Site URL** to your Vercel URL: `https://your-app.vercel.app`
3. Add to **Redirect URLs**:
   - `https://your-app.vercel.app/auth/callback`
   - `https://your-app.vercel.app/**` (wildcard for all routes)

## 6. (Optional) Custom Domain

### Subdomain: `finance.uvingroup.com`

1. In Vercel project → **Settings** → **Domains**
2. Click **"Add"** → enter `finance.uvingroup.com`
3. Vercel will show DNS records to configure:

**For CNAME (recommended for subdomains):**
| Type | Name | Value |
|------|------|-------|
| CNAME | finance | cname.vercel-dns.com |

**For A record (apex domain):**
| Type | Name | Value |
|------|------|-------|
| A | @ | 76.76.21.21 |

4. Add records in your DNS provider (GoDaddy, Cloudflare, etc.)
5. Wait for DNS propagation (up to 48 hours, usually minutes)
6. Vercel will auto-provision SSL certificate

### Update Supabase Redirect URLs

After domain is live, add to Supabase Auth Redirect URLs:
- `https://finance.uvingroup.com/auth/callback`
- `https://finance.uvingroup.com/**`

## 7. Verify Deployment

1. Visit your Vercel URL (or custom domain)
2. Should redirect to `/login`
3. Log in with Finance Manager account
4. Verify:
   - Dashboard loads with charts
   - Money Spent / Earnings / Investments pages work
   - Add/Edit/Delete works for Finance Manager
   - Director account shows read-only view

## 8. Production Checklist

- [ ] Build passes on Vercel
- [ ] Environment variables set correctly
- [ ] Supabase Auth redirect URLs updated
- [ ] Custom domain configured (if applicable)
- [ ] SSL certificate active
- [ ] Both Finance Manager and Director logins work
- [ ] RLS policies enforced (Director cannot write)
- [ ] Attachments upload works (Storage bucket)
- [ ] CSV exports work

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Build fails on `npm run build` | Check build logs, usually missing env vars or TypeScript errors |
| Auth redirect fails | Verify `NEXT_PUBLIC_SUPABASE_URL` matches exactly, check redirect URLs in Supabase |
| "Cookie not found" errors | Ensure `@supabase/ssr` middleware is working, check domain settings |
| Images not loading | Check `next.config.ts` for allowed image domains |
| Server Actions fail | Ensure `use server` directives are correct, check Supabase client usage |

## Free Tier Limits on Vercel

- **Bandwidth**: 100 GB/month
- **Serverless Function Execution**: 100 GB-hours/month
- **Builds**: Unlimited
- **Projects**: Unlimited

---

**Next step**: See `docs/BACKUP.md` for backup strategy.