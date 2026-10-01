'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PAGE_SIZE } from '@/lib/constants'
import { useUpdateParams } from './useUpdateParams'

export function PaginationBar({ page, count }: { page: number; count: number }) {
  const { update, pending } = useUpdateParams()
  const pages = Math.max(1, Math.ceil(count / PAGE_SIZE))
  if (count === 0) return null
  const from = (page - 1) * PAGE_SIZE + 1
  const to = Math.min(page * PAGE_SIZE, count)
  const go = (p: number) => update({ page: p > 1 ? String(p) : null }, { resetPage: false })

  return (
    <nav aria-label="Pagination" className="flex items-center justify-between gap-2 text-sm text-muted-foreground">
      <span>
        {from}–{to} of {count}
      </span>
      <div className="flex items-center gap-1">
        <Button variant="outline" size="sm" onClick={() => go(page - 1)} disabled={page <= 1 || pending} aria-label="Previous page">
          <ChevronLeft />
          <span className="hidden sm:inline">Previous</span>
        </Button>
        <span className="px-2">
          Page {page} of {pages}
        </span>
        <Button variant="outline" size="sm" onClick={() => go(page + 1)} disabled={page >= pages || pending} aria-label="Next page">
          <span className="hidden sm:inline">Next</span>
          <ChevronRight />
        </Button>
      </div>
    </nav>
  )
}
