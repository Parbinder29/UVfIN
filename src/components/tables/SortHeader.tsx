'use client'

import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useUpdateParams } from './useUpdateParams'

export function SortHeader({
  label,
  sortKey,
  defaultSort = 'date',
  align = 'left',
}: {
  label: string
  sortKey: string
  defaultSort?: string
  align?: 'left' | 'right'
}) {
  const { update, searchParams } = useUpdateParams()
  const current = searchParams.get('sort') || defaultSort
  const dir = searchParams.get('dir') === 'asc' ? 'asc' : 'desc'
  const active = current === sortKey
  const Icon = !active ? ArrowUpDown : dir === 'asc' ? ArrowUp : ArrowDown

  return (
    <button
      type="button"
      onClick={() => update({ sort: sortKey, dir: active && dir === 'desc' ? 'asc' : 'desc' })}
      className={cn(
        'inline-flex items-center gap-1 rounded-sm font-medium hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
        align === 'right' && 'ml-auto flex-row-reverse'
      )}
      aria-label={`Sort by ${label}${active ? (dir === 'asc' ? ', currently ascending' : ', currently descending') : ''}`}
    >
      {label}
      <Icon className={cn('size-3.5', !active && 'opacity-40')} aria-hidden />
    </button>
  )
}
