'use client'

import { useSyncExternalStore } from 'react'
import { Monitor, Moon, Sun } from 'lucide-react'
import { useTheme } from 'next-themes'
import { cn } from '@/lib/utils'

const OPTIONS = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'Same as device', icon: Monitor },
] as const

const noop = () => () => {}

export function ThemeChoice() {
  const { theme, setTheme } = useTheme()
  // The saved theme is only known in the browser; show nothing selected until then.
  const mounted = useSyncExternalStore(noop, () => true, () => false)
  const current = mounted ? (theme ?? 'system') : null

  return (
    <div role="radiogroup" aria-label="Theme" className="inline-flex flex-wrap gap-2">
      {OPTIONS.map(({ value, label, icon: Icon }) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={current === value}
          onClick={() => setTheme(value)}
          className={cn(
            'inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring',
            current === value ? 'border-primary bg-primary/10 text-foreground' : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <Icon className="size-4" aria-hidden />
          {label}
        </button>
      ))}
    </div>
  )
}
