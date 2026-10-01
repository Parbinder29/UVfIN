import { ShieldAlert } from 'lucide-react'
import { logout } from '@/actions/auth'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export const metadata = { title: 'No access · UVfIN' }

export default function NoAccessPage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-sm text-center">
        <CardHeader>
          <ShieldAlert className="mx-auto size-8 text-destructive" aria-hidden />
          <CardTitle>No access yet</CardTitle>
          <CardDescription>
            Your account exists but has no UVfIN role. Ask the administrator to add your profile in Supabase.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={logout}>
            <Button type="submit" variant="outline" className="w-full">
              Sign out
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  )
}
