import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Wordmark } from '@/components/layout/Wordmark'
import { LoginForm } from './LoginForm'

export const metadata = { title: 'Sign in · UVfIN' }

export default function LoginPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-muted/40 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-4xl">
            <Wordmark />
          </CardTitle>
          <CardDescription>Sign in to the UVIN Group finance dashboard</CardDescription>
        </CardHeader>
        <CardContent>
          <LoginForm />
          <p className="mt-6 text-center text-xs text-muted-foreground">
            Accounts are created by the administrator. Forgot your password? Ask them to reset it.
          </p>
        </CardContent>
      </Card>
      <p className="text-xs text-muted-foreground">UVIN Group · uvingroup.com</p>
    </main>
  )
}
