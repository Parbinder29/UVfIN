'use client'

import { useMemo } from 'react'
import { cn } from '@/lib/utils'
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationPrevious,
  PaginationNext,
  PaginationEllipsis,
} from '@/components/ui/pagination'

interface PaginationProps {
  totalPages: number
  currentPage: number
  onPageChange: (page: number) => void
  className?: string
  showControls?: boolean
  showPageNumbers?: boolean
  siblingCount?: number
}

export function PaginationWrapper({
  totalPages,
  currentPage,
  onPageChange,
  className,
  showControls = true,
  showPageNumbers = true,
  siblingCount = 1,
}: PaginationProps) {
  if (totalPages <= 1) return null

  const pages = useMemo(() => {
    if (!showPageNumbers) return []

    const pages: (number | 'ellipsis')[] = []
    const total = totalPages
    const current = currentPage
    const siblings = siblingCount

    pages.push(1)

    if (current - siblings > 2) {
      pages.push('ellipsis')
    }

    const start = Math.max(2, current - siblings)
    const end = Math.min(total - 1, current + siblings)

    for (let i = start; i <= end; i++) {
      pages.push(i)
    }

    if (current + siblings < total - 1) {
      pages.push('ellipsis')
    }

    if (total > 1) {
      pages.push(total)
    }

    return pages
  }, [totalPages, currentPage, showPageNumbers, siblingCount])

  const handlePageClick = (page: number, e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault()
    if (page >= 1 && page <= totalPages) {
      onPageChange(page)
    }
  }

  const handlePrevClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault()
    if (currentPage > 1) onPageChange(currentPage - 1)
  }

  const handleNextClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault()
    if (currentPage < totalPages) onPageChange(currentPage + 1)
  }

  return (
    <Pagination className={cn('mt-4', className)}>
      <PaginationContent>
        {showControls && (
          <PaginationItem>
            <PaginationPrevious
              href="#"
              onClick={handlePrevClick}
              aria-disabled={currentPage === 1}
            />
          </PaginationItem>
        )}

        {pages.map((page, index) =>
          page === 'ellipsis' ? (
            <PaginationItem key={`ellipsis-${index}`}>
              <PaginationEllipsis />
            </PaginationItem>
          ) : (
            <PaginationItem key={page}>
              <PaginationLink
                href="#"
                isActive={page === currentPage}
                onClick={(e) => handlePageClick(page, e)}
              >
                {page}
              </PaginationLink>
            </PaginationItem>
          )
        )}

        {showControls && (
          <PaginationItem>
            <PaginationNext
              href="#"
              onClick={handleNextClick}
              aria-disabled={currentPage === totalPages}
            />
          </PaginationItem>
        )}
      </PaginationContent>
    </Pagination>
  )
}