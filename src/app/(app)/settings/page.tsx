import { Eye, ShieldCheck } from 'lucide-react'
import { PageHeader } from '@/components/shared/PageHeader'
import { ChangePasswordForm } from '@/components/settings/ChangePasswordForm'
import { SignOutEverywhere } from '@/components/settings/SignOutEverywhere'
import { ThemeChoice } from '@/components/settings/ThemeChoice'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { requireUserWith } from '@/lib/auth'
import { CURRENCY, LOCALE, TIMEZONE } from '@/lib/env'
import { formatDateTime } from '@/lib/format'
import { getTeam } from '@/lib/queries'
import { createClient } from '@/lib/supabase/server'
import type { UserRole } from '@/types'

export const metadata = { title: 'Settings · UVfIN' }

const ACCESS: Record<UserRole, string> = {
  finance_manager: 'Can add, edit, import and delete entries',
  director: 'View only',
}

async function getSignInDetails() {
  const supabase = await createClient()
  const { data } = await supabase.auth.getUser()
  return { lastSignIn: data.user?.last_sign_in_at ?? null, createdAt: data.user?.created_at ?? null }
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1 py-2 sm:grid-cols-[10rem_1fr] sm:gap-4">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium break-words">{children}</dd>
    </div>
  )
}

export default async function SettingsPage() {
  const [user, [team, signIn]] = await requireUserWith(Promise.all([getTeam(), getSignInDetails()]))
  const { profile } = user
  const title = profile.designation || (profile.role === 'finance_manager' ? 'Finance Manager' : 'Director')

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader title="Settings" description="Your account, password, appearance and team." />

      <Card>
        <CardHeader>
          <CardTitle>Your account</CardTitle>
          <CardDescription>Name, title and access are set by the administrator.</CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="divide-y">
            <Row label="Name">{profile.full_name}</Row>
            <Row label="Email">{user.email || '—'}</Row>
            <Row label="Title">{title}</Row>
            <Row label="Access">{ACCESS[profile.role]}</Row>
            <Row label="Member since">{signIn.createdAt ? formatDateTime(signIn.createdAt) : '—'}</Row>
          </dl>
        </CardContent>
      </Card>

      <Card id="password">
        <CardHeader>
          <CardTitle>Change password</CardTitle>
          <CardDescription>You&rsquo;ll stay signed in here. Any other phone or computer you use will be signed out.</CardDescription>
        </CardHeader>
        <CardContent>
          <ChangePasswordForm email={user.email} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
          <CardDescription>Saved on this device.</CardDescription>
        </CardHeader>
        <CardContent>
          <ThemeChoice />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Security</CardTitle>
          <CardDescription>If you signed in on a shared device or think someone knows your password, sign out everywhere and change it.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <dl>
            <Row label="Last sign-in">{signIn.lastSignIn ? formatDateTime(signIn.lastSignIn) : '—'}</Row>
          </dl>
          <SignOutEverywhere />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Team</CardTitle>
          <CardDescription>
            Everyone who can sign in to UVfIN. To add someone, change a title or remove access, the administrator uses the
            queries in <code className="text-xs">supabase/admin/manage-users.sql</code>.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="divide-y">
            {team.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {p.full_name}
                    {p.id === user.id && <span className="text-muted-foreground"> (you)</span>}
                  </p>
                  <p className="text-xs text-muted-foreground">{p.designation || (p.role === 'finance_manager' ? 'Finance Manager' : 'Director')}</p>
                </div>
                {p.role === 'finance_manager' ? (
                  <Badge className="bg-accent text-accent-foreground">
                    <ShieldCheck aria-hidden />
                    Can edit
                  </Badge>
                ) : (
                  <Badge variant="outline">
                    <Eye aria-hidden />
                    View only
                  </Badge>
                )}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>About</CardTitle>
          <CardDescription>Company-wide settings. To change them, set NEXT_PUBLIC_CURRENCY, NEXT_PUBLIC_TIMEZONE or NEXT_PUBLIC_LOCALE in Vercel and redeploy.</CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="divide-y">
            <Row label="Company">UVIN Group · uvingroup.com</Row>
            <Row label="Currency">{CURRENCY}</Row>
            <Row label="Time zone">{TIMEZONE}</Row>
            <Row label="Number & date format">{LOCALE}</Row>
          </dl>
        </CardContent>
      </Card>
    </div>
  )
}
