import { cn } from '@/lib/utils'

/** The UV monogram: a "U" holding a "V" tick, on an accent tile. Same drawing as src/app/icon.svg. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={cn('size-8 shrink-0', className)}>
      <rect width="32" height="32" rx="8" className="fill-brand-accent" />
      <path d="M9 8v8.5a7 7 0 0 0 14 0V8" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" />
      <path d="M12.75 12.5 16 17.5l3.25-5" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/** "UVfIN" with the "f" (Finance) in the accent colour. */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn('font-bold tracking-tight', className)} aria-label="UVfIN">
      UV<span className="text-brand-accent">f</span>IN
    </span>
  )
}

/** Full logo: mark, name and (optionally) the "UVIN Management" line. Sized by the font size of its parent. */
export function Logo({ tagline = true, className }: { tagline?: boolean; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-[0.4em]', className)}>
      <LogoMark className="size-[1.5em]" />
      <span className="flex flex-col items-start leading-none">
        <Wordmark />
        {tagline && (
          <span className="mt-[0.2em] text-[0.4em] font-semibold tracking-[0.18em] uppercase opacity-60">UVIN Management</span>
        )}
      </span>
    </span>
  )
}
