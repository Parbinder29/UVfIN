import { cn } from '@/lib/utils'

/** "UVfIN" with the "f" (Finance) in the accent colour. */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn('font-bold tracking-tight', className)} aria-label="UVfIN">
      UV<span className="text-brand-accent">f</span>IN
    </span>
  )
}
