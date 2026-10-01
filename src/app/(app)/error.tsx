'use client'

import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function AppError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div role="alert" className="mx-auto flex max-w-md flex-col items-center gap-3 py-16 text-center">
      <AlertTriangle className="size-8 text-destructive" aria-hidden />
      <h2 className="text-lg font-semibold">Something went wrong</h2>
      <p className="text-sm text-muted-foreground">
        The data could not be loaded. Check your connection and try again. If the Supabase project was paused, the
        administrator needs to resume it.
      </p>
      <Button onClick={reset}>Try again</Button>
    </div>
  )
}
