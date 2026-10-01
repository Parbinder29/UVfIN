import Link from 'next/link'
import { cn } from '@/lib/utils'

export function InvestmentsNav({ active }: { active: 'investments' | 'investors' }) {
  const tab = (href: string, label: string, isActive: boolean) => (
    <Link
      href={href}
      aria-current={isActive ? 'page' : undefined}
      className={cn(
        'rounded-md px-3 py-1.5 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
        isActive ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
      )}
    >
      {label}
    </Link>
  )
  return (
    <nav aria-label="Investments sections" className="inline-flex rounded-lg bg-muted p-1">
      {tab('/investments', 'Contributions', active === 'investments')}
      {tab('/investments/investors', 'Investors', active === 'investors')}
    </nav>
  )
}
